// AI tutor powered by Claude. The API key is entered in Settings and stays on
// this device; requests go straight from the phone to the Anthropic API.
import Anthropic from 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.135.0/+esm';
import { getSettings } from './store.js';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — best explanations' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — faster, cheaper' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — fastest, cheapest' },
];

export function hasApiKey() {
  return Boolean(getSettings().apiKey);
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
- This is for learning, not diagnosis: if the student describes their own symptoms, give general information and suggest seeing a doctor or nurse.`;
}

function client() {
  const { apiKey } = getSettings();
  if (!apiKey) throw new Error('Add your Claude API key in Settings first.');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// Streams a reply. onText gets the text so far; returns the final text.
async function streamReply({ system, messages, onText, signal }) {
  const { model } = getSettings();
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

  const stream = client().beta.messages.stream(params, { signal });
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

export function friendlyError(err) {
  if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) return 'Stopped.';
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
  const system = `You are a supportive biology teacher reviewing a student's study note about the human body. The student wrote it from memory after studying, to check their understanding.`;
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
