import { spawn, type ChildProcess } from 'node:child_process';

import type { CameraConfig } from './types.ts';
import { buildCameraRtspUrl } from './rtsp.ts';

export interface CameraSourceOverride {
  cameraId: string;
  rtspUrl: string;
  streamPath?: string;
}

export type PublisherReasonCode =
  | 'PUBLISHER_SOURCE_INVALID'
  | 'PUBLISHER_RTSP_UNREACHABLE'
  | 'PUBLISHER_START_FAILED'
  | 'PUBLISHER_PROCESS_EXITED'
  | 'PUBLISHER_MEDIAMTX_PATH_NOT_READY'
  | 'PUBLISHER_TIMEOUT'
  | 'PUBLISHER_ALREADY_EXISTS_CONFLICT'
  | 'PUBLISHER_CONFIG_ERROR'
  | 'MEDIAMTX_UNREACHABLE'
  | 'MEDIAMTX_REJECTED_SOURCE'
  | 'UNKNOWN_PUBLISHER_ERROR';

export interface PublisherDiagnostic {
  reasonCode: PublisherReasonCode;
  cameraId: string;
  streamPath: string;
  sourceProtocol: string;
  sourceHost: string;
  sourcePort: number | null;
  sourcePath: string;
  stage: 'validate_source' | 'spawn_ffmpeg' | 'await_process_start';
  exitCode?: number | null;
  stderr?: string;
  durationMs: number;
}

export class PublisherStartError extends Error {
  readonly diagnostic: PublisherDiagnostic;

  constructor(message: string, diagnostic: PublisherDiagnostic) {
    super(message);
    this.name = 'PublisherStartError';
    this.diagnostic = diagnostic;
  }
}

export interface CameraPublisher {
  start(camera: CameraConfig, override?: CameraSourceOverride): Promise<string>;
  stop(cameraId?: string): void;
  stopAll(): void;
}

function safePath(cameraId: string): string {
  const normalized = cameraId.replace(/[^a-zA-Z0-9_-]/g, '-');
  if (!normalized) throw new Error('ID de camera invalido.');
  return `camera-${normalized}`;
}

function sourceDetails(source: string): Pick<PublisherDiagnostic, 'sourceProtocol' | 'sourceHost' | 'sourcePort' | 'sourcePath'> {
  try {
    const parsed = new URL(source);
    return {
      sourceProtocol: parsed.protocol.replace(':', '').toUpperCase(),
      sourceHost: parsed.hostname,
      sourcePort: parsed.port ? Number(parsed.port) : null,
      sourcePath: parsed.pathname || '/',
    };
  } catch {
    return { sourceProtocol: 'INVALID', sourceHost: 'unknown', sourcePort: null, sourcePath: 'unknown' };
  }
}

function sanitizeStderr(value: string): string {
  return value
    .replace(/(rtsp|rtsps):\/\/[^\s/@]+:[^\s/@]+@/gi, '$1://[REDACTED]@')
    .replace(/\b(?:token|secret|password|credential|authorization)=\S+/gi, '$1=[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

function classifyProcessFailure(stderr: string): PublisherReasonCode {
  if (/already\s+(?:publishing|exists|in use)|publisher.*(?:already|exists)|path.*(?:already|in use)/i.test(stderr)) {
    return 'PUBLISHER_ALREADY_EXISTS_CONFLICT';
  }
  if (/connection refused|connection timed out|failed to connect|404|not found|no route|network is unreachable|method (?:describe|options) failed/i.test(stderr)) {
    return 'PUBLISHER_RTSP_UNREACHABLE';
  }
  if (/mediamtx|rtsp.*(?:400|401|403|409|500|bad request|forbidden)/i.test(stderr)) {
    return 'MEDIAMTX_REJECTED_SOURCE';
  }
  return 'PUBLISHER_PROCESS_EXITED';
}

export class FfmpegCameraPublisher implements CameraPublisher {
  private readonly processes = new Map<string, ChildProcess>();
  private readonly ffmpegPath: string;
  private readonly mediaMtxRtspUrl: string;

  constructor(ffmpegPath: string, mediaMtxRtspUrl: string) {
    this.ffmpegPath = ffmpegPath;
    this.mediaMtxRtspUrl = mediaMtxRtspUrl;
  }

  async start(camera: CameraConfig, override?: CameraSourceOverride): Promise<string> {
    if (!camera.active) {
      throw new PublisherStartError('Camera inativa.', {
        reasonCode: 'PUBLISHER_CONFIG_ERROR',
        cameraId: camera.id,
        streamPath: override?.streamPath ?? safePath(camera.id),
        ...sourceDetails(override?.rtspUrl ?? buildCameraRtspUrl(camera)),
        stage: 'validate_source',
        durationMs: 0,
      });
    }
    if (this.processes.has(camera.id)) return override?.streamPath ?? safePath(camera.id);
    const source = override?.rtspUrl ?? buildCameraRtspUrl(camera);
    const streamPath = override?.streamPath ?? safePath(camera.id);
    const details = sourceDetails(source);
    const startedAt = Date.now();
    if (!/^rtsp:\/\//i.test(source) || /@/.test(source)) {
      throw new PublisherStartError('Fonte RTSP rejeitada.', {
        reasonCode: 'PUBLISHER_SOURCE_INVALID',
        cameraId: camera.id,
        streamPath,
        ...details,
        stage: 'validate_source',
        durationMs: Date.now() - startedAt,
      });
    }
    const output = `${this.mediaMtxRtspUrl.replace(/\/$/, '')}/${streamPath}`;
    const child = spawn(this.ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'warning',
      '-rtsp_transport', 'tcp',
      '-i', source,
      '-map', '0:v:0',
      '-an',
      '-c:v', 'copy',
      '-f', 'rtsp',
      output,
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer | string) => {
      if (stderr.length < 2_000) stderr += String(chunk);
    });
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve();
        }
      }, 500);
      child.once('error', (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new PublisherStartError(error.message, {
            reasonCode: 'PUBLISHER_START_FAILED',
            cameraId: camera.id,
            streamPath,
            ...details,
            stage: 'spawn_ffmpeg',
            stderr: sanitizeStderr(stderr),
            durationMs: Date.now() - startedAt,
          }));
        }
      });
      child.once('exit', (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          const safeStderr = sanitizeStderr(stderr);
          reject(new PublisherStartError('FFmpeg encerrou ao publicar a camera.', {
            reasonCode: classifyProcessFailure(safeStderr),
            cameraId: camera.id,
            streamPath,
            ...details,
            stage: 'await_process_start',
            exitCode: code,
            stderr: safeStderr,
            durationMs: Date.now() - startedAt,
          }));
        }
      });
    });
    this.processes.set(camera.id, child);
    console.log(JSON.stringify({
      event: 'publisher_started',
      cameraId: camera.id,
      streamPath,
      ...details,
    }));
    child.once('exit', (code) => {
      this.processes.delete(camera.id);
      if (code === 0) return;
      console.error(JSON.stringify({
        event: 'publisher_process_exited',
        reasonCode: classifyProcessFailure(sanitizeStderr(stderr)),
        cameraId: camera.id,
        streamPath,
        ...details,
        stage: 'await_process_start',
        exitCode: code,
        stderr: sanitizeStderr(stderr),
      }));
    });
    return streamPath;
  }

  stop(cameraId?: string): void {
    if (cameraId) {
      this.processes.get(cameraId)?.kill();
      this.processes.delete(cameraId);
      return;
    }
    this.stopAll();
  }

  stopAll(): void {
    for (const child of this.processes.values()) child.kill();
    this.processes.clear();
  }
}
