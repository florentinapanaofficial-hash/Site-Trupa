/*
 * FPTracking — încarcă GTM, GA4, Meta Pixel și TikTok Pixel DOAR după consimțământul GDPR,
 * separat pe categorii (localStorage.fp_consent = { analytics, marketing }).
 *
 * Categoriile sunt scrise exclusiv de window.FPConsent (definit în <head>, BaseLayout),
 * împreună cu semnalele Google Consent Mode v2. Cheia `video_consent` aparține embed-urilor
 * video și NU este citită aici — un click pe „play" nu pornește niciun pixel.
 *
 * GTM este sursa unică de adevăr: toate evenimentele pleacă prin dataLayer
 * (fp_page_view, fp_interaction, fp_conversion), iar tagurile din container se leagă
 * de aceste Custom Events. Nu se mai folosește window.gtag pentru evenimente de click.
 *
 * Folosire:
 *   window.FPTracking.init({ gtmId, ga4Id, metaPixelId, tiktokPixelId }) — apelat din CookieBanner
 *   la accept și la încărcarea paginii dacă există deja consimțământ.
 */
(function () {
    var STORAGE_KEY = 'fp_consent';
    // Răgaz pentru plecarea beacon-ului înainte ca tel:/WhatsApp să scoată utilizatorul din pagină.
    var NAV_DELAY_MS = 300;
    var WHATSAPP_URL = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//i;
    var DENIED = { analytics: false, marketing: false };
    var loaded = { gtm: false, ga4: false, meta: false, tiktok: false };
    var delegatedBound = false;

    function getConsent() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return DENIED;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return DENIED;
            return { analytics: parsed.analytics === true, marketing: parsed.marketing === true };
        } catch (_) {
            return DENIED;
        }
    }

    // Containerul GTM se încarcă dacă măcar o categorie non-esențială e aprobată;
    // ce taguri pornesc în interior rămâne decis de semnalele Consent Mode v2.
    function hasConsent() {
        var consent = getConsent();
        return consent.analytics || consent.marketing;
    }

    function loadGTM(id) {
        if (loaded.gtm || !id) return;
        loaded.gtm = true;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtm.js?id=' + id;
        document.head.appendChild(s);
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
        if (!hasConsent()) return;
        if (loaded.gtm) {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: 'fp_page_view',
                page_path: location.pathname + location.search,
                page_location: location.href,
                page_title: document.title,
            });
        }
        if (loaded.ga4 && window.gtag) {
            window.gtag('event', 'page_view', {
                page_path: location.pathname + location.search,
                page_location: location.href,
            });
        }
        if (loaded.meta && window.fbq) window.fbq('track', 'PageView');
        if (loaded.tiktok && window.ttq) window.ttq.page();
    }

    function trackInteraction(action, label) {
        if (!action || !hasConsent()) return;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'fp_interaction', action: action, label: label || 'unknown' });
    }

    /** Traduce un <a> în perechea acțiune/etichetă, sau null dacă nu ne interesează. */
    function resolveInteraction(link) {
        var href = link.getAttribute('href') || '';
        var classes = typeof link.className === 'string' ? link.className : '';
        var action;

        if (href.indexOf('tel:') === 0) action = 'click_phone';
        else if (WHATSAPP_URL.test(href)) action = 'click_whatsapp';
        else if (classes.indexOf('quick-dock-btn--offer') !== -1) action = 'click_offer';
        else return null;

        var label = link.getAttribute('data-fp-label');
        if (!label) {
            if (classes.indexOf('wa-float') !== -1) label = 'floating-whatsapp';
            else if (classes.indexOf('quick-dock-btn') !== -1) label = 'quick-dock';
            else label = 'inline-link';
        }

        return { action: action, label: label, href: href };
    }

    function bindDelegatedClicks() {
        if (delegatedBound) return;
        var root = document.body || document;
        if (!root || !root.addEventListener) return;
        delegatedBound = true;

        root.addEventListener('click', function (event) {
            if (event.defaultPrevented) return;
            if (event.button) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            var target = event.target;
            if (!target || typeof target.closest !== 'function') return;
            var link = target.closest('a[href]');
            // data-fp-manual = elementul își trimite singur evenimentul din onclick.
            if (!link || link.hasAttribute('data-fp-manual')) return;

            var info = resolveInteraction(link);
            if (!info || !hasConsent()) return;
            trackInteraction(info.action, info.label);

            // Doar schemele validate mai sus ajung în window.location — niciun href arbitrar.
            var leavesPage = info.href.indexOf('tel:') === 0 || WHATSAPP_URL.test(info.href);
            if (!leavesPage || link.getAttribute('target') === '_blank') return;

            event.preventDefault();
            window.setTimeout(function () { window.location.href = info.href; }, NAV_DELAY_MS);
        });
    }

    function init(ids) {
        ids = ids || {};
        var consent = getConsent();
        if (!consent.analytics && !consent.marketing) return;
        if (ids.gtmId) loadGTM(ids.gtmId);
        if (consent.analytics && ids.ga4Id) loadGA4(ids.ga4Id);
        if (consent.marketing && ids.metaPixelId) loadMetaPixel(ids.metaPixelId);
        if (consent.marketing && ids.tiktokPixelId) loadTikTokPixel(ids.tiktokPixelId);
        trackPageView();
    }

    window.FPTracking = {
        init: init,
        trackPageView: trackPageView,
        trackInteraction: trackInteraction,
        hasConsent: hasConsent,
        getConsent: getConsent,
    };

    bindDelegatedClicks();
})();
