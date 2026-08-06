import { Building2, AlertTriangle } from 'lucide-react';

interface SubdomainNotFoundPageProps {
  subdomain?: string;
}

export function SubdomainNotFoundPage({ subdomain }: SubdomainNotFoundPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-slate-950">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
        <AlertTriangle className="h-8 w-8" />
      </div>

      <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
        Instituição não encontrada ou indisponível.
      </h1>

      <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {subdomain ? (
          <>
            O subdomínio <strong className="font-semibold text-slate-800 dark:text-slate-200">{subdomain}</strong> não corresponde a nenhuma instituição ativa no sistema.
          </>
        ) : (
          'O endereço acessado não está associado a nenhuma instituição ativa no sistema.'
        )}
      </p>

      <div className="mt-8">
        <a
          href="https://grupotec.dev.br"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          <Building2 className="h-4 w-4" />
          Ir para a página principal
        </a>
      </div>
    </div>
  );
}
