import { describe, expect, it, vi } from 'vitest';
import worker from './index';

describe('Worker script', () => {
  it('delega a requisição para o binding ASSETS', async () => {
    const expectedResponse = new Response('asset');
    const assets = {
      fetch: vi.fn().mockResolvedValue(expectedResponse),
    };

    const request = new Request('https://tecescola.grupotec.dev.br/dashboard');

    const response = await worker.fetch(request, {
      ASSETS: assets,
    });

    expect(assets.fetch).toHaveBeenCalledWith(request);
    expect(response).toBe(expectedResponse);
  });
});
