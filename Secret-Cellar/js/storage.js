/**
 * Persistence: localStorage + export/import JSON + share-hash
 *
 * True multi-user sync needs a backend. For now documents are shared via
 * Export JSON, Import JSON, or a Share link (URL hash) when the payload fits.
 */

const STORAGE_KEY = 'secret-cellar-docs-v1';

export function loadWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWorkspace();
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.documents)) return defaultWorkspace();
    return data;
  } catch {
    return defaultWorkspace();
  }
}

export function saveWorkspace(workspace) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

export function defaultWorkspace() {
  const now = Date.now();
  return {
    version: 1,
    documents: [
      {
        id: uid(),
        title: 'Welcome to Secret Cellar',
        mode: 'page',
        status: 'draft',
        date: new Date().toISOString().slice(0, 10),
        updatedAt: now,
        createdAt: now,
        blocks: [
          { id: uid(), type: 'heading1', text: 'A quiet place to write' },
          {
            id: uid(),
            type: 'paragraph',
            text: 'Use the sidebar to create pages. Switch modes for transcription, reports, or mood boards. Content stays in this browser until you export or share.',
          },
          { id: uid(), type: 'callout', text: 'Shared sync needs a backend later — for now use Export / Import / Share link.' },
          { id: uid(), type: 'divider', text: '' },
          { id: uid(), type: 'bullet', text: 'Headings, lists, dividers, callouts' },
          { id: uid(), type: 'bullet', text: 'Transcription blocks with optional timestamps' },
          { id: uid(), type: 'bullet', text: 'Mood board with images, colors, and notes' },
        ],
        moodItems: [],
      },
    ],
    activeId: null,
  };
}

export function uid() {
  return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function exportJSON(workspace) {
  const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `secret-cellar-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || !Array.isArray(data.documents)) {
          reject(new Error('Invalid Secret Cellar file'));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.readAsText(file);
  });
}

async function gzipBase64(text) {
  if (typeof CompressionStream === 'undefined') {
    return 'raw:' + btoa(unescape(encodeURIComponent(text)));
  }
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return 'gz:' + btoa(binary);
}

async function ungzipBase64(encoded) {
  if (encoded.startsWith('raw:')) {
    return decodeURIComponent(escape(atob(encoded.slice(4))));
  }
  if (!encoded.startsWith('gz:')) {
    // legacy plain base64 JSON
    return decodeURIComponent(escape(atob(encoded)));
  }
  const binary = atob(encoded.slice(3));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Browser cannot decompress share link');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

const SHARE_MAX = 45000; // keep under typical URL limits

export async function buildShareURL(workspace) {
  const payload = JSON.stringify({
    version: workspace.version || 1,
    documents: workspace.documents,
    activeId: workspace.activeId,
  });
  const encoded = await gzipBase64(payload);
  if (encoded.length > SHARE_MAX) {
    throw new Error('Workspace too large for a share link — use Export JSON instead');
  }
  const base = `${location.origin}${location.pathname}`;
  return `${base}#share=${encoded}`;
}

export async function readShareHash() {
  const hash = location.hash || '';
  const m = hash.match(/^#share=(.+)$/);
  if (!m) return null;
  try {
    const text = await ungzipBase64(m[1]);
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.documents)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearShareHash() {
  if (location.hash.startsWith('#share=')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

export function createDocument(mode = 'page') {
  const now = Date.now();
  const templates = {
    page: {
      title: 'Untitled',
      blocks: [{ id: uid(), type: 'paragraph', text: '' }],
      moodItems: [],
    },
    transcript: {
      title: 'Transcription',
      blocks: [
        { id: uid(), type: 'heading2', text: 'Session notes' },
        {
          id: uid(),
          type: 'transcript',
          text: '',
          timestamp: new Date().toISOString().slice(0, 16),
        },
      ],
      moodItems: [],
    },
    report: {
      title: 'Report',
      blocks: [
        { id: uid(), type: 'heading1', text: 'Report title' },
        { id: uid(), type: 'paragraph', text: 'Summary…' },
        { id: uid(), type: 'heading2', text: 'Section 1' },
        { id: uid(), type: 'paragraph', text: '' },
        { id: uid(), type: 'heading2', text: 'Section 2' },
        { id: uid(), type: 'bullet', text: '' },
        { id: uid(), type: 'callout', text: 'Key takeaway' },
      ],
      moodItems: [],
    },
    mood: {
      title: 'Mood board',
      blocks: [{ id: uid(), type: 'paragraph', text: 'Collect images, colors, and scraps of text.' }],
      moodItems: [
        { id: uid(), kind: 'color', value: '#2f5d50' },
        { id: uid(), kind: 'text', value: 'Atmosphere note' },
      ],
    },
  };
  const t = templates[mode] || templates.page;
  return {
    id: uid(),
    title: t.title,
    mode,
    status: 'draft',
    date: new Date().toISOString().slice(0, 10),
    updatedAt: now,
    createdAt: now,
    blocks: t.blocks,
    moodItems: t.moodItems,
  };
}
