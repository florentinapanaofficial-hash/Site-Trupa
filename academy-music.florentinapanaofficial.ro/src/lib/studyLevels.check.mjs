import test from 'node:test';
import assert from 'node:assert/strict';
import { isStudyLevelLocked, normalizeStudyProgress, studyLevelRank } from './studyLevels.js';

test('study levels have a strict, ordered rank', () => {
    assert.equal(studyLevelRank('incepator'), 1);
    assert.equal(studyLevelRank('mediu'), 2);
    assert.equal(studyLevelRank('avansat'), 3);
    assert.equal(studyLevelRank('unknown'), null);
});

test('zero assigned homework does not unlock the next level', () => {
    const progress = normalizeStudyProgress({ study_level: 'incepator', next_level: 'mediu', assigned_count: 0, completed_count: 0, next_level_unlocked: true });
    assert.equal(progress.nextLevelUnlocked, false);
    assert.deepEqual(progress.unlockedLevels, ['incepator']);
});

test('only complete progress for the expected next level unlocks it', () => {
    const progress = normalizeStudyProgress({ study_level: 'incepator', next_level: 'mediu', assigned_count: 3, completed_count: 3, next_level_unlocked: true });
    assert.equal(progress.completionPercent, 100);
    assert.equal(progress.nextLevelUnlocked, true);
    assert.deepEqual(progress.unlockedLevels, ['incepator', 'mediu']);
    assert.equal(isStudyLevelLocked('mediu', progress.unlockedLevels), false);
    assert.equal(isStudyLevelLocked('avansat', progress.unlockedLevels), true);
});

test('invalid or mismatched server progress fails closed', () => {
    const incomplete = normalizeStudyProgress({ study_level: 'mediu', next_level: 'avansat', assigned_count: 4, completed_count: 3, next_level_unlocked: true });
    assert.equal(incomplete.nextLevelUnlocked, false);
    assert.equal(isStudyLevelLocked('avansat', incomplete.unlockedLevels), true);
    const mismatched = normalizeStudyProgress({ study_level: 'incepator', next_level: 'avansat', assigned_count: 2, completed_count: 2, next_level_unlocked: true });
    assert.equal(mismatched.nextLevelUnlocked, false);
    assert.equal(isStudyLevelLocked('mediu', mismatched.unlockedLevels), true);
});

test('unknown piece levels remain visible without an invented restriction', () => {
    assert.equal(isStudyLevelLocked(null, ['incepator']), false);
});
