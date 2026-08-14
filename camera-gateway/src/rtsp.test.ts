import { describe, expect, it } from 'vitest';

import { buildCameraRtspUrl, parseProbeJson } from './rtsp.ts';

describe('camera gateway RTSP', () => {
  it('monta somente host e porta, sem credenciais', () => {
    expect(buildCameraRtspUrl({
      id: 'camera-1', institutionId: 'institution-a', name: 'Entrada',
      host: '192.168.1.50', port: 554, protocol: 'RTSP', channel: null,
      streamProfile: 'SUB', active: true,
    })).toBe('rtsp://192.168.1.50:554');
  });

  it('rejeita URL arbitraria e credencial embutida', () => {
    const camera = {
      id: 'camera-1', institutionId: 'institution-a', name: 'Entrada',
      host: 'rtsp://user:password@192.168.1.50/live', port: 554,
      protocol: 'RTSP' as const, channel: null, streamProfile: 'SUB' as const, active: true,
    };
    expect(() => buildCameraRtspUrl(camera)).toThrow(/host/i);
  });

  it('extrai video e audio sem expor URL', () => {
    const result = parseProbeJson(JSON.stringify({ streams: [
      { codec_type: 'video', codec_name: 'h264', width: 640, height: 480, r_frame_rate: '30/1' },
      { codec_type: 'audio', codec_name: 'aac' },
    ] }));
    expect(result).toMatchObject({ reachable: true, codec: 'h264', width: 640, height: 480, fps: 30, hasAudio: true });
    expect(result).not.toHaveProperty('url');
  });
});
