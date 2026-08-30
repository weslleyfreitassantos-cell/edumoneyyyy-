import { supabase } from '../lib/supabaseClient';
import {
  generateTimetable,
  type GeneratorDiagnostic,
  type GeneratorScheduleBreak,
  type TimetableGeneratorResult,
} from '../lib/academic/timetableGenerator';
import {
  buildDefaultTimeSlots,
  normalizeAcademicShift,
  planAutomaticAssignments,
} from '../lib/academic/timetableGenerator/automaticPreparation';
import { toAcademicShift } from '../lib/academic/academicShifts';
import { academicShiftSettingsService } from './academicShiftSettingsService';

export interface TimetableVersionRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  generation_source: string;
  created_at: string;
  published_at: string | null;
}

export interface TimetableVersionEntryRow {
  id: string;
  version_id: string;
  institution_id: string;
  academic_year_id: string;
  term_id: string;
  term_name: string;
  class_id: string;
  class_name: string;
  class_shift?: string | null;
  subject_offering_id: string;
  subject_name: string;
  teacher_profile_id: string;
  teacher_name: string | null;
  room_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  locked: boolean;
  active: boolean;
}

export interface GeneratedDraft extends TimetableGeneratorResult {
  versionId?: string;
  automaticAssignmentsCreated: number;
  automaticRoomsCreated: number;
  automaticSlotsCreated: number;
  automaticUnassigned: number;
}

function buildSetupDiagnostics(input: {
  termIds: string[];
  classes: Array<{ id: string; name: string; shift: string | null }>;
  curriculumItems: Array<{ class_id: string; weekly_lessons: number }>;
  enabledShifts: string[];
}): GeneratorDiagnostic[] {
  const diagnostics: GeneratorDiagnostic[] = [];

  if (input.termIds.length === 0) {
    diagnostics.push({
      code: 'SETUP_TERMS_REQUIRED',
      message: 'Cadastre pelo menos um período ativo no ano letivo antes de gerar a grade.',
      suggestions: ['Abra Ano letivo > Períodos e cadastre os bimestres, trimestres ou semestres.'],
    });
  }

  if (input.classes.length === 0) {
    diagnostics.push({
      code: 'SETUP_CLASSES_REQUIRED',
      message: 'Cadastre pelo menos uma turma ativa no ano letivo antes de gerar a grade.',
      suggestions: ['Abra Turmas e crie as turmas do ano letivo selecionado.'],
    });
  }

  const activeCurriculumItems = input.curriculumItems.filter((item) => item.weekly_lessons > 0);
  if (activeCurriculumItems.length === 0) {
    diagnostics.push({
      code: 'SETUP_CURRICULUM_REQUIRED',
      message: 'Configure a matriz curricular das turmas antes de gerar a grade.',
      suggestions: ['Abra Matriz curricular e informe as matérias e a carga semanal de cada turma.'],
    });
  }

  for (const classRecord of input.classes) {
    if (!classRecord.shift?.trim()) {
      diagnostics.push({
        code: 'SETUP_CLASS_SHIFT_REQUIRED',
        message: `A turma ${classRecord.name} está sem turno definido.`,
        classId: classRecord.id,
        suggestions: ['Edite a turma e selecione Manhã, Tarde, Noite ou Integral.'],
      });
    } else {
      const normalizedShift = toAcademicShift(classRecord.shift);
      if (
        !normalizedShift ||
        !input.enabledShifts.includes(normalizedShift)
      ) {
        diagnostics.push({
          code: 'SETUP_CLASS_SHIFT_NOT_CONFIGURED',
          message: `A turma ${classRecord.name} usa um turno que não está habilitado na política acadêmica.`,
          classId: classRecord.id,
          suggestions: ['Edite a turma ou habilite este turno em Política acadêmica.'],
        });
      }
    }

    if (!activeCurriculumItems.some((item) => item.class_id === classRecord.id)) {
      diagnostics.push({
        code: 'SETUP_CLASS_CURRICULUM_REQUIRED',
        message: `A turma ${classRecord.name} ainda não possui matérias com carga semanal.`,
        classId: classRecord.id,
        suggestions: ['Aplique uma matriz curricular ou cadastre as matérias da turma.'],
      });
    }
  }

  return diagnostics;
}

