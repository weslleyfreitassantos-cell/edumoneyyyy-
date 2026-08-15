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
  relayBaseUrl: 'https://camera-gw-0123456789abcdef.grupotec.dev.br',
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
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ success: false, code: 'PAIRING_REJECTED', message: 'internal detail' }), { status: 403 })));
    const api = new SupabaseGatewayApi(config.supabaseUrl, config.supabaseAnonKey);

    const error = await api.pair('expired-code', config.localBaseUrl).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/HTTP 403/);
    expect((error as Error).message).not.toContain('internal detail');
  });

  it('preserva o codigo de rejeicao sem expor detalhes internos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, code: 'GATEWAY_REJECTED', message: 'token hash detail' }), { status: 401 })));
    const api = new SupabaseGatewayApi(config.supabaseUrl, config.supabaseAnonKey);

    const error = await api.heartbeat(config).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ name: 'GatewayApiError', status: 401, code: 'GATEWAY_REJECTED' });
    expect((error as Error).message).toContain('nao esta autorizado');
    expect((error as Error).message).not.toContain('token hash detail');
  });

  it('normaliza a resposta snake_case da RPC de sincronizacao', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: true,
      cameras: [{
        id: 'camera-a', institution_id: config.institutionId, name: 'Entrada', host: '127.0.0.1', port: 8554,
        protocol: 'RTSP', channel: null, stream_profile: 'SUB', active: true,
      }],
    }), { status: 200 })));
    const api = new SupabaseGatewayApi(config.supabaseUrl, config.supabaseAnonKey);

    await expect(api.sync(config)).resolves.toEqual([expect.objectContaining({
      id: 'camera-a', institutionId: config.institutionId, streamProfile: 'SUB', active: true,
    })]);
  });

  it('recebe o relay HTTPS sem registrar o token no request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      relay_base_url: 'https://camera-gw-0123456789abcdef.grupotec.dev.br',
      tunnel_id: '33333333-3333-4333-8333-333333333333',
      tunnel_token: 'tunnel-token-kept-in-local-file',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new SupabaseGatewayApi(config.supabaseUrl, config.supabaseAnonKey);

    await expect(api.provisionRelay(config)).resolves.toMatchObject({
      relayBaseUrl: 'https://camera-gw-0123456789abcdef.grupotec.dev.br',
      tunnelId: '33333333-3333-4333-8333-333333333333',
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('tunnel_token');
  });
});
