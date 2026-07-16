import { del } from '@vercel/blob';
import { requireAuth } from './_auth.js';
import { findPhoto, listPhotos } from './_store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non autorisee' });
  }
  if (!requireAuth(req, res)) return;

  try {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'Identifiant manquant.' });

    const found = await findPhoto(id);
    if (!found) return res.status(404).json({ error: 'Photo introuvable.' });

    // La metadonnee d'abord : c'est elle qui fait apparaitre la photo dans la
    // galerie. Si la suppression de l'image echoue ensuite, il reste un fichier
    // orphelin invisible — preferable a une vignette cassee sur le site.
    await del(found.metaUrl);

    try {
      await del(found.photo.url);
    } catch (err) {
      console.error('admin-delete: image orpheline', found.photo.pathname, err.message);
    }

    const total = (await listPhotos()).length;
    return res.status(200).json({ ok: true, total });
  } catch (err) {
    console.error('admin-delete:', err);
    return res.status(500).json({ error: 'Echec de la suppression.' });
  }
}
