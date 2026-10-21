import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';

export default function AIGamePlayer() {
    const { profile, session } = useAuth();
    const [topic, setTopic] = useState('teorie');
    const [level, setLevel] = useState('incepator');
    const [game, setGame] = useState(null);
    const [index, setIndex] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [storageWarning, setStorageWarning] = useState('');
    const [savedId, setSavedId] = useState(null);
    const action = useRef(false);
    const requestRef = useRef(null);
    const alive = useRef(true);
    const storageKey = 'academy-ai-game:' + profile.id;

    function remember(id) {
        setSavedId(id);
        try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey); }
        catch { setStorageWarning('Browserul nu permite memorarea jocului pentru reîncărcare. Scorul rămâne salvat pe server.'); }
    }
    async function api(body, signal) {
        const response = await fetch('/api/games/generate/', {
            method: 'POST', credentials: 'same-origin', signal,
            headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}) },
            body: JSON.stringify(body),
        });
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Serverul nu a returnat răspunsul API pentru jocuri. Verifică autentificarea și configurația.');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Jocul nu este disponibil. Încearcă din nou.');
        return data;
    }
    function restore(value) {
        setGame(value); setSelected(null);
        if (value.completed) { setIndex(value.questions.length); setFeedback(null); }
        else if (value.answers.length) { setIndex(value.answers.length - 1); setFeedback(value.answers.at(-1)); }
        else { setIndex(0); setFeedback(null); }
    }
    useEffect(() => {
        alive.current = true;
        const controller = new AbortController();
        let active = true;
        let id;
        try { id = sessionStorage.getItem(storageKey); }
        catch { setStorageWarning('Browserul nu permite recuperarea automată a jocului.'); }
        if (id) {
            setSavedId(id);
            api({ action: 'resume', gameId: id }, controller.signal).then(data => { if (active) restore(data.game); }).catch(e => { if (active && e.name !== 'AbortError') setError(e.message); }).finally(() => { if (active) setLoading(false); });
        } else setLoading(false);
        return () => { active = false; alive.current = false; controller.abort(); requestRef.current?.abort(); };
    }, [storageKey]);
    async function run(task) {
        if (action.current) return;
        action.current = true; setBusy(true); setError('');
        const controller = new AbortController(); requestRef.current = controller;
        try { await task(controller.signal); }
        catch (e) { if (alive.current && e.name !== 'AbortError') setError(e.message); }
        finally { action.current = false; if (alive.current) setBusy(false); }
    }
    function generate(event) {
        event.preventDefault();
        void run(async signal => {
            const data = await api({ action: 'generate', topic, level }, signal);
            if (!alive.current) return;
            restore(data.game); remember(data.game.id);
        });
    }
    function answer(answerIndex) {
        if (!game || feedback || busy) return;
        setSelected(answerIndex);
        void run(async signal => {
            const data = await api({ action: 'answer', gameId: game.id, questionIndex: index, answerIndex }, signal);
            if (!alive.current) return;
            setFeedback(data);
            setGame(current => ({ ...current, score: data.score, completed: data.completed, answers: [...current.answers.slice(0, index), data] }));
        });
    }
    function resume() {
        if (!savedId) return;
        void run(async signal => { const data = await api({ action: 'resume', gameId: savedId }, signal); if (alive.current) restore(data.game); });
    }
    function close() { remember(null); setGame(null); setFeedback(null); setSelected(null); setError(''); setIndex(0); }
    const finished = game && index >= game.questions.length;
    const question = game?.questions[index];
    return <section className="card space-y-5" aria-label="Joc muzical AI" aria-busy={busy || loading}>
        <h2 className="font-display text-2xl text-white">✨ Antrenament muzical cu AI</h2>
        <p>Cinci întrebări noi, cu explicații după fiecare răspuns. Exersează în ritmul tău; scorul se salvează în cont, separat de dueluri și clasament.</p>
        <p className="text-sm text-slate-400">Conținut generat automat — AI poate greși. Dacă o explicație pare neclară, discut-o cu profesorul. Trimitem către OpenAI numai tema și nivelul, fără nume, voce sau alte date din profil.</p>
        <p className="text-xs text-slate-400">Maximum un joc nou pe minut și 10 generări în 24 de ore. Generările nereușite consumă o rezervare; răspunsurile și reluarea jocului nu cer un nou apel AI.</p>
        {loading && <p role="status">Se verifică jocul salvat…</p>}
        {error && <div role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-rose-100">{error}
            {savedId && <button type="button" className="ml-2 underline" onClick={resume} disabled={busy}>Reîncarcă jocul salvat</button>}
        </div>}
        {storageWarning && <p role="status" className="text-amber-200">{storageWarning}</p>}
        {!game && !loading && <form onSubmit={generate} className="space-y-3" aria-label="Generează un quiz AI">
            <label className="block">Tema quiz-ului<select className="input mt-1 w-full" aria-label="Tema quiz-ului" value={topic} onChange={e => setTopic(e.target.value)} disabled={busy}>
                <option value="teorie">Teorie muzicală</option><option value="instrumente">Instrumente muzicale</option><option value="ritm">Ritm și măsuri</option>
            </select></label>
            <label className="block">Nivel<select className="input mt-1 w-full" aria-label="Nivel" value={level} onChange={e => setLevel(e.target.value)} disabled={busy}>
                <option value="incepator">Începător</option><option value="mediu">Intermediar</option>
            </select></label>
            <button className="btn-gold" disabled={busy}>{busy ? 'AI pregătește exercițiile…' : 'Generează un joc nou'}</button>
            {savedId && <button type="button" className="btn-ghost ml-2" onClick={close} disabled={busy}>Renunță la reluarea jocului anterior</button>}
        </form>}
        {game && <>
            <header className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold text-white">{game.title}</h3><p>Scor salvat: <strong>{game.score} / {game.questions.length}</strong></p></header>
            {question && <div className="space-y-4">
                <p className="text-sm text-slate-400">Întrebarea {index + 1} din {game.questions.length}</p>
                <h4 className="text-xl text-white">{question.prompt}</h4>
                <div className="grid gap-3" role="group" aria-label="Variante de răspuns">
                    {question.options.map((option, answerIndex) => {
                        const correct = feedback?.correctIndex === answerIndex;
                        const chosen = (feedback?.choice ?? selected) === answerIndex;
                        return <button key={answerIndex} type="button" className={'rounded-xl border p-4 text-left font-semibold transition ' + (correct ? 'border-emerald-300 bg-emerald-500/20 text-emerald-100' : feedback && chosen ? 'border-rose-300 bg-rose-500/20 text-rose-100' : chosen ? 'border-gold-300 bg-gold-300/10' : 'border-white/15 hover:bg-white/10')} disabled={busy || !!feedback || selected !== null} onClick={() => answer(answerIndex)}>
                            {feedback && correct ? '✓ ' : feedback && chosen ? '✗ ' : ''}{option}{feedback && chosen ? ' — răspunsul tău' : ''}
                        </button>;
                    })}
                </div>
                {busy && <p role="status">Se verifică și se salvează răspunsul…</p>}
                {feedback && <div className={'space-y-2 rounded-xl p-4 ' + (feedback.correct ? 'bg-emerald-500/15' : 'bg-amber-400/10')} role="status">
                    <p className="font-bold">{feedback.correct ? 'Bravo, răspuns corect!' : 'Mai învățăm împreună! Răspunsul corect: ' + question.options[feedback.correctIndex]}</p>
                    <p>{feedback.explanation}</p>
                </div>}
                {feedback && <button type="button" className="btn-gold" onClick={() => { setIndex(index + 1); setFeedback(null); setSelected(null); setError(''); }}>{index + 1 === game.questions.length ? 'Vezi rezultatul' : 'Întrebarea următoare'}</button>}
                {!feedback && selected !== null && !busy && error && <button type="button" className="btn-gold" onClick={() => answer(selected)}>Reîncearcă același răspuns</button>}
            </div>}
            {finished && <div role="status" className="space-y-3 rounded-2xl bg-brand-500/20 p-5 text-center">
                <h3 className="text-2xl font-bold text-white">🎵 Joc încheiat! {game.score} din {game.questions.length} răspunsuri corecte.</h3>
                <p>{game.score === game.questions.length ? 'Excelent! Ai rezolvat toate exercițiile.' : 'Fiecare rundă te ajută să înveți. Revino la noțiunile pe care vrei să le consolidezi.'}</p>
                <p>Rezultatul a fost salvat în cont.</p>
                <button type="button" className="btn-gold" onClick={close}>Alege un alt antrenament</button>
            </div>}
            {!finished && <button type="button" className="btn-ghost" onClick={close} disabled={busy}>Închide jocul (răspunsurile confirmate rămân salvate)</button>}
        </>}
    </section>;
}
