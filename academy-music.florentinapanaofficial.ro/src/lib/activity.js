import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

const HEARTBEAT_MS = 60_000;
const STORAGE_KEY = 'academy-music-activity-session';

let sessionId = null;
let timer = null;
let accessToken = null;
let listenersBound = false;

export function setActivityToken(token) {
    accessToken = token;
}

async function touch() {
    if (!sessionId) return;
    await supabase.rpc('touch_activity_session', { p_session: sessionId });
}

/**
 * La închiderea tabului un `fetch` obișnuit e anulat. `keepalive` ține cererea în viață,
 * iar `sendBeacon` nu poate fi folosit fiindcă nu acceptă anteturi de autorizare.
 */
function flushOnUnload() {
    if (!sessionId || !accessToken) return;
    try {
        fetch(`${SUPABASE_URL}/rest/v1/rpc/touch_activity_session`, {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ p_session: sessionId }),
        });
    } catch {
        /* la unload nu avem unde raporta eroarea */
    }
}

function handleVisibility() {
    if (document.hidden) {
        stopHeartbeat();
        touch().catch(() => { });
    } else if (sessionId && !timer) {
        timer = window.setInterval(() => touch().catch(() => { }), HEARTBEAT_MS);
    }
}

function bindListeners() {
    if (listenersBound) return;
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', flushOnUnload);
    listenersBound = true;
}

function unbindListeners() {
    if (!listenersBound) return;
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pagehide', flushOnUnload);
    listenersBound = false;
}

function stopHeartbeat() {
    if (timer) {
        window.clearInterval(timer);
        timer = null;
    }
}

export async function startActivitySession() {
    if (sessionId) return sessionId;

    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) {
        sessionId = existing;
    } else {
        const { data, error } = await supabase.rpc('start_activity_session', {
            p_user_agent: navigator.userAgent,
        });
        if (error) return null;
        sessionId = data;
        sessionStorage.setItem(STORAGE_KEY, sessionId);
    }

    bindListeners();
    stopHeartbeat();
    timer = window.setInterval(() => touch().catch(() => { }), HEARTBEAT_MS);
    return sessionId;
}

export async function endActivitySession() {
    stopHeartbeat();
    unbindListeners();
    await touch().catch(() => { });
    sessionId = null;
    sessionStorage.removeItem(STORAGE_KEY);
}

export async function logEvent(userId, eventType, path, metadata = {}) {
    if (!userId) return;
    await supabase
        .from('activity_events')
        .insert({
            user_id: userId,
            session_id: sessionId,
            event_type: eventType,
            path,
            metadata,
        })
        .then(
            () => { },
            () => { }
        );
}

export function formatDuration(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
