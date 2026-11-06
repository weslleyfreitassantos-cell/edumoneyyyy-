import { useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  Save,
  X,
} from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useClasses } from '../../../hooks/useClasses';
import { useSubjects } from '../../../hooks/useSubjects';
import {
  useAcademicCalendarEvents,
  useCreateAcademicCalendarEvent,
  useImportBrazilianNationalHolidays,
  usePublishReenrollmentCalendarEvent,
  useSetAcademicCalendarEventActive,
  useUpdateAcademicCalendarEvent,
} from '../../../hooks/useAcademicCalendar';
import {
  ACADEMIC_CALENDAR_AUDIENCES,
  ACADEMIC_CALENDAR_EVENT_TYPES,
  type AcademicCalendarAudience,
  type AcademicCalendarEvent,
  type AcademicCalendarEventInput,
  type AcademicCalendarEventType,
  type ReenrollmentCalendarSettings,
} from '../../../services/academicCalendarService';
import { getPreferredAcademicYear } from '../../../lib/academicSelection';
import {
  calendarDateKey,
  calendarEventDateKeys,
  formatCalendarEventDate,
  isCalendarEventUpcoming,
} from '../../../lib/academicCalendarDates';

interface CalendarDraft {
  title: string;
  description: string;
  event_type: AcademicCalendarEventType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  audience: AcademicCalendarAudience;
  class_id: string;
  academic_year_id: string;
  subject_id: string;
  active: boolean;
  reenrollment: ReenrollmentCalendarSettings;
}

function emptyReenrollmentSettings(): ReenrollmentCalendarSettings {
  return {
    source_academic_year_id: '',
    destination_academic_year_id: '',
    eligible_grade_levels: [],
    contract_version: 'v1',
    contract_body: '',
    finance_mode: 'NOT_REQUIRED',
    finance_monthly_amount_cents: null,
    finance_enrollment_fee_cents: 0,
    finance_installment_count: null,
    finance_first_due_date: null,
    finance_due_day: null,
    finance_allow_manual_clearance: false,
    show_future_notice: false,
  };
}

const eventTypeLabels: Record<AcademicCalendarEventType, string> = {
  HOLIDAY: 'Feriado',
  RECESS: 'Recesso',
  SCHOOL_EVENT: 'Evento escolar',
  MEETING: 'Reunião',
  ASSESSMENT: 'Avaliação / prova',
  CLASS_SUSPENSION: 'Suspensão de aula',
  RE_ENROLLMENT: 'Rematrícula',
  OTHER: 'Outro evento',
};

const audienceLabels: Record<AcademicCalendarAudience, string> = {
  ALL: 'Todos',
  STUDENTS: 'Alunos',
  GUARDIANS: 'Responsáveis',
  TEACHERS: 'Professores',
  STAFF: 'Equipe escolar',
  CLASS: 'Uma turma',
};

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function localDateTimeValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

function localDateValue(date: Date): string {
  return localDateTimeValue(date).slice(0, 10);
}

function localDateTimeForCalendarDate(value: string, hour: number): string {
  const [year, month, day] = calendarDateKey(value, true).split('-').map(Number);
  return localDateTimeValue(new Date(year, month - 1, day, hour, 0, 0, 0));
}

function emptyDraft(): CalendarDraft {
  const now = new Date();

  return {
    title: '',
    description: '',
    event_type: 'OTHER',
    starts_at: localDateTimeValue(now),
    ends_at: '',
    all_day: false,
    audience: 'ALL',
    class_id: '',
    academic_year_id: '',
    subject_id: '',
    active: true,
    reenrollment: emptyReenrollmentSettings(),
  };
}

