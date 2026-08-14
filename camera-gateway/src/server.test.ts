import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GatewayCloudApi } from './api.ts';
import type { CameraPublisher } from './publisher.ts';
import { GatewayRuntime } from './runtime.ts';
import { createGatewayServer } from './server.ts';
import type { CameraConfig, GatewayConfig } from './types.ts';

const config: GatewayConfig = {
  supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: 'public-key', gatewayId: 'gateway-a',
  institutionId: 'institution-a', gatewayToken: 'gateway-token', localBaseUrl: 'http://127.0.0.1:8787',
  mediaMtxHlsUrl: 'http://127.0.0.1:8888', mediaMtxRtspUrl: 'rtsp://127.0.0.1:8554', pairedAt: new Date().toISOString(),
};
const camera: CameraConfig = {
  id: 'camera-a', institutionId: 'institution-a', name: 'Entrada', host: '192.168.1.50', port: 554,
  protocol: 'RTSP', channel: null, streamProfile: 'SUB', active: true,
};

describe('gateway HLS proxy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('revalida a sessao e reescreve os recursos da playlist', async () => {
    const clientFetch = globalThis.fetch;
    const upstreamFetch = vi.fn(async () => new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\nvideo1_stream.m3u8\n', {
      status: 200,
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
    }));
    vi.stubGlobal('fetch', upstreamFetch);
    const api: GatewayCloudApi = {
      pair: vi.fn(),
      heartbeat: vi.fn(async () => undefined),
      sync: vi.fn(async () => [camera]),
      redeemStreamSession: vi.fn(async () => ({
        cameraId: camera.id, institutionId: camera.institutionId, streamPath: 'camera-a',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })),
    };
    const publisher: CameraPublisher = { start: vi.fn(async () => 'camera-a'), stop: vi.fn(), stopAll: vi.fn() };
    const runtime = new GatewayRuntime({ config, api, publisher, ffprobePath: 'ffprobe' });
    await runtime.syncNow();
    const server = createGatewayServer(runtime, config.mediaMtxHlsUrl);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Porta de teste indisponivel.');
    const response = await clientFetch(`http://127.0.0.1:${address.port}/stream/session-a/index.m3u8?token=session-token`);
    const body = await response.text();
    server.close();
    expect(response.status).toBe(200);
    expect(body).toContain('/stream/session-a/video1_stream.m3u8?token=session-token');
    expect(upstreamFetch).toHaveBeenCalledWith('http://127.0.0.1:8888/camera-a/index.m3u8');
  });

  it('aguarda a playlist quando o MediaMTX ainda esta preparando o stream', async () => {
    let attempts = 0;
    const clientFetch = globalThis.fetch;
    const upstreamFetch = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) return new Response('not ready', { status: 404 });
      return new Response('#EXTM3U\nsegment.ts\n', {
        status: 200,
        headers: { 'content-type': 'application/vnd.apple.mpegurl' },
      });
    });
    vi.stubGlobal('fetch', upstreamFetch);
    const api: GatewayCloudApi = {
      pair: vi.fn(),
      heartbeat: vi.fn(async () => undefined),
      sync: vi.fn(async () => [camera]),
      redeemStreamSession: vi.fn(async () => ({
        cameraId: camera.id, institutionId: camera.institutionId, streamPath: 'camera-a',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })),
    };
    const publisher: CameraPublisher = { start: vi.fn(async () => 'camera-a'), stop: vi.fn(), stopAll: vi.fn() };
    const runtime = new GatewayRuntime({ config, api, publisher, ffprobePath: 'ffprobe' });
    await runtime.syncNow();
    const server = createGatewayServer(runtime, config.mediaMtxHlsUrl);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Porta de teste indisponivel.');
    const response = await clientFetch(`http://127.0.0.1:${address.port}/stream/session-a/index.m3u8?token=session-token`);
    server.close();
    expect(response.status).toBe(200);
    expect(attempts).toBe(3);
  });

  it('aceita preflight somente para origem explicitamente configurada', async () => {
    const previousOrigins = process.env.CAMERA_GATEWAY_ALLOWED_ORIGINS;
    process.env.CAMERA_GATEWAY_ALLOWED_ORIGINS = 'http://192.168.1.108:3000';
    const api: GatewayCloudApi = {
      pair: vi.fn(),
      heartbeat: vi.fn(async () => undefined),
      sync: vi.fn(async () => []),
      redeemStreamSession: vi.fn(),
    };
    const publisher: CameraPublisher = { start: vi.fn(async () => 'camera-a'), stop: vi.fn(), stopAll: vi.fn() };
    const runtime = new GatewayRuntime({ config, api, publisher, ffprobePath: 'ffprobe' });
    const server = createGatewayServer(runtime, config.mediaMtxHlsUrl);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Porta de teste indisponivel.');

    try {
      const allowed = await fetch(`http://127.0.0.1:${address.port}/stream/session/index.m3u8`, {
        method: 'OPTIONS',
        headers: { Origin: 'http://192.168.1.108:3000' },
      });
      const rejected = await fetch(`http://127.0.0.1:${address.port}/stream/session/index.m3u8`, {
        method: 'OPTIONS',
        headers: { Origin: 'http://192.168.1.109:3000' },
      });
      expect(allowed.status).toBe(204);
      expect(allowed.headers.get('access-control-allow-origin')).toBe('http://192.168.1.108:3000');
      expect(rejected.status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (previousOrigins === undefined) delete process.env.CAMERA_GATEWAY_ALLOWED_ORIGINS;
      else process.env.CAMERA_GATEWAY_ALLOWED_ORIGINS = previousOrigins;
    }
  });
});
