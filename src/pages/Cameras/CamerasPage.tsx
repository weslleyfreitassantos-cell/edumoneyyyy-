import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Camera, CheckCircle2, Edit3, Gauge, Plus, Power, Radio, RefreshCw, Server, Trash2, WifiOff, X } from 'lucide-react';

import { useInstitution } from '../../contexts/InstitutionContext';
import { CameraPlayer } from '../../components/cameras/CameraPlayer';
import {
  cameraService,
  type CameraDeviceType,
  type CameraMutationInput,
  type CameraProtocol,
  type CameraStreamProfile,
  type CameraGateway,
  type DirectorCamera,
} from '../../services/cameraService';
import { validateCameraInput } from '../../services/cameraValidation';
import {
  useCreateDirectorCamera,
  useDeleteDirectorCamera,
  useDirectorCameraGateways,
  useDirectorCameras,
  useSetDirectorCameraActive,
  useUpdateDirectorCamera,
} from '../../hooks/useDirectorCameras';
import { initialCameraForm } from './cameraForm';

type CameraFilter = 'ALL' | 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

interface CameraFormProps {
  institutionId: string;
  camera: DirectorCamera | null;
  gatewayIdOverride?: string | null;
  onClose: () => void;
  onSaved: () => void;
  gateways: CameraGateway[];
}

