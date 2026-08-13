import { MonitorPlay, Radio, WifiOff } from 'lucide-react';

import type { DirectorCamera } from '../../services/cameraService';

interface CameraPlayerProps {
  camera: DirectorCamera;
  streamUrl?: string | null;
  onClose: () => void;
}

function isSafeBrowserStream(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function CameraPlayer({ camera, streamUrl, onClose }: CameraPlayerProps) {
  const gatewayOnline = camera.gatewayStatus === 'ONLINE';
  const canPlay = gatewayOnline && isSafeBrowserStream(streamUrl);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label={`Câmera ${camera.name}`}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-700 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">{camera.name}</h2>
            <p className="text-sm text-slate-400">{camera.location || 'Local não informado'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800" aria-label="Fechar visualização">×</button>
        </div>

        <div className="aspect-video bg-slate-950 p-4">
          {canPlay ? (
            <video className="h-full w-full rounded-xl bg-black object-contain" src={streamUrl ?? undefined} controls autoPlay muted playsInline />
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-700 px-6 text-center">
              {gatewayOnline ? <MonitorPlay className="mb-3 h-10 w-10 text-sky-400" aria-hidden="true" /> : <WifiOff className="mb-3 h-10 w-10 text-amber-400" aria-hidden="true" />}
              <p className="font-semibold text-white">{gatewayOnline ? 'Stream ainda não disponível' : 'Gateway não conectado'}</p>
              <p className="mt-2 max-w-md text-sm text-slate-400">{gatewayOnline ? 'O adaptador WebRTC/HLS do gateway ainda não forneceu uma sessão segura para esta câmera.' : 'A câmera está cadastrada, mas o gateway local precisa estar conectado para iniciar a transmissão.'}</p>
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
