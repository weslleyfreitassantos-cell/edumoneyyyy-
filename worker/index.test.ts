import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, {
  proxyTvescolaRequest,
  rewriteNeoNewsLocation,
  rewriteNeoNewsSetCookie,
} from './index';

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('proxyfica tvescola para admin.in9midia.com preservando path e query', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response('neonews', { status: 200 }),
    );
    const request = new Request(
      'https://tvescola.grupotec.dev.br/neonews/logon.jsp?sys=NEC&msgKey=',
    );

    const response = await proxyTvescolaRequest(request, upstreamFetch);

    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch.mock.calls[0][0]).toBe(
      'https://admin.in9midia.com/neonews/logon.jsp?sys=NEC&msgKey=',
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
    expect(headers.get('origin')).toBe('https://admin.in9midia.com');
    expect(headers.get('referer')).toBe(
      'https://admin.in9midia.com/neonews/logon.jsp',
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
        'NEO=1; Domain=admin.in9midia.com; Path=/neonews; Secure',
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
      'https://admin.in9midia.com/neonews/?url=https://evil.example',
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
});
