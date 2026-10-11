const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function compile(source) {
    return ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
}

function endpoint() {
    let count = 0;
    const rpc = jest.fn(async (name, args) => {
        if (name !== 'increment_video_view') return { data: null, error: new Error(`RPC necunoscut: ${name}`) };
        if (!args || typeof args.p_video_id !== 'string') return { data: null, error: new Error('Argument RPC invalid') };
        count += 1;
        return { data: count, error: null };
    });
    // Lantul .from().select().in() se rezolva la { data, error }, ca in supabase-js.
    const inFilter = jest.fn(async () => ({ data: [{ video_id: 'clip', views_count: 7 }], error: null }));
    const select = jest.fn(() => ({ in: inFilter }));
    const from = jest.fn(() => ({ select }));
    const supabase = { from, select, rpc };
    const context = vm.createContext({
        exports: {}, Request, Response, Date, Map, Set,
        require: (name) => {
            if (name.endsWith('/lib/supabase')) return {
                requireSupabaseAdmin: () => supabase,
                getSupabaseAdmin: () => supabase,
            };
            if (name.endsWith('/cors.js')) return {
                checkOrigin: (request) => ({ allowed: request.headers.get('origin') !== 'https://evil.test', origin: null }),
            };
            if (name.endsWith('/secure-logger.js')) return { secureLogger: { error: jest.fn() } };
            throw new Error(`Unexpected import: ${name}`);
        },
    });
    vm.runInContext(compile(fs.readFileSync(path.join(__dirname, '../src/pages/api/views.ts'), 'utf8')), context);
    const post = (payload, ip = 'client-1') => context.exports.POST({
        request: new Request('https://site.test/api/track-video/', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(payload),
        })
    });
    return { api: context.exports, post, supabase, rpc, from, select, inFilter };
}

function frontend() {
    const listeners = {};
    const facadeListeners = {};
    const badge = () => {
        const count = { textContent: '' };
        return {
            hidden: true, classList: { add: jest.fn() },
            querySelector: () => count, setAttribute: jest.fn(), cloneNode: () => badge(), count,
        };
    };
    const originalBadge = badge();
    const facade = {
        dataset: { videoId: 'clip', videoUrl: 'https://iframe.cloudflarestream.com/clip', videoTitle: 'Clip' },
        childNodes: [originalBadge], isConnected: true,
        classList: { add: jest.fn(), remove: jest.fn() },
        removeAttribute: jest.fn(), setAttribute: jest.fn(),
        addEventListener: jest.fn((name, handler) => { facadeListeners[name] = handler; }),
        querySelector(selector) { return selector === '[data-video-views]' ? this.childNodes.find((node) => node.count) : null; },
        replaceChildren(...nodes) { this.childNodes = nodes; },
    };
    const player = {
        addEventListener: jest.fn((name, handler) => { listeners[name] = handler; }),
        removeEventListener: jest.fn(),
    };
    const fetch = jest.fn(async () => new Response(JSON.stringify({ views_count: 42 })));
    const document = {
        querySelectorAll: () => [], addEventListener: jest.fn(),
        createElement: () => ({ focus: jest.fn() }),
    };
    const context = vm.createContext({
        exports: {},
        window: { location: { origin: 'https://site.test' }, Stream: () => player, addEventListener: jest.fn() },
        document, fetch, Intl, URL, Set, Map, WeakMap, Response,
        localStorage: { getItem: () => 'granted' },
    });
    vm.runInContext(compile(fs.readFileSync(path.join(__dirname, '../public/js/video-facade.js'), 'utf8')), context);
    document.querySelectorAll = () => [facade];
    context.exports.initVideoFacades();
    return { context, facade, fetch, listeners, facadeListeners, player, document };
}

