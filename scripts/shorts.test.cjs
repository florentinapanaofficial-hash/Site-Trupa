const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/pages/shorts.astro'), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const syntax = ts.createSourceFile('shorts.ts', script, ts.ScriptTarget.Latest, true);
const init = syntax.statements.find((statement) => statement.name?.text === 'initShorts');
const functions = ['renderMuteState', 'applyMuteState', 'syncMuteState'];
const helpers = init.body.statements
    .filter((statement) => functions.includes(statement.name?.text))
    .map((statement) => statement.getText(syntax)).join('\n');
const interactions = script.slice(script.indexOf("overlay.addEventListener('click'"), script.indexOf('/* ─── Share:'));

function harness({ muted = true, volume = 100 } = {}) {
    const listeners = {};
    const attributes = {};
    const classes = new Set(['animate-pulse']);
    const button = {
        classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
        setAttribute: (name, value) => { attributes[name] = value; },
    };
    const tap = { addEventListener: (name, handler) => { listeners.tap = handler; }, setAttribute: jest.fn() };
    const card = {
        dataset: { index: '0' },
        querySelector: () => tap,
    };
    const player = {
        isMuted: jest.fn(() => muted || volume === 0),
        setMuted: jest.fn((next) => { muted = next; if (!next) volume = 100; }),
        play: jest.fn(), pause: jest.fn(),
    };
    const overlay = {
        dataset: { muted: 'true' },
        querySelectorAll: () => [button],
        addEventListener: (name, handler) => { listeners.overlay = handler; },
    };
    const context = vm.createContext({
        overlay, cards: [card], players: new Map([[0, player]]), activeIndex: 0, isMuted: true,
        window: { setTimeout, clearTimeout }, Date,
        setLike: jest.fn(), triggerHeartBurst: jest.fn(), flashPlayPause: jest.fn(), handleShare: jest.fn(),
    });
    const compiled = ts.transpile(`${helpers}\n${interactions}`, { target: ts.ScriptTarget.ES2022 });
    vm.runInContext(compiled, context);
    const clickAction = (selector, node = {}) => listeners.overlay({ target: { closest: (query) => query === selector ? node : null } });
    return { context, player, overlay, classes, attributes, card, tap: () => listeners.tap(), clickAction };
}

describe('Shorts sound interaction', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('mute synchronization stops only during cleanup, not when showing a toast', () => {
        const cleanup = script.slice(script.indexOf('const cleanup = () =>'));
        const toast = script.slice(script.indexOf('function showToast('), script.indexOf('/* ─── Pornire'));
        expect(cleanup).toContain('window.clearInterval(muteSyncTimer)');
        expect(toast).not.toContain('window.clearInterval(muteSyncTimer)');
    });

    test('first muted tap only unmutes; a later tap can pause', () => {
        const app = harness();
        app.tap();
        jest.advanceTimersByTime(300);
        expect(app.player.setMuted).toHaveBeenCalledWith(false);
        expect(app.player.pause).not.toHaveBeenCalled();
        expect(app.player.play).not.toHaveBeenCalled();
        expect(app.context.setLike).not.toHaveBeenCalled();
        expect(app.overlay.dataset.muted).toBe('false');
        expect(app.classes.has('animate-pulse')).toBe(false);
        expect(app.attributes['aria-label']).toBe('Dezactivează sunetul');
        app.tap();
        jest.advanceTimersByTime(300);
        expect(app.player.pause).toHaveBeenCalledTimes(1);
    });

    test('zero volume is treated as muted even when the global flag is false', () => {
        const app = harness({ muted: false, volume: 0 });
        app.context.isMuted = false;
        app.tap();
        jest.advanceTimersByTime(300);
        expect(app.player.setMuted).toHaveBeenCalledWith(false);
        expect(app.player.isMuted()).toBe(false);
        expect(app.player.pause).not.toHaveBeenCalled();
    });

    test('actual player state updates DOM, pulse and accessible state', () => {
        const app = harness({ muted: false });
        vm.runInContext('syncMuteState()', app.context);
        expect(app.overlay.dataset.muted).toBe('false');
        app.player.setMuted(true);
        vm.runInContext('syncMuteState()', app.context);
        expect(app.overlay.dataset.muted).toBe('true');
        expect(app.classes.has('animate-pulse')).toBe(true);
        expect(app.attributes['aria-pressed']).toBe('true');
    });

    test('share and external links do not unmute or toggle playback', () => {
        const app = harness();
        app.clickAction('[data-share-btn]');
        app.clickAction('a');
        expect(app.context.handleShare).toHaveBeenCalledTimes(1);
        expect(app.player.setMuted).not.toHaveBeenCalled();
        expect(app.player.pause).not.toHaveBeenCalled();
    });

    test('volume button toggles independently without pausing', () => {
        const app = harness();
        app.clickAction('[data-mute-btn]');
        expect(app.overlay.dataset.muted).toBe('false');
        app.clickAction('[data-mute-btn]');
        expect(app.overlay.dataset.muted).toBe('true');
        expect(app.player.pause).not.toHaveBeenCalled();
    });

    test('double tap still likes after sound is enabled', () => {
        const app = harness({ muted: false });
        app.context.isMuted = false;
        app.tap();
        jest.advanceTimersByTime(100);
        app.tap();
        jest.advanceTimersByTime(300);
        expect(app.context.setLike).toHaveBeenCalledWith(app.card, true);
        expect(app.player.pause).not.toHaveBeenCalled();
    });
});