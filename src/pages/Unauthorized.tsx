import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Unauthorized() {
    return (
        <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
            <section className="w-full max-w-md rounded-xl border border-[#dfe3e8] bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                    <ShieldAlert className="h-7 w-7" />
                </div>

                <h1 className="mt-5 text-xl font-bold text-[#181c20]">
                    Acesso não autorizado
                </h1>

                <p className="mt-2 text-sm leading-relaxed text-[#727785]">
                    Sua conta não possui permissão para acessar esta área.
                </p>

                <Link
                    to="/dashboard"
                    className="mt-6 inline-flex rounded-lg bg-[#005bbf] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1a73e8]"
                >
                    Voltar ao dashboard
                </Link>
            </section>
        </main>
    );
}