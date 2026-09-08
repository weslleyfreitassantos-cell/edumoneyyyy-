// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import { CameraPlayer, isSafeBrowserStream } from './CameraPlayer';

const camera = {
  id: 'camera-1', institutionId: 'institution-1', gatewayId: 'gateway-1', gatewayName: 'Gateway',
  gatewayStatus: 'ONLINE' as const, gatewayLastSeenAt: null, name: 'Entrada', location: null,
  manufacturer: null, model: null, deviceType: 'IP_CAMERA' as const, protocol: 'ONVIF' as const,
  host: '192.168.1.50', port: 554, channel: null, streamProfile: 'SUB' as const, active: true,
  directorAccess: true, guardianAccess: false as const, createdAt: '', updatedAt: '',
};

describe('CameraPlayer', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('não usa RTSP nem oferece áudio/gravação/download', () => {
    render(<CameraPlayer camera={camera} streamUrl="rtsp://192.168.1.50/live" onClose={vi.fn()} />);
    expect(screen.queryByRole('video')).toBeNull();
    expect(screen.getByText(/sem áudio, gravação ou download/i)).toBeTruthy();
    expect(screen.getByText(/stream ainda não disponível/i)).toBeTruthy();
  });

  it('recusa relay HTTP quando a aplicação está em HTTPS', () => {
    expect(isSafeBrowserStream('http://127.0.0.1:8787/stream/session/index.m3u8', 'https:')).toBe(false);
    expect(isSafeBrowserStream('https://example.com/stream/session/index.m3u8')).toBe(false);
    expect(isSafeBrowserStream('https://camera-gw-0123456789abcdef.grupotec.dev.br/stream/session/index.m3u8')).toBe(true);
    expect(isSafeBrowserStream('https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session/index.m3u8', 'https:')).toBe(true);
  });

  it('prefere WebRTC e encerra a conexao ao fechar o player', async () => {
    class FakePeerConnection {
      static instances: FakePeerConnection[] = [];
      iceGatheringState = 'complete';
      connectionState = 'new';
      iceConnectionState = 'new';
      localDescription: RTCSessionDescriptionInit | null = null;
      closed = false;
      private listeners = new Map<string, EventListener[]>();

      constructor(public readonly options: RTCConfiguration) { FakePeerConnection.instances.push(this); }
      addTransceiver(): void { return undefined; }
      addEventListener(type: string, listener: EventListener): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
      removeEventListener(type: string, listener: EventListener): void { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== listener)); }
      async createOffer(): Promise<RTCSessionDescriptionInit> { return { type: 'offer', sdp: 'offer-sdp' }; }
      async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> { this.localDescription = description; }
      async setRemoteDescription(): Promise<void> { this.connectionState = 'connected'; this.iceConnectionState = 'connected'; }
      close(): void { this.closed = true; this.connectionState = 'closed'; }
    }
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    const fetchMock = vi.fn(async () => new Response('answer-sdp', { status: 201, headers: { 'content-type': 'application/sdp' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<CameraPlayer
      camera={camera}
      streamSession={{
        sessionId: 'session-1', protocol: 'WEBRTC',
        webrtcUrl: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/whep?token=opaque',
        hlsUrl: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/index.m3u8?token=opaque',
        playbackUrl: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/index.m3u8?token=opaque',
        iceServers: [], expiresAt: '2026-08-15T23:00:00.000Z',
      }}
      onClose={vi.fn()}
    />);

    await waitFor(() => expect(screen.getByText('Ao vivo · baixa latência')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/whep?token=opaque',
      expect.objectContaining({ method: 'POST', body: 'offer-sdp' }),
    );
    unmount();
    expect(FakePeerConnection.instances[0].closed).toBe(true);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/whep?token=opaque',
      expect.objectContaining({ method: 'DELETE' }),
    ));
  });

  it('usa HLS quando a negociacao WHEP falha', async () => {
    class FailedPeerConnection {
      iceGatheringState = 'complete';
      localDescription: RTCSessionDescriptionInit | null = null;
      addTransceiver(): void { return undefined; }
      addEventListener(): void { return undefined; }
      removeEventListener(): void { return undefined; }
      async createOffer(): Promise<RTCSessionDescriptionInit> { return { type: 'offer', sdp: 'offer-sdp' }; }
      async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> { this.localDescription = description; }
      close(): void { return undefined; }
    }
    vi.stubGlobal('RTCPeerConnection', FailedPeerConnection);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));
    const canPlayType = vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    const hlsUrl = 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/index.m3u8?token=opaque';

    const view = render(<CameraPlayer
      camera={camera}
      streamSession={{
        sessionId: 'session-1', protocol: 'WEBRTC',
        webrtcUrl: 'https://gw-0123456789abcdef.cameras.grupotec.dev.br/stream/session-1/whep?token=opaque',
        hlsUrl, playbackUrl: hlsUrl, iceServers: [], expiresAt: '2026-08-15T23:00:00.000Z',
      }}
      onClose={vi.fn()}
    />);

    await waitFor(() => expect(screen.getByText('WebRTC indisponível · modo compatível')).toBeTruthy());
    expect(view.container.querySelector('video')?.getAttribute('src')).toContain('/stream/session-1/index.m3u8');
    canPlayType.mockRestore();
  });
});
