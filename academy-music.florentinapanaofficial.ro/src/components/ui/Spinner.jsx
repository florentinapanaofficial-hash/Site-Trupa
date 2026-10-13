export default function Spinner({ label = 'Se încarcă…', className = '' }) {
    return (
        <div className={`flex items-center gap-3 text-sm text-slate-400 ${className}`} role="status">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-gold-400" />
            <span>{label}</span>
        </div>
    );
}
