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
        // Endpoint 1: Verifica statusul live input-ului (mai important)
        const statusUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/live_inputs/${encodeURIComponent(liveInputId)}`;

        const statusRes = await fetch(statusUrl, {
            signal: controller.signal,
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                Accept: 'application/json',
            },
        });

        if (!statusRes.ok) {
            const responseText = await readErrorText(statusRes);
            console.error(
                `[api/live-status] Cloudflare live_inputs/{id} endpoint error: status=${statusRes.status} liveInputId=${liveInputId} response=${responseText || 'empty'}`
            );
        } else {
            const statusData = await statusRes.json() as any;
            console.log(`[api/live-status] Live input status response:`, JSON.stringify(statusData, null, 2));

            if (statusData?.success && statusData.result) {
                const liveInput = statusData.result;
                // Cloudflare returnează `status` ca obiect: { current: { state: 'connected' | 'idle' | ... } }
                // În unele variante mai vechi era un string. Acoperim ambele formate.
                const statusObj = liveInput?.status;
                const currentState =
                    (typeof statusObj === 'object' && statusObj?.current?.state) ||
                    (typeof statusObj === 'string' ? statusObj : null);
                const isLiveActive =
                    currentState === 'connected' ||
                    currentState === 'live-inprogress' ||
                    currentState === 'active' ||
                    liveInput?.meta?.live === true;

                if (isLiveActive) {
                    console.log(`[api/live-status] ✓ LIVE DETECTED - state: ${currentState}`);

                    // Dacă e active, obținem video UID din endpoint-ul de videos
                    const videosUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/live_inputs/${encodeURIComponent(liveInputId)}/videos?limit=1`;
                    const videosRes = await fetch(videosUrl, {
                        signal: controller.signal,
                        cache: 'no-store',
                        headers: {
                            Authorization: `Bearer ${apiToken}`,
                            Accept: 'application/json',
                        },
                    });

                    if (videosRes.ok) {
                        const videosData = (await videosRes.json()) as CloudflareLiveVideosResponse;
                        const currentVideo = videosData?.result?.[0];

                        if (currentVideo?.uid) {
                            console.log(`[api/live-status] ✓ Video UID: ${currentVideo.uid}`);
                            return {
                                isLive: true,
                                videoId: currentVideo.uid,
                                replayId,
                                customerCode,
                                source: 'cloudflare',
                            };
                        }
                    } else {
                        console.error(`[api/live-status] Failed to fetch videos: status=${videosRes.status}`);
                    }
                } else {
                    console.log(`[api/live-status] Live input not active - state: ${currentState}`);
                }
            }
        }

        // Fallback: Caută video cu state 'live-inprogress' din endpoint /videos
        const fallbackUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/live_inputs/${encodeURIComponent(liveInputId)}/videos?limit=1`;
        const fallbackRes = await fetch(fallbackUrl, {
            signal: controller.signal,
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                Accept: 'application/json',
            },
        });

        if (fallbackRes.ok) {
            const fallbackData = (await fallbackRes.json()) as CloudflareLiveVideosResponse;
            console.log(`[api/live-status] Videos endpoint response:`, JSON.stringify(fallbackData, null, 2));

            if (fallbackData?.success && Array.isArray(fallbackData.result)) {
                const liveVideo = fallbackData.result.find((video) => video?.status?.state === 'live-inprogress');
                if (liveVideo?.uid) {
                    console.log(`[api/live-status] ✓ Found live video (state=live-inprogress): ${liveVideo.uid}`);
                    return {
                        isLive: true,
                        videoId: liveVideo.uid,
                        replayId,
                        customerCode,
                        source: 'cloudflare',
                    };
                }
            }
        }

        console.log(`[api/live-status] No active live session found`);
        return buildOfflinePayload(replayId, customerCode);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.error(`[api/live-status] Cloudflare Stream API timeout after ${CLOUDFLARE_FETCH_TIMEOUT_MS}ms liveInputId=${liveInputId}`);
        } else {
            const message = error instanceof Error ? error.message : 'unknown error';
            console.error(`[api/live-status] Cloudflare Stream API request failed: liveInputId=${liveInputId} error=${message}`);
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
