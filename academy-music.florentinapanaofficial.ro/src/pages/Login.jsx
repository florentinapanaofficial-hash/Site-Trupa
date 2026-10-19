import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Spinner from '../components/ui/Spinner';

export default function Login() {
    const { session, loading, signIn, resetPassword } = useAuth();
    const location = useLocation();
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ identity: '', password: '' });
    const [status, setStatus] = useState({ busy: false, error: '', info: '' });

    if (loading) {
        return (
            <div className="grid min-h-screen place-items-center">
                <Spinner />
            </div>
        );
    }

    if (session) {
        return <Navigate to={location.state?.from || '/'} replace />;
    }

    function update(field) {
        return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setStatus({ busy: true, error: '', info: '' });

        try {
            if (mode === 'login') {
                await signIn(form.identity.trim(), form.password);
            } else {
                if (!form.identity.includes('@')) {
                    throw new Error('Pentru un cont de elev, cere profesorului o parolă nouă.');
                }
                await resetPassword(form.identity.trim());
                setStatus({
                    busy: false,
                    error: '',
                    info: 'Dacă adresa există, vei primi un email cu linkul de resetare.',
                });
                return;
            }
        } catch (err) {
            // Mesaj uniform: nu confirmăm dacă adresa există în bază.
            const message =
                err?.message === 'Invalid login credentials'
                    ? 'Username, email sau parolă incorectă.'
                    : err?.message || 'A apărut o eroare. Încearcă din nou.';
            setStatus({ busy: false, error: message, info: '' });
            return;
        }

        setStatus({ busy: false, error: '', info: '' });
    }

    return (
        <div className="grid min-h-screen place-items-center bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900/40 p-4">
            <div className="w-full max-w-md animate-fade-up">
                <div className="mb-6 text-center">
                    <span className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-gold-500 text-3xl">
                        🎵
                    </span>
                    <h1 className="mt-4 font-display text-3xl text-white">Academy Music</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Orgă și canto · Palatul Copiilor Pitești
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="card space-y-4">
                    <div>
                        <label className="label" htmlFor="identity">
                            {mode === 'login' ? 'Username sau email' : 'Email profesor'}
                        </label>
                        <input
                            id="identity"
                            type={mode === 'login' ? 'text' : 'email'}
                            className="input"
                            value={form.identity}
                            onChange={update('identity')}
                            required
                            autoComplete={mode === 'login' ? 'username' : 'email'}
                            autoCapitalize="none"
                            spellCheck={false}
                        />
                    </div>

                    {mode === 'login' && (
                        <div>
                            <label className="label" htmlFor="password">
                                Parolă
                            </label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                value={form.password}
                                onChange={update('password')}
                                required
                                autoComplete="current-password"
                            />
                        </div>
                    )}

                    {mode === 'reset' && (
                        <p className="text-xs text-slate-400">
                            Conturile elevilor nu folosesc email. Pentru o parolă nouă, contactează profesorul.
                        </p>
                    )}

                    {status.error && (
                        <p className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{status.error}</p>
                    )}
                    {status.info && (
                        <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{status.info}</p>
                    )}

                    <button type="submit" className="btn-primary w-full" disabled={status.busy}>
                        {status.busy
                            ? 'Se procesează…'
                            : mode === 'login'
                                ? 'Intră în cont'
                                : 'Trimite linkul de resetare'}
                    </button>

                    <div className="text-xs text-slate-400">
                        <button
                            type="button"
                            className="hover:text-gold-400"
                            onClick={() => setMode(mode === 'login' ? 'reset' : 'login')}
                        >
                            {mode === 'login' ? 'Am uitat parola' : 'Înapoi la autentificare'}
                        </button>
                    </div>
                </form>

                <p className="mt-5 text-center text-xs text-slate-600">
                    Conturile elevilor sunt create de profesor. Folosește username-ul și parola primite.
                </p>
            </div>
        </div>
    );
}
