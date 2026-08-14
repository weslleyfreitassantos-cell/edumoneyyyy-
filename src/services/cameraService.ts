import { supabase } from '../lib/supabaseClient';

export type CameraGatewayStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type CameraDeviceType = 'IP_CAMERA' | 'NVR';
export type CameraProtocol = 'ONVIF' | 'RTSP';
export type CameraStreamProfile = 'MAIN' | 'SUB';
export type CameraAccessEvent = 'VIEW_STARTED' | 'VIEW_ENDED' | 'CONNECTION_TEST';

export interface DirectorCamera {
  id: string;
  institutionId: string;
  gatewayId: string | null;
  gatewayName: string | null;
  gatewayStatus: CameraGatewayStatus;
  gatewayLastSeenAt: string | null;
  name: string;
  location: string | null;
  manufacturer: string | null;
  model: string | null;
  deviceType: CameraDeviceType;
  protocol: CameraProtocol;
  host: string;
  port: number;
  channel: number | null;
  streamProfile: CameraStreamProfile;
  active: boolean;
  directorAccess: boolean;
  guardianAccess: false;
  createdAt: string;
  updatedAt: string;
}

export interface CameraMutationInput {
  institutionId: string;
  name: string;
  location: string;
  manufacturer: string;
  model: string;
  deviceType: CameraDeviceType;
  protocol: CameraProtocol;
  host: string;
  port: number;
  channel: number | null;
  streamProfile: CameraStreamProfile;
  gatewayId: string | null;
  active?: boolean;
}

export interface CameraGateway {
  id: string;
  name: string;
  status: CameraGatewayStatus;
  lastSeenAt: string | null;
}

export interface CameraStreamSession {
  sessionId: string;
  protocol: 'HLS';
  playbackUrl: string | null;
  expiresAt: string;
}

export class CameraServiceError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CameraServiceError';
    this.code = code;
  }
}

function serviceError(error: { message?: string; code?: string } | null): CameraServiceError {
  const code = error?.code;
  if (code === '42501') return new CameraServiceError('Você não tem permissão para gerenciar câmeras nesta instituição.', code);
  if (code === '22023') return new CameraServiceError('Revise os dados da câmera e tente novamente.', code);
  if (code === '23503') return new CameraServiceError('O gateway selecionado não pertence a esta instituição.', code);
  return new CameraServiceError('Não foi possível concluir a ação da câmera agora.', code);
}