describe('Supabase video views endpoint', () => {
    test('calls the atomic RPC and returns the incremented total', async () => {
        const { post, rpc } = endpoint();
        expect(await (await post({ video_id: 'clip' })).json()).toMatchObject({ video_id: 'clip', views_count: 1 });
        expect(await (await post({ video_id: 'clip' }, 'client-2')).json()).toMatchObject({ views_count: 2 });
        expect(rpc.mock.calls[0]).toEqual(['increment_video_view', { p_video_id: 'clip' }]);
        expect(rpc).toHaveBeenCalledTimes(2);
    });

    test('rejects invalid JSON payloads without writing', async () => {
        const { post, rpc } = endpoint();
        for (const payload of [null, {}, { video_id: "'; DROP TABLE video_views" }, { video_id: 'a'.repeat(256) }]) {
            expect((await post(payload)).status).toBe(400);
        }
        expect(rpc).not.toHaveBeenCalled();
    });

    test('limits repeat requests for the same IP and clip', async () => {
        const { post, rpc } = endpoint();
        expect((await post({ video_id: 'clip' })).status).toBe(200);
        expect((await post({ video_id: 'clip' })).status).toBe(429);
        expect(rpc).toHaveBeenCalledTimes(1);
    });

    test('surfaces an RPC error as 500 and clears the rate limit so a retry works', async () => {
        const { post, rpc } = endpoint();
        rpc.mockResolvedValueOnce({ data: null, error: new Error('DB failure') });
        expect((await post({ video_id: 'clip' })).status).toBe(500);
        expect((await post({ video_id: 'clip' })).status).toBe(200);
        expect(rpc).toHaveBeenCalledTimes(2);
    });

    test('rejects a non-numeric RPC result instead of reporting a bogus count', async () => {
        const { post, rpc } = endpoint();
        rpc.mockResolvedValueOnce({ data: 0, error: null });
        expect((await post({ video_id: 'clip' })).status).toBe(500);
    });

    test('GET reads live counts and returns zero for missing IDs without cache', async () => {
        const { api, from, select, inFilter } = endpoint();
        const url = new URL('https://site.test/api/track-video/?ids=clip,missing');
        const response = await api.GET({ request: new Request(url), url });
        expect(await response.json()).toEqual({ views: { clip: 7, missing: 0 } });
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(from).toHaveBeenCalledWith('video_views');
        expect(select).toHaveBeenCalledWith('video_id, views_count');
        expect(inFilter).toHaveBeenCalledWith('video_id', ['clip', 'missing']);
    });

    test('rejects a forbidden origin', async () => {
        const { api, rpc } = endpoint();
        const response = await api.POST({
            request: new Request('https://site.test/api/track-video/', {
                method: 'POST', headers: { Origin: 'https://evil.test' }, body: '{"video_id":"clip"}',
            })
        });
        expect(response.status).toBe(403);
        expect(rpc).not.toHaveBeenCalled();
    });
});

describe('VideoFacade playback tracking', () => {
    test('initial binding and page-load make no requests; thumbnail click reads live views', async () => {
        const { context, facade, fetch, facadeListeners, document } = frontend();
        context.bindFacades();
        document.addEventListener.mock.calls.find(([name]) => name === 'astro:page-load')[1]();
        expect(fetch).not.toHaveBeenCalled();
        fetch.mockResolvedValueOnce(new Response(JSON.stringify({ views: { clip: 1234 } })));
        facadeListeners.click({ target: { closest: () => null } });
        await new Promise((resolve) => setImmediate(resolve));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0]).toEqual(['/api/views/?ids=clip', {
            headers: { Accept: 'application/json' }, cache: 'no-store',
        }]);
        const activeBadge = facade.querySelector('[data-video-views]');
        expect(activeBadge.hidden).toBe(false);
        expect(activeBadge.count.textContent).toBe(new Intl.NumberFormat('ro-RO').format(1234));
        expect(facade.dataset.videoActive).toBe('true');
    });

    test('keyboard activation reads views without waiting for the response to open the player', async () => {
        const { context, facade, fetch, facadeListeners } = frontend();
        context.bindFacades();
        fetch.mockImplementationOnce(() => new Promise(() => { }));
        const preventDefault = jest.fn();
        facadeListeners.keydown({ target: facade, key: 'Enter', preventDefault });
        await new Promise((resolve) => setImmediate(resolve));
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(facade.dataset.videoActive).toBe('true');
        expect(facade.childNodes[0].src).toContain('autoplay=1');
    });

    test('an unavailable views API does not prevent playback', async () => {
        const { context, facade, fetch, facadeListeners } = frontend();
        context.bindFacades();
        fetch.mockRejectedValueOnce(new Error('Offline'));
        facadeListeners.click({ target: { closest: () => null } });
        await new Promise((resolve) => setImmediate(resolve));
        expect(facade.dataset.videoActive).toBe('true');
        expect(facade.querySelector('[data-video-views]').hidden).toBe(true);
    });

    test('tracks real play only once and updates the visible badge while playing', async () => {
        const { context, facade, fetch, listeners, player } = frontend();
        await context.activate(facade);
        expect(fetch).not.toHaveBeenCalled();
        expect(player.addEventListener).toHaveBeenCalledWith('play', expect.any(Function));
        listeners.play();
        listeners.play();
        await new Promise((resolve) => setImmediate(resolve));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ video_id: 'clip' });
        const activeBadge = facade.querySelector('[data-video-views]');
        expect(activeBadge.hidden).toBe(false);
        expect(activeBadge.count.textContent).toBe('42');
        context.resetFacade(facade);
        expect(player.removeEventListener).toHaveBeenCalledTimes(1);
        expect(facade.querySelector('[data-video-views]').count.textContent).toBe('42');
        await context.activate(facade);
        listeners.play();
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('retries on a later play after a network failure', async () => {
        const { context, facade, fetch } = frontend();
        fetch.mockRejectedValueOnce(new Error('Offline'));
        await context.trackView(facade);
        await context.trackView(facade);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('a delayed GET cannot replace the newly tracked total, but newer totals are accepted', async () => {
        const { context, facade, fetch } = frontend();
        await context.trackView(facade);
        fetch.mockResolvedValueOnce(new Response(JSON.stringify({ views: { clip: 41 } })));
        await context.loadViews([facade]);
        expect(facade.dataset.videoViews).toBe('42');
        fetch.mockResolvedValueOnce(new Response(JSON.stringify({ views: { clip: 43 } })));
        await context.loadViews([facade]);
        expect(facade.dataset.videoViews).toBe('43');
    });
});