// Politică CSP unică, folosită atât de middleware Astro (SSR) cât și de server.mjs
// (fișiere statice servite prin sirv) — evită desincronizarea celor două puncte de aplicare.
export const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com https://embed.cloudflarestream.com https://connect.facebook.net https://analytics.tiktok.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://www.google-analytics.com https://i.ytimg.com https://img.youtube.com https://*.googleusercontent.com https://*.cloudflarestream.com https://videodelivery.net https://www.facebook.com https://analytics.tiktok.com",
    "font-src 'self'",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://api.whatsapp.com https://*.supabase.co wss://*.supabase.co https://*.cloudflarestream.com https://videodelivery.net https://www.facebook.com https://analytics.tiktok.com https://business-api.tiktok.com",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://ec.europa.eu https://*.cloudflarestream.com https://iframe.cloudflarestream.com",
    "media-src 'self' blob: https://*.cloudflarestream.com https://videodelivery.net",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://api.whatsapp.com",
    "frame-ancestors 'self'",
].join('; ');
