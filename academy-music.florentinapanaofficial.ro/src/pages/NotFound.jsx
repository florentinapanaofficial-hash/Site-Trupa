import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="card text-center">
            <h1 className="font-display text-2xl">Pagina nu există</h1>
            <p className="mt-2 text-sm text-slate-400">Linkul accesat nu duce nicăieri în platformă.</p>
            <Link to="/dashboard/" className="btn-primary mt-5 inline-flex">
                Înapoi acasă
            </Link>
        </div>
    );
}
