import { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Cable, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { supabase } from '../../../lib/supabaseClient';

type AccessTab = 'live' | 'history' | 'alerts' | 'devices';
type AccessEvent = { id: string; event_type: string; direction: string | null; occurred_at: string; status: string | null; student?: { profiles?: { full_name: string } | null } | null; device?: { name: string } | null };
type AccessDevice = { id: string; name: string; provider: string; model: string | null; status: string; last_seen_at: string | null; direction_entry: string; direction_exit: string };

const eventLabels: Record<string, string> = { PERSON_IDENTIFIED: 'Identificado', ACCESS_GRANTED: 'Acesso autorizado', ACCESS_DENIED: 'Acesso negado', PASSAGE_CONFIRMED: 'Passagem confirmada', PASSAGE_GIVE_UP: 'Não passou' };

export default function AccessControlTab() {
  const { profile } = useAuth();
  const institution = useCurrentInstitution(profile?.id);
  const institutionId = institution.data ?? '';
  const [tab, setTab] = useState<AccessTab>('live');
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [devices, setDevices] = useState<AccessDevice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!institutionId) return;
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from('access_events').select('id, event_type, direction, occurred_at, status, student:student_id(profiles:profile_id(full_name)), device:device_id(name)').eq('institution_id', institutionId).order('occurred_at', { ascending: false }).limit(50),
      supabase.from('access_devices').select('id, name, provider, model, status, last_seen_at, direction_entry, direction_exit').eq('institution_id', institutionId).order('name'),
    ]).then(([eventsResult, devicesResult]) => { if (!active) return; setEvents((eventsResult.data ?? []) as unknown as AccessEvent[]); setDevices((devicesResult.data ?? []) as AccessDevice[]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [institutionId]);

  const confirmed = useMemo(() => events.filter((event) => event.event_type === 'PASSAGE_CONFIRMED'), [events]);
  const denied = useMemo(() => events.filter((event) => event.event_type === 'ACCESS_DENIED'), [events]);
  const tabs: [AccessTab, string][] = [['live', 'Ao vivo'], ['history', 'Histórico'], ['alerts', 'Alertas'], ['devices', 'Equipamentos']];
  return <div className="space-y-6"><header><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-blue-700" /><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Portaria</h1></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Controle de acesso e passagem confirmada dos alunos.</p></header><div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-t-lg px-4 py-3 text-sm font-semibold ${tab === id ? 'border-b-2 border-blue-700 text-blue-700' : 'text-slate-500'}`}>{label}</button>)}</div>{loading && <p className="text-sm text-slate-500">Carregando portaria...</p>}{tab === 'live' && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Entradas', confirmed.filter((e) => e.direction === 'ENTRY').length, Activity], ['Saídas', confirmed.filter((e) => e.direction === 'EXIT').length, CheckCircle2], ['Acessos negados', denied.length, ShieldCheck], ['Equipamentos', devices.length, Cable]].map(([label, value, Icon]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300"><span>{label}</span><Icon className="h-5 w-5 text-blue-700" /></div><strong className="mt-3 block text-2xl text-slate-900 dark:text-white">{value}</strong></div>)}</div><EventList events={events.slice(0, 10)} /></>}{tab === 'history' && <EventList events={events} />}{tab === 'alerts' && <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 font-bold"><Bell className="h-5 w-5 text-amber-600" /> Alertas de acesso</div><p className="mt-2 text-sm text-slate-500">Os alertas serão ativados quando a escola conectar o primeiro equipamento.</p></section>}{tab === 'devices' && <DeviceList devices={devices} />}</div>;
}

function EventList({ events }: { events: AccessEvent[] }) { return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><div className="border-b border-slate-200 p-4 font-bold dark:border-slate-700">Últimos acessos</div>{events.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nenhum evento recebido ainda. Conecte um equipamento para começar.</p> : <div className="divide-y divide-slate-200 dark:divide-slate-700">{events.map((event) => <div key={event.id} className="flex flex-wrap items-center gap-3 p-4"><Clock3 className="h-5 w-5 text-slate-400" /><span className="w-20 text-sm text-slate-500">{new Date(event.occurred_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><span className="font-semibold text-slate-900 dark:text-white">{event.student?.profiles?.full_name ?? 'Pessoa não identificada'}</span><span className="text-sm text-slate-500">{eventLabels[event.event_type] ?? event.event_type}</span><span className="ml-auto text-xs text-slate-400">{event.device?.name ?? 'Equipamento'}</span></div>)}</div>}</section>; }
function DeviceList({ devices }: { devices: AccessDevice[] }) { return <section className="space-y-3">{devices.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-600"><Cable className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-semibold">Nenhum equipamento conectado</p><p className="mt-1 text-sm text-slate-500">O primeiro provider homologado será Control iD.</p><button type="button" className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Conectar equipamento</button></div> : devices.map((device) => <div key={device.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><Cable className="h-6 w-6 text-blue-700" /><div className="min-w-0 flex-1"><strong>{device.name}</strong><p className="text-sm text-slate-500">{device.provider} {device.model ?? ''}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{device.status === 'ONLINE' ? 'Online' : 'Offline'}</span></div>)}</section>; }
