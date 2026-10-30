// Everything is saved on this device (localStorage). Nothing is uploaded except
// what you send to the AI.
const KEYS = {
  notes: 'bs.notes',
  chats: 'bs.chats',
  settings: 'bs.settings',
  done: 'bs.done',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Ask the browser not to clear our data when the phone is low on space.
export function requestPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
}

/* ---------- Settings ---------- */
const DEFAULT_SETTINGS = {
  lang: '', // '' = follow the phone's language
  provider: 'claude',
  apiKey: '', // Claude key
  model: 'claude-opus-5-5',
  geminiKey: '',
  geminiModel: 'gemini-flash-latest',
};

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}

export function saveSettings(patch) {
  return write(KEYS.settings, { ...getSettings(), ...patch });
}

/* ---------- Notes ---------- */
export function getNotes() {
  return read(KEYS.notes, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getNote(id) {
  return read(KEYS.notes, []).find((n) => n.id === id) || null;
}

export function saveNote(note) {
  const notes = read(KEYS.notes, []);
  const now = Date.now();
  const i = notes.findIndex((n) => n.id === note.id);
  if (i >= 0) {
    notes[i] = { ...notes[i], ...note, updatedAt: now };
  } else {
    notes.push({ id: crypto.randomUUID?.() || String(now), createdAt: now, updatedAt: now, ...note });
  }
  write(KEYS.notes, notes);
  return i >= 0 ? notes[i] : notes[notes.length - 1];
}

export function deleteNote(id) {
  write(KEYS.notes, read(KEYS.notes, []).filter((n) => n.id !== id));
}

/* ---------- Chat history (one conversation per topic) ---------- */
export function getChat(topicId) {
  return read(KEYS.chats, {})[topicId] || [];
}

export function saveChat(topicId, messages) {
  const chats = read(KEYS.chats, {});
  chats[topicId] = messages;
  write(KEYS.chats, chats);
}

/* ---------- Topics marked as learned ---------- */
export function getDone() {
  return read(KEYS.done, []);
}

export function toggleDone(topicId) {
  const done = getDone();
  const next = done.includes(topicId) ? done.filter((d) => d !== topicId) : [...done, topicId];
  write(KEYS.done, next);
  return next.includes(topicId);
}

/* ---------- Backup ---------- */
export function exportData() {
  return JSON.stringify({
    app: 'body-study',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: read(KEYS.notes, []),
    chats: read(KEYS.chats, {}),
    done: getDone(),
  }, null, 2);
}

export function importData(text) {
  const data = JSON.parse(text);
  if (data.app !== 'body-study' || !Array.isArray(data.notes)) throw new Error('not-backup');
  // Merge notes by id so importing never loses notes already on this device.
  const byId = new Map(read(KEYS.notes, []).map((n) => [n.id, n]));
  for (const n of data.notes) {
    const existing = byId.get(n.id);
    if (!existing || (n.updatedAt || 0) > (existing.updatedAt || 0)) byId.set(n.id, n);
  }
  write(KEYS.notes, [...byId.values()]);
  write(KEYS.chats, { ...data.chats, ...read(KEYS.chats, {}) });
  write(KEYS.done, [...new Set([...getDone(), ...(data.done || [])])]);
  return data.notes.length;
}
