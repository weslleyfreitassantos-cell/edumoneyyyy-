import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { MonitorPlay, Radio, WifiOff } from 'lucide-react';

import type { DirectorCamera } from '../../services/cameraService';

interface CameraPlayerProps {
  camera: DirectorCamera;
  streamUrl?: string | null;
  onClose: () => void;
}

export function isSafeBrowserStream(url: string | null | undefined, pageProtocol = typeof window === 'undefined' ? 'https:' : window.location.protocol): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === 'https:') return /^camera-gw-[0-9a-f]{16}\.grupotec\.dev\.br$/i.test(parsed.hostname);
    if (parsed.protocol !== 'http:') return false;
    if (pageProtocol === 'https:') return false;
    return parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || /^10\.(?:\d{1,3}\.){2}\d{1,3}$/.test(parsed.hostname)
      || /^192\.168\.(?:\d{1,3}\.)\d{1,3}$/.test(parsed.hostname)
      || /^172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3}$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function CameraPlayer({ camera, streamUrl, onClose }: CameraPlayerProps) {
  const gatewayOnline = camera.gatewayStatus === 'ONLINE';
  const canPlay = gatewayOnline && isSafeBrowserStream(streamUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamError, setStreamError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canPlay || !streamUrl) return undefined;
    setStreamError(false);
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      return () => { video.removeAttribute('src'); video.load(); };
    }
    if (!Hls.isSupported()) {
      setStreamError(true);
      return undefined;
    }
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setStreamError(true);
    });
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [canPlay, streamUrl]);

  const title = !gatewayOnline
    ? 'Gateway nao conectado'
    : streamError
      ? 'Stream indisponivel'
      : !streamUrl
        ? 'Relay remoto não configurado'
        : 'Stream ainda não disponível';
  const description = !gatewayOnline
    ? 'A camera esta cadastrada, mas o gateway local precisa estar conectado para iniciar a transmissao.'
      : streamError
        ? 'A sessão temporária não conseguiu carregar o vídeo. Tente novamente.'
        : !streamUrl
          ? 'O modo local precisa de um gateway nesta mesma rede; o relay remoto ainda não está configurado.'
          : 'A URL de stream foi rejeitada por não cumprir as regras de segurança.';

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
          {canPlay && !streamError ? (
            <video ref={videoRef} className="h-full w-full rounded-xl bg-black object-contain" controls autoPlay muted playsInline onError={() => setStreamError(true)} />
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-700 px-6 text-center">
              {gatewayOnline && streamUrl && !streamError ? <MonitorPlay className="mb-3 h-10 w-10 text-sky-400" aria-hidden="true" /> : <WifiOff className="mb-3 h-10 w-10 text-amber-400" aria-hidden="true" />}
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-700 px-5 py-3 text-xs text-slate-400">
          <Radio className="h-4 w-4" aria-hidden="true" />
          Sem áudio, gravação ou download nesta versão.
        </div>
      </div>
    </div>
  );
}
