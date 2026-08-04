import {
  login,
  logout,
  verifySession,
  getSession,
} from './auth.js';
import {
  loadWorkspace,
  saveWorkspace,
  exportJSON,
  importJSONFile,
  buildShareURL,
  readShareHash,
  clearShareHash,
  createDocument,
  uid,
} from './storage.js';

const BLOCK_TYPES = [
  { type: 'paragraph', label: 'Text' },
  { type: 'heading1', label: 'H1' },
  { type: 'heading2', label: 'H2' },
  { type: 'heading3', label: 'H3' },
  { type: 'bullet', label: '• List' },
  { type: 'numbered', label: '1. List' },
  { type: 'divider', label: 'Divider' },
  { type: 'callout', label: 'Callout' },
  { type: 'transcript', label: 'Transcript' },
];

const MODE_LABELS = {
  page: 'Page',
  transcript: 'Transcription',
  report: 'Report',
  mood: 'Mood board',
};

const MODE_ICONS = {
  page: '◇',
  transcript: '☰',
  report: '▣',
  mood: '▦',
};

let workspace = loadWorkspace();
let session = null;
let dragMoodId = null;
let dragBlockId = null;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2800);
}

function persist() {
  saveWorkspace(workspace);
}

function activeDoc() {
  return workspace.documents.find((d) => d.id === workspace.activeId) || null;
}

function ensureActive() {
  if (!workspace.activeId && workspace.documents.length) {
    workspace.activeId = workspace.documents[0].id;
  }
  if (workspace.activeId && !activeDoc()) {
    workspace.activeId = workspace.documents[0]?.id || null;
  }
}

/* ——— Auth UI ——— */

function showLogin() {
  $('#login-screen').classList.remove('hidden');
  $('#app').classList.add('hidden');
  $('#menu-btn').hidden = true;
  closeMobileSidebar();
}

function showApp() {
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#menu-btn').hidden = false;
  const s = getSession();
  $('#sidebar-user').textContent =
    s?.mode === 'demo'
      ? `${s.username} · local demo`
      : s?.username || '';
  renderAll();
}

async function handleLogin(e) {
  e.preventDefault();
  const err = $('#login-error');
  err.classList.add('hidden');
  err.textContent = '';
  const username = $('#login-user').value.trim();
  const password = $('#login-pass').value;
  const btn = $('#login-btn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    session = await login(username, password);
    await maybeImportShare();
    showApp();
    if (session.mode === 'demo') {
      toast('Signed in with local demo auth (set CELLAR_* env on Vercel)');
    }
  } catch (ex) {
    err.textContent = ex.message || 'Login failed';
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enter cellar';
  }
}

async function handleLogout() {
  await logout();
  session = null;
  showLogin();
}

/* ——— Sidebar / docs ——— */

