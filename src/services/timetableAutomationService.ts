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
import {
  buildTimetablePreparationReport,
  type TimetablePreparationReport,
} from '../lib/academic/timetablePreparation';
import type { TimetablePolicySettings } from '../lib/academic/timetablePolicy';
import { academicPolicyService } from './academicPolicyService';
import { academicShiftSettingsService } from './academicShiftSettingsService';

export interface TimetableVersionRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  generation_source: string;
  generation_shift?: string | null;
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

export type { TimetablePreparationReport };

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

function preparationDiagnostics(report: TimetablePreparationReport): GeneratorDiagnostic[] {
  return report.blockers.map((blocker) => ({
    code: blocker.code,
    message: blocker.message,
    classId: report.classes.find((classRecord) => blocker.message.startsWith(classRecord.name))?.id,
    suggestions: [blocker.action],
  }));
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

async function listTeacherAvailability(
  institutionId: string,
  activeOnly = false,
) {
  const pageSize = 1000;
  const availability: Array<{
    institution_id: string;
    teacher_profile_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    active: boolean;
  }> = [];

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from('teacher_availability')
      .select('institution_id, teacher_profile_id, day_of_week, start_time, end_time, active')
      .eq('institution_id', institutionId);

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query.range(
      offset,
      offset + pageSize - 1,
    );

    if (error) throw error;

    availability.push(...((data ?? []) as typeof availability));

    if (!data || data.length < pageSize) break;
  }

  return availability;
}

async function prepareAutomaticAssignments(input: {
  institutionId: string;
  academicYearId: string;
  classes: Array<{ id: string; institution_id: string; academic_year_id: string; name: string; shift: string | null }>;
  curriculumItems: Array<{ class_id: string; subject_id: string; weekly_lessons: number; lesson_duration_minutes: number }>;
  offerings: Array<{ id: string; class_id: string; subject_id: string; teacher_profile_id: string; term_id: string }>;
  teacherSubjects: Array<{ institution_id: string; teacher_profile_id: string; subject_id: string; active: boolean }>;
  termIds: string[];
}): Promise<{ offerings: Array<{ id: string; class_id: string; subject_id: string; teacher_profile_id: string; term_id: string }>; created: number; unassigned: number; createdOfferingIds: string[] }> {
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

  const offerings = created > 0 ? await listActiveOfferings(input.institutionId) : input.offerings;
  const existingOfferingIds = new Set(input.offerings.map((offering) => offering.id));
  return {
    offerings,
    created,
    unassigned: plan.unassigned.length,
    createdOfferingIds: offerings.filter((offering) => !existingOfferingIds.has(offering.id)).map((offering) => offering.id),
  };
}

async function prepareAutomaticRooms(input: {
  institutionId: string;
  classes: Array<{ id: string; name: string; capacity?: number | null }>;
  rooms: Array<{ id: string; institution_id: string; active: boolean; class_id?: string | null; capacity?: number | null }>;
  requireRoomForGeneration: boolean;
  allowSharedRooms: boolean;
}): Promise<{ rooms: Array<{ id: string; institution_id: string; active: boolean; class_id?: string | null; capacity?: number | null }>; created: number; createdRoomIds: string[] }> {
  if (input.classes.length === 0 || (!input.requireRoomForGeneration && input.rooms.length > 0)) return { rooms: input.rooms, created: 0, createdRoomIds: [] };

  const assignedClassIds = new Set(input.rooms.filter((room) => room.class_id).map((room) => room.class_id));
  const hasSharedRoom = input.rooms.some((room) => !room.class_id);
  const classesToCreate = input.classes.filter((classRecord) =>
    !assignedClassIds.has(classRecord.id) && (!input.allowSharedRooms || !hasSharedRoom),
  );
  if (classesToCreate.length === 0) return { rooms: input.rooms, created: 0, createdRoomIds: [] };

  const roomPayload = classesToCreate.map((classRecord, index) => ({
    institution_id: input.institutionId,
    name: `Sala ${String(input.rooms.length + index + 1).padStart(2, '0')}`,
    code: `AUTO-${String(input.rooms.length + index + 1).padStart(2, '0')}`,
    capacity: classRecord.capacity ?? null,
    class_id: classRecord.id,
    active: true,
  }));
  const { data, error } = await supabase
    .from('rooms')
    .insert(roomPayload)
    .select('id, institution_id, active, class_id, capacity');
  if (error) throw error;

  return {
    rooms: [...input.rooms, ...(data ?? []).map((room) => ({
      id: room.id,
      institution_id: room.institution_id,
      active: room.active,
      class_id: room.class_id,
      capacity: room.capacity,
    }))],
    created: data?.length ?? 0,
    createdRoomIds: (data ?? []).map((room) => room.id),
  };
}

