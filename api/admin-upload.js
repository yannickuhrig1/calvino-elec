import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { requireAuth } from './_auth.js';
import { listPhotos, CATEGORIES, META_PREFIX, IMG_PREFIX } from './_store.js';

const MAX_BYTES = 4 * 1024 * 1024; // marge sous la limite de 4,5 Mo des fonctions Vercel
const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Le type annonce dans le data URL vient du client et peut mentir. On verifie la
 * signature reelle des octets : sinon un fichier quelconque pourrait etre stocke
 * et servi sous un Content-Type d'image.
 */
function sniffMime(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non autorisee' });
  }
  if (!requireAuth(req, res)) return;

  try {
    const { dataUrl, caption, category } = req.body ?? {};

    if (typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Image manquante.' });
    }

    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
    if (!m) {
      return res.status(400).json({ error: 'Format d\'image invalide.' });
    }

    const [, declaredMime, b64] = m;
    if (!ALLOWED[declaredMime]) {
      return res.status(400).json({ error: 'Format non accepte. Utilisez JPEG, PNG ou WebP.' });
    }

    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Image vide.' });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: 'Image trop lourde apres compression. Reessayez.' });
    }

    // On se fie aux octets, pas a ce que le client annonce.
    const mime = sniffMime(buffer);
    if (!mime) {
      return res.status(400).json({ error: 'Ce fichier n\'est pas une image valide.' });
    }
    const ext = ALLOWED[mime];

    // Description et categorie sont facultatives : sur un chantier, publier vite
    // vaut mieux que ne pas publier. La galerie s'adapte a ce qui est fourni.
    const cap = String(caption ?? '').trim().slice(0, 120);
    const cat = CATEGORIES.includes(category) ? category : null;
    const id = randomUUID();

    const blob = await put(`${IMG_PREFIX}${id}.${ext}`, buffer, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false
    });

    const photo = {
      id,
      url: blob.url,
      pathname: blob.pathname,
      caption: cap,
      category: cat,
      created_at: new Date().toISOString()
    };

    // Ecrit apres l'image : la metadonnee fait foi pour la galerie, donc elle ne
    // doit exister que si l'image est effectivement en ligne.
    await put(`${META_PREFIX}${id}.json`, JSON.stringify(photo), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });

    const total = (await listPhotos()).length;
    return res.status(201).json({ ok: true, photo, total });
  } catch (err) {
    console.error('admin-upload:', err);
    return res.status(500).json({ error: 'Echec de l\'envoi. Reessayez.' });
  }
}
