import { supabase } from '../lib/supabaseClient';
import { generateTimetable, type TimetableGeneratorResult } from '../lib/academic/timetableGenerator';

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
  class_id: string;
  class_name: string;
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
      .select(`
        id,
        version_id,
        institution_id,
        academic_year_id,
        term_id,
        class_id,
        subject_offering_id,
        room_id,
        day_of_week,
        start_time,
        end_time,
        locked,
        active,
        classes:class_id (name),
        subject_offerings:subject_offering_id (
          teacher_profile_id,
          subjects:subject_id (name),
          profiles:teacher_profile_id (full_name)
        )
      `)
      .eq('version_id', versionId)
      .eq('institution_id', institutionId)
      .order('class_id')
      .order('day_of_week')
      .order('start_time');

    if (error) throw error;

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const classRelation = row.classes as { name?: string } | { name?: string }[] | null;
      const offeringRelation = row.subject_offerings as {
        teacher_profile_id?: string;
        subjects?: { name?: string } | { name?: string }[] | null;
        profiles?: { full_name?: string } | { full_name?: string }[] | null;
      } | {
        teacher_profile_id?: string;
        subjects?: { name?: string } | { name?: string }[] | null;
        profiles?: { full_name?: string } | { full_name?: string }[] | null;
      }[] | null;
      const first = <T,>(value: T | T[] | null | undefined): T | null =>
        Array.isArray(value) ? value[0] ?? null : value ?? null;
      const className = first(classRelation)?.name ?? 'Turma';
      const offering = first(offeringRelation);
      const subject = first(offering?.subjects);
      const teacher = first(offering?.profiles);

      return {
        id: String(row.id),
        version_id: String(row.version_id),
        institution_id: String(row.institution_id),
        academic_year_id: String(row.academic_year_id),
        term_id: String(row.term_id),
        class_id: String(row.class_id),
        class_name: className,
        subject_offering_id: String(row.subject_offering_id),
        subject_name: subject?.name ?? 'Matéria',
        teacher_profile_id: offering?.teacher_profile_id ?? '',
        teacher_name: teacher?.full_name ?? null,
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

  async generateDraft(input: { institutionId: string; academicYearId: string; createdBy: string; seed?: string; name?: string; sourceVersionId?: string }): Promise<GeneratedDraft> {
    const [termsResult, classesResult, curriculumResult, offeringsResult, skillsResult, availabilityResult, slotsResult, roomsResult] = await Promise.all([
      supabase.from('terms').select('id, academic_year_id, start_date, end_date').eq('academic_year_id', input.academicYearId).eq('active', true),
      supabase.from('classes').select('id, institution_id, academic_year_id, name, shift').eq('institution_id', input.institutionId).eq('academic_year_id', input.academicYearId).eq('active', true),
      supabase.from('class_curriculum_items').select('class_id, subject_id, weekly_lessons, lesson_duration_minutes').eq('institution_id', input.institutionId).eq('active', true),
      supabase.from('subject_offerings').select('id, class_id, subject_id, teacher_profile_id, term_id, classes!inner(institution_id)').eq('classes.institution_id', input.institutionId).eq('active', true),
      supabase.from('teacher_subjects').select('institution_id, teacher_profile_id, subject_id, active').eq('institution_id', input.institutionId),
      supabase.from('teacher_availability').select('institution_id, teacher_profile_id, day_of_week, start_time, end_time, active').eq('institution_id', input.institutionId).eq('active', true),
      supabase.from('school_time_slots').select('id, institution_id, shift, day_of_week, slot_number, start_time, end_time, active').eq('institution_id', input.institutionId).eq('active', true),
      supabase.from('rooms').select('id, institution_id, active').eq('institution_id', input.institutionId).eq('active', true),
    ]);
    const failed = [termsResult, classesResult, curriculumResult, offeringsResult, skillsResult, availabilityResult, slotsResult, roomsResult].find((result) => result.error);
    if (failed?.error) throw failed.error;

    let lockedEntries = undefined;
    if (input.sourceVersionId) {
      const lockedResult = await supabase
        .from('timetable_version_entries')
        .select('institution_id, academic_year_id, term_id, class_id, subject_offering_id, room_id, day_of_week, start_time, end_time, locked, subject_offerings:subject_offering_id(subject_id, teacher_profile_id)')
        .eq('version_id', input.sourceVersionId)
        .eq('institution_id', input.institutionId)
        .eq('locked', true)
        .eq('active', true);

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
      classes: (classesResult.data ?? []).map((item) => ({ id: item.id, institutionId: item.institution_id, academicYearId: item.academic_year_id, name: item.name, shift: item.shift })),
      curriculumItems: (curriculumResult.data ?? []).map((item) => ({ classId: item.class_id, subjectId: item.subject_id, weeklyLessons: item.weekly_lessons, lessonDurationMinutes: item.lesson_duration_minutes })),
      subjectOfferings: (offeringsResult.data ?? []).map((item) => ({ id: item.id, institutionId: input.institutionId, classId: item.class_id, subjectId: item.subject_id, teacherProfileId: item.teacher_profile_id, termId: item.term_id })),
      teacherSubjects: (skillsResult.data ?? []).map((item) => ({ institutionId: item.institution_id, teacherProfileId: item.teacher_profile_id, subjectId: item.subject_id, active: item.active })),
      teacherAvailability: (availabilityResult.data ?? []).map((item) => ({ institutionId: item.institution_id, teacherProfileId: item.teacher_profile_id, dayOfWeek: item.day_of_week, startTime: item.start_time, endTime: item.end_time, active: item.active })),
      schoolTimeSlots: (slotsResult.data ?? []).map((item) => ({ id: item.id, institutionId: item.institution_id, shift: item.shift, dayOfWeek: item.day_of_week, slotNumber: item.slot_number, startTime: item.start_time, endTime: item.end_time, active: item.active })),
      rooms: (roomsResult.data ?? []).map((item) => ({ id: item.id, institutionId: item.institution_id, active: item.active })),
      lockedEntries,
      seed: input.seed,
    });
    if (!result.valid) return result;

    const { data: version, error: versionError } = await supabase.from('timetable_versions').insert({ institution_id: input.institutionId, academic_year_id: input.academicYearId, name: input.name ?? `Proposta ${new Date().toLocaleDateString('pt-BR')}`, status: 'DRAFT', generation_source: 'DETERMINISTIC_GENERATOR', created_by: input.createdBy, source_version_id: input.sourceVersionId ?? null }).select('id').single();
    if (versionError) throw versionError;
    const { error: entriesError } = await supabase.from('timetable_version_entries').insert(result.entries.map((entry) => ({ version_id: version.id, institution_id: entry.institutionId, academic_year_id: entry.academicYearId, term_id: entry.termId, class_id: entry.classId, subject_offering_id: entry.subjectOfferingId, room_id: entry.roomId, day_of_week: entry.dayOfWeek, start_time: entry.startTime, end_time: entry.endTime, locked: entry.locked, active: true })));
    if (entriesError) throw entriesError;
    return { ...result, versionId: version.id };
  },

  async publishVersion(versionId: string): Promise<void> {
    const { error } = await supabase.rpc('publish_timetable_version', { p_version_id: versionId });
    if (error) throw error;
  },
};
