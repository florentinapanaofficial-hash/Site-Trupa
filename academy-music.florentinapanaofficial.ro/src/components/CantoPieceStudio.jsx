import { useRef, useState } from 'react';
import { FileText, Pause, Play, Square } from 'lucide-react';
import { CANTO_VARIANTS } from '../lib/canto';
import PieceAudio from './PieceAudio';
import KaraokeLyrics from './KaraokeLyrics';
import Modal from './ui/Modal';
import GenerateLyricsButton from './GenerateLyricsButton';
import { supabase } from '../lib/supabase';

export default function CantoPieceStudio({ piece, canGenerate = false, onLyricsSaved }) {
    const [showLyrics, setShowLyrics] = useState(false);
    const [draft, setDraft] = useState(null);
    const [savedLyrics, setSavedLyrics] = useState(null);
    const [aiBusy, setAiBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    async function saveLyrics() {
        setSaving(true); setSaveError('');
        try {
            const { data, error } = await supabase.from('pieces').update({ versuri_text: draft }).eq('id', piece.id).eq('discipline', 'canto').select('id,versuri_text').single();
            if (error || !data) throw new Error('Versurile nu au putut fi salvate. Verifică permisiunile și încearcă din nou.');
            setSavedLyrics(data.versuri_text); setDraft(null); onLyricsSaved?.(data.versuri_text);
        } catch (error) { setSaveError(error.message); }
        finally { setSaving(false); }
    }
    const [active, setActive] = useState(piece.audio_negativ_path || piece.negative_url ? 'negativ' : 'pozitiv');
    const [clocks, setClocks] = useState({ pozitiv: 0, negativ: 0 });
    const [playing, setPlaying] = useState({ pozitiv: false, negativ: false });
    const positiveControls = useRef(null), negativeControls = useRef(null);
    const controls = { pozitiv: positiveControls, negativ: negativeControls };
    const hasSource = active === 'negativ' ? piece.audio_negativ_path || piece.negative_url : piece.audio_pozitiv_path || piece.positive_url;
    return <div className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">{CANTO_VARIANTS.map(variant => <div key={variant.key} className="min-w-0 space-y-2">
            <PieceAudio piece={piece} variant={variant} controlsRef={controls[variant.key]}
                onPlayback={() => { setActive(variant.key); setShowLyrics(true); }}
                onPlayingChange={value => setPlaying(previous => previous[variant.key] === value ? previous : { ...previous, [variant.key]: value })}
                onClock={time => setClocks(previous => previous[variant.key] === time ? previous : { ...previous, [variant.key]: time })} />
            {(piece[variant.path] || piece[variant.url]) && <button type="button" className={`btn-ghost text-xs ${active === variant.key ? 'text-gold-300' : ''}`} aria-pressed={active === variant.key} onClick={() => setActive(variant.key)}>Sincronizează cu {variant.label.toLowerCase()}</button>}
        </div>)}</div>
        <button type="button" className="btn-ghost inline-flex items-center gap-2" aria-label={`Vezi versuri — ${piece.title}`} onClick={() => setShowLyrics(true)}><FileText size={16} aria-hidden="true" />Vezi versuri</button>
        <Modal open={showLyrics} title={`Karaoke · ${active} — ${piece.title}`} onClose={() => { if (!aiBusy && !saving) setShowLyrics(false); }} wide>
            <p className="my-3 text-xs text-slate-300">Sincronizare după sursa selectată. Cuvintele sunt evidențiate doar când textul conține timestamp-uri pe cuvânt; LRC simplu evidențiază linia. Alinierea pozitiv/negativ trebuie verificată de profesor.</p>
            {showLyrics && <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-gold inline-flex items-center gap-2" disabled={!hasSource} onClick={() => controls[active].current?.togglePlay()} aria-label={playing[active] ? 'Pauză karaoke' : 'Play karaoke'}>{playing[active] ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}{playing[active] ? 'Pauză' : 'Play'}</button>
                    <button type="button" className="btn-ghost inline-flex items-center gap-2" disabled={!hasSource} onClick={() => controls[active].current?.stop()} aria-label="Stop karaoke"><Square size={17} aria-hidden="true" />Stop</button>
                </div>
                <label className="block text-sm text-slate-200">Poziție karaoke<input type="range" min={0} max={controls[active].current?.duration || 0} step={0.01} value={Math.min(clocks[active], controls[active].current?.duration || 0)} disabled={!controls[active].current?.duration} onChange={event => controls[active].current?.seek(Number(event.target.value))} className="mt-2 block w-full accent-gold-400" /></label>
                <div className="flex flex-wrap gap-2">{CANTO_VARIANTS.map(variant => (piece[variant.path] || piece[variant.url]) && <button key={variant.key} type="button" className="btn-ghost" aria-pressed={active === variant.key} onClick={() => { controls[active].current?.stop(); setActive(variant.key); }}>{variant.label}</button>)}</div>
                <KaraokeLyrics text={draft ?? savedLyrics ?? piece.versuri_text} time={clocks[active]} />
                {canGenerate && <section className="space-y-3 border-t border-white/10 pt-4" aria-label="Extragere versuri AI">
                    <p className="text-sm text-slate-300">Conexiunea AI folosește OPENAI_API_KEY configurată în Supabase → Edge Functions → Secrets, niciodată cheia publică Supabase. Generează din pozitiv, apoi verifică alinierea pe ambele variante.</p>
                    <GenerateLyricsButton piece={piece} disabled={saving} onBusyChange={setAiBusy} onGenerated={setDraft} />
                    {draft !== null && <div className="space-y-3">
                        <p role="status" className="text-sm text-gold-300">Previzualizare nesalvată. Revizuiește textul și timpii înainte de publicare.</p>
                        <label className="block text-sm text-slate-200">Versuri AI de revizuit<textarea className="input mt-2 min-h-40" maxLength={100000} value={draft} disabled={aiBusy || saving} onChange={event => setDraft(event.target.value)} /></label>
                        <button type="button" className="btn-gold" disabled={aiBusy || saving || !draft.trim()} onClick={saveLyrics}>{saving ? 'Se salvează…' : 'Salvează versurile sincronizate'}</button>
                        <button type="button" className="btn-ghost" disabled={aiBusy || saving} onClick={() => { setDraft(null); setSaveError(''); }}>Renunță la ciornă</button>
                    </div>}
                    {saveError && <p role="alert" className="text-sm text-brand-200">{saveError}</p>}
                </section>}
            </div>}
        </Modal>
    </div>;
}
