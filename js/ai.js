// AI tutor. Works with Claude (Anthropic) or Gemini (Google). The API keys are
// entered in Settings and stay on this device; requests go straight from the
// phone to the chosen provider.
import Anthropic from 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.135.0/+esm';
import { getSettings } from './store.js';
import { t, getLang } from './i18n.js';

export const PROVIDERS = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'gemini', label: 'Gemini (Google)' },
];

export function claudeModels() {
  return [
    { id: 'claude-opus-5-5', label: t('model.opus') },
    { id: 'claude-sonnet-5-5', label: t('model.sonnet') },
    { id: 'claude-haiku-5-5', label: t('model.haiku') },
  ];
}

// Aliases Google keeps pointing at its newest models; the full list can be
// loaded from Settings with the user's key.
export function geminiModels() {
  return [
    { id: 'gemini-flash-latest', label: t('model.geminiFlash') },
    { id: 'gemini-pro-latest', label: t('model.geminiPro') },
  ];
}

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';

export function hasApiKey() {
  const s = getSettings();
  return Boolean(s.provider === 'gemini' ? s.geminiKey : s.apiKey);
}

function replyLanguage() {
  return getLang() === 'zh-Hant' ? 'Traditional Chinese (繁體中文, as used in Taiwan)' : 'English';
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
- Reply in ${replyLanguage()}, unless the student writes in a different language — then reply in theirs.
- This is for learning, not diagnosis: if the student describes their own symptoms, give general information and suggest seeing a doctor or nurse.`;
}

/* ---------- Claude ---------- */
async function streamClaude({ system, messages, onText, signal, schema }) {
  const { apiKey, model } = getSettings();
  if (!apiKey) throw new Error(t('err.needClaudeKey'));
  const params = {
    model,
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system,
    messages,
  };
  if (schema) params.output_config.format = { type: 'json_schema', schema };
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
    throw new Error(t('err.refusal'));
  }
  return text;
}

/* ---------- Gemini ---------- */
class GeminiError extends Error {}

async function geminiFailure(res) {
  let detail = '';
  try { detail = (await res.json()).error?.message || ''; } catch { /* not JSON */ }
  if (res.status === 400 && /api key/i.test(detail)) return new GeminiError(t('err.geminiAuth'));
  if (res.status === 403) return new GeminiError(t('err.geminiPermission'));
  if (res.status === 404) return new GeminiError(t('err.geminiModel'));
  if (res.status === 429) return new GeminiError(t('err.geminiLimit'));
  return new GeminiError(t('err.api', { detail: detail || res.statusText || res.status }));
}

async function streamGemini({ system, messages, onText, signal, schema }) {
  const { geminiKey, geminiModel } = getSettings();
  if (!geminiKey) throw new Error(t('err.needGeminiKey'));
  let res;
  try {
    res = await fetch(`${GEMINI_API}/models/${encodeURIComponent(geminiModel)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: 8000, ...(schema && { responseMimeType: 'application/json' }) },
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new GeminiError(t('err.connection'));
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
  if (!text && blocked) throw new GeminiError(t('err.refusal'));
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
  if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) return t('err.stopped');
  if (err instanceof GeminiError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return t('err.claudeAuth');
  if (err instanceof Anthropic.PermissionDeniedError) return t('err.claudePermission');
  if (err instanceof Anthropic.RateLimitError) return t('err.rateLimit');
  if (err instanceof Anthropic.APIConnectionError) return t('err.connection');
  if (err instanceof Anthropic.APIError) return t('err.api', { detail: err.message });
  return err?.message || t('err.unknown');
}

export function askTutor({ topic, notes, history, onText, signal }) {
  return streamReply({ system: tutorSystem(topic, notes), messages: history, onText, signal });
}

export function checkNote({ topic, note, onText, signal }) {
  const zh = getLang() === 'zh-Hant';
  const system = `You are a supportive biology teacher reviewing a student's study note about the human body. The student wrote it from memory after studying, to check their understanding. Write your feedback in ${replyLanguage()}.`;
  const format = zh
    ? `請用這個格式回饋：
**✅ 正確的地方** — 簡短條列。
**⚠️ 需要修正** — 列出錯誤或迷思概念，並寫出正確說法。如果沒有，就寫「沒有，做得很好！」
**➕ 可以補充** — 1～3 個漏掉的重要重點。
**分數：** X/10（依正確性與完整度），加上一句鼓勵的話。
請保持簡潔。`
    : `Give feedback in this format:
**✅ What you got right** — short bullet points.
**⚠️ Needs fixing** — any mistakes or misconceptions, with the correct version. Say "Nothing — well done!" if there are none.
**➕ Worth adding** — 1–3 important points they missed.
**Score:** X/10 for accuracy and completeness, with one encouraging sentence.
Keep it concise.`;
  const prompt = `Topic: ${topic ? topic.name : 'General'}
Note title: ${note.title || '(untitled)'}

Student's note:
"""
${note.body}
"""

${format}`;
  return streamReply({ system, messages: [{ role: 'user', content: prompt }], onText, signal });
}

/* ---------- Summary card ---------- */
const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    points: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          emoji: { type: 'string' },
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['emoji', 'question', 'answer'],
        additionalProperties: false,
      },
    },
    takeaway: { type: 'string' },
  },
  required: ['title', 'subtitle', 'points', 'takeaway'],
  additionalProperties: false,
};

function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  throw new Error(t('err.summaryParse'));
}

// Turns the chat into the content of a one-glance summary image: one point
// per key thing the student asked about.
export async function summarizeChat({ topic, history, signal }) {
  const zh = getLang() === 'zh-Hant';
  const transcript = history
    .map((m) => `${m.role === 'user' ? 'STUDENT' : 'TUTOR'}: ${m.content}`)
    .join('\n\n')
    .slice(-24000);
  const system = `You turn a student's study conversation about the human body into the text for a one-glance summary card (an infographic image) that someone who did not see the chat can understand immediately. Write everything in ${replyLanguage()}.`;
  const prompt = `Topic: ${topic.name}

Conversation:
"""
${transcript}
"""

Create the summary card content as JSON with these fields:
- "title": what the student was learning about, ${zh ? '最多 16 個字' : 'at most 8 words'}.
- "subtitle": one sentence saying what the questions were about, ${zh ? '最多 30 個字' : 'at most 18 words'}.
- "points": one item for each key question the student asked, in the order asked, merging repeats; 2 to 6 items. Each has:
  - "emoji": one emoji that represents the point,
  - "question": the key thing they asked, rewritten as a short, clear question (${zh ? '最多 20 個字' : 'at most 12 words'}),
  - "answer": the core answer from the conversation, accurate and specific (${zh ? '最多 60 個字' : 'at most 35 words'}).
- "takeaway": the single most important idea to remember, ${zh ? '最多 30 個字' : 'at most 18 words'}.
Use plain text only (no Markdown). Base everything on the conversation; correct the tutor's wording only if it was scientifically wrong.`;
  const text = await streamReply({ system, messages: [{ role: 'user', content: prompt }], signal, schema: SUMMARY_SCHEMA });
  const card = parseJson(text);
  if (!Array.isArray(card.points) || !card.points.length) throw new Error(t('err.summaryParse'));
  card.points = card.points.slice(0, 6);
  return card;
}
