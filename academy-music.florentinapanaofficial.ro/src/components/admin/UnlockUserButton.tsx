import { useState } from 'react';

type UnlockResponse = {
    success?: boolean;
    message?: string;
    error?: string;
};

type UnlockUserButtonProps = {
    userId: string;
    onUnlocked?: () => void;
};

export default function UnlockUserButton({ userId, onUnlocked }: UnlockUserButtonProps) {
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    async function unlockUser() {
        setLoading(true);
        setNotice(null);
        try {
            const response = await fetch('/api/admin/unlock-user/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });
            const result = await response.json() as UnlockResponse;
            if (!response.ok || result.success !== true) {
                throw new Error(result.error || 'Contul elevului nu a putut fi deblocat.');
            }
            setNotice({ type: 'success', text: result.message || 'Contul elevului a fost deblocat.' });
            onUnlocked?.();
        } catch (error) {
            setNotice({
                type: 'error',
                text: error instanceof Error ? error.message : 'Contul elevului nu a putut fi deblocat.',
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-2">
            <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-wait disabled:opacity-60"
                onClick={unlockUser}
                disabled={loading}
                aria-busy={loading}
            >
                {loading ? 'Se deblochează...' : 'Deblochează Elev'}
            </button>
            {notice && (
                <p className={`max-w-56 text-xs ${notice.type === 'success' ? 'text-emerald-200' : 'text-brand-200'}`} role={notice.type === 'success' ? 'status' : 'alert'}>
                    {notice.text}
                </p>
            )}
        </div>
    );
}
