/**
 * Sursa comuna de articole Supabase pentru /publicatii - evita sondarea repetata
 * a schemei (tableCandidates x selectCandidates) separat in getStaticPaths din
 * [slug].astro SI [...page].astro. Rezultatul e memoizat o singura data per build.
 */

const TABLE_CANDIDATES = ['articole_publicatii', 'publicatii', 'blog_posts', 'posts'];
const SELECT_CANDIDATES = [
  'slug,titlu,descriere,continut,categorie,imagine_principala,created_at',
  'slug,title,excerpt,content,body,category,cover_image,image,created_at,published_at',
  '*',
];

let cachedArticlesPromise: Promise<any[]> | null = null;

async function loadSupabaseArticles(): Promise<any[]> {
  const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const headers = { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` };
  let dnsFailed = false;

  const fetchArrayPayload = async (url: string): Promise<any[] | null> => {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) return null;
      const payload = await response.json();
      return Array.isArray(payload) ? payload : null;
    } catch (error) {
      const code = (error as any)?.cause?.code;
      if (code === 'ENOTFOUND' || String(error).includes('ENOTFOUND')) dnsFailed = true;
      return null;
    }
  };

  for (const table of TABLE_CANDIDATES) {
    if (dnsFailed) break;
    for (const select of SELECT_CANDIDATES) {
      if (dnsFailed) break;
      const url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
      const payload = await fetchArrayPayload(url);
      if (payload) {
        console.log(`[publicatii-source] Supabase source: ${table} (${payload.length} rows)`);
        return payload;
      }
    }
  }
  if (dnsFailed) {
    console.warn('[publicatii-source] Supabase indisponibil in build (DNS). Se foloseste fallback local.');
  }
  return [];
}

/** Memoizat - sondarea Supabase ruleaza o singura data per build, indiferent cate pagini o folosesc. */
export function getSupabaseArticles(): Promise<any[]> {
  if (!cachedArticlesPromise) {
    cachedArticlesPromise = loadSupabaseArticles();
  }
  return cachedArticlesPromise;
}
