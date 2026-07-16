import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const COOKIE_NAME = 'calvino_admin';
const SESSION_MS = 12 * 60 * 60 * 1000; // 12 h

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error('ADMIN_SESSION_SECRET manquant');
  return s;
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/**
 * Un cookie `Secure` n'est accepte que sur HTTPS : sur le HTTP de `vercel dev`
 * le navigateur le jetterait et la connexion echouerait en local. On se fie au
 * protocole reel vu par le proxy, et on garde `Secure` par defaut quand
 * l'en-tete manque — mieux vaut casser le dev local qu'exposer la session.
 */
function secureAttr(req) {
  const proto = req?.headers?.['x-forwarded-proto'];
  return proto === 'http' ? '' : ' Secure;';
}

// Comparaison a temps constant : evite qu'un attaquant devine la signature
// octet par octet en mesurant le temps de reponse.
function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function checkPassword(given) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error('ADMIN_PASSWORD manquant');
  if (typeof given !== 'string' || given.length === 0) return false;
  return safeEqual(given, expected);
}

export function createSessionCookie(req) {
  const exp = Date.now() + SESSION_MS;
  const nonce = randomBytes(8).toString('base64url');
  const payload = `${exp}.${nonce}`;
  const value = `${payload}.${sign(payload)}`;
  const maxAge = Math.floor(SESSION_MS / 1000);
  return `${COOKIE_NAME}=${value}; HttpOnly;${secureAttr(req)} SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(req) {
  return `${COOKIE_NAME}=; HttpOnly;${secureAttr(req)} SameSite=Strict; Path=/; Max-Age=0`;
}

export function isAuthenticated(req) {
  const raw = req.headers?.cookie;
  if (!raw) return false;

  const match = raw.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;

  const value = match.slice(COOKIE_NAME.length + 1);
  const parts = value.split('.');
  if (parts.length !== 3) return false;

  const [exp, nonce, sig] = parts;
  if (!safeEqual(sig, sign(`${exp}.${nonce}`))) return false;

  const expMs = Number(exp);
  return Number.isFinite(expMs) && Date.now() < expMs;
}

/** Renvoie true si la requete est autorisee, sinon repond 401 et renvoie false. */
export function requireAuth(req, res) {
  if (isAuthenticated(req)) return true;
  res.status(401).json({ error: 'Non autorise. Reconnectez-vous.' });
  return false;
}
