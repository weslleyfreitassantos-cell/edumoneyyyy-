import type { PublicBranding } from './brandingService';
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_SECONDARY_COLOR,
  sanitizeBrandColor,
} from './brandingValidation';

export const fallbackDocumentTitle = 'Tec Escola';
export const defaultFaviconHref = '/media/tec-escola-favicon.png?v=1401';

export function applyDocumentTitle(
  branding: PublicBranding,
  titleFallback = fallbackDocumentTitle,
): void {
  if (typeof document === 'undefined') return;

  const safeFallback = branding.scope === 'FALLBACK'
    ? fallbackDocumentTitle
    : titleFallback;
  const candidates = [
    branding.documentTitle,
    branding.displayName,
    safeFallback,
    fallbackDocumentTitle,
  ];
  document.title =
    candidates.find((candidate) => {
      const title = candidate?.trim();
      return Boolean(title && !/edumanager\s*pro/i.test(title));
    })?.trim() ?? fallbackDocumentTitle;
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

  const favicon = getOrCreateFaviconLink();
  const safeAssetUrl = (value: string | null): string | null => {
    if (!value) return null;
    try {
      const url = new URL(value, window.location.href);
      if (
        url.protocol === 'https:' ||
        (url.protocol === 'http:' && url.origin === window.location.origin)
      ) {
        return url.href;
      }
    } catch {
      return null;
    }
    return null;
  };

  const institutionFavicon =
    safeAssetUrl(branding.faviconUrl) ??
    (branding.scope === 'INSTITUTION'
      ? safeAssetUrl(branding.logoUrl)
      : null);

  const fallbackFavicon =
    branding.scope === 'INSTITUTION'
      ? null
      : defaultFaviconHref;
  const resolvedFavicon = institutionFavicon ?? fallbackFavicon;
  if (resolvedFavicon) {
    favicon.href = resolvedFavicon;
  } else {
    favicon.removeAttribute('href');
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
