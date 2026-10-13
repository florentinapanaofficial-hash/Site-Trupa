import { Component } from 'react';

/** O eroare de randare lasă altfel pagina complet albă, fără niciun indiciu în afara consolei. */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[Academy Music] Eroare de randare:', error, info);
        this.setState({ info });
    }

    render() {
        const { error, info } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="grid min-h-screen place-items-center bg-ink-950 p-6">
                <div className="w-full max-w-2xl rounded-2xl border border-brand-500/40 bg-ink-900 p-6">
                    <h1 className="font-display text-2xl text-white">Aplicația a întâmpinat o eroare</h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Detaliile de mai jos apar și în consola browserului (F12 → Console).
                    </p>

                    <pre className="mt-4 max-h-60 overflow-auto rounded-xl bg-black/50 p-4 text-xs text-brand-200">
                        {String(error?.stack || error)}
                    </pre>

                    {info?.componentStack && (
                        <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-black/50 p-4 text-xs text-slate-500">
                            {info.componentStack}
                        </pre>
                    )}

                    <button
                        type="button"
                        className="btn-primary mt-5"
                        onClick={() => window.location.reload()}
                    >
                        Reîncarcă pagina
                    </button>
                </div>
            </div>
        );
    }
}