function buildInvalidDraft(
  diagnostics: GeneratorDiagnostic[],
  seed: string,
): GeneratedDraft {
  return {
    valid: false,
    status: 'UNSATISFIED',
    entries: [],
    hardConflicts: diagnostics.length,
    score: 0,
    penalties: { teacherGaps: 0, sameSubjectSameDay: 0, roomChanges: 0 },
    diagnostics,
    seed,
    automaticAssignmentsCreated: 0,
    automaticRoomsCreated: 0,
    automaticSlotsCreated: 0,
    automaticUnassigned: 0,
  };
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function overlapsTime(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean {
  return (
    timeToMinutes(leftStart) < timeToMinutes(rightEnd) &&
    timeToMinutes(rightStart) < timeToMinutes(leftEnd)
  );
}

function isMissingScheduleBreaksTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? error.code : null;
  const message = 'message' in error ? error.message : null;
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (typeof message === 'string' &&
      /school_schedule_breaks.*(does not exist|could not find the table)/i.test(message))
  );
}

async function listScheduleBreaksForGenerator(institutionId: string) {
  const result = await supabase
    .from('school_schedule_breaks')
    .select('institution_id, shift, day_of_week, name, start_time, end_time, active')
    .eq('institution_id', institutionId)
    .eq('active', true);
  if (result.error && !isMissingScheduleBreaksTable(result.error)) {
    throw result.error;
  }
  return result.data ?? [];
}

async function listActiveOfferings(institutionId: string) {
  const pageSize = 1000;
  const offerings: Array<{
    id: string;
    class_id: string;
    subject_id: string;
    teacher_profile_id: string;
    term_id: string;
  }> = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('subject_offerings')
      .select('id, class_id, subject_id, teacher_profile_id, term_id, classes!inner(institution_id)')
      .eq('classes.institution_id', institutionId)
      .eq('active', true)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    offerings.push(...(data ?? []));

    if (!data || data.length < pageSize) break;
  }

  return offerings;
}

async function prepareAutomaticAssignments(input: {
  institutionId: string;
  academicYearId: string;
  classes: Array<{ id: string; institution_id: string; academic_year_id: string; name: string; shift: string | null }>;
  curriculumItems: Array<{ class_id: string; subject_id: string; weekly_lessons: number; lesson_duration_minutes: number }>;
  offerings: Array<{ id: string; class_id: string; subject_id: string; teacher_profile_id: string; term_id: string }>;
  teacherSubjects: Array<{ institution_id: string; teacher_profile_id: string; subject_id: string; active: boolean }>;
  termIds: string[];
}): Promise<{ offerings: Array<{ id: string; class_id: string; subject_id: string; teacher_profile_id: string; term_id: string }>; created: number; unassigned: number }> {
  const plan = planAutomaticAssignments({
    classes: input.classes.map((item) => ({ id: item.id, institutionId: item.institution_id, academicYearId: item.academic_year_id, name: item.name, shift: item.shift })),
    curriculumItems: input.curriculumItems.map((item) => ({ classId: item.class_id, subjectId: item.subject_id, weeklyLessons: item.weekly_lessons, lessonDurationMinutes: item.lesson_duration_minutes })),
    subjectOfferings: input.offerings.map((item) => ({ id: item.id, institutionId: input.institutionId, classId: item.class_id, subjectId: item.subject_id, teacherProfileId: item.teacher_profile_id, termId: item.term_id })),
    teacherSubjects: input.teacherSubjects.map((item) => ({ institutionId: item.institution_id, teacherProfileId: item.teacher_profile_id, subjectId: item.subject_id, active: item.active })),
    termIds: input.termIds,
  });

  let created = 0;
  for (const assignment of plan.assignments) {
    const { data, error } = await supabase.rpc('create_whole_year_assignment', {
      p_institution_id: input.institutionId,
      p_class_id: assignment.classId,
      p_subject_id: assignment.subjectId,
      p_teacher_profile_id: assignment.teacherProfileId,
      p_academic_year_id: input.academicYearId,
    });
    if (error) throw error;
    created += Number(data ?? 0);
  }

  return {
    offerings: created > 0 ? await listActiveOfferings(input.institutionId) : input.offerings,
    created,
    unassigned: plan.unassigned.length,
  };
}

