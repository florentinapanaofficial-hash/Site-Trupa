import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
    const host = context.request.headers.get('host') ?? '';

    // Redirect non-www to www in production
    if (host === 'florentinapanaofficial.ro') {
        const url = new URL(context.request.url);
        url.host = 'www.florentinapanaofficial.ro';
        return Response.redirect(url.toString(), 301);
    }

    return next();
});
