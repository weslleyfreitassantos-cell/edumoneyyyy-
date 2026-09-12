import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Check,
  ChevronRight,
  CircleAlert,
  FilePlus2,
  RotateCcw,
  Save,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useCurrentInstitution } from '../../hooks/useCurrentInstitution';
import {
  useCancelClassCouncil,
  useClassCouncilContextOptions,
  useClassCouncilDetails,
  useClassCouncilEligibleParticipants,
  useClassCouncils,
  useAddClassCouncilParticipant,
  useCompleteClassCouncil,
  useCreateClassCouncil,
  useOpenClassCouncil,
  useReopenClassCouncil,
  useUpdateClassCouncil,
  useUpdateClassCouncilStudentNote,
} from '../../hooks/useClassCouncils';
import type {
  ClassCouncil,
  ClassCouncilFollowUpCategory,
  ClassCouncilStatus,
} from '../../services/classCouncilService';

const statusLabels: Record<ClassCouncilStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
};

const statusStyles: Record<ClassCouncilStatus, string> = {
  DRAFT: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  OPEN: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  CANCELED: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
};

const followUpLabels: Record<ClassCouncilFollowUpCategory, string> = {
  NONE: 'Sem encaminhamento',
  MONITOR: 'Acompanhar',
  INDIVIDUAL_PLAN: 'Plano individual',
  FAMILY_MEETING: 'Reunião com a família',
  REFERRAL: 'Encaminhamento',
  OTHER: 'Outro',
};

function formatDate(value: string | null): string {
  if (!value) return 'Não agendado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPercentage(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function panelError(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível carregar os conselhos de classe.';
}

