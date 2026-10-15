// Politică CSP unică, folosită atât de middleware Astro (SSR) cât și de server.mjs
// (fișiere statice servite prin sirv) — evită desincronizarea celor două puncte de aplicare.
export const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com https://embed.cloudflarestream.com https://connect.facebook.net https://analytics.tiktok.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: https://www.google-analytics.com https://i.ytimg.com https://img.youtube.com https://*.googleusercontent.com https://*.cloudflarestream.com https://videodelivery.net https://*.r2.dev https://www.facebook.com https://*.facebook.com https://*.fbcdn.net https://analytics.tiktok.com https://media.florentinapanaofficial.ro https://www.google.com",
    "font-src 'self'",
    // GA4 rutează colectarea pe endpoint-uri regionale (region1..regionN) și, cu Google
    // Signals activ, face ping către ad.doubleclick.net — de aici wildcard-urile.
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://ad.doubleclick.net https://api.whatsapp.com https://*.supabase.co wss://*.supabase.co https://*.cloudflarestream.com https://videodelivery.net https://*.r2.dev https://www.facebook.com https://*.facebook.com https://connect.facebook.net https://analytics.tiktok.com https://business-api.tiktok.com https://media.florentinapanaofficial.ro https://www.google.com",
    // Comments Plugin randează iframe de pe www.facebook.com/plugins/comments.php;
    // SDK-ul se injectează doar după consimțământul de marketing.
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://ec.europa.eu https://*.cloudflarestream.com https://iframe.cloudflarestream.com https://www.facebook.com https://*.facebook.com",
    "media-src 'self' blob: https://*.cloudflarestream.com https://videodelivery.net https://media.florentinapanaofficial.ro",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://api.whatsapp.com",
    "frame-ancestors 'self'",
].join('; ');