async function prepareAutomaticTimeSlots(input: {
  institutionId: string;
  classes: Array<{ id: string; shift: string | null }>;
  curriculumItems: Array<{ class_id: string; weekly_lessons: number }>;
  schoolDays: number[];
  slots: Array<{ id: string; institution_id: string; shift: string; day_of_week: number; slot_number: number; start_time: string; end_time: string; active: boolean }>;
  breaks: Array<{ shift: string; day_of_week: number; start_time: string; end_time: string; active: boolean }>;
}): Promise<{ slots: Array<{ id: string; institution_id: string; shift: string; day_of_week: number; slot_number: number; start_time: string; end_time: string; active: boolean }>; created: number; createdSlotIds: string[] }> {
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
      Math.ceil((weeklyLoadByShift.get(shift) ?? 0) / Math.max(1, input.schoolDays.length)),
    ),
  ]));
  const targetSlots = buildDefaultTimeSlots(requiredShifts, slotsPerDayByShift, input.schoolDays).filter(
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
  if (defaults.length === 0) return { slots: input.slots, created: 0, createdSlotIds: [] };

  const { data: savedRows, error } = await supabase.from('school_time_slots').upsert(defaults.map((slot) => ({
    institution_id: input.institutionId,
    shift: slot.shift,
    day_of_week: slot.day_of_week,
    slot_number: slot.slot_number,
    start_time: slot.start_time,
    end_time: slot.end_time,
    active: true,
  })), { onConflict: 'institution_id,shift,day_of_week,slot_number' }).select('id, institution_id, shift, day_of_week, slot_number, start_time, end_time, active');
  if (error) throw error;

  const rowsByPosition = new Map((savedRows ?? []).map((row) => [
    `${normalizeAcademicShift(row.shift)}:${row.day_of_week}:${row.slot_number}`,
    row,
  ]));
  const generatedRows = defaults.map((slot, index) => rowsByPosition.get(`${normalizeAcademicShift(slot.shift)}:${slot.day_of_week}:${slot.slot_number}`) ?? {
    id: `automatic-${slot.shift}-${slot.day_of_week}-${index + 1}`,
    institution_id: input.institutionId,
    shift: slot.shift,
    day_of_week: slot.day_of_week,
    slot_number: slot.slot_number,
    start_time: slot.start_time,
    end_time: slot.end_time,
    active: true,
  });
  const savedIds = (savedRows ?? []).map((row) => row.id);
  return { slots: [...input.slots, ...generatedRows], created: generatedRows.length, createdSlotIds: savedIds };
}

async function rollbackAutomaticPreparation(input: {
  institutionId: string;
  offeringIds: string[];
  roomIds: string[];
  slotIds: string[];
}): Promise<void> {
  const operations: Promise<unknown>[] = [];
  if (input.offeringIds.length > 0) {
    operations.push(Promise.resolve(
      supabase
        .from('subject_offerings')
        .update({ active: false })
        .in('id', input.offeringIds),
    ));
  }
  if (input.roomIds.length > 0) {
    operations.push(Promise.resolve(
      supabase
        .from('rooms')
        .update({ active: false })
        .eq('institution_id', input.institutionId)
        .in('id', input.roomIds),
    ));
  }
  if (input.slotIds.length > 0) {
    operations.push(Promise.resolve(
      supabase
        .from('school_time_slots')
        .update({ active: false })
        .eq('institution_id', input.institutionId)
        .in('id', input.slotIds),
    ));
  }
  const results = await Promise.all(operations);
  const failed = results.find((result) => result && typeof result === 'object' && 'error' in result && result.error);
  if (failed && typeof failed === 'object' && 'error' in failed && failed.error) {
    throw failed.error;
  }
}

