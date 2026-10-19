import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useStudyAccess } from '../lib/useStudyAccess';

export default function StudentQuizPlayer({ quizId }) {
    return <QuizAttempt key={quizId} quizId={quizId} />;
}

function QuizAttempt({ quizId }) {
    const { canWrite } = useStudyAccess();
    const [questions, setQuestions] = useState(null);
    const [title, setTitle] = useState('Quiz');
    const [answers, setAnswers] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const attemptRef = useRef(null);
    const busyRef = useRef(false);
    const clickRef = useRef(false);

    useEffect(() => {
        let active = true;
        async function load() {
            try {
                if (!isSupabaseConfigured) throw new Error('Conexiunea Supabase nu este configurată.');
                const [quiz, items] = await Promise.all([
                    supabase.from('quizzes').select('title').eq('id', quizId).single(),
                    supabase.from('quiz_questions').select('id,prompt,options,position').eq('quiz_id', quizId).order('position'),
                ]);
                if (quiz.error || items.error) throw new Error('Test indisponibil. Autentifică-te sau verifică migrarea quiz-urilor.');
                if (!items.data.length) throw new Error('Testul nu are întrebări.');
                if (active) { setTitle(quiz.data.title); setQuestions(items.data); }
            } catch (failure) { if (active) setError(failure.message); }
        }
        load();
        return () => { active = false; };
    }, [quizId]);

    useEffect(() => { clickRef.current = false; }, [answers.length]);

    async function save(finalAnswers) {
        if (!canWrite || busyRef.current) return;
        busyRef.current = true;
        setSaving(true);
        setError('');
        try {
            const { data: auth, error: authError } = await supabase.auth.getUser();
            if (authError || !auth.user) throw new Error('Autentifică-te pentru a salva rezultatul.');
            attemptRef.current ||= crypto.randomUUID();
            const payload = { user_id: auth.user.id, quiz_id: quizId, answers: finalAnswers, attempt_id: attemptRef.current, score: 0, total: questions.length };
            let { data, error: insertError } = await supabase.from('quiz_results').insert(payload).select('score,total').single();
            if (insertError?.code === '23505') {
                const previous = await supabase.from('quiz_results').select('score,total').eq('user_id', auth.user.id).eq('attempt_id', attemptRef.current).single();
                data = previous.data;
                insertError = previous.error;
            }
            if (insertError) throw new Error('Rezultatul nu a fost salvat. Verifică conexiunea și reîncearcă.');
            setResult({ ...data, percentage: Math.round(data.score / data.total * 100) });
        } catch (failure) { setError(failure.message); }
        finally { busyRef.current = false; setSaving(false); }
    }

    function answer(optionIndex) {
        if (clickRef.current || busyRef.current || answers.length >= questions.length) return;
        clickRef.current = true;
        const next = [...answers, optionIndex];
        setAnswers(next);
        if (next.length === questions.length) void save(next);
    }

    const finished = questions && answers.length === questions.length;
    const question = questions?.[answers.length];
    return (
        <section className="not-prose space-y-4 rounded-lg border border-white/10 bg-ink-900 p-5" aria-label={title}>
            <h2 className="text-xl text-white">{title}</h2>
            {error && <p role="alert" className="text-brand-300">{error}</p>}
            {!questions && !error && <p role="status">Se încarcă testul…</p>}
            {question && <>
                <p className="text-sm text-slate-400">{answers.length + 1} / {questions.length}</p>
                <fieldset key={question.id}>
                    <legend className="mb-4 text-lg font-semibold text-white">{question.prompt}</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {question.options.map((option, index) => <button key={index} type="button" disabled={!canWrite} className="rounded-lg border border-white/20 px-4 py-3 text-left text-slate-100 transition hover:border-gold-400 hover:bg-gold-500/10" onClick={() => answer(index)}>{option}</button>)}
                    </div>
                </fieldset>
            </>}
            {finished && <div aria-live="polite">
                {saving && <p>Se calculează rezultatul…</p>}
                {result && <p className="text-2xl font-bold text-gold-400">{result.score} / {result.total} · {result.percentage}%</p>}
                {result ? <button type="button" className="btn-ghost mt-4" onClick={() => { setAnswers([]); setResult(null); setError(''); attemptRef.current = null; }}><RotateCcw size={18} /> Reia testul</button>
                    : <button type="button" disabled={saving} className="btn-primary mt-4" onClick={() => void save(answers)}><Save size={18} /> Reîncearcă salvarea</button>}
            </div>}
        </section>
    );
}