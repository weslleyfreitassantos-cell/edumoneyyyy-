import { spawn } from 'node:child_process';

import type { CameraConfig, CameraProbeResult } from './types.ts';

function validHost(host: string): boolean {
  return Boolean(host) && host.length <= 253 && !/[\s\\/?#@]/.test(host) && !/^https?:\/\//i.test(host);
}

export function buildCameraRtspUrl(camera: CameraConfig): string {
  if (!validHost(camera.host)) throw new Error('Host da camera invalido.');
  if (!Number.isInteger(camera.port) || camera.port < 1 || camera.port > 65535) throw new Error('Porta da camera invalida.');
  return `rtsp://${camera.host}:${camera.port}`;
}

function parseRate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const [numerator, denominator] = value.split('/').map(Number);
  if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) return numerator / denominator;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseProbeJson(raw: string): CameraProbeResult {
  try {
    const parsed = JSON.parse(raw) as { streams?: Array<Record<string, unknown>> };
    const streams = parsed.streams ?? [];
    const video = streams.find((stream) => stream.codec_type === 'video');
    const audio = streams.some((stream) => stream.codec_type === 'audio');
    return {
      reachable: Boolean(video),
      codec: typeof video?.codec_name === 'string' ? video.codec_name : null,
      width: typeof video?.width === 'number' ? video.width : null,
      height: typeof video?.height === 'number' ? video.height : null,
      fps: parseRate(video?.r_frame_rate),
      hasAudio: audio,
      error: video ? null : 'Nenhum stream de video encontrado.',
    };
  } catch {
    return { reachable: false, codec: null, width: null, height: null, fps: null, hasAudio: false, error: 'Resposta do ffprobe invalida.' };
  }
}

export async function probeRtsp(ffprobePath: string, url: string, timeoutMs = 12_000): Promise<CameraProbeResult> {
  const child = spawn(ffprobePath, [
    '-v', 'error',
    '-rtsp_transport', 'tcp',
    '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate',
    '-of', 'json',
    '-read_intervals', '%+5',
    url,
  ], { windowsHide: true });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });

  const result = await new Promise<CameraProbeResult>((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve({ reachable: false, codec: null, width: null, height: null, fps: null, hasAudio: false, error: 'Tempo esgotado ao conectar na camera.' });
    }, timeoutMs);
    child.once('error', () => {
      clearTimeout(timer);
      resolve({ reachable: false, codec: null, width: null, height: null, fps: null, hasAudio: false, error: 'Nao foi possivel iniciar o ffprobe.' });
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(parseProbeJson(stdout));
      else resolve({ reachable: false, codec: null, width: null, height: null, fps: null, hasAudio: false, error: stderr.trim() ? 'Camera indisponivel.' : 'ffprobe nao conseguiu ler a camera.' });
    });
  });
  return result;
}
