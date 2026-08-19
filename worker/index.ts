interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const TVESCOLA_HOSTNAME = 'tvescola.grupotec.dev.br';
const TVESCOLA_ORIGIN = `https://${TVESCOLA_HOSTNAME}`;
const NEONEWS_HOSTNAME = 'admin.in9midia.com';
const NEONEWS_ORIGIN = `https://${NEONEWS_HOSTNAME}`;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "frame-src 'self' https://admin.in9midia.com https://tvescola.grupotec.dev.br",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.cameras.grupotec.dev.br https://*.grupotec.dev.br https://static.cloudflareinsights.com",
  "media-src 'self' blob: https://*.cameras.grupotec.dev.br https://*.grupotec.dev.br",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' https://static.cloudflareinsights.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function buildNeoNewsUrl(requestUrl: string): URL {
  const target = new URL(requestUrl);
  target.protocol = 'https:';
  target.hostname = NEONEWS_HOSTNAME;
  target.port = '';
  target.username = '';
  target.password = '';
  return target;
}

function rewriteRequestHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);

  for (const header of [
    'host',
    'cf-connecting-ip',
    'cf-ipcountry',
    'cf-ray',
    'cf-visitor',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-real-ip',
  ]) {
    headers.delete(header);
  }

  if (headers.get('origin') === TVESCOLA_ORIGIN) {
    headers.set('origin', NEONEWS_ORIGIN);
  }

  const referer = headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.hostname.toLowerCase() === TVESCOLA_HOSTNAME) {
        refererUrl.protocol = 'https:';
        refererUrl.hostname = NEONEWS_HOSTNAME;
        refererUrl.port = '';
        headers.set('referer', refererUrl.toString());
      }
    } catch {
      // Keep an invalid Referer untouched rather than guessing.
    }
  }

  return headers;
}

export function rewriteNeoNewsLocation(location: string): string {
  try {
    const target = new URL(location, `${NEONEWS_ORIGIN}/`);

    if (target.hostname.toLowerCase() !== NEONEWS_HOSTNAME) {
      return location;
    }

    target.protocol = 'https:';
    target.hostname = TVESCOLA_HOSTNAME;
    target.port = '';
    return target.toString();
  } catch {
    return location;
  }
}

export function rewriteNeoNewsSetCookie(cookie: string): string {
  return cookie.replace(
    /;\s*Domain=([^;]+)/gi,
    (segment, rawDomain: string) => {
      const cookieDomain = rawDomain
        .trim()
        .replace(/^\./, '')
        .toLowerCase();

      if (
        NEONEWS_HOSTNAME === cookieDomain ||
        NEONEWS_HOSTNAME.endsWith(`.${cookieDomain}`)
      ) {
        return '';
      }

      return segment;
    },
  );
}

function getSetCookieValues(headers: Headers): string[] {
  const enhancedHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof enhancedHeaders.getSetCookie === 'function') {
    return enhancedHeaders.getSetCookie();
  }

  const value = headers.get('set-cookie');
  return value ? [value] : [];
}

function rewriteResponseHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);

  const location = headers.get('location');
  if (location) {
    headers.set('location', rewriteNeoNewsLocation(location));
  }

  const setCookies = getSetCookieValues(response.headers);
  if (setCookies.length > 0) {
    headers.delete('set-cookie');
    for (const cookie of setCookies) {
      headers.append('set-cookie', rewriteNeoNewsSetCookie(cookie));
    }
  }

  return headers;
}

export async function proxyTvescolaRequest(
  request: Request,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const target = buildNeoNewsUrl(request.url);
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: rewriteRequestHeaders(request),
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  const upstreamResponse = await fetcher(target.toString(), init);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: rewriteResponseHeaders(upstreamResponse),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const hostname = new URL(request.url).hostname.toLowerCase();

    if (hostname === TVESCOLA_HOSTNAME) {
      return proxyTvescolaRequest(request);
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
