import { useState } from 'react';
import { useMyRepertoire } from '../lib/useMyRepertoire';
import DualAudioRow from '../components/DualAudioRow';
import RecordingStudio from '../components/RecordingStudio';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../lib/auth';
import { useStudyProgress } from '../lib/useStudyProgress';
import { cantoBackingPieces, isStudyLevelLocked, studyLevelLabel } from '../lib/studyLevels';
import StudyProgressNotice from '../components/StudyProgressNotice';
import Repertoire from '../components/student/Repertoire';
import { StudentHomework } from '../components/student/HomeworkSubmit';

export default function RepertoriulMeu() {
    const { profile, isInspector, isTeacher } = useAuth();
    const { rows, reload: reloadRepertoire, error: repertoireError } = useMyRepertoire();
    const studyProgress = useStudyProgress(profile, !isTeacher);
    const [studioPiece, setStudioPiece] = useState(null);
    const [lockNotice, setLockNotice] = useState('');

    return (
        <div className="space-y-6">
            <header className="card">
                <span className="text-3xl" aria-hidden="true">🎼</span>
                <h1 className="mt-2 font-display text-3xl text-white">Repertoriul meu</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">Biblioteca de studiu comună. Exersează pe negativ, apoi înregistrează-ți tema direct din platformă.</p>
            </header>

            {!isTeacher && <StudyProgressNotice state={studyProgress} />}
            {!isTeacher && !isInspector && profile?.id && <Repertoire studentId={profile.id} />}
            {!isTeacher && !isInspector && profile?.id && <StudentHomework key={profile.id} studentId={profile.id} pieces={cantoBackingPieces(rows, studyProgress.progress.unlockedLevels)} />}
            {lockNotice && <p role="status" aria-live="polite" className="rounded-lg border border-gold-400/20 bg-gold-400/10 p-3 text-sm text-gold-200">{lockNotice}</p>}
            {repertoireError && <p role="alert" className="text-sm text-brand-200">{repertoireError}</p>}
            {rows === null ? (
                <Spinner label="Se încarcă repertoriul…" />
            ) : rows.length === 0 ? (
                <EmptyState icon="🎵" title="Nu există încă piese publicate" description="Piesele de studiu vor apărea aici după ce sunt publicate de profesoară." />
            ) : (
                <div className="space-y-3">
                    {rows.map((row, index) => {
                        const locked = !isTeacher && isStudyLevelLocked(row.pieces.level, studyProgress.progress.unlockedLevels);
                        return <DualAudioRow
                            key={row.piece_id}
                            index={index}
                            piece={row.pieces}
                            locked={locked}
                            onLocked={() => setLockNotice('Info: profilul tău este ' + studyLevelLabel(studyProgress.progress.studyLevel) + '. Trimite toate temele asociate pieselor alocate nivelului curent pentru a debloca nivelul următor.')}
                            actions={!isInspector && !locked && <button type="button" className="btn-gold shrink-0 px-3 py-1.5 text-xs" onClick={() => setStudioPiece(row.pieces)}>● Înregistrează tema</button>}
                        />;
                    })}
                </div>
            )}

            <RecordingStudio
                open={Boolean(studioPiece)}
                piece={studioPiece}
                onClose={() => setStudioPiece(null)}
                onSubmitted={() => { void studyProgress.reload(); void reloadRepertoire(); }}
            />
        </div>
    );
}
