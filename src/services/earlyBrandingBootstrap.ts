import {
  brandingService,
  normalizePublicBrandingAssetUrls,
  type PublicBranding,
} from './brandingService';
import { applyDocumentBranding } from './documentBranding';

const cachePrefix = 'tecescola:public-branding:';
const cacheVersion = 2;
const bootstrapTimeoutMs = 6_000;

function cacheKey(hostname: string): string {
  return `${cachePrefix}${hostname.trim().toLowerCase().replace(/\.$/, '')}`;
}

function persist(hostname: string, branding: PublicBranding): void {
  try {
    window.localStorage.setItem(
      cacheKey(hostname),
      JSON.stringify({
        version: cacheVersion,
        hostname: hostname.trim().toLowerCase().replace(/\.$/, ''),
        cachedAt: Date.now(),
        branding: normalizePublicBrandingAssetUrls(branding),
      }),
    );
  } catch {
    // A blocked or full storage must never prevent the login from opening.
  }
}

function preload(url: string | null | undefined): Promise<void> {
  if (!url) return Promise.resolve();

  return new Promise((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(resolve, bootstrapTimeoutMs);
    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    image.onload = finish;
    image.onerror = finish;
    image.src = url;
  });
}

function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), bootstrapTimeoutMs);
    }),
  ]);
}

function updateSplash(branding: PublicBranding): void {
  const splash = document.getElementById('initial-branding-splash');
  if (!splash) return;

  // Keep the neutral bootstrap background until the institution background is
  // fully available; applying the brand color here causes a visible full-screen
  // color flash on cold Safari loads.
  splash.style.backgroundColor = '#eef3fc';
  if (branding.loginBackgroundUrl) {
    splash.style.backgroundImage = `url(${JSON.stringify(branding.loginBackgroundUrl)})`;
  }

  const logo = document.createElement('img');
  logo.src = branding.logoUrl ?? branding.faviconUrl ?? '';
  logo.alt = branding.displayName ? `Logo de ${branding.displayName}` : 'Logo da instituição';
  logo.className = 'initial-branding-splash__logo';
  logo.onerror = () => logo.remove();
  splash.replaceChildren(logo);
}

export async function bootstrapEarlyBranding(): Promise<void> {
  const hostname = window.location.hostname.trim().toLowerCase().replace(/\.$/, '');

  const branding = await withTimeout(brandingService.resolveForHostname(hostname));
  if (!branding) return;

  const normalized = normalizePublicBrandingAssetUrls(branding);
  updateSplash(normalized);
  // Persist and apply immediately so React never falls back to the generic
  // layout while a large background image is still downloading.
  persist(hostname, normalized);
  applyDocumentBranding(normalized);

  // Keep warming the browser cache without blocking the first paint.
  void Promise.all([
    preload(normalized.logoUrl ?? normalized.faviconUrl),
    preload(normalized.loginBackgroundUrl),
  ]);
}
