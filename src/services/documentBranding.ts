import type { PublicBranding } from './brandingService';
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_SECONDARY_COLOR,
  sanitizeBrandColor,
} from './brandingValidation';

export const fallbackDocumentTitle = 'Tec Escola';
export const defaultFaviconHref = '/media/tec-escola-favicon.png';
const TEC_ESCOLA_FAVICON_HOSTS = new Set([
  'admin.grupotec.dev.br',
  'tecescola.grupotec.dev.br',
]);

function getDefaultTecEscolaFavicon(): string {
  return defaultFaviconHref;
}

export function applyDocumentTitle(
  branding: PublicBranding,
  titleFallback = fallbackDocumentTitle,
): void {
  if (typeof document === 'undefined') return;
  document.title = branding.documentTitle?.trim()
    || branding.displayName?.trim()
    || (branding.scope === 'FALLBACK' ? 'Tec Escola' : titleFallback);
}

function shouldUseTecEscolaFavicon(): boolean {
  return typeof window !== 'undefined' &&
    TEC_ESCOLA_FAVICON_HOSTS.has(window.location.hostname);
}

function getOrCreateFaviconLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"]',
  );

  if (existing) {
    return existing;
  }

  const link = document.createElement('link');
  link.rel = 'icon';
  document.head.appendChild(link);
  return link;
}

export function applyDocumentFavicon(
  branding: PublicBranding,
): void {
  if (typeof document === 'undefined') return;

  const existingHref = document
    .querySelector<HTMLLinkElement>('link[rel="icon"]')
    ?.getAttribute('href');
  const favicon = getOrCreateFaviconLink();
  if (shouldUseTecEscolaFavicon()) {
    favicon.href = getDefaultTecEscolaFavicon();
  } else if (branding.faviconUrl) {
    favicon.href = branding.faviconUrl;
  } else if (existingHref) {
    favicon.href = existingHref;
  } else {
    favicon.href = defaultFaviconHref;
  }
}

export function applyDocumentBranding(
  branding: PublicBranding,
  titleFallback = fallbackDocumentTitle,
): () => void {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  const previousTitle = document.title;
  const previousPrimary =
    document.documentElement.style.getPropertyValue(
      '--brand-primary',
    );
  const previousSecondary =
    document.documentElement.style.getPropertyValue(
      '--brand-secondary',
    );
  const existingFavicon =
    document.querySelector<HTMLLinkElement>(
      'link[rel="icon"]',
    );
  const previousFaviconHref =
    existingFavicon?.getAttribute('href') ?? null;

  const primaryColor = sanitizeBrandColor(
    branding.primaryColor,
    DEFAULT_BRAND_PRIMARY_COLOR,
  );
  const secondaryColor = sanitizeBrandColor(
    branding.secondaryColor,
    DEFAULT_BRAND_SECONDARY_COLOR,
  );

  applyDocumentTitle(branding, titleFallback);
  document.documentElement.style.setProperty(
    '--brand-primary',
    primaryColor,
  );
  document.documentElement.style.setProperty(
    '--brand-secondary',
    secondaryColor,
  );

  applyDocumentFavicon(branding);

  return () => {
    document.title = previousTitle;

    if (previousPrimary) {
      document.documentElement.style.setProperty(
        '--brand-primary',
        previousPrimary,
      );
    } else {
      document.documentElement.style.removeProperty(
        '--brand-primary',
      );
    }

    if (previousSecondary) {
      document.documentElement.style.setProperty(
        '--brand-secondary',
        previousSecondary,
      );
    } else {
      document.documentElement.style.removeProperty(
        '--brand-secondary',
      );
    }

    const currentFavicon =
      document.querySelector<HTMLLinkElement>(
        'link[rel="icon"]',
      );

    if (!currentFavicon) {
      return;
    }

    if (previousFaviconHref) {
      currentFavicon.href = previousFaviconHref;
    } else {
      currentFavicon.removeAttribute('href');
    }
  };
}
