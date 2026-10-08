export function mountR2Reels(root: HTMLElement): () => void {
    const abort = new AbortController();
    const options = { signal: abort.signal };
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-reel]'));
    const releases: Array<() => void> = [];
    const byCard = new Map<HTMLElement, () => void>();

    for (const card of cards) {
        const video = card.querySelector<HTMLVideoElement>('[data-reel-video]')!;
        const poster = card.querySelector<HTMLImageElement>('[data-reel-poster]')!;
        const button = card.querySelector<HTMLButtonElement>('[data-reel-play]')!;
        const status = card.querySelector<HTMLElement>('[data-reel-status]')!;
        const track = video.querySelector<HTMLTrackElement>('track');
        let generation = 0;
        let disposed = false;

        const release = () => {
            generation++;
            // Removing src + load cancels transfers and releases the media decoder.
            video.pause();
            if (video.hasAttribute('src')) {
                video.removeAttribute('src');
                track?.removeAttribute('src');
                video.load();
            }
            poster.hidden = false;
            button.hidden = false;
            status.textContent = '';
        };
        releases.push(release);
        byCard.set(card, release);

        button.addEventListener('click', () => {
            if (disposed || document.hidden) return;
            document.dispatchEvent(new CustomEvent('fp:r2-reel-play', { detail: video }));
            const attempt = ++generation;
            button.hidden = true;
            status.textContent = 'Se încarcă momentul live…';
            if (track?.dataset.src) track.src = track.dataset.src;
            video.src = video.dataset.src!;
            video.focus({ preventScroll: true });
            const playback = video.play();
            playback?.catch(() => {
                if (disposed || attempt !== generation) return;
                release();
                status.textContent = 'Redarea nu a pornit. Încearcă din nou sau deschide videoclipul.';
                button.focus({ preventScroll: true });
            });
        }, options);
        video.addEventListener('playing', () => {
            if (disposed || !video.hasAttribute('src')) return;
            poster.hidden = true;
            status.textContent = '';
        }, options);
        video.addEventListener('play', () => {
            if (!video.hasAttribute('src')) return;
            if (document.hidden) {
                release();
                return;
            }
            document.dispatchEvent(new CustomEvent('fp:r2-reel-play', { detail: video }));
        }, options);
        video.addEventListener('error', () => {
            if (!video.hasAttribute('src')) return;
            release();
            status.textContent = 'Clipul nu este disponibil acum. Încearcă din nou.';
        }, options);
        document.addEventListener('fp:r2-reel-play', ((event: CustomEvent<HTMLVideoElement>) => {
            if (event.detail !== video && video.hasAttribute('src')) release();
        }) as EventListener, options);
        abort.signal.addEventListener('abort', () => { disposed = true; }, { once: true });
    }

    // No media URL is assigned by observation: scrolling never downloads video.
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.25) {
                byCard.get(entry.target as HTMLElement)?.();
            }
        }
    }, { threshold: [0, 0.25] });
    // Observe the fixed media frame, not the variable-height description.
    cards.forEach((card) => {
        const frame = card.querySelector<HTMLElement>('figure');
        if (frame) byCard.set(frame, byCard.get(card)!);
        observer?.observe(frame ?? card);
    });

    const releaseAll = () => releases.forEach((release) => release());
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) releaseAll();
    }, options);
    window.addEventListener('pagehide', releaseAll, options);

    return () => {
        abort.abort();
        observer?.disconnect();
        releaseAll();
    };
}
