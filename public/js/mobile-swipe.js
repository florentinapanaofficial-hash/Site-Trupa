/* Mobil swipe/scroll controller — rulează pe ≤767px (telefon) */
(function () {
    if (!window.matchMedia('(max-width: 767px)').matches) return;

    /* Debounce util — execută fn o singură dată, la `ms` după ultimul apel */
    function debounce(fn, ms) {
        var t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

    var main = document.getElementById('continut');
    if (!main) return;

    /* ── Previne restaurarea scroll-ului orizontal de către browser la refresh.
         Fără asta, scroll-snap + scrollLeft restaurat poate sări la alt slide
         și declanșa navigare pe altă pagină. ── */
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    main.scrollLeft = 0;

    /* ── bfcache fix: când browser-ul restaurează pagina din back-forward cache,
         inline styles (opacity:0, transition) sunt păstrate → conținut invizibil.
         pageshow.persisted === true indică restaurare din bfcache. ── */
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            main.style.opacity = '';
            main.style.transition = '';
        }
    });

    var slides = Array.from(main.querySelectorAll(':scope > section'));
    if (!slides.length) return;

    var navBtns = Array.from(document.querySelectorAll('[data-mb]'));
    var arrowPrev = document.getElementById('mob-arrow-prev');
    var arrowNext = document.getElementById('mob-arrow-next');
    var hintsContainer = document.querySelector('.mob-swipe-hints');
    var n = slides.length;
    var current = 0;

    /* Ascunde săgețile dacă sliderul are un singur element */
    if (n <= 1 && hintsContainer) {
        hintsContainer.classList.add('single-slide');
    }

    /* ═══ Pull-to-refresh universal — rulează pe TOATE paginile ═══
       overscroll-behavior-y:none blochează PTR nativ al browserului,
       deci implementăm manual: la scrollTop ≈ 0, trage >90px în jos → reload.
       Ascultăm și touchcancel (touch-action:pan-y face browserul
       să preia gestul vertical și să nu mai emită touchend). */
    (function initPTR() {
        var ptrStartY = 0;
        var ptrLastY = 0;
        var ptrActive = false;
        var ptrIndicator = null;

        function isAtTop() {
            if ((window.scrollY || window.pageYOffset) > 5) return false;
            var sec = slides[current];
            if (sec && sec.scrollTop > 5) return false;
            return true;
        }

        function createIndicator() {
            if (ptrIndicator) return ptrIndicator;
            ptrIndicator = document.createElement('div');
            ptrIndicator.setAttribute('aria-hidden', 'true');
            ptrIndicator.style.cssText =
                'position:fixed;top:0;left:50%;transform:translateX(-50%) translateY(-60px);' +
                'z-index:9999;padding:8px 18px;border-radius:0 0 12px 12px;' +
                'background:rgba(0,200,255,0.15);backdrop-filter:blur(8px);' +
                'color:rgba(0,220,255,0.9);font-size:12px;font-weight:600;' +
                'letter-spacing:0.05em;pointer-events:none;transition:transform 0.25s ease;';
            ptrIndicator.textContent = '↓ Trage pentru refresh';
            document.body.appendChild(ptrIndicator);
            return ptrIndicator;
        }

        document.addEventListener('touchstart', function (e) {
            if (e.target.closest && (e.target.closest('.mob-nav') || e.target.closest('.mc-gallery'))) {
                ptrActive = false; return;
            }
            if (!isAtTop()) { ptrActive = false; return; }
            ptrStartY = e.touches[0].clientY;
            ptrLastY = ptrStartY;
            ptrActive = true;
        }, { passive: true });

        document.addEventListener('touchmove', function (e) {
            if (!ptrActive) return;
            ptrLastY = e.touches[0].clientY;
            var dy = ptrLastY - ptrStartY;
            if (dy > 30 && dy < 150) {
                var ind = createIndicator();
                ind.style.transform = 'translateX(-50%) translateY(' + Math.min(dy * 0.4, 40) + 'px)';
                ind.textContent = dy > 90 ? '↓ Eliberează pentru refresh' : '↓ Trage pentru refresh';
            }
        }, { passive: true });

        function ptrEnd(e) {
            if (!ptrActive) return;
            ptrActive = false;
            var endY = (e.changedTouches && e.changedTouches.length)
                ? e.changedTouches[0].clientY
                : ptrLastY;
            var dy = endY - ptrStartY;
            if (dy > 90) {
                if (ptrIndicator) ptrIndicator.textContent = '⟳ Se reîncarcă…';
                location.reload();
            } else if (ptrIndicator) {
                ptrIndicator.style.transform = 'translateX(-50%) translateY(-60px)';
            }
        }

        document.addEventListener('touchend', ptrEnd, { passive: true });
        document.addEventListener('touchcancel', ptrEnd, { passive: true });
    })();

    var isHomepage = document.body.classList.contains('is-homepage');

    var sectionToNav = {
        'acasa': '/',
        'video': '/galerie-video',
        'galerie': '/galerie-foto',
        'membri': '/membri',
        'about': '/despre',
        'despre': '/despre',
        'contact': '/contact',
        'momente-cu-mirii': '/momente-cu-mirii',
        'comunitate': '/comunitatea-noastra',
        'comunitatea': '/comunitatea-noastra',
        'aparitii-tv': '/aparitii-tv',
        'aparitii': '/aparitii-tv',
        'galerie-foto': '/galerie-foto',
        'galerie-video': '/galerie-video',
    };

    function setActiveHref(activeHref) {
        navBtns.forEach(function (btn) {
            var href = btn.getAttribute('data-mb') || '';
            btn.classList.toggle('is-active', href === activeHref);
        });

        var activeBtn = navBtns.find(function (b) {
            return b.getAttribute('data-mb') === activeHref;
        });
        if (activeBtn) {
            requestAnimationFrame(function () {
                var nav = document.querySelector('.mob-nav');
                if (nav) {
                    var btnLeft = activeBtn.offsetLeft;
                    var btnWidth = activeBtn.offsetWidth;
                    var navWidth = nav.offsetWidth;
                    nav.scrollTo({ left: btnLeft - (navWidth / 2) + (btnWidth / 2), behavior: 'smooth' });
                }
            });
        }
    }

    if (isHomepage) {
        setActiveHref('/');

        var cachedNavH = 44;
        var cachedOffsets = [];

        function cacheOffsets() {
            var navEl = document.querySelector('.mob-nav');
            cachedNavH = navEl ? navEl.offsetHeight : 44;
            cachedOffsets = slides.map(function (s) { return { id: s.id, top: s.offsetTop }; });
        }

        requestAnimationFrame(function () {
            cacheOffsets();
            updateActiveSection();
        });
        window.addEventListener('resize', debounce(function () { requestAnimationFrame(cacheOffsets); }, 200), { passive: true });

        function updateActiveSection() {
            var scrollY = window.scrollY || window.pageYOffset;
            var threshold = scrollY + cachedNavH + (window.innerHeight - cachedNavH) * 0.35;
            var active = null;
            for (var i = 0; i < cachedOffsets.length; i++) {
                if (cachedOffsets[i].top <= threshold) active = cachedOffsets[i];
            }
            if (active) {
                var href = sectionToNav[active.id] || '/';
                setActiveHref(href);
            }
        }

        var hpScrollRaf;
        window.addEventListener('scroll', function () {
            cancelAnimationFrame(hpScrollRaf);
            hpScrollRaf = requestAnimationFrame(updateActiveSection);
        }, { passive: true });

        navBtns.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                var href = btn.getAttribute('data-mb') || '';
                var targetId = null;
                if (href === '/') { targetId = 'acasa'; }
                else if (href.includes('#')) { targetId = href.split('#').pop(); }
                else { return; }
                var sec = targetId ? document.getElementById(targetId) : null;
                if (sec) {
                    e.preventDefault();
                    var top = sec.getBoundingClientRect().top + window.pageYOffset - cachedNavH;
                    window.scrollTo({ top: top, behavior: 'smooth' });
                }
            });
        });

        var hpPageOrder = [
            '/',
            '/despre',
            '/membri',
            '/galerie-video',
            '/galerie-foto',
            '/momente-cu-mirii',
            '/comunitatea-noastra',
            '/aparitii-tv',
            '/contact',
        ];
        var hpCurrentPath = location.pathname.replace(/\/$/, '') || '/';
        var hpPageIdx = hpPageOrder.indexOf(hpCurrentPath);

        function hpNavigatePage(url) {
            main.style.transition = 'opacity 0.18s ease';
            main.style.opacity = '0';
            setTimeout(function () { window.location.href = url; }, 180);
        }

        var hpTX = 0, hpTY = 0, hpSkipTouch = false;

        function hpHandleSwipeEnd(endX, endY) {
            var dx = endX - hpTX;
            var dy = endY - hpTY;
            if (Math.abs(dx) < 50) return;
            if (Math.abs(dy) > Math.abs(dx)) return;
            if (dx < 0 && hpPageIdx < hpPageOrder.length - 1) {
                hpNavigatePage(hpPageOrder[hpPageIdx + 1]);
            } else if (dx > 0 && hpPageIdx > 0) {
                hpNavigatePage(hpPageOrder[hpPageIdx - 1]);
            }
        }

        document.addEventListener('touchstart', function (e) {
            if (e.target.closest && (e.target.closest('.mob-nav') || e.target.closest('.mc-gallery'))) {
                hpSkipTouch = true; return;
            }
            hpSkipTouch = false;
            hpTX = e.touches[0].clientX;
            hpTY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', function (e) {
            if (hpSkipTouch) { hpSkipTouch = false; return; }
            hpHandleSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }, { passive: true });

        var hpMouseDown = false;
        document.addEventListener('mousedown', function (e) {
            hpMouseDown = true;
            hpTX = e.clientX;
            hpTY = e.clientY;
        });
        document.addEventListener('mouseup', function (e) {
            if (!hpMouseDown) return;
            hpMouseDown = false;
            hpHandleSwipeEnd(e.clientX, e.clientY);
        });

        /* ── Săgeți laterale pe homepage ── */
        if (arrowPrev) arrowPrev.classList.add('is-hidden');
        if (arrowNext && hpPageIdx < hpPageOrder.length - 1) {
            arrowNext.classList.remove('is-hidden');
            arrowNext.addEventListener('click', function () {
                hpNavigatePage(hpPageOrder[hpPageIdx + 1]);
            });
        }

        return;
    }

    /* Subpagini: CSS-ul face layout vertical, deci nu există slides
       orizontale. Tratăm pagina ca un singur „slide" — orice swipe
       orizontal navighează direct la pagina anterioară/următoare. */
    var n2 = 1;

    var pageOrder = [
        '/',
        '/despre',
        '/membri',
        '/galerie-video',
        '/galerie-foto',
        '/momente-cu-mirii',
        '/comunitatea-noastra',
        '/aparitii-tv',
        '/contact',
    ];
    var currentPath = location.pathname.replace(/\/$/, '') || '/';
    var pageIdx = pageOrder.indexOf(currentPath);

    function navigatePage(url) {
        main.style.transition = 'opacity 0.18s ease';
        main.style.opacity = '0';
        setTimeout(function () { window.location.href = url; }, 180);
    }

    function repaintSwipe() {
        var pathname = location.pathname.replace(/\/$/, '') || '/';
        setActiveHref(pathname !== '/' ? pathname : '/');

        var hasPrev = current > 0 || pageIdx > 0;
        var hasNext = current < n2 - 1 || (pageIdx !== -1 && pageIdx < pageOrder.length - 1);

        if (arrowPrev) arrowPrev.classList.toggle('is-hidden', !hasPrev);
        if (arrowNext) arrowNext.classList.toggle('is-hidden', !hasNext);
    }

    var cachedSlideW = main.clientWidth || window.innerWidth;
    function slideWidth() { return cachedSlideW; }

    function slideTo(idx) {
        if (idx < 0) {
            if (pageIdx > 0) { navigatePage(pageOrder[pageIdx - 1]); }
            else { main.scrollTo({ left: 0, behavior: 'smooth' }); }
            return;
        }
        if (idx >= n2) {
            if (pageIdx !== -1 && pageIdx < pageOrder.length - 1) {
                navigatePage(pageOrder[pageIdx + 1]);
            } else {
                main.scrollTo({ left: (n2 - 1) * slideWidth(), behavior: 'smooth' });
            }
            return;
        }
        current = idx;
        main.scrollTo({ left: idx * slideWidth(), behavior: 'smooth' });
        repaintSwipe();
    }

    if (arrowPrev) arrowPrev.addEventListener('click', function () { slideTo(current - 1); });
    if (arrowNext) arrowNext.addEventListener('click', function () { slideTo(current + 1); });

    var tStartX = 0, tStartY = 0, tAxis = null, tScrollStart = 0;
    var tLocked = false;

    /* Layout vertical: nu blocăm overflowY pe secțiuni */
    function lockVertical() { }
    function unlockVertical() { }

    function onTouchStart(e) {
        if (e.target.closest && (e.target.closest('.mob-nav') || e.target.closest('.mc-gallery'))) {
            tAxis = 'skip'; return;
        }
        tStartX = e.touches[0].clientX;
        tStartY = e.touches[0].clientY;
        tScrollStart = main.scrollLeft;
        tAxis = null;
    }

    function onTouchMove(e) {
        if (tAxis === 'skip') return;
        if (!e.touches.length) return;
        var dx = e.touches[0].clientX - tStartX;
        var dy = e.touches[0].clientY - tStartY;
        if (!tAxis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            tAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        }
        if (tAxis === 'x') {
            lockVertical();
            e.preventDefault();
            main.scrollLeft = tScrollStart - dx;
        }
    }

    function onTouchEnd(e) {
        if (tAxis === 'skip') { tAxis = null; return; }
        unlockVertical();
        if (tAxis !== 'x') return;
        var dx = e.changedTouches[0].clientX - tStartX;
        var threshold = Math.max(50, window.innerWidth * 0.12);
        if (dx < -threshold) slideTo(current + 1);
        else if (dx > threshold) slideTo(current - 1);
        else slideTo(current);
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    var rafId;
    main.addEventListener('scroll', function () {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(function () {
            var sw = slideWidth();
            var idx = sw > 0 ? Math.round(main.scrollLeft / sw) : 0;
            idx = Math.max(0, Math.min(n2 - 1, idx));
            if (idx !== current) { current = idx; repaintSwipe(); }
        });
    }, { passive: true });

    main.addEventListener('scrollend', function () {
        var sw = slideWidth();
        var idx = sw > 0 ? Math.round(main.scrollLeft / sw) : 0;
        current = Math.max(0, Math.min(n2 - 1, idx));
        repaintSwipe();
    }, { passive: true });

    window.addEventListener('resize', debounce(function () {
        requestAnimationFrame(function () {
            cachedSlideW = main.clientWidth || window.innerWidth;
            main.scrollLeft = current * slideWidth();
            repaintSwipe();
        });
    }, 200), { passive: true });

    requestAnimationFrame(function () {
        repaintSwipe();
        if (arrowNext && !arrowNext.classList.contains('is-hidden')) {
            arrowNext.classList.add('hint-pulse');
            arrowNext.addEventListener('animationend', function () {
                arrowNext.classList.remove('hint-pulse');
            }, { once: true });
        }
    });

    /* PTR vechi eliminat — pull-to-refresh universal e definit mai sus,
       înainte de blocul isHomepage, și rulează pe toate paginile. */
})();
