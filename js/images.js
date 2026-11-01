// Pictures the student uploads for AI notes. They live in IndexedDB (not
// localStorage, which only holds a few MB), on this device only.
const DB_NAME = 'bodywise';
const STORE = 'images';
const MAX_SIDE = 1568; // big enough for the AI to read text, small enough to upload fast

let dbPromise = null;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(mode, fn) {
  const tx = (await db()).transaction(STORE, mode);
  const req = fn(tx.objectStore(STORE));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const putImage = (id, blob) => run('readwrite', (s) => s.put(blob, id));
export const getImage = (id) => run('readonly', (s) => s.get(id));
export const deleteImage = (id) => run('readwrite', (s) => s.delete(id));

// Shrinks a photo to at most MAX_SIDE pixels and re-encodes it as JPEG.
// Resolves to { blob, mediaType, base64 } or throws if it can't be read.
export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  return { blob, mediaType: 'image/jpeg', base64: await blobToBase64(blob) };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/* ---------- Backup ---------- */
// { [id]: dataURL } for the given ids, so pictures travel in the backup file.
export async function exportImages(ids) {
  const out = {};
  for (const id of ids) {
    const blob = await getImage(id).catch(() => null);
    if (blob) out[id] = `data:${blob.type};base64,${await blobToBase64(blob)}`;
  }
  return out;
}

export async function importImages(map = {}) {
  for (const [id, dataUrl] of Object.entries(map)) {
    if (await getImage(id).catch(() => null)) continue; // keep what's already here
    const blob = await (await fetch(dataUrl)).blob();
    await putImage(id, blob);
  }
}
