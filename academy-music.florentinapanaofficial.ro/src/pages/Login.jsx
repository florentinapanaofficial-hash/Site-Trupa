import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Spinner from '../components/ui/Spinner';
import { authRequest } from '../lib/securityClient';
import { SECURITY_MESSAGES } from '../lib/securityMessages';

export default function Login() {
    const { session, loading, signIn, resetPassword, securityError } = useAuth();
    const location = useLocation();
    const [mode, setMode] = useState(location.pathname.replace(/\/$/, '') === '/register' ? 'register' : 'login');
    const [form, setForm] = useState({ identity: '', password: '', fullName: '', parentalConsent: false });
    const [status, setStatus] = useState({ busy: false, error: '', info: '' });
    const reason = new URLSearchParams(location.search).get('reason');
    const reasonMessage = Object.hasOwn(SECURITY_MESSAGES, reason) ? SECURITY_MESSAGES[reason] : '';

    if (loading) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
    if (session) return <Navigate to={location.state?.from && location.state.from !== '/' ? location.state.from : '/dashboard/'} replace />;

    function update(field) {
        return (event) => setForm((previous) => ({ ...previous, [field]: field === 'parentalConsent' ? event.target.checked : event.target.value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (status.busy) return;
        setStatus({ busy: true, error: '', info: '' });
        try {
            if (mode === 'login') {
                await signIn(form.identity.trim(), form.password);
                setStatus({ busy: false, error: '', info: '' });
            } else if (mode === 'register') {
                const data = await authRequest('register', {
                    email: form.identity.trim(), password: form.password,
                    fullName: form.fullName.trim(), parentalConsent: form.parentalConsent,
                });
                setStatus({ busy: false, error: '', info: data.message });
                setMode('login');
                setForm((previous) => ({ ...previous, password: '', fullName: '', parentalConsent: false }));
            } else {
                if (!form.identity.includes('@')) throw new Error('Pentru un cont de elev, cere profesorului o parolă nouă.');
                await resetPassword(form.identity.trim());
                setStatus({ busy: false, error: '', info: 'Dacă adresa există, vei primi un email cu linkul de resetare.' });
            }
        } catch (error) {
            const message = error?.message === 'Invalid login credentials'
                ? 'Username, email sau parolă incorectă.' : error?.message || 'A apărut o eroare. Încearcă din nou.';
            setStatus({ busy: false, error: message, info: '' });
        }
    }

    return (
        <div className="grid min-h-screen place-items-center bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900/40 p-4">
            <div className="w-full max-w-md animate-fade-up">
                <div className="mb-6 text-center">
                    <span className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-gold-500 text-3xl">🎵</span>
                    <h1 className="mt-4 font-display text-3xl text-white">Academy Music</h1>
                    <p className="mt-1 text-sm text-slate-400">Orgă și canto · Palatul Copiilor Pitești</p>
                </div>
                <form onSubmit={handleSubmit} className="card space-y-4">
                    {mode === 'register' && <div>
                        <label className="label" htmlFor="fullName">Numele elevului</label>
                        <input id="fullName" className="input" value={form.fullName} onChange={update('fullName')} maxLength={120} required autoComplete="name" />
                    </div>}
                    <div>
                        <label className="label" htmlFor="identity">
                            {mode === 'login' ? 'Username sau email' : mode === 'register' ? 'Email părinte/tutore' : 'Email profesor'}
                        </label>
                        <input id="identity" type={mode === 'login' ? 'text' : 'email'} className="input"
                            value={form.identity} onChange={update('identity')} required maxLength={254}
                            autoComplete={mode === 'login' ? 'username' : 'email'} autoCapitalize="none" spellCheck={false} />
                    </div>
                    {mode !== 'reset' && <div>
                        <label className="label" htmlFor="password">Parolă</label>
                        <input id="password" type="password" className="input" value={form.password} onChange={update('password')}
                            required autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                            minLength={mode === 'register' ? 12 : undefined} maxLength={128} />
                    </div>}
                    {mode === 'register' && <label className="flex items-start gap-3 text-sm text-slate-300">
                        <input type="checkbox" required checked={form.parentalConsent} onChange={update('parentalConsent')} className="mt-1" />
                        <span>Confirm că sunt părintele/tutorele legal și sunt de acord cu prelucrarea datelor minorului conform GDPR.</span>
                    </label>}
                    {mode === 'reset' && <p className="text-xs text-slate-400">
                        Pentru conturile elevilor fără email, contactează profesorul pentru o parolă nouă.
                    </p>}
                    {(securityError || reasonMessage) && <p role="alert" className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{securityError || reasonMessage}</p>}
                    {status.error && <p role="alert" className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{status.error}</p>}
                    {status.info && <p role="status" className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{status.info}</p>}
                    <button type="submit" className="btn-primary w-full" disabled={status.busy}>
                        {status.busy ? 'Se procesează…' : mode === 'login' ? 'Intră în cont' : mode === 'register' ? 'Înregistrează elevul' : 'Trimite linkul de resetare'}
                    </button>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                        <button type="button" className="hover:text-gold-400" disabled={status.busy} onClick={() => setMode(mode === 'login' ? 'reset' : 'login')}>
                            {mode === 'login' ? 'Am uitat parola' : 'Înapoi la autentificare'}
                        </button>
                        {mode === 'login' && <button type="button" className="hover:text-gold-400" disabled={status.busy} onClick={() => setMode('register')}>Înregistrare cu acord parental</button>}
                    </div>
                </form>
                <p className="mt-5 text-center text-xs text-slate-600">
                    Folosește contul primit de la profesor sau înregistrarea făcută de părinte/tutore.
                </p>
            </div>
        </div>
    );
}
