// Cloud sync: keeps the student's data in their own private GitHub
// repository so phone and computer share the same notes. One JSON file holds
// the data; pictures go in an images/ folder. Each device merges its data
// with the file (newest change wins, deletions included) and writes it back.
import * as store from './store.js';
import * as images from './images.js';

const API = 'https://api.github.com';
const DATA_FILE = 'bodywise-data.json';
const IMAGE_DIR = 'images';

export class SyncError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code; // auth | notFound | forbidden | public | offline | repoFormat | other
    this.status = status;
  }
}

/* ---------- Status ---------- */
let status = { state: store.getSyncConfig().token ? 'idle' : 'off', error: null };
const statusListeners = new Set();
export function onStatus(fn) { statusListeners.add(fn); }
export function getStatus() { return { ...status, lastSync: store.getSyncConfig().lastSync }; }
function setStatus(state, error = null) {
  status = { state, error };
  statusListeners.forEach((fn) => fn(getStatus()));
}

export function isEnabled() {
  const { repo, token } = store.getSyncConfig();
  return Boolean(repo && token);
}

/* ---------- GitHub API ---------- */
async function gh(path, { method = 'GET', body, raw = false } = {}) {
  const { repo, token } = store.getSyncConfig();
  if (!navigator.onLine) throw new SyncError('offline');
  let res;
  try {
    res = await fetch(`${API}/repos/${repo}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new SyncError('offline');
  }
  return res;
}

function fail(res) {
  if (res.status === 401) return new SyncError('auth', 401);
  if (res.status === 404) return new SyncError('notFound', 404);
  if (res.status === 403) return new SyncError('forbidden', 403);
  return new SyncError('other', res.status);
}

const contentPath = (file) => `/contents/${file.split('/').map(encodeURIComponent).join('/')}`;

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const fromBase64 = (b64) => Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0));

// The data file and its version (sha), or { doc: null } if it doesn't exist yet.
async function readData() {
  const res = await gh(contentPath(DATA_FILE));
  if (res.status === 404) {
    // Tell "no file yet" apart from "no repository / no access".
    const repo = await gh('');
    if (!repo.ok) throw fail(repo);
    return { doc: null, sha: null };
  }
  if (!res.ok) throw fail(res);
  const meta = await res.json();
  let text;
  if (meta.content) {
    text = new TextDecoder().decode(fromBase64(meta.content));
  } else {
    // Files over 1 MB come without content; fetch them raw.
    const rawRes = await gh(contentPath(DATA_FILE), { raw: true });
    if (!rawRes.ok) throw fail(rawRes);
    text = await rawRes.text();
  }
  return { doc: JSON.parse(text), sha: meta.sha };
}

// Writes the data file; returns false if someone else wrote it first.
async function writeData(doc, sha) {
  const content = toBase64(new TextEncoder().encode(JSON.stringify(doc)));
  const res = await gh(contentPath(DATA_FILE), {
    method: 'PUT',
    body: { message: 'BodyWise sync', content, ...(sha && { sha }) },
  });
  if (res.status === 409 || res.status === 422) return false;
  if (!res.ok) throw fail(res);
  return true;
}

/* ---------- Merge ---------- */
const EMPTY = { notes: [], aiNotes: [], chats: {}, chatsAt: {}, done: {}, prefs: {}, prefsAt: {}, deleted: {} };

function mergeRecords(a, b, deleted, version) {
  const byId = new Map();
  for (const r of [...a, ...b]) {
    const old = byId.get(r.id);
    if (!old || version(r) > version(old)) byId.set(r.id, r);
  }
  return [...byId.values()]
    .filter((r) => !(deleted[r.id] && deleted[r.id].at >= version(r)))
    .sort((x, y) => (x.id < y.id ? -1 : 1));
}

export function merge(local, remote) {
  const a = { ...EMPTY, ...local };
  const b = { ...EMPTY, ...remote };
  if (typeof b.prefsAt === 'number') b.prefsAt = {}; // file written before per-setting times
  const deleted = { ...a.deleted };
  for (const [id, d] of Object.entries(b.deleted)) {
    if (!deleted[id] || d.at > deleted[id].at) deleted[id] = d;
  }
  const chats = {};
  const chatsAt = {};
  for (const topic of new Set([...Object.keys(a.chats), ...Object.keys(b.chats)])) {
    const useB = (b.chatsAt[topic] || 0) > (a.chatsAt[topic] || 0) || !(topic in a.chats);
    chats[topic] = useB ? b.chats[topic] : a.chats[topic];
    chatsAt[topic] = Math.max(a.chatsAt[topic] || 0, b.chatsAt[topic] || 0);
  }
  const done = { ...a.done };
  for (const [topic, d] of Object.entries(b.done)) {
    if (!done[topic] || d.at > done[topic].at) done[topic] = d;
  }
  // Settings merge one by one, so a new device's defaults never win.
  const prefs = { ...b.prefs, ...a.prefs };
  const prefsAt = {};
  for (const k of new Set([...Object.keys(a.prefs), ...Object.keys(b.prefs)])) {
    const atA = a.prefsAt[k] || 0;
    const atB = b.prefsAt[k] || 0;
    if (atB > atA || !(k in a.prefs)) prefs[k] = b.prefs[k];
    prefsAt[k] = Math.max(atA, atB);
  }
  return {
    notes: mergeRecords(a.notes, b.notes, deleted, (n) => n.updatedAt || 0),
    aiNotes: mergeRecords(a.aiNotes, b.aiNotes, deleted, (n) => n.updatedAt || n.at || 0),
    chats,
    chatsAt,
    done,
    prefs,
    prefsAt,
    deleted,
  };
}

// JSON with sorted keys and records sorted by id, so equal data compares equal.
function canonical(doc) {
  const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
    return v;
  };
  const byId = (list) => [...(list || [])].sort((x, y) => (x.id < y.id ? -1 : 1));
  return JSON.stringify(sortKeys({ ...EMPTY, ...doc, notes: byId(doc.notes), aiNotes: byId(doc.aiNotes) }));
}

/* ---------- Pictures ---------- */
async function syncImages(doc) {
  const config = store.getSyncConfig();
  const uploaded = new Set(config.uploaded || []);
  const removed = new Set(config.removed || []);
  for (const note of doc.aiNotes) {
    if (!note.imageId) continue;
    const path = contentPath(`${IMAGE_DIR}/${note.imageId}.jpg`);
    const local = await images.getImage(note.imageId).catch(() => null);
    if (!local) {
      // Not here yet: download it. A 404 means the other device hasn't
      // uploaded it yet, so try again next sync.
      const res = await gh(path, { raw: true });
      if (res.ok) {
        await images.putImage(note.imageId, await res.blob());
        uploaded.add(note.imageId);
      } else if (res.status !== 404) {
        throw fail(res);
      }
    } else if (!uploaded.has(note.imageId)) {
      const content = toBase64(new Uint8Array(await local.arrayBuffer()));
      const res = await gh(path, { method: 'PUT', body: { message: 'BodyWise picture', content } });
      if (!res.ok && res.status !== 422) throw fail(res); // 422: already there
      uploaded.add(note.imageId);
    }
  }
  // Pictures of deleted AI notes: remove them here and in the repository.
  for (const [, d] of Object.entries(doc.deleted)) {
    if (!d.image || removed.has(d.image)) continue;
    await images.deleteImage(d.image).catch(() => {});
    const path = contentPath(`${IMAGE_DIR}/${d.image}.jpg`);
    const meta = await gh(path);
    if (meta.ok) {
      const { sha } = await meta.json();
      const res = await gh(path, { method: 'DELETE', body: { message: 'BodyWise remove picture', sha } });
      if (!res.ok && res.status !== 404) throw fail(res);
    } else if (meta.status !== 404) {
      throw fail(meta);
    }
    removed.add(d.image);
  }
  store.saveSyncConfig({ uploaded: [...uploaded], removed: [...removed] });
}

/* ---------- Sync ---------- */
let running = null;
let again = false;
let timer = null;
let onRemoteChange = () => {};

export function init({ onRemoteChange: fn }) {
  onRemoteChange = fn;
  store.onChange(() => schedule(2500));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  window.addEventListener('online', () => syncNow());
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 120_000);
  syncNow();
}

export function schedule(delay) {
  if (!isEnabled()) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

// Runs one sync (or queues another if one is running). Resolves when done.
export function syncNow() {
  if (!isEnabled()) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    setStatus('syncing');
    try {
      let localChanged = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        const { doc: remote, sha } = await readData();
        const local = store.snapshot();
        const merged = merge(local, remote || {});
        if (canonical(merged) !== canonical(local)) {
          store.applySnapshot(merged);
          localChanged = true;
        }
        if (remote && canonical(merged) === canonical(remote)) break;
        if (await writeData({ app: 'bodywise', version: 1, ...merged }, sha)) break;
        // Another device saved in between: read again and merge with that.
      }
      await syncImages(store.snapshot());
      store.saveSyncConfig({ lastSync: Date.now() });
      setStatus('idle');
      if (localChanged) onRemoteChange();
    } catch (err) {
      setStatus('error', err instanceof SyncError ? err : new SyncError('other'));
    } finally {
      running = null;
      if (again) { again = false; schedule(500); }
    }
  })();
  return running;
}

// Checks a repository and token before saving them for this device.
export async function connect(repo, token) {
  repo = repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new SyncError('repoFormat');
  const previous = store.getSyncConfig();
  store.saveSyncConfig({ repo, token: token.trim(), uploaded: [], removed: [] });
  try {
    const res = await gh('');
    if (!res.ok) throw fail(res);
    const info = await res.json();
    if (!info.private) throw new SyncError('public');
    if (info.permissions && !info.permissions.push) throw new SyncError('forbidden', 403);
  } catch (err) {
    store.saveSyncConfig(previous); // keep the old setup if the new one doesn't work
    throw err;
  }
  await syncNow();
  if (status.state === 'error') throw status.error;
}

export function disconnect() {
  clearTimeout(timer);
  store.saveSyncConfig({ repo: '', token: '', lastSync: 0, uploaded: [], removed: [] });
  setStatus('off');
}