function StatusBadge({ status }: { status: ClassCouncilStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function CouncilRow({ council, onSelect }: { key?: string; council: ClassCouncil; onSelect: () => void }) {
  return (
    <tr className="border-t border-slate-200 text-sm dark:border-slate-800">
      <td className="px-4 py-4">
        <p className="font-bold text-slate-900 dark:text-white">{council.className}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{council.gradeLevel ?? 'Série não informada'}{council.shift ? ` • ${council.shift}` : ''}</p>
      </td>
      <td className="px-4 py-4 text-slate-700 dark:text-slate-300">{council.academicYearName}</td>
      <td className="px-4 py-4 text-slate-700 dark:text-slate-300">{council.termName}</td>
      <td className="px-4 py-4"><StatusBadge status={council.status} /></td>
      <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{formatDate(council.scheduledAt)}</td>
      <td className="px-4 py-4 text-right">
        <button type="button" onClick={onSelect} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/40">
          Abrir <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

export default function ClassCouncilPanel() {
  const { profile } = useAuth();
  const institution = useCurrentInstitution(profile?.id);
  const role = institution.currentRole ?? profile?.role;
  const isDirector = role === 'DIRECTOR';
  const institutionId = institution.data;
  const [statusFilter, setStatusFilter] = useState<ClassCouncilStatus | 'ALL'>('ALL');
  const [yearFilter, setYearFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [participantProfileId, setParticipantProfileId] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, { observation: string; resolution: string; followUpCategory: ClassCouncilFollowUpCategory | ''; followUpText: string }>>({});
  const [createYearId, setCreateYearId] = useState('');
  const [createTermId, setCreateTermId] = useState('');
  const [createClassId, setCreateClassId] = useState('');
  const [createScheduledAt, setCreateScheduledAt] = useState('');
  const [createGeneralNotes, setCreateGeneralNotes] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editGeneralNotes, setEditGeneralNotes] = useState('');
  const filters = useMemo(() => ({
    academicYearId: yearFilter || undefined,
    termId: termFilter || undefined,
    classId: classFilter || undefined,
    status: statusFilter,
  }), [classFilter, statusFilter, termFilter, yearFilter]);
  const councilsQuery = useClassCouncils(institutionId, filters);
  const optionsQuery = useClassCouncilContextOptions(institutionId);
  const eligibleQuery = useClassCouncilEligibleParticipants(institutionId);
  const detailsQuery = useClassCouncilDetails(selectedId);
  const createMutation = useCreateClassCouncil();
  const updateMutation = useUpdateClassCouncil();
  const addParticipantMutation = useAddClassCouncilParticipant();
  const openMutation = useOpenClassCouncil();
  const completeMutation = useCompleteClassCouncil();
  const reopenMutation = useReopenClassCouncil();
  const cancelMutation = useCancelClassCouncil();
  const noteMutation = useUpdateClassCouncilStudentNote();

  const years = optionsQuery.data?.years ?? [];
  const classes = optionsQuery.data?.classes ?? [];
  const filterTerms = years.find((year) => year.id === yearFilter)?.terms ?? [];
  const createTerms = years.find((year) => year.id === createYearId)?.terms ?? [];
  const selectedCouncil = detailsQuery.data?.council ?? null;

  useEffect(() => {
    if (!createYearId && years[0]) {
      setCreateYearId(years[0].id);
      setCreateTermId(years[0].terms[0]?.id ?? '');
    }
  }, [createYearId, years]);

  useEffect(() => {
    if (createYearId && !createTerms.some((term) => term.id === createTermId)) {
      setCreateTermId(createTerms[0]?.id ?? '');
    }
  }, [createTermId, createTerms, createYearId]);

  useEffect(() => {
    const notes = detailsQuery.data?.studentNotes ?? [];
    setNoteDrafts((current) => {
      const next = { ...current };
      notes.forEach((note) => {
        if (!next[note.id]) {
          next[note.id] = {
            observation: note.observation ?? '',
            resolution: note.resolution ?? '',
            followUpCategory: note.followUpCategory ?? '',
            followUpText: note.followUpText ?? '',
          };
        }
      });
      return next;
    });
  }, [detailsQuery.data]);

  useEffect(() => {
    setEditScheduledAt(selectedCouncil?.scheduledAt ? selectedCouncil.scheduledAt.slice(0, 16) : '');
    setEditGeneralNotes(selectedCouncil?.generalNotes ?? '');
  }, [selectedCouncil]);

  function resetCreate(): void {
    setShowCreate(false);
    setCreateClassId('');
    setCreateScheduledAt('');
    setCreateGeneralNotes('');
  }

  async function createCouncil(): Promise<void> {
    if (!institutionId || !createYearId || !createTermId || !createClassId) return;
    await createMutation.mutateAsync({
      institutionId,
      academicYearId: createYearId,
      termId: createTermId,
      classId: createClassId,
      scheduledAt: createScheduledAt ? new Date(createScheduledAt).toISOString() : null,
      generalNotes: createGeneralNotes || null,
    });
    resetCreate();
  }

  function updateDraft(id: string, field: keyof NonNullable<typeof noteDrafts[string]>, value: string): void {
    setNoteDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  if (institution.isLoading || councilsQuery.isLoading || optionsQuery.isLoading) {
    return <div className="grid min-h-[320px] place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" aria-label="Carregando" /></div>;
  }

  if (institution.isError || councilsQuery.isError || optionsQuery.isError) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{panelError(institution.error ?? councilsQuery.error ?? optionsQuery.error)}</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Operação escolar</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Conselhos de classe</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Registre decisões pedagógicas com o contexto acadêmico preservado.</p>
        </div>
        {isDirector && <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"><FilePlus2 className="h-4 w-4" aria-hidden="true" />Novo conselho</button>}
      </header>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Ano letivo<select value={yearFilter} onChange={(event) => { setYearFilter(event.target.value); setTermFilter(''); setClassFilter(''); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Todos</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Período<select value={termFilter} onChange={(event) => setTermFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Todos</option>{filterTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Turma<select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Todas</option>{classes.filter((item) => !yearFilter || item.academicYearId === yearFilter).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ClassCouncilStatus | 'ALL')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="ALL">Todos</option>{CLASS_COUNCIL_STATUS_VALUES.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></label>
      </section>

      {showCreate && <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900 dark:bg-blue-950/20"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Novo conselho em rascunho</h2><button type="button" onClick={resetCreate} className="rounded-lg p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900" aria-label="Fechar criação"><X className="h-5 w-5" /></button></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ano letivo<select value={createYearId} onChange={(event) => setCreateYearId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white">{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label><label className="text-xs font-bold text-slate-700 dark:text-slate-300">Período<select value={createTermId} onChange={(event) => setCreateTermId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white">{createTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label><label className="text-xs font-bold text-slate-700 dark:text-slate-300">Turma<select value={createClassId} onChange={(event) => setCreateClassId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Selecione</option>{classes.filter((item) => item.academicYearId === createYearId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-bold text-slate-700 dark:text-slate-300">Data e hora<input type="datetime-local" value={createScheduledAt} onChange={(event) => setCreateScheduledAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label></div><label className="mt-4 block text-xs font-bold text-slate-700 dark:text-slate-300">Observação geral<textarea value={createGeneralNotes} onChange={(event) => setCreateGeneralNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><div className="mt-4 flex justify-end"><button type="button" disabled={!createClassId || createMutation.isPending} onClick={() => void createCouncil()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" aria-hidden="true" />{createMutation.isPending ? 'Salvando...' : 'Criar rascunho'}</button></div></section>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="font-bold text-slate-900 dark:text-white">Conselhos registrados</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{councilsQuery.data?.length ?? 0} registro(s) encontrado(s).</p></div>{(councilsQuery.data?.length ?? 0) === 0 ? <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400"><Users className="mx-auto h-8 w-8" aria-hidden="true" /><p className="mt-3">Nenhum conselho de classe corresponde aos filtros.</p></div> : <div className="overflow-x-auto"><table className="min-w-[850px] w-full"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400"><tr><th className="px-4 py-3">Turma</th><th className="px-4 py-3">Ano</th><th className="px-4 py-3">Período</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Agendamento</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{councilsQuery.data?.map((council) => <CouncilRow key={council.id} council={council} onSelect={() => setSelectedId(council.id)} />)}</tbody></table></div>}</section>

      {selectedCouncil && <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedCouncil.className}</h2><StatusBadge status={selectedCouncil.status} /></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{selectedCouncil.academicYearName} • {selectedCouncil.termName} • {formatDate(selectedCouncil.scheduledAt)}</p>{selectedCouncil.reopenReason && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Reabertura: {selectedCouncil.reopenReason}</p>}</div><button type="button" onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300"><X className="h-4 w-4" aria-hidden="true" />Fechar</button></div>
        <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"><Users className="h-4 w-4" aria-hidden="true" />{detailsQuery.data?.studentNotes.length ?? 0} alunos em snapshot</span>{isDirector && selectedCouncil.status === 'DRAFT' && <button type="button" disabled={openMutation.isPending} onClick={() => void openMutation.mutateAsync({ council: selectedCouncil })} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{openMutation.isPending ? 'Abrindo...' : 'Abrir e gerar snapshot'}</button>}{isDirector && selectedCouncil.status === 'OPEN' && <button type="button" disabled={completeMutation.isPending} onClick={() => void completeMutation.mutateAsync(selectedCouncil.id)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" aria-hidden="true" />{completeMutation.isPending ? 'Concluindo...' : 'Concluir'}</button>}{isDirector && selectedCouncil.status === 'COMPLETED' && <><input aria-label="Motivo da reabertura" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Motivo da reabertura" className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white" /><button type="button" disabled={!reopenReason.trim() || reopenMutation.isPending} onClick={() => void reopenMutation.mutateAsync({ councilId: selectedCouncil.id, reason: reopenReason })} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-700 dark:border-amber-700 dark:text-amber-300"><RotateCcw className="h-4 w-4" aria-hidden="true" />Reabrir</button></>}{isDirector && ['DRAFT', 'OPEN'].includes(selectedCouncil.status) && <button type="button" disabled={cancelMutation.isPending} onClick={() => void cancelMutation.mutateAsync(selectedCouncil.id)} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 dark:border-red-800 dark:text-red-300"><X className="h-4 w-4" aria-hidden="true" />Cancelar</button>}</div>
        {['DRAFT', 'OPEN'].includes(selectedCouncil.status) && <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto] md:items-end"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">Data e hora<input type="datetime-local" value={editScheduledAt} onChange={(event) => setEditScheduledAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label className="text-xs font-bold text-slate-600 dark:text-slate-300">Observação geral<textarea value={editGeneralNotes} onChange={(event) => setEditGeneralNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><button type="button" disabled={updateMutation.isPending} onClick={() => void updateMutation.mutateAsync({ councilId: selectedCouncil.id, scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : null, generalNotes: editGeneralNotes || null })} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50 dark:border-blue-700 dark:text-blue-300"><Save className="h-4 w-4" aria-hidden="true" />Salvar dados</button></div></section>}
        {isDirector && selectedCouncil.status !== 'COMPLETED' && selectedCouncil.status !== 'CANCELED' && <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Participantes</h3><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={participantProfileId} onChange={(event) => setParticipantProfileId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Adicionar participante</option>{(eligibleQuery.data ?? []).filter((item) => !detailsQuery.data?.participants.some((participant) => participant.profileId === item.profileId)).map((item) => <option key={`${item.profileId}-${item.role}`} value={`${item.profileId}|${item.role}`}>{item.profileName} • {item.role}</option>)}</select><button type="button" disabled={!participantProfileId || addParticipantMutation.isPending} onClick={() => { const [profileId, roleValue] = participantProfileId.split('|'); void addParticipantMutation.mutateAsync({ councilId: selectedCouncil.id, profileId, role: roleValue as 'DIRECTOR' | 'SECRETARY' | 'TEACHER' }).then(() => { setParticipantProfileId(''); void detailsQuery.refetch(); }); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50 dark:border-blue-700 dark:text-blue-300"><UserPlus className="h-4 w-4" aria-hidden="true" />Adicionar</button></div><div className="mt-3 flex flex-wrap gap-2">{(detailsQuery.data?.participants ?? []).map((participant) => <span key={participant.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{participant.profileName} • {participant.participantRole}</span>)}</div></div>}
        <div><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Registro por aluno</h3><span className="text-xs text-slate-500 dark:text-slate-400">Snapshot original preservado ao reabrir</span></div><div className="mt-3 space-y-3">{(detailsQuery.data?.studentNotes ?? []).map((note) => { const draft = noteDrafts[note.id] ?? { observation: note.observation ?? '', resolution: note.resolution ?? '', followUpCategory: note.followUpCategory ?? '', followUpText: note.followUpText ?? '' }; const editable = ['DRAFT', 'OPEN'].includes(selectedCouncil.status); return <article key={note.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-bold text-slate-900 dark:text-white">{note.studentName}</p><p className="text-xs text-slate-500 dark:text-slate-400">RA {note.registrationNumber} • {note.dataStatus === 'OFFICIAL' ? 'Dados oficiais' : 'Dados parciais'}</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Média {formatPercentage(note.averageGrade)}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Frequência {formatPercentage(note.attendancePercentage)}</span><span className="rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{note.riskLevel}</span></div></div><div className="mt-3 grid gap-3 lg:grid-cols-3"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">Observação<textarea disabled={!editable} value={draft.observation} onChange={(event) => updateDraft(note.id, 'observation', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label className="text-xs font-bold text-slate-600 dark:text-slate-300">Resolução<textarea disabled={!editable} value={draft.resolution} onChange={(event) => updateDraft(note.id, 'resolution', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><div><label className="text-xs font-bold text-slate-600 dark:text-slate-300">Encaminhamento<select disabled={!editable} value={draft.followUpCategory} onChange={(event) => updateDraft(note.id, 'followUpCategory', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Não definido</option>{Object.entries(followUpLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><textarea disabled={!editable} value={draft.followUpText} onChange={(event) => updateDraft(note.id, 'followUpText', event.target.value)} rows={2} placeholder="Detalhes do encaminhamento" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" />{editable && <button type="button" disabled={noteMutation.isPending} onClick={() => void noteMutation.mutateAsync({ councilId: selectedCouncil.id, studentId: note.studentId, observation: draft.observation || null, resolution: draft.resolution || null, followUpCategory: (draft.followUpCategory || null) as ClassCouncilFollowUpCategory | null, followUpText: draft.followUpText || null })} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 dark:border-blue-700 dark:text-blue-300"><Save className="h-4 w-4" aria-hidden="true" />Salvar registro</button>}</div></div></article>; })}</div></div>
      </section>}
      {detailsQuery.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{panelError(detailsQuery.error)}</div>}
      {(createMutation.isError || updateMutation.isError || openMutation.isError || completeMutation.isError || reopenMutation.isError || cancelMutation.isError || addParticipantMutation.isError || noteMutation.isError) && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{panelError(createMutation.error ?? updateMutation.error ?? openMutation.error ?? completeMutation.error ?? reopenMutation.error ?? cancelMutation.error ?? addParticipantMutation.error ?? noteMutation.error)}</div>}
    </div>
  );
}

const CLASS_COUNCIL_STATUS_VALUES: ClassCouncilStatus[] = ['DRAFT', 'OPEN', 'COMPLETED', 'CANCELED'];