function renderSidebar() {
  const list = $('#doc-list');
  list.innerHTML = '';
  const docs = [...workspace.documents].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  for (const doc of docs) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'doc-item' + (doc.id === workspace.activeId ? ' active' : '');
    btn.innerHTML = `
      <span class="doc-icon">${MODE_ICONS[doc.mode] || '◇'}</span>
      <span class="doc-title"></span>
      <span class="doc-delete" title="Delete" role="button">×</span>
    `;
    btn.querySelector('.doc-title').textContent = doc.title || 'Untitled';
    btn.addEventListener('click', (e) => {
      if (e.target.closest('.doc-delete')) {
        e.stopPropagation();
        deleteDoc(doc.id);
        return;
      }
      workspace.activeId = doc.id;
      persist();
      closeMobileSidebar();
      renderAll();
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function deleteDoc(id) {
  if (!confirm('Delete this page?')) return;
  workspace.documents = workspace.documents.filter((d) => d.id !== id);
  if (workspace.activeId === id) {
    workspace.activeId = workspace.documents[0]?.id || null;
  }
  persist();
  renderAll();
}

function newDoc(mode) {
  const doc = createDocument(mode);
  workspace.documents.unshift(doc);
  workspace.activeId = doc.id;
  persist();
  closeMobileSidebar();
  renderAll();
  toast(`Created ${MODE_LABELS[mode] || 'page'}`);
  requestAnimationFrame(() => $('#doc-title')?.focus());
}

/* ——— Editor ——— */

function renderAll() {
  ensureActive();
  renderSidebar();
  const doc = activeDoc();
  const empty = $('#empty-state');
  const wrap = $('#editor-wrap');
  if (!doc) {
    empty.classList.remove('hidden');
    wrap.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  wrap.classList.remove('hidden');

  $('#doc-title').value = doc.title || '';
  $('#doc-status').value = doc.status || 'draft';
  $('#doc-date').value = doc.date || '';
  $('#mode-badge').textContent = MODE_LABELS[doc.mode] || 'Page';

  $$('.tool-btn[data-set-mode]').forEach((b) => {
    b.classList.toggle('active-mode', b.dataset.setMode === doc.mode);
  });

  const reportMeta = $('#report-meta');
  reportMeta.classList.toggle('hidden', doc.mode !== 'report' && doc.mode !== 'page');

  renderBlocks(doc);
  renderMood(doc);
}

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 28) + 'px';
}

function renderBlocks(doc) {
  const root = $('#blocks');
  root.innerHTML = '';
  let numbered = 0;
  doc.blocks.forEach((block, index) => {
    if (block.type === 'numbered') numbered += 1;
    else if (block.type !== 'bullet') numbered = 0;

    const row = document.createElement('div');
    row.className = 'block';
    row.dataset.type = block.type;
    row.dataset.id = block.id;
    row.draggable = true;

    const handle = document.createElement('div');
    handle.className = 'block-handle';
    handle.title = 'Drag to reorder';
    handle.textContent = '⋮⋮';

    const body = document.createElement('div');
    body.className = 'block-body';
    if (block.type === 'numbered') body.dataset.num = String(numbered);

    const actions = document.createElement('div');
    actions.className = 'block-actions';
    actions.innerHTML = `
      <button type="button" data-act="up" title="Move up">↑</button>
      <button type="button" data-act="down" title="Move down">↓</button>
      <button type="button" data-act="type" title="Change type">Type</button>
      <button type="button" data-act="del" title="Delete">Del</button>
    `;
    actions.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'up') moveBlock(doc, index, -1);
      if (act === 'down') moveBlock(doc, index, 1);
      if (act === 'del') {
        doc.blocks.splice(index, 1);
        touch(doc);
        renderBlocks(doc);
      }
      if (act === 'type') cycleBlockType(doc, block);
    });

    if (block.type === 'divider') {
      body.innerHTML = '<div class="divider-line"></div>';
    } else {
      if (block.type === 'transcript') {
        const meta = document.createElement('div');
        meta.className = 'block-meta-row';
        const ts = document.createElement('input');
        ts.type = 'datetime-local';
        ts.value = block.timestamp || '';
        ts.addEventListener('change', () => {
          block.timestamp = ts.value;
          touch(doc);
        });
        meta.appendChild(document.createTextNode('Timestamp '));
        meta.appendChild(ts);
        body.appendChild(meta);
      }
      const ta = document.createElement('textarea');
      ta.className = 'block-content';
      ta.rows = 1;
      ta.placeholder =
        block.type === 'transcript'
          ? 'Dump transcription here…'
          : block.type.startsWith('heading')
            ? 'Heading'
            : 'Type something…';
      ta.value = block.text || '';
      ta.addEventListener('input', () => {
        block.text = ta.value;
        touch(doc);
        autosize(ta);
        // sync title from first heading if untitled-ish
        renderSidebarTitlesSoft();
      });
      ta.addEventListener('keydown', (e) => onBlockKey(e, doc, block, index, ta));
      body.appendChild(ta);
      requestAnimationFrame(() => autosize(ta));
    }

    row.appendChild(handle);
    row.appendChild(body);
    row.appendChild(actions);

    row.addEventListener('dragstart', (e) => {
      if (e.target.closest('textarea, input, button')) {
        e.preventDefault();
        return;
      }
      dragBlockId = block.id;
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      dragBlockId = null;
      row.classList.remove('dragging');
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragBlockId || dragBlockId === block.id) return;
      const from = doc.blocks.findIndex((b) => b.id === dragBlockId);
      const to = doc.blocks.findIndex((b) => b.id === block.id);
      if (from < 0 || to < 0) return;
      const [moved] = doc.blocks.splice(from, 1);
      doc.blocks.splice(to, 0, moved);
      touch(doc);
      renderBlocks(doc);
    });

    root.appendChild(row);
  });
}

function renderSidebarTitlesSoft() {
  const doc = activeDoc();
  if (!doc) return;
  const item = $$(`.doc-item`).find((el) => el.classList.contains('active'));
  if (item) {
    const t = item.querySelector('.doc-title');
    if (t) t.textContent = doc.title || 'Untitled';
  }
}

