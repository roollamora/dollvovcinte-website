/**
 * Auth client for Secret-Cellar
 * Talks to /api/auth. Local fallback only on localhost / file origins.
 */

const SESSION_KEY = 'secret-cellar-session';

const LOCAL_ACCOUNTS = {
  'Boss-Girl': '12345678',
  R: 'heya!',
};

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

const NO_API_STATUS = new Set([404, 405, 501, 502]);

function demoLogin(username, password) {
  if (LOCAL_ACCOUNTS[username] !== password) {
    throw new Error('Invalid username or password');
  }
  const session = {
    token: 'demo-local-' + Date.now(),
    username,
    mode: 'demo',
    at: Date.now(),
  };
  saveSession(session);
  return session;
}

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
    const unreachable =
      err instanceof TypeError || String(err.message).includes('Failed to fetch');
    if (unreachable && isLocalOrigin()) {
      return demoLogin(username, password);
    }
    throw err;
  }
}

export async function verifySession() {
  const session = getSession();
  if (!session) return null;

  if (session.mode === 'demo') {
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
