import { useEffect, useState } from 'react';
import { Circle, Users } from 'lucide-react';
import { supabase, BUCKET_AVATARS } from '../lib/supabase';
import { getSignedUrl, invalidateSignedUrl } from '../lib/media';
import Avatar from './Avatar';
function currentMembers(channel) {
    const unique = new Map();
    for (const entries of Object.values(channel.presenceState())) {
        for (const entry of entries) {
            if (typeof entry.user_id === 'string' && !unique.has(entry.user_id)) unique.set(entry.user_id, entry);
        }
    }
    return [...unique.values()].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ro'));
}
export default function LivePresence({ profile }) {
    const [members, setMembers] = useState([]);
    const [status, setStatus] = useState('Se conectează…');
    useEffect(() => {
        if (!profile?.id) return undefined;
        let active = true;
        let refreshTimer;
        const channel = supabase.channel('academy:online', { config: { private: true, presence: { key: profile.id } } });
        const sync = () => { if (active) setMembers(currentMembers(channel)); };
        channel.on('presence', { event: 'sync' }, sync);
        channel.on('presence', { event: 'join' }, sync);
        channel.on('presence', { event: 'leave' }, sync);
        async function trackPresence() {
            try {
                if (profile.avatar_path) invalidateSignedUrl(BUCKET_AVATARS, profile.avatar_path);
                const avatarUrl = profile.avatar_path ? await getSignedUrl(BUCKET_AVATARS, profile.avatar_path, 300) : null;
                if (!active) return;
                const result = await channel.track({ user_id: profile.id, full_name: profile.full_name || 'Utilizator Academy', avatar_url: avatarUrl });
                if (result !== 'ok') throw new Error('Presence track: ' + result);
                if (active) { setStatus(''); sync(); }
            } catch (error) {
                console.error('[Academy] Prezența online nu a putut fi publicată:', error.message);
                if (active) setStatus('Starea online nu este disponibilă momentan.');
            }
        }
        channel.subscribe((state, error) => {
            if (state === 'SUBSCRIBED') void trackPresence();
            else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
                console.error('[Academy] Canalul de prezență a eșuat:', error?.message || state);
                if (active) setStatus('Lista online nu este disponibilă momentan.');
            }
        });
        refreshTimer = window.setInterval(() => { void trackPresence(); }, 240_000);
        return () => { active = false; window.clearInterval(refreshTimer); void supabase.removeChannel(channel); };
    }, [profile?.id, profile?.full_name, profile?.avatar_path]);
    return <section className="rounded-xl border border-white/10 bg-ink-900/80 p-3" aria-label="Cine este online">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Users size={17} aria-hidden="true" />Cine este online<span className="ml-auto inline-flex items-center gap-1.5 text-xs font-normal text-emerald-300"><Circle size={8} fill="currentColor" aria-hidden="true" />{members.length}</span></h2>
        {status && <p aria-live="polite" className="mt-3 text-xs text-slate-400">{status}</p>}
        {!status && members.length === 0 && <p className="mt-3 text-xs text-slate-400">Momentan nu apare nimeni online.</p>}
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">{members.map((member) => <li key={member.user_id} className="flex items-center gap-2.5 text-sm text-slate-200"><Avatar signedUrl={member.avatar_url || null} name={member.full_name} size="sm" /><span className="min-w-0 truncate">{member.full_name || 'Utilizator Academy'}</span>{member.user_id === profile?.id && <span className="ml-auto text-xs text-slate-500">Tu</span>}</li>)}</ul>
        <p className="mt-3 text-xs text-slate-500">Vizibil doar membrilor autentificați ai platformei.</p>
    </section>;
}
