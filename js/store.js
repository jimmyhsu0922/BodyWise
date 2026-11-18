// Everything is saved on this device (localStorage; pictures in IndexedDB).
// With cloud sync turned on (Settings), the same data is also kept in the
// student's own private GitHub repository so every device shares it; see sync.js.
const KEYS = {
  notes: 'bs.notes',
  chats: 'bs.chats', // AI tutor chats from earlier versions; kept and synced, not shown
  chatsAt: 'bs.chatsAt', // { topicId: last change time }
  settings: 'bs.settings',
  prefsAt: 'bs.prefsAt', // { setting: last change time } for the synced settings
  done: 'bs.done',
  doneAt: 'bs.doneAt', // { topicId: { done, at } }
  summaries: 'bs.summaries', // older versions; read once to migrate
  aiNotes: 'bs.aiNotes', // image notes (named after the old AI notes)
  deleted: 'bs.deleted', // { id: { at, image? } } so deletions sync too
  sync: 'bs.sync', // cloud sync setup for this device
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

/* ---------- Change listeners (cloud sync) ---------- */
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
function changed() { listeners.forEach((fn) => fn()); }

function markDeleted(id, extra = {}) {
  const deleted = read(KEYS.deleted, {});
  deleted[id] = { at: Date.now(), ...extra };
  write(KEYS.deleted, deleted);
}

/* ---------- Settings ---------- */
const DEFAULT_SETTINGS = {
  lang: '', // '' = follow the phone's language
};

// Settings shared between devices.
export const SYNCED_PREFS = ['lang'];

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}

export function saveSettings(patch) {
  const before = getSettings();
  const ok = write(KEYS.settings, { ...before, ...patch });
  const edited = SYNCED_PREFS.filter((k) => k in patch && patch[k] !== before[k]);
  if (edited.length) {
    const at = prefsAt();
    for (const k of edited) at[k] = Date.now();
    write(KEYS.prefsAt, at);
    changed();
  }
  return ok;
}

// When each synced setting was last changed here (0 = never: a default).
function prefsAt() {
  const at = read(KEYS.prefsAt, {});
  return typeof at === 'number' ? Object.fromEntries(SYNCED_PREFS.map((k) => [k, at])) : at;
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
  changed();
  return i >= 0 ? notes[i] : notes[notes.length - 1];
}

export function deleteNote(id) {
  write(KEYS.notes, read(KEYS.notes, []).filter((n) => n.id !== id));
  markDeleted(id);
  changed();
}

/* ---------- Image notes ---------- */
// { id, topic, title, caption, images: [imageId…], at, updatedAt }
// Pictures live in IndexedDB (images.js). The list is stored under the old
// "AI notes" key so existing notes and synced data carry over.
export const imageIdsOf = (n) => n.images || [];

// Earlier versions had AI-written notes (a "card" of questions and answers,
// maybe one attached picture). Turn those into plain image notes: the card
// text becomes the description, and the picture is kept.
function upgrade(n) {
  if (!n.card && !n.imageId && Array.isArray(n.images) && 'title' in n) return n;
  const c = n.card;
  const text = c ? [
    c.subtitle,
    ...(c.points || []).map((p) => `${p.emoji ? `${p.emoji} ` : ''}${p.question}\n${p.answer}`),
    c.takeaway && `💡 ${c.takeaway}`,
  ].filter(Boolean).join('\n\n') : '';
  const { card, imageId, chatLength, source, lang, ...rest } = n;
  return {
    ...rest,
    title: n.title ?? c?.title ?? '',
    caption: n.caption || text,
    images: [...(n.images || []), ...(imageId ? [imageId] : [])],
  };
}

export function getImageNotes() {
  let notes = read(KEYS.aiNotes, null);
  if (!notes) {
    // The oldest versions kept one summary per topic.
    notes = Object.entries(read(KEYS.summaries, {})).map(([topic, s]) => ({ id: String(s.at), topic, ...s }));
  }
  const upgraded = notes.map(upgrade);
  if (upgraded.some((n, i) => n !== notes[i]) || !localStorage.getItem(KEYS.aiNotes)) write(KEYS.aiNotes, upgraded);
  return upgraded.sort((a, b) => (b.updatedAt || b.at) - (a.updatedAt || a.at));
}

export function getImageNote(id) {
  return getImageNotes().find((n) => n.id === id) || null;
}

