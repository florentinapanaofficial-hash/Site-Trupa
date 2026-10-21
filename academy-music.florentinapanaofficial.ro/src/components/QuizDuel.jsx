import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { gameRpc } from '../lib/games';
import Avatar from './Avatar';

export default function QuizDuel({ profileRevision }) {
    const { profile } = useAuth();
    const [quizzes, setQuizzes] = useState([]);
    const [libraryError, setLibraryError] = useState('');
    const [libraryReady, setLibraryReady] = useState(false);
    const [libraryRevision, setLibraryRevision] = useState(0);
    const [opponents, setOpponents] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [quiz, setQuiz] = useState('');
    const [opponent, setOpponent] = useState('');
    const [seconds, setSeconds] = useState(20);
    const [code, setCode] = useState('');
    const [roomId, setRoomId] = useState(null);
    const [room, setRoom] = useState(null);
    const [error, setError] = useState('');
    const [syncError, setSyncError] = useState('');
    const [inboxError, setInboxError] = useState('');
    const [busy, setBusy] = useState(false);
    const [connected, setConnected] = useState(false);
    const [clock, setClock] = useState(0);
    const [choice, setChoice] = useState(null);
    const actionBusy = useRef(false);
    const sync = useRef(null);
    const timing = useRef({ received:0, server:0 });
    const refreshInbox = useRef(null);
    const loadLibrary = useCallback(async () => {
        const [{data,error:e},players] = await Promise.all([
            supabase.from('quizzes').select('id,title').eq('is_published',true).order('title'), gameRpc('game_opponents'),
        ]);
        if (e) throw e;
        return { quizzes:data, opponents:players };
    },[]);
    useEffect(() => {
        let active=true;
        setLibraryError(''); setLibraryReady(false);
        loadLibrary().then(data=>{
            if(active){
                setQuizzes(data.quizzes); setOpponents(data.opponents);
                setQuiz(current=>data.quizzes.some(q=>q.id===current) ? current : data.quizzes[0]?.id || '');
                setOpponent(current=>data.opponents.some(p=>p.user_id===current) ? current : '');
                setLibraryReady(true);
            }
        }).catch(e=>{if(active)setLibraryError(e.message);});
        return ()=>{active=false;};
    },[loadLibrary,profileRevision,libraryRevision]);
    useEffect(() => {
        let active=true; let running=false;
        async function load() {
            if (running) return; running=true;
            try {
                const data=await gameRpc('game_live_inbox');
                if(active){setRooms(data);setInboxError('');}
            } catch(e){if(active)setInboxError(e.message);} finally {running=false;}
        }
        refreshInbox.current=load; void load();
        const timer=setInterval(load,5000);
        const channel=supabase.channel('duel-inbox:'+profile.id).on('postgres_changes',{event:'*',schema:'public',table:'live_quiz_rooms'},()=>void load()).subscribe();
        return ()=>{active=false;clearInterval(timer);void supabase.removeChannel(channel);};
    },[profile.id]);
    useEffect(() => {
        if (!roomId) {setRoom(null);return undefined;}
        let active=true; let running=false;
        setRoom(null);setSyncError('');setConnected(false);
        async function load() {
            if(running) return; running=true;
            try {
                const data=await gameRpc('game_live_state',{p_room:roomId});
                if(active){timing.current={received:performance.now(),server:Date.parse(data.server_now)};setRoom(data);setSyncError('');setClock(performance.now());}
            } catch(e){if(active)setSyncError(e.message);} finally {running=false;}
        }
        sync.current=load; void load();
        const interval=setInterval(load,2000);
        const channel=supabase.channel('duel:'+roomId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_quiz_rooms',filter:'id=eq.'+roomId},()=>void load()).subscribe(status=>{if(active)setConnected(status==='SUBSCRIBED');});
        const onFocus=()=>void load(); window.addEventListener('focus',onFocus);
        return ()=>{active=false;sync.current=null;clearInterval(interval);window.removeEventListener('focus',onFocus);void supabase.removeChannel(channel);};
    },[roomId]);
    useEffect(()=>{const timer=setInterval(()=>setClock(performance.now()),250);return()=>clearInterval(timer);},[]);
    useEffect(()=>{setChoice(null);setError('');},[room?.question_index,roomId]);
    async function act(task) {
        if(actionBusy.current)return;
        actionBusy.current=true;setBusy(true);setError('');
        try{await task();await sync.current?.();await refreshInbox.current?.();}
        catch(e){setError(e.message);await sync.current?.();}
        finally{actionBusy.current=false;setBusy(false);}
    }
    function accept(inviteCode){void act(async()=>{const id=await gameRpc('game_live_join',{p_code:inviteCode});setRoomId(id);});}
    const remaining=room?.deadline ? Math.max(0,Math.ceil((Date.parse(room.deadline)-timing.current.server-(clock-timing.current.received))/1000)) : 0;
    const players=room?.players || [];
    const best=Math.max(0,...players.map(p=>p.points));
    const winner=players.filter(p=>p.points===best);
    return <section className="card space-y-5" aria-label="Dueluri quiz">
        <h2 className="font-display text-2xl text-white">⚔️ Provoacă un coleg la duel</h2>
        <p className="text-sm text-slate-400">Alege un quiz pregătit. Invitația trebuie acceptată în 10 minute. Jucați aceleași întrebări, simultan, fără profesor: 100 de puncte / răspuns corect, fără bonus de viteză. După ambele răspunsuri sau expirarea timpului urmează 4 secunde de recapitulare.</p>
        {inboxError && <p role="alert" className="text-red-300">{inboxError}</p>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {!roomId && <>
            <button className="btn-ghost" onClick={()=>setLibraryRevision(x=>x+1)}>Actualizează quiz-urile și adversarii</button>
            {libraryError && <p role="alert" className="text-red-300">{libraryError}</p>}
            {!libraryReady && !libraryError && <p role="status">Se încarcă quiz-urile și adversarii…</p>}
            <form className="space-y-3" aria-label="Creează un duel" onSubmit={event=>{event.preventDefault();void act(async()=>{const data=await gameRpc('game_live_create',{p_quiz:quiz,p_opponent:opponent || null,p_seconds:Number(seconds)});setRoomId(data.id);});}}>
                <label className="block">Quiz pregătit<select className="input mt-1 w-full" aria-label="Quiz pregătit" value={quiz} onChange={e=>setQuiz(e.target.value)} required><option value="">Alege quiz-ul</option>{quizzes.map(q=><option key={q.id} value={q.id}>{q.title}</option>)}</select></label>
                <label className="block">Adversar<select className="input mt-1 w-full" aria-label="Adversar" value={opponent} onChange={e=>setOpponent(e.target.value)}><option value="">Invitație prin cod</option>{opponents.map(p=><option key={p.user_id} value={p.user_id}>{p.alias}</option>)}</select></label>
                {opponent && <div className="flex items-center gap-3"><Avatar path={opponents.find(p=>p.user_id===opponent)?.avatar_path} name={opponents.find(p=>p.user_id===opponent)?.alias} /><span>{opponents.find(p=>p.user_id===opponent)?.alias}</span></div>}
                <label className="block">Secunde / întrebare<select className="input ml-2" aria-label="Secunde / întrebare" value={seconds} onChange={e=>setSeconds(e.target.value)}>{[10,20,30,60].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
                <button className="btn-gold" disabled={busy || !quiz || !libraryReady}>{busy ? 'Se trimite…' : 'Trimite provocarea'}</button>
                {libraryReady && quizzes.length===0 && <p role="status">Nu sunt quiz-uri publicate. Profesorul trebuie să instaleze banca de quiz-uri înainte de primul duel.</p>}
            </form>
            <form className="flex flex-wrap gap-2" onSubmit={event=>{event.preventDefault();accept(code);}}>
                <label>Codul duelului<input className="input ml-2 max-w-36 uppercase" value={code} onChange={e=>setCode(e.target.value)} required minLength={8} maxLength={8} pattern="[a-fA-F0-9]{8}" /></label><button className="btn-ghost" disabled={busy}>Acceptă prin cod</button>
            </form>
            <h3 className="text-lg font-semibold">Invitații și duelurile mele</h3>
            <button className="btn-ghost" onClick={()=>void refreshInbox.current?.()}>Verifică invitațiile</button>
            {rooms.length===0 && <p>Nicio provocare încă. Invitațiile noi apar automat aici.</p>}
            <ul className="space-y-2">{rooms.map(r=><li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-3">
                <span className="min-w-0 break-words">{r.title} · {r.code} · {r.status==='lobby' ? r.opponent_id===profile.id ? 'Ai fost provocat!' : 'Așteaptă acceptarea' : r.status==='completed' ? 'Încheiat' : 'În desfășurare'}</span>
                {r.status==='lobby' && r.opponent_id===profile.id ? <><button className="btn-gold" disabled={busy} onClick={()=>accept(r.code)}>Acceptă duelul</button><button className="btn-ghost" disabled={busy} onClick={()=>void act(()=>gameRpc('game_live_cancel',{p_room:r.id}))}>Refuză</button></> : <button className="btn-ghost" onClick={()=>setRoomId(r.id)}>Deschide duelul</button>}
            </li>)}</ul>
        </>}
        {roomId && <>
            <button className="btn-ghost" onClick={()=>{setRoomId(null);setError('');}}>Înapoi la invitații</button>
            <p className="text-xs text-slate-400" role="status">{connected ? 'Conectat Realtime · verificare suplimentară la 2 secunde.' : 'Sincronizare periodică la 2 secunde; conexiunea Realtime se reface.'}</p>
            {syncError && <p role="alert" className="text-red-300">{syncError} <button className="underline" onClick={()=>void sync.current?.()}>Reîncearcă sincronizarea</button></p>}
            {!room && !syncError && <p role="status">Se deschide duelul…</p>}
            {room && <>
                <h3 className="text-xl font-bold text-white">{room.title}</h3>
                {room.status==='lobby' && <div className="space-y-3 rounded-xl bg-brand-500/20 p-4"><p>Cod de invitație: <strong className="font-mono text-2xl">{room.code}</strong></p><p>Așteptăm adversarul. Când acceptă, duelul începe automat.</p><button className="btn-ghost" disabled={busy} onClick={()=>void act(()=>gameRpc('game_live_cancel',{p_room:room.id}))}>Anulează invitația</button></div>}
                {room.question && <div className="space-y-3" aria-label="Întrebarea duelului">
                    <p>Întrebarea {room.question_index+1} / {room.total} · {room.status==='question' ? remaining+' secunde' : room.status==='review' ? 'Recapitulare' : 'Ultima întrebare'}</p>
                    <h4 className="text-xl text-white">{room.question.prompt}</h4>
                    <fieldset className="space-y-2" disabled={busy || !!syncError || room.status!=='question' || room.answer!==null || remaining===0}>
                        <legend className="sr-only">Alege răspunsul</legend>
                        {room.question.options.map((option,index)=><label key={index} className={'flex gap-3 rounded-xl border p-3 '+(room.question.correct_option===index ? 'border-emerald-400 bg-emerald-500/20' : 'border-white/15')}><input type="radio" name="duel-answer" checked={(room.answer ?? choice)===index} onChange={()=>setChoice(index)} />{option}</label>)}
                    </fieldset>
                    {room.status==='question' && room.answer===null && <button className="btn-gold" disabled={busy || !!syncError || choice===null || remaining===0} onClick={()=>void act(()=>gameRpc('game_live_answer',{p_room:room.id,p_position:room.question_index,p_choice:choice}))}>Validează răspunsul</button>}
                    <p role="status">{room.status==='question' ? room.answer!==null ? 'Răspuns înregistrat. Așteptăm adversarul sau expirarea timpului.' : remaining===0 ? 'Timp expirat. Se sincronizează rezultatul…' : 'Alege și confirmă un singur răspuns.' : room.status==='review' ? 'Urmează automat întrebarea următoare.' : ''}</p>
                </div>}
                {room.status==='completed' && <h3 className="text-2xl text-gold-300" role="status">{room.question_index<0 ? 'Invitație închisă.' : winner.length>1 ? '🤝 Egalitate!' : '🏆 Câștigător: '+winner[0]?.alias}</h3>}
                <ul className="space-y-2" aria-label="Scorul duelului">{players.map(p=><li key={p.user_id} className="flex justify-between gap-2 rounded-xl bg-white/5 p-3"><span className="break-words">{p.alias}{p.user_id===profile.id ? ' (tu)' : ''}</span><strong className="shrink-0">{p.points} pct</strong></li>)}</ul>
            </>}
        </>}
    </section>;
}
