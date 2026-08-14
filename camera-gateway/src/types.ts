export type CameraGatewayStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type GatewayRuntimeState = 'PAIRED' | 'REVOKED';

export interface GatewayConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  gatewayId: string;
  institutionId: string;
  gatewayToken: string;
  localBaseUrl: string;
  mediaMtxHlsUrl: string;
  mediaMtxRtspUrl: string;
  pairedAt: string;
}
export interface PairResponse {
  gatewayId: string;
  institutionId: string;
  gatewayToken: string;
  localBaseUrl: string;
  pairedAt: string;
}

export interface CameraConfig {
  id: string;
  institutionId: string;
  name: string;
  host: string;
  port: number;
  protocol: 'RTSP' | 'ONVIF';
  channel: number | null;
  streamProfile: 'MAIN' | 'SUB';
  active: boolean;
}

export interface StreamSessionAuthorization {
  cameraId: string;
  institutionId: string;
  streamPath: string;
  expiresAt: string;
}

export interface GatewayStatusSnapshot {
  gatewayId: string | null;
  institutionId: string | null;
  paired: boolean;
  state: GatewayRuntimeState;
  running: boolean;
  lastHeartbeatAt: string | null;
  lastSyncAt: string | null;
  cameraCount: number;
  error: string | null;
}

export interface CameraProbeResult {
  reachable: boolean;
  codec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean;
  error: string | null;
}
