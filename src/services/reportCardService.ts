import { supabase } from '../lib/supabaseClient';
import {
  calculateTermGradePercentage,
  type TermResultStatus,
} from './academicCalculations';
import {
  calculateGradePercentage,
  type AssessmentStatus,
  type AssessmentType,
  type GradeStatus,
} from './gradeService';

export type ReportCardServiceErrorCode =
  | 'REPORT_CARD_FORBIDDEN'
  | 'REPORT_CARD_NOT_FOUND';

export class ReportCardServiceError extends Error {
  readonly code: ReportCardServiceErrorCode;

  readonly originalError: unknown;

  constructor(
    code: ReportCardServiceErrorCode,
    message: string,
    originalError?: unknown,
  ) {
    super(message);
    this.name = 'ReportCardServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

interface SupabaseErrorLike {
  message?: string;
}

interface TermRelation {
  id: string;
  name: string;
  academic_year_id: string;
}

interface AcademicYearRelation {
  id: string;
  name: string;
}

interface SubjectRelation {
  id: string;
  name: string;
  code: string | null;
}

interface ClassRelation {
  id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
}

interface TeacherRelation {
  full_name: string;
  email: string;
}

interface OfferingRelation {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  term_id: string;
  classes: ClassRelation | ClassRelation[] | null;
  subjects: SubjectRelation | SubjectRelation[] | null;
  profiles: TeacherRelation | TeacherRelation[] | null;
  terms: TermRelation | TermRelation[] | null;
}

interface StudentTermResultRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  term_id: string;
  subject_offering_id: string;
  student_id: string;
  grade_percentage: number | string | null;
  attendance_percentage: number | string | null;
  result_status: string;
  calculated_at: string;
  finalized_at: string | null;
  subject_offerings:
    | OfferingRelation
    | OfferingRelation[]
    | null;
  academic_years:
    | AcademicYearRelation
    | AcademicYearRelation[]
    | null;
  terms: TermRelation | TermRelation[] | null;
}

interface AssessmentRelation {
  id: string;
  subject_offering_id: string;
  term_id: string | null;
  title: string;
  assessment_type: string;
  assessment_date: string;
  max_score: number | string;
  weight: number | string;
  status: string;
  subject_offerings:
    | OfferingRelation
    | OfferingRelation[]
    | null;
}

interface GradeRow {
  id: string;
  assessment_id: string;
  student_id: string;
  score: number | string | null;
  status: string;
  feedback: string | null;
  recorded_at: string | null;
  assessments:
    | AssessmentRelation
    | AssessmentRelation[]
    | null;
}

export interface ReportCardAssessment {
  id: string;
  title: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxScore: number;
  weight: number;
  score: number | null;
  status: GradeStatus;
  percentage: number | null;
  feedback: string | null;
}

export interface ReportCardSubjectResult {
  key: string;
  institutionId: string;
  academicYearId: string;
  academicYearName: string;
  termId: string;
  termName: string;
  subjectOfferingId: string;
  subjectName: string;
  subjectCode: string | null;
  className: string;
  teacherName: string;
  teacherEmail: string;
  gradePercentage: number | null;
  attendancePercentage: number | null;
  resultStatus: TermResultStatus;
  finalizedAt: string | null;
  isClosed: boolean;
  assessments: ReportCardAssessment[];
}

export interface StudentReportCard {
  institutionId: string;
  studentId: string;
  subjects: ReportCardSubjectResult[];
  closedCount: number;
  openCount: number;
}

function normalizeRelation<T>(
  relation: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function toNumber(value: number | string | null): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toNullableNumber(
  value: number | string | null,
): number | null {
  if (value === null) {
    return null;
  }

  return toNumber(value);
}

function normalizeGradeStatus(
  status: string | null | undefined,
): GradeStatus {
  const normalized = status?.trim().toUpperCase();

  if (
    normalized === 'GRADED' ||
    normalized === 'PENDING' ||
    normalized === 'EXCUSED'
  ) {
    return normalized;
  }

  return 'PENDING';
}

function normalizeAssessmentStatus(
  status: string | null | undefined,
): AssessmentStatus {
  const normalized = status?.trim().toUpperCase();

  if (
    normalized === 'PUBLISHED' ||
    normalized === 'CLOSED'
  ) {
    return normalized;
  }

  if (normalized === 'CANCELED') {
    return 'CANCELED';
  }

  return 'DRAFT';
}

function normalizeResultStatus(
  status: string | null | undefined,
): TermResultStatus {
  const normalized = status?.trim().toUpperCase();

  if (
    normalized === 'APPROVED' ||
    normalized === 'FAILED_BY_GRADE' ||
    normalized === 'FAILED_BY_ATTENDANCE' ||
    normalized === 'FAILED_BY_GRADE_AND_ATTENDANCE'
  ) {
    return normalized;
  }

  return 'PENDING';
}

function createReportCardError(
  error: unknown,
): ReportCardServiceError {
  const supabaseError = error as SupabaseErrorLike;

  if (supabaseError?.message) {
    return new ReportCardServiceError(
      'REPORT_CARD_FORBIDDEN',
      supabaseError.message,
      error,
    );
  }

  return new ReportCardServiceError(
    'REPORT_CARD_FORBIDDEN',
    'Nao foi possivel carregar o boletim.',
    error,
  );
}

function normalizeAssessment(
  grade: GradeRow,
): ReportCardAssessment | null {
  const assessment = normalizeRelation(grade.assessments);

  if (!assessment) {
    return null;
  }

  const score = toNullableNumber(grade.score);
  const maxScore = toNumber(assessment.max_score);

  return {
    id: assessment.id,
    title: assessment.title,
    assessmentType: assessment.assessment_type as AssessmentType,
    assessmentDate: assessment.assessment_date,
    maxScore,
    weight: toNumber(assessment.weight),
    score,
    status: normalizeGradeStatus(grade.status),
    percentage: calculateGradePercentage(score, maxScore),
    feedback: grade.feedback,
  };
}

function normalizeOfferingDetails(
  offering: OfferingRelation,
): {
  subjectName: string;
  subjectCode: string | null;
  className: string;
  teacherName: string;
  teacherEmail: string;
  termName: string;
} | null {
  const subject = normalizeRelation(offering.subjects);
  const classRecord = normalizeRelation(offering.classes);
  const teacher = normalizeRelation(offering.profiles);
  const term = normalizeRelation(offering.terms);

  if (!subject || !classRecord || !teacher || !term) {
    return null;
  }

  return {
    subjectName: subject.name,
    subjectCode: subject.code,
    className: classRecord.name,
    teacherName: teacher.full_name,
    teacherEmail: teacher.email,
    termName: term.name,
  };
}

function groupAssessmentsBySubjectTerm(
  grades: readonly GradeRow[],
): Map<string, ReportCardAssessment[]> {
  const grouped = new Map<string, ReportCardAssessment[]>();

  for (const grade of grades) {
    const assessment = normalizeRelation(grade.assessments);

    if (!assessment) {
      continue;
    }

    const status = normalizeAssessmentStatus(
      assessment.status,
    );

    if (status !== 'PUBLISHED' && status !== 'CLOSED') {
      continue;
    }

    const termId = assessment.term_id;

    if (!termId) {
      continue;
    }

    const normalizedAssessment =
      normalizeAssessment(grade);

    if (!normalizedAssessment) {
      continue;
    }

    const key = `${assessment.subject_offering_id}:${termId}`;
    const current = grouped.get(key) ?? [];
    current.push(normalizedAssessment);
    grouped.set(key, current);
  }

  for (const assessments of grouped.values()) {
    assessments.sort((left, right) =>
      left.assessmentDate.localeCompare(right.assessmentDate),
    );
  }

  return grouped;
}

function buildClosedSubjectResult(
  row: StudentTermResultRow,
  assessments: readonly ReportCardAssessment[],
): ReportCardSubjectResult | null {
  const offering = normalizeRelation(row.subject_offerings);
  const academicYear = normalizeRelation(row.academic_years);
  const term = normalizeRelation(row.terms);

  if (!offering || !academicYear || !term) {
    return null;
  }

  const details = normalizeOfferingDetails(offering);

  if (!details) {
    return null;
  }

  return {
    key: `${row.subject_offering_id}:${row.term_id}`,
    institutionId: row.institution_id,
    academicYearId: row.academic_year_id,
    academicYearName: academicYear.name,
    termId: row.term_id,
    termName: details.termName || term.name,
    subjectOfferingId: row.subject_offering_id,
    subjectName: details.subjectName,
    subjectCode: details.subjectCode,
    className: details.className,
    teacherName: details.teacherName,
    teacherEmail: details.teacherEmail,
    gradePercentage: toNullableNumber(row.grade_percentage),
    attendancePercentage: toNullableNumber(
      row.attendance_percentage,
    ),
    resultStatus: normalizeResultStatus(
      row.result_status,
    ),
    finalizedAt: row.finalized_at,
    isClosed: row.finalized_at !== null,
    assessments: [...assessments],
  };
}

function buildOpenSubjectResult(
  grade: GradeRow,
  assessments: readonly ReportCardAssessment[],
  institutionId: string,
): ReportCardSubjectResult | null {
  const assessment = normalizeRelation(grade.assessments);
  const offering = normalizeRelation(
    assessment?.subject_offerings,
  );
  const term = normalizeRelation(offering?.terms);

  if (!assessment || !offering || !term) {
    return null;
  }

  const details = normalizeOfferingDetails(offering);

  if (!details || !assessment.term_id) {
    return null;
  }

  const gradePercentage = calculateTermGradePercentage(
    assessments.map((item) => ({
      score: item.score,
      maxScore: item.maxScore,
      weight: item.weight,
      gradeStatus: item.status,
      assessmentStatus: normalizeAssessmentStatus(
        assessment.status,
      ),
    })),
    1,
  );

  return {
    key: `${assessment.subject_offering_id}:${assessment.term_id}`,
    institutionId,
    academicYearId: term.academic_year_id,
    academicYearName: 'Ano letivo',
    termId: assessment.term_id,
    termName: details.termName,
    subjectOfferingId: assessment.subject_offering_id,
    subjectName: details.subjectName,
    subjectCode: details.subjectCode,
    className: details.className,
    teacherName: details.teacherName,
    teacherEmail: details.teacherEmail,
    gradePercentage,
    attendancePercentage: null,
    resultStatus: 'PENDING',
    finalizedAt: null,
    isClosed: false,
    assessments: [...assessments],
  };
}

async function loadResultRowsForStudents(
  institutionId: string,
  studentIds: readonly string[],
): Promise<StudentTermResultRow[]> {
  let query = supabase
    .from('student_term_results')
    .select(
      `
      id,
      institution_id,
      academic_year_id,
      term_id,
      subject_offering_id,
      student_id,
      grade_percentage,
      attendance_percentage,
      result_status,
      calculated_at,
      finalized_at,
      academic_years:academic_year_id (
        id,
        name
      ),
      terms:term_id (
        id,
        name,
        academic_year_id
      ),
      subject_offerings:subject_offering_id (
        id,
        class_id,
        subject_id,
        teacher_profile_id,
        term_id,
        classes:class_id (
          id,
          name,
          grade_level,
          shift
        ),
        subjects:subject_id (
          id,
          name,
          code
        ),
        profiles:teacher_profile_id (
          full_name,
          email
        ),
        terms:term_id (
          id,
          name,
          academic_year_id
        )
      )
    `,
    )
    .eq('institution_id', institutionId);

  if (studentIds.length === 1) {
    query = query.eq('student_id', studentIds[0]);
  } else {
    query = query.in('student_id', [...studentIds]);
  }

  const { data, error } = await query.order('calculated_at', {
    ascending: false,
  });

  if (error) {
    throw createReportCardError(error);
  }

  return (data ?? []) as unknown as StudentTermResultRow[];
}

async function loadGradeRowsForStudents(
  institutionId: string,
  studentIds: readonly string[],
): Promise<GradeRow[]> {
  let query = supabase
    .from('grades')
    .select(
      `
      id,
      assessment_id,
      student_id,
      score,
      status,
      feedback,
      recorded_at,
      assessments:assessment_id (
        id,
        subject_offering_id,
        term_id,
        title,
        assessment_type,
        assessment_date,
        max_score,
        weight,
        status,
        subject_offerings:subject_offering_id (
          id,
          class_id,
          subject_id,
          teacher_profile_id,
          term_id,
          classes:class_id (
            id,
            name,
            grade_level,
            shift
          ),
          subjects:subject_id (
            id,
            name,
            code
          ),
          profiles:teacher_profile_id (
            full_name,
            email
          ),
          terms:term_id (
            id,
            name,
            academic_year_id
          )
        )
      )
    `,
    )
    .eq('institution_id', institutionId);

  if (studentIds.length === 1) {
    query = query.eq('student_id', studentIds[0]);
  } else {
    query = query.in('student_id', [...studentIds]);
  }

  const { data, error } = await query.order('recorded_at', {
    ascending: false,
  });

  if (error) {
    throw createReportCardError(error);
  }

  return (data ?? []) as unknown as GradeRow[];
}

function buildStudentReportCard(
  institutionId: string,
  studentId: string,
  resultRows: readonly StudentTermResultRow[],
  gradeRows: readonly GradeRow[],
): StudentReportCard {
  const assessmentsByKey =
    groupAssessmentsBySubjectTerm(gradeRows);
  const closedResults = resultRows
    .map((row) =>
      buildClosedSubjectResult(
        row,
        assessmentsByKey.get(
          `${row.subject_offering_id}:${row.term_id}`,
        ) ?? [],
      ),
    )
    .filter(
      (
        result,
      ): result is ReportCardSubjectResult =>
        result !== null,
    );

  const closedKeys = new Set(
    closedResults.map((result) => result.key),
  );
  const openResults: ReportCardSubjectResult[] = [];

  for (const grade of gradeRows) {
    const assessment = normalizeRelation(grade.assessments);

    if (!assessment?.term_id) {
      continue;
    }

    const key = `${assessment.subject_offering_id}:${assessment.term_id}`;

    if (closedKeys.has(key)) {
      continue;
    }

    const assessments = assessmentsByKey.get(key) ?? [];
    const openResult = buildOpenSubjectResult(
      grade,
      assessments,
      institutionId,
    );

    if (
      openResult &&
      !openResults.some(
        (item) => item.key === openResult.key,
      )
    ) {
      openResults.push(openResult);
    }
  }

  const subjects = [...closedResults, ...openResults].sort(
    (left, right) =>
      `${left.academicYearName}-${left.termName}-${left.subjectName}`
        .localeCompare(
          `${right.academicYearName}-${right.termName}-${right.subjectName}`,
        ),
  );

  return {
    institutionId,
    studentId,
    subjects,
    closedCount: subjects.filter((subject) => subject.isClosed)
      .length,
    openCount: subjects.filter((subject) => !subject.isClosed)
      .length,
  };
}

export const reportCardService = {
  async getStudentReportCard(
    institutionId: string,
    studentId: string,
  ): Promise<StudentReportCard> {
    const [resultRows, gradeRows] = await Promise.all([
      loadResultRowsForStudents(institutionId, [studentId]),
      loadGradeRowsForStudents(institutionId, [studentId]),
    ]);

    return buildStudentReportCard(
      institutionId,
      studentId,
      resultRows,
      gradeRows,
    );
  },

  async getGuardianReportCards(
    institutionId: string,
    studentIds: readonly string[],
  ): Promise<StudentReportCard[]> {
    if (studentIds.length === 0) {
      return [];
    }

    const [resultRows, gradeRows] = await Promise.all([
      loadResultRowsForStudents(institutionId, studentIds),
      loadGradeRowsForStudents(institutionId, studentIds),
    ]);

    return studentIds.map((studentId) =>
      buildStudentReportCard(
        institutionId,
        studentId,
        resultRows.filter(
          (row) => row.student_id === studentId,
        ),
        gradeRows.filter(
          (row) => row.student_id === studentId,
        ),
      ),
    );
  },
};
