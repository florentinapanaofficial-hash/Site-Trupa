const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ids = { gtmId: 'GTM-N44548RF' };

function tracking(consent = 'granted', dataLayer = []) {
    const listeners = {};
    const scripts = [];
    const localStorage = { getItem: jest.fn(() => consent) };
    const window = { dataLayer, __FP_TRACKING_IDS__: ids };
    const document = {
        title: 'Formația Florentina Pană',
        head: { appendChild: (script) => scripts.push(script) },
        createElement: () => ({}),
        addEventListener: (name, handler) => { listeners[name] = handler; },
    };
    const location = {
        pathname: '/', search: '', href: 'https://www.florentinapanaofficial.ro/',
    };
    const context = vm.createContext({ window, document, location, localStorage, Date });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/tracking-pixels.js'), 'utf8'), context);
    return { window, document, location, localStorage, listeners, scripts };
}

describe('GTM consent and Astro navigation', () => {
    test.each([null, 'denied'])('does not load or track without consent (%s)', (consent) => {
        const app = tracking(consent);
        app.window.FPTracking.init(ids);
        app.listeners['astro:page-load']();
        expect(app.scripts).toHaveLength(0);
        expect(app.window.dataLayer).toHaveLength(0);
    });

    test('does not load when localStorage is unavailable', () => {
        const app = tracking();
        app.localStorage.getItem.mockImplementation(() => { throw new Error('Blocked'); });
        app.window.FPTracking.init(ids);
        expect(app.scripts).toHaveLength(0);
    });

    test('loads the requested container once and preserves existing dataLayer entries', () => {
        const dataLayer = [{ event: 'existing' }];
        const app = tracking('granted', dataLayer);
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

    test('initializes on page-load and records client-side navigation without reloading GTM', () => {
        const app = tracking();
        app.listeners['astro:page-load']();
        expect(app.window.dataLayer.filter((entry) => entry.event === 'fp_page_view')).toHaveLength(1);
        Object.assign(app.location, {
            pathname: '/contact/', search: '?source=nav',
            href: 'https://www.florentinapanaofficial.ro/contact/?source=nav',
        });
        app.document.title = 'Contact';
        app.listeners['astro:page-load']();
        expect(app.scripts).toHaveLength(1);
        expect(app.window.dataLayer.filter((entry) => entry.event === 'fp_page_view')).toHaveLength(2);
        expect(app.window.dataLayer.at(-1)).toEqual({
            event: 'fp_page_view', page_path: '/contact/?source=nav',
            page_location: app.location.href, page_title: 'Contact',
        });
    });

    test('starts after acceptance and stops sending page views when consent is denied', () => {
        const app = tracking('denied');
        app.window.FPTracking.init(ids);
        app.localStorage.getItem.mockReturnValue('granted');
        app.window.FPTracking.init(ids);
        expect(app.scripts).toHaveLength(1);
        const count = app.window.dataLayer.length;
        app.localStorage.getItem.mockReturnValue('denied');
        app.listeners['astro:page-load']();
        app.window.FPTracking.trackPageView();
        expect(app.window.dataLayer).toHaveLength(count);
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

    test('the shared layout passes the requested container to the consent-gated runtime', () => {
        const layout = fs.readFileSync(path.join(__dirname, '../src/layouts/BaseLayout.astro'), 'utf8');
        expect(layout).toContain("const gtmId = 'GTM-N44548RF';");
        expect(layout).toContain('define:vars={{ gtmId, ga4Id, metaPixelId, tiktokPixelId }}');
        expect(layout).toContain('window.__FP_TRACKING_IDS__ = { gtmId: gtmId,');
        expect(layout).not.toContain('googletagmanager.com/ns.html');
        const banner = fs.readFileSync(path.join(__dirname, '../src/components/CookieBanner.astro'), 'utf8');
        expect(banner).toContain("script.src = '/js/tracking-pixels.js?v=gtm-n44548rf';");
    });
});
