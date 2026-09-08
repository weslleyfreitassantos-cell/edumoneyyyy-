import { useEffect, useState } from 'react';
import { Cable, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { supabase } from '../../../lib/supabaseClient';

type Device = { id: string; name: string; provider: string; model: string | null; status: string };

export default function AccessControlTab() {
  const { profile } = useAuth();
  const institution = useCurrentInstitution(profile?.id);
  const institutionId = institution.data ?? '';
  const [devices, setDevices] = useState<Device[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'CONTROL_ID', model: 'iDBlock Next' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!institutionId) return;
    void supabase.from('access_devices').select('id, name, provider, model, status').eq('institution_id', institutionId).order('name').then(({ data }) => setDevices((data ?? []) as Device[]));
  }, [institutionId]);

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    const token = crypto.randomUUID().replaceAll('-', '');
    const { data, error } = await supabase.from('access_devices').insert({ institution_id: institutionId, name: form.name, provider: form.provider, model: form.model, endpoint: `/functions/v1/access-ingest/${token}`, status: 'OFFLINE' }).select('id, name, provider, model, status').single();
    if (error) { setMessage('A estrutura de Portaria ainda precisa ser aplicada no banco.'); return; }
    if (data) setDevices((current) => [...current, data as Device]);
    setMessage(`Equipamento cadastrado. Endpoint: /functions/v1/access-ingest/${token}`);
    setOpen(false);
  }

  return <div className="space-y-6"><header><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-blue-700" /><h1 className="text-2xl font-bold">Portaria</h1></div><p className="mt-1 text-sm text-slate-600">Conecte catracas e acompanhe eventos de acesso.</p></header><div className="flex gap-4 border-b py-3 text-sm font-semibold"><span className="border-b-2 border-blue-700 px-2 pb-3 text-blue-700">Equipamentos</span><span className="px-2 text-slate-500">Ao vivo</span><span className="px-2 text-slate-500">Histórico</span><span className="px-2 text-slate-500">Alertas</span></div><section className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">Equipamentos conectados</h2><p className="text-sm text-slate-500">Control iD, Topdata, Henry, Hikvision ou Gateway.</p></div><button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">+ Conectar equipamento</button></div>{message && <p className="mt-4 break-all rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}{devices.length === 0 ? <div className="py-12 text-center text-sm text-slate-500"><Cable className="mx-auto mb-3 h-8 w-8" />Nenhum equipamento cadastrado.</div> : <div className="mt-5 space-y-3">{devices.map((device) => <div key={device.id} className="flex items-center gap-4 rounded-lg border p-4"><Cable className="h-5 w-5 text-blue-700" /><div className="flex-1"><strong>{device.name}</strong><p className="text-sm text-slate-500">{device.provider} · {device.model}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{device.status === 'ONLINE' ? 'Online' : 'Aguardando conexão'}</span></div>)}</div>}</section>{open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><form onSubmit={connect} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6"><h2 className="text-xl font-bold">Conectar equipamento</h2><input required placeholder="Nome do equipamento" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border p-2" /><select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="w-full rounded-lg border p-2"><option value="CONTROL_ID">Control iD</option><option value="TOPDATA">Topdata</option><option value="HENRY">Henry</option><option value="HIKVISION">Hikvision</option><option value="GENERIC_GATEWAY">Gateway genérico</option></select><input placeholder="Modelo" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full rounded-lg border p-2" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2">Cancelar</button><button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white">Cadastrar</button></div></form></div>}</div>;
}
