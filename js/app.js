import { topics, generalTopic, getTopic } from './topics.js';
import * as store from './store.js';
import * as images from './images.js';
import * as sync from './sync.js';
import { LANGUAGES, t, getLang, locale } from './i18n.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const MAX_IMAGES = 20;

/* ---------- Helpers ---------- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const multiline = (s) => esc(s).replace(/\n/g, '<br>');

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' });
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function setTitle(title, back) {
  $('#title').textContent = title;
  const b = $('#back');
  b.hidden = !back;
  b.onclick = () => (history.length > 1 ? history.back() : (location.hash = back));
}

function setTab(tab) {
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
}

// Text that lives in index.html rather than in a view.
function applyLanguage() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $('#back').setAttribute('aria-label', t('nav.back'));
}

function topicOptions(selected) {
  return [generalTopic(), ...topics()]
    .map((tp) => `<option value="${tp.id}" ${tp.id === selected ? 'selected' : ''}>${tp.icon} ${esc(tp.name)}</option>`)
    .join('');
}

// A modal sheet; the <dialog> is removed from the page when it closes.
function openSheet(title, bodyHtml, actionsHtml = '') {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet';
  dialog.innerHTML = `
    <div class="sheet-head">
      <h3>${title}</h3>
      <button class="link" data-close>${t('img.close')}</button>
    </div>
    <div class="sheet-body">${bodyHtml}</div>
    ${actionsHtml ? `<div class="actions">${actionsHtml}</div>` : ''}`;
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  $('[data-close]', dialog).onclick = () => dialog.close();
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.showModal();
  return dialog;
}

// Fills an <img> with a stored picture once it has loaded from IndexedDB.
async function showPicture(img, imageId) {
  const blob = await images.getImage(imageId).catch(() => null);
  if (blob && img.isConnected) img.src = URL.createObjectURL(blob);
}

/* ---------- Home ---------- */
function homeView() {
  setTitle('Body Study');
  setTab('learn');
  const all = topics();
  const general = generalTopic();
  const done = store.getDone();
  view.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">${t('home.progress')}</p>
        <p class="big">${done.length}<span>${t('home.topicsLearned', { total: all.length })}</span></p>
        <p class="muted">${t('home.notesWritten', { n: store.getNotes().length })} · ${t('home.imageNotes', { n: store.getImageNotes().length })}</p>
      </div>
      <div class="ring" style="--p:${(done.length / all.length) * 100}"></div>
    </section>
    <a class="card wide" href="#/topic/general" style="--c:${general.color}">
      <span class="icon">${general.icon}</span>
      <span><strong>${esc(general.name)}</strong><small>${t('home.generalSub')}</small></span>
    </a>
    <h2 class="section">${t('home.systems')}</h2>
    <div class="grid">
      ${all.map((tp) => `
        <a class="card" href="#/topic/${tp.id}" style="--c:${tp.color}">
          <span class="icon">${tp.icon}</span>
          <strong>${esc(tp.name)}</strong>
          ${done.includes(tp.id) ? `<span class="tick" aria-label="${t('home.learned')}">✓</span>` : ''}
        </a>`).join('')}
    </div>`;
}

/* ---------- Topic ---------- */
function topicView(id) {
  const topic = getTopic(id);
  if (!topic) return (location.hash = '#/');
  setTitle(topic.name, '#/');
  setTab('learn');
  const isGeneral = topic.id === 'general';
  const notes = store.getNotes().filter((n) => n.topic === topic.id);
  const imageNotes = store.getImageNotes().filter((n) => n.topic === topic.id);
  const learned = store.getDone().includes(topic.id);

  view.innerHTML = `
    <section class="panel topic-head" style="--c:${topic.color}">
      <div class="topic-icon">${topic.icon}</div>
      <p>${esc(topic.overview)}</p>
      ${isGeneral ? '' : `
      <h3>${t('topic.keyParts')}</h3>
      <div class="chips">${topic.parts.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div>
      <h3>${t('topic.remember')}</h3>
      <ul class="facts">${topic.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`}
    </section>

    <section class="panel">
      <div class="row">
        <h3>${t('topic.myNotes')}</h3>
        <div class="row-actions">
          <a class="btn small" href="#/note/new?topic=${topic.id}">${t('topic.addNote')}</a>
          <a class="btn ghost small" href="#/image-note/new?topic=${topic.id}">${t('topic.addImageNote')}</a>
        </div>
      </div>
      ${notes.length ? `<div class="list">${notes.map(noteItem).join('')}</div>` : ''}
      ${imageNotes.length ? `<div class="gallery compact" id="topic-gallery">${imageNotes.map(imageNoteItem).join('')}</div>` : ''}
      ${notes.length || imageNotes.length ? '' : `<p class="muted">${t('topic.noNotes')}</p>`}
      ${isGeneral ? '' : `<button class="btn ${learned ? 'ghost' : ''} block" id="done">${t(learned ? 'topic.isDone' : 'topic.markDone')}</button>`}
    </section>`;

  bindGallery($('#topic-gallery'));
  $('#done')?.addEventListener('click', () => {
    const now = store.toggleDone(topic.id);
    toast(t(now ? 'toast.markedDone' : 'toast.unmarked'));
    topicView(id);
  });
}

/* ---------- Notes ---------- */
function noteItem(n) {
  const tp = getTopic(n.topic);
  const match = store.imageNotesWithTitle(n.title).length;
  return `
    <a class="note-item" href="#/note/${n.id}">
      <span class="dot" style="--c:${tp?.color || '#888'}">${tp?.icon || '📝'}</span>
      <span class="grow">
        <strong>${esc(n.title || t('note.untitled'))}${match ? ` <span class="badge">${t('compare.badge')}</span>` : ''}</strong>
        <small>${esc((n.body || '').slice(0, 90))}</small>
      </span>
      <span class="meta"><small>${fmtDate(n.updatedAt)}</small></span>
    </a>`;
}

function notesView() {
  setTitle(t('notes.title'));
  setTab('notes');
  const all = store.getNotes();
  view.innerHTML = `
    <div class="toolbar">
      <input id="search" type="search" placeholder="${t('notes.search')}" aria-label="${t('notes.search')}">
      <select id="filter" aria-label="${t('notes.filter')}">
        <option value="">${t('notes.allTopics')}</option>
        ${topicOptions('')}
      </select>
    </div>
    <div class="list" id="notes"></div>
    <a class="fab" href="#/note/new" aria-label="${t('notes.new')}">＋</a>`;

  const draw = () => {
    const q = $('#search').value.toLowerCase();
    const f = $('#filter').value;
    const list = all.filter((n) => (!f || n.topic === f) && (!q || `${n.title} ${n.body}`.toLowerCase().includes(q)));
    $('#notes').innerHTML = list.length
      ? list.map(noteItem).join('')
      : `<div class="empty"><p>📝</p><p>${t(all.length ? 'notes.noMatch' : 'notes.empty')}</p></div>`;
  };
  $('#search').oninput = draw;
  $('#filter').onchange = draw;
  draw();
}

function noteEditView(id, params) {
  const existing = id === 'new' ? null : store.getNote(id);
  if (id !== 'new' && !existing) return (location.hash = '#/notes');
  const note = existing || { title: '', body: '', topic: params.get('topic') || '' };
  let dirty = false;
  setTitle(t(existing ? 'note.editTitle' : 'note.newTitle'), '#/notes');
  setTab('notes');

  view.innerHTML = `
    <form class="panel editor" id="form">
      <label>${t('note.topic')}
        <select id="topic">
          <option value="">${t('note.choose')}</option>
          ${topicOptions(note.topic)}
        </select>
      </label>
      <label>${t('note.title')}
        <input id="title-in" maxlength="120" placeholder="${t('note.titlePh')}" value="${esc(note.title)}">
      </label>
      <label>${t('note.body')}
        <textarea id="body" rows="12" placeholder="${t('note.bodyPh')}">${esc(note.body)}</textarea>
      </label>
      <button class="btn block" type="submit">${t('note.save')}</button>
      ${existing ? `<p class="muted small">${t('note.lastSaved', { time: new Date(existing.updatedAt).toLocaleString(locale()) })}</p>` : ''}
    </form>
    ${existing?.title ? matchPanel(existing) : ''}
    ${existing ? `<button class="btn danger block" id="delete">${t('note.delete')}</button>` : ''}`;

  $('#form').addEventListener('input', () => { dirty = true; });
  $('#form').onsubmit = (e) => {
    e.preventDefault();
    const data = { ...note, topic: $('#topic').value, title: $('#title-in').value.trim(), body: $('#body').value.trim() };
    if (!data.body && !data.title) { toast(t('toast.writeFirst')); return; }
    store.saveNote(data);
    dirty = false;
    toast(t('toast.saved'));
    // Back to the notes list; replace so Back doesn't reopen the editor.
    location.replace('#/notes');
  };
  $('#delete')?.addEventListener('click', () => {
    if (!confirm(t('note.confirmDelete'))) return;
    store.deleteNote(note.id);
    dirty = false;
    toast(t('toast.deleted'));
    location.hash = '#/notes';
  });
  leaveGuard = () => !dirty || confirm(t('img.unsaved'));
}

// Under a saved note: compare with a same-titled image note, or make one.
function matchPanel(note) {
  const img = store.imageNotesWithTitle(note.title)[0];
  return img
    ? `<section class="panel match"><p>${t('note.matchFound')}</p><a class="btn block" href="#/compare/${note.id}/${img.id}">${t('compare.withImage')}</a></section>`
    : `<section class="panel match"><p class="muted small">${t('note.makeImageHelp')}</p><a class="btn ghost block" href="#/image-note/new?topic=${encodeURIComponent(note.topic || '')}&title=${encodeURIComponent(note.title)}">${t('note.makeImage')}</a></section>`;
}

/* ---------- Image notes ---------- */
function imageNoteItem(n) {
  const tp = getTopic(n.topic);
  const ids = store.imageIdsOf(n);
  return `
    <button class="ai-note" data-id="${esc(n.id)}" style="--c:${tp?.color || '#888'}">
      <span class="thumb">${ids.length
        ? `<img alt="" data-picture="${esc(ids[0])}">`
        : `<span class="thumb-text">${esc((n.caption || n.title).slice(0, 160))}</span>`}</span>
      <span class="ai-note-text">
        <strong>${esc(n.title || t('note.untitled'))}</strong>
        <small>${tp?.icon || ''} ${esc(tp?.name || '')} · ${t('img.count', { n: ids.length })} · ${fmtDate(n.updatedAt || n.at)}</small>
        ${store.notesWithTitle(n.title).length ? `<span class="badge">${t('compare.badge')}</span>` : ''}
      </span>
    </button>`;
}

function bindGallery(gallery) {
  if (!gallery) return;
  gallery.querySelectorAll('[data-picture]').forEach((img) => showPicture(img, img.dataset.picture));
  gallery.querySelectorAll('.ai-note').forEach((b) => (b.onclick = () => {
    const n = store.getImageNote(b.dataset.id);
    if (n) openImageViewer(n);
  }));
}

function imageNotesView() {
  setTitle(t('img.title'));
  setTab('image-notes');
  const all = store.getImageNotes();
  view.innerHTML = `
    <div class="toolbar">
      <input id="img-search" type="search" placeholder="${t('notes.search')}" aria-label="${t('notes.search')}">
      <select id="img-filter" aria-label="${t('notes.filter')}">
        <option value="">${t('notes.allTopics')}</option>
        ${topicOptions('')}
      </select>
    </div>
    <div class="gallery" id="gallery"></div>
    <button class="fab" id="add-img" aria-label="${t('img.new')}">＋</button>`;
  $('#add-img').onclick = () => { location.hash = `#/image-note/new?topic=${$('#img-filter').value}`; };

  const draw = () => {
    const q = $('#img-search').value.toLowerCase();
    const f = $('#img-filter').value;
    const list = all.filter((n) => (!f || n.topic === f) && (!q || `${n.title} ${n.caption}`.toLowerCase().includes(q)));
    const gallery = $('#gallery');
    gallery.innerHTML = list.length
      ? list.map(imageNoteItem).join('')
      : `<div class="empty"><p>🖼️</p><p>${t(all.length ? 'notes.noMatch' : 'img.empty')}</p></div>`;
    bindGallery(gallery);
  };
  $('#img-search').oninput = draw;
  $('#img-filter').onchange = draw;
  draw();
}

