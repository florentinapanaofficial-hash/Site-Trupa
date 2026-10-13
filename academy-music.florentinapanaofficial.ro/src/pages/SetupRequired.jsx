const STEPS = [
    'Creează un proiect pe supabase.com (regiune recomandată: Central EU — Frankfurt).',
    'SQL Editor → New query → lipește tot conținutul din supabase/schema.sql → Run.',
    'Project Settings → API → copiază Project URL și cheia anon public.',
    'Creează fișierul .env în rădăcina proiectului, după modelul .env.example.',
    'Oprește serverul (Ctrl+C) și rulează din nou npm run dev.',
];

export default function SetupRequired() {
    return (
        <div className="grid min-h-screen place-items-center bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900/40 p-6">
            <div className="w-full max-w-2xl animate-fade-up">
                <div className="mb-6 text-center">
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-gold-500 text-3xl">
                        🎵
                    </span>
                    <h1 className="mt-4 font-display text-3xl text-white">Academy Music</h1>
                    <p className="mt-1 text-sm text-gold-400">Configurare necesară</p>
                </div>

                <div className="card">
                    <p className="text-sm text-slate-300">
                        Interfața pornit corect, dar lipsesc datele de conectare la Supabase. Până când
                        sunt completate, autentificarea și materialele nu pot fi încărcate.
                    </p>

                    <ol className="mt-5 space-y-3">
                        {STEPS.map((step, index) => (
                            <li key={step} className="flex gap-3 text-sm text-slate-300">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-200">
                                    {index + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ol>

                    <pre className="mt-5 overflow-x-auto rounded-xl bg-black/50 p-4 text-xs text-slate-300">
                        {'VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOi...'}
                    </pre>

                    <p className="mt-4 text-xs text-slate-500">
                        Variabilele cu prefixul VITE_ sunt citite la pornirea serverului, nu la salvarea
                        fișierului — de aceea repornirea e obligatorie. Cheia service_role nu se pune
                        niciodată într-o variabilă VITE_.
                    </p>
                </div>
            </div>
        </div>
    );
}
