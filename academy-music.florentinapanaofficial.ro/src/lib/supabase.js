import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Lipsa configurării nu trebuie să oprească modulul: altfel bundle-ul moare și pagina rămâne albă. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
    console.error(
        '[Academy Music] Lipsesc VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
        'Copiază `.env.example` în `.env`, completează valorile din Supabase → Project Settings → API, ' +
        'apoi repornește serverul (variabilele VITE_* se citesc la pornire).'
    );
}

// `createClient` refuză un URL gol, deci folosim un host inert când configurarea lipsește.
const FALLBACK_URL = 'https://neconfigurat.supabase.co';
const FALLBACK_KEY = 'neconfigurat';

/**
 * Doar cheia `anon` ajunge în browser. Toată autorizarea reală stă în politicile
 * RLS din `supabase/schema.sql` — interfața nu este un mecanism de securitate.
 */
export const supabase = createClient(url || FALLBACK_URL, anonKey || FALLBACK_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'academy-music-auth',
    },
});

export const SUPABASE_URL = url || FALLBACK_URL;
export const SUPABASE_ANON_KEY = anonKey || FALLBACK_KEY;

export const SIGNED_URL_TTL = Number(import.meta.env.VITE_SIGNED_URL_TTL) || 300;

export const BUCKET_MEDIA = 'academy-media';
export const BUCKET_KARAOKE = 'karaoke-audio';
export const BUCKET_PORTFOLIO = 'portfolio';
export const BUCKET_AVATARS = 'avatars';
export const BUCKET_STUDENT_RECORDS = 'student_records';
