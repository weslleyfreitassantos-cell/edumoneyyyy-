import { supabase } from '../lib/supabaseClient';

import {
  roomSchema,
  roomUpdateSchema,
  timetableEntrySchema,
  timetableEntryUpdateSchema,
  type RoomFormData,
  type RoomUpdateData,
  type TimetableEntryFormData,
  type TimetableEntryUpdateData,
} from '../schemas/adminSchemas';

const DAY_LABELS: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

export function dayLabel(day: number): string {
  return DAY_LABELS[day] ?? '';
}

export const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6] as const;

// --- Room Types ---

interface RoomQueryRow {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  capacity: number | null;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface RoomRow {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  capacity: number | null;
  class_id: string | null;
  class_name: string | null;
  active: boolean;
}

interface RoomQueryRow extends RoomRow {
  classes: { name: string } | { name: string }[] | null;
}

// --- Timetable Entry Types ---

interface TimetableEntryQueryRow {
  id: string;
  institution_id: string;
  subject_offering_id: string;
  room_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
  subject_offerings: {
    class_id: string;
    subject_id: string;
    teacher_profile_id: string;
    term_id: string;
    classes: { name: string; academic_year_id: string } | { name: string; academic_year_id: string }[] | null;
    subjects: { name: string } | { name: string }[] | null;
    profiles: { full_name: string } | { full_name: string }[] | null;
    terms: { academic_year_id: string } | { academic_year_id: string }[] | null;
  } | { class_id: string; subject_id: string; teacher_profile_id: string; term_id: string; classes: { name: string; academic_year_id: string } | { name: string; academic_year_id: string }[] | null; subjects: { name: string } | { name: string }[] | null; profiles: { full_name: string } | { full_name: string }[] | null; terms: { academic_year_id: string } | { academic_year_id: string }[] | null }[] | null;
  rooms: { name: string } | { name: string }[] | null;
}

export interface TimetableEntryRow {
  id: string;
  institution_id: string;
  subject_offering_id: string;
  class_id: string;
  academic_year_id: string;
  term_id: string;
  subject_id: string;
  teacher_profile_id: string;
  room_id: string | null;
  room_name: string | null;
  day_of_week: number;
  day_label: string;
  start_time: string;
  end_time: string;
  active: boolean;
  class_name: string;
  subject_name: string;
  teacher_name: string | null;
}

// --- Grid types ---

export interface TimetableSlot {
  start_time: string;
  end_time: string;
  entries: TimetableEntryRow[];
}

export interface TimetableDay {
  day: number;
  label: string;
  slots: TimetableSlot[];
}

export interface TimetableGrid {
  days: TimetableDay[];
  timeSlots: { start_time: string; end_time: string }[];
}

function normalizeRelation<T>(relation: T | T[] | null): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}

function normalizeEntry(row: TimetableEntryQueryRow): TimetableEntryRow {
  const offering = normalizeRelation(row.subject_offerings);
  const classRel = normalizeRelation(offering?.classes);
  const subjectRel = normalizeRelation(offering?.subjects);
  const profileRel = normalizeRelation(offering?.profiles);
  const roomRel = normalizeRelation(row.rooms);

  return {
    id: row.id,
    institution_id: row.institution_id,
    subject_offering_id: row.subject_offering_id,
    class_id: offering?.class_id ?? '',
    academic_year_id: normalizeRelation(offering?.terms)?.academic_year_id ?? normalizeRelation(offering?.classes)?.academic_year_id ?? '',
    term_id: offering?.term_id ?? '',
    subject_id: offering?.subject_id ?? '',
    teacher_profile_id: offering?.teacher_profile_id ?? '',
    room_id: row.room_id,
    room_name: roomRel?.name ?? null,
    day_of_week: row.day_of_week,
    day_label: dayLabel(row.day_of_week),
    start_time: row.start_time,
    end_time: row.end_time,
    active: row.active,
    class_name: classRel?.name ?? '',
    subject_name: subjectRel?.name ?? '',
    teacher_name: profileRel?.full_name ?? null,
  };
}

interface PostgrestError {
  message: string;
  details: string | null;
  hint: string | null;
  code: string;
}

function mapTimetableError(error: unknown): Error {
  let message = '';
  let details: string | null = null;
  let hint: string | null = null;
  let code = '';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const pgError = error as PostgrestError;
    message = pgError.message ?? '';
    details = pgError.details ?? null;
    hint = pgError.hint ?? null;
    code = pgError.code ?? '';
  }

  if (code === '42501' || /permission denied|row-level security policy/i.test(message)) {
    return new Error('Você não tem permissão para alterar a grade horária desta instituição.');
  }

  if (message.includes('ROOM_ALREADY_BOOKED')) return new Error('A sala já está ocupada neste horário.');
  if (message.includes('TEACHER_ALREADY_BOOKED')) return new Error('O professor já possui aula neste horário.');
  if (message.includes('CLASS_ALREADY_BOOKED')) return new Error('A turma já possui aula neste horário.');

  if (import.meta.env.DEV) {
    console.error('[Timetable]', { code, message, details, hint });
  }

  return new Error('Não foi possível concluir a operação.');
}

const entrySelect = `
  id,
  institution_id,
  subject_offering_id,
  room_id,
  day_of_week,
  start_time,
  end_time,
  active,
  created_at,
  updated_at,
  subject_offerings:subject_offering_id!inner (
    class_id,
    subject_id,
    teacher_profile_id,
    term_id,
    classes:class_id (name, academic_year_id),
    subjects:subject_id (name),
    profiles:teacher_profile_id (full_name),
    terms:term_id (academic_year_id)
  ),
  rooms:room_id (name)
`;

