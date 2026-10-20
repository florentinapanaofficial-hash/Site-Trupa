import { startLiveMonitor } from './liveMonitor.js';

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
export const MAX_RECORDING_MS = 10 * 60 * 1000;
export function isRecordingSupported() {
    return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}
export function pickMimeType(withVideo) { return (withVideo ? VIDEO_TYPES : AUDIO_TYPES).find(type => MediaRecorder.isTypeSupported(type)) || ''; }
export function extensionFor(mimeType) { return mimeType.includes('mp4') ? 'mp4' : 'webm'; }

function loadBacking(url, signal) {
    return new Promise((resolve, reject) => {
        const element = new Audio();
        element.crossOrigin = 'anonymous'; element.preload = 'auto';
        const fail = () => finish(new Error('Negativul nu poate fi inclus în temă. Verifică sursa/CORS sau înregistrează fără negativ.'));
        const abort = () => finish(new DOMException('Anulat', 'AbortError'));
        const ready = () => finish(null);
        const timer = setTimeout(fail, 15000);
        function finish(error) {
            clearTimeout(timer); signal.removeEventListener('abort', abort);
            element.removeEventListener('canplaythrough', ready); element.removeEventListener('error', fail);
            if (error) { element.pause(); element.removeAttribute('src'); element.load(); reject(error); }
            else resolve(element);
        }
        signal.addEventListener('abort', abort, { once: true });
        element.addEventListener('canplaythrough', ready, { once: true }); element.addEventListener('error', fail, { once: true });
        if (signal.aborted) { abort(); return; }
        element.src = url; element.load();
    });
}

export async function createStudioSession({ withVideo, backingUrl, mix = 0.2, signal = new AbortController().signal }) {
    const live = await startLiveMonitor({ signal, mix,
        getUserMedia: constraints => navigator.mediaDevices.getUserMedia({ ...constraints, video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false }),
    });
    let backing = null, backingNode, destination, recorder;
    let stopped = false;
    function stopEverything() {
        if (stopped) return;
        stopped = true;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        if (backing) { backing.pause(); backing.removeAttribute('src'); backing.load(); }
        backingNode?.disconnect(); destination?.disconnect();
        destination?.stream.getTracks().forEach(track => track.stop());
        live.stop(); signal.removeEventListener('abort', stopEverything);
    }
    signal.addEventListener('abort', stopEverything, { once: true });
    try {
        destination = live.context.createMediaStreamDestination(); live.output.connect(destination);
        if (backingUrl) {
            backing = await loadBacking(backingUrl, signal);
            backingNode = live.context.createMediaElementSource(backing);
            backingNode.connect(destination); backingNode.connect(live.context.destination);
        }
        if (signal.aborted) throw new DOMException('Anulat', 'AbortError');
        const tracks = [...destination.stream.getAudioTracks(), ...(withVideo ? live.stream.getVideoTracks() : [])];
        const mimeType = pickMimeType(withVideo);
        recorder = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType } : undefined);
        return { recorder, context: live.context, userStream: live.stream, backing, backingMixed: Boolean(backingNode), setMix: live.setMix, stopEverything, mimeType: mimeType || (withVideo ? 'video/webm' : 'audio/webm') };
    } catch (error) { stopEverything(); throw error; }
}

export function formatClock(ms) {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
