export const STUDY_LEVELS = [
    { value: 'modul_1', label: 'Modulul 1 — Începător / Inițiere' },
    { value: 'modul_2', label: 'Modulul 2 — Elementar' },
    { value: 'modul_3', label: 'Modulul 3 — Intermediar' },
    { value: 'modul_4', label: 'Modulul 4 — Avansat' },
    { value: 'modul_5', label: 'Modulul 5 — Măiestrie / Performance' },
];
const LEGACY_LEVELS = new Map([
    ['incepator', 'modul_1'], ['începător', 'modul_1'],
    ['mediu', 'modul_3'], ['intermediar', 'modul_3'], ['avansat', 'modul_4'],
]);
const LEVEL_RANK = new Map(STUDY_LEVELS.map(({ value }, index) => [value, index + 1]));
export function normalizeStudyLevel(level) {
    if (typeof level !== 'string') return null;
    const normalized = level.trim().toLowerCase();
    return LEVEL_RANK.has(normalized) ? normalized : LEGACY_LEVELS.get(normalized) || null;
}
export function studyLevelRank(level) {
    return LEVEL_RANK.get(normalizeStudyLevel(level)) ?? null;
}
export function studyLevelLabel(level) {
    return STUDY_LEVELS.find((item) => item.value === normalizeStudyLevel(level))?.label || 'Modul necunoscut';
}
export function normalizeStudyProgress(data, fallbackLevel = 'modul_1') {
    const result = Array.isArray(data) ? data[0] : data;
    const currentLevel = normalizeStudyLevel(result?.study_level) || normalizeStudyLevel(fallbackLevel) || 'modul_1';
    const currentRank = studyLevelRank(currentLevel);
    const next = STUDY_LEVELS[currentRank];
    const assignedCount = Number.isInteger(result?.assigned_count) && result.assigned_count >= 0 ? result.assigned_count : 0;
    const completedCount = Number.isInteger(result?.completed_count) && result.completed_count >= 0
        ? Math.min(result.completed_count, assignedCount) : 0;
    const nextUnlocked = Boolean(next && normalizeStudyLevel(result?.next_level) === next.value && result?.next_level_unlocked && assignedCount > 0 && completedCount === assignedCount);
    return {
        studyLevel: currentLevel,
        unlockedLevels: nextUnlocked ? [currentLevel, next.value] : [currentLevel],
        assignedCount,
        completedCount,
        completionPercent: assignedCount ? Math.round(completedCount * 100 / assignedCount) : 0,
        nextLevel: next?.value || null,
        nextLevelUnlocked: nextUnlocked,
    };
}
export function isStudyLevelLocked(pieceLevel, unlockedLevels) {
    const pieceRank = studyLevelRank(pieceLevel);
    if (pieceRank === null) return false;
    const unlockedRank = Math.max(0, ...(unlockedLevels || []).map(studyLevelRank).filter(Number.isInteger));
    return pieceRank > unlockedRank;
}
export function cantoBackingPieces(rows, unlockedLevels) {
    return (rows || []).map((row) => row.pieces).filter((piece) => piece?.discipline === 'canto'
        && (piece.negative_url || piece.audio_negativ_path) && !isStudyLevelLocked(piece.level, unlockedLevels));
}
