import { useEffect } from 'react';

export default function Modal({ open, title, onClose, children, wide = false }) {
    useEffect(() => {
        if (!open) return undefined;

        function onKey(event) {
            if (event.key === 'Escape') onClose();
        }

        document.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className={`my-8 w-full ${wide ? 'max-w-5xl' : 'max-w-lg'} animate-fade-up rounded-2xl border border-white/10 bg-ink-900 shadow-2xl`}
            >
                <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
                    <button type="button" className="btn-ghost px-3 py-1.5" onClick={onClose}>
                        Închide
                    </button>
                </header>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}
