/**
 * Secret-Cellar auth — Vercel serverless function
 *
 * Env vars (set in Vercel project settings):
 *   CELLAR_USER   — username (default: admin)
 *   CELLAR_PASS   — password (default: change-me)  ← change in production!
 *   CELLAR_SECRET — HMAC secret for session tokens (defaults to CELLAR_PASS)
 *
 * POST { username, password } → { ok, token, username }
 * GET  ?token=...            → { ok, username }
 * DELETE / body { token }    → { ok }  (client clears session; token is self-expiring)
 */

const crypto = require('crypto');

const USER = process.env.CELLAR_USER || 'admin';
const PASS = process.env.CELLAR_PASS || 'change-me';
const SECRET = process.env.CELLAR_SECRET || PASS;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function makeToken(username) {
  const exp = Date.now() + TTL_MS;
  const payload = `${username}:${exp}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(String(token), 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [username, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!username || !Number.isFinite(exp) || Date.now() > exp) return null;
    const payload = `${username}:${exp}`;
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    if (!safeEqual(sig, expected)) return null;
    if (!safeEqual(username, USER)) return null;
    return username;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const username = verifyToken(token);
    if (!username) {
      json(res, 401, { ok: false, error: 'Invalid or expired session' });
      return;
    }
    json(res, 200, { ok: true, username });
    return;
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { ok: false, error: 'Invalid JSON' });
      return;
    }

    const username = String(body.username || '');
    const password = String(body.password || '');

    if (!safeEqual(username, USER) || !safeEqual(password, PASS)) {
      // Constant-ish delay against timing probes
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
      json(res, 401, { ok: false, error: 'Invalid username or password' });
      return;
    }

    const token = makeToken(username);
    json(res, 200, { ok: true, token, username });
    return;
  }

  if (req.method === 'DELETE') {
    json(res, 200, { ok: true });
    return;
  }

  json(res, 405, { ok: false, error: 'Method not allowed' });
};
