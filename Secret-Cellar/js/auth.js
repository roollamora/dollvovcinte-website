/**
 * Auth client for Secret-Cellar
 * Talks to /api/auth; falls back to local accounts only when API is unreachable.
 */

const SESSION_KEY = 'secret-cellar-session';

/** Local fallback accounts (same as api/auth.js defaults). */
const LOCAL_ACCOUNTS = {
  'Boss-Girl': '12345678',
  R: 'heya!',
};

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

export async function login(username, password) {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
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
    if (err instanceof TypeError || String(err.message).includes('Failed to fetch')) {
      if (LOCAL_ACCOUNTS[username] === password) {
        const session = {
          token: 'demo-local-' + Date.now(),
          username,
          mode: 'demo',
          at: Date.now(),
        };
        saveSession(session);
        return session;
      }
      throw new Error('Invalid username or password');
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
