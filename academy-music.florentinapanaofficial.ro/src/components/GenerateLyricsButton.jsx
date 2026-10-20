import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import Modal from './ui/Modal';

export default function GenerateLyricsButton({ piece, disabled = false, onGenerated, onBusyChange }) {
    const [confirm, setConfirm] = useState(false);
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const controller = useRef(null);
    const enabled = Boolean(piece?.id && piece.audio_pozitiv_path && !piece.positive_url?.trim());
    useEffect(() => () => { controller.current?.abort(); onBusyChange(false); }, [onBusyChange]);
    async function generate() {
        if (!enabled || !consent || busy) return;
        setConfirm(false); setBusy(true); onBusyChange(true); setError(''); setInfo('');
        const abort = new AbortController(); controller.current = abort;
        const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(125000)]);
        try {
            const { data, error: failure } = await supabase.functions.invoke('generate-lyrics', { body: { pieceId: piece.id, audioPath: piece.audio_pozitiv_path, consent: true }, signal });
            if (signal.aborted && !abort.signal.aborted) throw new Error('Cererea AI a depășit timpul disponibil. Versurile existente au fost păstrate.');
            if (failure) {
                const details = failure.context instanceof Response ? await failure.context.json() : null;
                throw new Error(details?.error || 'Funcția AI nu poate fi contactată. Verifică publicarea și configurarea ei.');
            }
            if (!data || typeof data.lrc !== 'string' || !data.lrc.trim() || data.lrc.length > 100000) throw new Error('Funcția AI nu a returnat versuri valide. Textul existent nu a fost modificat.');
            if (abort.signal.aborted) return;
            onGenerated(data.lrc);
            setInfo('Versuri generate în formular. Revizuiește textul și timpii, apoi salvează manual piesa.');
        } catch (failure) {
            if (!abort.signal.aborted) setError(failure.name === 'TimeoutError' ? 'Cererea AI a depășit timpul disponibil. Versurile existente au fost păstrate.' : failure.message || 'Generarea AI a eșuat. Versurile existente au fost păstrate.');
        } finally {
            if (!abort.signal.aborted) { setBusy(false); onBusyChange(false); }
        }
    }
    return <div className="space-y-2">
        <button type="button" className="btn-ghost border border-gold-400/30 text-gold-300" disabled={disabled || !enabled || busy} onClick={() => { setConsent(false); setConfirm(true); }}>✨ Generează Versuri Automat (AI)</button>
        {!enabled && <p className="text-xs text-slate-400">Salvează mai întâi pozitivul MP3 ca sursă activă în Storage, fără URL extern. Un URL extern nu este trimis către AI.</p>}
        {busy && <p role="status" className="text-sm text-gold-300">Analizăm vocea și sincronizăm versurile... Durează aproximativ 1-2 minute</p>}
        {error && <p role="alert" className="text-sm text-brand-200">{error}</p>}
        {info && <p role="status" className="text-sm text-emerald-300">{info}</p>}
        <Modal open={confirm} title="Confirmă transcrierea AI" onClose={() => setConfirm(false)}>
            <p className="text-slate-200">Pozitivul salvat va fi trimis către OpenAI Whisper pentru transcriere în limba română. Pot exista costuri și erori, mai ales în înregistrările muzicale. Limita AI este 24 MB.</p>
            <p className="mt-3 text-sm text-slate-300">Nu trimite înregistrări cu date personale sau voci de minori fără autorizările necesare. Verifică informarea GDPR și termenii furnizorului. Textul din formular va fi înlocuit; baza de date nu se modifică până nu salvezi.</p>
            <label className="mt-4 flex items-start gap-2 text-sm text-slate-200"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Confirm că am dreptul să prelucrez și să trimit această înregistrare și să folosesc versurile rezultate.</label>
            <div className="mt-5 flex flex-wrap gap-3"><button type="button" className="btn-gold" disabled={!consent || busy} onClick={generate}>Confirm și generez</button><button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Anulează</button></div>
        </Modal>
    </div>;
}
