import { checkPassword, createSessionCookie, clearSessionCookie, isAuthenticated } from './_auth.js';

// Limite les tentatives par IP. En memoire : remis a zero a chaque cold start,
// ce qui est acceptable ici (un seul utilisateur, mot de passe fort).
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.reset) {
    attempts.set(ip, { count: 0, reset: now + WINDOW_MS });
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const rec = attempts.get(ip);
  if (rec) rec.count++;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ authenticated: isAuthenticated(req) });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie(req));
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non autorisee' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'inconnue';
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: 'Trop de tentatives. Reessayez dans 10 minutes.' });
  }

  try {
    const { password } = req.body ?? {};
    if (!checkPassword(password)) {
      recordFailure(ip);
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    res.setHeader('Set-Cookie', createSessionCookie(req));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('admin-login:', err.message);
    return res.status(500).json({ error: 'Configuration serveur incomplete.' });
  }
}
