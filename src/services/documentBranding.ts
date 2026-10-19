import type { PublicBranding } from './brandingService';
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_SECONDARY_COLOR,
  sanitizeBrandColor,
} from './brandingValidation';

export const fallbackDocumentTitle = 'Tec Escola';
export const defaultFaviconHref =
  '/icons/tecescola-favicon.png?v=tec-favicon-20261015';

export function applyDocumentTitle(
  branding: PublicBranding,
  titleFallback = fallbackDocumentTitle,
): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.title =
    branding.documentTitle?.trim() ||
    branding.displayName?.trim() ||
    titleFallback;
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

  const favicon = getOrCreateFaviconLink();

  if (branding.faviconUrl) {
    favicon.href = branding.faviconUrl;
  } else {
    favicon.href = defaultFaviconHref;
  }

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
