import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Spinner from '../components/ui/Spinner';

export default function Login() {
    const { session, loading, signIn, signUp, resetPassword } = useAuth();
    const location = useLocation();
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ email: '', password: '', fullName: '' });
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
                await signIn(form.email.trim(), form.password);
            } else if (mode === 'signup') {
                if (form.password.length < 8) {
                    throw new Error('Parola trebuie să aibă cel puțin 8 caractere.');
                }
                await signUp(form.email.trim(), form.password, form.fullName.trim());
                setStatus({
                    busy: false,
                    error: '',
                    info: 'Cont creat. Verifică emailul pentru confirmare, apoi autentifică-te.',
                });
                setMode('login');
                return;
            } else {
                await resetPassword(form.email.trim());
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
                    ? 'Email sau parolă incorectă.'
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
                    {mode === 'signup' && (
                        <div>
                            <label className="label" htmlFor="fullName">
                                Nume și prenume
                            </label>
                            <input
                                id="fullName"
                                className="input"
                                value={form.fullName}
                                onChange={update('fullName')}
                                required
                                autoComplete="name"
                                maxLength={80}
                            />
                        </div>
                    )}

                    <div>
                        <label className="label" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="input"
                            value={form.email}
                            onChange={update('email')}
                            required
                            autoComplete="email"
                        />
                    </div>

                    {mode !== 'reset' && (
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
                                minLength={8}
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            />
                        </div>
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
                                : mode === 'signup'
                                    ? 'Creează cont de elev'
                                    : 'Trimite linkul de resetare'}
                    </button>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <button
                            type="button"
                            className="hover:text-gold-400"
                            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                        >
                            {mode === 'login' ? 'Nu ai cont? Înregistrează-te' : 'Am deja cont'}
                        </button>
                        <button type="button" className="hover:text-gold-400" onClick={() => setMode('reset')}>
                            Am uitat parola
                        </button>
                    </div>
                </form>

                <p className="mt-5 text-center text-xs text-slate-600">
                    Platformă privată. Accesul este rezervat elevilor înscriși la cursuri.
                </p>
            </div>
        </div>
    );
}
