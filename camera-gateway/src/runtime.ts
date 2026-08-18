import { createHash } from 'node:crypto';

import { GatewayApiError, type GatewayCloudApi } from './api.ts';
import { PublisherStartError, type CameraPublisher, type CameraSourceOverride, type PublisherDiagnostic, type PublisherReasonCode } from './publisher.ts';
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
  sessionTokenHash: string;
}

export type StreamAuthorizationReasonCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'TOKEN_HASH_MISMATCH'
  | 'CAMERA_NOT_SYNCED'
  | 'CAMERA_INACTIVE'
  | 'INSTITUTION_MISMATCH'
  | 'REDEEM_RPC_REJECTED'
  | 'UNKNOWN_AUTHORIZATION_ERROR';

export interface StreamAuthorizationDiagnostic {
  reasonCode: StreamAuthorizationReasonCode;
  sessionId: string;
  gatewayId: string;
  gatewayInstitutionId: string;
  cameraId?: string;
  cameraInstitutionId?: string;
  expiresAt?: string;
  gatewayNow: string;
}

export class StreamAuthorizationError extends Error {
  readonly diagnostic: StreamAuthorizationDiagnostic;

  constructor(message: string, diagnostic: StreamAuthorizationDiagnostic) {
    super(message);
    this.name = 'StreamAuthorizationError';
    this.diagnostic = diagnostic;
  }
}

export interface StreamPublisherDiagnostic extends PublisherDiagnostic {
  sessionId: string;
  gatewayId: string;
  gatewayInstitutionId: string;
  cameraInstitutionId: string;
  labOverrideMatched: boolean;
  expiresAt: string;
  gatewayNow: string;
}

export class StreamPublisherError extends Error {
  readonly diagnostic: StreamPublisherDiagnostic;

  constructor(message: string, diagnostic: StreamPublisherDiagnostic) {
    super(message);
    this.name = 'StreamPublisherError';
    this.diagnostic = diagnostic;
  }
}

function sessionTokenHash(sessionToken: string): string {
  return createHash('sha256').update(sessionToken).digest('hex');
}

export interface GatewayRuntimeOptions {
  config: GatewayConfig;
  api: GatewayCloudApi;
  publisher: CameraPublisher;
  ffprobePath: string;
  labSource?: CameraSourceOverride;
  probe?: (ffprobePath: string, url: string) => Promise<CameraProbeResult>;
  probeRelay?: (relayBaseUrl: string) => Promise<void>;
}

function isRevocationError(error: unknown): boolean {
  return error instanceof GatewayApiError && (error.code === 'GATEWAY_REJECTED' || error.code === 'UNAUTHENTICATED');
}

