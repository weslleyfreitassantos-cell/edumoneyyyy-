import { supabase } from '../lib/supabaseClient';
import {
  calculateEffectiveTermResult,
  isRecoveryEligible,
  type AcademicRecoveryStatus,
  type AcademicPolicyRule,
  type TermResultStatus,
} from './academicCalculations';
import {
  termClosingService,
  type TermClosureStudent,
} from './termClosingService';

export type AcademicRecoveryServiceErrorCode =
  | 'ACADEMIC_RECOVERY_FORBIDDEN'
  | 'ACADEMIC_RECOVERY_INVALID'
  | 'ACADEMIC_RECOVERY_NOT_FOUND';

export class AcademicRecoveryServiceError extends Error {
  readonly code: AcademicRecoveryServiceErrorCode;

  readonly originalError: unknown;

  constructor(
    code: AcademicRecoveryServiceErrorCode,
    message: string,
    originalError?: unknown,
  ) {
    super(message);
    this.name = 'AcademicRecoveryServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

interface RecoveryRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  term_id: string;
  subject_offering_id: string;
  student_id: string;
  status: string;
  recovery_percentage: number | string;
  composition_rule: string;
  notes: string | null;
  recorded_by: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OfficialResultRow {
  student_id: string;
  grade_percentage: number | string | null;
  attendance_percentage: number | string | null;
  original_result_status: string | null;
  result_status: string;
  finalized_at: string | null;
}

export interface AcademicRecoveryRecord {
  id: string;
  institutionId: string;
  academicYearId: string;
  termId: string;
  subjectOfferingId: string;
  studentId: string;
  status: AcademicRecoveryStatus;
  recoveryPercentage: number;
  compositionRule: 'HIGHEST_SCORE_V1';
  notes: string | null;
  recordedBy: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicRecoveryCandidate {
  student: TermClosureStudent;
  originalGradePercentage: number | null;
  attendancePercentage: number | null;
  originalResultStatus: TermResultStatus;
  recovery: AcademicRecoveryRecord | null;
  policy: AcademicPolicyRule | null;
  closureStatus: string;
}

export interface SaveAcademicRecoveryInput {
  institutionId: string;
  academicYearId: string;
  termId: string;
  subjectOfferingId: string;
  studentId: string;
  recoveryPercentage: number;
  status: Extract<AcademicRecoveryStatus, 'DRAFT' | 'PUBLISHED'>;
  notes?: string | null;
}

function normalizeStatus(value: string): AcademicRecoveryStatus {
  if (value === 'PUBLISHED' || value === 'CANCELED') {
    return value;
  }

  return 'DRAFT';
}

function toNumber(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toNumber(value);
}

function normalizeRecovery(row: RecoveryRow): AcademicRecoveryRecord {
  return {
    id: row.id,
    institutionId: row.institution_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    subjectOfferingId: row.subject_offering_id,
    studentId: row.student_id,
    status: normalizeStatus(row.status),
    recoveryPercentage: toNumber(row.recovery_percentage),
    compositionRule: 'HIGHEST_SCORE_V1',
    notes: row.notes,
    recordedBy: row.recorded_by,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeResultStatus(value: string | null | undefined): TermResultStatus {
  if (
    value === 'APPROVED' ||
    value === 'FAILED_BY_GRADE' ||
    value === 'FAILED_BY_ATTENDANCE' ||
    value === 'FAILED_BY_GRADE_AND_ATTENDANCE'
  ) {
    return value;
  }

  return 'PENDING';
}

function createRecoveryError(
  error: unknown,
  code: AcademicRecoveryServiceErrorCode = 'ACADEMIC_RECOVERY_FORBIDDEN',
): AcademicRecoveryServiceError {
  const message = error instanceof Error
    ? error.message
    : 'Não foi possível carregar a recuperação acadêmica.';

  return new AcademicRecoveryServiceError(code, message, error);
}

async function loadRecoveries(
  institutionId: string,
  subjectOfferingId: string,
  termId: string,
): Promise<Map<string, AcademicRecoveryRecord>> {
  const { data, error } = await supabase
    .from('student_term_recoveries')
    .select(`
      id,
      institution_id,
      academic_year_id,
      term_id,
      subject_offering_id,
      student_id,
      status,
      recovery_percentage,
      composition_rule,
      notes,
      recorded_by,
      published_at,
      created_at,
      updated_at
    `)
    .eq('institution_id', institutionId)
    .eq('subject_offering_id', subjectOfferingId)
    .eq('term_id', termId);

  if (error) {
    throw createRecoveryError(error);
  }

  return new Map(
    ((data ?? []) as unknown as RecoveryRow[]).map((row) => {
      const recovery = normalizeRecovery(row);
      return [recovery.studentId, recovery];
    }),
  );
}

async function loadOfficialResults(
  institutionId: string,
  subjectOfferingId: string,
  termId: string,
): Promise<Map<string, OfficialResultRow>> {
  const { data, error } = await supabase
    .from('student_term_results')
    .select('student_id, grade_percentage, attendance_percentage, original_result_status, result_status, finalized_at')
    .eq('institution_id', institutionId)
    .eq('subject_offering_id', subjectOfferingId)
    .eq('term_id', termId)
    .not('finalized_at', 'is', null);

  if (error) {
    throw createRecoveryError(error);
  }

  return new Map(
    ((data ?? []) as unknown as OfficialResultRow[]).map((row) => [row.student_id, row]),
  );
}

export const academicRecoveryService = {
  async listCandidates(
    institutionId: string,
    subjectOfferingId: string,
  ): Promise<AcademicRecoveryCandidate[]> {
    const preview = await termClosingService.getPreview(
      institutionId,
      subjectOfferingId,
    );
    const [recoveryByStudent, officialResults] = await Promise.all([
      loadRecoveries(
        institutionId,
        subjectOfferingId,
        preview.offering.termId,
      ),
      loadOfficialResults(
        institutionId,
        subjectOfferingId,
        preview.offering.termId,
      ),
    ]);

    return preview.students
      .map((student) => ({ student, result: officialResults.get(student.student.id) }))
      .filter(({ result }) => isRecoveryEligible(
        normalizeResultStatus(result?.original_result_status ?? result?.result_status),
      ))
      .map(({ student, result }) => ({
        student: student.student,
        originalGradePercentage: toNullableNumber(result?.grade_percentage),
        attendancePercentage: toNullableNumber(result?.attendance_percentage),
        originalResultStatus: normalizeResultStatus(
          result?.original_result_status ?? result?.result_status,
        ),
        recovery: recoveryByStudent.get(student.student.id) ?? null,
        policy: preview.policy,
        closureStatus: preview.closure?.status ?? 'OPEN',
      }));
  },

  async save(
    input: SaveAcademicRecoveryInput,
  ): Promise<AcademicRecoveryRecord> {
    const { data, error } = await supabase.rpc(
      'save_academic_recovery',
      {
        p_institution_id: input.institutionId,
        p_academic_year_id: input.academicYearId,
        p_term_id: input.termId,
        p_subject_offering_id: input.subjectOfferingId,
        p_student_id: input.studentId,
        p_recovery_percentage: input.recoveryPercentage,
        p_status: input.status,
        p_notes: input.notes ?? null,
      },
    );

    if (error || !data) {
      throw createRecoveryError(
        error ?? new Error('Recuperação não retornada pelo banco.'),
        error?.code === '42501'
          ? 'ACADEMIC_RECOVERY_FORBIDDEN'
          : 'ACADEMIC_RECOVERY_INVALID',
      );
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      throw createRecoveryError(
        new Error('Recuperação não retornada pelo banco.'),
        'ACADEMIC_RECOVERY_NOT_FOUND',
      );
    }

    return normalizeRecovery(row as RecoveryRow);
  },

  async cancel(
    institutionId: string,
    recoveryId: string,
  ): Promise<AcademicRecoveryRecord> {
    const { data, error } = await supabase.rpc(
      'cancel_academic_recovery',
      {
        p_institution_id: institutionId,
        p_recovery_id: recoveryId,
      },
    );

    if (error || !data) {
      throw createRecoveryError(error, 'ACADEMIC_RECOVERY_FORBIDDEN');
    }

    const row = Array.isArray(data) ? data[0] : data;
    return normalizeRecovery(row as RecoveryRow);
  },

  calculatePreview(
    candidate: AcademicRecoveryCandidate,
    recoveryPercentage: number | null,
  ) {
    return calculateEffectiveTermResult(
      candidate.policy,
      candidate.originalGradePercentage,
      recoveryPercentage,
      candidate.attendancePercentage,
    );
  },
};
