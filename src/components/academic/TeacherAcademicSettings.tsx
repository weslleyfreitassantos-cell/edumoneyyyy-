import { useEffect, useMemo, useRef, useState } from 'react';

import { useSubjects } from '../../hooks/useSubjects';
import {
  useSaveTeacherSchedulingConfiguration,
  useSchoolTimeSlots,
  useTeacherAvailability,
  useTeacherSchedulingProfile,
  useTeacherSubjects,
} from '../../hooks/useAcademicAutomation';
import { normalizeAcademicLevel } from '../../lib/academic/academicLevels';
import { ACADEMIC_SHIFT_OPTIONS, normalizeAcademicShift } from '../../lib/academic/academicShifts';
import { getTeacherStage, type TeacherActuationType, type TeacherStage } from '../../lib/academic/teacherScheduling';
import type { ClassRow } from '../../services/classService';
import { suggestTeacherAvailabilityFromSchoolSlots, type TeacherAvailabilityDraft } from '../../services/academicAutomationService';

const DAY_LABELS: Array<{ value: number; short: string; label: string }> = [
  { value: 1, short: 'Seg', label: 'Segunda-feira' },
  { value: 2, short: 'Ter', label: 'Terça-feira' },
  { value: 3, short: 'Qua', label: 'Quarta-feira' },
  { value: 4, short: 'Qui', label: 'Quinta-feira' },
  { value: 5, short: 'Sex', label: 'Sexta-feira' },
  { value: 6, short: 'Sáb', label: 'Sábado' },
];

const ACTUATION_OPTIONS: Array<{ value: TeacherActuationType; label: string }> = [
  { value: 'REGENTE', label: 'Regente — anos iniciais (F1)' },
  { value: 'ESPECIALISTA', label: 'Especialista por disciplina' },
  { value: 'AMBOS', label: 'Atua como regente e especialista' },
];

