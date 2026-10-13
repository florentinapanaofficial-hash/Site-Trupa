const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const VIDEO_TYPES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
];

export const MAX_RECORDING_MS = 10 * 60 * 1000;

export function isRecordingSupported() {
    return (
        typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia)
    );
}

export function pickMimeType(withVideo) {
    const candidates = withVideo ? VIDEO_TYPES : AUDIO_TYPES;
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function extensionFor(mimeType) {
    return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

/**
 * Web Audio refuză să citească eșantioanele unei surse cross-origin fără CORS:
 * nodul ar livra tăcere. Încercăm întâi cu `crossOrigin`, iar dacă fișierul nu
 * poate fi citit așa, cădem pe redare simplă — negativul se aude, dar nu intră în mix.
 */
function loadBacking(url) {
    return new Promise((resolve) => {
        const element = new Audio();
        element.crossOrigin = 'anonymous';
        element.preload = 'auto';

        const onReady = () => {
            cleanup();
            resolve({ element, mixable: true });
        };

        const onError = () => {
            cleanup();
            const plain = new Audio();
            plain.preload = 'auto';
            plain.src = url;
            resolve({ element: plain, mixable: false });
        };

        function cleanup() {
            element.removeEventListener('canplaythrough', onReady);
            element.removeEventListener('error', onError);
        }

        element.addEventListener('canplaythrough', onReady, { once: true });
        element.addEventListener('error', onError, { once: true });
        element.src = url;
        element.load();
    });
}

/**
 * Pregătește microfonul (și camera), apoi mixează negativul cu vocea într-un
 * singur flux, ca înregistrarea să conțină ambele chiar dacă elevul poartă căști.
 */
export async function createStudioSession({ withVideo, backingUrl }) {
    const userStream = await navigator.mediaDevices.getUserMedia({
        // Procesarea pentru voce vorbită ar tăia tocmai dinamica muzicală.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const destination = audioCtx.createMediaStreamDestination();
    audioCtx.createMediaStreamSource(userStream).connect(destination);

    let backing = null;
    let backingMixed = false;

    if (backingUrl) {
        const loaded = await loadBacking(backingUrl);
        backing = loaded.element;

        if (loaded.mixable) {
            try {
                const node = audioCtx.createMediaElementSource(backing);
                node.connect(destination);
                node.connect(audioCtx.destination);
                backingMixed = true;
            } catch {
                backingMixed = false;
            }
        }
    }

    const tracks = [...destination.stream.getAudioTracks()];
    if (withVideo) tracks.push(...userStream.getVideoTracks());

    const mimeType = pickMimeType(withVideo);
    const recorder = new MediaRecorder(
        new MediaStream(tracks),
        mimeType ? { mimeType } : undefined
    );

    function stopEverything() {
        if (recorder.state !== 'inactive') recorder.stop();
        userStream.getTracks().forEach((track) => track.stop());
        if (backing) {
            backing.pause();
            backing.removeAttribute('src');
        }
        audioCtx.close().catch(() => { });
    }

    return {
        recorder,
        userStream,
        backing,
        backingMixed,
        mimeType: mimeType || (withVideo ? 'video/webm' : 'audio/webm'),
        stopEverything,
    };
}

export function formatClock(ms) {
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