// Looking at an image note: its pictures and description, with Edit,
// Download, Share, and Compare.
async function openImageViewer(note) {
  const ids = store.imageIdsOf(note);
  const match = store.notesWithTitle(note.title)[0];
  const dialog = openSheet(
    esc(note.title || t('note.untitled')),
    `${note.caption ? `<p class="caption">${multiline(note.caption)}</p>` : ''}
     ${ids.map((id) => `<img class="user-photo" alt="" data-picture="${esc(id)}">`).join('')}
     ${match ? `<a class="btn ghost block compare-link" href="#/compare/${match.id}/${note.id}">${t('compare.withNote')}</a>` : ''}`,
    `<a class="btn" href="#/image-note/${note.id}">${t('img.edit')}</a>
     ${ids.length ? `<button class="btn ghost" id="iv-download">${t('img.download')}</button>` : ''}
     <button class="btn ghost" id="iv-share" hidden>${t('img.share')}</button>`,
  );
  dialog.querySelectorAll('[data-picture]').forEach((img) => showPicture(img, img.dataset.picture));

  const base = `body-study-${note.topic || 'note'}-${new Date(note.updatedAt || note.at).toISOString().slice(0, 10)}`;
  const files = (await Promise.all(ids.map((id) => images.getImage(id).catch(() => null))))
    .map((blob, i) => blob && new File([blob], `${base}-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' }))
    .filter(Boolean);
  const share = $('#iv-share', dialog);
  if (share && files.length && navigator.canShare?.({ files })) {
    share.hidden = false;
    share.onclick = async () => {
      try { await navigator.share({ files, title: note.title, text: note.caption || undefined }); } catch { /* cancelled */ }
    };
  }
  $('#iv-download', dialog)?.addEventListener('click', () => {
    files.forEach((file, i) => setTimeout(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, i * 300)); // a short gap so the browser allows several downloads
  });
}

// Creating or editing an image note: topic, title, pictures (add, remove,
// reorder; the first is the cover), and a description.
function imageNoteEditView(id, params) {
  const existing = id === 'new' ? null : store.getImageNote(id);
  if (id !== 'new' && !existing) return (location.hash = '#/image-notes');
  setTitle(t(existing ? 'img.editTitle' : 'img.newTitle'), '#/image-notes');
  setTab('image-notes');
  const myNotes = store.getNotes().filter((n) => n.title);
  const note = existing || { title: params.get('title') || '', topic: params.get('topic') || '', caption: '', images: [] };

  // Pictures in their current order: saved ones by id, new ones as blobs.
  const items = store.imageIdsOf(note).map((imageId) => ({ imageId }));
  let dirty = false;

  view.innerHTML = `
    <form class="panel editor" id="img-form">
      <p class="muted small">${t('img.help')}</p>
      ${!existing && myNotes.length ? `
      <label>${t('img.fromNote')}
        <select id="img-from">
          <option value="">${t('img.fromNoteNone')}</option>
          ${myNotes.map((n) => `<option value="${esc(n.id)}">${esc(n.title)}</option>`).join('')}
        </select>
      </label>` : ''}
      <label>${t('note.topic')}
        <select id="img-topic">
          <option value="">${t('note.choose')}</option>
          ${topicOptions(note.topic)}
        </select>
      </label>
      <label>${t('note.title')}
        <input id="img-title" maxlength="120" placeholder="${t('note.titlePh')}" value="${esc(note.title)}">
      </label>
      <div class="photo-field">
        <p class="field-label">${t('img.images')}</p>
        <div class="upload-grid" id="img-grid"></div>
        <label class="btn ghost small photo-pick">${t('img.addImages')}<input id="img-files" type="file" accept="image/*" multiple hidden></label>
      </div>
      <label>${t('img.caption')}
        <textarea id="img-caption" rows="6" placeholder="${t('img.captionPh')}">${esc(note.caption)}</textarea>
      </label>
      <button class="btn block" type="submit" id="img-save">${t('img.save')}</button>
      ${existing ? `<p class="muted small">${t('note.lastSaved', { time: new Date(existing.updatedAt || existing.at).toLocaleString(locale()) })}</p>` : ''}
    </form>
    ${existing ? `<button class="btn danger block" id="img-delete">${t('img.delete')}</button>` : ''}`;

  const form = $('#img-form');
  form.addEventListener('input', () => { dirty = true; });
  const grid = $('#img-grid');
  const urls = new Map(); // item → object URL, so redraws don't reload pictures

  const drawGrid = () => {
    grid.innerHTML = items.map((item, i) => `
      <div class="upload-thumb">
        <img alt="" data-i="${i}">
        ${i === 0 ? `<span class="cover-tag">${t('img.cover')}</span>` : ''}
        <button type="button" class="thumb-remove" data-remove="${i}" aria-label="${t('img.removeImage')}">×</button>
        <span class="thumb-move">
          <button type="button" data-move="${i}" data-dir="-1" aria-label="${t('img.moveLeft')}" ${i === 0 ? 'disabled' : ''}>‹</button>
          <button type="button" data-move="${i}" data-dir="1" aria-label="${t('img.moveRight')}" ${i === items.length - 1 ? 'disabled' : ''}>›</button>
        </span>
      </div>`).join('') || `<p class="muted small">${t('img.noImages')}</p>`;
    grid.querySelectorAll('img[data-i]').forEach(async (img) => {
      const item = items[Number(img.dataset.i)];
      if (!urls.has(item)) {
        const blob = item.blob || await images.getImage(item.imageId).catch(() => null);
        urls.set(item, blob ? URL.createObjectURL(blob) : '');
      }
      if (urls.get(item)) img.src = urls.get(item);
    });
    grid.querySelectorAll('[data-remove]').forEach((b) => (b.onclick = () => {
      items.splice(Number(b.dataset.remove), 1);
      dirty = true;
      drawGrid();
    }));
    grid.querySelectorAll('[data-move]').forEach((b) => (b.onclick = () => {
      const i = Number(b.dataset.move);
      const j = i + Number(b.dataset.dir);
      [items[i], items[j]] = [items[j], items[i]];
      dirty = true;
      drawGrid();
    }));
  };
  drawGrid();

  $('#img-from')?.addEventListener('change', (e) => {
    const n = store.getNote(e.target.value);
    if (!n) return;
    $('#img-title').value = n.title;
    if (n.topic) $('#img-topic').value = n.topic;
  });

  $('#img-files').onchange = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    grid.insertAdjacentHTML('beforeend', `<p class="muted small">${t('img.reading')}</p>`);
    let bad = 0;
    for (const file of files) {
      if (items.length >= MAX_IMAGES) { toast(t('img.tooMany')); break; }
      try {
        const { blob } = await images.prepareImage(file, { keep: true });
        items.push({ blob });
        dirty = true;
      } catch {
        bad++;
      }
    }
    if (bad) toast(t('img.badImages'));
    drawGrid();
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const topic = $('#img-topic').value;
    const title = $('#img-title').value.trim();
    const caption = $('#img-caption').value.trim();
    if (!topic) { toast(t('img.needTopic')); return; }
    if (!title) { toast(t('img.needTitle')); return; }
    if (!items.length && !caption) { toast(t('img.needContent')); return; }
    $('#img-save').disabled = true;
    const ids = [];
    for (const item of items) {
      if (!item.imageId) {
        item.imageId = crypto.randomUUID?.() || `${Date.now()}-${ids.length}`;
        await images.putImage(item.imageId, item.blob);
      }
      ids.push(item.imageId);
    }
    // Pictures taken out of the note are deleted here and on other devices.
    const removed = store.imageIdsOf(note).filter((imageId) => !ids.includes(imageId));
    removed.forEach((imageId) => images.deleteImage(imageId).catch(() => {}));
    store.forgetImages(removed);
    const saved = store.saveImageNote({ ...(existing && { id: existing.id }), topic, title, caption, images: ids });
    dirty = false;
    toast(t('img.saved'));
    location.replace('#/image-notes');
    setTimeout(() => openImageViewer(saved), 50); // after the list has been drawn
  };

  $('#img-delete')?.addEventListener('click', () => {
    if (!confirm(t('img.confirmDelete'))) return;
    store.imageIdsOf(existing).forEach((imageId) => images.deleteImage(imageId).catch(() => {}));
    store.deleteImageNote(existing.id);
    dirty = false;
    toast(t('img.deleted'));
    location.hash = '#/image-notes';
  });

  leaveGuard = () => !dirty || confirm(t('img.unsaved'));
}

/* ---------- Compare a note with an image note ---------- */
function compareView(noteId, imageNoteId) {
  const note = store.getNote(noteId);
  const img = store.getImageNote(imageNoteId);
  setTitle(t('compare.title'), '#/notes');
  setTab('notes');
  if (!note || !img) {
    view.innerHTML = `<div class="empty"><p>⇄</p><p>${t('compare.missing')}</p></div>`;
    return;
  }
  const topic = getTopic(img.topic) || getTopic(note.topic) || generalTopic();
  view.innerHTML = `
    <section class="panel compare-head" style="--c:${topic.color}">
      <p class="eyebrow">${topic.icon} ${esc(topic.name)}</p>
      <h2>${esc(note.title)}</h2>
      <p class="muted small">${t('compare.hint')}</p>
    </section>
    <div class="compare">
      <section class="panel">
        <div class="row"><h3>${t('compare.mine')}</h3></div>
        <div class="compare-text">${note.body ? multiline(note.body) : `<span class="muted">${t('compare.empty')}</span>`}</div>
        <p class="muted small">${fmtDate(note.updatedAt)}</p>
        <a class="btn ghost small" href="#/note/${note.id}">${t('compare.edit')}</a>
      </section>
      <section class="panel">
        <div class="row"><h3>${t('compare.images')}</h3></div>
        ${img.caption ? `<p class="caption">${multiline(img.caption)}</p>` : ''}
        ${store.imageIdsOf(img).map((id) => `<img class="user-photo" alt="" data-picture="${esc(id)}">`).join('')}
        <p class="muted small">${fmtDate(img.updatedAt || img.at)}</p>
        <a class="btn ghost small" href="#/image-note/${img.id}">${t('compare.editImage')}</a>
      </section>
    </div>`;
  view.querySelectorAll('[data-picture]').forEach((el) => showPicture(el, el.dataset.picture));
}

/* ---------- Settings ---------- */
// One line describing the sync state, e.g. "Synced 14:02" or the error.
function syncStateText(st = sync.getStatus()) {
  if (st.state === 'off') return t('sync.state.off');
  if (st.state === 'syncing') return t('sync.state.syncing');
  if (st.state === 'error') {
    const code = st.error?.code || 'other';
    return t('sync.state.error', { msg: t(`sync.err.${code}`, { status: st.error?.status ?? '' }) });
  }
  return st.lastSync
    ? t('sync.state.idle', { time: new Date(st.lastSync).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })
    : t('sync.state.never');
}

function showSyncStatus(st = sync.getStatus()) {
  const dot = $('#sync-dot');
  dot.hidden = st.state === 'off';
  dot.dataset.state = st.state;
  dot.title = syncStateText(st);
  dot.setAttribute('aria-label', dot.title);
  const line = $('#sync-state');
  if (line) {
    line.textContent = syncStateText(st);
    line.dataset.state = st.state;
  }
}

function settingsView() {
  setTitle(t('settings.title'));
  setTab('settings');
  const sc = store.getSyncConfig();
  const lang = getLang();
  view.innerHTML = `
    <section class="panel">
      <h3>${t('settings.language')}</h3>
      <div class="segmented" role="radiogroup" aria-label="${t('settings.language')}">
        ${LANGUAGES.map((l) => `<button type="button" role="radio" aria-checked="${l.id === lang}" data-lang="${l.id}">${l.label}</button>`).join('')}
      </div>
    </section>

    <section class="panel" id="sync-panel">
      <div class="row">
        <h3>${t('sync.title')}</h3>
        <span class="sync-state" id="sync-state"></span>
      </div>
      <p class="muted small">${t('sync.intro')}</p>
      ${sc.token ? `
      <p class="small">${t('sync.connectedTo', { repo: `<b>${esc(sc.repo)}</b>` })}</p>
      <div class="actions">
        <button class="btn" id="sync-now">${t('sync.now')}</button>
        <button class="btn danger" id="sync-off">${t('sync.disconnect')}</button>
      </div>` : `
      <div class="muted small steps">${t('sync.steps')}</div>
      <label>${t('sync.repo')}
        <input id="sync-repo" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="jimmyhsu0922/bodywise-data" value="${esc(sc.repo)}">
      </label>
      <label>${t('sync.token')}
        <input id="sync-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">
      </label>
      <p class="muted small">${t('sync.privacy')}</p>
      <button class="btn block" id="sync-connect">${t('sync.connect')}</button>`}
    </section>

    <section class="panel">
      <h3>${t('settings.backup')}</h3>
      <p class="muted small">${t('settings.backupHelp')}</p>
      <div class="actions">
        <button class="btn ghost" id="export">${t('settings.export')}</button>
        <label class="btn ghost file">${t('settings.import')}<input id="import" type="file" accept="application/json,.json" hidden></label>
      </div>
    </section>

    <section class="panel">
      <h3>${t('settings.install')}</h3>
      <button class="btn block" id="install" hidden>${t('settings.installBtn')}</button>
      <p class="muted small">${t('settings.installHelp')}</p>
    </section>`;

  // Switching language applies right away.
  view.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => {
    if (b.dataset.lang === getLang()) return;
    store.saveSettings({ lang: b.dataset.lang });
    applyLanguage();
    settingsView();
  }));

  $('#sync-connect')?.addEventListener('click', async (e) => {
    const repo = $('#sync-repo').value;
    const token = $('#sync-token').value;
    if (!repo.trim() || !token.trim()) { toast(t('sync.needBoth')); return; }
    e.target.disabled = true;
    try {
      await sync.connect(repo, token);
      toast(t('sync.connected'));
      settingsView();
    } catch (err) {
      toast(t(`sync.err.${err.code || 'other'}`, { status: err.status ?? '' }));
      e.target.disabled = false;
    }
  });
  $('#sync-now')?.addEventListener('click', () => sync.syncNow());
  $('#sync-off')?.addEventListener('click', () => {
    if (!confirm(t('sync.confirmDisconnect'))) return;
    sync.disconnect();
    settingsView();
  });
  showSyncStatus();

  $('#export').onclick = async () => {
    const ids = store.getImageNotes().flatMap(store.imageIdsOf);
    const blob = new Blob([store.exportData(await images.exportImages(ids))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `body-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#import').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { count, images: pictures } = store.importData(await file.text());
      await images.importImages(pictures);
      toast(t('toast.restored', { n: count }));
    } catch (err) {
      toast(t(err.message === 'not-backup' ? 'err.notBackup' : 'toast.badFile'));
    }
    e.target.value = '';
  };
  const installBtn = $('#install');
  if (deferredInstall) {
    installBtn.hidden = false;
    installBtn.onclick = async () => {
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      installBtn.hidden = true;
    };
  }
}

