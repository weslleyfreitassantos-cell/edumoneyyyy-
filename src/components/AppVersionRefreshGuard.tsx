import { useEffect, useState } from 'react';

import { getModuleEntryUrl } from '../services/appVersion';

const appVersionCheckCooldownMs = 60_000;

export default function AppVersionRefreshGuard() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let lastCheckedAt = 0;
    let requestInFlight = false;

    const checkForUpdate = async () => {
      if (
        document.visibilityState === 'hidden' ||
        requestInFlight ||
        Date.now() - lastCheckedAt < appVersionCheckCooldownMs
      ) {
        return;
      }

      const currentEntry = getModuleEntryUrl(
        document.documentElement.outerHTML,
        window.location.href,
      );
      if (!currentEntry) {
        return;
      }

      lastCheckedAt = Date.now();
      requestInFlight = true;

      try {
        const indexUrl = new URL('/', window.location.href);
        indexUrl.searchParams.set(
          '__app_version_check',
          String(lastCheckedAt),
        );
        const response = await fetch(indexUrl, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Accept: 'text/html' },
        });

        if (!response.ok) {
          return;
        }

        const latestEntry = getModuleEntryUrl(
          await response.text(),
          indexUrl.href,
        );
        if (latestEntry && latestEntry !== currentEntry) {
          setUpdateAvailable(true);
        }
      } catch {
        // A temporary network failure must not interrupt the open page.
      } finally {
        requestInFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    };

    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('pageshow', checkForUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', checkForUpdate);
      window.removeEventListener('pageshow', checkForUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!updateAvailable) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-3 top-3 z-[10000] mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-lg dark:border-blue-900 dark:bg-slate-900 dark:text-slate-100"
      role="status"
      aria-live="polite"
    >
      <span>Uma versão atualizada do sistema está disponível.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-9 rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Atualizar agora
      </button>
    </div>
  );
}