function touch(doc) {
  doc.updatedAt = Date.now();
  persist();
}

function moveBlock(doc, index, delta) {
  const next = index + delta;
  if (next < 0 || next >= doc.blocks.length) return;
  const tmp = doc.blocks[index];
  doc.blocks[index] = doc.blocks[next];
  doc.blocks[next] = tmp;
  touch(doc);
  renderBlocks(doc);
}

function cycleBlockType(doc, block) {
  const types = BLOCK_TYPES.map((b) => b.type);
  const i = types.indexOf(block.type);
  block.type = types[(i + 1) % types.length];
  if (block.type === 'transcript' && !block.timestamp) {
    block.timestamp = new Date().toISOString().slice(0, 16);
  }
  touch(doc);
  renderBlocks(doc);
}

function onBlockKey(e, doc, block, index, ta) {
  if (e.key === 'Enter' && !e.shiftKey && block.type !== 'transcript' && block.type !== 'paragraph') {
    // allow default newline in paragraph/transcript; for lists create new item
    if (block.type === 'bullet' || block.type === 'numbered') {
      e.preventDefault();
      const neu = { id: uid(), type: block.type, text: '' };
      doc.blocks.splice(index + 1, 0, neu);
      touch(doc);
      renderBlocks(doc);
      focusBlock(neu.id);
    }
  }
  if (e.key === 'Backspace' && ta.value === '' && doc.blocks.length > 1) {
    e.preventDefault();
    doc.blocks.splice(index, 1);
    touch(doc);
    renderBlocks(doc);
    const prev = doc.blocks[Math.max(0, index - 1)];
    if (prev) focusBlock(prev.id);
  }
}

function focusBlock(id) {
  requestAnimationFrame(() => {
    const el = $(`.block[data-id="${id}"] .block-content`);
    el?.focus();
  });
}

function addBlock(type) {
  const doc = activeDoc();
  if (!doc) return;
  const block = { id: uid(), type, text: '' };
  if (type === 'transcript') {
    block.timestamp = new Date().toISOString().slice(0, 16);
  }
  doc.blocks.push(block);
  touch(doc);
  renderBlocks(doc);
  if (type !== 'divider') focusBlock(block.id);
}

/* ——— Mood board ——— */

function renderMood(doc) {
  const section = $('#mood-section');
  const show = doc.mode === 'mood';
  section.classList.toggle('hidden', !show);
  if (!show) return;

  const board = $('#mood-board');
  board.innerHTML = '';
  (doc.moodItems || []).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'mood-card';
    card.dataset.kind = item.kind;
    card.dataset.id = item.id;
    card.draggable = true;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mood-remove';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      doc.moodItems = doc.moodItems.filter((m) => m.id !== item.id);
      touch(doc);
      renderMood(doc);
    });

    if (item.kind === 'image') {
      const img = document.createElement('img');
      img.src = item.value;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        img.replaceWith(Object.assign(document.createElement('div'), {
          className: 'mood-text',
          textContent: 'Image failed to load',
        }));
      };
      card.appendChild(img);
    } else if (item.kind === 'color') {
      const sw = document.createElement('div');
      sw.className = 'mood-swatch';
      sw.style.background = item.value;
      const label = document.createElement('span');
      label.textContent = item.value;
      sw.appendChild(label);
      card.appendChild(sw);
    } else {
      const ta = document.createElement('textarea');
      ta.className = 'mood-text';
      ta.value = item.value || '';
      ta.placeholder = 'Note…';
      ta.addEventListener('input', () => {
        item.value = ta.value;
        touch(doc);
      });
      card.appendChild(ta);
    }

    card.appendChild(remove);

    card.addEventListener('dragstart', () => {
      dragMoodId = item.id;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      dragMoodId = null;
      card.classList.remove('dragging');
    });
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragMoodId || dragMoodId === item.id) return;
      const from = doc.moodItems.findIndex((m) => m.id === dragMoodId);
      const to = doc.moodItems.findIndex((m) => m.id === item.id);
      if (from < 0 || to < 0) return;
      const [moved] = doc.moodItems.splice(from, 1);
      doc.moodItems.splice(to, 0, moved);
      touch(doc);
      renderMood(doc);
    });

    board.appendChild(card);
  });
}

