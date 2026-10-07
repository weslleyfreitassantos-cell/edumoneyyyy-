import type { ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

import { useResolvedBranding } from '../../hooks/useBranding';

export default function BrandingLoadingGate({
  children,
}: {
  children: ReactNode;
}) {
  const brandingQuery = useResolvedBranding();

  if (brandingQuery.isLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f3f6fb] dark:bg-slate-950">
        <div role="status" aria-label="Carregando identidade visual">
          <LoaderCircle className="h-7 w-7 animate-spin text-[#005bbf]" aria-hidden="true" />
        </div>
      </main>
    );
  }

  if (brandingQuery.isError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f3f6fb] px-6 text-center dark:bg-slate-950">
        <div className="max-w-sm">
          <p role="alert" className="text-sm text-slate-700 dark:text-slate-300">
            Não foi possível carregar a identidade visual da escola.
          </p>
          <button
            type="button"
            onClick={() => void brandingQuery.refetch()}
            className="mt-4 min-h-10 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004a9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  return children;
}
