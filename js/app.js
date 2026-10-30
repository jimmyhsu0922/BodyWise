import { TOPICS, GENERAL, getTopic } from './topics.js';
import * as store from './store.js';
import { MODELS, hasApiKey, askTutor, checkNote, friendlyError } from './ai.js';

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
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
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

function stopRequest() {
  activeRequest?.abort();
  activeRequest = null;
}

/* ---------- Views ---------- */
function homeView() {
  setTitle('Body Study');
  setTab('learn');
  const done = store.getDone();
  const notes = store.getNotes();
  view.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Your progress</p>
        <p class="big">${done.length}<span>/${TOPICS.length} topics learned</span></p>
        <p class="muted">${notes.length} note${notes.length === 1 ? '' : 's'} written</p>
      </div>
      <div class="ring" style="--p:${(done.length / TOPICS.length) * 100}"></div>
    </section>
    ${hasApiKey() ? '' : `<a class="banner" href="#/settings">🔑 Add your Claude API key in Settings to turn on the AI tutor.</a>`}
    <a class="card wide" href="#/topic/general" style="--c:${GENERAL.color}">
      <span class="icon">${GENERAL.icon}</span>
      <span><strong>${GENERAL.name}</strong><small>Chat with your AI tutor about anything</small></span>
    </a>
    <h2 class="section">Body systems</h2>
    <div class="grid">
      ${TOPICS.map((t) => `
        <a class="card" href="#/topic/${t.id}" style="--c:${t.color}">
          <span class="icon">${t.icon}</span>
          <strong>${esc(t.name)}</strong>
          ${done.includes(t.id) ? '<span class="tick" aria-label="Learned">✓</span>' : ''}
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
      <h3>Key parts</h3>
      <div class="chips">${topic.parts.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div>
      <h3>Remember</h3>
      <ul class="facts">${topic.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    </section>`}

    <section class="panel">
      <div class="row">
        <h3>🤖 AI Tutor</h3>
        <button class="link" id="clear-chat">Clear chat</button>
      </div>
      <div class="chat" id="chat"></div>
      <div class="quick">
        ${(isGeneral
          ? ['How do the body systems work together?', 'What is homeostasis?', 'Quiz me on the whole body']
          : ['Explain this simply', 'Give me a real-life example', 'Quiz me', 'What do students often get wrong?'])
          .map((q) => `<button class="pill" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
      </div>
      <form class="composer" id="ask">
        <textarea id="q" rows="1" placeholder="Ask your tutor…" enterkeyhint="send"></textarea>
        <button class="send" id="send" aria-label="Send">➤</button>
      </form>
    </section>

    <section class="panel">
      <div class="row">
        <h3>📝 What I learned</h3>
        <a class="btn small" href="#/note/new?topic=${topic.id}">+ Write note</a>
      </div>
      ${topicNotes.length
        ? `<div class="list">${topicNotes.map(noteItem).join('')}</div>`
        : `<p class="muted">After you understand something, write it in your own words. Writing it down is one of the best ways to remember it.</p>`}
      ${isGeneral ? '' : `<button class="btn ${learned ? 'ghost' : ''} block" id="done">${learned ? '✓ Marked as learned' : 'Mark topic as learned'}</button>`}
    </section>`;

  const chatEl = $('#chat');
  const input = $('#q');
  const sendBtn = $('#send');
  let messages = store.getChat(topic.id);

  const render = (pendingText) => {
    const items = messages.map((m) => bubble(m.role, m.content));
    if (pendingText !== undefined) items.push(bubble('assistant', pendingText || '…', true));
    chatEl.innerHTML = items.join('') || `<p class="muted center">Ask a question, or tap a suggestion below.</p>`;
    chatEl.scrollTop = chatEl.scrollHeight;
  };
  render();

  async function send(text) {
    text = text.trim();
    if (!text) return;
    if (activeRequest) return stopRequest();
    if (!hasApiKey()) {
      toast('Add your API key in Settings first');
      location.hash = '#/settings';
      return;
    }
    input.value = '';
    autoGrow(input);
    messages = [...messages, { role: 'user', content: text }];
    store.saveChat(topic.id, messages);
    render('');
    sendBtn.textContent = '■';
    sendBtn.setAttribute('aria-label', 'Stop');
    const ctrl = new AbortController();
    activeRequest = ctrl;
    let partial = '';
    try {
      const reply = await askTutor({
        topic,
        notes: topicNotes,
        history: apiHistory(messages),
        signal: ctrl.signal,
        onText: (t) => { partial = t; if (activeRequest === ctrl) render(t); },
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
        sendBtn.setAttribute('aria-label', 'Send');
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
    if (!messages.length || !confirm('Clear this conversation?')) return;
    stopRequest();
    messages = [];
    store.saveChat(topic.id, messages);
    render();
  };
  $('#done')?.addEventListener('click', () => {
    const now = store.toggleDone(topic.id);
    toast(now ? 'Nice work! Topic marked as learned 🎉' : 'Unmarked');
    topicView(id);
  });
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
  const t = getTopic(n.topic);
  return `
    <a class="note-item" href="#/note/${n.id}">
      <span class="dot" style="--c:${t?.color || '#888'}">${t?.icon || '📝'}</span>
      <span class="grow">
        <strong>${esc(n.title || 'Untitled note')}</strong>
        <small>${esc((n.body || '').slice(0, 90))}</small>
      </span>
      <span class="meta">${n.score ? `<b>${esc(n.score)}</b>` : ''}<small>${fmtDate(n.updatedAt)}</small></span>
    </a>`;
}

function notesView() {
  setTitle('My Notes');
  setTab('notes');
  const all = store.getNotes();
  view.innerHTML = `
    <div class="toolbar">
      <input id="search" type="search" placeholder="Search notes…" aria-label="Search notes">
      <select id="filter" aria-label="Filter by topic">
        <option value="">All topics</option>
        ${[GENERAL, ...TOPICS].map((t) => `<option value="${t.id}">${t.icon} ${esc(t.name)}</option>`).join('')}
      </select>
    </div>
    <div class="list" id="notes"></div>
    <a class="fab" href="#/note/new" aria-label="New note">＋</a>`;

  const draw = () => {
    const q = $('#search').value.toLowerCase();
    const f = $('#filter').value;
    const list = all.filter((n) => (!f || n.topic === f) && (!q || `${n.title} ${n.body}`.toLowerCase().includes(q)));
    $('#notes').innerHTML = list.length
      ? list.map(noteItem).join('')
      : `<div class="empty"><p>📝</p><p>${all.length ? 'No notes match.' : 'No notes yet. When you understand something, write it down here in your own words.'}</p></div>`;
  };
  $('#search').oninput = draw;
  $('#filter').onchange = draw;
  draw();
}

function noteEditView(id, params) {
  const existing = id === 'new' ? null : store.getNote(id);
  if (id !== 'new' && !existing) return (location.hash = '#/notes');
  let note = existing || { title: '', body: '', topic: params.get('topic') || '' };
  setTitle(existing ? 'Edit Note' : 'New Note', '#/notes');
  setTab('notes');

  view.innerHTML = `
    <form class="panel editor" id="form">
      <label>Topic
        <select id="topic">
          <option value="">— choose —</option>
          ${[GENERAL, ...TOPICS].map((t) => `<option value="${t.id}" ${t.id === note.topic ? 'selected' : ''}>${t.icon} ${esc(t.name)}</option>`).join('')}
        </select>
      </label>
      <label>Title
        <input id="title-in" maxlength="120" placeholder="e.g. How the heart pumps blood" value="${esc(note.title)}">
      </label>
      <label>What I know (in my own words)
        <textarea id="body" rows="10" placeholder="Write what you understand without looking at the material. It's okay to be unsure — the AI can check it for you.">${esc(note.body)}</textarea>
      </label>
      <div class="actions">
        <button class="btn" type="submit">💾 Save</button>
        <button class="btn ghost" type="button" id="check">🤖 Check my understanding</button>
      </div>
      ${existing ? `<p class="muted small">Last saved ${new Date(existing.updatedAt).toLocaleString()}</p>` : ''}
    </form>
    <section class="panel ${note.feedback ? '' : 'hidden'}" id="fb-panel">
      <h3>AI feedback</h3>
      <div class="feedback" id="feedback">${note.feedback ? md(note.feedback) : ''}</div>
    </section>
    ${existing ? '<button class="btn danger block" id="delete">Delete note</button>' : ''}`;

  const read = () => ({
    ...note,
    topic: $('#topic').value,
    title: $('#title-in').value.trim(),
    body: $('#body').value.trim(),
  });

  const persist = () => {
    const data = read();
    if (!data.body && !data.title) { toast('Write something first'); return null; }
    note = store.saveNote(data);
    if (id === 'new') { history.replaceState(null, '', `#/note/${note.id}`); id = note.id; }
    return note;
  };

  $('#form').onsubmit = (e) => {
    e.preventDefault();
    if (persist()) toast('Saved ✓');
  };

  $('#check').onclick = async () => {
    if (activeRequest) return stopRequest();
    if (!hasApiKey()) { toast('Add your API key in Settings first'); location.hash = '#/settings'; return; }
    if (read().body.length < 15) { toast('Write a bit more first'); return; }
    if (!persist()) return;
    const btn = $('#check');
    const panel = $('#fb-panel');
    const fb = $('#feedback');
    panel.classList.remove('hidden');
    fb.innerHTML = '<p class="muted">Reading your note…</p>';
    btn.textContent = '■ Stop';
    const ctrl = new AbortController();
    activeRequest = ctrl;
    try {
      const text = await checkNote({
        topic: getTopic(note.topic),
        note,
        signal: ctrl.signal,
        onText: (t) => { if (fb.isConnected) fb.innerHTML = md(t); },
      });
      const score = text.match(/Score:\**\s*(\d+(?:\.\d+)?\s*\/\s*10)/i)?.[1]?.replace(/\s/g, '');
      note = store.saveNote({ ...note, feedback: text, score: score || note.score });
      toast('Feedback saved with your note');
    } catch (err) {
      if (fb.isConnected) fb.innerHTML = `<p class="error">${esc(friendlyError(err))}</p>`;
    } finally {
      if (activeRequest === ctrl) activeRequest = null;
      if (btn.isConnected) btn.textContent = '🤖 Check my understanding';
    }
  };

  $('#delete')?.addEventListener('click', () => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    store.deleteNote(note.id);
    toast('Note deleted');
    location.hash = '#/notes';
  });
}

function settingsView() {
  setTitle('Settings');
  setTab('settings');
  const s = store.getSettings();
  view.innerHTML = `
    <section class="panel">
      <h3>🤖 AI tutor</h3>
      <label>Claude API key
        <input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(s.apiKey)}">
      </label>
      <p class="muted small">Get a key at <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener">platform.claude.com</a>. It is saved only on this device and sent only to Anthropic. Usage is billed to your Anthropic account.</p>
      <label>Model
        <select id="model">${MODELS.map((m) => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
      </label>
      <button class="btn block" id="save">Save</button>
    </section>

    <section class="panel">
      <h3>💾 Backup</h3>
      <p class="muted small">Your notes are stored on this phone. Download a backup now and then, or to move notes to another device.</p>
      <div class="actions">
        <button class="btn ghost" id="export">Download backup</button>
        <label class="btn ghost file">Restore backup<input id="import" type="file" accept="application/json,.json" hidden></label>
      </div>
    </section>

    <section class="panel">
      <h3>📱 Install on your phone</h3>
      <button class="btn block" id="install" hidden>Install app</button>
      <p class="muted small"><b>Android (Chrome):</b> menu ⋮ → <i>Add to Home screen / Install app</i>.<br>
      <b>iPhone (Safari):</b> Share button → <i>Add to Home Screen</i>.</p>
    </section>`;

  $('#save').onclick = () => {
    store.saveSettings({ apiKey: $('#key').value.trim(), model: $('#model').value });
    toast('Settings saved ✓');
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
      toast(`Restored ${n} notes ✓`);
    } catch (err) {
      toast(err.message || 'Could not read that file');
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
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === 'topic' && parts[1]) topicView(parts[1]);
  else if (parts[0] === 'notes') notesView();
  else if (parts[0] === 'note' && parts[1]) noteEditView(parts[1], params);
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
window.addEventListener('hashchange', route);
route();
