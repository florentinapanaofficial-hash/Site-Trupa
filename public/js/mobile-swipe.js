/* Mobil swipe/scroll controller — rulează pe ≤1024px (telefon + tabletă)
   Sincronizat cu CSS-ul săgeților din globals.css @media (max-width: 1024px). */
(function () {
    if (!window.matchMedia('(max-width: 1024px)').matches) return;

    /* Debounce util — execută fn o singură dată, la `ms` după ultimul apel */
    function debounce(fn, ms) {
        var t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

    function shouldSkipGlobalTouch(target) {
        if (!target || !target.closest) return false;
        if (document.body.classList.contains('mobile-menu-open')) return true;
        return Boolean(
            target.closest('#top-menu-panel') ||
            target.closest('[data-top-menu-panel]') ||
            target.closest('[data-top-menu-toggle]') ||
            target.closest('[data-top-menu-close]') ||
            target.closest('.mob-nav') ||
            target.closest('.mc-gallery') ||
            target.closest('.mc-gallery-wrap') ||
            target.closest('.gal-masonry') ||
            target.closest('.community-gallery-grid') ||
            target.closest('[data-lightbox-src]') ||
            target.closest('#gal-lightbox') ||
            target.closest('.photo-lightbox') ||
            target.closest('.chero-grid') ||
            target.closest('#gallery-popup') ||
            target.closest('.response-scroll-shell') ||
            target.closest('.response-video-grid') ||
            target.closest('.response-repertoire-list')
        );
    }

    var main = document.getElementById('continut');
    if (!main) return;

    /* ── Previne restaurarea scroll-ului orizontal de către browser la refresh.
         Fără asta, scroll-snap + scrollLeft restaurat poate sări la alt slide
         și declanșa navigare pe altă pagină. ── */
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    requestAnimationFrame(function () { main.scrollLeft = 0; });

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
    if (!slides.length) {
        /* Unele pagini (ex: /membri/) au secțiunile într-un wrapper intern,
           nu direct copil în #continut. Fallback-ul menține navigarea cu aripi activă. */
        slides = Array.from(main.querySelectorAll('section'));
    }
    if (!slides.length) {
        slides = [main];
    }

    var navBtns = Array.from(document.querySelectorAll('[data-mb]'));
    var arrowPrev = document.getElementById('mob-arrow-prev');
    var arrowNext = document.getElementById('mob-arrow-next');
    var hintsContainer = document.querySelector('.mob-swipe-hints');
    var canShowPrevArrow = false;
    var canShowNextArrow = false;
    var arrowVisibilityTicking = false;
    var n = slides.length;
    var current = 0;

    function isLowerPageReached() {
        var scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        // Pentru pagini foarte scurte, ascundem complet săgețile.
        // Altfel ar rămâne permanent vizibile, deși nu există scroll util.
        if (scrollableHeight <= 120) return false;
        var progress = (window.scrollY || window.pageYOffset) / scrollableHeight;
        return progress >= 0.8;
    }

    function applyArrowVisibilityByScroll() {
        var showByScroll = isLowerPageReached();

        if (arrowPrev) {
            if (canShowPrevArrow && showByScroll) arrowPrev.classList.remove('is-hidden');
            else arrowPrev.classList.add('is-hidden');
        }

        if (arrowNext) {
            if (canShowNextArrow && showByScroll) arrowNext.classList.remove('is-hidden');
            else arrowNext.classList.add('is-hidden');
        }
    }

    function requestArrowVisibilityUpdate() {
        if (arrowVisibilityTicking) return;
        arrowVisibilityTicking = true;
        requestAnimationFrame(function () {
            applyArrowVisibilityByScroll();
            arrowVisibilityTicking = false;
        });
    }

    function setArrowEligibility(prevEligible, nextEligible) {
        canShowPrevArrow = !!prevEligible;
        canShowNextArrow = !!nextEligible;
        applyArrowVisibilityByScroll();
    }

    window.addEventListener('scroll', requestArrowVisibilityUpdate, { passive: true });
    window.addEventListener('resize', requestArrowVisibilityUpdate, { passive: true });

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
            if (shouldSkipGlobalTouch(e.target)) {
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
            if (dy > 24 && dy < 150) {
                var ind = createIndicator();
                ind.style.transform = 'translateX(-50%) translateY(' + Math.min(dy * 0.4, 40) + 'px)';
                ind.textContent = dy > 72 ? '↓ Eliberează pentru refresh' : '↓ Trage pentru refresh';
            }
        }, { passive: true });

        function ptrEnd(e) {
            if (!ptrActive) return;
            ptrActive = false;
            var endY = (e.changedTouches && e.changedTouches.length)
                ? e.changedTouches[0].clientY
                : ptrLastY;
            var dy = endY - ptrStartY;
            if (dy > 72) {
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
        'video': '/galerie-video/',
        'galerie': '/galerie-foto/',
        'membri': '/membri/',
        'about': '/despre/',
        'despre': '/despre/',
        'contact': '/contact/',
        'momente-cu-mirii': '/momente-cu-mirii/',
        'comunitate': '/comunitate/',
        'comunitatea': '/comunitate/',
        'aparitii-tv': '/aparitii-tv/',
        'aparitii': '/aparitii-tv/',
        'galerie-foto': '/galerie-foto/',
        'galerie-video': '/galerie-video/',
    };

    /* Ordinea oficială de swipe — corespunde EXACT cu meniul mobil
       (mobileNavAllItems din BaseLayout.astro). */
    var SITE_PAGE_ORDER = [
        '/',
        '/cauti-formatie-nunta/',
        '/despre/',
        '/povestea-noastra/',
        '/membri/',
        '/galerie-video/',
        '/galerie-foto/',
        '/muzica-non-stop/',
        '/comunitate/',
        '/blog/',
        '/vlog/',
        '/aparitii-tv/',
        '/live/',
        '/contact/',
    ];

    /* Normalizează path-ul curent astfel încât să găsească match în SITE_PAGE_ORDER */
    function normalizePath(p) {
        if (!p) return '/';
        if (p === '/') return '/';
        return p.endsWith('/') ? p : p + '/';
    }

    /* Cache cu pozițiile butoanelor din navbar — populat o singură dată
       la init și la resize, NU la fiecare scroll/touch. */
    var cachedNavBtnPositions = {};
    var cachedNavEl = null;
    var cachedNavWidth = 0;

    function cacheNavBtnPositions() {
        cachedNavEl = document.querySelector('.mob-nav');
        cachedNavWidth = cachedNavEl ? cachedNavEl.offsetWidth : 0;
        navBtns.forEach(function (btn) {
            var href = btn.getAttribute('data-mb') || '';
            cachedNavBtnPositions[href] = {
                left: btn.offsetLeft,
                width: btn.offsetWidth
            };
        });
    }

    /* Prima citire — într-un rAF separat, ÎNAINTE de orice scriere DOM */
    requestAnimationFrame(cacheNavBtnPositions);
    window.addEventListener('resize', debounce(function () {
        requestAnimationFrame(cacheNavBtnPositions);
    }, 200), { passive: true });

    function setActiveHref(activeHref) {
        /* SCRIERE DOM — nu citim nimic din layout aici */
        navBtns.forEach(function (btn) {
            var href = btn.getAttribute('data-mb') || '';
            btn.classList.toggle('is-active', href === activeHref);
        });

        /* Scroll navbar la butonul activ — folosim CACHE-ul, fără forced reflow */
        var pos = cachedNavBtnPositions[activeHref];
        if (pos && cachedNavEl) {
            cachedNavEl.scrollTo({
                left: pos.left - (cachedNavWidth / 2) + (pos.width / 2),
                behavior: 'smooth'
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
        /* cacheOffsets se declanșează DOAR la resize (debounced), nu la scroll */
        window.addEventListener('resize', debounce(function () {
            requestAnimationFrame(cacheOffsets);
        }, 250), { passive: true });

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

        var hpPageOrder = SITE_PAGE_ORDER.slice();
        var hpCurrentPath = normalizePath(location.pathname);
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
            if (Math.abs(dx) < 34) return;
            if (Math.abs(dy) > Math.abs(dx) * 1.35) return;
            if (dx < 0 && hpPageIdx < hpPageOrder.length - 1) {
                hpNavigatePage(hpPageOrder[hpPageIdx + 1]);
            } else if (dx > 0 && hpPageIdx > 0) {
                hpNavigatePage(hpPageOrder[hpPageIdx - 1]);
            }
        }

        document.addEventListener('touchstart', function (e) {
            if (shouldSkipGlobalTouch(e.target)) {
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

        document.addEventListener('touchcancel', function () {
            hpSkipTouch = false;
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
        setArrowEligibility(false, hpPageIdx >= 0 && hpPageIdx < hpPageOrder.length - 1);

        if (arrowNext && hpPageIdx >= 0 && hpPageIdx < hpPageOrder.length - 1) {
            arrowNext.classList.add('hint-pulse');
            arrowNext.addEventListener('click', function () {
                hpNavigatePage(hpPageOrder[hpPageIdx + 1]);
            });
        }

        return;
    }

    /* ══════════════════════════════════════════════════════════════
       SUBPAGINI — layout vertical, swipe orizontal navighează
       la pagina anterioară/următoare (fără slides, fără scroll-snap).
    ══════════════════════════════════════════════════════════════ */
    var pageOrder = SITE_PAGE_ORDER.slice();
    var currentPath = normalizePath(location.pathname);
    var pageIdx = pageOrder.indexOf(currentPath);

    /* Marchează butonul activ din navbar */
    setActiveHref(currentPath);

    function navigatePage(url) {
        main.style.transition = 'opacity 0.18s ease';
        main.style.opacity = '0';
        setTimeout(function () { window.location.href = url; }, 180);
    }

    /* ── Săgeți laterale pe subpagini ── */
    setArrowEligibility(pageIdx > 0, pageIdx >= 0 && pageIdx < pageOrder.length - 1);

    if (arrowPrev) {
        if (pageIdx > 0) {
            arrowPrev.classList.add('hint-pulse');
            arrowPrev.addEventListener('click', function () {
                navigatePage(pageOrder[pageIdx - 1]);
            });
        }
    }
    if (arrowNext) {
        if (pageIdx >= 0 && pageIdx < pageOrder.length - 1) {
            arrowNext.classList.add('hint-pulse');
            arrowNext.addEventListener('click', function () {
                navigatePage(pageOrder[pageIdx + 1]);
            });
        }
    }

    /* Detectare swipe orizontal simplu — dx > threshold → navigare */
    var tStartX = 0, tStartY = 0, tSkipSwipe = false;

    document.addEventListener('touchstart', function (e) {
        if (shouldSkipGlobalTouch(e.target)) {
            tSkipSwipe = true; return;
        }
        tSkipSwipe = false;
        tStartX = e.touches[0].clientX;
        tStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (tSkipSwipe) { tSkipSwipe = false; return; }
        var dx = e.changedTouches[0].clientX - tStartX;
        var dy = e.changedTouches[0].clientY - tStartY;
        if (Math.abs(dx) < 34 || Math.abs(dy) > Math.abs(dx) * 1.35) return;
        if (dx < 0 && pageIdx !== -1 && pageIdx < pageOrder.length - 1) {
            navigatePage(pageOrder[pageIdx + 1]);
        } else if (dx > 0 && pageIdx > 0) {
            navigatePage(pageOrder[pageIdx - 1]);
        }
    }, { passive: true });

    document.addEventListener('touchcancel', function () {
        tSkipSwipe = false;
    }, { passive: true });
})();
