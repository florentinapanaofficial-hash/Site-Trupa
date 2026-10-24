import test from 'node:test';
import assert from 'node:assert/strict';
import { STUDY_LEVELS, cantoBackingPieces, isStudyLevelLocked, normalizeStudyLevel, normalizeStudyProgress, studyLevelRank } from './studyLevels.js';

test('five modules have a strict ordered rank and preserve legacy meaning', () => {
    assert.deepEqual(STUDY_LEVELS.map(module => studyLevelRank(module.value)), [1, 2, 3, 4, 5]);
    assert.equal(normalizeStudyLevel('începător'), 'modul_1');
    assert.equal(normalizeStudyLevel('mediu'), 'modul_3');
    assert.equal(normalizeStudyLevel('intermediar'), 'modul_3');
    assert.equal(normalizeStudyLevel('avansat'), 'modul_4');
    for (const invalid of ['modul_0', 'modul_6', 'unknown', null]) assert.equal(studyLevelRank(invalid), null);
});

test('each module unlocks only its immediate successor after complete assigned homework', () => {
    for (let rank = 1; rank <= 5; rank++) {
        const current = `modul_${rank}`;
        const next = rank < 5 ? `modul_${rank + 1}` : null;
        const empty = normalizeStudyProgress({ study_level: current, next_level: next, assigned_count: 0, completed_count: 0, next_level_unlocked: true });
        assert.equal(empty.nextLevelUnlocked, false);
        const progress = normalizeStudyProgress({ study_level: current, next_level: next, assigned_count: 2, completed_count: 2, next_level_unlocked: true });
        assert.equal(progress.nextLevel, next);
        assert.equal(progress.nextLevelUnlocked, rank < 5);
        for (let pieceRank = 1; pieceRank <= 5; pieceRank++) assert.equal(isStudyLevelLocked(`modul_${pieceRank}`, progress.unlockedLevels), pieceRank > Math.min(5, rank + 1));
    }
});

test('incomplete or mismatched server progress never jumps modules', () => {
    const incomplete = normalizeStudyProgress({ study_level: 'modul_3', next_level: 'modul_4', assigned_count: 4, completed_count: 3, next_level_unlocked: true });
    assert.equal(incomplete.nextLevelUnlocked, false);
    assert.equal(isStudyLevelLocked('modul_4', incomplete.unlockedLevels), true);
    const mismatched = normalizeStudyProgress({ study_level: 'modul_1', next_level: 'modul_3', assigned_count: 2, completed_count: 2, next_level_unlocked: true });
    assert.equal(mismatched.nextLevelUnlocked, false);
    assert.equal(isStudyLevelLocked('modul_2', mismatched.unlockedLevels), true);
    assert.equal(normalizeStudyProgress(null, 'avansat').studyLevel, 'modul_4');
});

test('Canto Studio receives only available backing tracks up to the unlocked module', () => {
    const rows = STUDY_LEVELS.map(module => ({ pieces: { id: module.value, title: module.label, discipline: 'canto', level: module.value, audio_negativ_path: 'private/' + module.value + '.mp3' } }));
    rows.push({ pieces: { id: 'instrument', discipline: 'orga', level: 'modul_1', negative_url: 'https://example.test/audio.mp3' } });
    rows.push({ pieces: { id: 'no-audio', discipline: 'canto', level: 'modul_1' } });
    for (let rank = 1; rank <= 5; rank++) {
        assert.deepEqual(cantoBackingPieces(rows, [`modul_${rank}`]).map(piece => piece.id), STUDY_LEVELS.slice(0, rank).map(module => module.value));
    }
    assert.deepEqual(cantoBackingPieces(null, ['modul_1']), []);
});

test('unknown legacy piece metadata remains visible without inventing a module', () => {
    assert.equal(isStudyLevelLocked(null, ['modul_1']), false);
});
