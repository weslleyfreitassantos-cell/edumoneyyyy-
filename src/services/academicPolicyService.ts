import { supabase } from '../lib/supabaseClient';
import {
  validateAcademicPolicyRule,
  type AcademicPolicyRule,
} from './academicCalculations';
import {
  DEFAULT_TIMETABLE_POLICY,
  normalizeTimetablePolicy,
  type TimetablePolicySettings,
} from '../lib/academic/timetablePolicy';

export type AcademicPolicyServiceErrorCode =
  | 'ACADEMIC_POLICY_NOT_CONFIGURED'
  | 'ACADEMIC_POLICY_FORBIDDEN'
  | 'ACADEMIC_POLICY_INVALID'
  | 'ACADEMIC_POLICY_SAVE_FAILED';

export class AcademicPolicyServiceError extends Error {
  readonly code: AcademicPolicyServiceErrorCode;

  readonly originalError: unknown;

  constructor(
    code: AcademicPolicyServiceErrorCode,
    message: string,
    originalError?: unknown,
  ) {
    super(message);
    this.name = 'AcademicPolicyServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

interface TermOptionRow {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
}

interface AcademicYearRow {
  id: string;
  institution_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
  terms?: TermOptionRow[] | null;
}

interface AcademicPolicyRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  minimum_grade_percentage: number | string;
  minimum_attendance_percentage: number | string;
  decimal_places: number;
  active: boolean | null;
  created_at: string;
  updated_at: string;
  school_days?: number[] | null;
  default_lesson_duration_minutes?: number | null;
  max_lessons_per_day?: number | null;
  max_teacher_lessons_per_day?: number | null;
  max_teacher_lessons_per_week?: number | null;
  max_consecutive_subject_lessons?: number | null;
  max_subject_lessons_per_day?: number | null;
  require_teacher_availability?: boolean | null;
  require_room_for_generation?: boolean | null;
  allow_shared_rooms?: boolean | null;
}

export interface AcademicTermOption {
  id: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface AcademicYearOption {
  id: string;
  institutionId: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
  terms: AcademicTermOption[];
}

export interface AcademicPolicy
  extends AcademicPolicyRule {
  id: string;
  institutionId: string;
  academicYearId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  timetable: TimetablePolicySettings;
}

export interface SaveAcademicPolicyInput
  extends AcademicPolicyRule {
  institutionId: string;
  academicYearId: string;
  timetable?: Partial<TimetablePolicySettings>;
}

function normalizeRelation<T>(
  relation: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function toNumber(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isActive(value: boolean | null | undefined): boolean {
  return value !== false;
}

function createPolicyError(
  error: unknown,
  fallbackCode: AcademicPolicyServiceErrorCode,
): AcademicPolicyServiceError {
  const supabaseError = error as SupabaseErrorLike;

  if (supabaseError?.message) {
    return new AcademicPolicyServiceError(
      fallbackCode,
      supabaseError.message,
      error,
    );
  }

  return new AcademicPolicyServiceError(
    fallbackCode,
    'Nao foi possivel concluir a operacao de politica academica.',
    error,
  );
}

function normalizeTerm(row: TermOptionRow): AcademicTermOption {
  return {
    id: row.id,
    academicYearId: row.academic_year_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    active: isActive(row.active),
  };
}

function normalizeAcademicYear(
  row: AcademicYearRow,
): AcademicYearOption {
  return {
    id: row.id,
    institutionId: row.institution_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    active: isActive(row.active),
    terms: (row.terms ?? [])
      .map(normalizeTerm)
      .sort((left, right) =>
        left.startDate.localeCompare(right.startDate),
      ),
  };
}

function normalizePolicy(
  row: AcademicPolicyRow,
): AcademicPolicy {
  return {
    id: row.id,
    institutionId: row.institution_id,
    academicYearId: row.academic_year_id,
    minimumGradePercentage: toNumber(
      row.minimum_grade_percentage,
    ),
    minimumAttendancePercentage: toNumber(
      row.minimum_attendance_percentage,
    ),
    decimalPlaces: row.decimal_places,
    active: isActive(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timetable: normalizeTimetablePolicy({
      schoolDays: row.school_days ?? DEFAULT_TIMETABLE_POLICY.schoolDays,
      defaultLessonDurationMinutes: row.default_lesson_duration_minutes ?? DEFAULT_TIMETABLE_POLICY.defaultLessonDurationMinutes,
      maxLessonsPerDay: row.max_lessons_per_day ?? DEFAULT_TIMETABLE_POLICY.maxLessonsPerDay,
      maxTeacherLessonsPerDay: row.max_teacher_lessons_per_day ?? DEFAULT_TIMETABLE_POLICY.maxTeacherLessonsPerDay,
      maxTeacherLessonsPerWeek: row.max_teacher_lessons_per_week ?? DEFAULT_TIMETABLE_POLICY.maxTeacherLessonsPerWeek,
      maxConsecutiveSubjectLessons: row.max_consecutive_subject_lessons ?? DEFAULT_TIMETABLE_POLICY.maxConsecutiveSubjectLessons,
      maxSubjectLessonsPerDay: row.max_subject_lessons_per_day ?? DEFAULT_TIMETABLE_POLICY.maxSubjectLessonsPerDay,
      requireTeacherAvailability: row.require_teacher_availability ?? DEFAULT_TIMETABLE_POLICY.requireTeacherAvailability,
      requireRoomForGeneration: row.require_room_for_generation ?? DEFAULT_TIMETABLE_POLICY.requireRoomForGeneration,
      allowSharedRooms: row.allow_shared_rooms ?? DEFAULT_TIMETABLE_POLICY.allowSharedRooms,
    }),
  };
}

function assertPolicyInput(
  input: SaveAcademicPolicyInput,
): void {
  const issues = validateAcademicPolicyRule(input);

  if (!input.institutionId || !input.academicYearId) {
    issues.push({
      code: 'ACADEMIC_POLICY_GRADE_INVALID',
      message:
        'Instituicao e ano letivo sao obrigatorios.',
    });
  }

  const timetable = normalizeTimetablePolicy(input.timetable);
  const rawSchoolDays = input.timetable?.schoolDays;
  if (
    rawSchoolDays &&
    (rawSchoolDays.length === 0 || rawSchoolDays.some((day) => !Number.isInteger(day) || day < 1 || day > 6))
  ) {
    issues.push({
      code: 'ACADEMIC_POLICY_GRADE_INVALID',
      message: 'Os dias letivos devem estar entre segunda e sabado.',
    });
  }
  if (timetable.schoolDays.length === 0) {
    issues.push({
      code: 'ACADEMIC_POLICY_GRADE_INVALID',
      message: 'Configure pelo menos um dia letivo para a grade horaria.',
    });
  }

  if (
    timetable.maxConsecutiveSubjectLessons > timetable.maxLessonsPerDay ||
    timetable.maxSubjectLessonsPerDay > timetable.maxLessonsPerDay ||
    timetable.maxTeacherLessonsPerDay > timetable.maxLessonsPerDay
  ) {
    issues.push({
      code: 'ACADEMIC_POLICY_GRADE_INVALID',
      message: 'Os limites diarios da grade nao podem ultrapassar o maximo de aulas por dia.',
    });
  }

  const numericRanges: Array<[keyof TimetablePolicySettings, number, number]> = [
    ['defaultLessonDurationMinutes', 15, 180],
    ['maxLessonsPerDay', 1, 30],
    ['maxTeacherLessonsPerDay', 1, 30],
    ['maxTeacherLessonsPerWeek', 1, 180],
    ['maxConsecutiveSubjectLessons', 1, 6],
    ['maxSubjectLessonsPerDay', 1, 12],
  ];
  for (const [field, minimum, maximum] of numericRanges) {
    const value = input.timetable?.[field];
    if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum)) {
      issues.push({
        code: 'ACADEMIC_POLICY_GRADE_INVALID',
        message: `O campo ${String(field)} deve ser um inteiro entre ${minimum} e ${maximum}.`,
      });
    }
  }

  if (issues.length > 0) {
    throw new AcademicPolicyServiceError(
      'ACADEMIC_POLICY_INVALID',
      issues.map((issue) => issue.message).join(' '),
    );
  }
}

export const academicPolicyService = {
  async listAcademicYears(
    institutionId: string,
  ): Promise<AcademicYearOption[]> {
    const { data, error } = await supabase
      .from('academic_years')
      .select(
        `
        id,
        institution_id,
        name,
        start_date,
        end_date,
        active,
        terms (
          id,
          academic_year_id,
          name,
          start_date,
          end_date,
          active
        )
      `,
      )
      .eq('institution_id', institutionId)
      .order('start_date', {
        ascending: false,
      });

    if (error) {
      throw createPolicyError(
        error,
        'ACADEMIC_POLICY_FORBIDDEN',
      );
    }

    return ((data ?? []) as unknown as AcademicYearRow[])
      .map(normalizeAcademicYear)
      .filter((year) => year.institutionId === institutionId);
  },

  async getActivePolicy(
    institutionId: string,
    academicYearId: string,
  ): Promise<AcademicPolicy | null> {
    const { data, error } = await supabase
      .from('academic_policies')
      .select(
        `
        id,
        institution_id,
        academic_year_id,
        minimum_grade_percentage,
        minimum_attendance_percentage,
        decimal_places,
        school_days,
        default_lesson_duration_minutes,
        max_lessons_per_day,
        max_teacher_lessons_per_day,
        max_teacher_lessons_per_week,
        max_consecutive_subject_lessons,
        max_subject_lessons_per_day,
        require_teacher_availability,
        require_room_for_generation,
        allow_shared_rooms,
        active,
        created_at,
        updated_at
      `,
      )
      .eq('institution_id', institutionId)
      .eq('academic_year_id', academicYearId)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      throw createPolicyError(
        error,
        'ACADEMIC_POLICY_FORBIDDEN',
      );
    }

    const row = normalizeRelation(
      data as AcademicPolicyRow | AcademicPolicyRow[] | null,
    );

    return row ? normalizePolicy(row) : null;
  },

  async savePolicy(
    input: SaveAcademicPolicyInput,
  ): Promise<AcademicPolicy> {
    assertPolicyInput(input);

    const current = await this.getActivePolicy(
      input.institutionId,
      input.academicYearId,
    );
    const timetable = normalizeTimetablePolicy({
      ...current?.timetable,
      ...input.timetable,
    });

    const payload = {
      institution_id: input.institutionId,
      academic_year_id: input.academicYearId,
      minimum_grade_percentage:
        input.minimumGradePercentage,
      minimum_attendance_percentage:
        input.minimumAttendancePercentage,
      decimal_places: input.decimalPlaces,
      school_days: timetable.schoolDays,
      default_lesson_duration_minutes: timetable.defaultLessonDurationMinutes,
      max_lessons_per_day: timetable.maxLessonsPerDay,
      max_teacher_lessons_per_day: timetable.maxTeacherLessonsPerDay,
      max_teacher_lessons_per_week: timetable.maxTeacherLessonsPerWeek,
      max_consecutive_subject_lessons: timetable.maxConsecutiveSubjectLessons,
      max_subject_lessons_per_day: timetable.maxSubjectLessonsPerDay,
      require_teacher_availability: timetable.requireTeacherAvailability,
      require_room_for_generation: timetable.requireRoomForGeneration,
      allow_shared_rooms: timetable.allowSharedRooms,
      active: true,
    };

    const query = current
      ? supabase
          .from('academic_policies')
          .update(payload)
          .eq('id', current.id)
      : supabase
          .from('academic_policies')
          .insert(payload);

    const { data, error } = await query
      .select(
        `
        id,
        institution_id,
        academic_year_id,
        minimum_grade_percentage,
        minimum_attendance_percentage,
        decimal_places,
        school_days,
        default_lesson_duration_minutes,
        max_lessons_per_day,
        max_teacher_lessons_per_day,
        max_teacher_lessons_per_week,
        max_consecutive_subject_lessons,
        max_subject_lessons_per_day,
        require_teacher_availability,
        require_room_for_generation,
        allow_shared_rooms,
        active,
        created_at,
        updated_at
      `,
      )
      .single();

    if (error || !data) {
      throw createPolicyError(
        error,
        'ACADEMIC_POLICY_SAVE_FAILED',
      );
    }

    return normalizePolicy(
      data as unknown as AcademicPolicyRow,
    );
  },
};
