export const VARIANTS = {
    pozitiv: {
        key: 'pozitiv',
        label: 'Pozitiv',
        hint: 'cu voce',
        pathColumn: 'audio_pozitiv_path',
        urlColumn: 'positive_url',
        accent: 'gold',
    },
    negativ: {
        key: 'negativ',
        label: 'Negativ',
        hint: 'instrumental',
        pathColumn: 'audio_negativ_path',
        urlColumn: 'negative_url',
        accent: 'brand',
    },
};

export const VARIANT_LIST = [VARIANTS.pozitiv, VARIANTS.negativ];

/** Un `javascript:` sau `data:` ajuns în `src` nu trebuie să treacă de aici. */
export function isSafeHttpUrl(value) {
    if (!value) return false;
    try {
        const parsed = new URL(String(value).trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function resolveAudioSource(piece, variantKey) {
    const variant = VARIANTS[variantKey];
    if (!piece || !variant) return null;

    const url = piece[variant.urlColumn];
    if (isSafeHttpUrl(url)) return { kind: 'url', value: url };

    return null;
}

export function hasAnyAudio(piece) {
    return VARIANT_LIST.some((variant) => resolveAudioSource(piece, variant.key) !== null);
}
