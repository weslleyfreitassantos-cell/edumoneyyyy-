import { ExternalLink, MonitorCog } from 'lucide-react';
import { useState } from 'react';

export const TERMINALS_URL =
  'https://admin.in9midia.com/neonews/logon.jsp?sys=NEC&msgKey=';

type FrameState = 'loading' | 'loaded' | 'blocked';

export function TerminalsFallback() {
  return (
    <div className="grid min-h-[620px] place-items-center p-6 text-center">
      <div className="max-w-md">
        <MonitorCog className="mx-auto h-10 w-10 text-[#667085]" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-extrabold text-[#181c20]">
          Não foi possível carregar o sistema Terminais dentro desta página.
        </h2>
        <a
          href={TERMINALS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004a9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Abrir Terminais em nova aba
        </a>
      </div>
    </div>
  );
}

export default function TerminalsPage() {
  const [frameState, setFrameState] =
    useState<FrameState>('loading');

  return (
    <section className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#005bbf]">
            <MonitorCog className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">
              Instituição
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-[#181c20]">
            Terminais
          </h1>
          <p className="mt-2 text-sm text-[#667085]">
            Acesse o sistema de terminais diretamente pelo ambiente da instituição.
          </p>
        </div>
      </div>

      <div className="relative min-h-[620px] flex-1 overflow-hidden rounded-xl border border-[#d8deea] bg-white shadow-sm">
        {frameState === 'loading' ? (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b border-[#d8deea] bg-white/95 px-4 py-3 text-sm font-semibold text-[#667085]"
          >
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-[#cfd6e2] border-t-[#005bbf]"
              aria-hidden="true"
            />
            Carregando Terminais...
          </div>
        ) : null}

        {frameState === 'blocked' ? (
          <TerminalsFallback />
        ) : (
          <iframe
            src={TERMINALS_URL}
            title="Terminais"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setFrameState('loaded')}
            onError={() => setFrameState('blocked')}
            className="h-full min-h-[620px] w-full border-0 bg-white"
          />
        )}
      </div>
    </section>
  );
}
