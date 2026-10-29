// Apply this host's cached school favicon before the app module starts.
(function applyCachedInstitutionFavicon() {
  let faviconHref = '/icons/tecescola-192.png';

  try {
    const hostname = window.location.hostname
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');
    const cacheKey = `tecescola:public-branding:${hostname}`;
    const raw = window.localStorage.getItem(cacheKey);

    if (raw) {
      const cached = JSON.parse(raw);
      if (
        cached?.version === 1 &&
        typeof cached.cachedAt === 'number' &&
        Number.isFinite(cached.cachedAt) &&
        cached.cachedAt > 0 &&
        cached.cachedAt <= Date.now() + 60_000 &&
        cached.branding?.scope === 'INSTITUTION' &&
        typeof cached.branding.faviconUrl === 'string'
      ) {
        const faviconUrl = new URL(cached.branding.faviconUrl);
        if (faviconUrl.protocol === 'https:') faviconHref = faviconUrl.href;
      }
    }
  } catch {
    // Invalid or unavailable cache uses the static app icon below.
  }

  const faviconLink =
    document.querySelector('link[rel~="icon"]') ||
    document.createElement('link');
  faviconLink.rel = 'icon';
  faviconLink.href = faviconHref;
  if (!faviconLink.isConnected) document.head.appendChild(faviconLink);
})();