async function prepareAutomaticRooms(input: {
  institutionId: string;
  classes: Array<{ id: string; name: string; capacity?: number | null }>;
  rooms: Array<{ id: string; institution_id: string; active: boolean; class_id?: string | null }>;
}): Promise<{ rooms: Array<{ id: string; institution_id: string; active: boolean; class_id?: string | null }>; created: number }> {
  if (input.rooms.length > 0 || input.classes.length === 0) return { rooms: input.rooms, created: 0 };

  const roomPayload = input.classes.map((classRecord, index) => ({
    institution_id: input.institutionId,
    name: `Sala ${String(index + 1).padStart(2, '0')}`,
    code: `AUTO-${String(index + 1).padStart(2, '0')}`,
    capacity: classRecord.capacity ?? null,
    class_id: classRecord.id,
    active: true,
  }));
  const { data, error } = await supabase
    .from('rooms')
    .insert(roomPayload)
    .select('id, institution_id, active, class_id');
  if (error) throw error;

  return {
    rooms: (data ?? []).map((room) => ({
      id: room.id,
      institution_id: room.institution_id,
      active: room.active,
      class_id: room.class_id,
    })),
    created: data?.length ?? 0,
  };
}

async function prepareAutomaticTimeSlots(input: {
  institutionId: string;
  classes: Array<{ id: string; shift: string | null }>;
  curriculumItems: Array<{ class_id: string; weekly_lessons: number }>;
  slots: Array<{ id: string; institution_id: string; shift: string; day_of_week: number; slot_number: number; start_time: string; end_time: string; active: boolean }>;
  breaks: Array<{ shift: string; day_of_week: number; start_time: string; end_time: string; active: boolean }>;
}): Promise<{ slots: Array<{ id: string; institution_id: string; shift: string; day_of_week: number; slot_number: number; start_time: string; end_time: string; active: boolean }>; created: number }> {
  const requiredShifts = [...new Set(input.classes.map((classRecord) => normalizeAcademicShift(classRecord.shift?.trim() || 'MATUTINO')))];
  const classShifts = new Map(input.classes.map((classRecord) => [classRecord.id, normalizeAcademicShift(classRecord.shift?.trim() || 'MATUTINO')]));
  const weeklyLoadByShift = new Map<string, number>();
  for (const [classId, shift] of classShifts) {
    const weeklyLoad = input.curriculumItems
      .filter((item) => item.class_id === classId)
      .reduce((total, item) => total + Math.max(0, item.weekly_lessons), 0);
    weeklyLoadByShift.set(shift, Math.max(weeklyLoadByShift.get(shift) ?? 0, weeklyLoad));
  }
  const slotsPerDayByShift = Object.fromEntries(requiredShifts.map((shift) => [
    shift,
    Math.max(
      shift === 'INTEGRAL' ? 8 : 5,
      Math.ceil((weeklyLoadByShift.get(shift) ?? 0) / 5),
    ),
  ]));
  const targetSlots = buildDefaultTimeSlots(requiredShifts, slotsPerDayByShift).filter(
    (slot) =>
      !input.breaks.some(
        (scheduleBreak) =>
          scheduleBreak.active &&
          normalizeAcademicShift(scheduleBreak.shift) === normalizeAcademicShift(slot.shift) &&
          scheduleBreak.day_of_week === slot.day_of_week &&
          overlapsTime(
            slot.start_time,
            slot.end_time,
            scheduleBreak.start_time,
            scheduleBreak.end_time,
          ),
      ),
  );
  const existingPositions = new Set(input.slots.map((slot) => `${normalizeAcademicShift(slot.shift)}:${slot.day_of_week}:${slot.slot_number}`));
  const defaults = targetSlots.filter((slot) => !existingPositions.has(`${normalizeAcademicShift(slot.shift)}:${slot.day_of_week}:${slot.slot_number}`));
  if (defaults.length === 0) return { slots: input.slots, created: 0 };

  const { error } = await supabase.from('school_time_slots').upsert(defaults.map((slot) => ({
    institution_id: input.institutionId,
    shift: slot.shift,
    day_of_week: slot.day_of_week,
    slot_number: slot.slot_number,
    start_time: slot.start_time,
    end_time: slot.end_time,
    active: true,
  })), { onConflict: 'institution_id,shift,day_of_week,slot_number' });
  if (error) throw error;

  const generatedRows = defaults.map((slot, index) => ({
    id: `automatic-${slot.shift}-${slot.day_of_week}-${index + 1}`,
    institution_id: input.institutionId,
    shift: slot.shift,
    day_of_week: slot.day_of_week,
    slot_number: slot.slot_number,
    start_time: slot.start_time,
    end_time: slot.end_time,
    active: true,
  }));
  return { slots: [...input.slots, ...generatedRows], created: generatedRows.length };
}

