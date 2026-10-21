import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { gameRpc } from '../lib/games';

export default function GameProfile({ onSaved }) {
    const { profile } = useAuth();
    const [alias, setAlias] = useState('');
    const [visible, setVisible] = useState(false);
    const [ready, setReady] = useState(false);
    const [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        setError('');
        supabase.from('game_profiles').select('alias,visible').eq('user_id',profile.id).maybeSingle().then(({ data, error: e }) => {
            if (!active) return;
            if (e) { setError(e.message); return; }
            setAlias(data?.alias || ''); setVisible(data?.visible || false); setReady(true);
        }).catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [profile.id, revision]);
    async function save(event) {
        event.preventDefault(); setBusy(true); setMessage(''); setError('');
        try { await gameRpc('game_set_profile', { p_alias: alias, p_visible: visible }); setMessage('Preferințele au fost salvate.'); onSaved(); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    }
    return <form className="card space-y-3" onSubmit={save} aria-label="Identitate în jocuri">
        <h2 className="text-lg font-semibold text-white">Pseudonimul tău de muzician</h2>
        <label className="block">Pseudonim (nu folosi numele complet)
            <input className="input mt-1 w-full" value={alias} onChange={e => setAlias(e.target.value)} minLength={2} maxLength={24} required disabled={!ready || busy} />
        </label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} disabled={!ready || busy} />
            Vreau să apar în clasament și în lista de adversari, cu pseudonimul și fotografia mea de profil, vizibile conturilor active din Academy. Pot retrage participarea oricând.
        </label>
        <p className="text-xs text-slate-400">Fără această opțiune poți juca și accepta dueluri prin cod; rezultatele nu apar în clasamentul general. Pseudonimul este vizibil adversarului în duel.</p>
        <button className="btn-ghost" disabled={!ready || busy}>{busy ? 'Se salvează…' : 'Salvează preferințele'}</button>
        {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-300">{error} {!ready && <button type="button" className="underline" onClick={() => setRevision(x => x + 1)}>Reîncearcă încărcarea</button>}</p>}
    </form>;
}