/* ---------- Router ---------- */
// Set by an editor with unsaved changes; returns false to stay on it.
let leaveGuard = null;
let currentHash = location.hash;

function route() {
  if (leaveGuard && !leaveGuard()) {
    history.replaceState(null, '', currentHash); // stay on the editor
    return;
  }
  leaveGuard = null;
  currentHash = location.hash;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === 'topic' && parts[1]) topicView(parts[1]);
  else if (parts[0] === 'notes') notesView();
  else if (parts[0] === 'note' && parts[1]) noteEditView(parts[1], params);
  else if (parts[0] === 'image-notes') imageNotesView();
  else if (parts[0] === 'image-note' && parts[1]) imageNoteEditView(parts[1], params);
  else if (parts[0] === 'compare' && parts[2]) compareView(parts[1], parts[2]);
  else if (parts[0] === 'settings') settingsView();
  else homeView();
  window.scrollTo(0, 0);
}

/* ---------- PWA ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
}

// Links from earlier versions.
if (location.hash.startsWith('#/ai-notes')) history.replaceState(null, '', '#/image-notes');

store.requestPersistence();
applyLanguage();
window.addEventListener('hashchange', route);
route();

// Cloud sync: when another device's changes arrive, refresh the screen unless
// the student is in the middle of writing.
sync.onStatus(showSyncStatus);
showSyncStatus();
sync.init({
  onRemoteChange: () => {
    applyLanguage();
    const busy = leaveGuard || document.querySelector('dialog[open]')
      || (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName));
    if (!busy) route();
    toast(t('sync.updated'));
  },
});
