function normalizeModuleEntryUrl(
  source: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!source) {
    return null;
  }

  try {
    const url = new URL(source, baseUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function getModuleEntryUrl(
  html: string,
  baseUrl: string,
): string | null {
  if (typeof DOMParser === 'undefined') {
    return null;
  }

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const source = parsed
    .querySelector<HTMLScriptElement>('script[type="module"][src]')
    ?.getAttribute('src');

  return normalizeModuleEntryUrl(source, baseUrl);
}

export function hasNewAppVersion(
  currentHtml: string,
  latestHtml: string,
  baseUrl: string,
): boolean {
  const currentEntry = getModuleEntryUrl(currentHtml, baseUrl);
  const latestEntry = getModuleEntryUrl(latestHtml, baseUrl);

  return Boolean(currentEntry && latestEntry && currentEntry !== latestEntry);
}