export const timetableAutomationService = {
  async listVersions(institutionId: string, academicYearId?: string): Promise<TimetableVersionRow[]> {
    let query = supabase.from('timetable_versions').select('id, institution_id, academic_year_id, name, status, generation_source, created_at, published_at').eq('institution_id', institutionId).order('created_at', { ascending: false });
    if (academicYearId) query = query.eq('academic_year_id', academicYearId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as TimetableVersionRow[];
  },

  async listVersionEntries(
    versionId: string,
    institutionId: string,
  ): Promise<TimetableVersionEntryRow[]> {
    const { data, error } = await supabase
      .from('timetable_version_entries')
      .select('id, version_id, institution_id, academic_year_id, term_id, class_id, subject_offering_id, room_id, day_of_week, start_time, end_time, locked, active')
      .eq('version_id', versionId)
      .eq('institution_id', institutionId)
      .order('class_id')
      .order('day_of_week')
      .order('start_time');

    if (error) throw error;

    const rows = (data ?? []) as Array<{
      id: string;
      version_id: string;
      institution_id: string;
      academic_year_id: string;
      term_id: string;
      class_id: string;
      subject_offering_id: string;
      room_id: string | null;
      day_of_week: number;
      start_time: string;
      end_time: string;
      locked: boolean;
      active: boolean;
    }>;
    const classIds = [...new Set(rows.map((row) => row.class_id))];
    const offeringIds = [...new Set(rows.map((row) => row.subject_offering_id))];
    const termIds = [...new Set(rows.map((row) => row.term_id))];

    const [classesResult, offeringsResult, termsResult] = await Promise.all([
      classIds.length > 0
        ? supabase
          .from('classes')
          .select('id, name, shift')
          .eq('institution_id', institutionId)
          .in('id', classIds)
        : Promise.resolve({ data: [], error: null }),
      offeringIds.length > 0
        ? supabase
          .from('subject_offerings')
          .select('id, subject_id, teacher_profile_id')
          .in('id', offeringIds)
        : Promise.resolve({ data: [], error: null }),
      termIds.length > 0
        ? supabase
          .from('terms')
          .select('id, name')
          .in('id', termIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesResult.error) throw classesResult.error;
    if (offeringsResult.error) throw offeringsResult.error;
    if (termsResult.error) throw termsResult.error;

    const offerings = (offeringsResult.data ?? []) as Array<{
      id: string;
      subject_id: string;
      teacher_profile_id: string;
    }>;
    const subjectIds = [...new Set(offerings.map((offering) => offering.subject_id))];
    const teacherIds = [...new Set(offerings.map((offering) => offering.teacher_profile_id))];
    const [subjectsResult, teachersResult] = await Promise.all([
      subjectIds.length > 0
        ? supabase
          .from('subjects')
          .select('id, name')
          .eq('institution_id', institutionId)
          .in('id', subjectIds)
        : Promise.resolve({ data: [], error: null }),
      teacherIds.length > 0
        ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', teacherIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (subjectsResult.error) throw subjectsResult.error;
    if (teachersResult.error) throw teachersResult.error;

    const classNames = new Map(
      (classesResult.data ?? []).map((row) => [row.id, row.name]),
    );
    const classShifts = new Map(
      (classesResult.data ?? []).map((row) => [row.id, row.shift]),
    );
    const subjectNames = new Map(
      (subjectsResult.data ?? []).map((row) => [row.id, row.name]),
    );
    const teacherNames = new Map(
      (teachersResult.data ?? []).map((row) => [row.id, row.full_name]),
    );
    const termNames = new Map(
      (termsResult.data ?? []).map((row) => [row.id, row.name]),
    );
    const offeringsById = new Map(offerings.map((offering) => [offering.id, offering]));

    return rows.map((row) => {
      const offering = offeringsById.get(row.subject_offering_id);
      return {
        id: String(row.id),
        version_id: String(row.version_id),
        institution_id: String(row.institution_id),
        academic_year_id: String(row.academic_year_id),
        term_id: String(row.term_id),
        term_name: termNames.get(row.term_id) ?? 'Período',
        class_id: String(row.class_id),
        class_name: classNames.get(row.class_id) ?? 'Turma',
        class_shift: classShifts.get(row.class_id) ?? null,
        subject_offering_id: String(row.subject_offering_id),
        subject_name: subjectNames.get(offering?.subject_id ?? '') ?? 'Matéria',
        teacher_profile_id: offering?.teacher_profile_id ?? '',
        teacher_name: teacherNames.get(offering?.teacher_profile_id ?? '') ?? null,
        room_id: row.room_id ? String(row.room_id) : null,
        day_of_week: Number(row.day_of_week),
        start_time: String(row.start_time),
        end_time: String(row.end_time),
        locked: row.locked === true,
        active: row.active !== false,
      };
    });
  },

  async updateVersionEntry(input: {
    id: string;
    versionId: string;
    institutionId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    locked: boolean;
  }): Promise<void> {
    if (
      input.dayOfWeek < 1 ||
      input.dayOfWeek > 6 ||
      input.startTime >= input.endTime
    ) {
      throw new Error('O horário informado é inválido.');
    }

    const { data: version, error: versionError } = await supabase
      .from('timetable_versions')
      .select('status')
      .eq('id', input.versionId)
      .eq('institution_id', input.institutionId)
      .maybeSingle();
    if (versionError) throw versionError;
    if (!version || version.status !== 'DRAFT') {
      throw new Error('Somente uma grade em rascunho pode ser editada.');
    }

    const { error } = await supabase
      .from('timetable_version_entries')
      .update({
        day_of_week: input.dayOfWeek,
        start_time: input.startTime,
        end_time: input.endTime,
        locked: input.locked,
      })
      .eq('id', input.id)
      .eq('version_id', input.versionId)
      .eq('institution_id', input.institutionId);

    if (error) throw error;
  },

  async deleteVersion(versionId: string, institutionId: string): Promise<void> {
    const { data: version, error: versionError } = await supabase
      .from('timetable_versions')
      .select('id, status')
      .eq('id', versionId)
      .eq('institution_id', institutionId)
      .maybeSingle();
    if (versionError) throw versionError;
    if (!version) throw new Error('A proposta não foi encontrada. Atualize a lista e tente novamente.');
    if (version.status !== 'DRAFT') {
      throw new Error('Somente propostas em rascunho podem ser excluídas.');
    }

    const { error } = await supabase.rpc('delete_timetable_draft', {
      p_version_id: versionId,
    });
    if (error) throw error;
  },

  async generateDraft(input: { institutionId: string; academicYearId: string; createdBy: string; shift?: string; seed?: string; name?: string; sourceVersionId?: string }): Promise<GeneratedDraft> {
    const [termsResult, classesResult, curriculumResult, offeringsResult, skillsResult, availabilityResult, slotsResult, roomsResult, subjectsResult, scheduleBreaks, enabledShifts] = await Promise.all([
      supabase.from('terms').select('id, academic_year_id, start_date, end_date').eq('academic_year_id', input.academicYearId).eq('active', true),
      supabase.from('classes').select('id, institution_id, academic_year_id, name, shift').eq('institution_id', input.institutionId).eq('academic_year_id', input.academicYearId).eq('active', true),
      supabase.from('class_curriculum_items').select('class_id, subject_id, weekly_lessons, lesson_duration_minutes').eq('institution_id', input.institutionId).eq('active', true),
      listActiveOfferings(input.institutionId),
      supabase.from('teacher_subjects').select('institution_id, teacher_profile_id, subject_id, active').eq('institution_id', input.institutionId),
      supabase.from('teacher_availability').select('institution_id, teacher_profile_id, day_of_week, start_time, end_time, active').eq('institution_id', input.institutionId).eq('active', true),
      supabase.from('school_time_slots').select('id, institution_id, shift, day_of_week, slot_number, start_time, end_time, active').eq('institution_id', input.institutionId).eq('active', true),
      supabase.from('rooms').select('id, institution_id, active, class_id').eq('institution_id', input.institutionId).eq('active', true),
      supabase.from('subjects').select('id, name').eq('institution_id', input.institutionId),
      listScheduleBreaksForGenerator(input.institutionId),
      academicShiftSettingsService.getEnabledShifts(input.institutionId),
    ]);
    const failed = [termsResult, classesResult, curriculumResult, skillsResult, availabilityResult, slotsResult, roomsResult, subjectsResult].find((result) => result.error);
    if (failed?.error) throw failed.error;

    const selectedShift = input.shift && input.shift !== 'TODOS'
      ? normalizeAcademicShift(input.shift)
      : null;
    const classes = (classesResult.data ?? []).filter((classRecord) =>
      !selectedShift || normalizeAcademicShift(classRecord.shift?.trim() || 'MATUTINO') === selectedShift,
    );
    if (classes.length === 0) {
      throw new Error('Nenhuma turma encontrada para o turno selecionado.');
    }
    const curriculumItems = curriculumResult.data ?? [];
    const termIds = (termsResult.data ?? []).map((term) => term.id);
    const seed = input.seed ?? `${input.institutionId}:${input.academicYearId}`;
    const setupDiagnostics = buildSetupDiagnostics({
      termIds,
      classes: classes.map((classRecord) => ({ id: classRecord.id, name: classRecord.name, shift: classRecord.shift })),
      curriculumItems: curriculumItems.map((item) => ({ class_id: item.class_id, weekly_lessons: item.weekly_lessons })),
      enabledShifts,
    });
    if (setupDiagnostics.length > 0) return buildInvalidDraft(setupDiagnostics, seed);

    const automaticAssignments = await prepareAutomaticAssignments({
      institutionId: input.institutionId,
      academicYearId: input.academicYearId,
      classes,
      curriculumItems,
      offerings: offeringsResult,
      teacherSubjects: skillsResult.data ?? [],
      termIds,
    });
    const automaticRooms = await prepareAutomaticRooms({
      institutionId: input.institutionId,
      classes: classes.map((classRecord) => ({ id: classRecord.id, name: classRecord.name, capacity: null })),
      rooms: roomsResult.data ?? [],
    });
    const automaticSlots = await prepareAutomaticTimeSlots({
      institutionId: input.institutionId,
      classes,
      curriculumItems,
      slots: slotsResult.data ?? [],
      breaks: scheduleBreaks,
    });

    let lockedEntries = undefined;
    if (input.sourceVersionId) {
      let lockedQuery = supabase
        .from('timetable_version_entries')
        .select('institution_id, academic_year_id, term_id, class_id, subject_offering_id, room_id, day_of_week, start_time, end_time, locked, subject_offerings:subject_offering_id(subject_id, teacher_profile_id)')
        .eq('version_id', input.sourceVersionId)
        .eq('institution_id', input.institutionId)
        .eq('locked', true)
        .eq('active', true);
      if (selectedShift) {
        lockedQuery = lockedQuery.in('class_id', classes.map((classRecord) => classRecord.id));
      }
      const lockedResult = await lockedQuery;

      if (lockedResult.error) throw lockedResult.error;
      lockedEntries = (lockedResult.data ?? []).map((entry) => {
        const offering = Array.isArray(entry.subject_offerings)
          ? entry.subject_offerings[0]
          : entry.subject_offerings;
        return {
          institutionId: entry.institution_id,
          academicYearId: entry.academic_year_id,
          termId: entry.term_id,
          classId: entry.class_id,
          subjectOfferingId: entry.subject_offering_id,
          teacherProfileId: offering?.teacher_profile_id ?? '',
          subjectId: offering?.subject_id ?? '',
          roomId: entry.room_id,
          dayOfWeek: entry.day_of_week,
          startTime: entry.start_time,
          endTime: entry.end_time,
          locked: true,
        };
      });
    }

    const result = generateTimetable({
      institutionId: input.institutionId,
      academicYearId: input.academicYearId,
      terms: (termsResult.data ?? []).map((term) => ({ id: term.id, academicYearId: term.academic_year_id, startDate: term.start_date, endDate: term.end_date })),
      classes: classes.map((item) => ({ id: item.id, institutionId: item.institution_id, academicYearId: item.academic_year_id, name: item.name, shift: item.shift })),
      curriculumItems: curriculumItems.map((item) => ({ classId: item.class_id, subjectId: item.subject_id, weeklyLessons: item.weekly_lessons, lessonDurationMinutes: item.lesson_duration_minutes })),
      subjectOfferings: automaticAssignments.offerings.map((item) => ({ id: item.id, institutionId: input.institutionId, classId: item.class_id, subjectId: item.subject_id, teacherProfileId: item.teacher_profile_id, termId: item.term_id })),
      teacherSubjects: (skillsResult.data ?? []).map((item) => ({ institutionId: item.institution_id, teacherProfileId: item.teacher_profile_id, subjectId: item.subject_id, active: item.active })),
      teacherAvailability: (availabilityResult.data ?? []).map((item) => ({ institutionId: item.institution_id, teacherProfileId: item.teacher_profile_id, dayOfWeek: item.day_of_week, startTime: item.start_time, endTime: item.end_time, active: item.active })),
      schoolTimeSlots: automaticSlots.slots.map((item) => ({ id: item.id, institutionId: item.institution_id, shift: item.shift, dayOfWeek: item.day_of_week, slotNumber: item.slot_number, startTime: item.start_time, endTime: item.end_time, active: item.active })),
      schoolScheduleBreaks: scheduleBreaks.map((item): GeneratorScheduleBreak => ({ institutionId: item.institution_id, shift: item.shift, dayOfWeek: item.day_of_week, name: item.name, startTime: item.start_time, endTime: item.end_time, active: item.active })),
      rooms: automaticRooms.rooms.map((item) => ({ id: item.id, institutionId: item.institution_id, classId: item.class_id, active: item.active })),
      subjectLabels: Object.fromEntries((subjectsResult.data ?? []).map((subject) => [subject.id, subject.name])),
      lockedEntries,
      requireWeekdayCoverage: true,
      seed,
    });
    const preparedResult = {
      ...result,
      automaticAssignmentsCreated: automaticAssignments.created,
      automaticRoomsCreated: automaticRooms.created,
      automaticSlotsCreated: automaticSlots.created,
      automaticUnassigned: automaticAssignments.unassigned,
    };
    if (!result.valid) return preparedResult;

    const { data: version, error: versionError } = await supabase.from('timetable_versions').insert({ institution_id: input.institutionId, academic_year_id: input.academicYearId, name: input.name ?? `Proposta ${new Date().toLocaleDateString('pt-BR')}`, status: 'DRAFT', generation_source: 'DETERMINISTIC_GENERATOR', created_by: input.createdBy, source_version_id: input.sourceVersionId ?? null }).select('id').single();
    if (versionError) throw versionError;
    const { error: entriesError } = await supabase.from('timetable_version_entries').insert(result.entries.map((entry) => ({ version_id: version.id, institution_id: entry.institutionId, academic_year_id: entry.academicYearId, term_id: entry.termId, class_id: entry.classId, subject_offering_id: entry.subjectOfferingId, room_id: entry.roomId, day_of_week: entry.dayOfWeek, start_time: entry.startTime, end_time: entry.endTime, locked: entry.locked, active: true })));
    if (entriesError) throw entriesError;
    return { ...preparedResult, versionId: version.id };
  },

  async publishVersion(versionId: string): Promise<void> {
    const { error } = await supabase.rpc('publish_timetable_version', { p_version_id: versionId });
    if (error) throw error;
  },
};
