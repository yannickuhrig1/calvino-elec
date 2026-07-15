const PAGE_ID = "100086736070456";
const ACCESS_TOKEN = process.env.FACEBOOK_PAGE_TOKEN;

let cache = null;
let cacheExpiry = 0;

export default async function handler(req, res) {
  // Activer CORS pour permettre les requêtes locales en développement
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!ACCESS_TOKEN) {
    return res.status(500).json({ 
      error: "FACEBOOK_PAGE_TOKEN n'est pas configuré dans les variables d'environnement du serveur." 
    });
  }

  const now = Date.now();
  if (cache && now < cacheExpiry) {
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=600');
    return res.status(200).json(cache);
  }

  try {
    // Récupérer le feed avec les attachements médias et le lien permanent
    const url = `https://graph.facebook.com/v18.0/${PAGE_ID}/feed?fields=id,message,permalink_url,created_time,attachments{media,type}&access_token=${ACCESS_TOKEN}&limit=12`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || "Erreur de communication avec l'API Graph Meta");
    }

    const data = await response.json();
    const posts = data.data || [];
    const photos = [];

    for (const post of posts) {
      if (post.attachments && post.attachments.data) {
        // Chercher s'il y a un média de type photo
        const photoAttachment = post.attachments.data.find(att => att.type === 'photo' || (att.media && att.media.image));
        if (photoAttachment) {
          photos.push({
            id: post.id,
            image_url: photoAttachment.media.image.src,
            link: post.permalink_url,
            caption: post.message || "Réalisation Calvino Elec",
            created_time: post.created_time
          });
        }
      }
    }

    cache = photos;
    cacheExpiry = now + 60 * 60 * 1000; // Cache d'une heure en mémoire

    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=600');
    return res.status(200).json(photos);
  } catch (error) {
    console.error("Facebook API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
