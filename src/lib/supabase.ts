/**
 * Client Supabase unificat — înlocuiește `src/lib/db.js` (mysql2/TCP).
 * Accesul prin REST/HTTPS păstrează compatibilitatea cu runtime-urile edge.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Variabilele server nu sunt inlinate la build, deci citim și din process.env. */
function readEnv(key: string): string | undefined {
  const fromAstro = (import.meta.env as Record<string, string | undefined>)[key];
  if (fromAstro) return fromAstro;
  if (typeof process !== "undefined" && process.env) return process.env[key];
  return undefined;
}

function resolveUrl(): string | undefined {
  return readEnv("SUPABASE_URL") ?? readEnv("PUBLIC_SUPABASE_URL");
}

const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

let adminClient: SupabaseClient | null = null;
let publicClient: SupabaseClient | null = null;

/**
 * Cheia service_role ocolește RLS. Nu se folosește niciodată în cod care
 * ajunge în browser — doar în `src/pages/api/**`.
 * Întoarce `null` când configurarea lipsește, ca build-ul să nu cadă.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const url = resolveUrl();
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  adminClient = createClient(url, serviceKey, CLIENT_OPTIONS);
  return adminClient;
}

/** Cheia anon respectă RLS: doar tabelele cu politică publică de SELECT. */
export function getSupabasePublic(): SupabaseClient | null {
  if (publicClient) return publicClient;
  const url = resolveUrl();
  const anonKey = readEnv("SUPABASE_ANON_KEY") ?? readEnv("PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  publicClient = createClient(url, anonKey, CLIENT_OPTIONS);
  return publicClient;
}

export class SupabaseUnavailableError extends Error {
  constructor() {
    super("Supabase nu este configurat: lipsesc SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY.");
    this.name = "SupabaseUnavailableError";
  }
}

/** Pentru rutele API, unde lipsa configurării trebuie să devină 500, nu date tăcute. */
export function requireSupabaseAdmin(): SupabaseClient {
  const client = getSupabaseAdmin();
  if (!client) throw new SupabaseUnavailableError();
  return client;
}
