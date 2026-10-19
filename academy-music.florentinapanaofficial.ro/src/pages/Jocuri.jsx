import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import games from '../data/games.json';

export default function Jocuri() {
    const [tab, setTab] = useState('quiz');

    return (
        <div className="space-y-6">
            <header className="card">
                <span className="text-3xl" aria-hidden="true">
                    🧩
                </span>
                <h1 className="mt-2 font-display text-3xl text-white">Jocuri muzicale</h1>
                <p className="mt-1 text-sm text-slate-400">
                    Verifică-ți cunoștințele de teorie și dezleagă rebusul. Scorul la quiz se salvează
                    automat.
                </p>
            </header>

            <div className="flex gap-2">
                {[
                    { id: 'quiz', label: '❓ Quiz' },
                    { id: 'rebus', label: '🔡 Rebus' },
                ].map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === item.id
                            ? 'bg-brand-500 text-white'
                            : 'border border-white/15 text-slate-400 hover:text-slate-100'
                            }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === 'quiz' ? <Quiz /> : <Rebus />}
        </div>
    );
}

function Quiz() {
    const { profile, isInspector } = useAuth();
    const quiz = games.quiz;
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);

    const score = useMemo(
        () => quiz.questions.reduce((sum, q, index) => sum + (answers[index] === q.answer ? 1 : 0), 0),
        [answers, quiz.questions]
    );

    async function finish() {
        if (isInspector) { setSubmitted(true); return; }
        setSaving(true);
        setSubmitted(true);
        await supabase.from('quiz_results').insert({
            user_id: profile.id,
            quiz_id: quiz.id,
            score,
            total: quiz.questions.length,
        });
        setSaving(false);
    }

    function reset() {
        setAnswers({});
        setSubmitted(false);
    }

    return (
        <div className="space-y-4">
            {quiz.questions.map((question, index) => {
                const picked = answers[index];
                return (
                    <fieldset key={question.q} className="card">
                        <legend className="mb-3 text-sm font-semibold text-slate-200">
                            <span className="mr-2 text-gold-400">{index + 1}.</span>
                            {question.q}
                        </legend>

                        <div className="grid gap-2 sm:grid-cols-2">
                            {question.options.map((option, optionIndex) => {
                                const isPicked = picked === optionIndex;
                                const isCorrect = question.answer === optionIndex;
                                let style = 'border-white/15 text-slate-300 hover:border-white/35';
                                if (submitted && isCorrect) style = 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200';
                                else if (submitted && isPicked) style = 'border-brand-400/60 bg-brand-500/10 text-brand-200';
                                else if (isPicked) style = 'border-gold-400/60 bg-gold-500/10 text-gold-400';

                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        disabled={submitted}
                                        onClick={() => setAnswers((prev) => ({ ...prev, [index]: optionIndex }))}
                                        className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${style}`}
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>

                        {submitted && <p className="mt-3 text-xs text-slate-400">{question.explain}</p>}
                    </fieldset>
                );
            })}

            <div className="card flex flex-wrap items-center justify-between gap-3">
                {submitted ? (
                    <>
                        <p className="text-lg font-semibold text-white">
                            Scor: {score} / {quiz.questions.length}{' '}
                            <span className="text-sm font-normal text-slate-400">
                                {isInspector ? '(local)' : saving ? '(se salvează…)' : '(salvat)'}
                            </span>
                        </p>
                        <button type="button" className="btn-ghost" onClick={reset}>
                            Reia quizul
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-slate-400">
                            Răspunsuri completate: {Object.keys(answers).length} / {quiz.questions.length}
                        </p>
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={finish}
                            disabled={Object.keys(answers).length !== quiz.questions.length}
                        >
                            Vezi rezultatul
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function Rebus() {
    const rebus = games.rebus;
    const [values, setValues] = useState(() => rebus.rows.map((row) => Array(row.answer.length).fill('')));
    const [checked, setChecked] = useState(false);

    function setLetter(rowIndex, letterIndex, letter) {
        setValues((prev) => {
            const next = prev.map((row) => [...row]);
            next[rowIndex][letterIndex] = letter.toUpperCase().slice(-1);
            return next;
        });
    }

    const solvedRows = rebus.rows.map(
        (row, index) => values[index].join('') === row.answer.toUpperCase()
    );
    const allSolved = solvedRows.every(Boolean);

    return (
        <div className="space-y-4">
            <div className="card">
                <h2 className="text-lg font-semibold text-white">{rebus.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{rebus.hint}</p>
            </div>

            <div className="card space-y-3 overflow-x-auto">
                {rebus.rows.map((row, rowIndex) => (
                    <div key={row.answer} className="flex items-center gap-3">
                        <span className="w-6 shrink-0 text-right text-xs text-slate-500">{rowIndex + 1}</span>
                        <div className="flex gap-1">
                            {Array.from({ length: row.answer.length }).map((_, letterIndex) => {
                                const isKey = letterIndex === row.keyIndex;
                                const value = values[rowIndex][letterIndex];
                                const wrong = checked && !solvedRows[rowIndex] && value;
                                return (
                                    <input
                                        key={letterIndex}
                                        value={value}
                                        maxLength={1}
                                        onChange={(event) => setLetter(rowIndex, letterIndex, event.target.value)}
                                        aria-label={`Rândul ${rowIndex + 1}, litera ${letterIndex + 1}`}
                                        className={`h-9 w-9 rounded-md border text-center text-sm font-bold uppercase transition ${isKey
                                            ? 'border-gold-400/70 bg-gold-500/20 text-gold-300'
                                            : 'border-white/15 bg-ink-800 text-slate-100'
                                            } ${wrong ? 'border-brand-400/70' : ''} ${checked && solvedRows[rowIndex] ? 'border-emerald-400/70 bg-emerald-500/10' : ''
                                            }`}
                                    />
                                );
                            })}
                        </div>
                        <p className="min-w-0 flex-1 text-sm text-slate-400">{row.clue}</p>
                    </div>
                ))}
            </div>

            <div className="card flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-400">
                    Rânduri corecte: {solvedRows.filter(Boolean).length} / {rebus.rows.length}
                </p>
                <div className="flex gap-2">
                    <button type="button" className="btn-ghost" onClick={() => setChecked(true)}>
                        Verifică
                    </button>
                    <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                            setValues(rebus.rows.map((row) => Array(row.answer.length).fill('')));
                            setChecked(false);
                        }}
                    >
                        Șterge tot
                    </button>
                </div>
            </div>

            {checked && allSolved && (
                <div className="card border-emerald-400/40 bg-emerald-500/10 text-center">
                    <p className="text-lg font-semibold text-emerald-200">
                        Bravo! Cuvântul de pe coloană este {rebus.keyword}.
                    </p>
                </div>
            )}
        </div>
    );
}
