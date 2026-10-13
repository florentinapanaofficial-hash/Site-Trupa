import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { BUCKET_MEDIA } from '../lib/supabase';
import { getSignedUrl } from '../lib/media';
import Spinner from './ui/Spinner';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Partitura este randată pagină cu pagină pe `<canvas>`, din memorie.
 * Spre deosebire de `<iframe>` sau `<embed>`, viewerul nativ al browserului
 * (cu butoanele Download / Print) nu mai apare deloc.
 */
export default function SecurePdfViewer({ path, bucket = BUCKET_MEDIA, watermark = '' }) {
    const canvasRef = useRef(null);
    const docRef = useRef(null);
    const renderTaskRef = useRef(null);
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const [scale, setScale] = useState(1.25);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        let loadingTask = null;

        async function load() {
            setLoading(true);
            setError('');
            try {
                const url = await getSignedUrl(bucket, path);
                if (!url) throw new Error('Partitura nu este disponibilă.');

                const response = await fetch(url);
                if (!response.ok) throw new Error('Descărcare eșuată.');
                const buffer = await response.arrayBuffer();
                if (cancelled) return;

                loadingTask = pdfjsLib.getDocument({
                    data: buffer,
                    disableAutoFetch: true,
                    // Fără eval, CSP-ul din server.mjs poate rămâne fără `unsafe-eval`.
                    isEvalSupported: false,
                });
                const doc = await loadingTask.promise;
                if (cancelled) {
                    doc.destroy();
                    return;
                }

                docRef.current = doc;
                setPageCount(doc.numPages);
                setPage(1);
            } catch {
                if (!cancelled) setError('Partitura nu a putut fi afișată. Reîncarcă pagina.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => {
            cancelled = true;
            renderTaskRef.current?.cancel();
            docRef.current?.destroy();
            docRef.current = null;
            loadingTask?.destroy?.();
        };
    }, [bucket, path]);

    const renderPage = useCallback(async () => {
        const doc = docRef.current;
        const canvas = canvasRef.current;
        if (!doc || !canvas) return;

        renderTaskRef.current?.cancel();

        const pdfPage = await doc.getPage(page);
        const viewport = pdfPage.getViewport({ scale });
        const context = canvas.getContext('2d');

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        const task = pdfPage.render({ canvasContext: context, viewport });
        renderTaskRef.current = task;

        try {
            await task.promise;
        } catch (err) {
            if (err?.name !== 'RenderingCancelledException') {
                setError('Pagina nu a putut fi randată.');
            }
        }
    }, [page, scale]);

    useEffect(() => {
        if (!pageCount) return;
        renderPage();
    }, [pageCount, renderPage]);

    // Ctrl+S / Ctrl+P sunt căile uzuale de salvare; le blocăm cât timp partitura e pe ecran.
    useEffect(() => {
        function onKeyDown(event) {
            const key = event.key.toLowerCase();
            if ((event.ctrlKey || event.metaKey) && (key === 's' || key === 'p')) {
                event.preventDefault();
            }
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    if (loading) {
        return (
            <div className="grid min-h-[320px] place-items-center">
                <Spinner label="Se încarcă partitura…" />
            </div>
        );
    }

    if (error) {
        return <p className="rounded-xl bg-brand-500/10 p-4 text-sm text-brand-200">{error}</p>;
    }

    return (
        <div className="protected select-none">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="btn-ghost px-3 py-1.5"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                    >
                        ← Anterioară
                    </button>
                    <span className="text-sm text-slate-400">
                        Pagina {page} din {pageCount}
                    </span>
                    <button
                        type="button"
                        className="btn-ghost px-3 py-1.5"
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        disabled={page >= pageCount}
                    >
                        Următoarea →
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="btn-ghost px-3 py-1.5"
                        onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.25).toFixed(2))))}
                    >
                        −
                    </button>
                    <span className="w-12 text-center text-sm text-slate-400">{Math.round(scale * 100)}%</span>
                    <button
                        type="button"
                        className="btn-ghost px-3 py-1.5"
                        onClick={() => setScale((s) => Math.min(3, Number((s + 0.25).toFixed(2))))}
                    >
                        +
                    </button>
                </div>
            </div>

            <div
                className="relative overflow-auto rounded-xl border border-white/10 bg-white p-2 scrollbar-thin"
                onContextMenu={(event) => event.preventDefault()}
                onDragStart={(event) => event.preventDefault()}
            >
                <canvas ref={canvasRef} className="mx-auto block" />

                {watermark && (
                    <div
                        className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden"
                        aria-hidden="true"
                    >
                        <p className="rotate-[-30deg] whitespace-nowrap text-3xl font-bold uppercase tracking-widest text-black/10">
                            {watermark}
                        </p>
                    </div>
                )}

                <div className="pointer-events-none absolute inset-0" />
            </div>

            <p className="mt-2 text-xs text-slate-500">
                Material protejat prin drept de autor. Vizualizare permisă doar în platformă.
            </p>
        </div>
    );
}
