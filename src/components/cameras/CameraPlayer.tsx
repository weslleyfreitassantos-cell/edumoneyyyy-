import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { MonitorPlay, Radio, WifiOff } from 'lucide-react';

import type { CameraStreamSession, DirectorCamera } from '../../services/cameraService';

interface CameraPlayerProps {
  camera: DirectorCamera;
  streamSession?: CameraStreamSession | null;
  streamUrl?: string | null;
  onClose: () => void;
}

type PlayerTransport = 'CONNECTING' | 'WEBRTC' | 'HLS' | 'ERROR';

const WEBRTC_TIMEOUT_MS = 8_000;
const ICE_GATHERING_TIMEOUT_MS = 5_000;
const CONTROLLED_RELAY_HOST = /^(?:camera-gw-[0-9a-f]{16}\.grupotec\.dev\.br|gw-[0-9a-f]{16}\.cameras\.grupotec\.dev\.br)$/i;

export function isSafeBrowserStream(url: string | null | undefined, pageProtocol = typeof window === 'undefined' ? 'https:' : window.location.protocol): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === 'https:') return CONTROLLED_RELAY_HOST.test(parsed.hostname);
    if (parsed.protocol !== 'http:' || pageProtocol === 'https:') return false;
    return parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || /^10\.(?:\d{1,3}\.){2}\d{1,3}$/.test(parsed.hostname)
      || /^192\.168\.(?:\d{1,3}\.)\d{1,3}$/.test(parsed.hostname)
      || /^172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3}$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

function waitForIceGatheringComplete(peer: RTCPeerConnection, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error('WebRTC cancelado.'));
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', onStateChange);
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ICE_GATHERING_TIMEOUT_MS);
    function onAbort(): void {
      window.clearTimeout(timeout);
      peer.removeEventListener('icegatheringstatechange', onStateChange);
      reject(new Error('WebRTC cancelado.'));
    }
    function onStateChange(): void {
      if (peer.iceGatheringState !== 'complete') return;
      window.clearTimeout(timeout);
      peer.removeEventListener('icegatheringstatechange', onStateChange);
      signal.removeEventListener('abort', onAbort);
      resolve();
    }
    peer.addEventListener('icegatheringstatechange', onStateChange);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function waitForPeerConnection(peer: RTCPeerConnection, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error('WebRTC cancelado.'));
  if (peer.connectionState === 'connected' || peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('WebRTC timeout.'));
    }, WEBRTC_TIMEOUT_MS);
    function cleanup(): void {
      window.clearTimeout(timeout);
      peer.removeEventListener('connectionstatechange', onConnectionState);
      peer.removeEventListener('iceconnectionstatechange', onIceState);
      signal.removeEventListener('abort', onAbort);
    }
    function onConnectionState(): void {
      if (peer.connectionState === 'connected') {
        cleanup();
        resolve();
      } else if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        cleanup();
        reject(new Error('WebRTC connection failed.'));
      }
    }
    function onIceState(): void {
      if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
        cleanup();
        resolve();
      } else if (peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'closed') {
        cleanup();
        reject(new Error('ICE connection failed.'));
      }
    }
    function onAbort(): void {
      cleanup();
      reject(new Error('WebRTC cancelado.'));
    }
    peer.addEventListener('connectionstatechange', onConnectionState);
    peer.addEventListener('iceconnectionstatechange', onIceState);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function startWebRtc(
  video: HTMLVideoElement,
  webrtcUrl: string,
  iceServers: RTCIceServer[],
  signal: AbortSignal,
): Promise<() => void> {
  if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC nao suportado.');
  const peer = new RTCPeerConnection({ iceServers });
  const tracks = new Set<MediaStreamTrack>();
  let whepSessionCreated = false;
  const onTrack = (event: RTCTrackEvent): void => {
    const stream = event.streams[0] ?? new MediaStream([event.track]);
    video.srcObject = stream;
    tracks.add(event.track);
    void video.play().catch(() => undefined);
  };
  peer.addEventListener('track', onTrack);
  peer.addTransceiver('video', { direction: 'recvonly' });
  try {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIceGatheringComplete(peer, signal);
    const response = await fetch(webrtcUrl, {
      method: 'POST',
      headers: { accept: 'application/sdp', 'content-type': 'application/sdp' },
      body: peer.localDescription?.sdp ?? offer.sdp ?? '',
      signal,
    });
    if (!response.ok) throw new Error(`WHEP HTTP ${response.status}`);
    whepSessionCreated = true;
    const answer = await response.text();
    await peer.setRemoteDescription({ type: 'answer', sdp: answer });
    await waitForPeerConnection(peer, signal);
  } catch (error) {
    peer.removeEventListener('track', onTrack);
    tracks.forEach((track) => track.stop());
    peer.close();
    if (whepSessionCreated) {
      void fetch(webrtcUrl, {
        method: 'DELETE',
        headers: { accept: 'application/sdp' },
        keepalive: true,
      }).catch(() => undefined);
    }
    throw error;
  }
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    peer.removeEventListener('track', onTrack);
    tracks.forEach((track) => track.stop());
    peer.close();
    video.srcObject = null;
    void fetch(webrtcUrl, {
      method: 'DELETE',
      headers: { accept: 'application/sdp' },
      keepalive: true,
    }).catch(() => undefined);
  };
}

