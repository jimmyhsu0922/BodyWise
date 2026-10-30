import { topics, generalTopic, getTopic } from './topics.js';
import * as store from './store.js';
import { PROVIDERS, claudeModels, geminiModels, hasApiKey, listGeminiModels, askTutor, checkNote, summarizeChat, friendlyError } from './ai.js';
import { LANGUAGES, t, getLang, locale } from './i18n.js';
import { drawCard } from './card.js';
import { STYLE_IDS, LENGTH_IDS, styleInfo, lengthInfo, tutorSettings } from './tutor.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
let activeRequest = null; // AbortController for the AI reply in progress

/* ---------- Helpers ---------- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Small, safe Markdown subset for AI replies: headings, lists, bold, italics, code.
function md(text) {
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of String(text).split('\n')) {
    let m;
    if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^#{1,4}\s+(.*)/))) {
      closeList(); out.push(`<h4>${inline(m[1])}</h4>`);
    } else if (line.trim()) {
      closeList(); out.push(`<p>${inline(line)}</p>`);
    } else {
      closeList();
    }
  }
  closeList();
  return out.join('');
}

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

function stopRequest() {
  activeRequest?.abort();
  activeRequest = null;
}

function topicOptions(selected) {
  return [generalTopic(), ...topics()]
    .map((tp) => `<option value="${tp.id}" ${tp.id === selected ? 'selected' : ''}>${tp.icon} ${esc(tp.name)}</option>`)
    .join('');
}

/* ---------- Views ---------- */
function homeView() {
  setTitle('Body Study');
  setTab('learn');
  const all = topics();
  const general = generalTopic();
  const done = store.getDone();
  const notes = store.getNotes();
  view.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">${t('home.progress')}</p>
        <p class="big">${done.length}<span>${t('home.topicsLearned', { total: all.length })}</span></p>
        <p class="muted">${t('home.notesWritten', { n: notes.length })}</p>
      </div>
      <div class="ring" style="--p:${(done.length / all.length) * 100}"></div>
    </section>
    ${hasApiKey() ? '' : `<a class="banner" href="#/settings">${t('home.keyBanner')}</a>`}
    <a class="card wide" href="#/topic/general" style="--c:${general.color}">
      <span class="icon">${general.icon}</span>
      <span><strong>${esc(general.name)}</strong><small>${t('home.askSub')}</small></span>
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

function topicView(id) {
  const topic = getTopic(id);
  if (!topic) return (location.hash = '#/');
  setTitle(topic.name, '#/');
  setTab('learn');
  const isGeneral = topic.id === 'general';
  const topicNotes = store.getNotes().filter((n) => n.topic === topic.id);
  const learned = store.getDone().includes(topic.id);

  view.innerHTML = `
    ${isGeneral ? '' : `
    <section class="panel topic-head" style="--c:${topic.color}">
      <div class="topic-icon">${topic.icon}</div>
      <p>${esc(topic.overview)}</p>
      <h3>${t('topic.keyParts')}</h3>
      <div class="chips">${topic.parts.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div>
      <h3>${t('topic.remember')}</h3>
      <ul class="facts">${topic.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    </section>`}

    <section class="panel">
      <div class="row">
        <button class="tutor-head" id="tutor-settings" aria-label="${t('tutor.open')}">
          <h3>${t('topic.tutor')} <span class="gear">⚙️</span></h3>
          <small id="tutor-summary">${esc(tutorSummary())}</small>
        </button>
        <button class="link" id="clear-chat">${t('topic.clearChat')}</button>
      </div>
      <div class="chat" id="chat"></div>
      <div class="quick">
        ${t(isGeneral ? 'topic.quickGeneral' : 'topic.quick')
          .map((q) => `<button class="pill" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
      </div>
      <form class="composer" id="ask">
        <textarea id="q" rows="1" placeholder="${t('topic.ask')}" enterkeyhint="send"></textarea>
        <button class="send" id="send" aria-label="${t('topic.send')}">➤</button>
      </form>
      <button class="btn ghost block summary-btn" id="summary">${t('summary.button')}</button>
      <p class="muted small center">${t('summary.hint')}</p>
    </section>

    <section class="panel">
      <div class="row">
        <h3>${t('topic.whatILearned')}</h3>
        <a class="btn small" href="#/note/new?topic=${topic.id}">${t('topic.writeNote')}</a>
      </div>
      ${topicNotes.length
        ? `<div class="list">${topicNotes.map(noteItem).join('')}</div>`
        : `<p class="muted">${t('topic.noNotes')}</p>`}
      ${isGeneral ? '' : `<button class="btn ${learned ? 'ghost' : ''} block" id="done">${t(learned ? 'topic.isDone' : 'topic.markDone')}</button>`}
    </section>`;

  const chatEl = $('#chat');
  const input = $('#q');
  const sendBtn = $('#send');
  let messages = store.getChat(topic.id);

  const render = (pendingText) => {
    const items = messages.map((m) => bubble(m.role, m.content));
    if (pendingText !== undefined) items.push(bubble('assistant', pendingText || '…', true));
    chatEl.innerHTML = items.join('') || `<p class="muted center">${t('topic.chatEmpty')}</p>`;
    chatEl.scrollTop = chatEl.scrollHeight;
  };
  render();

  async function send(text) {
    text = text.trim();
    if (!text) return;
    if (activeRequest) return stopRequest();
    if (!hasApiKey()) {
      toast(t('toast.needKey'));
      location.hash = '#/settings';
      return;
    }
    input.value = '';
    autoGrow(input);
    messages = [...messages, { role: 'user', content: text }];
    store.saveChat(topic.id, messages);
    render('');
    sendBtn.textContent = '■';
    sendBtn.setAttribute('aria-label', t('topic.stop'));
    const ctrl = new AbortController();
    activeRequest = ctrl;
    let partial = '';
    try {
      const reply = await askTutor({
        topic,
        notes: topicNotes,
        history: apiHistory(messages),
        signal: ctrl.signal,
        onText: (txt) => { partial = txt; if (activeRequest === ctrl) render(txt); },
      });
      messages = [...messages, { role: 'assistant', content: reply }];
    } catch (err) {
      // Show the error in the chat, but keep it out of what is sent to the AI.
      const note = `*${friendlyError(err)}*`;
      messages = [...messages, partial
        ? { role: 'assistant', content: `${partial}\n\n${note}` }
        : { role: 'assistant', content: note, error: true }];
    } finally {
      if (activeRequest === ctrl) activeRequest = null;
      store.saveChat(topic.id, messages);
      if (chatEl.isConnected) {
        render();
        sendBtn.textContent = '➤';
        sendBtn.setAttribute('aria-label', t('topic.send'));
      }
    }
  }

  $('#ask').onsubmit = (e) => {
    e.preventDefault();
    if (activeRequest) stopRequest();
    else send(input.value);
  };
  input.addEventListener('input', () => autoGrow(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      send(input.value);
    }
  });
  view.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => send(b.dataset.q)));
  $('#clear-chat').onclick = () => {
    if (!messages.length || !confirm(t('topic.confirmClear'))) return;
    stopRequest();
    messages = [];
    store.saveChat(topic.id, messages);
    render();
  };
  $('#tutor-settings').onclick = () => openTutorSettings(() => { $('#tutor-summary').textContent = tutorSummary(); });
  $('#summary').onclick = () => {
    if (activeRequest) return;
    if (!messages.some((m) => m.role === 'user' && !m.error)) { toast(t('summary.needChat')); return; }
    openImageDialog({ topic, history: apiHistory(messages) });
  };
  $('#done')?.addEventListener('click', () => {
    const now = store.toggleDone(topic.id);
    toast(t(now ? 'toast.markedDone' : 'toast.unmarked'));
    topicView(id);
  });
}

/* ---------- AI tutor settings ---------- */
function tutorSummary() {
  const { style, length } = tutorSettings();
  const name = style === 'custom' ? t('tutor.custom') : styleInfo(style).name;
  return `${name} · ${lengthInfo(length).name}`;
}

// Type, answer length, and the prompt (preset or the student's own).
function openTutorSettings(onSaved) {
  const current = tutorSettings();
  let style = current.style;
  let length = current.length;
  let custom = current.custom;

  const dialog = document.createElement('dialog');
  dialog.className = 'sheet';
  dialog.innerHTML = `
    <div class="sheet-head">
      <h3>${t('tutor.title')}</h3>
      <button class="link" id="ts-close">${t('summary.close')}</button>
    </div>
    <div class="sheet-body tutor-settings">
      <p class="muted small">${t('tutor.appliesAll')}</p>
      <h4>${t('tutor.length')}</h4>
      <div class="segmented" role="radiogroup" aria-label="${t('tutor.length')}">
        ${LENGTH_IDS.map((id) => `<button type="button" role="radio" data-length="${id}">${lengthInfo(id).name}</button>`).join('')}
      </div>
      <h4>${t('tutor.type')}</h4>
      <div class="type-list" role="radiogroup" aria-label="${t('tutor.type')}">
        ${[...STYLE_IDS, 'custom'].map((id) => {
          const info = id === 'custom' ? { name: t('tutor.custom'), desc: t('tutor.customDesc') } : styleInfo(id);
          return `<button type="button" role="radio" class="type-option" data-style="${id}"><strong>${esc(info.name)}</strong><small>${esc(info.desc)}</small></button>`;
        }).join('')}
      </div>
      <h4>${t('tutor.prompt')}</h4>
      <textarea id="ts-prompt" rows="8" placeholder="${t('tutor.promptPh')}"></textarea>
      <button class="link" id="ts-template" type="button">${t('tutor.useAsTemplate')}</button>
      <p class="muted small">${t('tutor.fixed')}</p>
    </div>
    <div class="actions">
      <button class="btn ghost" id="ts-reset">${t('tutor.reset')}</button>
      <button class="btn" id="ts-save">${t('tutor.save')}</button>
    </div>`;
  document.body.append(dialog);
  const promptEl = $('#ts-prompt', dialog);

  const render = () => {
    dialog.querySelectorAll('[data-length]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.length === length)));
    dialog.querySelectorAll('[data-style]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.style === style)));
    const isCustom = style === 'custom';
    promptEl.readOnly = !isCustom;
    promptEl.classList.toggle('readonly', !isCustom);
    promptEl.value = isCustom ? custom : styleInfo(style).prompt;
    $('#ts-template', dialog).hidden = isCustom;
  };

  promptEl.addEventListener('input', () => { if (style === 'custom') custom = promptEl.value; });
  dialog.querySelectorAll('[data-length]').forEach((b) => (b.onclick = () => { length = b.dataset.length; render(); }));
  dialog.querySelectorAll('[data-style]').forEach((b) => (b.onclick = () => {
    // Choosing Custom with nothing written yet starts from the type shown before.
    if (b.dataset.style === 'custom' && !custom.trim() && style !== 'custom') custom = styleInfo(style).prompt;
    style = b.dataset.style;
    render();
  }));
  $('#ts-template', dialog).onclick = () => {
    custom = styleInfo(style).prompt;
    style = 'custom';
    render();
    promptEl.focus();
  };
  $('#ts-reset', dialog).onclick = () => { style = 'default'; length = 'medium'; render(); };
  $('#ts-save', dialog).onclick = () => {
    if (style === 'custom' && !custom.trim()) { toast(t('tutor.needCustom')); promptEl.focus(); return; }
    store.saveSettings({ tutorStyle: style, tutorLength: length, tutorCustom: custom });
    dialog.close();
    toast(t('tutor.saved'));
    onSaved?.();
  };
  $('#ts-close', dialog).onclick = () => dialog.close();
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => dialog.remove());

  render();
  dialog.showModal();
}

/* ---------- AI notes (summary images) ---------- */
function cardCanvas(note, topic) {
  return drawCard(note.card, {
    color: topic.color,
    icon: topic.icon,
    topicName: topic.name,
    takeawayLabel: t('summary.takeaway'),
    footer: t('summary.footer'),
    date: new Date(note.at).toLocaleDateString(locale()),
  });
}

const canvasBlob = (canvas) => new Promise((r) => canvas.toBlob(r, 'image/png'));

// The image window. With `history` it belongs to a chat: it shows the newest
// image if the chat hasn't changed since, or asks the AI for a new one.
// With `note` it shows a saved AI note from the gallery.
function openImageDialog({ topic, history, note: givenNote }) {
  const fromChat = Boolean(history);
  let note = fromChat ? store.latestAiNote(topic.id) : givenNote;

  const dialog = document.createElement('dialog');
  dialog.className = 'sheet';
  dialog.innerHTML = `
    <div class="sheet-head">
      <h3>${t('summary.title')}</h3>
      <button class="link" id="sum-close">${t('summary.close')}</button>
    </div>
    <div class="sheet-body" id="sum-body"></div>
    <div class="actions" id="sum-actions" hidden>
      <button class="btn" id="sum-download">${t('summary.download')}</button>
      <button class="btn ghost" id="sum-share" hidden>${t('summary.share')}</button>
      ${fromChat
        ? `<button class="btn ghost" id="sum-redo">${t('summary.redo')}</button>`
        : `<button class="btn danger" id="sum-delete">${t('summary.delete')}</button>`}
    </div>`;
  document.body.append(dialog);
  const body = $('#sum-body', dialog);
  const actions = $('#sum-actions', dialog);
  let ctrl = null;
  let blob = null;
  const fileName = () => `body-study-${topic.id}-${new Date(note?.at || Date.now()).toISOString().slice(0, 10)}.png`;

  const close = () => { ctrl?.abort(); dialog.close(); };
  dialog.addEventListener('close', () => dialog.remove());
  $('#sum-close', dialog).onclick = close;
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

  const show = async (message = '') => {
    blob = await canvasBlob(cardCanvas(note, topic));
    body.innerHTML = `${message ? `<p class="muted small">${message}</p>` : ''}<img class="summary-img" alt="${esc(t('summary.alt', { topic: topic.name }))}" src="${URL.createObjectURL(blob)}">`;
    actions.hidden = false;
    $('#sum-download', dialog).hidden = false;
    const file = new File([blob], fileName(), { type: 'image/png' });
    $('#sum-share', dialog).hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  };

  const generate = async () => {
    if (!hasApiKey()) { close(); toast(t('toast.needKey')); location.hash = '#/settings'; return; }
    actions.hidden = true;
    body.innerHTML = `<div class="loading"><span class="spinner"></span><p class="muted">${t('summary.making')}</p></div>`;
    ctrl = new AbortController();
    try {
      const card = await summarizeChat({ topic, history, signal: ctrl.signal });
      note = store.addAiNote({ topic: topic.id, card, at: Date.now(), chatLength: history.length, lang: getLang() });
      await show(t('summary.saved'));
    } catch (err) {
      if (!dialog.open) return;
      body.innerHTML = `<p class="error">${esc(friendlyError(err))}</p>`;
      actions.hidden = false;
      $('#sum-download', dialog).hidden = true;
      $('#sum-share', dialog).hidden = true;
    } finally {
      ctrl = null;
    }
  };

  $('#sum-download', dialog).onclick = () => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#sum-share', dialog).onclick = async () => {
    try {
      await navigator.share({ files: [new File([blob], fileName(), { type: 'image/png' })], title: note.card.title });
    } catch { /* cancelled */ }
  };
  $('#sum-redo', dialog)?.addEventListener('click', generate);
  $('#sum-delete', dialog)?.addEventListener('click', () => {
    if (!confirm(t('summary.confirmDelete'))) return;
    store.deleteAiNote(note.id);
    close();
    toast(t('summary.deleted'));
    if (location.hash.startsWith('#/ai-notes')) aiNotesView();
  });

  dialog.showModal();
  if (!fromChat) show();
  else if (note && note.lang === getLang() && note.chatLength === history.length) show();
  else if (note && note.lang === getLang()) show(t('summary.outdated'));
  else generate();
}

function aiNotesView() {
  setTitle(t('aiNotes.title'));
  setTab('ai-notes');
  const all = store.getAiNotes();
  view.innerHTML = `
    <div class="toolbar">
      <select id="ai-filter" aria-label="${t('notes.filter')}">
        <option value="">${t('notes.allTopics')}</option>
        ${topicOptions('')}
      </select>
    </div>
    <div class="gallery" id="gallery"></div>`;

  const draw = () => {
    const f = $('#ai-filter').value;
    const list = all.filter((n) => !f || n.topic === f);
    const gallery = $('#gallery');
    if (!list.length) {
      gallery.innerHTML = `<div class="empty"><p>🖼️</p><p>${t(all.length ? 'notes.noMatch' : 'aiNotes.empty')}</p></div>`;
      return;
    }
    gallery.innerHTML = list.map((n) => {
      const tp = getTopic(n.topic);
      return `
        <button class="ai-note" data-id="${esc(n.id)}" style="--c:${tp?.color || '#888'}">
          <span class="thumb"><img alt="" data-thumb="${esc(n.id)}"></span>
          <span class="ai-note-text">
            <strong>${esc(n.card.title)}</strong>
            <small>${tp?.icon || ''} ${esc(tp?.name || '')} · ${t('aiNotes.count', { n: n.card.points.length })} · ${fmtDate(n.at)}</small>
          </span>
        </button>`;
    }).join('');
    // Draw thumbnails after the list is on screen.
    list.forEach(async (n) => {
      const tp = getTopic(n.topic);
      const img = gallery.querySelector(`[data-thumb="${CSS.escape(n.id)}"]`);
      if (!tp || !img) return;
      img.src = URL.createObjectURL(await canvasBlob(cardCanvas(n, tp)));
    });
    gallery.querySelectorAll('.ai-note').forEach((b) => (b.onclick = () => {
      const n = store.getAiNote(b.dataset.id);
      const tp = n && getTopic(n.topic);
      if (tp) openImageDialog({ topic: tp, note: n });
    }));
  };
  $('#ai-filter').onchange = draw;
  draw();
}

// The last turns of the chat, minus failed questions, in user/assistant order.
function apiHistory(messages) {
  const out = [];
  for (const m of messages) {
    if (m.error) { if (out.at(-1)?.role === 'user') out.pop(); continue; }
    if (out.at(-1)?.role === m.role) out.pop(); // e.g. a question asked again after a failure
    out.push({ role: m.role, content: m.content });
  }
  const recent = out.slice(-30);
  return recent[0]?.role === 'assistant' ? recent.slice(1) : recent;
}

function bubble(role, content, pending = false) {
  return `<div class="msg ${role}${pending ? ' pending' : ''}">${role === 'user' ? esc(content).replace(/\n/g, '<br>') : md(content)}</div>`;
}

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

function noteItem(n) {
  const tp = getTopic(n.topic);
  return `
    <a class="note-item" href="#/note/${n.id}">
      <span class="dot" style="--c:${tp?.color || '#888'}">${tp?.icon || '📝'}</span>
      <span class="grow">
        <strong>${esc(n.title || t('note.untitled'))}</strong>
        <small>${esc((n.body || '').slice(0, 90))}</small>
      </span>
      <span class="meta">${n.score ? `<b>${esc(n.score)}</b>` : ''}<small>${fmtDate(n.updatedAt)}</small></span>
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
  let note = existing || { title: '', body: '', topic: params.get('topic') || '' };
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
        <textarea id="body" rows="10" placeholder="${t('note.bodyPh')}">${esc(note.body)}</textarea>
      </label>
      <div class="actions">
        <button class="btn" type="submit">${t('note.save')}</button>
        <button class="btn ghost" type="button" id="check">${t('note.check')}</button>
      </div>
      ${existing ? `<p class="muted small">${t('note.lastSaved', { time: new Date(existing.updatedAt).toLocaleString(locale()) })}</p>` : ''}
    </form>
    <section class="panel ${note.feedback ? '' : 'hidden'}" id="fb-panel">
      <h3>${t('note.feedback')}</h3>
      <div class="feedback" id="feedback">${note.feedback ? md(note.feedback) : ''}</div>
    </section>
    ${existing ? `<button class="btn danger block" id="delete">${t('note.delete')}</button>` : ''}`;

  const read = () => ({
    ...note,
    topic: $('#topic').value,
    title: $('#title-in').value.trim(),
    body: $('#body').value.trim(),
  });

  const persist = () => {
    const data = read();
    if (!data.body && !data.title) { toast(t('toast.writeFirst')); return null; }
    note = store.saveNote(data);
    if (id === 'new') { history.replaceState(null, '', `#/note/${note.id}`); id = note.id; }
    return note;
  };

  $('#form').onsubmit = (e) => {
    e.preventDefault();
    if (!persist()) return;
    toast(t('toast.saved'));
    // Back to the notes list; replace so Back doesn't reopen the editor.
    location.replace('#/notes');
  };

  $('#check').onclick = async () => {
    if (activeRequest) return stopRequest();
    if (!hasApiKey()) { toast(t('toast.needKey')); location.hash = '#/settings'; return; }
    if (read().body.length < 15) { toast(t('toast.writeMore')); return; }
    if (!persist()) return;
    const btn = $('#check');
    const panel = $('#fb-panel');
    const fb = $('#feedback');
    panel.classList.remove('hidden');
    fb.innerHTML = `<p class="muted">${t('note.reading')}</p>`;
    btn.textContent = t('note.stop');
    const ctrl = new AbortController();
    activeRequest = ctrl;
    try {
      const text = await checkNote({
        topic: getTopic(note.topic),
        note,
        signal: ctrl.signal,
        onText: (txt) => { if (fb.isConnected) fb.innerHTML = md(txt); },
      });
      const score = text.match(/(?:Score|分數)\s*[:：]\**\s*(\d+(?:\.\d+)?\s*\/\s*10)/i)?.[1]?.replace(/\s/g, '');
      note = store.saveNote({ ...note, feedback: text, score: score || note.score });
      toast(t('toast.feedbackSaved'));
    } catch (err) {
      if (fb.isConnected) fb.innerHTML = `<p class="error">${esc(friendlyError(err))}</p>`;
    } finally {
      if (activeRequest === ctrl) activeRequest = null;
      if (btn.isConnected) btn.textContent = t('note.check');
    }
  };

  $('#delete')?.addEventListener('click', () => {
    if (!confirm(t('note.confirmDelete'))) return;
    store.deleteNote(note.id);
    toast(t('toast.deleted'));
    location.hash = '#/notes';
  });
}

function settingsView() {
  setTitle(t('settings.title'));
  setTab('settings');
  const s = store.getSettings();
  const lang = getLang();
  view.innerHTML = `
    <section class="panel">
      <h3>${t('settings.language')}</h3>
      <div class="segmented" role="radiogroup" aria-label="${t('settings.language')}">
        ${LANGUAGES.map((l) => `<button type="button" role="radio" aria-checked="${l.id === lang}" data-lang="${l.id}">${l.label}</button>`).join('')}
      </div>
    </section>

    <section class="panel">
      <h3>${t('settings.aiTutor')}</h3>
      <label>${t('settings.provider')}
        <select id="provider">${PROVIDERS.map((p) => `<option value="${p.id}" ${p.id === s.provider ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
      </label>

      <div id="claude-fields">
        <label>${t('settings.claudeKey')}
          <input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(s.apiKey)}">
        </label>
        <p class="muted small">${t('settings.claudeHelp')}</p>
        <label>${t('settings.model')}
          <select id="model">${claudeModels().map((m) => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
        </label>
      </div>

      <div id="gemini-fields">
        <label>${t('settings.geminiKey')}
          <input id="gkey" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…" value="${esc(s.geminiKey)}">
        </label>
        <p class="muted small">${t('settings.geminiHelp')}</p>
        <label>${t('settings.model')}
          <select id="gmodel"></select>
        </label>
        <button class="link" id="load-models" type="button">${t('settings.loadModels')}</button>
      </div>

      <p class="muted small">${t('settings.keysLocal')}</p>
      <button class="btn block" id="save">${t('settings.save')}</button>
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

  const providerSel = $('#provider');
  const showProvider = () => {
    $('#claude-fields').hidden = providerSel.value !== 'claude';
    $('#gemini-fields').hidden = providerSel.value !== 'gemini';
  };
  providerSel.onchange = showProvider;
  showProvider();

  const fillGeminiModels = (models) => {
    if (!models.some((m) => m.id === s.geminiModel)) models = [{ id: s.geminiModel, label: s.geminiModel }, ...models];
    $('#gmodel').innerHTML = models.map((m) => `<option value="${esc(m.id)}" ${m.id === s.geminiModel ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
  };
  fillGeminiModels(geminiModels());
  $('#load-models').onclick = async () => {
    const key = $('#gkey').value.trim();
    if (!key) { toast(t('toast.enterGeminiKey')); return; }
    try {
      const models = await listGeminiModels(key);
      s.geminiModel = $('#gmodel').value;
      fillGeminiModels([...geminiModels(), ...models]);
      toast(t('toast.loadedModels', { n: models.length }));
    } catch (err) {
      toast(friendlyError(err));
    }
  };

  $('#save').onclick = () => {
    store.saveSettings({
      provider: providerSel.value,
      apiKey: $('#key').value.trim(),
      model: $('#model').value,
      geminiKey: $('#gkey').value.trim(),
      geminiModel: $('#gmodel').value,
    });
    toast(t('toast.settingsSaved'));
  };
  $('#export').onclick = () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
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
      const n = store.importData(await file.text());
      toast(t('toast.restored', { n }));
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
function route() {
  stopRequest();
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === 'topic' && parts[1]) topicView(parts[1]);
  else if (parts[0] === 'notes') notesView();
  else if (parts[0] === 'note' && parts[1]) noteEditView(parts[1], params);
  else if (parts[0] === 'ai-notes') aiNotesView();
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

store.requestPersistence();
applyLanguage();
window.addEventListener('hashchange', route);
route();
