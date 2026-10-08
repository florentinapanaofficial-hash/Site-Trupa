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
    const connection = {
        beginTransaction: jest.fn(async () => { }),
        execute: jest.fn(async (sql) => {
            if (sql.startsWith('INSERT')) { count += 1; return [{}]; }
            return [[{ views_count: count }]];
        }),
        commit: jest.fn(async () => { }),
        rollback: jest.fn(async () => { }),
        release: jest.fn(),
    };
    const query = jest.fn(async () => [{ video_id: 'clip', views_count: 7 }]);
    const context = vm.createContext({
        exports: {}, Request, Response, Date, Map, Set,
        require: (name) => {
            if (name.endsWith('/db.js')) return { query, getPool: () => ({ getConnection: async () => connection }) };
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
    return { api: context.exports, post, connection, query };
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

describe('MySQL video views endpoint', () => {
    test('inserts 1, increments to 2, and commits before releasing', async () => {
        const { post, connection } = endpoint();
        expect(await (await post({ video_id: 'clip' })).json()).toMatchObject({ video_id: 'clip', views_count: 1 });
        expect(await (await post({ video_id: 'clip' }, 'client-2')).json()).toMatchObject({ views_count: 2 });
        expect(connection.execute.mock.calls[0]).toEqual([
            'INSERT INTO video_views (video_id, views_count) VALUES (?, 1) ON DUPLICATE KEY UPDATE views_count = views_count + 1', ['clip'],
        ]);
        expect(connection.commit).toHaveBeenCalledTimes(2);
        expect(connection.release).toHaveBeenCalledTimes(2);
    });

    test('rejects invalid JSON payloads without writing', async () => {
        const { post, connection } = endpoint();
        for (const payload of [null, {}, { video_id: "'; DROP TABLE video_views" }, { video_id: 'a'.repeat(256) }]) {
            expect((await post(payload)).status).toBe(400);
        }
        expect(connection.execute).not.toHaveBeenCalled();
    });

    test('limits repeat requests for the same IP and clip', async () => {
        const { post, connection } = endpoint();
        expect((await post({ video_id: 'clip' })).status).toBe(200);
        expect((await post({ video_id: 'clip' })).status).toBe(429);
        expect(connection.commit).toHaveBeenCalledTimes(1);
    });

    test('rolls back and releases on database failure, allowing a retry', async () => {
        const { post, connection } = endpoint();
        connection.execute.mockRejectedValueOnce(new Error('DB failure'));
        expect((await post({ video_id: 'clip' })).status).toBe(500);
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.release).toHaveBeenCalledTimes(1);
        expect((await post({ video_id: 'clip' })).status).toBe(200);
    });

    test('GET reads live counts and returns zero for missing IDs without cache', async () => {
        const { api, query } = endpoint();
        const url = new URL('https://site.test/api/track-video/?ids=clip,missing');
        const response = await api.GET({ request: new Request(url), url });
        expect(await response.json()).toEqual({ views: { clip: 7, missing: 0 } });
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(query.mock.calls[0][1]).toEqual(['clip', 'missing']);
    });

    test('rejects a forbidden origin', async () => {
        const { api, connection } = endpoint();
        const response = await api.POST({
            request: new Request('https://site.test/api/track-video/', {
                method: 'POST', headers: { Origin: 'https://evil.test' }, body: '{"video_id":"clip"}',
            })
        });
        expect(response.status).toBe(403);
        expect(connection.execute).not.toHaveBeenCalled();
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
        fetch.mockImplementationOnce(() => new Promise(() => {}));
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