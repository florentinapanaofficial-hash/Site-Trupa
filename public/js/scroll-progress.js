(() => {
    const root = document.documentElement;
    let ticking = false;
    let scrollableHeight = 0;

    const cacheHeight = () => {
        scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    };

    const updateScrollProgress = () => {
        const progress = scrollableHeight > 0 ? Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1) : 0;
        root.style.setProperty('--scroll-progress', progress.toFixed(4));
    };

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            updateScrollProgress();
            ticking = false;
        });
    };

    cacheHeight();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { cacheHeight(); updateScrollProgress(); });
    updateScrollProgress();
})();
