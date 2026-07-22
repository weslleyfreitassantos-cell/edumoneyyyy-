import type { PublicBranding } from './brandingService';
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_SECONDARY_COLOR,
  sanitizeBrandColor,
} from './brandingValidation';

export const fallbackDocumentTitle = 'EduManager Pro';

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

  document.title =
    branding.displayName?.trim() || titleFallback;
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
  } else if (previousFaviconHref) {
    favicon.href = previousFaviconHref;
  } else {
    favicon.removeAttribute('href');
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
