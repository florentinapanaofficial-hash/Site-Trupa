import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Discipline from './pages/Discipline';
import Canto from './pages/Canto';
import Red from './pages/Red';
import Jocuri from './pages/Jocuri';
import Portofoliu from './pages/Portofoliu';
import RepertoriulMeu from './pages/RepertoriulMeu';
import SetupRequired from './pages/SetupRequired';
import AdminPanel from './pages/admin/AdminPanel';
import NotFound from './pages/NotFound';
import OnlineClasses from './pages/OnlineClasses';
import LiveClass from './components/LiveClass';
import { isSupabaseConfigured } from './lib/supabase';

export default function App() {
    if (!isSupabaseConfigured) {
        return <SetupRequired />;
    }

    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route path="/" element={<Dashboard />} />
                <Route path="/repertoriul-meu" element={<RepertoriulMeu />} />
                <Route path="/cursuri-online/" element={<OnlineClasses />} />
                <Route path="/cursuri-online/:groupId/" element={<LiveClass />} />
                <Route
                    path="/orga"
                    element={
                        <ProtectedRoute>
                            <Discipline discipline="orga" />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/canto"
                    element={
                        <ProtectedRoute>
                            <Canto />
                        </ProtectedRoute>
                    }
                />
                <Route path="/red" element={<Red />} />
                <Route path="/jocuri" element={<Jocuri />} />
                <Route path="/portofoliu" element={<Portofoliu />} />
                <Route
                    path="/admin/*"
                    element={
                        <ProtectedRoute requireTeacher>
                            <AdminPanel />
                        </ProtectedRoute>
                    }
                />
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
        </Routes>
    );
}
