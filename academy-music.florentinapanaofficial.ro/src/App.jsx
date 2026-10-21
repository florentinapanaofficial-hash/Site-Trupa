import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SetupRequired from './pages/SetupRequired';
import NotFound from './pages/NotFound';
import Spinner from './components/ui/Spinner';
import { isSupabaseConfigured } from './lib/supabase';

const ScoreLibrary = lazy(() => import('./pages/ScoreLibrary'));
const Discipline = lazy(() => import('./pages/Discipline'));
const Canto = lazy(() => import('./pages/Canto'));
const VirtualPiano = lazy(() => import('./components/VirtualPiano'));
const Red = lazy(() => import('./pages/Red'));
const Jocuri = lazy(() => import('./pages/Jocuri'));
const Portofoliu = lazy(() => import('./pages/Portofoliu'));
const RepertoriulMeu = lazy(() => import('./pages/RepertoriulMeu'));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));
const OnlineClasses = lazy(() => import('./pages/OnlineClasses'));
const LiveClass = lazy(() => import('./components/LiveClass'));

export default function App() {
    if (!isSupabaseConfigured) return <SetupRequired />;
    return (
        <Suspense fallback={<div className="grid min-h-64 place-items-center"><Spinner label="Se încarcă spațiul de studiu…" /></div>}>
            <Routes>
                <Route path="/login/" element={<Login />} />
                <Route path="/register/" element={<Login />} />
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="/dashboard/" element={<Dashboard />} />
                    <Route path="/" element={<Navigate to="/dashboard/" replace />} />
                    <Route path="/canto/" element={<Canto />} />
                    <Route path="/instrument/" element={<Discipline discipline="orga" />} />
                    <Route path="/instrument/partituri/" element={<ScoreLibrary />} />
                    <Route path="/instrument/claviatura/" element={<VirtualPiano />} />
                    <Route path="/orga/" element={<Navigate to="/instrument/" replace />} />
                    <Route path="/repertoriul-meu/" element={<RepertoriulMeu />} />
                    <Route path="/cursuri-online/" element={<OnlineClasses />} />
                    <Route path="/cursuri-online/:groupId/" element={<LiveClass />} />
                    <Route path="/red/" element={<Red />} />
                    <Route path="/jocuri/" element={<Jocuri />} />
                    <Route path="/portofoliu/" element={<Portofoliu />} />
                    <Route path="/admin/*" element={<ProtectedRoute requireTeacher><AdminPanel /></ProtectedRoute>} />
                    <Route path="/404/" element={<NotFound />} />
                    <Route path="*" element={<Navigate to="/404/" replace />} />
                </Route>
            </Routes>
        </Suspense>
    );
}
