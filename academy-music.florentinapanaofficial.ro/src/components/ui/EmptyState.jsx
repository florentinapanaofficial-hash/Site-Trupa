export default function EmptyState({ icon = '🎼', title, description, action = null }) {
    return (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl" aria-hidden="true">
                {icon}
            </span>
            <h3 className="mt-3 text-lg font-semibold text-slate-100">{title}</h3>
            {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
