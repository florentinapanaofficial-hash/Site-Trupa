import { useNavigate } from 'react-router-dom';
import { useTeacherMode } from '../lib/useTeacherMode';

/**
 * Comutatorul schimbă doar perspectiva din interfață. Drepturile reale vin din
 * rolul salvat în `profiles` și din politicile RLS.
 */
export default function TeacherModeToggle() {
    const [teacherMode, setTeacherMode] = useTeacherMode();
    const navigate = useNavigate();

    function toggle() {
        const next = !teacherMode;
        setTeacherMode(next);
        navigate(next ? '/admin' : '/', { replace: false });
    }

    return (
        <div className="flex items-center justify-between gap-3">
            <div>
                <p className="text-sm font-semibold text-gold-400">Mod profesor</p>
                <p className="text-xs text-slate-400">
                    {teacherMode ? 'Panou de administrare activ' : 'Vezi platforma ca un elev'}
                </p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={teacherMode}
                onClick={toggle}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${teacherMode ? 'bg-gold-500' : 'bg-white/20'
                    }`}
            >
                <span className="sr-only">Comută modul profesor</span>
                <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${teacherMode ? 'left-[22px]' : 'left-0.5'
                        }`}
                />
            </button>
        </div>
    );
}
