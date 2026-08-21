import { ExternalLink, MonitorCog } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const TERMINALS_URL =
  '/neonews/logon.jsp?sys=NEC&msgKey=';

type FrameState = 'loading' | 'loaded' | 'blocked';

let persistentFrame: HTMLIFrameElement | null = null;
let parkingHost: HTMLDivElement | null = null;

function getParkingHost(): HTMLDivElement {
  if (parkingHost) return parkingHost;

  parkingHost = document.createElement('div');
  parkingHost.setAttribute('aria-hidden', 'true');
  parkingHost.style.position = 'fixed';
  parkingHost.style.left = '-1px';
  parkingHost.style.top = '-1px';
  parkingHost.style.width = '1px';
  parkingHost.style.height = '1px';
  parkingHost.style.overflow = 'hidden';
  parkingHost.style.opacity = '0';
  parkingHost.style.pointerEvents = 'none';
  document.body.appendChild(parkingHost);
  return parkingHost;
}

export function TerminalsFallback() {
  return (
    <div className="grid h-full min-h-0 place-items-center p-6 text-center">
      <div className="max-w-md">
        <MonitorCog className="mx-auto h-10 w-10 text-[#667085]" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-extrabold text-[#181c20]">
          Não foi possível carregar o sistema TV Escola dentro desta página.
        </h2>
        <a
          href={TERMINALS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004a9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Abrir TV Escola em nova aba
        </a>
      </div>
    </div>
  );
}

export default function TerminalsPage() {
  const [frameState, setFrameState] =
    useState<FrameState>(() =>
      (persistentFrame?.dataset.frameState as FrameState | undefined) ?? 'loading',
    );
  const frameContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = frameContainerRef.current;
    if (!container) return undefined;

    if (!persistentFrame) {
      persistentFrame = document.createElement('iframe');
      persistentFrame.src = TERMINALS_URL;
      persistentFrame.title = 'TV Escola';
      persistentFrame.setAttribute(
        'referrerpolicy',
        'strict-origin-when-cross-origin',
      );
      persistentFrame.className = 'h-full min-h-0 w-full border-0 bg-white';
      persistentFrame.addEventListener('load', () => {
        if (!persistentFrame) return;
        persistentFrame.dataset.frameState = 'loaded';
        setFrameState('loaded');
      });
      persistentFrame.addEventListener('error', () => {
        if (!persistentFrame) return;
        persistentFrame.dataset.frameState = 'blocked';
        setFrameState('blocked');
      });
    }

    container.appendChild(persistentFrame);

    return () => {
      if (persistentFrame) {
        getParkingHost().appendChild(persistentFrame);
      }
    };
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="relative h-full min-h-0 flex-1 overflow-hidden border border-[#d8deea] bg-white shadow-sm">
        {frameState === 'loading' ? (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b border-[#d8deea] bg-white/95 px-4 py-3 text-sm font-semibold text-[#667085]"
          >
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-[#cfd6e2] border-t-[#005bbf]"
              aria-hidden="true"
            />
            Carregando TV Escola...
          </div>
        ) : null}

        {frameState === 'blocked' ? (
          <TerminalsFallback />
        ) : (
          <div
            ref={frameContainerRef}
            className="h-full min-h-0 w-full"
          />
        )}
      </div>
    </section>
  );
}
