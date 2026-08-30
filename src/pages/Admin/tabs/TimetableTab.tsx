import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useClasses } from '../../../hooks/useClasses';
import { useAssignments } from '../../../hooks/useAssignments';
import { useRooms, useCreateRoom, useUpdateRoom, useSetRoomActive, useTimetableEntries, useCreateTimetableEntry, useSetTimetableEntryActive } from '../../../hooks/useTimetable';
import { timetableService, DAYS_OF_WEEK, dayLabel, type TimetableEntryRow, type RoomRow, type TimetableGrid } from '../../../services/timetableService';
import { roomSchema, timetableEntrySchema, type RoomFormData, type TimetableEntryFormData } from '../../../schemas/adminSchemas';
import { DataTable, type Column } from '../../../components/DataTable';
import TimetableAutomationPanel from '../../../components/academic/TimetableAutomationPanel';

interface RoomDraft {
  name: string;
  code: string;
  capacity: string;
  class_id: string;
}

interface EntryDraft {
  class_id: string;
  subject_offering_id: string;
  room_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

const emptyRoomDraft: RoomDraft = { name: '', code: '', capacity: '', class_id: '' };
const emptyEntryDraft: EntryDraft = { class_id: '', subject_offering_id: '', room_id: '', day_of_week: '1', start_time: '07:00', end_time: '07:50' };

type SubView = 'grid' | 'rooms' | 'automation';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as Record<string, unknown>).message === 'string') return (error as Record<string, unknown>).message as string;
  return 'Não foi possível concluir a operação.';
}

