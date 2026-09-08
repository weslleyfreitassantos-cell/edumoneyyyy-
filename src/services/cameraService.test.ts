import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import { cameraService, type CameraMutationInput } from './cameraService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));

describe('cameraService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: null } as never);
  });

  it('lista apenas o contrato seguro retornado pela RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{
        id: 'camera-1', institution_id: 'institution-1', gateway_id: null,
        gateway_name: null, gateway_status: 'UNKNOWN', gateway_last_seen_at: null,
        name: 'Entrada', location: 'Portaria', manufacturer: 'Intelbras', model: null,
        device_type: 'IP_CAMERA', protocol: 'ONVIF', host: '192.168.1.50', port: 554,
        channel: null, stream_profile: 'SUB', active: true, director_access: true,
        guardian_access: false, created_at: '2026-08-13', updated_at: '2026-08-13',
        credential_secret_ref: 'must-not-be-consumed', password: 'must-not-be-consumed',
      }],
      error: null,
    } as never);

    const [camera] = await cameraService.list('institution-1');
    expect(camera).not.toHaveProperty('credentialSecretRef');
    expect(camera).not.toHaveProperty('password');
    expect(camera.guardianAccess).toBe(false);
    expect(supabase.rpc).toHaveBeenCalledWith('list_director_cameras', {
      target_institution_id: 'institution-1',
    });
  });

  it('converte erro de autorização em mensagem segura', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'internal database detail' },
    } as never);

    await expect(cameraService.list('institution-1')).rejects.toThrow(/permissão/i);
    await expect(cameraService.list('institution-1')).rejects.not.toThrow(/internal database/i);
  });

  it('lista gateways independentemente da quantidade de cameras', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{
        gateway_id: 'gateway-1',
        gateway_name: 'Gateway principal',
        gateway_status: 'ONLINE',
        gateway_last_seen_at: '2026-08-14T21:46:18.758Z',
      }],
      error: null,
    } as never);

    await expect(cameraService.listGateways('institution-1')).resolves.toEqual([{
      id: 'gateway-1',
      name: 'Gateway principal',
      status: 'ONLINE',
      lastSeenAt: '2026-08-14T21:46:18.758Z',
      relayStatus: 'UNKNOWN',
      relayLastSeenAt: null,
      relayConfigured: false,
    }]);
    expect(supabase.rpc).toHaveBeenCalledWith('list_director_camera_gateways_v2', {
      target_institution_id: 'institution-1',
    });
  });

  it('mantem compatibilidade enquanto a RPC de relay ainda nao foi aplicada', async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'function not found' } } as never)
      .mockResolvedValueOnce({
        data: [{ gateway_id: 'gateway-1', gateway_name: 'Gateway local', gateway_status: 'ONLINE', gateway_last_seen_at: null }],
        error: null,
      } as never);

    await expect(cameraService.listGateways('institution-1')).resolves.toEqual([expect.objectContaining({
      id: 'gateway-1', relayConfigured: false, relayStatus: 'UNKNOWN',
    })]);
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'list_director_camera_gateways', {
      target_institution_id: 'institution-1',
    });
  });

  it('normaliza o payload antes de criar a câmera no RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'camera-1', error: null } as never);

    const input: CameraMutationInput = {
      institutionId: ' institution-1 ',
      name: ' Entrada ',
      location: ' Sala ',
      manufacturer: ' Outro ',
      model: ' LifeCam ',
      deviceType: 'IP_CAMERA',
      protocol: 'RTSP',
      host: ' 127.0.0.1 ',
      port: 8554,
      channel: 1,
      streamProfile: 'MAIN',
      gatewayId: ' gateway-1 ',
    };

    await cameraService.create(input);

    expect(supabase.rpc).toHaveBeenCalledWith('create_director_camera', {
      target_institution_id: 'institution-1',
      camera_name: 'Entrada',
      camera_location: 'Sala',
      camera_manufacturer: 'Outro',
      camera_model: 'LifeCam',
      camera_device_type: 'IP_CAMERA',
      camera_protocol: 'RTSP',
      camera_host: '127.0.0.1',
      camera_port: 8554,
      camera_channel: null,
      camera_stream_profile: 'MAIN',
      camera_gateway_id: 'gateway-1',
    });
  });

  it('preserva URL HTTPS do relay remoto sem expor dados de camera', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{
        session_id: 'session-1',
        playback_url: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/index.m3u8?token=opaque',
        expires_at: '2026-08-15T23:00:00.000Z',
      }],
      error: null,
    } as never);

    await expect(cameraService.createStreamSession('camera-1')).resolves.toMatchObject({
      protocol: 'HLS',
      playbackUrl: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/index.m3u8?token=opaque',
      hlsUrl: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/index.m3u8?token=opaque',
      webrtcUrl: null,
    });
  });

  it('usa credenciais TURN temporarias sem deixar a falha do TURN bloquear HLS', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{
        session_id: 'session-1',
        camera_id: 'camera-1',
        playback_url: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/index.m3u8?token=opaque',
        expires_at: '2026-08-15T23:00:00.000Z',
      }],
      error: null,
    } as never);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        iceServers: [{
          urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp'],
          username: 'temporary-user',
          credential: 'temporary-credential',
        }],
      },
      error: null,
    } as never);

    await expect(cameraService.createStreamSession('camera-1')).resolves.toMatchObject({
      protocol: 'WEBRTC',
      webrtcUrl: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/whep?token=opaque',
      iceServers: [{
        urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
        username: 'temporary-user',
        credential: 'temporary-credential',
      }],
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('camera-turn-credentials', {
      body: { camera_id: 'camera-1', session_id: 'session-1' },
    });
  });
});
