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
const GRUPOTEC_ROOT_DOMAIN = 'grupotec.dev.br';
const NEONEWS_HOSTNAME = 'admin.in9midia.com';
const NEO_NEWS_UPSTREAM_ORIGIN = TVESCOLA_ORIGIN;
const WFR_PATHNAME = '/neonews/wfr.js';

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

function isGrupotecSubdomain(hostname: string): boolean {
  const suffix = `.${GRUPOTEC_ROOT_DOMAIN}`;
  return (
    hostname.endsWith(suffix) &&
    hostname.slice(0, -suffix.length).length > 0 &&
    !hostname.slice(0, -suffix.length).includes('.')
  );
}

export function shouldProxyNeoNewsRequest(
  hostname: string,
  pathname: string,
): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return (
    normalizedHostname === TVESCOLA_HOSTNAME ||
    (pathname.startsWith('/neonews/') &&
      isGrupotecSubdomain(normalizedHostname))
  );
}

function buildNeoNewsUrl(requestUrl: string): URL {
  const target = new URL(requestUrl);
  target.protocol = 'https:';
  // NeoNews selects the saved login configuration from the Host header.
  // tvescola is a CNAME to the NeoNews origin, so keeping it in the URL
  // preserves that configuration while still letting the Worker proxy it.
  target.hostname = TVESCOLA_HOSTNAME;
  target.port = '';
  target.username = '';
  target.password = '';
  return target;
}

function rewriteRequestHeaders(
  request: Request,
  publicOrigin: string,
): Headers {
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

  if (headers.get('origin') === publicOrigin) {
    headers.set('origin', NEO_NEWS_UPSTREAM_ORIGIN);
  }

  const referer = headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.origin === publicOrigin) {
        refererUrl.protocol = 'https:';
        refererUrl.hostname = TVESCOLA_HOSTNAME;
        refererUrl.port = '';
        headers.set('referer', refererUrl.toString());
      }
    } catch {
      // Keep an invalid Referer untouched rather than guessing.
    }
  }

  return headers;
}