function TimetableView({ grid, onEdit }: { grid: TimetableGrid; onEdit: (e: TimetableEntryRow) => void }) {
  function renderGridCell(entry: TimetableEntryRow) {
    return (
      <div
        key={entry.id}
        className="cursor-pointer rounded-md border border-blue-200 bg-blue-50 p-1.5 text-xs hover:bg-blue-100"
        onClick={() => onEdit(entry)}
      >
        <div className="font-semibold text-[#181c20]">{entry.subject_name}</div>
        <div className="text-[#727785]">{entry.teacher_name ?? '—'}</div>
        {entry.room_name && <div className="text-[#727785]">{entry.room_name}</div>}
      </div>
    );
  }

  if (grid.timeSlots.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        Nenhum horário cadastrado. Clique em "Adicionar horário" para começar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#dfe3e8]">
      <table className="min-w-full divide-y divide-[#dfe3e8] text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-2 text-left text-xs font-semibold text-[#727785] uppercase">Horário</th>
            {grid.days.map((day) => (
              <th key={day.day} className="px-3 py-2 text-left text-xs font-semibold text-[#727785] uppercase">
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#dfe3e8]">
          {grid.timeSlots.map((slot, idx) => (
            <tr key={`${slot.start_time}-${slot.end_time}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-[#727785]">
                {slot.start_time} – {slot.end_time}
              </td>
              {grid.days.map((day) => {
                const daySlot = day.slots[idx];
                return (
                  <td key={day.day} className="px-1 py-1 align-top">
                    <div className="flex flex-col gap-1">
                      {daySlot?.entries.map((entry) => renderGridCell(entry))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TimetableTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? '';

  const yearsQuery = useAcademicYears(institutionId);
  const classesQuery = useClasses(institutionId);
  const assignmentsQuery = useAssignments(institutionId);
  const roomsQuery = useRooms(institutionId);
  const entriesQuery = useTimetableEntries(institutionId);

  const createEntryMutation = useCreateTimetableEntry();
  const setEntryActiveMutation = useSetTimetableEntryActive();
  const createRoomMutation = useCreateRoom();
  const updateRoomMutation = useUpdateRoom();
  const setRoomActiveMutation = useSetRoomActive();

  const [searchParams] = useSearchParams();
  const [subView, setSubView] = useState<SubView>(() => {
    const requestedView = searchParams.get('view');
    if (requestedView === 'automation' || requestedView === 'rooms') return requestedView;
    return 'grid';
  });
  const [classFilter, setClassFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [termFilter, setTermFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');

  // Entry modal state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntryRow | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft>({ ...emptyEntryDraft });
  const [entryError, setEntryError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Room modal state
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [roomDraft, setRoomDraft] = useState<RoomDraft>({ ...emptyRoomDraft });
  const [roomError, setRoomError] = useState<string | null>(null);

  const years = yearsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const entries = entriesQuery.data ?? [];
  const teachers = useMemo(() => Array.from(new Map(assignments.filter((assignment) => assignment.active).map((assignment) => [assignment.teacher_profile_id, { profile_id: assignment.teacher_profile_id, name: assignment.teacher_name }])).values()), [assignments]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (yearFilter !== 'all' && e.academic_year_id !== yearFilter) return false;
      if (termFilter !== 'all' && e.term_id !== termFilter) return false;
      if (classFilter !== 'all' && e.class_id !== classFilter) return false;
      if (teacherFilter !== 'all' && e.teacher_profile_id !== teacherFilter) return false;
      if (dayFilter !== 'all' && e.day_of_week !== Number(dayFilter)) return false;
      return true;
    });
  }, [entries, classFilter, dayFilter, teacherFilter, termFilter, yearFilter]);

  const grid = useMemo(() => timetableService.buildGrid(filteredEntries), [filteredEntries]);

  // Assignments grouped by class for the entry modal
  const assignmentsByClass = useMemo(() => {
    const map = new Map<string, typeof assignments>();
    for (const a of assignments) {
      if (!a.active) continue;
      const list = map.get(a.class_id) ?? [];
      list.push(a);
      map.set(a.class_id, list);
    }
    return map;
  }, [assignments]);

  const classOptions = useMemo(() => classes.filter((classRecord) => assignmentsByClass.has(classRecord.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [assignmentsByClass, classes]);

  const filteredAssignments = useMemo(() => {
    if (!entryDraft.class_id) return [];
    return assignmentsByClass.get(entryDraft.class_id) ?? [];
  }, [assignmentsByClass, entryDraft.class_id]);

  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);

  const isEntrySubmitting = createEntryMutation.isPending;
  const isRoomSubmitting = createRoomMutation.isPending || updateRoomMutation.isPending;

  function resetMessages(): void {
    setEntryError(null);
    setRoomError(null);
    setFeedbackMessage(null);
  }

  async function handleEntrySubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setEntryError(null);

    if (!institutionId) { setEntryError('Instituição não carregada.'); return; }

    const payload: TimetableEntryFormData = {
      institution_id: institutionId,
      subject_offering_id: entryDraft.subject_offering_id,
      room_id: entryDraft.room_id || undefined,
      day_of_week: Number(entryDraft.day_of_week),
      start_time: entryDraft.start_time,
      end_time: entryDraft.end_time,
      active: true,
    };

    const result = timetableEntrySchema.safeParse(payload);
    if (!result.success) { setEntryError(result.error.issues[0]?.message ?? 'Dados inválidos.'); return; }

    try {
      if (editingEntry) {
        setFeedbackMessage('Horário atualizado.');
      } else {
        await createEntryMutation.mutateAsync(result.data);
        setFeedbackMessage('Horário adicionado com sucesso.');
      }
      closeEntryModal();
    } catch (error) {
      setEntryError(getErrorMessage(error));
    }
  }

  function openCreateEntryModal(): void {
    resetMessages();
    setEditingEntry(null);
    setEntryDraft({ ...emptyEntryDraft });
    setIsEntryModalOpen(true);
  }

  function openEditEntryModal(entry: TimetableEntryRow): void {
    resetMessages();
    setEditingEntry(entry);
    setEntryDraft({
      class_id: entry.class_id,
      subject_offering_id: entry.subject_offering_id,
      room_id: entry.room_id ?? '',
      day_of_week: String(entry.day_of_week),
      start_time: entry.start_time,
      end_time: entry.end_time,
    });
    setIsEntryModalOpen(true);
  }

  function closeEntryModal(): void {
    setIsEntryModalOpen(false);
    setEditingEntry(null);
    setEntryDraft({ ...emptyEntryDraft });
    setEntryError(null);
  }

  async function handleToggleEntryActive(entry: TimetableEntryRow): Promise<void> {
    const nextActive = !entry.active;
    if (!window.confirm(`Deseja ${nextActive ? 'reativar' : 'desativar'} este horário?`)) return;
    setFeedbackMessage(null);
    try {
      await setEntryActiveMutation.mutateAsync({ id: entry.id, institutionId, active: nextActive });
      setFeedbackMessage(nextActive ? 'Horário reativado.' : 'Horário desativado.');
    } catch (error) {
      setEntryError(getErrorMessage(error));
    }
  }

  // Room handlers

  async function handleRoomSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setRoomError(null);

    if (!institutionId) { setRoomError('Instituição não carregada.'); return; }

    const payload: RoomFormData = {
      institution_id: institutionId,
      name: roomDraft.name,
      code: roomDraft.code || undefined,
      capacity: roomDraft.capacity ? Number(roomDraft.capacity) : undefined,
      class_id: roomDraft.class_id || undefined,
      active: true,
    };

    const result = roomSchema.safeParse(payload);
    if (!result.success) { setRoomError(result.error.issues[0]?.message ?? 'Dados inválidos.'); return; }

    try {
      if (editingRoom) {
        await updateRoomMutation.mutateAsync({ id: editingRoom.id, institutionId, data: { name: result.data.name, code: result.data.code, capacity: result.data.capacity, class_id: result.data.class_id, active: editingRoom.active } });
        setFeedbackMessage('Sala atualizada.');
      } else {
        await createRoomMutation.mutateAsync(result.data);
        setFeedbackMessage('Sala criada com sucesso.');
      }
      closeRoomModal();
    } catch (error) {
      setRoomError(getErrorMessage(error));
    }
  }

  function openCreateRoomModal(): void {
    resetMessages();
    setEditingRoom(null);
    setRoomDraft({ ...emptyRoomDraft });
    setIsRoomModalOpen(true);
  }

  function openEditRoomModal(room: RoomRow): void {
    resetMessages();
    setEditingRoom(room);
    setRoomDraft({ name: room.name, code: room.code ?? '', capacity: room.capacity ? String(room.capacity) : '', class_id: room.class_id ?? '' });
    setIsRoomModalOpen(true);
  }

  function closeRoomModal(): void {
    setIsRoomModalOpen(false);
    setEditingRoom(null);
    setRoomDraft({ ...emptyRoomDraft });
    setRoomError(null);
  }

  async function handleToggleRoomActive(room: RoomRow): Promise<void> {
    const nextActive = !room.active;
    if (!window.confirm(`Deseja ${nextActive ? 'reativar' : 'desativar'} a sala ${room.name}?`)) return;
    try {
      await setRoomActiveMutation.mutateAsync({ id: room.id, institutionId, active: nextActive });
      setFeedbackMessage(nextActive ? 'Sala reativada.' : 'Sala desativada.');
    } catch (error) {
      setRoomError(getErrorMessage(error));
    }
  }

  const roomColumns: Column<RoomRow>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'code', label: 'Código', render: (_v, r) => r.code ?? '—' },
    { key: 'capacity', label: 'Capacidade', render: (_v, r) => r.capacity ? String(r.capacity) : '—' },
    { key: 'class_name', label: 'Turma', render: (_v, r) => r.class_name ?? 'Compartilhada' },
    {
      key: 'active',
      label: 'Status',
      render: (_v, r) => (
        <span className={r.active ? 'inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700' : 'inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600'}>
          {r.active ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
  ];

  if (institutionQuery.isLoading) {
    return <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-gray-500">Carregando instituição...</div>;
  }

  if (institutionQuery.isError) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{getErrorMessage(institutionQuery.error)}</div>;
  }

  return (
    <div className="space-y-4">
      {feedbackMessage && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{feedbackMessage}</div>
      )}

      {/* Sub-navigation */}
      <div className="flex gap-2 border-b border-[#dfe3e8] pb-2">
        <button
          type="button"
          onClick={() => setSubView('grid')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${subView === 'grid' ? 'border-x border-t border-[#dfe3e8] bg-white text-[#005bbf]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Grade Horária
        </button>
        <button
          type="button"
          onClick={() => setSubView('rooms')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${subView === 'rooms' ? 'border-x border-t border-[#dfe3e8] bg-white text-[#005bbf]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Salas
        </button>
        <button
          type="button"
          onClick={() => setSubView('automation')}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium ${subView === 'automation' ? 'border-x border-t border-[#dfe3e8] bg-white text-[#005bbf]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Automacao
        </button>
      </div>

      {subView === 'automation' && <TimetableAutomationPanel institutionId={institutionId} createdBy={profile?.id ?? ''} />}

      {subView === 'grid' && (
        <>
          {/* Filters */}
          <section className="flex flex-col gap-3 rounded-xl border border-[#dfe3e8] bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div>
              <label htmlFor="tt-year-filter" className="block text-sm font-medium text-gray-700">Ano letivo</label>
              <select id="tt-year-filter" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setTermFilter('all'); }} className="mt-1 rounded-lg border px-3 py-2 text-sm">
                <option value="all">Todos</option>
                {years.filter((year) => year.active).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tt-term-filter" className="block text-sm font-medium text-gray-700">Periodo</label>
              <select id="tt-term-filter" value={termFilter} onChange={(e) => setTermFilter(e.target.value)} className="mt-1 rounded-lg border px-3 py-2 text-sm">
                <option value="all">Todos</option>
                {years.flatMap((year) => year.terms.filter((term) => yearFilter === 'all' || year.id === yearFilter).map((term) => <option key={term.id} value={term.id}>{term.name} - {year.name}</option>))}
              </select>
            </div>
            <div>
              <label htmlFor="tt-class-filter" className="block text-sm font-medium text-gray-700">Turma</label>
              <select
                id="tt-class-filter"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="mt-1 rounded-lg border px-3 py-2 text-sm"
              >
                <option value="all">Todas</option>
                {classes.filter((c) => c.active && (yearFilter === 'all' || c.academic_year_id === yearFilter)).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tt-teacher-filter" className="block text-sm font-medium text-gray-700">Professor</label>
              <select id="tt-teacher-filter" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="mt-1 rounded-lg border px-3 py-2 text-sm">
                <option value="all">Todos</option>
                {teachers.filter((teacher) => teacher.active).map((teacher) => <option key={teacher.profile_id} value={teacher.profile_id}>{teacher.profiles?.full_name ?? teacher.profile_id}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="tt-day-filter" className="block text-sm font-medium text-gray-700">Dia da semana</label>
              <select
                id="tt-day-filter"
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="mt-1 rounded-lg border px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>{dayLabel(d)}</option>
                ))}
              </select>
            </div>

            <div className="sm:ml-auto">
              <button
                type="button"
                onClick={openCreateEntryModal}
                disabled={assignments.length === 0}
                className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Adicionar horário
              </button>
            </div>
          </section>

          {/* Grid */}
          <TimetableView grid={grid} onEdit={openEditEntryModal} />
        </>
      )}

      {subView === 'rooms' && (
        <>
          <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">CONFIGURAÇÃO DAS SALAS</p>
                <h2 className="mt-1 text-lg font-bold text-[#181c20]">Crie e organize as salas da escola</h2>
                <p className="mt-1 max-w-3xl text-sm text-gray-700">
                  Cadastre uma sala física e, se quiser, vincule-a a uma turma. Salas sem turma ficam compartilhadas e podem ser usadas em qualquer horário.
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-blue-800">{rooms.length} sala(s) cadastrada(s)</span>
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-blue-100 pt-3 text-sm text-gray-700 md:flex-row md:gap-6">
              <p><strong className="text-[#181c20]">Criação manual:</strong> use o botão abaixo para escolher nome, código, capacidade e turma.</p>
              <p><strong className="text-[#181c20]">Geração automática:</strong> ao gerar uma grade sem salas cadastradas, o sistema cria salas AUTO vinculadas às turmas.</p>
            </div>
          </section>

          <DataTable
            title="Salas"
            addLabel="Criar sala manualmente"
            data={rooms}
            columns={roomColumns}
            isLoading={roomsQuery.isLoading}
            onAdd={openCreateRoomModal}
            emptyMessage="Nenhuma sala cadastrada. Crie a primeira sala manualmente."
            renderActions={(room) => (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => openEditRoomModal(room)} className="font-medium text-blue-600 hover:text-blue-800">Editar</button>
                <button type="button" onClick={() => void handleToggleRoomActive(room)} className={room.active ? 'font-medium text-red-600 hover:text-red-800' : 'font-medium text-green-600 hover:text-green-800'}>
                  {room.active ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            )}
          />
        </>
      )}

      {/* Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 id="entry-modal-title" className="mb-4 text-lg font-bold text-[#181c20]">
              {editingEntry ? 'Editar horário' : 'Adicionar horário'}
            </h3>

            <form onSubmit={(e) => void handleEntrySubmit(e)} className="space-y-4">
              {entryError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{entryError}</div>}

              <div>
                <label htmlFor="entry-class" className="block text-sm font-medium text-gray-700">Turma</label>
                <select
                  id="entry-class"
                  value={editingEntry ? editingEntry.class_id : entryDraft.class_id}
                  onChange={(e) => {
                    setEntryDraft((curr) => ({ ...curr, class_id: e.target.value, subject_offering_id: '' }));
                  }}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  disabled={!!editingEntry}
                  required
                >
                  <option value="">Selecione</option>
                  {classOptions.map((classRecord) => (
                    <option key={classRecord.id} value={classRecord.id}>{classRecord.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="entry-offering" className="block text-sm font-medium text-gray-700">Disciplina / Professor / Período</label>
                <select
                  id="entry-offering"
                  value={entryDraft.subject_offering_id}
                  onChange={(e) => setEntryDraft((curr) => ({ ...curr, subject_offering_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                >
                  <option value="">Selecione</option>
                  {filteredAssignments.map((a) => (
                    <option key={a.id} value={a.id}>{a.subject_name} — {a.teacher_name} ({a.term_name})</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="entry-room" className="block text-sm font-medium text-gray-700">Sala (opcional)</label>
                <select
                  id="entry-room"
                  value={entryDraft.room_id}
                  onChange={(e) => setEntryDraft((curr) => ({ ...curr, room_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Sem sala</option>
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}{r.code ? ` (${r.code})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="entry-day" className="block text-sm font-medium text-gray-700">Dia</label>
                  <select
                    id="entry-day"
                    value={entryDraft.day_of_week}
                    onChange={(e) => setEntryDraft((curr) => ({ ...curr, day_of_week: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>{dayLabel(d)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="entry-start" className="block text-sm font-medium text-gray-700">Início</label>
                  <input
                    id="entry-start"
                    type="time"
                    value={entryDraft.start_time}
                    onChange={(e) => setEntryDraft((curr) => ({ ...curr, start_time: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="entry-end" className="block text-sm font-medium text-gray-700">Fim</label>
                  <input
                    id="entry-end"
                    type="time"
                    value={entryDraft.end_time}
                    onChange={(e) => setEntryDraft((curr) => ({ ...curr, end_time: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeEntryModal} disabled={isEntrySubmitting} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isEntrySubmitting} className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50">
                  {isEntrySubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Modal */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="room-modal-title">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 id="room-modal-title" className="text-lg font-bold text-[#181c20]">
              {editingRoom ? 'Editar sala' : 'Adicionar sala'}
            </h3>
            <p className="mb-4 mt-1 text-sm text-gray-600">
              {editingRoom ? 'Atualize os dados e o vínculo desta sala.' : 'Cadastre uma sala para usar na grade horária. O vínculo com a turma é opcional.'}
            </p>

            <form onSubmit={(e) => void handleRoomSubmit(e)} className="space-y-4">
              {roomError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{roomError}</div>}

              <div>
                <label htmlFor="room-name" className="block text-sm font-medium text-gray-700">Nome da sala</label>
                <input
                  id="room-name"
                  type="text"
                  value={roomDraft.name}
                  onChange={(e) => setRoomDraft((curr) => ({ ...curr, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                  maxLength={120}
                />
              </div>

              <div>
                <label htmlFor="room-code" className="block text-sm font-medium text-gray-700">Código (opcional)</label>
                <input
                  id="room-code"
                  type="text"
                  value={roomDraft.code}
                  onChange={(e) => setRoomDraft((curr) => ({ ...curr, code: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  maxLength={20}
                />
              </div>

              <div>
                <label htmlFor="room-capacity" className="block text-sm font-medium text-gray-700">Capacidade (opcional)</label>
                <input
                  id="room-capacity"
                  type="number"
                  min="1"
                  max="500"
                  value={roomDraft.capacity}
                  onChange={(e) => setRoomDraft((curr) => ({ ...curr, capacity: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label htmlFor="room-class" className="block text-sm font-medium text-gray-700">Turma vinculada (opcional)</label>
                <select
                  id="room-class"
                  value={roomDraft.class_id}
                  onChange={(e) => setRoomDraft((curr) => ({ ...curr, class_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Sala compartilhada</option>
                  {classes.filter((classRecord) => classRecord.active).sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')).map((classRecord) => (
                    <option key={classRecord.id} value={classRecord.id}>{classRecord.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Deixe como Sala compartilhada para disponibilizá-la em qualquer turma.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeRoomModal} disabled={isRoomSubmitting} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isRoomSubmitting} className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50">
                  {isRoomSubmitting ? 'Salvando...' : editingRoom ? 'Salvar' : 'Criar sala'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
