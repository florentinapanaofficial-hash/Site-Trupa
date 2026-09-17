/*
 * FPTracking — încarcă GA4, Meta Pixel și TikTok Pixel DOAR după consimțământul GDPR
 * (localStorage.cookie_consent === 'granted') și retrimite PageView la fiecare navigare
 * client-side (Astro View Transitions), fără dublă încărcare a scripturilor.
 *
 * Folosire:
 *   window.FPTracking.init({ ga4Id, metaPixelId, tiktokPixelId }) — apelat din CookieBanner
 *   la accept, și automat pe 'astro:page-load' dacă exista deja consimțământ.
 */
(function () {
    var STORAGE_KEY = 'cookie_consent';
    var loaded = { ga4: false, meta: false, tiktok: false };

    function hasConsent() {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'granted';
        } catch (_) {
            return false;
        }
    }

    function loadGA4(id) {
        if (loaded.ga4 || !id) return;
        loaded.ga4 = true;
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
        document.head.appendChild(s);
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        // send_page_view:false — page_view-ul se trimite unificat din trackPageView()
        window.gtag('config', id, { send_page_view: false });
    }

    function loadMetaPixel(id) {
        if (loaded.meta || !id) return;
        loaded.meta = true;
        (function (f, b, e, v) {
            if (f.fbq) return;
            var n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
            var t = b.createElement(e); t.async = true; t.src = v;
            var s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        window.fbq('init', id);
        // fără fbq('track','PageView') aici — trimis unificat din trackPageView()
    }

    function loadTikTokPixel(id) {
        if (loaded.tiktok || !id) return;
        loaded.tiktok = true;
        (function (w, d, t) {
            w.TiktokAnalyticsObject = t;
            var ttq = w[t] = w[t] || [];
            ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
            ttq.setAndDefer = function (target, method) {
                target[method] = function () {
                    target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
                };
            };
            for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
            ttq.load = function (pixelId) {
                var url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
                ttq._i = ttq._i || {};
                ttq._i[pixelId] = [];
                ttq._i[pixelId]._u = url;
                ttq._t = ttq._t || {};
                ttq._t[pixelId] = +new Date();
                var script = d.createElement('script');
                script.type = 'text/javascript';
                script.async = true;
                script.src = url + '?sdkid=' + pixelId + '&lib=' + t;
                var first = d.getElementsByTagName('script')[0];
                first.parentNode.insertBefore(script, first);
            };
            ttq.load(id);
            // fără ttq.page() aici — trimis unificat din trackPageView()
        })(window, document, 'ttq');
    }

    function trackPageView() {
        if (loaded.ga4 && window.gtag) {
            window.gtag('event', 'page_view', {
                page_path: location.pathname + location.search,
                page_location: location.href,
            });
        }
        if (loaded.meta && window.fbq) window.fbq('track', 'PageView');
        if (loaded.tiktok && window.ttq) window.ttq.page();
    }

    function init(ids) {
        ids = ids || {};
        if (!hasConsent()) return;
        if (ids.ga4Id) loadGA4(ids.ga4Id);
        if (ids.metaPixelId) loadMetaPixel(ids.metaPixelId);
        if (ids.tiktokPixelId) loadTikTokPixel(ids.tiktokPixelId);
        trackPageView();
    }

    window.FPTracking = { init: init, trackPageView: trackPageView, hasConsent: hasConsent };

    // Re-declanșează PageView la fiecare navigare client-side (View Transitions),
    // inclusiv la încărcarea inițială a paginii — evită dubla numărare la bootstrap.
    document.addEventListener('astro:page-load', function () {
        if (!hasConsent()) return;
        if (!loaded.ga4 && !loaded.meta && !loaded.tiktok) {
            init(window.__FP_TRACKING_IDS__);
        } else {
            trackPageView();
        }
    });
})();
