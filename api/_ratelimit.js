import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Limitation des tentatives de connexion.
 *
 * Un compteur en memoire ne protege rien sur du serverless : chaque instance a
 * le sien et il repart a zero a chaque demarrage a froid, si bien qu'un
 * attaquant patient ou distribue passe au travers. Le compteur vit donc dans
 * Redis, partage par toutes les instances.
 */

// L'integration Upstash expose ses variables sous deux prefixes selon qu'elle
// a ete branchee via le Marketplace (KV_*) ou configuree a la main (UPSTASH_*).
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const limiter = url && token
  ? new Ratelimit({
      redis: new Redis({ url, token }),
      // 8 essais par tranche de 10 min : large pour une faute de frappe,
      // derisoire pour une attaque.
      limiter: Ratelimit.slidingWindow(8, '10 m'),
      prefix: 'calvino:login',
      analytics: false
    })
  : null;

// Filet de securite si Redis est injoignable : on ne laisse pas la porte
// grande ouverte, mais on ne bloque pas Gaetan non plus.
const memory = new Map();
const MEM_MAX = 8;
const MEM_WINDOW_MS = 10 * 60 * 1000;

function memoryCheck(ip) {
  const now = Date.now();
  const rec = memory.get(ip);
  if (!rec || now > rec.reset) {
    memory.set(ip, { count: 1, reset: now + MEM_WINDOW_MS });
    return { success: true, remaining: MEM_MAX - 1, retryAfter: 0 };
  }
  rec.count++;
  const success = rec.count <= MEM_MAX;
  return {
    success,
    remaining: Math.max(0, MEM_MAX - rec.count),
    retryAfter: success ? 0 : Math.ceil((rec.reset - now) / 1000)
  };
}

export function clientIp(req) {
  // Sur Vercel, x-forwarded-for est pose par le proxy ; le premier element est
  // l'adresse reelle du client.
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || 'inconnue';
}

/**
 * @returns {Promise<{success: boolean, remaining: number, retryAfter: number}>}
 */
export async function checkLoginRate(ip) {
  if (!limiter) return memoryCheck(ip);

  try {
    const { success, remaining, reset } = await limiter.limit(ip);
    return {
      success,
      remaining,
      retryAfter: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    };
  } catch (err) {
    console.error('ratelimit: Redis injoignable, repli en memoire —', err.message);
    return memoryCheck(ip);
  }
}

/** Efface le compteur apres une connexion reussie. */
export async function resetLoginRate(ip) {
  memory.delete(ip);
  if (!limiter) return;
  try {
    await limiter.resetUsedTokens(ip);
  } catch (err) {
    console.error('ratelimit: reset impossible —', err.message);
  }
}