function addMoodItem(kind) {
  const doc = activeDoc();
  if (!doc) return;
  if (!doc.moodItems) doc.moodItems = [];
  let value = '';
  if (kind === 'image') {
    value = $('#mood-image-url').value.trim();
    if (!value) {
      toast('Paste an image URL first');
      return;
    }
    $('#mood-image-url').value = '';
  } else if (kind === 'color') {
    value = $('#mood-color').value || '#2f5d50';
  } else {
    value = $('#mood-text-input').value.trim() || 'New note';
    $('#mood-text-input').value = '';
  }
  doc.moodItems.push({ id: uid(), kind, value });
  touch(doc);
  renderMood(doc);
}

/* ——— Share / import ——— */

async function maybeImportShare() {
  const shared = await readShareHash();
  if (!shared) return;
  if (confirm('Load shared Secret Cellar workspace from this link? This replaces local documents in this browser.')) {
    workspace = {
      version: shared.version || 1,
      documents: shared.documents,
      activeId: shared.activeId || shared.documents[0]?.id || null,
    };
    persist();
    toast('Shared workspace imported');
  }
  clearShareHash();
}

async function handleShare() {
  try {
    const url = await buildShareURL(workspace);
    await navigator.clipboard.writeText(url);
    toast('Share link copied to clipboard');
  } catch (err) {
    toast(err.message || 'Could not create share link');
  }
}

async function handleImport(file) {
  try {
    const data = await importJSONFile(file);
    if (!confirm('Import will replace your local workspace. Continue?')) return;
    workspace = {
      version: data.version || 1,
      documents: data.documents,
      activeId: data.activeId || data.documents[0]?.id || null,
    };
    persist();
    renderAll();
    toast('Workspace imported');
  } catch (err) {
    toast(err.message || 'Import failed');
  }
}

/* ——— Mobile sidebar ——— */

function openMobileSidebar() {
  $('#sidebar').classList.add('open');
  $('#sidebar-backdrop').classList.add('show');
}

function closeMobileSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebar-backdrop').classList.remove('show');
}

/* ——— Boot ——— */

function bindUI() {
  $('#login-form').addEventListener('submit', handleLogin);
  $('#btn-logout').addEventListener('click', handleLogout);
  $('#btn-new-page').addEventListener('click', () => newDoc('page'));
  $('#btn-new-transcript').addEventListener('click', () => newDoc('transcript'));
  $('#btn-new-report').addEventListener('click', () => newDoc('report'));
  $('#btn-new-mood').addEventListener('click', () => newDoc('mood'));
  $('#btn-export').addEventListener('click', () => {
    exportJSON(workspace);
    toast('Exported JSON');
  });
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    e.target.value = '';
  });
  $('#btn-share').addEventListener('click', handleShare);

  $('#doc-title').addEventListener('input', (e) => {
    const doc = activeDoc();
    if (!doc) return;
    doc.title = e.target.value;
    touch(doc);
    renderSidebarTitlesSoft();
  });
  $('#doc-status').addEventListener('change', (e) => {
    const doc = activeDoc();
    if (!doc) return;
    doc.status = e.target.value;
    touch(doc);
  });
  $('#doc-date').addEventListener('change', (e) => {
    const doc = activeDoc();
    if (!doc) return;
    doc.date = e.target.value;
    touch(doc);
  });

  $$('.tool-btn[data-set-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const doc = activeDoc();
      if (!doc) return;
      doc.mode = btn.dataset.setMode;
      touch(doc);
      renderAll();
    });
  });

  const addBar = $('#add-block-bar');
  BLOCK_TYPES.forEach(({ type, label }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool-btn';
    b.textContent = '+ ' + label;
    b.addEventListener('click', () => addBlock(type));
    addBar.appendChild(b);
  });

  $('#btn-mood-image').addEventListener('click', () => addMoodItem('image'));
  $('#btn-mood-color').addEventListener('click', () => addMoodItem('color'));
  $('#btn-mood-text').addEventListener('click', () => addMoodItem('text'));

  $('#menu-btn').addEventListener('click', openMobileSidebar);
  $('#sidebar-backdrop').addEventListener('click', closeMobileSidebar);
  $('#empty-create').addEventListener('click', () => newDoc('page'));
}

async function boot() {
  bindUI();
  session = await verifySession();
  if (!session) {
    // Still allow hash import after login
    showLogin();
    return;
  }
  await maybeImportShare();
  showApp();
}

boot();
