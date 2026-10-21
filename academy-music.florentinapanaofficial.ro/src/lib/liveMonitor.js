export function setReverbMix(dry, wet, value, context) {
    const mix = Math.max(0, Math.min(1, value));
    dry.gain.setTargetAtTime(Math.cos(mix * Math.PI / 2), context.currentTime, 0.02);
    wet.gain.setTargetAtTime(Math.sin(mix * Math.PI / 2), context.currentTime, 0.02);
}

export function createRoomImpulse(context) {
    const length = Math.floor(context.sampleRate * 1.8);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }
    return buffer;
}

export async function startLiveMonitor({ signal, mix = 0.2, createContext = () => new window.AudioContext(), getUserMedia = constraints => navigator.mediaDevices.getUserMedia(constraints) }) {
    const context = createContext();
    let stream;
    const nodes = [];
    let stopped = false;
    function stop() {
        if (stopped) return;
        stopped = true;
        stream?.getTracks().forEach(track => track.stop());
        nodes.forEach(node => node.disconnect());
        if (context.state !== 'closed') void context.close().catch(error => console.error('[Academy] Închiderea audio a eșuat:', error));
        signal.removeEventListener('abort', stop);
    }
    signal.addEventListener('abort', stop, { once: true });
    try {
        if (signal.aborted) throw new DOMException('Anulat', 'AbortError');
        await context.resume();
        if (signal.aborted) throw new DOMException('Anulat', 'AbortError');
        stream = await getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
        if (signal.aborted) {
            stream.getTracks().forEach(track => track.stop());
            throw new DOMException('Anulat', 'AbortError');
        }
        const source = context.createMediaStreamSource(stream);
        const dry = context.createGain(), wet = context.createGain(), convolver = context.createConvolver();
        const output = context.createGain(), limiter = context.createDynamicsCompressor();
        nodes.push(source, dry, wet, convolver, output, limiter);
        convolver.buffer = createRoomImpulse(context);
        output.gain.value = 0.6;
        limiter.threshold.value = -10; limiter.knee.value = 0; limiter.ratio.value = 20;
        limiter.attack.value = 0.003; limiter.release.value = 0.15;
        source.connect(dry).connect(output);
        source.connect(convolver).connect(wet).connect(output);
        output.connect(limiter).connect(context.destination);
        setReverbMix(dry, wet, mix, context);
        return { stream, context, input: source, output: limiter, stop, setMix: value => setReverbMix(dry, wet, value, context) };
    } catch (error) { stop(); throw error; }
}
