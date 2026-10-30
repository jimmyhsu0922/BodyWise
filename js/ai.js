// AI tutor. Works with Claude (Anthropic) or Gemini (Google). The API keys are
// entered in Settings and stay on this device; requests go straight from the
// phone to the chosen provider.
import Anthropic from 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.135.0/+esm';
import { getSettings } from './store.js';

export const PROVIDERS = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'gemini', label: 'Gemini (Google)' },
];

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — best explanations' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — faster, cheaper' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — fastest, cheapest' },
];

// Aliases Google keeps pointing at its newest models; the full list can be
// loaded from Settings with the user's key.
export const GEMINI_MODELS = [
  { id: 'gemini-flash-latest', label: 'Gemini Flash (latest) — fast, has a free tier' },
  { id: 'gemini-pro-latest', label: 'Gemini Pro (latest) — best explanations' },
];

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';

export function hasApiKey() {
  const s = getSettings();
  return Boolean(s.provider === 'gemini' ? s.geminiKey : s.apiKey);
}

function tutorSystem(topic, notes) {
  const focus = topic.id === 'general'
    ? 'The student can ask about any part of human anatomy and physiology.'
    : `Current topic: ${topic.name}. Background the student has seen: ${topic.overview}`;
  const known = notes.length
    ? `\n\nThe student's own notes on this topic (what they believe they know):\n${notes.map((n) => `- ${n.title}: ${n.body}`).join('\n').slice(0, 6000)}`
    : '';
  return `You are a friendly, patient study tutor helping a student learn about the human body (anatomy and physiology).
${focus}${known}

How to teach:
- Explain in plain language first, then add the correct scientific terms.
- Keep answers short and focused (usually under 200 words). Use short lists and **bold** key terms.
- Use everyday analogies and real-life examples.
- When it helps, end with one short question that checks understanding.
- If the student's notes contain a mistake that is relevant, gently correct it.
- When asked to quiz, ask one question at a time and wait for the answer.
- Reply in the same language the student writes in.
- This is for learning, not diagnosis: if the student describes their own symptoms, give general information and suggest seeing a doctor or nurse.`;
}

/* ---------- Claude ---------- */
async function streamClaude({ system, messages, onText, signal }) {
  const { apiKey, model } = getSettings();
  if (!apiKey) throw new Error('Add your Claude API key in Settings first.');
  const params = {
    model,
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system,
    messages,
  };
  // If a safety check declines a request, let the API retry it on a suitable
  // fallback model automatically (not available for Haiku).
  if (model !== 'claude-haiku-5-5') {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = client.beta.messages.stream(params, { signal });
  let text = '';
  stream.on('text', (delta) => {
    text += delta;
    onText?.(text);
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    throw new Error('The AI could not answer that request. Try rephrasing your question.');
  }
  return text;
}

/* ---------- Gemini ---------- */
class GeminiError extends Error {}

async function geminiFailure(res) {
  let detail = '';
  try { detail = (await res.json()).error?.message || ''; } catch { /* not JSON */ }
  if (res.status === 400 && /api key/i.test(detail)) return new GeminiError('Your Gemini API key was rejected. Check it in Settings.');
  if (res.status === 403) return new GeminiError('This Gemini API key is not allowed to do that. Check the key in Settings.');
  if (res.status === 404) return new GeminiError('That Gemini model was not found. Pick another model in Settings.');
  if (res.status === 429) return new GeminiError('Gemini usage limit reached — wait a moment and try again.');
  return new GeminiError(`AI error: ${detail || res.statusText || res.status}`);
}

async function streamGemini({ system, messages, onText, signal }) {
  const { geminiKey, geminiModel } = getSettings();
  if (!geminiKey) throw new Error('Add your Gemini API key in Settings first.');
  let res;
  try {
    res = await fetch(`${GEMINI_API}/models/${encodeURIComponent(geminiModel)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: 8000 },
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new GeminiError('Could not reach the AI. Check your internet connection.');
  }
  if (!res.ok) throw await geminiFailure(res);

  // Server-sent events: each "data:" line is a JSON chunk of the answer.
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let text = '';
  let blocked = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      let chunk;
      try { chunk = JSON.parse(line.slice(5)); } catch { continue; }
      const cand = chunk.candidates?.[0];
      if (chunk.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY') blocked = true;
      for (const part of cand?.content?.parts || []) {
        if (part.text && !part.thought) text += part.text;
      }
      onText?.(text);
    }
  }
  if (!text && blocked) throw new GeminiError('The AI could not answer that request. Try rephrasing your question.');
  return text;
}

// Lists Gemini models the key can use for chat, for the Settings dropdown.
export async function listGeminiModels(key) {
  const res = await fetch(`${GEMINI_API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!res.ok) throw await geminiFailure(res);
  const { models = [] } = await res.json();
  return models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name))
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
}

/* ---------- Shared ---------- */
function streamReply(args) {
  return getSettings().provider === 'gemini' ? streamGemini(args) : streamClaude(args);
}

export function friendlyError(err) {
  if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) return 'Stopped.';
  if (err instanceof GeminiError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return 'Your API key was rejected. Check it in Settings.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'This API key is not allowed to use that model. Try another model in Settings.';
  if (err instanceof Anthropic.RateLimitError) return 'Too many requests right now — wait a moment and try again.';
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI. Check your internet connection.';
  if (err instanceof Anthropic.APIError) return `AI error: ${err.message}`;
  return err?.message || 'Something went wrong.';
}

export function askTutor({ topic, notes, history, onText, signal }) {
  return streamReply({ system: tutorSystem(topic, notes), messages: history, onText, signal });
}

export function checkNote({ topic, note, onText, signal }) {
  const system = `You are a supportive biology teacher reviewing a student's study note about the human body. The student wrote it from memory after studying, to check their understanding. Reply in the same language as the note.`;
  const prompt = `Topic: ${topic ? topic.name : 'General'}
Note title: ${note.title || '(untitled)'}

Student's note:
"""
${note.body}
"""

Give feedback in this format:
**✅ What you got right** — short bullet points.
**⚠️ Needs fixing** — any mistakes or misconceptions, with the correct version. Say "Nothing — well done!" if there are none.
**➕ Worth adding** — 1–3 important points they missed.
**Score:** X/10 for accuracy and completeness, with one encouraging sentence.
Keep it concise.`;
  return streamReply({ system, messages: [{ role: 'user', content: prompt }], onText, signal });
}