export interface TeacherAcademicSettingsProps {
  institutionId: string;
  academicYearId: string;
  teacherProfileId: string;
  teacherName: string;
  enabledShifts: string[];
  classes: ClassRow[];
  initialSubjectIds?: string[];
  initialPrimarySubjectId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

function normalizeAvailability(rows: TeacherAvailabilityDraft[]): TeacherAvailabilityDraft[] {
  return rows.map((row) => ({
    ...row,
    shift: row.shift ? normalizeAcademicShift(row.shift) : null,
    start_time: row.start_time.slice(0, 5),
    end_time: row.end_time.slice(0, 5),
  }));
}

function formatClassLabel(classRow: ClassRow): string {
  const grade = classRow.grade_level || 'Série não informada';
  const shift = classRow.shift ? ACADEMIC_SHIFT_OPTIONS.find((item) => item.value === normalizeAcademicShift(classRow.shift))?.label : 'Turno não informado';
  return `${classRow.name} · ${grade} · ${shift}`;
}

export default function TeacherAcademicSettings({
  institutionId,
  academicYearId,
  teacherProfileId,
  teacherName,
  enabledShifts,
  classes,
  initialSubjectIds,
  initialPrimarySubjectId,
  onClose,
  onSaved,
}: TeacherAcademicSettingsProps) {
  const subjectsQuery = useSubjects(institutionId);
  const subjectQuery = useTeacherSubjects(institutionId, teacherProfileId);
  const availabilityQuery = useTeacherAvailability(institutionId, teacherProfileId);
  const profileQuery = useTeacherSchedulingProfile(institutionId, academicYearId, teacherProfileId);
  const schoolTimeSlotsQuery = useSchoolTimeSlots(institutionId);
  const saveMutation = useSaveTeacherSchedulingConfiguration();
  const loadedFor = useRef('');

  const [subjectIds, setSubjectIds] = useState<string[]>(initialSubjectIds ?? []);
  const [primarySubjectId, setPrimarySubjectId] = useState(initialPrimarySubjectId ?? '');
  const [actuationType, setActuationType] = useState<TeacherActuationType>('ESPECIALISTA');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [availability, setAvailability] = useState<TeacherAvailabilityDraft[]>([]);
  const [legacyShiftAssignments, setLegacyShiftAssignments] = useState<Record<string, string>>({});
  const [maxWeeklyLessons, setMaxWeeklyLessons] = useState('');
  const [maxDailyLessons, setMaxDailyLessons] = useState('');
  const [contractualWeeklyMinutes, setContractualWeeklyMinutes] = useState('');
  const [markReady, setMarkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSubjects = useMemo(() => (subjectsQuery.data ?? []).filter((subject) => subject.active), [subjectsQuery.data]);
  const currentYearClasses = useMemo(
    () => classes.filter((item) => item.active && item.academic_year_id === academicYearId),
    [academicYearId, classes],
  );
  const availableShifts = useMemo(() => {
    const active = new Set(enabledShifts.map(normalizeAcademicShift));
    return ACADEMIC_SHIFT_OPTIONS.filter((option) => active.has(option.value));
  }, [enabledShifts]);
  const legacyAvailability = availability.map((item, index) => ({ item, index })).filter(({ item }) => !item.shift);
  const unassignedLegacyCount = legacyAvailability.filter(({ index }) => !legacyShiftAssignments[String(index)]).length;

  useEffect(() => {
    if (!academicYearId || !profileQuery.isSuccess || !subjectQuery.isSuccess || !availabilityQuery.isSuccess) return;
    const loadKey = `${teacherProfileId}:${academicYearId}`;
    if (loadedFor.current === loadKey) return;
    loadedFor.current = loadKey;

    const profile = profileQuery.data;
    const subjects = subjectQuery.data ?? [];
    setSubjectIds(initialSubjectIds ?? subjects.filter((item) => item.active).map((item) => item.subject_id));
    setPrimarySubjectId(initialPrimarySubjectId ?? subjects.find((item) => item.primary_subject && item.active)?.subject_id ?? '');
    if (profile) {
      setActuationType(profile.actuation_type);
      setSelectedShifts(profile.authorized_shifts.map(normalizeAcademicShift));
      setSelectedClassIds(profile.authorized_class_ids);
      setMaxWeeklyLessons(profile.max_weekly_lessons?.toString() ?? '');
      setMaxDailyLessons(profile.max_daily_lessons?.toString() ?? '');
      setContractualWeeklyMinutes(profile.contractual_weekly_minutes?.toString() ?? '');
      setMarkReady(profile.configuration_status === 'READY');
    }
    setAvailability(normalizeAvailability(availabilityQuery.data ?? []));
    setError(null);
  }, [academicYearId, availabilityQuery.data, availabilityQuery.isSuccess, initialPrimarySubjectId, initialSubjectIds, profileQuery.data, profileQuery.isSuccess, subjectQuery.data, subjectQuery.isSuccess, teacherProfileId]);

  const selectedClasses = useMemo(
    () => currentYearClasses.filter((item) => selectedClassIds.includes(item.id)),
    [currentYearClasses, selectedClassIds],
  );
  const authorizedGradeLevels = useMemo(
    () => [...new Set(selectedClasses.map((item) => normalizeAcademicLevel(item.grade_level)).filter((value): value is string => Boolean(value)))],
    [selectedClasses],
  );
  const authorizedStages = useMemo(
    () => [...new Set(selectedClasses.map((item) => getTeacherStage(item.grade_level)).filter((value): value is TeacherStage => Boolean(value)))],
    [selectedClasses],
  );

  function toggleSubject(subjectId: string): void {
    setSubjectIds((current) => {
      const next = current.includes(subjectId) ? current.filter((id) => id !== subjectId) : [...current, subjectId];
      if (!next.includes(primarySubjectId)) setPrimarySubjectId('');
      return next;
    });
  }

  function setAvailabilityCell(day: number, shift: string, enabled: boolean): void {
    const normalizedShift = normalizeAcademicShift(shift);
    if (!enabled) {
      setAvailability((current) => current.filter((item) => !(item.day_of_week === day && item.shift === normalizedShift)));
      return;
    }
    const schoolSlots = (schoolTimeSlotsQuery.data ?? []).filter(
      (slot) => slot.active && slot.day_of_week === day && normalizeAcademicShift(slot.shift) === normalizedShift,
    );
    const suggested = suggestTeacherAvailabilityFromSchoolSlots(schoolSlots);
    if (suggested.length === 0) {
      setError(`Não há horários letivos cadastrados para ${DAY_LABELS.find((item) => item.value === day)?.label ?? 'este dia'} no turno ${normalizedShift}. Configure a grade da escola primeiro.`);
      return;
    }
    setAvailability((current) => [
      ...current.filter((item) => !(item.day_of_week === day && item.shift === normalizedShift)),
      ...suggested.map((item) => ({ ...item, shift: normalizedShift })),
    ].sort((left, right) => left.day_of_week - right.day_of_week || (left.shift ?? '').localeCompare(right.shift ?? '') || left.start_time.localeCompare(right.start_time)));
    setError(null);
  }

  function toggleDay(day: number): void {
    const allSelected = availableShifts.length > 0 && availableShifts.every((shift) => availability.some((item) => item.day_of_week === day && item.shift === shift.value));
    for (const shift of availableShifts) setAvailabilityCell(day, shift.value, !allSelected);
  }

  function toggleShift(shift: string): void {
    const normalizedShift = normalizeAcademicShift(shift);
    const allSelected = DAY_LABELS.every((day) => availability.some((item) => item.day_of_week === day.value && item.shift === normalizedShift));
    for (const day of DAY_LABELS) setAvailabilityCell(day.value, normalizedShift, !allSelected);
    setSelectedShifts((current) => allSelected ? current.filter((item) => item !== normalizedShift) : [...new Set([...current, normalizedShift])]);
  }

  function toggleAuthorizedShift(shift: string): void {
    const normalizedShift = normalizeAcademicShift(shift);
    setSelectedShifts((current) => current.includes(normalizedShift) ? current.filter((item) => item !== normalizedShift) : [...current, normalizedShift]);
  }

  function toggleClass(classId: string): void {
    setSelectedClassIds((current) => current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId]);
  }

  function updateAvailability(index: number, patch: Partial<TeacherAvailabilityDraft>): void {
    setAvailability((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function save(): Promise<void> {
    setError(null);
    if (!academicYearId) {
      setError('Selecione um ano letivo antes de configurar a disponibilidade docente.');
      return;
    }
    if (unassignedLegacyCount > 0) {
      setError('Associe cada janela legada a um turno ou remova-a explicitamente antes de salvar. Nenhuma janela antiga será atribuída automaticamente.');
      return;
    }
    const resolvedAvailability = availability.map((item, index) => item.shift ? item : ({ ...item, shift: legacyShiftAssignments[String(index)] ?? null }));
    if (resolvedAvailability.some((item) => !item.shift)) {
      setError('Toda janela de disponibilidade precisa ter um turno definido.');
      return;
    }
    const sorted = [...resolvedAvailability].sort((left, right) => left.day_of_week - right.day_of_week || (left.shift ?? '').localeCompare(right.shift ?? '') || left.start_time.localeCompare(right.start_time));
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      if (current.start_time >= current.end_time) {
        setError('O fim de cada janela precisa ser posterior ao início.');
        return;
      }
      const previous = sorted[index - 1];
      if (previous && previous.day_of_week === current.day_of_week && previous.shift === current.shift && previous.start_time < current.end_time && current.start_time < previous.end_time) {
        setError('Há janelas sobrepostas no mesmo dia e turno. Ajuste os intervalos antes de salvar.');
        return;
      }
    }
    const selectedShiftSet = new Set(selectedShifts);
    if (resolvedAvailability.some((item) => item.shift && !selectedShiftSet.has(item.shift))) {
      setError('Inclua em “Turnos autorizados” cada turno usado na disponibilidade ou remova suas janelas.');
      return;
    }
    if (selectedClasses.some((item) => !item.shift || !selectedShiftSet.has(normalizeAcademicShift(item.shift)))) {
      setError('O turno de cada turma autorizada precisa estar incluído nos turnos autorizados do docente.');
      return;
    }
    const readyRequirementsMet = Boolean(
      actuationType && selectedShifts.length > 0 && selectedClasses.length > 0 && authorizedStages.length > 0 && authorizedGradeLevels.length > 0 && resolvedAvailability.length > 0 &&
      selectedShifts.every((shift) => resolvedAvailability.some((item) => item.shift === shift)),
    );
    if (markReady && !readyRequirementsMet) {
      setError('Para marcar como pronto, selecione turnos, horários para cada turno autorizado e turmas explícitas do ano letivo.');
      return;
    }
    const nullableNumber = (value: string) => value.trim() ? Number(value) : null;
    const weekly = nullableNumber(maxWeeklyLessons);
    const daily = nullableNumber(maxDailyLessons);
    const contract = nullableNumber(contractualWeeklyMinutes);
    if ((weekly !== null && (!Number.isInteger(weekly) || weekly < 1 || weekly > 60)) || (daily !== null && (!Number.isInteger(daily) || daily < 1 || daily > 16)) || (contract !== null && (!Number.isInteger(contract) || contract < 1))) {
      setError('Revise os limites: máximo semanal 1–60, máximo diário 1–16 e minutos contratuais maior que zero.');
      return;
    }

    try {
      await saveMutation.mutateAsync({
        institution_id: institutionId,
        teacher_profile_id: teacherProfileId,
        academic_year_id: academicYearId,
        profile: {
          actuation_type: actuationType,
          authorized_shifts: [...selectedShifts],
          authorized_stages: authorizedStages,
          authorized_grade_levels: authorizedGradeLevels,
          authorized_class_ids: selectedClassIds,
          max_weekly_lessons: weekly,
          max_daily_lessons: daily,
          contractual_weekly_minutes: contract,
          configuration_status: markReady ? 'READY' : 'REVIEW_REQUIRED',
        },
        availability: resolvedAvailability as TeacherAvailabilityDraft[],
        subject_ids: subjectIds,
        primary_subject_id: primarySubjectId || undefined,
      });
      onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a configuração docente.');
    }
  }

  const isLoading = subjectsQuery.isLoading || subjectQuery.isLoading || availabilityQuery.isLoading || profileQuery.isLoading || schoolTimeSlotsQuery.isLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-labelledby="teacher-academic-settings-title">
      <div className="max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <h3 id="teacher-academic-settings-title" className="text-xl font-bold text-slate-900">Disponibilidade e atuação docente</h3>
            <p className="mt-1 text-sm text-slate-600">{teacherName} · escopo do ano letivo atual</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Fechar</button>
        </div>

        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {isLoading && <p className="mt-4 text-sm text-slate-500">Carregando configurações atuais…</p>}
        {(subjectsQuery.isError || subjectQuery.isError || availabilityQuery.isError || profileQuery.isError || schoolTimeSlotsQuery.isError) && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Não foi possível carregar todos os dados. Nenhuma alteração será salva até a revisão.</p>}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
          <div className="space-y-5">
            <section>
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-slate-900">Disponibilidade semanal</h4>
                <span className="text-xs text-slate-500">Horários baseados na grade da escola</span>
              </div>
              <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[500px] text-center text-sm">
                  <thead className="bg-slate-50 text-slate-700"><tr><th className="p-2 text-left">Dia</th>{availableShifts.map((shift) => <th key={shift.value} className="p-2"><button type="button" className="font-semibold hover:text-blue-700" title={`Alternar todos os dias de ${shift.label}`} onClick={() => toggleShift(shift.value)}>{shift.label}</button></th>)}<th className="p-2">Ação</th></tr></thead>
                  <tbody>{DAY_LABELS.map((day) => <tr key={day.value} className="border-t border-slate-100"><th className="p-2 text-left font-medium text-slate-700">{day.label}</th>{availableShifts.map((shift) => {
                    const checked = availability.some((item) => item.day_of_week === day.value && item.shift === shift.value);
                    const hasSchoolSlot = (schoolTimeSlotsQuery.data ?? []).some((item) => item.active && item.day_of_week === day.value && normalizeAcademicShift(item.shift) === shift.value);
                    return <td key={shift.value} className="p-2"><input aria-label={`${day.label}, ${shift.label}`} type="checkbox" checked={checked} disabled={!checked && !hasSchoolSlot} onChange={(event) => setAvailabilityCell(day.value, shift.value, event.target.checked)} className="h-4 w-4 accent-blue-600" /></td>;
                  })}<td className="p-2"><button type="button" onClick={() => toggleDay(day.value)} className="text-xs font-medium text-blue-700 hover:underline">Alternar dia</button></td></tr>)}</tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">Use o cabeçalho para alternar um turno inteiro ou a ação da linha para alternar o dia. Nenhum dia/turno é selecionado automaticamente.</p>
              {availableShifts.length === 0 && <p className="mt-2 text-sm text-amber-700">Ative ao menos um turno na configuração acadêmica da escola.</p>}
              {!schoolTimeSlotsQuery.isLoading && availableShifts.length > 0 && (schoolTimeSlotsQuery.data ?? []).length === 0 && <p className="mt-2 text-sm text-amber-700">Cadastre os horários da escola antes de criar janelas pela matriz.</p>}
            </section>

            {legacyAvailability.length > 0 && <section className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <h4 className="font-semibold text-amber-950">Janelas antigas sem turno — precisam de revisão</h4>
              <p className="mt-1 text-xs text-amber-900">Esses registros não serão tratados como disponibilidade para todos os turnos. Associe cada janela manualmente ou remova-a da seleção.</p>
              <div className="mt-3 space-y-2">{legacyAvailability.map(({ item, index }) => <div key={`legacy-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><span className="text-sm text-amber-950">{DAY_LABELS.find((day) => day.value === item.day_of_week)?.label}: {item.start_time}–{item.end_time}</span><select aria-label={`Turno da janela antiga ${index + 1}`} value={legacyShiftAssignments[String(index)] ?? ''} onChange={(event) => setLegacyShiftAssignments((current) => ({ ...current, [String(index)]: event.target.value }))} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"><option value="">Selecione o turno</option>{availableShifts.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}</select><button type="button" onClick={() => { setAvailability((current) => current.filter((_candidate, candidateIndex) => candidateIndex !== index)); setLegacyShiftAssignments({}); }} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Remover janela</button></div>)}</div>
            </section>}

            <section>
              <h4 className="font-semibold text-slate-900">Janelas de disponibilidade</h4>
              <p className="mt-1 text-xs text-slate-500">Revise dia, turno e intervalos propostos pela grade escolar; exceções podem ser ajustadas aqui.</p>
              <div className="mt-2 space-y-2">{availability.map((item, index) => ({ item, index })).filter(({ item }) => item.shift).map(({ item, index }) => <div key={`${item.day_of_week}-${item.shift}-${index}`} className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-center"><span className="text-sm text-slate-700">{DAY_LABELS.find((day) => day.value === item.day_of_week)?.label}</span><select aria-label={`Turno da janela ${index + 1}`} value={item.shift ?? ''} onChange={(event) => updateAvailability(index, { shift: event.target.value })} className="rounded-lg border px-2 py-2 text-sm">{availableShifts.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}</select><input aria-label={`Início da janela ${index + 1}`} type="time" value={item.start_time} onChange={(event) => updateAvailability(index, { start_time: event.target.value })} className="rounded-lg border px-2 py-2 text-sm" /><input aria-label={`Fim da janela ${index + 1}`} type="time" value={item.end_time} onChange={(event) => updateAvailability(index, { end_time: event.target.value })} className="rounded-lg border px-2 py-2 text-sm" /><button type="button" onClick={() => setAvailability((current) => current.filter((_row, rowIndex) => rowIndex !== index))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Remover</button></div>)}{availability.filter((item) => item.shift).length === 0 && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Nenhum intervalo definido ainda.</p>}</div>
            </section>
          </div>

          <aside className="space-y-5">
            <section>
              <h4 className="font-semibold text-slate-900">Atuação</h4>
              <div className="mt-2 space-y-2">{ACTUATION_OPTIONS.map((option) => <label key={option.value} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm"><input type="radio" name="teacher-actuation" checked={actuationType === option.value} onChange={() => setActuationType(option.value)} className="mt-0.5 accent-blue-600" /><span>{option.label}</span></label>)}</div>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900">Turnos autorizados</h4>
              <div className="mt-2 grid grid-cols-2 gap-2">{availableShifts.map((shift) => <label key={shift.value} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm"><input type="checkbox" checked={selectedShifts.includes(shift.value)} onChange={() => toggleAuthorizedShift(shift.value)} className="accent-blue-600" />{shift.label}</label>)}</div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-900">Turmas autorizadas</h4><span className="text-xs text-slate-500">{selectedClassIds.length} selecionada(s)</span></div>
              <p className="mt-1 text-xs text-slate-500">Somente turmas do ano letivo atual; série e etapa são derivadas da seleção.</p>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">{currentYearClasses.length === 0 ? <p className="p-2 text-sm text-amber-700">Não há turmas ativas neste ano letivo.</p> : currentYearClasses.map((classRow) => <label key={classRow.id} className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-slate-50"><input type="checkbox" checked={selectedClassIds.includes(classRow.id)} onChange={() => toggleClass(classRow.id)} className="mt-0.5 accent-blue-600" /><span>{formatClassLabel(classRow)}</span></label>)}</div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-700">Máximo semanal<input type="number" min="1" max="60" value={maxWeeklyLessons} onChange={(event) => setMaxWeeklyLessons(event.target.value)} placeholder="Política da escola" className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-slate-700">Máximo diário<input type="number" min="1" max="16" value={maxDailyLessons} onChange={(event) => setMaxDailyLessons(event.target.value)} placeholder="Política da escola" className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" /></label>
              <label className="col-span-2 text-xs font-medium text-slate-700">Carga contratual semanal (minutos, opcional)<input type="number" min="1" value={contractualWeeklyMinutes} onChange={(event) => setContractualWeeklyMinutes(event.target.value)} placeholder="Não informada" className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" /></label>
            </section>

            <section>
              <div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-900">Disciplinas de especialista</h4><span className="text-xs text-slate-500">{subjectIds.length} selecionada(s)</span></div>
              <p className="mt-1 text-xs text-slate-500">A atuação de regente F1 cobre apenas Português, Matemática, Ciências, História e Geografia; ela não concede qualificação global de especialista.</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">{activeSubjects.map((subject) => <div key={subject.id} className="flex items-center gap-2 rounded-md p-1 text-sm"><label className="flex min-w-0 flex-1 items-center gap-2"><input type="checkbox" checked={subjectIds.includes(subject.id)} onChange={() => toggleSubject(subject.id)} className="accent-blue-600" /><span className="truncate">{subject.name}</span></label>{subjectIds.includes(subject.id) && <button type="button" onClick={() => setPrimarySubjectId(subject.id)} className="text-xs text-blue-700">{primarySubjectId === subject.id ? 'Principal' : 'Tornar principal'}</button>}</div>)}</div>
            </section>

            <label className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><input type="checkbox" checked={markReady} onChange={(event) => setMarkReady(event.target.checked)} className="mt-0.5 accent-blue-600" /><span><strong>Marcar configuração como pronta para geração.</strong><span className="mt-1 block text-xs">Se desmarcado, o cadastro é salvo para revisão e não autoriza o gerador a assumir uma qualificação.</span></span></label>
          </aside>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} disabled={saveMutation.isPending} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={() => void save()} disabled={saveMutation.isPending || isLoading || Boolean(subjectsQuery.isError || subjectQuery.isError || availabilityQuery.isError || profileQuery.isError || schoolTimeSlotsQuery.isError)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saveMutation.isPending ? 'Salvando…' : 'Salvar configuração'}</button>
        </div>
      </div>
    </div>
  );
}