function normalize(row: Record<string, unknown>): DirectorCamera {
  return {
    id: String(row.id),
    institutionId: String(row.institution_id),
    gatewayId: row.gateway_id ? String(row.gateway_id) : null,
    gatewayName: row.gateway_name ? String(row.gateway_name) : null,
    gatewayStatus: (row.gateway_status as CameraGatewayStatus | null) ?? 'UNKNOWN',
    gatewayLastSeenAt: row.gateway_last_seen_at ? String(row.gateway_last_seen_at) : null,
    name: String(row.name ?? ''),
    location: row.location ? String(row.location) : null,
    manufacturer: row.manufacturer ? String(row.manufacturer) : null,
    model: row.model ? String(row.model) : null,
    deviceType: row.device_type as CameraDeviceType,
    protocol: row.protocol as CameraProtocol,
    host: String(row.host ?? ''),
    port: Number(row.port),
    channel: row.channel === null || row.channel === undefined ? null : Number(row.channel),
    streamProfile: row.stream_profile as CameraStreamProfile,
    active: row.active === true,
    directorAccess: row.director_access !== false,
    guardianAccess: false,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

async function invoke<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw serviceError(error);
  return data as T;
}

export const cameraService = {
  async list(institutionId: string): Promise<DirectorCamera[]> {
    const rows = await invoke<Record<string, unknown>[]>('list_director_cameras', {
      target_institution_id: institutionId,
    });
    return (rows ?? []).map(normalize);
  },

  async listGateways(institutionId: string): Promise<CameraGateway[]> {
    const rows = await invoke<Record<string, unknown>[]>('list_director_camera_gateways', {
      target_institution_id: institutionId,
    });
    return (rows ?? []).map((row) => ({
      id: String(row.gateway_id),
      name: String(row.gateway_name ?? ''),
      status: (row.gateway_status as CameraGatewayStatus | null) ?? 'UNKNOWN',
      lastSeenAt: row.gateway_last_seen_at ? String(row.gateway_last_seen_at) : null,
    }));
  },

  async create(input: CameraMutationInput): Promise<string> {
    return invoke<string>('create_director_camera', {
      target_institution_id: input.institutionId,
      camera_name: input.name,
      camera_location: input.location,
      camera_manufacturer: input.manufacturer,
      camera_model: input.model,
      camera_device_type: input.deviceType,
      camera_protocol: input.protocol,
      camera_host: input.host,
      camera_port: input.port,
      camera_channel: input.channel,
      camera_stream_profile: input.streamProfile,
      camera_gateway_id: input.gatewayId,
    });
  },

  async update(cameraId: string, input: CameraMutationInput): Promise<boolean> {
    return invoke<boolean>('update_director_camera', {
      target_camera_id: cameraId,
      camera_name: input.name,
      camera_location: input.location,
      camera_manufacturer: input.manufacturer,
      camera_model: input.model,
      camera_device_type: input.deviceType,
      camera_protocol: input.protocol,
      camera_host: input.host,
      camera_port: input.port,
      camera_channel: input.channel,
      camera_stream_profile: input.streamProfile,
      camera_gateway_id: input.gatewayId,
      camera_active: input.active ?? true,
    });
  },

  setActive(cameraId: string, active: boolean): Promise<boolean> {
    return invoke<boolean>('set_director_camera_active', {
      target_camera_id: cameraId,
      camera_active: active,
    });
  },

  remove(cameraId: string): Promise<boolean> {
    return invoke<boolean>('delete_director_camera', {
      target_camera_id: cameraId,
    });
  },

  async createGateway(institutionId: string, name: string): Promise<CameraGateway & { pairingCode: string; pairingExpiresAt: string }> {
    const rows = await invoke<Record<string, unknown>[]>('create_director_camera_gateway', {
      target_institution_id: institutionId,
      gateway_name: name,
    });
    const row = rows?.[0];
    if (!row) throw new CameraServiceError('Não foi possível criar o gateway.');
    return {
      id: String(row.gateway_id),
      name,
      status: 'UNKNOWN',
      lastSeenAt: null,
      pairingCode: String(row.pairing_code),
      pairingExpiresAt: String(row.pairing_expires_at),
    };
  },

  async testConnection(cameraId: string): Promise<{ gatewayStatus: CameraGatewayStatus; message: string }> {
    const rows = await invoke<Record<string, unknown>[]>('test_director_camera', {
      target_camera_id: cameraId,
    });
    const row = rows?.[0];
    return {
      gatewayStatus: (row?.gateway_status as CameraGatewayStatus | undefined) ?? 'UNKNOWN',
      message: String(row?.message ?? 'Gateway não conectado.'),
    };
  },

  async createStreamSession(cameraId: string): Promise<CameraStreamSession> {
    const rows = await invoke<Record<string, unknown>[]>('create_camera_stream_session', {
      target_camera_id: cameraId,
    });
    const row = rows?.[0];
    if (!row?.session_id || !row.expires_at) throw new CameraServiceError('Nao foi possivel criar a sessao temporaria da camera.');
    return {
      sessionId: String(row.session_id),
      protocol: 'HLS',
      playbackUrl: row.playback_url ? String(row.playback_url) : null,
      expiresAt: String(row.expires_at),
    };
  },

  logAccess(cameraId: string, event: CameraAccessEvent): Promise<boolean> {
    return invoke<boolean>('log_director_camera_access', {
      target_camera_id: cameraId,
      access_event: event,
    });
  },
};
