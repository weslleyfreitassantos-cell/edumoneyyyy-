import { classifyHostname } from './subdomain';

export const MARKETING_ORIGIN = 'https://grupotec.dev.br';
export const PLATFORM_APP_ORIGIN = 'https://tecescola.grupotec.dev.br';

function originFromLocation(locationOrigin: string): string {
  try {
    return new URL(locationOrigin).origin;
  } catch {
    return PLATFORM_APP_ORIGIN;
  }
}

/**
 * Returns the origin that should own application links.
 * Institution hosts remain tenant-local; production platform links use TecEscola.
 * Local and preview origins are preserved so development keeps working.
 */
export function getApplicationOrigin(locationOrigin?: string): string {
  if (!locationOrigin) {
    return PLATFORM_APP_ORIGIN;
  }

  const origin = originFromLocation(locationOrigin);
  const hostname = new URL(origin).hostname;
  const resolution = classifyHostname(hostname);

  if (
    resolution.type === 'institution' ||
    resolution.type === 'development'
  ) {
    return origin;
  }

  return PLATFORM_APP_ORIGIN;
}

export function buildApplicationUrl(
  pathname: string,
  locationOrigin?: string,
): string {
  const normalizedPath = pathname.startsWith('/')
    ? pathname
    : `/${pathname}`;

  return `${getApplicationOrigin(locationOrigin)}${normalizedPath}`;
}
