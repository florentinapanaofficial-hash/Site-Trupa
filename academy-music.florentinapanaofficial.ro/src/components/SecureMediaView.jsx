import { useEffect, useState } from 'react';
import { BUCKET_PORTFOLIO } from '../lib/supabase';
import { getSignedUrl } from '../lib/media';
import Spinner from './ui/Spinner';

/** Afișează un fișier dintr-un bucket privat prin URL semnat, fără opțiune de descărcare. */
export default function SecureMediaView({ path, type, bucket = BUCKET_PORTFOLIO, className = '' }) {
    const [url, setUrl] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        setUrl(null);
        setError(false);

        getSignedUrl(bucket, path)
            .then((value) => {
                if (active) setUrl(value);
            })
            .catch(() => {
                if (active) setError(true);
            });

        return () => {
            active = false;
        };
    }, [bucket, path]);

    if (error) return <p className="text-sm text-brand-300">Fișierul nu a putut fi încărcat.</p>;
    if (!url) return <Spinner label="Se încarcă materialul…" />;

    const block = (event) => event.preventDefault();

    if (type === 'image') {
        return (
            <img
                src={url}
                alt="Temă încărcată de elev"
                onContextMenu={block}
                onDragStart={block}
                className={`protected w-full rounded-xl ${className}`}
            />
        );
    }

    if (type === 'audio') {
        return (
            <audio
                src={url}
                controls
                controlsList="nodownload noplaybackrate"
                onContextMenu={block}
                className={`protected w-full ${className}`}
            />
        );
    }

    return (
        <video
            src={url}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            onContextMenu={block}
            className={`protected w-full rounded-xl bg-black ${className}`}
        />
    );
}