function CameraForm({ institutionId, camera, gatewayIdOverride, onClose, onSaved, gateways }: CameraFormProps) {
  const [form, setForm] = useState(() => initialCameraForm(camera, institutionId, gatewayIdOverride, gateways));
  const [error, setError] = useState<string | null>(null);
  const create = useCreateDirectorCamera(institutionId);
  const update = useUpdateDirectorCamera(institutionId);
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (camera || form.gatewayId || !gateways[0]) return;
    setForm((current) => ({ ...current, gatewayId: gatewayIdOverride ?? gateways[0].id }));
  }, [camera, form.gatewayId, gatewayIdOverride, gateways]);

  function updateField<K extends keyof CameraMutationInput>(key: K, value: CameraMutationInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateCameraInput(form);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    try {
      if (camera) {
        await update.mutateAsync({ cameraId: camera.id, input: form });
      } else {
        await create.mutateAsync(form);
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar a câmera.');
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={camera ? 'Editar câmera' : 'Adicionar câmera'}>
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{camera ? 'Editar câmera' : 'Adicionar câmera'}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Cadastre somente os metadados. A conexão e a senha ficam no gateway local.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar formulário"><X className="h-5 w-5" /></button>
        </div>

        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Nome da câmera</span><input required value={form.name} onChange={(event) => updateField('name', event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Ex.: Entrada principal" /></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Local</span><input value={form.location} onChange={(event) => updateField('location', event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Portaria" /></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Fabricante</span><input value={form.manufacturer} onChange={(event) => updateField('manufacturer', event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Intelbras" /></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Modelo</span><input value={form.model} onChange={(event) => updateField('model', event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Opcional" /></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Tipo</span><select value={form.deviceType} onChange={(event) => updateField('deviceType', event.target.value as CameraDeviceType)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="IP_CAMERA">Câmera IP</option><option value="NVR">NVR</option></select></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Protocolo</span><select value={form.protocol} onChange={(event) => updateField('protocol', event.target.value as CameraProtocol)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="ONVIF">ONVIF</option><option value="RTSP">RTSP</option></select></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Host ou IP local</span><input required value={form.host} onChange={(event) => updateField('host', event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="192.168.1.50" /></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Porta</span><input required type="number" min="1" max="65535" value={form.port} onChange={(event) => updateField('port', Number(event.target.value))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Canal do NVR</span><input type="number" min="1" max="9999" value={form.channel ?? ''} onChange={(event) => updateField('channel', event.target.value ? Number(event.target.value) : null)} disabled={form.deviceType !== 'NVR'} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800" placeholder="Somente NVR" /></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Perfil de vídeo</span><select value={form.streamProfile} onChange={(event) => updateField('streamProfile', event.target.value as CameraStreamProfile)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="SUB">Substream (recomendado)</option><option value="MAIN">Mainstream</option></select></label>
          <label className="sm:col-span-2"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Gateway local</span><select required value={form.gatewayId ?? ''} onChange={(event) => updateField('gatewayId', event.target.value || null)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Selecione o gateway</option>{gateways.map((gateway) => <option key={gateway.id} value={gateway.id}>{gateway.name} · {gateway.status === 'ONLINE' ? 'Online' : gateway.status === 'OFFLINE' ? 'Offline' : 'Não conectado'}</option>)}</select>{!gateways.length && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">Prepare e pareie um gateway antes de cadastrar a câmera.</span>}</label>
        </div>

        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">Nenhuma senha é enviada ou salva no navegador. Configure a credencial no gateway local seguindo a documentação do adaptador.</div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar câmera'}</button></div>
      </form>
    </div>
  );
}

function gatewayLabel(camera: DirectorCamera): string {
  if (camera.gatewayStatus === 'ONLINE') return 'Online';
  if (camera.gatewayStatus === 'OFFLINE') return 'Gateway offline';
  return 'Gateway não conectado';
}

export function CamerasPage() {
  const { currentInstitution, currentInstitutionId } = useInstitution();
  const camerasQuery = useDirectorCameras(currentInstitutionId);
  const gatewaysQuery = useDirectorCameraGateways(currentInstitutionId);
  const [filter, setFilter] = useState<CameraFilter>('ALL');
  const [formCamera, setFormCamera] = useState<DirectorCamera | null | undefined>(undefined);
  const [playerCamera, setPlayerCameraState] = useState<DirectorCamera | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);
  const [gatewayName, setGatewayName] = useState('Gateway da instituição');
  const [createdGatewayId, setCreatedGatewayId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isCreatingGateway, setIsCreatingGateway] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setActive = useSetDirectorCameraActive(currentInstitutionId);
  const remove = useDeleteDirectorCamera(currentInstitutionId);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!playerCamera) return;
    void cameraService.logAccess(playerCamera.id, 'VIEW_STARTED');
    return () => { void cameraService.logAccess(playerCamera.id, 'VIEW_ENDED'); };
  }, [playerCamera]);

  function setPlayerCamera(camera: DirectorCamera | null) {
    if (!camera) {
      setStreamUrl(null);
      setPlayerCameraState(null);
      return;
    }
    void openCamera(camera);
  }

  const cameras = camerasQuery.data ?? [];
  const gateways = gatewaysQuery.data ?? [];
  const filteredCameras = useMemo(() => filter === 'ALL' ? cameras : cameras.filter((camera) => camera.gatewayStatus === filter), [cameras, filter]);

  async function toggleCamera(camera: DirectorCamera) {
    setError(null);
    try {
      await setActive.mutateAsync({ cameraId: camera.id, active: !camera.active });
      setNotice(camera.active ? 'Câmera desativada.' : 'Câmera ativada.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar a câmera.'); }
  }

  async function deleteCamera(camera: DirectorCamera) {
    if (!window.confirm(`Excluir definitivamente a câmera “${camera.name}”?`)) return;
    setError(null);
    try { await remove.mutateAsync(camera.id); setNotice('Câmera excluída.'); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível excluir a câmera.'); }
  }

  async function testCamera(camera: DirectorCamera) {
    setError(null);
    try { const result = await cameraService.testConnection(camera.id); setNotice(result.message); await camerasQuery.refetch(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível testar a câmera.'); }
  }

  async function openCamera(camera: DirectorCamera) {
    setError(null);
    try {
      const session = await cameraService.createStreamSession(camera.id);
      setStreamUrl(session.playbackUrl);
      setPlayerCameraState(camera);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nao foi possivel iniciar a sessao da camera.');
    }
  }

  async function createGateway() {
    if (!currentInstitutionId || !gatewayName.trim()) return;
    setIsCreatingGateway(true);
    setError(null);
    try {
      const gateway = await cameraService.createGateway(currentInstitutionId, gatewayName);
      setCreatedGatewayId(gateway.id);
      setPairingCode(gateway.pairingCode);
      await gatewaysQuery.refetch();
      setGatewayDialogOpen(false);
      setNotice('Gateway criado. Use o código de pareamento uma única vez no adaptador local.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível preparar o gateway.');
    } finally {
      setIsCreatingGateway(false);
    }
  }

  return (
    <main id="app-main-content" className="min-w-0 flex-1 bg-[#f3f6fb] p-4 sm:p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">Instituição</p><h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Câmeras ao vivo</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Acompanhe os dispositivos conectados à instituição {currentInstitution?.name ?? ''}.</p></div>
          <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setGatewayDialogOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><Server className="h-4 w-4" />Preparar gateway</button><button type="button" onClick={() => setFormCamera(null)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800"><Plus className="h-4 w-4" />Configurar câmera</button></div>
        </div>

        {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

        <section className="mb-5 grid gap-4 sm:grid-cols-3" aria-label="Resumo das câmeras">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><Camera className="h-5 w-5 text-blue-700" /><span className="text-sm text-slate-500 dark:text-slate-400">Câmeras cadastradas</span></div><strong className="mt-3 block text-2xl text-slate-900 dark:text-white">{cameras.length}</strong></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><Radio className="h-5 w-5 text-emerald-600" /><span className="text-sm text-slate-500 dark:text-slate-400">Gateways online</span></div><strong className="mt-3 block text-2xl text-slate-900 dark:text-white">{gateways.filter((gateway) => gateway.status === 'ONLINE').length}</strong></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><Gauge className="h-5 w-5 text-amber-600" /><span className="text-sm text-slate-500 dark:text-slate-400">Acesso V1</span></div><strong className="mt-3 block text-2xl text-slate-900 dark:text-white">Somente diretor</strong></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Dispositivos da instituição</h2><p className="text-sm text-slate-500 dark:text-slate-400">Sem áudio, gravação, download ou acesso para responsáveis.</p></div><div className="flex items-center gap-2"><select aria-label="Filtrar status" value={filter} onChange={(event) => setFilter(event.target.value as CameraFilter)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="ALL">Todos</option><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option><option value="UNKNOWN">Não conectados</option></select><button type="button" onClick={() => void camerasQuery.refetch()} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Atualizar câmeras"><RefreshCw className="h-4 w-4" /></button></div></div>

          {camerasQuery.isLoading ? <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando câmeras...</div> : camerasQuery.isError ? <div className="grid min-h-48 place-items-center text-center"><WifiOff className="mb-3 h-8 w-8 text-red-500" /><p className="font-semibold text-slate-800 dark:text-slate-200">Não foi possível carregar as câmeras.</p><button type="button" onClick={() => void camerasQuery.refetch()} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:text-slate-200">Tentar novamente</button></div> : filteredCameras.length === 0 ? <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-300 px-6 text-center dark:border-slate-700"><Server className="mb-3 h-9 w-9 text-slate-400" /><p className="font-semibold text-slate-800 dark:text-slate-200">{cameras.length ? 'Nenhuma câmera corresponde ao filtro.' : 'Nenhuma câmera cadastrada.'}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Cadastre o primeiro dispositivo para preparar o gateway local.</p>{!cameras.length && <button type="button" onClick={() => setFormCamera(null)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" />Adicionar primeira câmera</button>}</div> : <div className="grid gap-4 lg:grid-cols-2">{filteredCameras.map((camera) => <article key={camera.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><Camera className="h-5 w-5" /></span><div className="min-w-0"><h3 className="truncate font-bold text-slate-900 dark:text-white">{camera.name}</h3><p className="truncate text-sm text-slate-500 dark:text-slate-400">{camera.location || 'Local não informado'} · {camera.host}:{camera.port}</p></div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${camera.gatewayStatus === 'ONLINE' ? 'bg-emerald-100 text-emerald-800' : camera.gatewayStatus === 'OFFLINE' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{gatewayLabel(camera)}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500 dark:text-slate-400">Tipo</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{camera.deviceType === 'NVR' ? `NVR · canal ${camera.channel}` : 'Câmera IP'}</dd></div><div><dt className="text-slate-500 dark:text-slate-400">Perfil</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{camera.streamProfile === 'SUB' ? 'Substream' : 'Mainstream'}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setPlayerCamera(camera)} disabled={!camera.active} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Radio className="h-4 w-4" />Visualizar</button><button type="button" onClick={() => void testCamera(camera)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"><Gauge className="h-4 w-4" />Testar conexão</button><button type="button" onClick={() => setFormCamera(camera)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"><Edit3 className="h-4 w-4" />Editar</button><button type="button" onClick={() => void toggleCamera(camera)} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-800 dark:text-amber-300"><Power className="h-4 w-4" />{camera.active ? 'Desativar' : 'Ativar'}</button><button type="button" onClick={() => void deleteCamera(camera)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:text-red-300"><Trash2 className="h-4 w-4" />Excluir</button></div></article>)}</div>}
        </section>
      </div>

      {pairingCode && <div className="fixed bottom-4 right-4 z-30 w-[min(92vw,420px)] rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-xl dark:border-emerald-900/60 dark:bg-emerald-950/50"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Código de pareamento do gateway</p><p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">Mostre este código somente ao adaptador local. Ele expira em 15 minutos e não será exibido novamente.</p><code className="mt-3 block rounded-lg bg-white px-3 py-2 text-center text-xl font-black tracking-[0.3em] text-emerald-900 dark:bg-slate-900 dark:text-emerald-300">{pairingCode}</code></div><button type="button" onClick={() => setPairingCode(null)} className="rounded p-1 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300" aria-label="Fechar código"><X className="h-4 w-4" /></button></div></div>}
      {gatewayDialogOpen && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-label="Preparar gateway" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Preparar gateway local</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">O código será usado uma vez pelo adaptador da instituição.</p></div><button type="button" onClick={() => setGatewayDialogOpen(false)} aria-label="Fechar preparação" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div><label className="mt-5 block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Nome do gateway</span><input value={gatewayName} onChange={(event) => setGatewayName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setGatewayDialogOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700 dark:text-slate-300">Cancelar</button><button type="button" disabled={isCreatingGateway} onClick={() => void createGateway()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{isCreatingGateway ? 'Criando...' : 'Gerar código'}</button></div></div></div>}
      {formCamera !== undefined && currentInstitutionId && <CameraForm institutionId={currentInstitutionId} camera={formCamera} gatewayIdOverride={createdGatewayId} gateways={gateways} onClose={() => setFormCamera(undefined)} onSaved={() => { setFormCamera(undefined); setNotice('Câmera salva com sucesso.'); }} />}
      {playerCamera && <CameraPlayer camera={playerCamera} streamUrl={streamUrl} onClose={() => setPlayerCamera(null)} />}
    </main>
  );
}

export default CamerasPage;