async function probeRelayUrl(relayBaseUrl: string): Promise<void> {
  const response = await fetch(`${relayBaseUrl}/health`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error('Relay health check failed.');
  const body = await response.json() as { gatewayOnline?: unknown };
  if (body.gatewayOnline !== true) throw new Error('Gateway relay is not online.');
}

function matchesLabCamera(override: CameraSourceOverride | undefined, cameraId: string): boolean {
  return Boolean(override && override.cameraId.trim().toLowerCase() === cameraId.trim().toLowerCase());
}

export class GatewayRuntime {
  private readonly cameras = new Map<string, CameraConfig>();
  private readonly sessions = new Map<string, SessionState>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastHeartbeatAt: string | null = null;
  private lastSyncAt: string | null = null;
  private lastRelayHeartbeatAt: string | null = null;
  private relayError: string | null = null;
  private relayOnline = false;
  private lastError: string | null = null;
  private revoked = false;
  private running = false;
  private readonly options: GatewayRuntimeOptions;

  constructor(options: GatewayRuntimeOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    if (this.running || this.revoked) return;
    this.running = true;
    await this.syncNow();
    await this.heartbeatNow();
    if (this.revoked) return;
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

  private markRevoked(): void {
    this.revoked = true;
    this.lastError = 'Gateway revogado.';
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.heartbeatTimer = null;
    this.syncTimer = null;
    this.options.publisher.stopAll();
    this.running = false;
  }

  async heartbeatNow(): Promise<void> {
    if (this.revoked) return;
    try {
      await this.options.api.heartbeat(this.options.config);
      this.lastHeartbeatAt = new Date().toISOString();
      if (this.options.config.relayBaseUrl) {
        try {
          await (this.options.probeRelay ?? probeRelayUrl)(this.options.config.relayBaseUrl);
          await this.options.api.relayHeartbeat(this.options.config, this.options.config.relayBaseUrl);
          this.lastRelayHeartbeatAt = new Date().toISOString();
          this.relayOnline = true;
          this.relayError = null;
        } catch {
          this.relayOnline = false;
          this.relayError = 'Relay HTTPS indisponivel.';
        }
      } else {
        this.relayOnline = false;
        this.relayError = null;
      }
      this.lastError = null;
    } catch (error) {
      if (isRevocationError(error)) {
        this.markRevoked();
        return;
      }
      this.lastError = 'Heartbeat indisponivel.';
    }
  }

  async syncNow(): Promise<void> {
    if (this.revoked) return;
    try {
      const cameras = await this.options.api.sync(this.options.config);
      this.cameras.clear();
      for (const camera of cameras) {
        if (camera.institutionId !== this.options.config.institutionId) continue;
        this.cameras.set(camera.id, camera);
      }
      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;
    } catch (error) {
      if (isRevocationError(error)) {
        this.markRevoked();
        return;
      }
      this.lastError = 'Sincronizacao de cameras indisponivel.';
    }
  }

  async testCamera(cameraId: string): Promise<CameraProbeResult> {
    const camera = this.cameras.get(cameraId);
    if (!camera) throw new Error('Camera nao pertence a instituicao pareada.');
    const source = matchesLabCamera(this.options.labSource, cameraId)
      ? this.options.labSource.rtspUrl
      : `rtsp://${camera.host}:${camera.port}`;
    return (this.options.probe ?? probeRtsp)(this.options.ffprobePath, source);
  }

  async ensurePublisher(cameraId: string): Promise<string> {
    const camera = this.cameras.get(cameraId);
    if (!camera) throw new Error('Camera nao pertence a instituicao pareada.');
    const override = matchesLabCamera(this.options.labSource, cameraId) ? this.options.labSource : undefined;
    return this.options.publisher.start(camera, override);
  }

  async authorizeStream(sessionId: string, sessionToken: string): Promise<SessionState> {
    if (this.revoked) throw new Error('Gateway revogado.');
    const current = this.sessions.get(sessionId);
    const gatewayNow = new Date().toISOString();
    const tokenMatchesCache = current?.sessionTokenHash === sessionTokenHash(sessionToken);
    if (current && tokenMatchesCache && new Date(current.expiresAt).getTime() > Date.now()) return current;
    const cachedTokenMismatch = Boolean(current && !tokenMatchesCache);
    const cachedSessionExpired = Boolean(current && new Date(current.expiresAt).getTime() <= Date.now());
    let authorization: StreamSessionAuthorization;
    try {
      authorization = await this.options.api.redeemStreamSession(this.options.config, sessionId, sessionToken);
    } catch (error) {
      if (isRevocationError(error)) this.markRevoked();
      throw new StreamAuthorizationError('Sessao de stream rejeitada.', {
        reasonCode: cachedTokenMismatch
          ? 'TOKEN_HASH_MISMATCH'
          : cachedSessionExpired
            ? 'SESSION_EXPIRED'
            : 'REDEEM_RPC_REJECTED',
        sessionId,
        gatewayId: this.options.config.gatewayId,
        gatewayInstitutionId: this.options.config.institutionId,
        expiresAt: current?.expiresAt,
        gatewayNow,
      });
    }
    if (authorization.institutionId !== this.options.config.institutionId) {
      throw new StreamAuthorizationError('Sessao de outra instituicao rejeitada.', {
        reasonCode: 'INSTITUTION_MISMATCH',
        sessionId,
        gatewayId: this.options.config.gatewayId,
        gatewayInstitutionId: this.options.config.institutionId,
        cameraId: authorization.cameraId,
        cameraInstitutionId: authorization.institutionId,
        expiresAt: authorization.expiresAt,
        gatewayNow,
      });
    }
    if (!this.cameras.has(authorization.cameraId)) {
      throw new StreamAuthorizationError('Camera da sessao nao esta sincronizada.', {
        reasonCode: 'CAMERA_NOT_SYNCED',
        sessionId,
        gatewayId: this.options.config.gatewayId,
        gatewayInstitutionId: this.options.config.institutionId,
        cameraId: authorization.cameraId,
        cameraInstitutionId: authorization.institutionId,
        expiresAt: authorization.expiresAt,
        gatewayNow,
      });
    }
    if (!Number.isFinite(Date.parse(authorization.expiresAt)) || Date.parse(authorization.expiresAt) <= Date.now()) {
      throw new StreamAuthorizationError('Sessao de stream expirada.', {
        reasonCode: 'SESSION_EXPIRED',
        sessionId,
        gatewayId: this.options.config.gatewayId,
        gatewayInstitutionId: this.options.config.institutionId,
        cameraId: authorization.cameraId,
        cameraInstitutionId: authorization.institutionId,
        expiresAt: authorization.expiresAt,
        gatewayNow,
      });
    }
    const session = { sessionId, ...authorization, sessionTokenHash: sessionTokenHash(sessionToken) };
    this.sessions.set(sessionId, session);
    try {
      await this.ensurePublisher(authorization.cameraId);
    } catch (error) {
      const publisherDiagnostic: PublisherDiagnostic = error instanceof PublisherStartError
        ? error.diagnostic
        : {
          reasonCode: 'UNKNOWN_PUBLISHER_ERROR' as PublisherReasonCode,
          cameraId: authorization.cameraId,
          streamPath: authorization.streamPath,
          sourceProtocol: 'UNKNOWN',
          sourceHost: 'unknown',
          sourcePort: null,
          sourcePath: 'unknown',
          stage: 'await_process_start',
          durationMs: 0,
        };
      throw new StreamPublisherError('Nao foi possivel preparar a camera.', {
        ...publisherDiagnostic,
        sessionId,
        gatewayId: this.options.config.gatewayId,
        gatewayInstitutionId: this.options.config.institutionId,
        cameraInstitutionId: authorization.institutionId,
        labOverrideMatched: matchesLabCamera(this.options.labSource, authorization.cameraId),
        expiresAt: authorization.expiresAt,
        gatewayNow,
      });
    }
    return session;
  }

  getCameraStreamPath(session: SessionState): string {
    const override = matchesLabCamera(this.options.labSource, session.cameraId) ? this.options.labSource : undefined;
    if (override?.streamPath) return override.streamPath;
    if (!/^[a-zA-Z0-9_-]+$/.test(session.streamPath)) throw new Error('Caminho de stream invalido.');
    return session.streamPath;
  }

  health(): { gatewayOnline: boolean; relayOnline: boolean } {
    return {
      gatewayOnline: !this.revoked && this.running,
      relayOnline: this.relayOnline,
    };
  }

  status(): GatewayStatusSnapshot {
    return {
      gatewayId: this.options.config.gatewayId,
      institutionId: this.options.config.institutionId,
      paired: !this.revoked,
      state: this.revoked ? 'REVOKED' : 'PAIRED',
      running: this.running,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastSyncAt: this.lastSyncAt,
      relayConfigured: Boolean(this.options.config.relayBaseUrl),
      relayOnline: this.relayOnline,
      lastRelayHeartbeatAt: this.lastRelayHeartbeatAt,
      relayError: this.relayError,
      cameraCount: this.cameras.size,
      error: this.lastError,
    };
  }
}