function startHls(video: HTMLVideoElement, streamUrl: string, onError: () => void): () => void {
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
    return () => { video.removeAttribute('src'); video.load(); };
  }
  if (!Hls.isSupported()) {
    onError();
    return () => undefined;
  }
  const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) onError();
  });
  hls.loadSource(streamUrl);
  hls.attachMedia(video);
  return () => hls.destroy();
}

export function CameraPlayer({ camera, streamSession, streamUrl, onClose }: CameraPlayerProps) {
  const gatewayOnline = camera.gatewayStatus === 'ONLINE';
  const hlsUrl = streamSession?.hlsUrl ?? streamUrl ?? null;
  const webrtcUrl = streamSession?.webrtcUrl ?? null;
  const canPlayHls = gatewayOnline && isSafeBrowserStream(hlsUrl);
  const canPlayWebRtc = gatewayOnline && isSafeBrowserStream(webrtcUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamError, setStreamError] = useState(false);
  const [transport, setTransport] = useState<PlayerTransport>('CONNECTING');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !gatewayOnline || (!canPlayWebRtc && !canPlayHls)) return undefined;
    let disposed = false;
    const abortController = new AbortController();
    let cleanupTransport: (() => void) | undefined;
    setStreamError(false);
    setTransport(canPlayWebRtc ? 'CONNECTING' : 'HLS');

    const fallbackToHls = (): void => {
      if (disposed || !canPlayHls || !hlsUrl) {
        setTransport('ERROR');
        setStreamError(true);
        return;
      }
      cleanupTransport?.();
      setTransport('HLS');
      cleanupTransport = startHls(video, hlsUrl, () => {
        if (!disposed) {
          setTransport('ERROR');
          setStreamError(true);
        }
      });
    };

    const connect = async (): Promise<void> => {
      if (!canPlayWebRtc || !webrtcUrl) {
        fallbackToHls();
        return;
      }
      try {
        cleanupTransport = await startWebRtc(video, webrtcUrl, streamSession?.iceServers ?? [], abortController.signal);
        if (!disposed) setTransport('WEBRTC');
      } catch {
        fallbackToHls();
      }
    };
    void connect();
    return () => {
      disposed = true;
      abortController.abort();
      cleanupTransport?.();
      video.removeAttribute('src');
      video.srcObject = null;
    };
  }, [canPlayHls, canPlayWebRtc, gatewayOnline, hlsUrl, streamSession?.iceServers, webrtcUrl]);

  const title = !gatewayOnline
    ? 'Gateway nao conectado'
    : streamError
      ? 'Stream indisponivel'
      : !canPlayHls && !canPlayWebRtc
        ? 'Stream ainda não disponível'
        : !hlsUrl && !webrtcUrl
        ? 'Relay remoto não configurado'
        : transport === 'CONNECTING'
          ? 'Conectando via WebRTC...'
          : 'Stream ainda não disponível';
  const description = !gatewayOnline
    ? 'A camera esta cadastrada, mas o gateway local precisa estar conectado para iniciar a transmissao.'
      : streamError
        ? 'A sessão temporária não conseguiu carregar o vídeo. Tente novamente.'
        : !canPlayHls && !canPlayWebRtc
          ? 'A sessão de stream ainda não foi iniciada.'
          : !hlsUrl && !webrtcUrl
          ? 'O modo remoto ainda não está configurado para este gateway.'
          : 'A conexão será feita em baixa latência quando o WebRTC estiver disponível.';
  const showVideo = gatewayOnline && (canPlayWebRtc || canPlayHls) && !streamError;
  const transportLabel = transport === 'CONNECTING'
    ? 'Conectando via WebRTC...'
    : transport === 'WEBRTC'
      ? 'Ao vivo · baixa latência'
      : transport === 'HLS'
        ? 'WebRTC indisponível · modo compatível'
        : 'Stream indisponível';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label={`Camera ${camera.name}`}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-700 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">{camera.name}</h2>
            <p className="text-sm text-slate-400">{camera.location || 'Local nao informado'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800" aria-label="Fechar visualizacao">X</button>
        </div>

        <div className="aspect-video bg-slate-950 p-4">
          {showVideo ? (
            <video ref={videoRef} className="h-full w-full rounded-xl bg-black object-contain" controls autoPlay muted playsInline onError={() => setStreamError(true)} />
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-700 px-6 text-center">
              {gatewayOnline && (hlsUrl || webrtcUrl) && !streamError ? <MonitorPlay className="mb-3 h-10 w-10 text-sky-400" aria-hidden="true" /> : <WifiOff className="mb-3 h-10 w-10 text-amber-400" aria-hidden="true" />}
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-700 px-5 py-3 text-xs text-slate-400">
          <Radio className="h-4 w-4" aria-hidden="true" />
          <span>{transportLabel}</span>
          <span className="ml-auto">Sem áudio, gravação ou download nesta versão.</span>
        </div>
      </div>
    </div>
  );
}
