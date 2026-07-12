import { supabase } from '../lib/supabaseClient';
import {
  validateAcademicPolicyRule,
  type AcademicPolicyRule,
} from './academicCalculations';

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
}

export interface SaveAcademicPolicyInput
  extends AcademicPolicyRule {
  institutionId: string;
  academicYearId: string;
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

    const payload = {
      institution_id: input.institutionId,
      academic_year_id: input.academicYearId,
      minimum_grade_percentage:
        input.minimumGradePercentage,
      minimum_attendance_percentage:
        input.minimumAttendancePercentage,
      decimal_places: input.decimalPlaces,
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
