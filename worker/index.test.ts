import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, {
  proxyTvescolaRequest,
  patchNeoNewsWfr,
  rewriteNeoNewsLocation,
  rewriteNeoNewsSetCookie,
  shouldProxyNeoNewsRequest,
} from './index';

afterEach(() => {
  vi.restoreAllMocks();
});

const validWfrSource = [
  [
    'if (window._JQUERY_WINDOW_PARENT._JQUERY_WINDOW_DIV_ID && window._JQUERY_WINDOW_PARENT._JQUERY_WINDOW_DIV_ID == window._JQUERY_WINDOW_DIV_ID) {',
    '\twindow._JQUERY_WINDOW_DIV_ID = "";',
    '\twindow._JQUERY_WINDOW_OPENER = "";',
    '}',
  ].join('\n'),
  [
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
  ].join('\n'),
  [
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
  ].join('\n'),
].join('\n');

describe('Worker script', () => {
  it('delega hosts normais para o binding ASSETS', async () => {
    const expectedResponse = new Response('asset', { headers: { 'content-type': 'text/html' } });
    const assets = {
      fetch: vi.fn().mockResolvedValue(expectedResponse),
    };

    const request = new Request('https://tecescola.grupotec.dev.br/dashboard');

    const response = await worker.fetch(request, {
      ASSETS: assets,
    });

    expect(assets.fetch).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('asset');
    const contentSecurityPolicy = response.headers.get('content-security-policy');

    expect(contentSecurityPolicy).not.toContain('http:');
    expect(contentSecurityPolicy).toContain(
      "frame-src 'self' https://admin.in9midia.com https://tvescola.grupotec.dev.br",
    );
    expect(contentSecurityPolicy).toContain('https://tvescola.grupotec.dev.br');
    expect(contentSecurityPolicy).not.toContain('frame-src *');
    expect(contentSecurityPolicy).not.toContain('*.in9midia.com');

    for (const directive of [
      "default-src 'self'",
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
    ]) {
      expect(contentSecurityPolicy).toContain(directive);
    }

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('proxyfica NeoNews no caminho same-origin de qualquer tenant', () => {
    expect(
      shouldProxyNeoNewsRequest(
        'sesi.grupotec.dev.br',
        '/neonews/logon.jsp',
      ),
    ).toBe(true);
    expect(
      shouldProxyNeoNewsRequest(
        'tecescola.grupotec.dev.br',
        '/neonews/logon.jsp',
      ),
    ).toBe(true);
    expect(
      shouldProxyNeoNewsRequest('sesi.grupotec.dev.br', '/dashboard'),
    ).toBe(false);
    expect(
      shouldProxyNeoNewsRequest('foo.tvescola.grupotec.dev.br', '/neonews/'),
    ).toBe(false);
  });

  it('proxyfica mantendo o host publico do NeoNews e preservando path e query', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response('neonews', { status: 200 }),
    );
    const request = new Request(
      'https://tvescola.grupotec.dev.br/neonews/logon.jsp?sys=NEC&msgKey=',
    );

    const response = await proxyTvescolaRequest(request, upstreamFetch);

    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch.mock.calls[0][0]).toBe(
      'https://tvescola.grupotec.dev.br/neonews/logon.jsp?sys=NEC&msgKey=',
    );
    expect(upstreamFetch.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      redirect: 'manual',
    });
    expect(await response.text()).toBe('neonews');
  });

  it('preserva POST e ajusta Origin e Referer para o upstream', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(new Response('ok'));
    const request = new Request(
      'https://tvescola.grupotec.dev.br/neonews/session',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://tvescola.grupotec.dev.br',
          referer: 'https://tvescola.grupotec.dev.br/neonews/logon.jsp',
        },
        body: 'field=value',
      },
    );

    await proxyTvescolaRequest(request, upstreamFetch);

    const init = upstreamFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(init.method).toBe('POST');
    expect(headers.get('origin')).toBe('https://tvescola.grupotec.dev.br');
    expect(headers.get('referer')).toBe(
      'https://tvescola.grupotec.dev.br/neonews/logon.jsp',
    );
  });

  it('proxyfica o caminho same-origin de tecescola para o NeoNews', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(new Response('ok'));
    const request = new Request(
      'https://tecescola.grupotec.dev.br/neonews/session',
      {
        method: 'POST',
        headers: {
          origin: 'https://tecescola.grupotec.dev.br',
          referer: 'https://tecescola.grupotec.dev.br/neonews/logon.jsp',
        },
        body: 'field=value',
      },
    );

    await proxyTvescolaRequest(request, upstreamFetch);

    expect(upstreamFetch.mock.calls[0][0]).toBe(
      'https://tvescola.grupotec.dev.br/neonews/session',
    );
    const headers = new Headers(
      (upstreamFetch.mock.calls[0][1] as RequestInit).headers,
    );
    expect(headers.get('origin')).toBe('https://tvescola.grupotec.dev.br');
    expect(headers.get('referer')).toBe(
      'https://tvescola.grupotec.dev.br/neonews/logon.jsp',
    );
  });

  it('reescreve redirects do NeoNews de volta para o host same-origin', () => {
    expect(
      rewriteNeoNewsLocation(
        'https://tvescola.grupotec.dev.br/neonews/home.jsp?a=1',
        'https://tecescola.grupotec.dev.br',
      ),
    ).toBe(
      'https://tecescola.grupotec.dev.br/neonews/home.jsp?a=1',
    );
  });

  it('reescreve redirects absolutos do NeoNews para tvescola', () => {
    expect(
      rewriteNeoNewsLocation(
        'https://admin.in9midia.com/neonews/home.jsp?a=1',
      ),
    ).toBe(
      'https://tvescola.grupotec.dev.br/neonews/home.jsp?a=1',
    );

    expect(
      rewriteNeoNewsLocation('https://example.com/outside'),
    ).toBe('https://example.com/outside');
  });

  it('transforma cookies do upstream em cookies host-only', () => {
    expect(
      rewriteNeoNewsSetCookie(
        'JSESSIONID=abc; Path=/; Domain=.in9midia.com; Secure; HttpOnly; SameSite=Lax',
      ),
    ).toBe(
      'JSESSIONID=abc; Path=/; Secure; HttpOnly; SameSite=Lax',
    );

    expect(
      rewriteNeoNewsSetCookie(
        'NEO=1; Domain=tvescola.grupotec.dev.br; Path=/neonews; Secure',
      ),
    ).toBe('NEO=1; Path=/neonews; Secure');
  });

  it('mantem upstream fixo mesmo com url externa na query', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(new Response('ok'));
    const request = new Request(
      'https://tvescola.grupotec.dev.br/neonews/?url=https://evil.example',
    );

    await proxyTvescolaRequest(request, upstreamFetch);

    expect(upstreamFetch.mock.calls[0][0]).toBe(
      'https://tvescola.grupotec.dev.br/neonews/?url=https://evil.example',
    );
  });

  it('nao aplica proxy a hostnames parecidos', async () => {
    const expectedResponse = new Response('asset');
    const assets = {
      fetch: vi.fn().mockResolvedValue(expectedResponse),
    };
    const request = new Request(
      'https://foo.tvescola.grupotec.dev.br/',
    );

    const response = await worker.fetch(request, { ASSETS: assets });

    expect(assets.fetch).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe('asset');
  });

  it('protege apenas o acesso cross-origin conhecido do bootstrap do wfr.js', () => {
    const patched = patchNeoNewsWfr(validWfrSource);

    expect(patched).not.toBe(validWfrSource);
    expect((patched.match(/try \{/g) ?? []).length).toBe(3);
    expect(patched).toContain('candidateParent._NULL_PARENT;');
    expect(patched).toContain('p = null;');
  });

  it('mantem o wfr.js intacto quando o marker esperado nao existe', () => {
    const source = 'window.parent._JQUERY_WINDOW_DIV_ID;';
    expect(patchNeoNewsWfr(source)).toBe(source);
  });

  it('mantem a fonte intacta quando qualquer bloco conhecido esta duplicado', () => {
    const duplicated = `${validWfrSource}\n${validWfrSource}`;
    expect(patchNeoNewsWfr(duplicated)).toBe(duplicated);
  });

  it('mantem o body de wfr.js sem marker quando passa pelo proxy', async () => {
    const source = 'window.parent._JQUERY_WINDOW_DIV_ID;';
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(source, {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      }),
    );

    const response = await proxyTvescolaRequest(
      new Request('https://tvescola.grupotec.dev.br/neonews/wfr.js'),
      upstreamFetch,
    );

    expect(await response.text()).toBe(source);
  });

  it('mantem JS diferente de wfr.js intacto', async () => {
    const source = 'window.parent._JQUERY_WINDOW_DIV_ID;';
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(source, {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      }),
    );

    const response = await proxyTvescolaRequest(
      new Request('https://tvescola.grupotec.dev.br/neonews/app.js'),
      upstreamFetch,
    );

    expect(await response.text()).toBe(source);
  });

  it('mantem wfr.js intacto quando Content-Type nao e JavaScript', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(validWfrSource, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    const response = await proxyTvescolaRequest(
      new Request('https://tvescola.grupotec.dev.br/neonews/wfr.js'),
      upstreamFetch,
    );

    expect(await response.text()).toBe(validWfrSource);
  });

  it('remove headers invalidos quando wfr.js e alterado', async () => {
    const source = validWfrSource;
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(source, {
        status: 200,
        headers: {
          'content-type': 'application/javascript',
          'content-length': String(source.length),
          'content-encoding': 'br',
          etag: 'abc',
          'content-md5': 'def',
          'set-cookie': 'SESSION=1; Path=/neonews/; Secure',
        },
      }),
    );

    const response = await proxyTvescolaRequest(
      new Request('https://tvescola.grupotec.dev.br/neonews/wfr.js'),
      upstreamFetch,
    );

    expect(await response.text()).not.toBe(source);
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('content-md5')).toBeNull();
    expect(response.headers.get('set-cookie')).toContain('SESSION=1');
  });
});