// Creates or updates an image note; returns the saved note.
export function saveImageNote(note) {
  const notes = getImageNotes();
  const now = Date.now();
  const i = notes.findIndex((n) => n.id === note.id);
  const saved = i >= 0
    ? { ...notes[i], ...note, updatedAt: now }
    : { id: crypto.randomUUID?.() || String(now), at: now, updatedAt: now, caption: '', images: [], ...note };
  if (i >= 0) notes[i] = saved; else notes.unshift(saved);
  write(KEYS.aiNotes, notes);
  changed();
  return saved;
}

export function deleteImageNote(id) {
  const note = getImageNote(id);
  write(KEYS.aiNotes, getImageNotes().filter((n) => n.id !== id));
  const pictures = note ? imageIdsOf(note) : [];
  markDeleted(id, pictures.length ? { images: pictures } : {});
  changed();
}

// Pictures taken out of a note while editing: remove them on other devices too.
export function forgetImages(ids) {
  if (ids.length) markDeleted(`removed-images-${Date.now()}`, { images: ids });
}

// Titles match when they are the same apart from spaces, punctuation, and case.
export function normalizeTitle(title) {
  return String(title || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

export function imageNotesWithTitle(title) {
  const key = normalizeTitle(title);
  return key ? getImageNotes().filter((n) => normalizeTitle(n.title) === key) : [];
}

export function notesWithTitle(title) {
  const key = normalizeTitle(title);
  return key ? getNotes().filter((n) => normalizeTitle(n.title) === key) : [];
}

/* ---------- Topics marked as learned ---------- */
export function getDone() {
  return read(KEYS.done, []);
}

export function toggleDone(topicId) {
  const done = getDone();
  const next = done.includes(topicId) ? done.filter((d) => d !== topicId) : [...done, topicId];
  write(KEYS.done, next);
  const at = read(KEYS.doneAt, {});
  at[topicId] = { done: next.includes(topicId), at: Date.now() };
  write(KEYS.doneAt, at);
  changed();
  return next.includes(topicId);
}

/* ---------- Cloud sync ---------- */
export function getSyncConfig() {
  return { repo: '', token: '', lastSync: 0, ...read(KEYS.sync, {}) };
}

export function saveSyncConfig(patch) {
  write(KEYS.sync, { ...getSyncConfig(), ...patch });
}

// Everything that is shared between devices, with the times needed to merge.
export function snapshot() {
  const settings = getSettings();
  const known = getDone();
  const doneAt = read(KEYS.doneAt, {});
  for (const id of known) doneAt[id] ??= { done: true, at: 0 };
  return {
    notes: read(KEYS.notes, []),
    aiNotes: getImageNotes(),
    chats: read(KEYS.chats, {}),
    chatsAt: read(KEYS.chatsAt, {}),
    done: doneAt,
    prefs: Object.fromEntries(SYNCED_PREFS.map((k) => [k, settings[k]])),
    prefsAt: prefsAt(),
    deleted: read(KEYS.deleted, {}),
  };
}

// Replaces the shared data with a merged snapshot (doesn't count as a change).
export function applySnapshot(s) {
  write(KEYS.notes, s.notes);
  write(KEYS.aiNotes, s.aiNotes);
  write(KEYS.chats, s.chats);
  write(KEYS.chatsAt, s.chatsAt);
  write(KEYS.doneAt, s.done);
  write(KEYS.done, Object.entries(s.done).filter(([, v]) => v.done).map(([id]) => id));
  write(KEYS.settings, { ...getSettings(), ...s.prefs });
  write(KEYS.prefsAt, s.prefsAt);
  write(KEYS.deleted, s.deleted);
}

/* ---------- Backup ---------- */
// images: { [id]: dataURL } of the pictures attached to AI notes.
export function exportData(images = {}) {
  return JSON.stringify({
    app: 'body-study',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: read(KEYS.notes, []),
    chats: read(KEYS.chats, {}),
    aiNotes: getImageNotes(),
    images,
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
  const aiById = new Map(getImageNotes().map((n) => [n.id, n]));
  for (const n of data.aiNotes || []) if (!aiById.has(n.id)) aiById.set(n.id, n);
  write(KEYS.aiNotes, [...aiById.values()]);
  write(KEYS.done, [...new Set([...getDone(), ...(data.done || [])])]);
  changed();
  return { count: data.notes.length, images: data.images || {} };
}
