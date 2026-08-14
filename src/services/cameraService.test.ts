import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import { cameraService } from './cameraService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}));

describe('cameraService', () => {
  beforeEach(() => vi.clearAllMocks());

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
    }]);
    expect(supabase.rpc).toHaveBeenCalledWith('list_director_camera_gateways', {
      target_institution_id: 'institution-1',
    });
  });
});
