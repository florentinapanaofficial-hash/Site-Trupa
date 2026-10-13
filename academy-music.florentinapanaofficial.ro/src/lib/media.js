import { supabase, SIGNED_URL_TTL } from './supabase';

/**
 * URL-urile semnate sunt temporare și legate de sesiune. Fișierele stau în buckete
 * private, deci nu există nicio adresă permanentă care să poată fi distribuită.
 */
const cache = new Map();
const SAFETY_MARGIN_MS = 20_000;

function cacheKey(bucket, path) {
    return `${bucket}::${path}`;
}

export async function getSignedUrl(bucket, path, ttl = SIGNED_URL_TTL) {
    if (!path) return null;

    const key = cacheKey(bucket, path);
    const hit = cache.get(key);
    if (hit && hit.expiresAt - SAFETY_MARGIN_MS > Date.now()) {
        return hit.url;
    }

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl, {
        download: false,
    });

    if (error) throw error;

    cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + ttl * 1000 });
    return data.signedUrl;
}

export function invalidateSignedUrl(bucket, path) {
    cache.delete(cacheKey(bucket, path));
}

export function clearSignedUrlCache() {
    cache.clear();
}

export async function uploadFile(bucket, path, file, options = {}) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
        ...options,
    });
    if (error) throw error;
    return path;
}

const SAFE_SEGMENT = /[^a-z0-9._-]+/gi;

/** Numele de fișier venit de la utilizator nu ajunge niciodată nefiltrat în cheia de storage. */
export function safeFileName(name) {
    const cleaned = String(name || 'fisier')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(SAFE_SEGMENT, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    return cleaned.slice(0, 80) || 'fisier';
}

export function detectMediaType(file) {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('image/')) return 'image';
    return null;
}
