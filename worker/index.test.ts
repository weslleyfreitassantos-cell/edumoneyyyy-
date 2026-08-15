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
    expect(response.headers.get('content-security-policy')).not.toContain('http:');
    expect(response.headers.get('content-security-policy')).toContain('https://*.cameras.grupotec.dev.br');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
