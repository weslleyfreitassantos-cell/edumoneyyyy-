import { supabase } from '../lib/supabaseClient';
import {
  calendarDateKey,
  calendarDateToUtcStart,
  parseCalendarDate,
} from '../lib/academicCalendarDates';

export const ACADEMIC_CALENDAR_EVENT_TYPES = [
  'HOLIDAY',
  'RECESS',
  'SCHOOL_EVENT',
  'MEETING',
  'ASSESSMENT',
  'CLASS_SUSPENSION',
  'OTHER',
] as const;

export type AcademicCalendarEventType =
  (typeof ACADEMIC_CALENDAR_EVENT_TYPES)[number];

export const ACADEMIC_CALENDAR_AUDIENCES = [
  'ALL',
  'STUDENTS',
  'GUARDIANS',
  'TEACHERS',
  'STAFF',
  'CLASS',
] as const;

export type AcademicCalendarAudience =
  (typeof ACADEMIC_CALENDAR_AUDIENCES)[number];

export interface AcademicCalendarEvent {
  id: string;
  institution_id: string;
  academic_year_id: string | null;
  title: string;
  description: string | null;
  event_type: AcademicCalendarEventType;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  audience: AcademicCalendarAudience;
  class_id: string | null;
  class_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AcademicCalendarEventInput {
  institution_id: string;
  academic_year_id?: string | null;
  title: string;
  description?: string | null;
  event_type: AcademicCalendarEventType;
  starts_at: string;
  ends_at?: string | null;
  all_day: boolean;
  audience: AcademicCalendarAudience;
  class_id?: string | null;
  subject_id?: string | null;
  active?: boolean;
  created_by: string;
}

export interface AcademicCalendarEventFilters {
  eventType?: AcademicCalendarEventType | 'ALL';
  audience?: AcademicCalendarAudience | 'ALL';
  date?: string;
}

interface AcademicCalendarRelation {
  id: string;
  name: string;
}

interface AcademicCalendarQueryRow {
  id: string;
  institution_id: string;
  academic_year_id: string | null;
  title: string;
  description: string | null;
  event_type: AcademicCalendarEventType;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean | null;
  audience: AcademicCalendarAudience;
  class_id: string | null;
  subject_id: string | null;
  active: boolean | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  classes: AcademicCalendarRelation | AcademicCalendarRelation[] | null;
  subjects: AcademicCalendarRelation | AcademicCalendarRelation[] | null;
}

const EVENT_SELECT = `
  id,
  institution_id,
  academic_year_id,
  title,
  description,
  event_type,
  starts_at,
  ends_at,
  all_day,
  audience,
  class_id,
  subject_id,
  active,
  created_by,
  created_at,
  updated_at,
  classes:class_id (id, name),
  subjects:subject_id (id, name)
`;

function normalizeRelation(
  relation: AcademicCalendarRelation | AcademicCalendarRelation[] | null,
): AcademicCalendarRelation | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function normalizeRow(row: AcademicCalendarQueryRow): AcademicCalendarEvent {
  const classRelation = normalizeRelation(row.classes);
  const subjectRelation = normalizeRelation(row.subjects);

  return {
    id: row.id,
    institution_id: row.institution_id,
    academic_year_id: row.academic_year_id,
    title: row.title,
    description: row.description,
    event_type: row.event_type,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    all_day: row.all_day ?? false,
    audience: row.audience,
    class_id: row.class_id,
    class_name: classRelation?.name ?? null,
    subject_id: row.subject_id,
    subject_name: subjectRelation?.name ?? null,
    active: row.active ?? false,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toIsoOrNull(
  value: string | null | undefined,
  allDay = false,
): string | null {
  if (value === undefined || value === null || value.trim() === '') {
    return null;
  }

  if (allDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return calendarDateToUtcStart(value);
  }

  return parseCalendarDate(value).toISOString();
}

export function validateAcademicCalendarInput(
  input: AcademicCalendarEventInput,
): void {
  if (!input.institution_id || !input.created_by) {
    throw new Error('Instituição e autor são obrigatórios.');
  }

  if (!input.title.trim()) {
    throw new Error('O título do evento é obrigatório.');
  }

  if (!ACADEMIC_CALENDAR_EVENT_TYPES.includes(input.event_type)) {
    throw new Error('Selecione um tipo de evento válido.');
  }

  if (!ACADEMIC_CALENDAR_AUDIENCES.includes(input.audience)) {
    throw new Error('Selecione um público válido.');
  }

  if (!input.starts_at) {
    throw new Error('A data inicial do evento é obrigatória.');
  }

  let startsAt: number;
  try {
    startsAt = parseCalendarDate(input.starts_at).getTime();
  } catch {
    throw new Error('A data inicial do evento é obrigatória.');
  }

  const endsAt = input.ends_at
    ? (() => {
        try {
          return parseCalendarDate(input.ends_at).getTime();
        } catch {
          return Number.NaN;
        }
      })()
    : null;

  if (endsAt !== null && Number.isNaN(endsAt)) {
    throw new Error('Informe uma data final válida para o evento.');
  }

  if (endsAt !== null && endsAt < startsAt) {
    throw new Error('A data final não pode ser anterior ao início.');
  }

  if (input.audience === 'CLASS' && !input.class_id) {
    throw new Error('Selecione uma turma para este público.');
  }

  if (input.audience !== 'CLASS' && input.class_id) {
    throw new Error('A turma só pode ser informada para o público da turma.');
  }
}

function buildPayload(input: AcademicCalendarEventInput) {
  validateAcademicCalendarInput(input);

  return {
    institution_id: input.institution_id,
    academic_year_id: input.academic_year_id || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    event_type: input.event_type,
    starts_at: toIsoOrNull(input.starts_at, input.all_day),
    ends_at: toIsoOrNull(input.ends_at, input.all_day),
    all_day: input.all_day,
    audience: input.audience,
    class_id: input.class_id || null,
    subject_id: input.subject_id || null,
    active: input.active ?? true,
    created_by: input.created_by,
  };
}

function dateStart(value: string): string {
  return calendarDateToUtcStart(value);
}

function dateEnd(value: string): string {
  const end = new Date(calendarDateToUtcStart(value));
  end.setUTCDate(end.getUTCDate() + 1);
  return end.toISOString();
}

export const academicCalendarService = {
  async listForStaff(
    institutionId: string,
    filters: AcademicCalendarEventFilters = {},
  ): Promise<AcademicCalendarEvent[]> {
    let query = supabase
      .from('academic_calendar_events')
      .select(EVENT_SELECT)
      .eq('institution_id', institutionId)
      .order('starts_at', { ascending: true });

    if (filters.eventType && filters.eventType !== 'ALL') {
      query = query.eq('event_type', filters.eventType);
    }

    if (filters.audience && filters.audience !== 'ALL') {
      query = query.eq('audience', filters.audience);
    }

    if (filters.date) {
      const start = dateStart(filters.date);
      query = query
        .lt('starts_at', dateEnd(filters.date))
        .or(`ends_at.gte.${start},and(ends_at.is.null,starts_at.gte.${start})`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data ?? []) as unknown as AcademicCalendarQueryRow[]).map(normalizeRow);
  },

  async listUpcomingForAudience(
    institutionId: string,
    limit = 5,
  ): Promise<AcademicCalendarEvent[]> {
    const now = new Date().toISOString();
    const todayStart = calendarDateToUtcStart(calendarDateKey(now));
    const { data, error } = await supabase
      .from('academic_calendar_events')
      .select(EVENT_SELECT)
      .eq('institution_id', institutionId)
      .eq('active', true)
      .or(`starts_at.gte.${now},ends_at.gte.${now},and(all_day.eq.true,ends_at.gte.${todayStart})`)
      .order('starts_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return ((data ?? []) as unknown as AcademicCalendarQueryRow[]).map(normalizeRow);
  },

  async create(input: AcademicCalendarEventInput): Promise<AcademicCalendarEvent> {
    const { data, error } = await supabase
      .from('academic_calendar_events')
      .insert(buildPayload(input))
      .select(EVENT_SELECT)
      .single();

    if (error || !data) {
      throw error ?? new Error('Não foi possível criar o evento.');
    }

    return normalizeRow(data as unknown as AcademicCalendarQueryRow);
  },

  async update(
    id: string,
    institutionId: string,
    input: AcademicCalendarEventInput,
  ): Promise<AcademicCalendarEvent> {
    const updatePayload = buildPayload(input);
    delete updatePayload.created_by;

    const { data, error } = await supabase
      .from('academic_calendar_events')
      .update(updatePayload)
      .eq('id', id)
      .eq('institution_id', institutionId)
      .select(EVENT_SELECT)
      .single();

    if (error || !data) {
      throw error ?? new Error('Não foi possível atualizar o evento.');
    }

    return normalizeRow(data as unknown as AcademicCalendarQueryRow);
  },

  async setActive(
    id: string,
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from('academic_calendar_events')
      .update({ active })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) throw error;
  },
};
