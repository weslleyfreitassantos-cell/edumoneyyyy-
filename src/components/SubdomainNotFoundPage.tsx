import { Building2, AlertTriangle } from 'lucide-react';

export function SubdomainNotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
      <div className="max-w-md w-full text-center rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-850">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          Instituição não encontrada ou indisponível.
        </h1>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          O subdomínio acessado não corresponde a nenhuma escola ativa no sistema.
        </p>

        <div className="mt-6 flex justify-center">
          <a
            href="https://grupotec.dev.br"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Building2 className="h-4 w-4" />
            Ir para a página inicial
          </a>
        </div>
      </div>
    </div>
  );
}
