import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { classConfig } from '../lib/liveClass';

export default function LiveClass() {
    const { groupId } = useParams();
    return <ClassRoom key={groupId} groupId={groupId} />;
}

function ClassRoom({ groupId }) {
    const [access, setAccess] = useState(null);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('Se verifică accesul…');
    const [waiting, setWaiting] = useState([]);
    const [closed, setClosed] = useState(false);
    const apiRef = useRef(null);
    const localIdRef = useRef(null);

    useEffect(() => {
        let active = true;
        supabase.functions.invoke('class-access', { body: { groupId } }).then(({ data, error: failure }) => {
            if (!active) return;
            if (failure || !data?.jwt) { setError('Acces indisponibil. Verifică apartenența la grupă și configurarea serverului Jitsi.'); return; }
            setAccess(data);
            setStatus(data.role === 'profesor' ? 'Se deschide sala profesorului…' : 'Se așteaptă aprobarea profesorului…');
        }).catch(() => { if (active) setError('Conexiunea a eșuat.'); });
        return () => { active = false; apiRef.current?.dispose(); apiRef.current = null; };
    }, [groupId]);

    function setup(api) {
        apiRef.current = api;
        const inspector = access.role === 'inspector';
        if (inspector) api.getIFrame().setAttribute('allow', "autoplay; fullscreen; camera 'none'; microphone 'none'; display-capture 'none'");
        const enableLobby = () => {
            if (access.role === 'profesor') api.executeCommand('toggleLobby', true);
        };
        api.addListener('participantRoleChanged', ({ id, role }) => { if (id === localIdRef.current && role === 'moderator') enableLobby(); });
        api.addListener('videoConferenceJoined', ({ id }) => {
            localIdRef.current = id;
            enableLobby();
            api.executeCommand('setNoiseSuppressionEnabled', false);
            setStatus(inspector ? 'Observare · camera și microfonul oprite' : 'Conectat');
        });
        api.addListener('knockingParticipant', ({ participant }) => {
            if (access.role === 'profesor' && participant?.id) setWaiting((current) => [...current.filter((item) => item.id !== participant.id), participant]);
        });
        const guard = ({ muted }) => { if (inspector && !muted) { api.executeCommand('hangup'); setError('Conferința a fost oprită: modul inspector nu permite transmisie audio/video.'); setClosed(true); } };
        api.addListener('audioMuteStatusChanged', guard);
        api.addListener('videoMuteStatusChanged', guard);
        api.addListener('errorOccurred', () => setError('Jitsi a raportat o eroare de conectare. Reîncarcă sala pentru a reîncerca.'));
        api.addListener('videoConferenceLeft', () => { setClosed(true); setStatus('Ai ieșit din sala de curs.'); });
    }

    function answer(participantId, approved) {
        apiRef.current?.executeCommand('answerKnockingParticipant', participantId, approved);
        setWaiting((current) => current.filter((item) => item.id !== participantId));
    }

    return <div className="space-y-4">
        <Link to="/cursuri-online/" className="text-sm text-gold-300">Înapoi la grupe</Link>
        <h1 className="font-display text-2xl text-white">{access?.groupName || 'Sala de curs'}</h1>
        <p role="status" className="text-sm text-slate-300">{status}</p>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {access?.role === 'profesor' && waiting.length > 0 && <section className="space-y-2 border-b border-white/15 pb-4"><h2>Sala de așteptare</h2>{waiting.map((participant) => <div key={participant.id} className="flex flex-wrap items-center gap-3"><span className="break-all">{participant.name || participant.id}</span><button type="button" className="btn-gold" title="Aprobă accesul" aria-label={`Aprobă ${participant.name || 'elevul'}`} onClick={() => answer(participant.id, true)}><Check size={18} /></button><button type="button" className="btn-ghost" title="Refuză accesul" aria-label={`Refuză ${participant.name || 'elevul'}`} onClick={() => answer(participant.id, false)}><X size={18} /></button></div>)}</section>}
        {access && !closed && <div className="h-[70dvh] min-h-[420px] w-full overflow-hidden">
            <JitsiMeeting domain={access.domain} roomName={access.roomName} jwt={access.jwt} lang="ro" configOverwrite={classConfig(access.role)} onApiReady={setup} getIFrameRef={(element) => { element.style.height = '100%'; element.style.width = '100%'; }} onReadyToClose={() => setClosed(true)} />
        </div>}
    </div>;
}