export const timetableService = {
  // ==================== ROOMS ====================

  async listRooms(institutionId: string): Promise<RoomRow[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, institution_id, name, code, capacity, class_id, active, classes:class_id(name)')
      .eq('institution_id', institutionId)
      .order('name', { ascending: true });

    if (error) throw mapTimetableError(error);
    return ((data ?? []) as unknown as RoomQueryRow[]).map((room) => ({
      id: room.id,
      institution_id: room.institution_id,
      name: room.name,
      code: room.code,
      capacity: room.capacity,
      class_id: room.class_id ?? null,
      class_name: normalizeRelation(room.classes)?.name ?? null,
      active: room.active,
    }));
  },

  async createRoom(input: RoomFormData): Promise<RoomRow> {
    const data = roomSchema.parse(input);
    const { data: created, error } = await supabase
      .from('rooms')
      .insert(data)
      .select()
      .single();

    if (error) throw mapTimetableError(error);
    return created as unknown as RoomRow;
  },

  async updateRoom(id: string, institutionId: string, input: RoomUpdateData): Promise<void> {
    const data = roomUpdateSchema.parse(input);
    const { error } = await supabase
      .from('rooms')
      .update(data)
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) throw mapTimetableError(error);
  },

  async setRoomActive(id: string, institutionId: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .from('rooms')
      .update({ active })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) throw mapTimetableError(error);
  },

  // ==================== TIMETABLE ENTRIES ====================

  async listEntries(institutionId: string): Promise<TimetableEntryRow[]> {
    const { data, error } = await supabase
      .from('timetable_entries')
      .select(entrySelect)
      .eq('institution_id', institutionId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw mapTimetableError(error);
    return ((data ?? []) as unknown as TimetableEntryQueryRow[])
      .filter((row) => normalizeRelation(row.subject_offerings) !== null)
      .map(normalizeEntry);
  },

  async createEntry(input: TimetableEntryFormData): Promise<TimetableEntryRow> {
    const data = timetableEntrySchema.parse(input);
    const { data: created, error } = await supabase
      .from('timetable_entries')
      .insert({
        institution_id: data.institution_id,
        subject_offering_id: data.subject_offering_id,
        room_id: data.room_id ?? null,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        active: data.active,
      })
      .select(entrySelect)
      .single();

    if (error) throw mapTimetableError(error);
    return normalizeEntry(created as unknown as TimetableEntryQueryRow);
  },

  async updateEntry(id: string, institutionId: string, input: TimetableEntryUpdateData): Promise<void> {
    const data = timetableEntryUpdateSchema.parse(input);
    const { error } = await supabase
      .from('timetable_entries')
      .update({
        subject_offering_id: data.subject_offering_id,
        room_id: data.room_id ?? null,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        active: data.active,
      })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) throw mapTimetableError(error);
  },

  async setEntryActive(id: string, institutionId: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .from('timetable_entries')
      .update({ active })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) throw mapTimetableError(error);
  },

  async listByClass(institutionId: string, classId: string, termId?: string): Promise<TimetableEntryRow[]> {
    let query = supabase
      .from('timetable_entries')
      .select(entrySelect)
      .eq('institution_id', institutionId)
      .eq('active', true)
      .eq('subject_offerings.class_id', classId);

    if (termId) {
      query = query.eq('term_id', termId);
    }

    const { data, error } = await query
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw mapTimetableError(error);

    return ((data ?? []) as unknown as TimetableEntryQueryRow[])
      .filter((row) => {
        const offering = normalizeRelation(row.subject_offerings);
        return row.active && offering?.class_id === classId;
      })
      .map(normalizeEntry);
  },

  async listByTeacher(
    institutionId: string,
    teacherProfileId: string,
    termId?: string,
  ): Promise<TimetableEntryRow[]> {
    let query = supabase
      .from('timetable_entries')
      .select(entrySelect)
      .eq('institution_id', institutionId)
      .eq('active', true)
      .eq('subject_offerings.teacher_profile_id', teacherProfileId);

    if (termId) {
      query = query.eq('term_id', termId);
    }

    const { data, error } = await query
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw mapTimetableError(error);

    return ((data ?? []) as unknown as TimetableEntryQueryRow[])
      .filter((row) => {
        const offering = normalizeRelation(row.subject_offerings);
        return row.active && offering?.teacher_profile_id === teacherProfileId;
      })
      .map(normalizeEntry);
  },

  // ==================== GRID ====================

  buildGrid(entries: TimetableEntryRow[]): TimetableGrid {
    const timeSlots: { start_time: string; end_time: string }[] = [];
    const seenTimes = new Set<string>();

    for (const entry of entries) {
      const key = `${entry.start_time}-${entry.end_time}`;
      if (!seenTimes.has(key)) {
        seenTimes.add(key);
        timeSlots.push({ start_time: entry.start_time, end_time: entry.end_time });
      }
    }

    timeSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));

    const days = DAYS_OF_WEEK.map((day) => ({
      day,
      label: dayLabel(day),
      slots: timeSlots.map((slot) => ({
        ...slot,
        entries: entries.filter(
          (e) => e.day_of_week === day && e.start_time === slot.start_time && e.end_time === slot.end_time && e.active,
        ),
      })),
    }));

    return { days, timeSlots };
  },
};