function draftFromEvent(event: AcademicCalendarEvent): CalendarDraft {
  const starts = new Date(event.starts_at);
  const ends = event.ends_at ? new Date(event.ends_at) : null;
  const legacyAllDayReenrollment = event.event_type === 'RE_ENROLLMENT' && event.all_day;

  return {
    title: event.title,
    description: event.description ?? '',
    event_type: event.event_type,
    starts_at: legacyAllDayReenrollment
      ? localDateTimeForCalendarDate(event.starts_at, 8)
      : event.all_day ? calendarDateKey(event.starts_at, true) : localDateTimeValue(starts),
    ends_at: legacyAllDayReenrollment
      ? localDateTimeForCalendarDate(event.ends_at ?? event.starts_at, 18)
      : ends ? (event.all_day ? calendarDateKey(event.ends_at ?? '', true) : localDateTimeValue(ends)) : '',
    all_day: legacyAllDayReenrollment ? false : event.all_day,
    audience: event.audience,
    class_id: event.class_id ?? '',
    academic_year_id: event.academic_year_id ?? '',
    subject_id: event.subject_id ?? '',
    active: event.active,
    reenrollment: event.reenrollment_campaign
      ? {
          source_academic_year_id: event.reenrollment_campaign.source_academic_year_id,
          destination_academic_year_id: event.reenrollment_campaign.destination_academic_year_id,
          eligible_grade_levels: event.reenrollment_campaign.eligible_grade_levels ?? [],
          contract_version: event.reenrollment_campaign.contract_version,
          contract_body: event.reenrollment_campaign.contract_body,
          finance_mode: event.reenrollment_campaign.finance_mode,
          finance_monthly_amount_cents: event.reenrollment_campaign.finance_monthly_amount_cents,
          finance_enrollment_fee_cents: event.reenrollment_campaign.finance_enrollment_fee_cents,
          finance_installment_count: event.reenrollment_campaign.finance_installment_count,
          finance_first_due_date: event.reenrollment_campaign.finance_first_due_date,
          finance_due_day: event.reenrollment_campaign.finance_due_day,
          finance_scholarship_per_installment_cents: event.reenrollment_campaign.finance_scholarship_per_installment_cents,
          finance_discount_per_installment_cents: event.reenrollment_campaign.finance_discount_per_installment_cents,
          finance_punctuality_discount_cents: event.reenrollment_campaign.finance_punctuality_discount_cents,
          finance_fine_rate_bps: event.reenrollment_campaign.finance_fine_rate_bps,
          finance_monthly_interest_rate_bps: event.reenrollment_campaign.finance_monthly_interest_rate_bps,
          finance_grace_days: event.reenrollment_campaign.finance_grace_days,
          finance_allow_manual_clearance: event.reenrollment_campaign.finance_allow_manual_clearance,
          show_future_notice: event.reenrollment_campaign.show_future_notice,
        }
      : {
          ...emptyReenrollmentSettings(),
          source_academic_year_id: event.academic_year_id ?? '',
        },
  };
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function monthCells(date: Date): Array<Date | null> {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = Array.from(
    { length: firstDayOffset },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir a operação.';
}

function getAcademicCalendarYear(
  year: { name: string; start_date: string } | undefined,
): number {
  const yearFromName = year?.name.match(/\b\d{4}\b/)?.[0];
  const value = yearFromName ? Number(yearFromName) : Number(year?.start_date.slice(0, 4));
  return Number.isInteger(value) && value >= 1900 && value <= 2199
    ? value
    : new Date().getFullYear();
}

export default function AcademicCalendarTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? '';
  const yearsQuery = useAcademicYears(institutionId);
  const classesQuery = useClasses(institutionId);
  const subjectsQuery = useSubjects(institutionId);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [filters, setFilters] = useState({
    eventType: 'ALL' as AcademicCalendarEventType | 'ALL',
    audience: 'ALL' as AcademicCalendarAudience | 'ALL',
    date: '',
  });
  const [draft, setDraft] = useState<CalendarDraft>(emptyDraft);
  const [editingEvent, setEditingEvent] = useState<AcademicCalendarEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AcademicCalendarEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const eventsQuery = useAcademicCalendarEvents(institutionId, filters);
  const createMutation = useCreateAcademicCalendarEvent();
  const importHolidaysMutation = useImportBrazilianNationalHolidays();
  const updateMutation = useUpdateAcademicCalendarEvent();
  const activeMutation = useSetAcademicCalendarEventActive();
  const publishReenrollmentMutation = usePublishReenrollmentCalendarEvent();
  const events = eventsQuery.data ?? [];
  const years = yearsQuery.data ?? [];
  const classes = (classesQuery.data ?? []).filter((item) => item.active);
  const subjects = (subjectsQuery.data ?? []).filter((item) => item.active);
  const eligibleGrades = [...new Set(classes
    .filter((item) => item.academic_year_id === draft.reenrollment.source_academic_year_id)
    .map((item) => item.grade_level?.trim())
    .filter((grade): grade is string => Boolean(grade)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const cells = useMemo(() => monthCells(month), [month]);
  const eventsByDate = useMemo(() => {
    const result = new Map<string, AcademicCalendarEvent[]>();
    for (const event of events) {
      for (const key of calendarEventDateKeys({
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        allDay: event.all_day,
      })) {
        result.set(key, [...(result.get(key) ?? []), event]);
      }
    }
    return result;
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => event.active && isCalendarEventUpcoming({
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        allDay: event.all_day,
      }, now))
      .slice(0, 5);
  }, [events]);

  const isSaving = createMutation.isPending || updateMutation.isPending || publishReenrollmentMutation.isPending;
  const preferredAcademicYear = getPreferredAcademicYear(years);
  const holidaysYear = getAcademicCalendarYear(preferredAcademicYear);

  function openNewEvent(): void {
    setEditingEvent(null);
    setSelectedEvent(null);
    const sourceYear = preferredAcademicYear;
    const destinationYear = sourceYear
      ? years.find((year) => year.start_date > sourceYear.start_date)
      : undefined;
    setDraft({
      ...emptyDraft(),
      academic_year_id: sourceYear?.id ?? '',
      reenrollment: {
        ...emptyReenrollmentSettings(),
        source_academic_year_id: sourceYear?.id ?? '',
        destination_academic_year_id: destinationYear?.id ?? '',
      },
    });
    setPageError(null);
    setFeedback(null);
    setFormOpen(true);
  }

  function openEditEvent(event: AcademicCalendarEvent): void {
    setEditingEvent(event);
    setSelectedEvent(event);
    setDraft(draftFromEvent(event));
    setPageError(null);
    setFeedback(null);
    setFormOpen(true);
  }

  function closeForm(): void {
    if (isSaving) return;
    setFormOpen(false);
    setEditingEvent(null);
  }

  function toggleAllDay(allDay: boolean): void {
    setDraft((current) => {
      if (allDay) {
        return {
          ...current,
          all_day: true,
          starts_at: current.starts_at.slice(0, 10),
          ends_at: current.ends_at ? current.ends_at.slice(0, 10) : '',
        };
      }

      return {
        ...current,
        all_day: false,
        starts_at: current.starts_at.length === 10 ? `${current.starts_at}T08:00` : current.starts_at,
        ends_at: current.ends_at.length === 10 ? `${current.ends_at}T09:00` : current.ends_at,
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPageError(null);
    setFeedback(null);

    if (!profile || !institutionId) {
      setPageError('A instituição atual não foi encontrada.');
      return;
    }

    const input: AcademicCalendarEventInput = {
      institution_id: institutionId,
      created_by: profile.id,
      title: draft.title,
      description: draft.description || null,
      event_type: draft.event_type,
      starts_at: draft.starts_at,
      ends_at: draft.ends_at || null,
      all_day: draft.all_day,
      audience: draft.audience,
      class_id: draft.audience === 'CLASS' ? draft.class_id || null : null,
      academic_year_id: draft.academic_year_id || null,
      subject_id: draft.subject_id || null,
      active: draft.active,
    };

    try {
      if (draft.event_type === 'RE_ENROLLMENT') {
        const result = await publishReenrollmentMutation.mutateAsync({
          eventId: editingEvent?.id ?? null,
          input,
          settings: draft.reenrollment,
        });
        setSelectedEvent(result.event);
        setFeedback(result.replayed
          ? 'Esta publicação já existia; o mesmo evento e campanha foram reutilizados.'
          : 'Rematrícula publicada e vinculada ao calendário. Nenhuma cobrança foi gerada.');
        setFormOpen(false);
        setEditingEvent(null);
        setDraft(emptyDraft());
        return;
      }

      if (editingEvent) {
        await updateMutation.mutateAsync({
          id: editingEvent.id,
          institutionId,
          input,
        });
        setFeedback('Evento atualizado com sucesso.');
      } else {
        await createMutation.mutateAsync(input);
        setFeedback('Evento criado com sucesso.');
      }
      setFormOpen(false);
      setEditingEvent(null);
      setDraft(emptyDraft());
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  async function toggleActive(event: AcademicCalendarEvent): Promise<void> {
    setPageError(null);
    try {
      await activeMutation.mutateAsync({
        id: event.id,
        institutionId,
        active: !event.active,
      });
      setSelectedEvent((current) => current?.id === event.id ? { ...current, active: !event.active } : current);
      setFeedback(event.active ? 'Evento desativado.' : 'Evento reativado.');
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  async function handleImportBrazilianHolidays(): Promise<void> {
    setPageError(null);
    setFeedback(null);

    if (!profile || !institutionId) {
      setPageError('A instituição atual não foi encontrada.');
      return;
    }

    try {
      const result = await importHolidaysMutation.mutateAsync({
        institutionId,
        academicYearId: preferredAcademicYear?.id ?? null,
        createdBy: profile.id,
        year: holidaysYear,
      });
      setFeedback(
        result.imported > 0
          ? `${result.imported} feriado(s) nacional(is) adicionado(s) para ${result.year}. ${result.skipped} já existia(m) e foi(ram) ignorado(s).`
          : `Os feriados nacionais de ${result.year} já estavam no calendário.`,
      );
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  if (institutionQuery.isLoading || eventsQuery.isLoading || yearsQuery.isLoading || classesQuery.isLoading || subjectsQuery.isLoading) {
    return <div className="rounded-xl border border-[#dfe3e8] bg-white p-8 text-sm text-[#667085] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Carregando calendário escolar...</div>;
  }

  if (institutionQuery.isError || eventsQuery.isError || yearsQuery.isError || classesQuery.isError || subjectsQuery.isError) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{getErrorMessage(institutionQuery.error ?? eventsQuery.error ?? yearsQuery.error ?? classesQuery.error ?? subjectsQuery.error)}</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005bbf]">Operação escolar</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#181c20] dark:text-white">Calendário escolar</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#667085] dark:text-slate-400">Registre feriados, recessos e eventos acadêmicos da instituição em um único calendário.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void handleImportBrazilianHolidays()} disabled={importHolidaysMutation.isPending} className="inline-flex items-center gap-2 rounded-lg border border-[#005bbf] bg-white px-4 py-2.5 text-sm font-bold text-[#005bbf] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:hover:bg-slate-800">
            <Download className="h-4 w-4" aria-hidden="true" /> {importHolidaysMutation.isPending ? 'Importando...' : `Importar feriados nacionais (${holidaysYear})`}
          </button>
          <button type="button" onClick={openNewEvent} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004a9b]">
            <Plus className="h-4 w-4" aria-hidden="true" /> Novo evento
          </button>
        </div>
      </header>

      {pageError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{pageError}</div>}
      {feedback && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{feedback}</div>}

      {selectedEvent?.event_type === 'RE_ENROLLMENT' && !selectedEvent.reenrollment_campaign && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Este evento legado ainda não tem campanha vinculada. Use Editar para configurar e publicar a campanha mantendo este mesmo evento, sem criar outro.
        </div>
      )}

      <section className="grid gap-4 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:grid-cols-3">
        <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Tipo
          <select value={filters.eventType} onChange={(event) => setFilters((current) => ({ ...current, eventType: event.target.value as AcademicCalendarEventType | 'ALL' }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white">
            <option value="ALL">Todos os tipos</option>
            {ACADEMIC_CALENDAR_EVENT_TYPES.map((type) => <option key={type} value={type}>{eventTypeLabels[type]}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Público
          <select value={filters.audience} onChange={(event) => setFilters((current) => ({ ...current, audience: event.target.value as AcademicCalendarAudience | 'ALL' }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white">
            <option value="ALL">Todos os públicos</option>
            {ACADEMIC_CALENDAR_AUDIENCES.map((audience) => <option key={audience} value={audience}>{audienceLabels[audience]}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Data específica
          <input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
        </label>
      </section>

      {formOpen && (
        <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#005bbf]" aria-hidden="true" /><h2 className="font-extrabold text-[#181c20] dark:text-white">{editingEvent ? 'Editar evento' : 'Novo evento'}</h2></div>
            <button type="button" onClick={closeForm} aria-label="Fechar formulário" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Título *
                <input required maxLength={160} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white" placeholder="Ex.: Reunião de responsáveis" />
              </label>
              <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Tipo *
                <select required value={draft.event_type} disabled={Boolean(editingEvent?.reenrollment_campaign)} onChange={(event) => {
                  const eventType = event.target.value as AcademicCalendarEventType;
                  setDraft((current) => eventType === 'RE_ENROLLMENT'
                    ? { ...current, event_type: eventType, all_day: false, audience: 'ALL', class_id: '', subject_id: '', reenrollment: { ...current.reenrollment, source_academic_year_id: current.reenrollment.source_academic_year_id || current.academic_year_id } }
                    : { ...current, event_type: eventType });
                }} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] disabled:opacity-70 dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                  {ACADEMIC_CALENDAR_EVENT_TYPES.map((type) => <option key={type} value={type}>{eventTypeLabels[type]}</option>)}
                </select>
              </label>
            </div>
            <label className="text-sm font-bold text-[#414754] dark:text-slate-200">{draft.event_type === 'RE_ENROLLMENT' ? 'Descrição para a família' : 'Descrição'}
              <textarea rows={3} maxLength={12000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full resize-y rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white" placeholder={draft.event_type === 'RE_ENROLLMENT' ? 'Orientações sobre a rematrícula' : 'Detalhes opcionais do evento'} />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-[#414754] dark:text-slate-200">{draft.event_type === 'RE_ENROLLMENT' ? 'Início das confirmações *' : 'Data inicial *'}
                <input required type={draft.all_day && draft.event_type !== 'RE_ENROLLMENT' ? 'date' : 'datetime-local'} value={draft.starts_at} onChange={(event) => setDraft((current) => ({ ...current, starts_at: event.target.value }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="text-sm font-bold text-[#414754] dark:text-slate-200">{draft.event_type === 'RE_ENROLLMENT' ? 'Encerramento das confirmações *' : 'Data final'}
                <input required={draft.event_type === 'RE_ENROLLMENT'} type={draft.all_day && draft.event_type !== 'RE_ENROLLMENT' ? 'date' : 'datetime-local'} value={draft.ends_at} onChange={(event) => setDraft((current) => ({ ...current, ends_at: event.target.value }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
              </label>
            </div>
            {draft.event_type !== 'RE_ENROLLMENT' && <label className="flex items-center gap-2 text-sm font-semibold text-[#414754] dark:text-slate-200"><input type="checkbox" checked={draft.all_day} onChange={(event) => toggleAllDay(event.target.checked)} /> Dia inteiro</label>}
            {draft.event_type === 'RE_ENROLLMENT' && (
              <section className="space-y-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
                <div>
                  <h3 className="font-bold text-[#181c20] dark:text-white">Campanha de rematrícula</h3>
                  <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">Evento e campanha serão publicados juntos. A publicação não gera cobranças.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Ano letivo de origem *
                    <select required value={draft.reenrollment.source_academic_year_id} onChange={(event) => setDraft((current) => ({
                      ...current,
                      academic_year_id: event.target.value,
                      reenrollment: { ...current.reenrollment, source_academic_year_id: event.target.value, eligible_grade_levels: [] },
                    }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                      <option value="">Selecione o ano de origem</option>
                      {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Ano letivo de destino *
                    <select required value={draft.reenrollment.destination_academic_year_id} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, destination_academic_year_id: event.target.value } }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                      <option value="">Selecione o ano de destino</option>
                      {years.filter((year) => year.id !== draft.reenrollment.source_academic_year_id).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                    </select>
                  </label>
                </div>
                <fieldset className="rounded-lg border border-[#dfe3e8] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <legend className="px-1 text-sm font-bold text-[#414754] dark:text-slate-200">Séries elegíveis *</legend>
                  {eligibleGrades.length === 0 ? (
                    <p className="py-2 text-sm text-[#667085]">Não há turmas ativas com série definida no ano de origem.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {eligibleGrades.map((grade) => (
                        <label key={grade} className="flex items-center gap-2 text-sm text-[#414754] dark:text-slate-200">
                          <input type="checkbox" checked={draft.reenrollment.eligible_grade_levels.includes(grade)} onChange={(event) => setDraft((current) => ({
                            ...current,
                            reenrollment: {
                              ...current.reenrollment,
                              eligible_grade_levels: event.target.checked
                                ? [...current.reenrollment.eligible_grade_levels, grade]
                                : current.reenrollment.eligible_grade_levels.filter((value) => value !== grade),
                            },
                          }))} /> {grade}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Texto do contrato *
                    <textarea required minLength={30} maxLength={20000} rows={5} value={draft.reenrollment.contract_body} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, contract_body: event.target.value } }))} className="mt-2 w-full resize-y rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white" placeholder="Informe os termos apresentados e aceitos pela família." />
                  </label>
                  <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Versão do contrato *
                    <input required maxLength={40} value={draft.reenrollment.contract_version} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, contract_version: event.target.value } }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
                    <span className="mt-2 block text-xs font-normal text-[#667085]">A impressão digital SHA-256 será calculada pelo servidor ao publicar.</span>
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Cobrança exigida
                    <select value={draft.reenrollment.finance_mode} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, finance_mode: event.target.value as ReenrollmentCalendarSettings['finance_mode'], finance_allow_manual_clearance: event.target.value === 'MANUAL' ? current.reenrollment.finance_allow_manual_clearance : false } }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                      <option value="NOT_REQUIRED">Não exigida</option>
                      <option value="MANUAL">Recebimento manual autorizado</option>
                      <option value="AUTO">Cobrança automática no fluxo financeiro</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-[#414754] dark:text-slate-200">
                    <input type="checkbox" checked={draft.reenrollment.show_future_notice ?? false} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, show_future_notice: event.target.checked } }))} /> Avisar sobre a abertura futura
                  </label>
                </div>
                {draft.reenrollment.finance_mode === 'AUTO' && (
                  <div className="grid gap-4 rounded-lg border border-blue-100 bg-white p-4 md:grid-cols-2 dark:border-slate-700 dark:bg-slate-900">
                    <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Mensalidade (centavos) *
                      <input required type="number" min="1" value={draft.reenrollment.finance_monthly_amount_cents ?? ''} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, finance_monthly_amount_cents: event.target.value ? Number(event.target.value) : null } }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950" />
                    </label>
                    <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Taxa de matrícula (centavos)
                      <input type="number" min="0" value={draft.reenrollment.finance_enrollment_fee_cents ?? 0} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, finance_enrollment_fee_cents: Number(event.target.value) || 0 } }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950" />
                    </label>
                    <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Quantidade de parcelas *
                      <input required type="number" min="1" max="60" value={draft.reenrollment.finance_installment_count ?? ''} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, finance_installment_count: event.target.value ? Number(event.target.value) : null } }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950" />
                    </label>
                    <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Primeiro vencimento *
                      <input required type="date" value={draft.reenrollment.finance_first_due_date ?? ''} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, finance_first_due_date: event.target.value || null } }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950" />
                    </label>
                    <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Dia do vencimento *
                      <input required type="number" min="1" max="31" value={draft.reenrollment.finance_due_day ?? ''} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, finance_due_day: event.target.value ? Number(event.target.value) : null } }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950" />
                    </label>
                  </div>
                )}
                {draft.reenrollment.finance_mode === 'MANUAL' && (
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#414754] dark:text-slate-200">
                    <input type="checkbox" checked={draft.reenrollment.finance_allow_manual_clearance ?? false} onChange={(event) => setDraft((current) => ({ ...current, reenrollment: { ...current.reenrollment, finance_allow_manual_clearance: event.target.checked } }))} /> Permitir baixa manual sem liquidação bancária
                  </label>
                )}
              </section>
            )}
            {draft.event_type !== 'RE_ENROLLMENT' && <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Público *
                <select required value={draft.audience} onChange={(event) => setDraft((current) => ({ ...current, audience: event.target.value as AcademicCalendarAudience, class_id: event.target.value === 'CLASS' ? current.class_id : '' }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                  {ACADEMIC_CALENDAR_AUDIENCES.map((audience) => <option key={audience} value={audience}>{audienceLabels[audience]}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Ano letivo
                <select value={draft.academic_year_id} onChange={(event) => setDraft((current) => ({ ...current, academic_year_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                  <option value="">Sem ano letivo</option>
                  {years.map((year) => <option key={year.id} value={year.id}>{year.name}{getPreferredAcademicYear(years)?.id === year.id ? ' (atual)' : ''}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Disciplina
                <select value={draft.subject_id} onChange={(event) => setDraft((current) => ({ ...current, subject_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                  <option value="">Sem disciplina</option>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </label>
            </div>}
            {draft.event_type !== 'RE_ENROLLMENT' && draft.audience === 'CLASS' && <label className="text-sm font-bold text-[#414754] dark:text-slate-200">Turma *
              <select required value={draft.class_id} onChange={(event) => setDraft((current) => ({ ...current, class_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                <option value="">Selecione a turma</option>
                {classes.map((classRecord) => <option key={classRecord.id} value={classRecord.id}>{classRecord.name}{classRecord.grade_level ? ` • ${classRecord.grade_level}` : ''}</option>)}
              </select>
            </label>}
            {draft.event_type !== 'RE_ENROLLMENT' && <label className="flex items-center gap-2 text-sm font-semibold text-[#414754] dark:text-slate-200"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /> Evento ativo</label>}
            <div><button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004a9b] disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" aria-hidden="true" />{isSaving ? 'Salvando...' : draft.event_type === 'RE_ENROLLMENT' ? 'Publicar rematrícula' : editingEvent ? 'Salvar alterações' : 'Criar evento'}</button></div>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-extrabold capitalize text-[#181c20] dark:text-white">{monthLabel(month)}</h2><p className="mt-1 text-sm text-[#667085] dark:text-slate-400">Clique em um evento para ver os detalhes.</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Mês anterior" className="rounded-lg border border-[#cfd6e2] p-2 text-[#414754] hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button><button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded-lg border border-[#cfd6e2] px-3 py-2 text-sm font-bold text-[#005bbf] dark:border-slate-600">Hoje</button><button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Próximo mês" className="rounded-lg border border-[#cfd6e2] p-2 text-[#414754] hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button></div>
        </div>
        <div className="mt-5 grid grid-cols-7 overflow-hidden rounded-lg border border-[#dfe3e8] dark:border-slate-700">
          {weekdays.map((day) => <div key={day} className="border-b border-[#dfe3e8] bg-slate-50 p-2 text-center text-xs font-bold uppercase text-[#667085] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">{day}</div>)}
          {cells.map((date, index) => {
            const key = date ? localDateValue(date) : `empty-${index}`;
            const dayEvents = date ? eventsByDate.get(key) ?? [] : [];
            return <div key={key} className="min-h-24 border-b border-r border-[#dfe3e8] p-2 last:border-r-0 dark:border-slate-700">{date && <><p className="text-xs font-bold text-[#667085] dark:text-slate-400">{date.getDate()}</p><div className="mt-1 space-y-1">{dayEvents.slice(0, 3).map((event) => <button key={event.id} type="button" onClick={() => setSelectedEvent(event)} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-semibold ${event.active ? 'bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{event.title}</button>)}{dayEvents.length > 3 && <p className="text-[10px] text-slate-500">+{dayEvents.length - 3} evento(s)</p>}</div></>}</div>;
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-xl border border-[#dfe3e8] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-[#dfe3e8] p-5 dark:border-slate-700"><h2 className="font-extrabold text-[#181c20] dark:text-white">Próximos eventos</h2><p className="mt-1 text-sm text-[#667085] dark:text-slate-400">Os próximos compromissos ativos da instituição.</p></div>
          {upcomingEvents.length === 0 ? <p className="p-8 text-center text-sm text-[#667085] dark:text-slate-400">Nenhum evento cadastrado para este período.</p> : <div className="divide-y divide-[#dfe3e8] dark:divide-slate-700">{upcomingEvents.map((event) => <button key={event.id} type="button" onClick={() => setSelectedEvent(event)} className="flex w-full items-start justify-between gap-4 p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><span className="min-w-0"><strong className="block truncate text-sm text-[#181c20] dark:text-white">{event.title}</strong><span className="mt-1 block text-xs text-[#667085] dark:text-slate-400">{formatCalendarEventDate({ startsAt: event.starts_at, endsAt: event.ends_at, allDay: event.all_day })} · {eventTypeLabels[event.event_type]}</span></span><span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-200">{audienceLabels[event.audience]}</span></button>)}</div>}
        </section>

        <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {selectedEvent ? <><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">Detalhes do evento</p><h2 className="mt-2 text-lg font-extrabold text-[#181c20] dark:text-white">{selectedEvent.title}</h2></div><button type="button" onClick={() => setSelectedEvent(null)} aria-label="Fechar detalhes" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" aria-hidden="true" /></button></div><dl className="mt-5 space-y-3 text-sm"><div><dt className="font-bold text-[#667085] dark:text-slate-400">Quando</dt><dd className="mt-1 text-[#181c20] dark:text-slate-200">{formatCalendarEventDate({ startsAt: selectedEvent.starts_at, endsAt: selectedEvent.ends_at, allDay: selectedEvent.all_day })}</dd></div><div><dt className="font-bold text-[#667085] dark:text-slate-400">Tipo e público</dt><dd className="mt-1 text-[#181c20] dark:text-slate-200">{eventTypeLabels[selectedEvent.event_type]} · {audienceLabels[selectedEvent.audience]}{selectedEvent.class_name ? ` · ${selectedEvent.class_name}` : ''}</dd></div>{selectedEvent.subject_name && <div><dt className="font-bold text-[#667085] dark:text-slate-400">Disciplina</dt><dd className="mt-1 text-[#181c20] dark:text-slate-200">{selectedEvent.subject_name}</dd></div>}{selectedEvent.description && <div><dt className="font-bold text-[#667085] dark:text-slate-400">Descrição</dt><dd className="mt-1 whitespace-pre-wrap text-[#181c20] dark:text-slate-200">{selectedEvent.description}</dd></div>}</dl><div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={() => openEditEvent(selectedEvent)} className="inline-flex items-center gap-2 rounded-lg border border-[#cfd6e2] px-3 py-2 text-sm font-bold text-[#005bbf] dark:border-slate-600"><Edit3 className="h-4 w-4" aria-hidden="true" /> Editar</button><button type="button" onClick={() => void toggleActive(selectedEvent)} disabled={activeMutation.isPending} className="inline-flex items-center gap-2 rounded-lg border border-[#cfd6e2] px-3 py-2 text-sm font-bold text-[#414754] dark:border-slate-600 dark:text-slate-200">{selectedEvent.active ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}{selectedEvent.active ? 'Desativar' : 'Ativar'}</button></div></> : <div className="grid min-h-48 place-items-center text-center text-sm text-[#667085] dark:text-slate-400"><CalendarDays className="h-8 w-8 text-[#005bbf]" aria-hidden="true" /><p className="mt-2">Selecione um evento para consultar os detalhes.</p></div>}
        </section>
      </div>
    </div>
  );
}
