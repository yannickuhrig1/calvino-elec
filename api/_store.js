import { list } from '@vercel/blob';

export const META_PREFIX = 'realisations/meta/';
export const IMG_PREFIX = 'realisations/img/';

/**
 * Chaque photo a son propre fichier de metadonnees, ecrit une seule fois et
 * jamais modifie.
 *
 * Un index JSON unique paraissait plus simple, mais imposait un cycle
 * lire-modifier-ecrire a chaque envoi : le CDN de Vercel Blob renvoyant une
 * version en cache de l'index, deux envois rapproches se marchaient dessus et
 * une photo disparaissait. Des fichiers separes et immuables suppriment le
 * probleme a la racine — il n'y a plus rien a ecraser, et le cache devient un
 * atout puisque le contenu ne change jamais.
 */
export async function listPhotos() {
  const { blobs } = await list({ prefix: META_PREFIX, limit: 1000 });
  if (blobs.length === 0) return [];

  const photos = await Promise.all(blobs.map(async b => {
    try {
      const res = await fetch(b.url);
      if (!res.ok) return null;
      const p = await res.json();
      return p && p.id && p.url ? p : null;
    } catch {
      return null; // une metadonnee illisible ne doit pas casser toute la galerie
    }
  }));

  return photos
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function findPhoto(id) {
  const { blobs } = await list({ prefix: `${META_PREFIX}${id}.json`, limit: 1 });
  if (blobs.length === 0) return null;

  try {
    const res = await fetch(blobs[0].url);
    if (!res.ok) return null;
    const photo = await res.json();
    return { photo, metaUrl: blobs[0].url };
  } catch {
    return null;
  }
}

export const CATEGORIES = [
  'Électricité',
  'Borne IRVE',
  'Éclairage',
  'Rénovation',
  'Climatisation',
  'Photovoltaïque',
  'Autre'
];
