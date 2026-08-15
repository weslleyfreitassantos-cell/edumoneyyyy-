import { describe, expect, it, vi } from 'vitest';

import type { GatewayCloudApi } from './api.ts';
import { GatewayApiError } from './api.ts';
import type { CameraPublisher } from './publisher.ts';
import { GatewayRuntime } from './runtime.ts';
import type { CameraConfig, GatewayConfig } from './types.ts';

const config: GatewayConfig = {
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseAnonKey: 'public-key',
  gatewayId: 'gateway-a',
  institutionId: 'institution-a',
  gatewayToken: 'gateway-token',
  localBaseUrl: 'http://127.0.0.1:8787',
  relayBaseUrl: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br',
  mediaMtxHlsUrl: 'http://127.0.0.1:8888',
  mediaMtxRtspUrl: 'rtsp://127.0.0.1:8554',
  pairedAt: new Date().toISOString(),
};

const cameraA: CameraConfig = {
  id: 'camera-a', institutionId: 'institution-a', name: 'Entrada', host: '192.168.1.50',
  port: 554, protocol: 'RTSP', channel: null, streamProfile: 'SUB', active: true,
};

function createRuntime(apiOverrides: Partial<GatewayCloudApi> = {}, runtimeOverrides: Partial<ConstructorParameters<typeof GatewayRuntime>[0]> = {}) {
  const api: GatewayCloudApi = {
    pair: vi.fn(),
    heartbeat: vi.fn(async () => undefined),
    relayHeartbeat: vi.fn(async () => undefined),
    provisionRelay: vi.fn(),
    sync: vi.fn(async () => [cameraA]),
    redeemStreamSession: vi.fn(async () => ({
      cameraId: cameraA.id,
      institutionId: cameraA.institutionId,
      streamPath: 'camera-a',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })),
    ...apiOverrides,
  };
  const publisher: CameraPublisher = {
    start: vi.fn(async () => 'camera-a'),
    stop: vi.fn(),
    stopAll: vi.fn(),
  };
  return {
    runtime: new GatewayRuntime({
      config,
      api,
      publisher,
      ffprobePath: 'ffprobe',
      probeRelay: vi.fn(async () => undefined),
      ...runtimeOverrides,
    }),
    api,
    publisher,
  };
}

describe('GatewayRuntime', () => {
  it('sincroniza somente cameras da instituicao pareada', async () => {
    const { runtime, api } = createRuntime({
      sync: vi.fn(async () => [cameraA, { ...cameraA, id: 'camera-b', institutionId: 'institution-b' }]),
    });
    await runtime.syncNow();
    expect(runtime.status().cameraCount).toBe(1);
    expect(api.sync).toHaveBeenCalledWith(config);
  });

  it('rejeita sessao de outra instituicao antes de publicar', async () => {
    const { runtime, publisher } = createRuntime({
      redeemStreamSession: vi.fn(async () => ({
        cameraId: cameraA.id,
        institutionId: 'institution-b',
        streamPath: 'camera-b',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })),
    });
    await runtime.syncNow();
    await expect(runtime.authorizeStream('session-a', 'session-token')).rejects.toThrow(/instituicao/i);
    expect(publisher.start).not.toHaveBeenCalled();
  });

  it('autoriza sessao, inicia publisher e reaproveita a sessao enquanto valida', async () => {
    const { runtime, api, publisher } = createRuntime();
    await runtime.syncNow();
    const first = await runtime.authorizeStream('session-a', 'session-token');
    const second = await runtime.authorizeStream('session-a', 'session-token');
    expect(first.cameraId).toBe(cameraA.id);
    expect(second.sessionId).toBe('session-a');
    expect(api.redeemStreamSession).toHaveBeenCalledTimes(1);
    expect(publisher.start).toHaveBeenCalledTimes(1);
  });

  it('informa gateway offline quando heartbeat falha', async () => {
    const { runtime } = createRuntime({ heartbeat: vi.fn(async () => { throw new Error('offline'); }) });
    await runtime.heartbeatNow();
    expect(runtime.status().error).toBe('Heartbeat indisponivel.');
  });

  it('registra o heartbeat do relay HTTPS sem esconder falha do gateway local', async () => {
    const { runtime, api } = createRuntime();
    await runtime.heartbeatNow();
    expect(api.relayHeartbeat).toHaveBeenCalledWith(config, config.relayBaseUrl);
    expect(runtime.status()).toMatchObject({ relayConfigured: true, relayOnline: true });
  });

  it('mantem o gateway local saudavel quando somente o relay falha', async () => {
    const { runtime } = createRuntime({ relayHeartbeat: vi.fn(async () => { throw new Error('relay offline'); }) });
    await runtime.heartbeatNow();
    expect(runtime.status()).toMatchObject({ relayConfigured: true, relayOnline: false, relayError: 'Relay HTTPS indisponivel.', error: null });
  });

  it('nao envia heartbeat do relay quando o hostname HTTPS nao alcança o gateway', async () => {
    const { runtime, api } = createRuntime({}, {
      probeRelay: vi.fn(async () => { throw new Error('tunnel offline'); }),
    });
    await runtime.heartbeatNow();
    expect(api.relayHeartbeat).not.toHaveBeenCalled();
    expect(runtime.health()).toMatchObject({ gatewayOnline: false, relayOnline: false });
  });

  it('interrompe acesso e marca o gateway como revogado quando o backend rejeita o token', async () => {
    const { runtime, publisher } = createRuntime({
      heartbeat: vi.fn(async () => { throw new GatewayApiError('rejected', 401, 'GATEWAY_REJECTED'); }),
    });
    await runtime.start();
    await runtime.heartbeatNow();
    expect(runtime.status()).toMatchObject({ paired: false, state: 'REVOKED', running: false, error: 'Gateway revogado.' });
    expect(publisher.stopAll).toHaveBeenCalled();
    await runtime.heartbeatNow();
    expect((runtime.status().state)).toBe('REVOKED');
  });

  it('rejeita sessao expirada antes de publicar', async () => {
    const { runtime, publisher } = createRuntime({
      redeemStreamSession: vi.fn(async () => ({
        cameraId: cameraA.id,
        institutionId: cameraA.institutionId,
        streamPath: 'camera-a',
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      })),
    });
    await runtime.syncNow();
    await expect(runtime.authorizeStream('expired', 'token')).rejects.toThrow(/expirada/i);
    expect(publisher.start).not.toHaveBeenCalled();
  });

  it('testa camera offline sem expor a URL', async () => {
    const { runtime } = createRuntime({}, {
      probe: vi.fn(async () => ({
        reachable: false, codec: null, width: null, height: null, fps: null,
        hasAudio: false, error: 'Camera indisponivel.',
      })),
    });
    await runtime.syncNow();
    const result = await runtime.testCamera(cameraA.id);
    expect(result).toMatchObject({ reachable: false, error: 'Camera indisponivel.' });
    expect(result).not.toHaveProperty('url');
  });
});