export function rewriteNeoNewsLocation(
  location: string,
  publicOrigin = TVESCOLA_ORIGIN,
): string {
  try {
    const target = new URL(location, `${NEO_NEWS_UPSTREAM_ORIGIN}/`);

    const targetHostname = target.hostname.toLowerCase();
    if (
      targetHostname !== NEONEWS_HOSTNAME &&
      targetHostname !== TVESCOLA_HOSTNAME
    ) {
      return location;
    }

    target.protocol = 'https:';
    target.hostname = new URL(publicOrigin).hostname;
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
        (NEONEWS_HOSTNAME === cookieDomain ||
          TVESCOLA_HOSTNAME === cookieDomain) ||
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

function rewriteResponseHeaders(
  response: Response,
  publicOrigin = TVESCOLA_ORIGIN,
): Headers {
  const headers = new Headers(response.headers);

  const location = headers.get('location');
  if (location) {
    headers.set(
      'location',
      rewriteNeoNewsLocation(location, publicOrigin),
    );
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

export function patchNeoNewsWfr(source: string): string {
  const divBlock = [
    'if (window._JQUERY_WINDOW_PARENT._JQUERY_WINDOW_DIV_ID && window._JQUERY_WINDOW_PARENT._JQUERY_WINDOW_DIV_ID == window._JQUERY_WINDOW_DIV_ID) {',
    '\twindow._JQUERY_WINDOW_DIV_ID = "";',
    '\twindow._JQUERY_WINDOW_OPENER = "";',
    '}',
  ].join('\n');
  const controllerBlock = [
    'function _JQUERY_WINDOW_FIND_CONTROLLER() {',
    '\tvar p = window;',
    '\tvar i = 0;',
    '\twhile (p) {',
    '\t  i++;',
    '\t  if (p._JQUERY_WINDOW_CONTROLLER) {',
    '\t    break;',
    '\t  }',
    '\t  ',
    '\t  p = p._JQUERY_WINDOW_PARENT;',
    '\t  ',
    '\t  if (i > 50) {',
    '\t    p = null;',
    '\t    break;',
    '\t  }',
    '\t}',
    '\t',
    '\treturn p;',
    '}',
  ].join('\n');
  const topBlock = [
    'function _JQUERY_WINDOW_FIND_TOP() {',
    '\tvar x = window;',
    '\tvar p = window;',
    '\tvar i = 0;',
    '\twhile (p.parent && !p._NULL_PARENT) {',
    '\t  i++;',
    '',
    '\t  p = p.parent;',
    '',
    '\t  if (i > 50) {',
    '\t    p = null;',
    '\t    break;',
    '\t  }',
    '\t}',
    '',
    '\treturn p;',
    '}',
  ].join('\n');
  const protectedDivBlock = [
    'try {',
    '\t' + divBlock.replace(/\n/g, '\n\t'),
    '} catch (e) {',
    '\t// The outer embed host may be cross-origin.',
    '}',
  ].join('\n');
  const protectedControllerBlock = [
    'function _JQUERY_WINDOW_FIND_CONTROLLER() {',
    '\tvar p = window;',
    '\tvar i = 0;',
    '\twhile (p) {',
    '\t  i++;',
    '\t  try {',
    '\t    if (p._JQUERY_WINDOW_CONTROLLER) {',
    '\t      break;',
    '\t    }',
    '\t    p = p._JQUERY_WINDOW_PARENT;',
    '\t  } catch (e) {',
    '\t    p = null;',
    '\t    break;',
    '\t  }',
    '\t  ',
    '\t  if (i > 50) {',
    '\t    p = null;',
    '\t    break;',
    '\t  }',
    '\t}',
    '\t',
    '\treturn p;',
    '}',
  ].join('\n');
  const protectedTopBlock = [
    'function _JQUERY_WINDOW_FIND_TOP() {',
    '\tvar x = window;',
    '\tvar p = window;',
    '\tvar i = 0;',
    '\twhile (p.parent && !p._NULL_PARENT) {',
    '\t  i++;',
    '',
    '\t  var candidateParent;',
    '\t  try {',
    '\t    candidateParent = p.parent;',
    '\t    candidateParent._NULL_PARENT;',
    '\t  } catch (e) {',
    '\t    break;',
    '\t  }',
    '',
    '\t  p = candidateParent;',
    '',
    '\t  if (i > 50) {',
    '\t    p = null;',
    '\t    break;',
    '\t  }',
    '\t}',
    '',
    '\treturn p;',
    '}',
  ].join('\n');

  const count = (block: string) =>
    source.split(block).length - 1;

  if (
    count(divBlock) !== 1 ||
    count(controllerBlock) !== 1 ||
    count(topBlock) !== 1
  ) {
    return source;
  }

  return source
    .replace(divBlock, protectedDivBlock)
    .replace(controllerBlock, protectedControllerBlock)
    .replace(topBlock, protectedTopBlock);
}

function isJavaScriptResponse(response: Response): boolean {
  return /(?:java|ecma)script/i.test(
    response.headers.get('content-type') ?? '',
  );
}

function createModifiedResponse(
  response: Response,
  body: string,
  publicOrigin: string,
): Response {
  const headers = rewriteResponseHeaders(response, publicOrigin);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.delete('content-md5');
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function createTextResponse(
  response: Response,
  body: string,
  publicOrigin: string,
): Response {
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: rewriteResponseHeaders(response, publicOrigin),
  });
}

export async function proxyTvescolaRequest(
  request: Request,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const target = buildNeoNewsUrl(request.url);
  const publicOrigin = new URL(request.url).origin;
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: rewriteRequestHeaders(request, publicOrigin),
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  const upstreamResponse = await fetcher(target.toString(), init);

  if (
    new URL(request.url).pathname === WFR_PATHNAME &&
    upstreamResponse.status === 200 &&
    isJavaScriptResponse(upstreamResponse)
  ) {
    const source = await upstreamResponse.text();
    const patchedSource = patchNeoNewsWfr(source);
    if (patchedSource !== source) {
      return createModifiedResponse(
        upstreamResponse,
        patchedSource,
        publicOrigin,
      );
    }

    return createTextResponse(
      upstreamResponse,
      source,
      publicOrigin,
    );
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: rewriteResponseHeaders(
      upstreamResponse,
      publicOrigin,
    ),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const hostname = new URL(request.url).hostname.toLowerCase();

    const pathname = new URL(request.url).pathname;
    if (shouldProxyNeoNewsRequest(hostname, pathname)) {
      return proxyTvescolaRequest(request);
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
