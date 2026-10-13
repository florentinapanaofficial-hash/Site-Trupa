import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import AdminOverview from './AdminOverview';
import AdminPieces from './AdminPieces';
import AdminResources from './AdminResources';
import AdminStudents from './AdminStudents';
import AdminActivity from './AdminActivity';
import AdminSubmissions from './AdminSubmissions';
import AdminTeaching from './AdminTeaching';

const TABS = [
    { to: '/admin', label: 'Sumar', end: true },
    { to: '/admin/predare', label: 'Predare' },
    { to: '/admin/piese', label: 'Piese' },
    { to: '/admin/resurse', label: 'RED' },
    { to: '/admin/elevi', label: 'Elevi' },
    { to: '/admin/teme', label: 'Teme' },
    { to: '/admin/activitate', label: 'Activitate' },
];

export default function AdminPanel() {
    return (
        <div className="space-y-6">
            <header className="card bg-gradient-to-br from-gold-500/10 to-ink-900">
                <p className="text-xs uppercase tracking-widest text-gold-400">Acces profesor</p>
                <h1 className="mt-1 font-display text-3xl text-white">Panou de control</h1>
                <p className="mt-1 text-sm text-slate-400">
                    Adaugă materiale, gestionează elevii și urmărește activitatea pe platformă.
                </p>
            </header>

            <nav className="flex flex-wrap gap-2">
                {TABS.map((tab) => (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        end={tab.end}
                        className={({ isActive }) =>
                            `rounded-xl px-4 py-2 text-sm font-semibold transition ${isActive
                                ? 'bg-gold-500 text-ink-950'
                                : 'border border-white/15 text-slate-400 hover:text-slate-100'
                            }`
                        }
                    >
                        {tab.label}
                    </NavLink>
                ))}
            </nav>

            <Routes>
                <Route index element={<AdminOverview />} />
                <Route path="predare" element={<AdminTeaching />} />
                <Route path="piese" element={<AdminPieces />} />
                <Route path="resurse" element={<AdminResources />} />
                <Route path="elevi" element={<AdminStudents />} />
                <Route path="teme" element={<AdminSubmissions />} />
                <Route path="activitate" element={<AdminActivity />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
        </div>
    );
}
