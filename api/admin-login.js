import { checkPassword, createSessionCookie, clearSessionCookie, isAuthenticated } from './_auth.js';
import { checkLoginRate, resetLoginRate, clientIp } from './_ratelimit.js';

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

  const ip = clientIp(req);

  try {
    // Le quota se consomme avant la verification du mot de passe : sinon il
    // suffirait d'essayer en boucle sans jamais etre compte.
    const rate = await checkLoginRate(ip);
    if (!rate.success) {
      const min = Math.ceil(rate.retryAfter / 60);
      res.setHeader('Retry-After', String(rate.retryAfter));
      return res.status(429).json({
        error: `Trop de tentatives. Reessayez dans ${min} minute${min > 1 ? 's' : ''}.`,
        retryAfter: rate.retryAfter
      });
    }

    if (!checkPassword(req.body?.password)) {
      // Le nombre d'essais restants est annonce : c'est une information que
      // l'attaquant peut de toute facon deduire, et elle evite a Gaetan de se
      // faire bloquer sans comprendre.
      return res.status(401).json({
        error: rate.remaining > 0
          ? `Mot de passe incorrect. Encore ${rate.remaining} essai${rate.remaining > 1 ? 's' : ''}.`
          : 'Mot de passe incorrect.',
        remaining: rate.remaining
      });
    }

    await resetLoginRate(ip);
    res.setHeader('Set-Cookie', createSessionCookie(req));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('admin-login:', err.message);
    return res.status(500).json({ error: 'Configuration serveur incomplete.' });
  }
}
