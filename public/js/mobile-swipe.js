/* Mobil swipe/scroll controller — rulează pe ≤1023px (telefon + tabletă) */
(function () {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;

    var main = document.getElementById('continut');
    if (!main) return;

    var slides = Array.from(main.querySelectorAll(':scope > section'));
    if (!slides.length) return;

    var navBtns = Array.from(document.querySelectorAll('[data-mb]'));
    var arrowPrev = document.getElementById('mob-arrow-prev');
    var arrowNext = document.getElementById('mob-arrow-next');
    var n = slides.length;
    var current = 0;

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
            var nav = document.querySelector('.mob-nav');
            if (nav) {
                var btnLeft = activeBtn.offsetLeft;
                var btnWidth = activeBtn.offsetWidth;
                var navWidth = nav.offsetWidth;
                nav.scrollTo({ left: btnLeft - (navWidth / 2) + (btnWidth / 2), behavior: 'smooth' });
            }
        }
    }

    if (isHomepage) {
        setActiveHref('/');

        function updateActiveSection() {
            var navEl = document.querySelector('.mob-nav');
            var navH = navEl ? navEl.offsetHeight : 44;
            var scrollY = window.scrollY || window.pageYOffset;
            var threshold = scrollY + navH + (window.innerHeight - navH) * 0.35;
            var active = null;
            slides.forEach(function (s) {
                if (s.offsetTop <= threshold) active = s;
            });
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

        updateActiveSection();

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
                    var navEl = document.querySelector('.mob-nav');
                    var navH = navEl ? navEl.offsetHeight : 44;
                    var top = sec.getBoundingClientRect().top + window.pageYOffset - navH;
                    window.scrollTo({ top: top, behavior: 'smooth' });
                }
            });
        });

        var hpPageOrder = [
            '/',
            '/galerie-video',
            '/galerie-foto',
            '/despre',
            '/contact',
            '/momente-cu-mirii',
            '/comunitatea-noastra',
            '/aparitii-tv',
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
            if (e.target.closest && e.target.closest('.mob-nav')) {
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

        return;
    }

    var n2 = slides.length;

    var pageOrder = [
        '/',
        '/galerie-video',
        '/galerie-foto',
        '/despre',
        '/contact',
        '/momente-cu-mirii',
        '/comunitatea-noastra',
        '/aparitii-tv',
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

    function slideWidth() { return main.clientWidth || window.innerWidth; }

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

    function lockVertical() {
        if (tLocked) return;
        tLocked = true;
        var sec = slides[current];
        if (sec) sec.style.overflowY = 'hidden';
    }

    function unlockVertical() {
        if (!tLocked) return;
        tLocked = false;
        var sec = slides[current];
        if (sec) sec.style.overflowY = '';
    }

    function onTouchStart(e) {
        if (e.target.closest && e.target.closest('.mob-nav')) {
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
        var threshold = 45;
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

    window.addEventListener('resize', function () {
        requestAnimationFrame(function () {
            main.scrollLeft = current * slideWidth();
            repaintSwipe();
        });
    }, { passive: true });

    requestAnimationFrame(function () {
        repaintSwipe();
        if (arrowNext && !arrowNext.classList.contains('is-hidden')) {
            arrowNext.classList.add('hint-pulse');
            arrowNext.addEventListener('animationend', function () {
                arrowNext.classList.remove('hint-pulse');
            }, { once: true });
        }
    });
})();
