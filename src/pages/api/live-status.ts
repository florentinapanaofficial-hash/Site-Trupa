/**
 * /api/live-status – Verifică dacă Live Input-ul Cloudflare Stream este în direct acum.
 * ────────────────────────────────────────────────────────────────────────────────────
 * Apelează Cloudflare Stream API (`/accounts/{ACCT}/stream/live_inputs/{ID}/videos?limit=1`)
 * și returnează:
 *   {
 *     isLive: boolean,
 *     videoId: string | null,        // UID-ul sesiunii live curente (Cloudflare videoUID)
 *     replayId: string | null,       // UID-ul video-ului de replay (fallback când nu e live)
 *     customerCode: string | null,   // codul subdomain Cloudflare Stream pentru iframe URL
 *     source: 'cloudflare'
 *   }
 *
 * Frontend-ul construiește URL-ul iframe astfel:
 *   https://customer-{customerCode}.cloudflarestream.com/{videoId|replayId}/iframe
 *
 * Cache-Control: public, max-age=30, stale-while-revalidate=300 — pentru a evita
 * apariția endpoint-ului în „Critical Request Chain” (Lighthouse / LCP).
 */

import type { APIRoute } from 'astro';
import { checkOrigin } from '../../lib/cors.js';

export const prerender = false;

const LIVE_STATUS_CACHE_TTL_MS = 25_000;
const CLOUDFLARE_FETCH_TIMEOUT_MS = 1_800;

type LiveStatusPayload = {
    isLive: boolean;
    videoId: string | null;
    replayId: string | null;
    customerCode: string | null;
    source: 'cloudflare';
};

type CloudflareVideo = {
    uid: string;
    status?: { state?: string };
    liveInput?: string;
};

type CloudflareLiveVideosResponse = {
    success?: boolean;
    result?: CloudflareVideo[];
    errors?: Array<{ code: number; message: string }>;
};

let cachedLiveStatus: LiveStatusPayload | null = null;
let cachedAt = 0;
let inFlightRequest: Promise<LiveStatusPayload> | null = null;

const isCacheFresh = () => {
    return cachedLiveStatus && Date.now() - cachedAt < LIVE_STATUS_CACHE_TTL_MS;
};

const buildOfflinePayload = (replayId: string | null, customerCode: string | null): LiveStatusPayload => ({
    isLive: false,
    videoId: null,
    replayId,
    customerCode,
    source: 'cloudflare',
});

const getFallbackPayload = (replayId: string | null, customerCode: string | null): LiveStatusPayload => {
    return cachedLiveStatus ?? buildOfflinePayload(replayId, customerCode);
};

const readErrorText = async (res: Response): Promise<string> => {
    try {
        const text = await res.text();
        return text.length > 300 ? `${text.slice(0, 300)}...` : text;
    } catch {
        return '';
    }
};

const fetchLiveStatusFromCloudflare = async (
    accountId: string,
    liveInputId: string,
    apiToken: string,
    replayId: string | null,
    customerCode: string | null
): Promise<LiveStatusPayload> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLOUDFLARE_FETCH_TIMEOUT_MS);

    try {
        const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/live_inputs/${encodeURIComponent(liveInputId)}/videos`;

        const res = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                Accept: 'application/json',
            },
        });

        if (!res.ok) {
            const responseText = await readErrorText(res);
            console.warn(
                `[api/live-status] Cloudflare Stream API error: status=${res.status} liveInputId=${liveInputId} body=${responseText || 'empty'}`
            );
            return getFallbackPayload(replayId, customerCode);
        }

        const data = (await res.json()) as CloudflareLiveVideosResponse;

        if (!data?.success || !Array.isArray(data.result)) {
            console.warn(`[api/live-status] Cloudflare Stream API returned success=false: ${JSON.stringify(data?.errors ?? [])}`);
            return getFallbackPayload(replayId, customerCode);
        }

        // Caută o sesiune live activă (state === 'live-inprogress').
        // Cloudflare returnează video-urile sortate cronologic descrescător; cel mai recent este primul.
        const liveVideo = data.result.find((video) => video?.status?.state === 'live-inprogress');

        if (liveVideo?.uid) {
            return {
                isLive: true,
                videoId: liveVideo.uid,
                replayId,
                customerCode,
                source: 'cloudflare',
            };
        }

        return buildOfflinePayload(replayId, customerCode);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.warn(`[api/live-status] Cloudflare Stream API timeout after ${CLOUDFLARE_FETCH_TIMEOUT_MS}ms liveInputId=${liveInputId}`);
        } else {
            const message = error instanceof Error ? error.message : 'unknown error';
            console.warn(`[api/live-status] Cloudflare Stream API request failed: liveInputId=${liveInputId} error=${message}`);
        }
        return getFallbackPayload(replayId, customerCode);
    } finally {
        clearTimeout(timeoutId);
    }
};

const getLiveStatus = async (
    accountId: string,
    liveInputId: string,
    apiToken: string,
    replayId: string | null,
    customerCode: string | null
): Promise<LiveStatusPayload> => {
    if (isCacheFresh()) {
        return cachedLiveStatus as LiveStatusPayload;
    }

    if (!inFlightRequest) {
        inFlightRequest = fetchLiveStatusFromCloudflare(accountId, liveInputId, apiToken, replayId, customerCode)
            .then((payload) => {
                cachedLiveStatus = payload;
                cachedAt = Date.now();
                return payload;
            })
            .finally(() => {
                inFlightRequest = null;
            });
    }

    return inFlightRequest;
};

const readEnv = (key: string): string | null => {
    const fromProcess = typeof process !== 'undefined' ? process.env?.[key]?.trim() : '';
    if (fromProcess) return fromProcess;
    const fromImport = (import.meta.env as Record<string, string | undefined>)[key]?.trim();
    return fromImport ? fromImport : null;
};

export const GET: APIRoute = async ({ request }) => {
    const originCheck = checkOrigin(request);

    if (!originCheck.allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
        Vary: 'Origin',
        ...(originCheck.origin ? { 'Access-Control-Allow-Origin': originCheck.origin } : {}),
    };

    const accountId = readEnv('CLOUDFLARE_ACCOUNT_ID');
    const liveInputId = readEnv('CLOUDFLARE_LIVE_INPUT_ID');
    const apiToken = readEnv('CLOUDFLARE_STREAM_TOKEN');
    const customerCode = readEnv('CLOUDFLARE_STREAM_CUSTOMER_CODE');
    const replayId = readEnv('CLOUDFLARE_REPLAY_VIDEO_UID');

    if (!accountId || !liveInputId || !apiToken) {
        // Configurare incompletă — răspundem fallback fără a mai apela Cloudflare.
        return new Response(
            JSON.stringify(buildOfflinePayload(replayId, customerCode)),
            { status: 200, headers }
        );
    }

    try {
        const payload = await getLiveStatus(accountId, liveInputId, apiToken, replayId, customerCode);
        return new Response(JSON.stringify(payload), { status: 200, headers });
    } catch {
        return new Response(
            JSON.stringify(getFallbackPayload(replayId, customerCode)),
            { status: 200, headers }
        );
    }
};
