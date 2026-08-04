/**
 * Auth client for Secret-Cellar
 * Talks to /api/auth. Real credentials live in the CELLAR_USER / CELLAR_PASS env vars.
 *
 * The demo fallback below exists so the app can be driven without a serverless runtime
 * during local development. It is gated on a local origin, so a network failure on the
 * production domain can never grant access.
 */

const SESSION_KEY = 'secret-cellar-session';
const DEMO_USER = 'admin';
const DEMO_PASS = 'change-me';

function isLocalOrigin() {
  return (
    location.protocol === 'file:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '[::1]'
  );
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// Statuses a plain static file server returns when no serverless runtime is present.
const NO_API_STATUS = new Set([404, 405, 501, 502]);

export async function login(username, password) {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (NO_API_STATUS.has(res.status) && isLocalOrigin()) {
      return demoLogin(username, password);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Login failed');
    }
    const session = {
      token: data.token,
      username: data.username,
      mode: 'api',
      at: Date.now(),
    };
    saveSession(session);
    return session;
  } catch (err) {
    // Network / missing API (local open without serverless)
    const unreachable =
      err instanceof TypeError || String(err.message).includes('Failed to fetch');
    if (unreachable && isLocalOrigin()) {
      return demoLogin(username, password);
    }
    throw err;
  }
}

function demoLogin(username, password) {
  if (username !== DEMO_USER || password !== DEMO_PASS) {
    throw new Error('Invalid username or password (local demo: admin / change-me)');
  }
  const session = {
    token: 'demo-local-' + Date.now(),
    username: DEMO_USER,
    mode: 'demo',
    at: Date.now(),
  };
  saveSession(session);
  return session;
}

export async function verifySession() {
  const session = getSession();
  if (!session) return null;

  if (session.mode === 'demo') {
    // Local/demo sessions last for the tab lifetime only
    return session;
  }

  try {
    const res = await fetch(`/api/auth?token=${encodeURIComponent(session.token)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    // Offline: keep existing session for this tab
    return session;
  }
}

export async function logout() {
  const session = getSession();
  clearSession();
  if (session?.mode === 'api' && session.token) {
    try {
      await fetch('/api/auth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.token }),
      });
    } catch {
      /* ignore */
    }
  }
}
