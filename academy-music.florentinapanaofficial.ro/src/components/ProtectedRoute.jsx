import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Spinner from './ui/Spinner';

export default function ProtectedRoute({ children, requireTeacher = false }) {
    const { session, profile, loading, isTeacher } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Spinner label="Se verifică sesiunea…" />
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    // Profilul se creează printr-un trigger pe `auth.users`; dacă lipsește, contul e incomplet.
    if (!profile) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6">
                <div className="card max-w-md text-center">
                    <h1 className="text-xl font-semibold">Profil incomplet</h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Contul există, dar profilul nu a fost creat. Deconectează-te și autentifică-te din
                        nou; dacă mesajul persistă, anunță profesorul.
                    </p>
                </div>
            </div>
        );
    }

    if (profile && !profile.is_active) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6">
                <div className="card max-w-md text-center">
                    <h1 className="text-xl font-semibold">Cont dezactivat</h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Contul tău a fost dezactivat de profesor. Contactează doamna Florentina Pană pentru
                        reactivare.
                    </p>
                </div>
            </div>
        );
    }

    // Garda din interfață dublează RLS-ul; baza de date rămâne sursa de adevăr.
    if (requireTeacher && !isTeacher) {
        return <Navigate to="/" replace />;
    }

    return children;
}
