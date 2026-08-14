import { afterEach, describe, expect, it, vi } from 'vitest';

import { SupabaseGatewayApi } from './api.ts';
import type { GatewayConfig } from './types.ts';

const config: GatewayConfig = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'public-key',
  gatewayId: '11111111-1111-4111-8111-111111111111',
  institutionId: '22222222-2222-4222-8222-222222222222',
  gatewayToken: 'gateway-token',
  localBaseUrl: 'http://127.0.0.1:8787',
  mediaMtxHlsUrl: 'http://127.0.0.1:8888',
  mediaMtxRtspUrl: 'rtsp://127.0.0.1:8554',
  pairedAt: new Date().toISOString(),
};

describe('Supabase gateway API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envia nonce e expiracao em chamadas autenticadas', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true, cameras: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new SupabaseGatewayApi(config.supabaseUrl, config.supabaseAnonKey);

    await api.sync(config);

    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ action: 'sync', gateway_id: config.gatewayId });
    expect(typeof body.request_id).toBe('string');
    expect(typeof body.expires_at).toBe('string');
    expect(new Headers(request?.headers).get('authorization')).toBe(`Bearer ${config.gatewayToken}`);
  });

  it('converte pareamento rejeitado sem expor detalhes do backend', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ success: false, error: 'PAIRING_REJECTED', message: 'internal detail' }), { status: 403 })));
    const api = new SupabaseGatewayApi(config.supabaseUrl, config.supabaseAnonKey);

    const error = await api.pair('expired-code', config.localBaseUrl).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/HTTP 403/);
    expect((error as Error).message).not.toContain('internal detail');
  });
});
