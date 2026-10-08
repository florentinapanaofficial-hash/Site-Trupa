const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule(name, globals = {}) {
    const source = fs.readFileSync(path.join(__dirname, `../src/lib/${name}.ts`), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const context = vm.createContext({ exports: {}, URL, Set, Map, ...globals });
    vm.runInContext(compiled, context);
    return context.exports;
}

const clip = {
    id: 'hora', title: 'Hora live', description: 'Florentina Pană și trupa, live.',
    src: 'https://media.example.test/hora.mp4',
    poster: 'https://media.example.test/hora.webp',
    uploadDate: '2026-10-06T12:00:00Z', duration: 'PT30S',
};

describe('R2 reels data and linked schema', () => {
    const { prepareReels, reelsGraph } = loadModule('r2-reels');
    test('preserves real metadata and connects videos to the existing MusicGroup ID', () => {
        const data = prepareReels([clip]);
        expect(data).toEqual([clip]);
        const graph = reelsGraph(data, 'https://site.test/', 'live');
        const video = graph['@graph'][2];
        expect(video).toMatchObject({
            '@id': 'https://site.test/#live-hora',
            contentUrl: clip.src, uploadDate: clip.uploadDate,
            thumbnailUrl: [clip.poster], creator: { '@id': 'https://site.test/#music-group' },
        });
        expect(graph['@graph'][1].itemListElement[0].item['@id']).toBe(video['@id']);
    });
    test.each([
        { src: 'javascript:alert(1)' }, { src: 'http://media.test/a.mp4' },
        { src: 'https://user@media.test/a.mp4' }, { poster: 'data:image/png;base64,x' },
        { captions: 'javascript:alert(1)' }, { id: 'bad id' }, { title: '' },
        { description: ' ' }, { uploadDate: 'not-a-date' },
        { uploadDate: '2026-10-06' }, { duration: '30 seconds' },
    ])('rejects invalid metadata or unsafe asset URLs: %j', (change) => {
        expect(() => prepareReels([{ ...clip, ...change }])).toThrow();
    });
    test('rejects duplicate IDs and handles an empty list', () => {
        expect(() => prepareReels([clip, clip])).toThrow();
        expect(prepareReels([])).toEqual([]);
    });
});

function frontend(count = 2, withObserver = true) {
    const document = new EventTarget();
    document.hidden = false;
    const window = new EventTarget();
    const observers = [];
    class Observer {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe = jest.fn();
        disconnect = jest.fn();
    }
    const cards = Array.from({ length: count }, (_, index) => {
        const video = new EventTarget();
        const attributes = new Map();
        Object.defineProperty(video, 'src', {
            get: () => attributes.get('src'),
            set: (value) => attributes.set('src', value),
        });
        video.dataset = { src: `${clip.src}?clip=${index}` };
        video.hasAttribute = (name) => attributes.has(name);
        video.removeAttribute = (name) => attributes.delete(name);
        video.pause = jest.fn();
        video.load = jest.fn();
        video.focus = jest.fn();
        video.play = jest.fn(() => Promise.resolve());
        const track = { dataset: { src: 'https://media.test/captions.vtt' }, removeAttribute: jest.fn() };
        video.querySelector = () => track;
        const button = new EventTarget();
        button.hidden = false;
        button.focus = jest.fn();
        const poster = { hidden: false };
        const status = { textContent: '' };
        const frame = {};
        const nodes = {
            '[data-reel-video]': video, '[data-reel-poster]': poster,
            '[data-reel-play]': button, '[data-reel-status]': status, figure: frame,
        };
        return { querySelector: (selector) => nodes[selector], video, button, poster, status, frame, track };
    });
    const { mountR2Reels } = loadModule('r2-reels-player', {
        Array, AbortController, CustomEvent, document, window,
        ...(withObserver ? { IntersectionObserver: Observer } : {}),
    });
    const cleanup = mountR2Reels({ querySelectorAll: () => cards });
    const click = (index = 0) => cards[index].button.dispatchEvent(new Event('click'));
    return { cards, document, window, observers, cleanup, click };
}

describe('R2 native media lifecycle', () => {
    test('initialization and viewport entry never assign a video URL', () => {
        const { cards, observers, cleanup } = frontend();
        observers[0].callback([{ target: cards[0].frame, isIntersecting: true, intersectionRatio: 1 }]);
        cards.forEach(({ video }) => {
            expect(video.src).toBeUndefined();
            expect(video.play).not.toHaveBeenCalled();
            expect(video.load).not.toHaveBeenCalled();
        });
        cleanup();
    });
    test('explicit activation attaches media and captions; playing hides the poster', () => {
        const { cards, click, cleanup } = frontend();
        click();
        expect(cards[0].video.src).toBe(`${clip.src}?clip=0`);
        expect(cards[0].track.src).toBe(cards[0].track.dataset.src);
        expect(cards[0].button.hidden).toBe(true);
        expect(cards[0].poster.hidden).toBe(false);
        cards[0].video.dispatchEvent(new Event('playing'));
        expect(cards[0].poster.hidden).toBe(true);
        expect(cards[0].status.textContent).toBe('');
        cleanup();
    });
    test('leaving the viewport cancels downloads and releases the decoder', () => {
        const { cards, click, observers, cleanup } = frontend();
        click();
        observers[0].callback([{ target: cards[0].frame, isIntersecting: true, intersectionRatio: 0.1 }]);
        expect(cards[0].video.src).toBeUndefined();
        expect(cards[0].video.pause).toHaveBeenCalled();
        expect(cards[0].video.load).toHaveBeenCalledTimes(1);
        expect(cards[0].track.removeAttribute).toHaveBeenCalledWith('src');
        expect(cards[0].button.hidden).toBe(false);
        cleanup();
    });
    test('only one clip stays loaded, including across component instances', () => {
        const { cards, document, click, cleanup } = frontend();
        click(0);
        click(1);
        expect(cards[0].video.src).toBeUndefined();
        expect(cards[1].video.src).toBeDefined();
        document.dispatchEvent(new CustomEvent('fp:r2-reel-play', { detail: {} }));
        expect(cards[1].video.src).toBeUndefined();
        cleanup();
    });
    test.each(['visibilitychange', 'pagehide'])('%s releases media without autoplaying it again', (event) => {
        const { cards, document, window, click, cleanup } = frontend();
        click();
        if (event === 'visibilitychange') document.hidden = true;
        (event === 'pagehide' ? window : document).dispatchEvent(new Event(event));
        expect(cards[0].video.src).toBeUndefined();
        document.hidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
        expect(cards[0].video.src).toBeUndefined();
        cleanup();
    });
    test('cleanup disconnects observers/listeners and ignores a late play rejection', async () => {
        const { cards, click, observers, cleanup } = frontend();
        let reject;
        cards[0].video.play.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
        click();
        cleanup();
        reject(new Error('aborted'));
        await Promise.resolve();
        expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
        expect(cards[0].status.textContent).toBe('');
        click();
        expect(cards[0].video.play).toHaveBeenCalledTimes(1);
    });
    test('a rejected play can be retried and errors retain a usable fallback', async () => {
        const { cards, click, cleanup } = frontend();
        cards[0].video.play.mockRejectedValueOnce(new Error('unavailable'));
        click();
        await Promise.resolve();
        expect(cards[0].video.src).toBeUndefined();
        expect(cards[0].status.textContent).toContain('Încearcă din nou');
        click();
        expect(cards[0].video.src).toBeDefined();
        cards[0].video.dispatchEvent(new Event('error'));
        expect(cards[0].video.src).toBeUndefined();
        expect(cards[0].button.hidden).toBe(false);
        cleanup();
    });
    test('old rejections cannot reset a newer attempt', async () => {
        const { cards, click, observers, cleanup } = frontend();
        let reject;
        cards[0].video.play.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
        click();
        observers[0].callback([{ target: cards[0].frame, isIntersecting: false, intersectionRatio: 0 }]);
        click();
        reject(new Error('old attempt'));
        await Promise.resolve();
        expect(cards[0].video.src).toBeDefined();
        expect(cards[0].button.hidden).toBe(true);
        cleanup();
    });
    test('without IntersectionObserver, click-to-play and cleanup still work', () => {
        const { cards, click, cleanup } = frontend(1, false);
        click();
        expect(cards[0].video.src).toBeDefined();
        cleanup();
        expect(cards[0].video.src).toBeUndefined();
    });
});
