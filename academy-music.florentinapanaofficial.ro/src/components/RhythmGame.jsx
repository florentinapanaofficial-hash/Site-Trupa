import { useEffect, useRef, useState } from 'react';
import { gameRpc } from '../lib/games';
import { matchNote, rhythmScore } from '../lib/rhythm';
import { createVoice } from '../lib/piano';

const KEYS = [{ note:60, label:'Do', key:'a' },{ note:62, label:'Re', key:'s' },{ note:64, label:'Mi', key:'d' },{ note:65, label:'Fa', key:'f' },{ note:67, label:'Sol', key:'g' }];
export default function RhythmGame() {
    const run = useRef(null);
    const audio = useRef(null);
    const midi = useRef(null);
    const mounted = useRef(true);
    const pressRef = useRef(null);
    const busy = useRef(false);
    const [round, setRound] = useState(null);
    const [time, setTime] = useState(0);
    const [status, setStatus] = useState('idle');
    const [feedback, setFeedback] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [midiStatus, setMidiStatus] = useState('');
    const [localScore, setLocalScore] = useState(0);
    async function save() {
        if (!run.current || busy.current) return;
        busy.current=true; setStatus('saving'); setError('');
        try { const value=await gameRpc('game_rhythm_finish',{p_attempt:run.current.id,p_events:run.current.events}); if (mounted.current) {setResult(value); setStatus('saved');} }
        catch(e) { if (mounted.current) {setError(e.message); setStatus('unsaved');} }
        finally { busy.current=false; }
    }
    async function start() {
        if (busy.current) return;
        busy.current=true; setError(''); setResult(null); setStatus('starting');
        try {
            if (!audio.current) audio.current=new AudioContext();
            await audio.current.resume();
            const data=await gameRpc('game_rhythm_start');
            if (!mounted.current) return;
            run.current={...data,anchor:performance.now(),events:[],hits:new Set(),mistakes:0};
            setRound(data); setLocalScore(0); setTime(0); setFeedback('Pregătește-te…'); setStatus('playing');
        } catch(e) { if (mounted.current) {setError(e.message); setStatus('idle');} }
        finally { busy.current=false; }
    }
    function press(note) {
        const current=run.current;
        if (!current || status!=='playing') return;
        const position=(performance.now()-current.anchor)/1000;
        if (position>current.duration) return;
        if (current.events.length>=256) { setFeedback('Limita de 256 de apăsări a fost atinsă. Așteaptă salvarea rundei.'); return; }
        if (audio.current.state==='running') createVoice(audio.current,note,audio.current.currentTime,'piano',0.22);
        current.events.push({note,time:position});
        const hit=matchNote(current.pattern,note,position,current.hits);
        if (hit) { current.hits.add(hit.id); setFeedback('Bravo! La timp.'); } else { current.mistakes++; setFeedback('Mai încearcă — urmărește pulsul.'); }
        setLocalScore(rhythmScore(current.hits.size,current.mistakes));
    }
    pressRef.current=press;
    useEffect(() => {
        if (status!=='playing') return undefined;
        let frame; let previous=-1;
        function animate() {
            const current=run.current; const position=(performance.now()-current.anchor)/1000;
            if (position>=current.duration) { setTime(current.duration); void save(); return; }
            if (position-previous>0.04) { setTime(position); previous=position; }
            frame=requestAnimationFrame(animate);
        }
        frame=requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    },[status]);
    useEffect(() => {
        mounted.current=true;
        function keydown(event) {
            if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
            const key=KEYS.find(item=>item.key===event.key.toLowerCase());
            if (key) { event.preventDefault(); pressRef.current(key.note); }
        }
        window.addEventListener('keydown',keydown);
        return () => { mounted.current=false; window.removeEventListener('keydown',keydown); if (audio.current) {void audio.current.close(); audio.current=null;} if (midi.current) { midi.current.onstatechange=null; for (const input of midi.current.inputs.values()) input.onmidimessage=null; } };
    },[]);
    async function connectMidi() {
        try {
            if (!navigator.requestMIDIAccess) throw new Error('Web MIDI indisponibil. Folosește Chrome/Edge pe HTTPS sau clapele de pe ecran.');
            const access=await navigator.requestMIDIAccess({sysex:false});
            if (!mounted.current) return;
            midi.current=access;
            const sync=()=>{ for (const input of access.inputs.values()) input.onmidimessage=event=>{ const [command,note,velocity]=event.data; if ((command & 0xf0)===0x90 && velocity>0) pressRef.current(note); }; setMidiStatus(access.inputs.size ? 'Claviatură MIDI conectată.' : 'Nicio intrare MIDI. Conectează claviatura.'); };
            sync(); access.onstatechange=sync;
        } catch(e) { if(mounted.current) setMidiStatus(e.message); }
    }
    const active=round?.pattern.find(n=>n.time>=time-0.18 && !run.current?.hits.has(n.id));
    return <section className="card space-y-4" aria-label="Joc Ritmic">
        <h2 className="font-display text-2xl text-white">🎹 Joc Ritmic — runda de 12 note</h2>
        <p>Apasă nota când contorul ajunge la timpul indicat. Folosește A S D F G, clapele de pe ecran sau orga MIDI. Fereastra de reușită: ±180 ms.</p>
        <p className="text-sm text-slate-400">1000 × note corecte / 12, minus 20 pentru fiecare apăsare greșită. Fără bonus de viteză. Scorul este recalculat pe server din apăsările trimise; nu este o certificare anti-trișare. Rămâi aici până la confirmarea salvării.</p>
        <div className="flex flex-wrap gap-2"><button className="btn-gold" onClick={start} disabled={['starting','playing','saving','unsaved'].includes(status)}>{status==='starting' ? 'Se pregătește…' : 'Începe o rundă'}</button><button className="btn-ghost" onClick={connectMidi}>Conectează orga MIDI</button></div>
        {midiStatus && <p role="status">{midiStatus}</p>}
        {round && <>
            <div className="rounded-xl bg-brand-500/20 p-5 text-center">
                <p className="text-2xl tabular-nums">{time.toFixed(1)} / {round.duration} sec</p>
                <p className="text-3xl font-bold text-white">{status==='playing' && active ? KEYS.find(k=>k.note===active.note)?.label + ' la ' + active.time.toFixed(2) + ' s' : status==='playing' ? 'Încheiem runda…' : 'Rundă încheiată'}</p>
                <p>{localScore} puncte provizorii</p>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Notele rundei">{round.pattern.map(n=><div key={n.id} className={'rounded-lg border p-2 text-center text-sm '+(run.current?.hits.has(n.id) ? 'border-emerald-400 bg-emerald-500/20' : Math.abs(time-n.time)<=0.18 ? 'border-gold-400 bg-gold-400/20' : 'border-white/10')}>
                {KEYS.find(k=>k.note===n.note)?.label}<br/>{n.time.toFixed(2)} s
            </div>)}</div>
        </>}
        <div className="grid grid-cols-5 gap-2">{KEYS.map(k=><button key={k.note} className="min-h-24 rounded-b-xl border border-white/20 bg-white/90 font-bold text-slate-900 disabled:opacity-50" disabled={status!=='playing'} onPointerDown={event=>{event.preventDefault();press(k.note);}} onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&!event.repeat){event.preventDefault();press(k.note);}}} aria-label={'Cântă '+k.label}>{k.label}<br/><span className="text-xs">{k.key.toUpperCase()}</span></button>)}</div>
        <p role="status">{status==='playing' ? feedback : status==='saving' ? 'Se salvează rezultatul…' : result ? 'Scor salvat: '+result.score+' / 1000 · '+result.hits+'/12 note · '+result.mistakes+' greșeli.' : ''}</p>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {status==='unsaved' && <div className="flex flex-wrap gap-2"><button className="btn-gold" onClick={save}>Reîncearcă salvarea rundei</button><button className="btn-ghost" onClick={()=>{run.current=null;setRound(null);setStatus('idle');setError('');}}>Abandonează rezultatul nesalvat</button></div>}
        {status==='saved' && <p className="text-sm text-slate-400">O rundă nouă poate începe la 25 de secunde după startul celei precedente.</p>}
    </section>;
}
