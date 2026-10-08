export interface R2Reel {
    id: string;
    title: string;
    description: string;
    /** Public HTTPS object URL, not an S3 endpoint or an expiring signed URL. */
    src: string;
    poster: string;
    /** Actual publication date, including timezone (ISO 8601). */
    uploadDate: string;
    /** Optional ISO 8601 duration, e.g. PT30S. */
    duration?: string;
    /** Romanian WebVTT captions; cross-origin files require R2 CORS. */
    captions?: string;
}

function publicHttpsUrl(value: string): string {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('R2Reels requires public HTTPS asset URLs without credentials.');
    }
    return url.href;
}

export function prepareReels(reels: readonly R2Reel[]): R2Reel[] {
    const ids = new Set<string>();
    return reels.map((reel) => {
        if (!/^[a-zA-Z0-9_-]+$/.test(reel.id) || ids.has(reel.id)) {
            throw new Error('R2Reels requires unique, nonempty alphanumeric reel IDs.');
        }
        ids.add(reel.id);
        if (!reel.title.trim() || !reel.description.trim()) {
            throw new Error('R2Reels requires a title and description for every video.');
        }
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(reel.uploadDate)
            || !Number.isFinite(Date.parse(reel.uploadDate))) {
            throw new Error('R2Reels requires an actual ISO publication date with timezone.');
        }
        if (reel.duration && !/^PT(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(reel.duration)) {
            throw new Error('R2Reels duration must use the ISO 8601 time format.');
        }
        return {
            ...reel,
            src: publicHttpsUrl(reel.src),
            poster: publicHttpsUrl(reel.poster),
            captions: reel.captions ? publicHttpsUrl(reel.captions) : undefined,
        };
    });
}

export function reelsGraph(reels: readonly R2Reel[], pageUrl: string, sectionId: string) {
    const page = new URL(pageUrl);
    const groupId = `${page.origin}/#music-group`;
    const collectionId = `${page.href}#${sectionId}`;
    const videos = reels.map((reel) => ({
        '@type': 'VideoObject',
        '@id': `${page.href}#${sectionId}-${reel.id}`,
        name: reel.title,
        description: reel.description,
        thumbnailUrl: [reel.poster],
        uploadDate: reel.uploadDate,
        contentUrl: reel.src,
        ...(reel.duration ? { duration: reel.duration } : {}),
        inLanguage: 'ro',
        creator: { '@id': groupId },
        isPartOf: { '@id': collectionId },
    }));
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'MusicGroup',
                '@id': groupId,
                name: 'Formația Florentina Pană',
                url: `${page.origin}/`,
                subjectOf: videos.map((video) => ({ '@id': video['@id'] })),
            },
            {
                '@type': 'ItemList',
                '@id': collectionId,
                numberOfItems: videos.length,
                itemListElement: videos.map((video, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    item: { '@id': video['@id'] },
                })),
            },
            ...videos,
        ],
    };
}
