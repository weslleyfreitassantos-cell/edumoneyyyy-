import { describe, expect, it, vi } from 'vitest';
import worker from './index';

describe('Worker script', () => {
  it('delega a requisição para o binding ASSETS', async () => {
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
      "frame-src 'self' https://admin.in9midia.com",
    );
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
});
