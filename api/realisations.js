import { listPhotos } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Methode non autorisee' });

  try {
    const photos = await listPhotos();
    // Cache court : Gaetan doit voir sa photo en ligne rapidement apres l'envoi.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json(photos);
  } catch (err) {
    console.error('realisations:', err);
    // La galerie garde son contenu de secours plutot que d'afficher une erreur.
    return res.status(200).json([]);
  }
}
