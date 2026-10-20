export const STUDY_LEVELS = [
    { value: 'incepator', label: 'Începător' },
    { value: 'mediu', label: 'Mediu' },
    { value: 'avansat', label: 'Avansat' },
];
const LEVEL_RANK = new Map(STUDY_LEVELS.map(({ value }, index) => [value, index + 1]));
export function studyLevelRank(level) {
    if (typeof level !== 'string') return null;
    const normalized = level.trim().toLowerCase();
    if (normalized === 'începător') return 1;
    if (normalized === 'intermediar') return 2;
    return LEVEL_RANK.get(normalized) ?? null;
}
export function studyLevelLabel(level) {
    return STUDY_LEVELS.find((item) => item.value === level)?.label || 'Începător';
}
export function normalizeStudyProgress(data, fallbackLevel = 'incepator') {
    const result = Array.isArray(data) ? data[0] : data;
    const currentLevel = STUDY_LEVELS.some((item) => item.value === result?.study_level)
        ? result.study_level
        : STUDY_LEVELS.some((item) => item.value === fallbackLevel) ? fallbackLevel : 'incepator';
    const currentRank = studyLevelRank(currentLevel);
    const next = STUDY_LEVELS.find((item) => studyLevelRank(item.value) === currentRank + 1);
    const assignedCount = Number.isInteger(result?.assigned_count) && result.assigned_count >= 0 ? result.assigned_count : 0;
    const completedCount = Number.isInteger(result?.completed_count) && result.completed_count >= 0
        ? Math.min(result.completed_count, assignedCount) : 0;
    const nextUnlocked = Boolean(next && result?.next_level === next.value && result?.next_level_unlocked && assignedCount > 0 && completedCount === assignedCount);
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
