const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ids = { gtmId: 'GTM-N44548RF' };

function tracking(consent = 'granted', dataLayer = []) {
    const listeners = {};
    const scripts = [];
    const timers = [];
    const localStorage = { getItem: jest.fn(() => consent) };
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
    const context = vm.createContext({ window, document, location, localStorage, Date });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/tracking-pixels.js'), 'utf8'), context);
    return { window, document, location, localStorage, listeners, scripts, timers };
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
    test.each([null, 'denied'])('does not load or track without consent (%s)', (consent) => {
        const app = tracking(consent);
        app.window.FPTracking.init(ids);
        click(app, anchor({ href: 'tel:+40767369658' }, 'quick-dock-btn quick-dock-btn--call'));
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

    test('starts after acceptance and stops sending events when consent is denied', () => {
        const app = tracking('denied');
        app.window.FPTracking.init(ids);
        app.localStorage.getItem.mockReturnValue('granted');
        app.window.FPTracking.init(ids);
        expect(app.scripts).toHaveLength(1);
        const count = app.window.dataLayer.length;
        app.localStorage.getItem.mockReturnValue('denied');
        app.window.FPTracking.trackPageView();
        app.window.FPTracking.trackInteraction('click_phone', 'quick-dock');
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
        expect(layout).toContain("const gtmId = 'GTM-N44548RF';");
        expect(layout).toContain('define:vars={{ gtmId, ga4Id, metaPixelId, tiktokPixelId }}');
        expect(layout).toContain('window.__FP_TRACKING_IDS__ = { gtmId: gtmId,');
        expect(layout).not.toContain('googletagmanager.com/ns.html');
        const banner = fs.readFileSync(path.join(__dirname, '../src/components/CookieBanner.astro'), 'utf8');
        expect(banner).toContain("script.src = '/js/tracking-pixels.js?v=gtm-n44548rf';");
        const runtime = fs.readFileSync(path.join(__dirname, '../public/js/tracking-pixels.js'), 'utf8');
        expect(runtime).not.toContain('astro:page-load');
    });
});
