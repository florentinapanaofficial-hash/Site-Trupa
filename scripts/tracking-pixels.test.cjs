const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ids = { gtmId: 'GTM-N44548RF' };
const ALL = { analytics: true, marketing: true };

function stored(consent) {
    if (consent === null) return null;
    return JSON.stringify({ ...consent, ts: 1760000000000 });
}

function tracking(consent = ALL, dataLayer = []) {
    const listeners = {};
    const scripts = [];
    const timers = [];
    const localStorage = { getItem: jest.fn(() => stored(consent)) };
    const location = {
        pathname: '/', search: '', href: 'https://www.florentinapanaofficial.ro/',
    };
    const window = {
        dataLayer,
        __FP_TRACKING_IDS__: ids,
        location,
        setTimeout: (run) => { timers.push(run); },
    };
    const document = {
        title: 'Formația Florentina Pană',
        head: { appendChild: (script) => scripts.push(script) },
        createElement: () => ({}),
        addEventListener: (name, handler) => { listeners[name] = handler; },
    };
    const context = vm.createContext({ window, document, location, localStorage, Date, JSON });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/tracking-pixels.js'), 'utf8'), context);
    const setConsent = (next) => localStorage.getItem.mockReturnValue(stored(next));
    return { window, document, location, localStorage, listeners, scripts, timers, setConsent };
}

function anchor(attributes, className = '') {
    const node = {
        className,
        getAttribute: (name) => (name in attributes ? attributes[name] : null),
        hasAttribute: (name) => name in attributes,
    };
    node.closest = (selector) => (selector === 'a[href]' ? node : null);
    return node;
}

function click(app, node) {
    const event = {
        target: node,
        button: 0,
        defaultPrevented: false,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault() { this.defaultPrevented = true; },
    };
    app.listeners.click(event);
    return event;
}

