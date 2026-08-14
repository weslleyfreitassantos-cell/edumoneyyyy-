import { spawn, type ChildProcess } from 'node:child_process';

import type { CameraConfig } from './types.ts';
import { buildCameraRtspUrl } from './rtsp.ts';

export interface CameraSourceOverride {
  cameraId: string;
  rtspUrl: string;
  streamPath?: string;
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

export class FfmpegCameraPublisher implements CameraPublisher {
  private readonly processes = new Map<string, ChildProcess>();
  private readonly ffmpegPath: string;
  private readonly mediaMtxRtspUrl: string;

  constructor(ffmpegPath: string, mediaMtxRtspUrl: string) {
    this.ffmpegPath = ffmpegPath;
    this.mediaMtxRtspUrl = mediaMtxRtspUrl;
  }

  async start(camera: CameraConfig, override?: CameraSourceOverride): Promise<string> {
    if (!camera.active) throw new Error('Camera inativa.');
    if (this.processes.has(camera.id)) return override?.streamPath ?? safePath(camera.id);
    const source = override?.rtspUrl ?? buildCameraRtspUrl(camera);
    if (!/^rtsp:\/\//i.test(source) || /@/.test(source)) throw new Error('Fonte RTSP rejeitada.');
    const streamPath = override?.streamPath ?? safePath(camera.id);
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
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
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
          reject(new Error(error.message));
        }
      });
      child.once('exit', (code) => {
        if (!settled && code !== null && code !== 0) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('FFmpeg encerrou ao publicar a camera.'));
        }
      });
    });
    this.processes.set(camera.id, child);
    child.once('exit', () => this.processes.delete(camera.id));
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
