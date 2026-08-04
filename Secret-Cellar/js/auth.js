/**
 * Auth client for Secret-Cellar
 * Talks to /api/auth; falls back to demo defaults only when API is unreachable.
 *
 * Demo defaults (CHANGE IN PRODUCTION via CELLAR_USER / CELLAR_PASS):
 *   username: admin
 *   password: change-me
 */

const SESSION_KEY = 'secret-cellar-session';
const DEMO_USER = 'admin';
const DEMO_PASS = 'change-me';

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
      if (username === DEMO_USER && password === DEMO_PASS) {
        const session = {
          token: 'demo-local-' + Date.now(),
          username: DEMO_USER,
          mode: 'demo',
          at: Date.now(),
        };
        saveSession(session);
        return session;
      }
      throw new Error('Invalid username or password (demo: admin / change-me)');
    }
    throw err;
  }
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