export const timetableAutomationService = {
  async getPreparationReport(input: {
    institutionId: string;
    academicYearId: string;
    shift?: string;
  }): Promise<TimetablePreparationReport> {
    const [policy, termsResult, classesResult, enrollmentsResult, curriculumResult, offerings, skillsResult, availability, slotsResult, scheduleBreaks, roomsResult, enabledShifts] = await Promise.all([
      academicPolicyService.getActivePolicy(input.institutionId, input.academicYearId),
      supabase.from('terms').select('id, active').eq('academic_year_id', input.academicYearId),
      supabase.from('classes').select('id, name, shift, capacity, active, academic_year_id').eq('institution_id', input.institutionId).eq('academic_year_id', input.academicYearId),
      supabase.from('enrollments').select('class_id, academic_year_id, active, status').eq('academic_year_id', input.academicYearId),
      supabase.from('class_curriculum_items').select('class_id, subject_id, weekly_lessons, active').eq('institution_id', input.institutionId),
      listActiveOfferings(input.institutionId),
      supabase.from('teacher_subjects').select('teacher_profile_id, subject_id, active').eq('institution_id', input.institutionId),
      listTeacherAvailability(input.institutionId),
      supabase.from('school_time_slots').select('shift, day_of_week, start_time, end_time, active').eq('institution_id', input.institutionId),
      listScheduleBreaksForGenerator(input.institutionId),
      supabase.from('rooms').select('id, class_id, capacity, active').eq('institution_id', input.institutionId),
      academicShiftSettingsService.getEnabledShifts(input.institutionId),
    ]);
    const failed = [termsResult, classesResult, enrollmentsResult, curriculumResult, skillsResult, slotsResult, roomsResult].find((result) => result.error);
    if (failed?.error) throw failed.error;

    return buildTimetablePreparationReport({
      institutionId: input.institutionId,
      academicYearId: input.academicYearId,
      shift: input.shift,
      policy: policy?.timetable as Partial<TimetablePolicySettings> | undefined,
      enabledShifts,
      terms: (termsResult.data ?? []) as Array<{ id: string; active?: boolean | null }>,
      classes: (classesResult.data ?? []) as Array<{ id: string; name: string; shift: string | null; capacity: number; active?: boolean | null; academic_year_id?: string }>,
      enrollments: (enrollmentsResult.data ?? []) as Array<{ class_id: string; academic_year_id: string; active?: boolean | null; status?: string | null }>,
      curriculumItems: (curriculumResult.data ?? []) as Array<{ class_id: string; subject_id: string; weekly_lessons: number; active?: boolean | null }>,
      offerings: offerings.map((offering) => ({ ...offering, active: true })),
      teacherSubjects: (skillsResult.data ?? []) as Array<{ teacher_profile_id: string; subject_id: string; active?: boolean | null }>,
      teacherAvailability: availability,
      slots: (slotsResult.data ?? []) as Array<{ shift: string; day_of_week: number; start_time: string; end_time: string; active?: boolean | null }>,
      breaks: scheduleBreaks,
      rooms: (roomsResult.data ?? []) as Array<{ id: string; class_id?: string | null; capacity?: number | null; active?: boolean | null }>,
    });
  },

  async listVersions(institutionId: string, academicYearId?: string): Promise<TimetableVersionRow[]> {
    let query = supabase.from('timetable_versions').select('id, institution_id, academic_year_id, name, status, generation_source, generation_shift, created_at, published_at').eq('institution_id', institutionId).order('created_at', { ascending: false });
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
    const preparationReport = await this.getPreparationReport(input);
    const seed = input.seed ?? `${input.institutionId}:${input.academicYearId}`;
    if (!preparationReport.ready) {
      return buildInvalidDraft(preparationDiagnostics(preparationReport), seed);
    }

    const [termsResult, classesResult, curriculumResult, offeringsResult, skillsResult, availability, slotsResult, roomsResult, subjectsResult, scheduleBreaks, enabledShifts] = await Promise.all([
      supabase.from('terms').select('id, academic_year_id, start_date, end_date').eq('academic_year_id', input.academicYearId).eq('active', true),
      supabase.from('classes').select('id, institution_id, academic_year_id, name, shift, capacity').eq('institution_id', input.institutionId).eq('academic_year_id', input.academicYearId).eq('active', true),
      supabase.from('class_curriculum_items').select('class_id, subject_id, weekly_lessons, lesson_duration_minutes').eq('institution_id', input.institutionId).eq('active', true),
      listActiveOfferings(input.institutionId),
      supabase.from('teacher_subjects').select('institution_id, teacher_profile_id, subject_id, active').eq('institution_id', input.institutionId),
      listTeacherAvailability(input.institutionId, true),
      supabase.from('school_time_slots').select('id, institution_id, shift, day_of_week, slot_number, start_time, end_time, active').eq('institution_id', input.institutionId).eq('active', true),
      supabase.from('rooms').select('id, institution_id, active, class_id, capacity').eq('institution_id', input.institutionId).eq('active', true),
      supabase.from('subjects').select('id, name').eq('institution_id', input.institutionId),
      listScheduleBreaksForGenerator(input.institutionId),
      academicShiftSettingsService.getEnabledShifts(input.institutionId),
    ]);
    const failed = [termsResult, classesResult, curriculumResult, skillsResult, slotsResult, roomsResult, subjectsResult].find((result) => result.error);
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
    const setupDiagnostics = buildSetupDiagnostics({
      termIds,
      classes: classes.map((classRecord) => ({ id: classRecord.id, name: classRecord.name, shift: classRecord.shift })),
      curriculumItems: curriculumItems.map((item) => ({ class_id: item.class_id, weekly_lessons: item.weekly_lessons })),
      enabledShifts,
    });
    if (setupDiagnostics.length > 0) return buildInvalidDraft(setupDiagnostics, seed);

    const rollbackState = {
      offeringIds: [] as string[],
      roomIds: [] as string[],
      slotIds: [] as string[],
    };

    try {
    const automaticAssignments = await prepareAutomaticAssignments({
      institutionId: input.institutionId,
      academicYearId: input.academicYearId,
      classes,
      curriculumItems,
      offerings: offeringsResult,
      teacherSubjects: skillsResult.data ?? [],
      termIds,
    });
    rollbackState.offeringIds = automaticAssignments.createdOfferingIds;
    const automaticRooms = await prepareAutomaticRooms({
      institutionId: input.institutionId,
      classes: classes.map((classRecord) => ({ id: classRecord.id, name: classRecord.name, capacity: classRecord.capacity })),
      rooms: roomsResult.data ?? [],
      requireRoomForGeneration: preparationReport.policy.requireRoomForGeneration,
      allowSharedRooms: preparationReport.policy.allowSharedRooms,
    });
    rollbackState.roomIds = automaticRooms.createdRoomIds;
    const automaticSlots = await prepareAutomaticTimeSlots({
      institutionId: input.institutionId,
      classes,
      curriculumItems,
      slots: slotsResult.data ?? [],
      schoolDays: preparationReport.policy.schoolDays,
      breaks: scheduleBreaks,
    });
    rollbackState.slotIds = automaticSlots.createdSlotIds;

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
      classes: classes.map((item) => ({ id: item.id, institutionId: item.institution_id, academicYearId: item.academic_year_id, name: item.name, shift: item.shift, studentCount: preparationReport.classes.find((classRecord) => classRecord.id === item.id)?.students ?? 0 })),
      curriculumItems: curriculumItems.map((item) => ({ classId: item.class_id, subjectId: item.subject_id, weeklyLessons: item.weekly_lessons, lessonDurationMinutes: item.lesson_duration_minutes })),
      subjectOfferings: automaticAssignments.offerings.map((item) => ({ id: item.id, institutionId: input.institutionId, classId: item.class_id, subjectId: item.subject_id, teacherProfileId: item.teacher_profile_id, termId: item.term_id })),
      teacherSubjects: (skillsResult.data ?? []).map((item) => ({ institutionId: item.institution_id, teacherProfileId: item.teacher_profile_id, subjectId: item.subject_id, active: item.active })),
      teacherAvailability: availability.map((item) => ({ institutionId: item.institution_id, teacherProfileId: item.teacher_profile_id, dayOfWeek: item.day_of_week, startTime: item.start_time, endTime: item.end_time, active: item.active })),
      schoolTimeSlots: automaticSlots.slots.map((item) => ({ id: item.id, institutionId: item.institution_id, shift: item.shift, dayOfWeek: item.day_of_week, slotNumber: item.slot_number, startTime: item.start_time, endTime: item.end_time, active: item.active })),
      schoolScheduleBreaks: scheduleBreaks.map((item): GeneratorScheduleBreak => ({ institutionId: item.institution_id, shift: item.shift, dayOfWeek: item.day_of_week, name: item.name, startTime: item.start_time, endTime: item.end_time, active: item.active })),
      rooms: automaticRooms.rooms.map((item) => ({ id: item.id, institutionId: item.institution_id, classId: item.class_id, active: item.active, capacity: item.capacity })),
      subjectLabels: Object.fromEntries((subjectsResult.data ?? []).map((subject) => [subject.id, subject.name])),
      lockedEntries,
      requireWeekdayCoverage: true,
      schoolDays: preparationReport.policy.schoolDays,
      maxLessonsPerDay: preparationReport.policy.maxLessonsPerDay,
      maxTeacherLessonsPerDay: preparationReport.policy.maxTeacherLessonsPerDay,
      maxTeacherLessonsPerWeek: preparationReport.policy.maxTeacherLessonsPerWeek,
      maxConsecutiveSubjectLessons: preparationReport.policy.maxConsecutiveSubjectLessons,
      maxSubjectLessonsPerDay: preparationReport.policy.maxSubjectLessonsPerDay,
      requireTeacherAvailability: preparationReport.policy.requireTeacherAvailability,
      requireRoomForGeneration: preparationReport.policy.requireRoomForGeneration,
      allowSharedRooms: preparationReport.policy.allowSharedRooms,
      seed,
    });
    const preparedResult = {
      ...result,
      automaticAssignmentsCreated: automaticAssignments.created,
      automaticRoomsCreated: automaticRooms.created,
      automaticSlotsCreated: automaticSlots.created,
      automaticUnassigned: automaticAssignments.unassigned,
    };
    if (!result.valid) {
      await rollbackAutomaticPreparation({ institutionId: input.institutionId, ...rollbackState });
      return preparedResult;
    }

    const { data: version, error: versionError } = await supabase.from('timetable_versions').insert({ institution_id: input.institutionId, academic_year_id: input.academicYearId, name: input.name ?? `Proposta ${new Date().toLocaleDateString('pt-BR')}`, status: 'DRAFT', generation_source: 'DETERMINISTIC_GENERATOR', generation_shift: input.shift && input.shift !== 'TODOS' ? normalizeAcademicShift(input.shift) : 'TODOS', created_by: input.createdBy, source_version_id: input.sourceVersionId ?? null }).select('id').single();
    if (versionError) throw versionError;
    const { error: entriesError } = await supabase.from('timetable_version_entries').insert(result.entries.map((entry) => ({ version_id: version.id, institution_id: entry.institutionId, academic_year_id: entry.academicYearId, term_id: entry.termId, class_id: entry.classId, subject_offering_id: entry.subjectOfferingId, room_id: entry.roomId, day_of_week: entry.dayOfWeek, start_time: entry.startTime, end_time: entry.endTime, locked: entry.locked, active: true })));
    if (entriesError) throw entriesError;
    return { ...preparedResult, versionId: version.id };
    } catch (error) {
      await rollbackAutomaticPreparation({ institutionId: input.institutionId, ...rollbackState });
      throw error;
    }
  },

  async publishVersion(versionId: string): Promise<void> {
    const { error } = await supabase.rpc('publish_timetable_version', { p_version_id: versionId });
    if (error) throw error;
  },
};
