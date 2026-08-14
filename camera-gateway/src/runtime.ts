import type { GatewayCloudApi } from './api.ts';
import type { CameraPublisher, CameraSourceOverride } from './publisher.ts';
import type {
  CameraConfig,
  CameraProbeResult,
  GatewayConfig,
  GatewayStatusSnapshot,
  StreamSessionAuthorization,
} from './types.ts';
import { probeRtsp } from './rtsp.ts';

interface SessionState extends StreamSessionAuthorization {
  sessionId: string;
}

export interface GatewayRuntimeOptions {
  config: GatewayConfig;
  api: GatewayCloudApi;
  publisher: CameraPublisher;
  ffprobePath: string;
  labSource?: CameraSourceOverride;
  probe?: (ffprobePath: string, url: string) => Promise<CameraProbeResult>;
}

export class GatewayRuntime {
  private readonly cameras = new Map<string, CameraConfig>();
  private readonly sessions = new Map<string, SessionState>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastHeartbeatAt: string | null = null;
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;
  private running = false;
  private readonly options: GatewayRuntimeOptions;

  constructor(options: GatewayRuntimeOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.syncNow();
    await this.heartbeatNow();
    this.heartbeatTimer = setInterval(() => void this.heartbeatNow(), 25_000);
    this.syncTimer = setInterval(() => void this.syncNow(), 30_000);
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.heartbeatTimer = null;
    this.syncTimer = null;
    this.options.publisher.stopAll();
    this.running = false;
  }

  async heartbeatNow(): Promise<void> {
    try {
      await this.options.api.heartbeat(this.options.config);
      this.lastHeartbeatAt = new Date().toISOString();
      this.lastError = null;
    } catch {
      this.lastError = 'Heartbeat indisponivel.';
    }
  }

  async syncNow(): Promise<void> {
    try {
      const cameras = await this.options.api.sync(this.options.config);
      this.cameras.clear();
      for (const camera of cameras) {
        if (camera.institutionId !== this.options.config.institutionId) continue;
        this.cameras.set(camera.id, camera);
      }
      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;
    } catch {
      this.lastError = 'Sincronizacao de cameras indisponivel.';
    }
  }

  async testCamera(cameraId: string): Promise<CameraProbeResult> {
    const camera = this.cameras.get(cameraId);
    if (!camera) throw new Error('Camera nao pertence a instituicao pareada.');
    const source = this.options.labSource?.cameraId === cameraId
      ? this.options.labSource.rtspUrl
      : `rtsp://${camera.host}:${camera.port}`;
    return (this.options.probe ?? probeRtsp)(this.options.ffprobePath, source);
  }

  async ensurePublisher(cameraId: string): Promise<string> {
    const camera = this.cameras.get(cameraId);
    if (!camera) throw new Error('Camera nao pertence a instituicao pareada.');
    const override = this.options.labSource?.cameraId === cameraId ? this.options.labSource : undefined;
    return this.options.publisher.start(camera, override);
  }

  async authorizeStream(sessionId: string, sessionToken: string): Promise<SessionState> {
    const current = this.sessions.get(sessionId);
    if (current && new Date(current.expiresAt).getTime() > Date.now()) return current;
    const authorization = await this.options.api.redeemStreamSession(this.options.config, sessionId, sessionToken);
    if (authorization.institutionId !== this.options.config.institutionId) throw new Error('Sessao de outra instituicao rejeitada.');
    if (!this.cameras.has(authorization.cameraId)) throw new Error('Camera da sessao nao esta sincronizada.');
    if (!Number.isFinite(Date.parse(authorization.expiresAt)) || Date.parse(authorization.expiresAt) <= Date.now()) {
      throw new Error('Sessao de stream expirada.');
    }
    const session = { sessionId, ...authorization };
    this.sessions.set(sessionId, session);
    await this.ensurePublisher(authorization.cameraId);
    return session;
  }

  getCameraStreamPath(session: SessionState): string {
    const override = this.options.labSource?.cameraId === session.cameraId ? this.options.labSource : undefined;
    if (override?.streamPath) return override.streamPath;
    if (!/^[a-zA-Z0-9_-]+$/.test(session.streamPath)) throw new Error('Caminho de stream invalido.');
    return session.streamPath;
  }

  status(): GatewayStatusSnapshot {
    return {
      gatewayId: this.options.config.gatewayId,
      institutionId: this.options.config.institutionId,
      paired: true,
      running: this.running,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastSyncAt: this.lastSyncAt,
      cameraCount: this.cameras.size,
      error: this.lastError,
    };
  }
}
