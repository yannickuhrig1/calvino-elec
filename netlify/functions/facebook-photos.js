const PAGE_ID = "100086736070456";
const ACCESS_TOKEN = process.env.FACEBOOK_PAGE_TOKEN;

let cache = null;
let cacheExpiry = 0;

exports.handler = async function(event, context) {
  // Configurer CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (!ACCESS_TOKEN) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "FACEBOOK_PAGE_TOKEN n'est pas configuré dans les variables d'environnement du serveur." })
    };
  }

  const now = Date.now();
  if (cache && now < cacheExpiry) {
    headers['Cache-Control'] = 'public, max-age=3600';
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(cache)
    };
  }

  try {
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
    cacheExpiry = now + 60 * 60 * 1000; // Cache d'une heure

    headers['Cache-Control'] = 'public, max-age=3600';
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(photos)
    };
  } catch (error) {
    console.error("Facebook API error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
