import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { gameRpc } from '../lib/games';

export default function DuelInvitations({ userId }) {
    const [count, setCount] = useState(0);
    const [error, setError] = useState('');
    const refresh = useRef(null);
    useEffect(() => {
        let active = true;
        let running = false;
        async function load() {
            if (running) return;
            running = true;
            try {
                const rooms = await gameRpc('game_live_inbox');
                if (active) { setCount(rooms.filter(room => room.status === 'lobby' && room.opponent_id === userId).length); setError(''); }
            } catch (e) {
                console.error('[Academy] Invitațiile la duel nu au putut fi verificate:', e.message);
                if (active) setError('Nu am putut verifica invitațiile la duel.');
            } finally { running = false; }
        }
        refresh.current = load;
        void load();
        const interval = setInterval(load, 10000);
        const channel = supabase.channel('duel-notice:' + userId).on('postgres_changes', { event: '*', schema: 'public', table: 'live_quiz_rooms', filter: 'opponent_id=eq.' + userId }, () => void load()).subscribe();
        window.addEventListener('focus', load);
        return () => { active = false; clearInterval(interval); window.removeEventListener('focus', load); void supabase.removeChannel(channel); };
    }, [userId]);
    return <>
        {count > 0 && <section role="status" className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300/40 bg-rose-300/10 p-4">
            <p className="font-semibold text-rose-100">⚔️ Ai {count === 1 ? 'o provocare nouă' : count + ' provocări noi'} la duel quiz!</p>
            <Link className="btn-gold" to="/jocuri/?tab=duel">Vezi provocările</Link>
        </section>}
        {error && <p role="alert" className="mx-4 mt-3 text-sm text-rose-200">{error} <button className="underline" onClick={() => void refresh.current?.()}>Reîncearcă</button></p>}
    </>;
}