describe('GTM consent and dataLayer routing', () => {
    test.each([null, { analytics: false, marketing: false }])('does not load or track without consent (%p)', (consent) => {
        const app = tracking(consent);
        app.window.FPTracking.init(ids);
        click(app, anchor({ href: 'tel:+40767369658' }, 'quick-dock-btn quick-dock-btn--call'));
        expect(app.scripts).toHaveLength(0);
        expect(app.window.dataLayer).toHaveLength(0);
    });

    test('ignores a video-only consent stored under its own key', () => {
        const app = tracking(null);
        app.localStorage.getItem.mockImplementation((key) => (key === 'video_consent' ? 'granted' : null));
        app.window.FPTracking.init(ids);
        expect(app.scripts).toHaveLength(0);
        expect(app.window.dataLayer).toHaveLength(0);
        expect(app.window.FPTracking.getConsent()).toEqual({ analytics: false, marketing: false });
    });

    test('does not load when localStorage is unavailable or the payload is corrupt', () => {
        const app = tracking();
        app.localStorage.getItem.mockImplementation(() => { throw new Error('Blocked'); });
        app.window.FPTracking.init(ids);
        app.localStorage.getItem.mockReturnValue('{ not json');
        app.window.FPTracking.init(ids);
        expect(app.scripts).toHaveLength(0);
    });

    test('loads the requested container once and preserves existing dataLayer entries', () => {
        const dataLayer = [{ event: 'existing' }];
        const app = tracking(ALL, dataLayer);
        app.window.FPTracking.init(ids);
        app.window.FPTracking.init(ids);
        expect(app.window.dataLayer).toBe(dataLayer);
        expect(dataLayer[0]).toEqual({ event: 'existing' });
        expect(app.scripts).toEqual([{
            async: true, src: 'https://www.googletagmanager.com/gtm.js?id=GTM-N44548RF',
        }]);
        expect(dataLayer.filter((entry) => entry.event === 'gtm.js')).toHaveLength(1);
        expect(dataLayer[1]['gtm.start']).toEqual(expect.any(Number));
    });

    test('records one page view per initialization without reloading GTM', () => {
        const app = tracking();
        app.window.FPTracking.init(ids);
        expect(app.window.dataLayer.filter((entry) => entry.event === 'fp_page_view')).toHaveLength(1);
        Object.assign(app.location, {
            pathname: '/contact/', search: '?source=nav',
            href: 'https://www.florentinapanaofficial.ro/contact/?source=nav',
        });
        app.document.title = 'Contact';
        app.window.FPTracking.init(ids);
        expect(app.scripts).toHaveLength(1);
        expect(app.window.dataLayer.filter((entry) => entry.event === 'fp_page_view')).toHaveLength(2);
        expect(app.window.dataLayer.at(-1)).toEqual({
            event: 'fp_page_view', page_path: '/contact/?source=nav',
            page_location: app.location.href, page_title: 'Contact',
        });
    });

    test('starts after acceptance and stops sending events when consent is withdrawn', () => {
        const app = tracking({ analytics: false, marketing: false });
        app.window.FPTracking.init(ids);
        app.setConsent(ALL);
        app.window.FPTracking.init(ids);
        expect(app.scripts).toHaveLength(1);
        const count = app.window.dataLayer.length;
        app.setConsent({ analytics: false, marketing: false });
        app.window.FPTracking.trackPageView();
        app.window.FPTracking.trackInteraction('click_phone', 'quick-dock');
        expect(app.window.dataLayer).toHaveLength(count);
    });

    test('loads only the vendors approved for each category', () => {
        const full = { ...ids, ga4Id: 'G-TEST', metaPixelId: '123', tiktokPixelId: 'TT1' };

        const analyticsOnly = tracking({ analytics: true, marketing: false });
        analyticsOnly.window.FPTracking.init(full);
        expect(analyticsOnly.scripts.map((script) => script.src)).toEqual([
            'https://www.googletagmanager.com/gtm.js?id=GTM-N44548RF',
            'https://www.googletagmanager.com/gtag/js?id=G-TEST',
        ]);
        expect(analyticsOnly.window.fbq).toBeUndefined();
        expect(analyticsOnly.window.ttq).toBeUndefined();

        const marketingOnly = tracking({ analytics: false, marketing: true });
        marketingOnly.document.getElementsByTagName = () => [{ parentNode: { insertBefore: () => { } } }];
        marketingOnly.document.createElement = () => ({});
        marketingOnly.window.FPTracking.init(full);
        expect(marketingOnly.scripts.map((script) => script.src)).toEqual([
            'https://www.googletagmanager.com/gtm.js?id=GTM-N44548RF',
        ]);
        expect(marketingOnly.window.fbq).toEqual(expect.any(Function));
        expect(marketingOnly.window.ttq).toEqual(expect.any(Array));
    });

    test('preserves direct GA4 configuration and page views', () => {
        const app = tracking();
        app.window.FPTracking.init({ ...ids, ga4Id: 'G-TEST' });
        expect(app.scripts.map((script) => script.src)).toEqual([
            'https://www.googletagmanager.com/gtm.js?id=GTM-N44548RF',
            'https://www.googletagmanager.com/gtag/js?id=G-TEST',
        ]);
        const commands = app.window.dataLayer.filter((entry) => !entry.event).map((entry) => Array.from(entry));
        expect(commands).toContainEqual(['config', 'G-TEST', { send_page_view: false }]);
        expect(commands).toContainEqual(['event', 'page_view', {
            page_path: '/', page_location: app.location.href,
        }]);
    });

    test('routes phone clicks through dataLayer and delays the navigation', () => {
        const app = tracking();
        app.window.FPTracking.init(ids);
        const event = click(app, anchor({ href: 'tel:+40767369658' }, 'quick-dock-btn quick-dock-btn--call'));
        expect(app.window.dataLayer.at(-1)).toEqual({
            event: 'fp_interaction', action: 'click_phone', label: 'quick-dock',
        });
        expect(event.defaultPrevented).toBe(true);
        expect(app.location.href).toBe('https://www.florentinapanaofficial.ro/');
        app.timers.forEach((run) => run());
        expect(app.location.href).toBe('tel:+40767369658');
    });

    test('labels the floating WhatsApp button and leaves new-tab navigation untouched', () => {
        const app = tracking();
        app.window.FPTracking.init(ids);
        const event = click(app, anchor({ href: 'https://wa.me/40767369658', target: '_blank' }, 'wa-float'));
        expect(app.window.dataLayer.at(-1)).toEqual({
            event: 'fp_interaction', action: 'click_whatsapp', label: 'floating-whatsapp',
        });
        expect(event.defaultPrevented).toBe(false);
        expect(app.timers).toHaveLength(0);
    });

    test('tracks the quick dock offer button and ignores unrelated links', () => {
        const app = tracking();
        app.window.FPTracking.init(ids);
        click(app, anchor({ href: '/rezervare/' }, 'quick-dock-btn quick-dock-btn--offer'));
        expect(app.window.dataLayer.at(-1)).toEqual({
            event: 'fp_interaction', action: 'click_offer', label: 'quick-dock',
        });
        const count = app.window.dataLayer.length;
        click(app, anchor({ href: '/despre/' }, 'btn-outline'));
        expect(app.window.dataLayer).toHaveLength(count);
    });

    test('skips elements that already push their own event', () => {
        const app = tracking();
        app.window.FPTracking.init(ids);
        const count = app.window.dataLayer.length;
        click(app, anchor({ href: 'tel:+40767369658', 'data-fp-manual': '1' }, 'btn-solid'));
        expect(app.window.dataLayer).toHaveLength(count);
        expect(app.timers).toHaveLength(0);
    });

    test('the shared layout passes the requested container to the consent-gated runtime', () => {
        const layout = fs.readFileSync(path.join(__dirname, '../src/layouts/BaseLayout.astro'), 'utf8');
        expect(layout).toContain("import.meta.env.PUBLIC_GTM_ID ?? 'GTM-N44548RF'");
        expect(layout).toContain('define:vars={{ gtmId, ga4Id, metaPixelId, tiktokPixelId }}');
        expect(layout).toContain('window.__FP_TRACKING_IDS__ = { gtmId: gtmId,');
        expect(layout).not.toContain('googletagmanager.com/ns.html');
        const banner = fs.readFileSync(path.join(__dirname, '../src/components/CookieBanner.astro'), 'utf8');
        expect(banner).toContain("script.src = '/js/tracking-pixels.js?v=consent-v2';");
        const runtime = fs.readFileSync(path.join(__dirname, '../public/js/tracking-pixels.js'), 'utf8');
        expect(runtime).not.toContain('astro:page-load');
    });

    test('declares Consent Mode v2 defaults before any container can load', () => {
        const layout = fs.readFileSync(path.join(__dirname, '../src/layouts/BaseLayout.astro'), 'utf8');
        const defaults = layout.indexOf("window.gtag('consent', 'default'");
        expect(defaults).toBeGreaterThan(-1);
        expect(defaults).toBeLessThan(layout.indexOf('window.__FP_TRACKING_IDS__'));
        ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'].forEach((signal) => {
            expect(layout).toMatch(new RegExp(signal + ": 'denied'"));
        });
        expect(layout).toContain("window.gtag('consent', 'update', signals(prefs))");
    });

    test('keeps video consent on a dedicated key across every embed surface', () => {
        const sources = [
            '../public/js/video-facade.js',
            '../src/components/YoutubeEmbed.astro',
            '../src/components/SmartTvVideoPlayer.astro',
            '../src/pages/aparitii-tv.astro',
            '../src/pages/shorts.astro',
        ].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8'));

        sources.forEach((source) => {
            expect(source).toContain('video_consent');
            expect(source).not.toContain("'cookie_consent'");
            expect(source).not.toContain("CustomEvent('cookie:granted')");
        });

        const runtime = fs.readFileSync(path.join(__dirname, '../public/js/tracking-pixels.js'), 'utf8');
        expect(runtime).toContain("var STORAGE_KEY = 'fp_consent';");
        expect(runtime).not.toMatch(/getItem\(\s*['"]video_consent['"]\s*\)/);
    });

    test('the banner exposes a separate switch for every purpose', () => {
        const banner = fs.readFileSync(path.join(__dirname, '../src/components/CookieBanner.astro'), 'utf8');
        ['cookie-cat-analytics', 'cookie-cat-marketing', 'cookie-cat-video', 'cookie-prefs-toggle', 'cookie-save']
            .forEach((id) => expect(banner).toContain(id));
        expect(banner).toContain("apply({ analytics: false, marketing: false, video: false })");
        const footer = fs.readFileSync(path.join(__dirname, '../src/components/Footer.astro'), 'utf8');
        expect(footer).toContain("CustomEvent('fp:open-consent')");
        expect(banner).toContain("window.addEventListener('fp:open-consent'");
    });

    test('loads the Facebook comments SDK only behind marketing consent', () => {
        const page = fs.readFileSync(path.join(__dirname, '../src/pages/shorts.astro'), 'utf8');

        // SDK-ul nu are voie să apară în HTML-ul livrat — doar injectat din JS, după acord.
        expect(page).not.toMatch(/<script[^>]*connect\.facebook\.net/);
        expect(page).toContain("tag.src = 'https://connect.facebook.net/ro_RO/sdk.js'");

        // Randarea așteaptă fbAsyncInit, nu doar `load` pe script.
        expect(page).toContain('window.fbAsyncInit = () =>');
        expect(page).toContain("window.FB?.init?.({ xfbml: false, version: 'v21.0' })");

        // Fără acord sau fără randare, panoul afișează mereu ceva.
        expect(page).toContain('data-comments-status');
        expect(page).toContain('data-comments-fallback');

        // Poarta citește categoria `marketing`, nu acordul video.
        expect(page).toContain('function hasMarketingConsent');
        expect(page).toContain('api.read()?.marketing === true');

        const sync = page.indexOf('function syncCommentsConsent');
        const guard = page.indexOf('if (!granted) return;', sync);
        const load = page.indexOf('else loadFacebookSDK();', sync);
        expect(sync).toBeGreaterThan(-1);
        expect(guard).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(load);

        // Fallback-ul redeschide bannerul granular in loc să scrie singur acordul.
        expect(page).toContain('data-open-consent');
        expect(page).toContain("CustomEvent('fp:open-consent')");
        expect(page).not.toMatch(/setItem\(\s*['"]fp_consent['"]/);

        const banner = fs.readFileSync(path.join(__dirname, '../src/components/CookieBanner.astro'), 'utf8');
        expect(banner).toContain("CustomEvent('fp:consent-updated'");

        const csp = fs.readFileSync(path.join(__dirname, '../src/lib/csp.mjs'), 'utf8');
        const frameSrc = csp.split('\n').find((line) => line.includes('frame-src'));
        expect(frameSrc).toContain('https://www.facebook.com');
    });
});
