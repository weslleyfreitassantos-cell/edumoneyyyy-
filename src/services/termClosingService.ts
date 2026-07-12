import { supabase } from '../lib/supabaseClient';
import {
  calculateTermResult,
  TERM_CLOSURE_STATUSES,
  TERM_RESULT_STATUSES,
  type AcademicPolicyRule,
  type TermClosureStatus,
  type TermResultStatus,
} from './academicCalculations';
import { academicPolicyService } from './academicPolicyService';
import {
  ATTENDANCE_RECORD_STATUSES,
  ATTENDANCE_SESSION_STATUSES,
  calculateAttendanceSummary,
  isEnrollmentValidForAttendanceDate,
  type AttendanceStatus,
  type AttendanceSessionStatus,
  type AttendanceSummary,
} from './attendanceService';
import {
  ASSESSMENT_STATUSES,
  GRADE_STATUSES,
  calculateGradeSummary,
  type AssessmentStatus,
  type AssessmentType,
  type GradeStatus,
  type GradeSummary,
} from './gradeService';

export type TermClosingServiceErrorCode =
  | 'ACADEMIC_POLICY_NOT_CONFIGURED'
  | 'TERM_CLOSURE_FORBIDDEN'
  | 'TERM_CLOSURE_HAS_PENDING_GRADES'
  | 'TERM_CLOSURE_INVALID_PERIOD'
  | 'TERM_CLOSURE_ALREADY_CLOSED'
  | 'TERM_CLOSURE_REOPEN_REASON_REQUIRED'
  | 'TERM_RESULT_INSUFFICIENT_DATA';

export class TermClosingServiceError extends Error {
  readonly code: TermClosingServiceErrorCode;

  readonly originalError: unknown;

  constructor(
    code: TermClosingServiceErrorCode,
    message: string,
    originalError?: unknown,
  ) {
    super(message);
    this.name = 'TermClosingServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

interface ProfileRelation {
  id?: string;
  full_name: string;
  email: string;
  active?: boolean | null;
}

interface SubjectRelation {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  workload: number | null;
  active: boolean | null;
}

interface AcademicYearRelation {
  id: string;
  institution_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
}

interface ClassRelation {
  id: string;
  institution_id: string;
  academic_year_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
  active: boolean | null;
  academic_years?:
    | AcademicYearRelation
    | AcademicYearRelation[]
    | null;
}

interface TermRelation {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
}

interface OfferingRow {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  term_id: string;
  active: boolean | null;
  created_at: string | null;
  classes: ClassRelation | ClassRelation[] | null;
  subjects: SubjectRelation | SubjectRelation[] | null;
  profiles: ProfileRelation | ProfileRelation[] | null;
  terms: TermRelation | TermRelation[] | null;
}

interface StudentRelation {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  active: boolean | null;
  profiles: ProfileRelation | ProfileRelation[] | null;
}

interface EnrollmentRow {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  status: string | null;
  active: boolean | null;
  enrolled_at: string | null;
  students: StudentRelation | StudentRelation[] | null;
}

interface GradeRow {
  id: string;
  student_id: string;
  score: number | string | null;
  status: string;
}

interface AssessmentRow {
  id: string;
  title: string;
  assessment_type: string;
  assessment_date: string;
  max_score: number | string;
  weight: number | string;
  status: string;
  grades?: GradeRow[] | null;
}

interface AttendanceRecordRow {
  id: string;
  student_id: string;
  status: string;
}

interface AttendanceSessionRow {
  id: string;
  session_date: string;
  status: string;
  attendance_records?: AttendanceRecordRow[] | null;
}

interface TermClosureRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  term_id: string;
  subject_offering_id: string;
  status: string;
  submitted_by: string | null;
  submitted_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface TermClosureOffering {
  id: string;
  institutionId: string;
  academicYearId: string;
  academicYearName: string;
  classId: string;
  className: string;
  gradeLevel: string | null;
  shift: string | null;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  workload: number | null;
  teacherProfileId: string;
  teacherName: string;
  teacherEmail: string;
  termId: string;
  termName: string;
  termStartDate: string;
  termEndDate: string;
  active: boolean;
  closure: TermClosure | null;
}

export interface TermClosure {
  id: string;
  institutionId: string;
  academicYearId: string;
  termId: string;
  subjectOfferingId: string;
  status: TermClosureStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  closedBy: string | null;
  closedAt: string | null;
  reopenedBy: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TermClosureStudent {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  registrationNumber: string;
  enrollmentId: string;
}

export interface TermClosureAssessment {
  id: string;
  title: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxScore: number;
  weight: number;
  status: AssessmentStatus;
}

export interface TermClosureIssue {
  code:
    | 'ACADEMIC_POLICY_NOT_CONFIGURED'
    | 'TERM_CLOSURE_HAS_PENDING_GRADES'
    | 'TERM_CLOSURE_INVALID_PERIOD'
    | 'TERM_RESULT_INSUFFICIENT_DATA'
    | 'TERM_CLOSURE_ALREADY_CLOSED';
  message: string;
  studentId?: string;
  assessmentId?: string;
}

export interface TermClosureStudentPreview {
  student: TermClosureStudent;
  gradePercentage: number | null;
  attendancePercentage: number | null;
  resultStatus: TermResultStatus;
  gradeSummary: GradeSummary;
  attendanceSummary: AttendanceSummary;
  issues: TermClosureIssue[];
}

export interface TermClosurePreview {
  offering: TermClosureOffering;
  policy: AcademicPolicyRule | null;
  closure: TermClosure | null;
  assessments: TermClosureAssessment[];
  students: TermClosureStudentPreview[];
  issues: TermClosureIssue[];
  canSubmit: boolean;
  canClose: boolean;
}

export interface ListTermClosureOfferingsFilters {
  academicYearId?: string;
  termId?: string;
  classId?: string;
  subjectId?: string;
  teacherProfileId?: string;
  status?: TermClosureStatus | 'ALL';
}

export interface SubmitTermClosureInput {
  institutionId: string;
  academicYearId: string;
  termId: string;
  subjectOfferingId: string;
}

export interface ReopenTermClosureInput {
  institutionId: string;
  termClosureId: string;
  reason: string;
}

function normalizeRelation<T>(
  relation: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function isActive(value: boolean | null | undefined): boolean {
  return value !== false;
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

function normalizeAssessmentStatus(
  status: string | null | undefined,
): AssessmentStatus {
  const normalized = status?.trim().toUpperCase();

  if (
    ASSESSMENT_STATUSES.includes(
      normalized as AssessmentStatus,
    )
  ) {
    return normalized as AssessmentStatus;
  }

  return 'DRAFT';
}

function normalizeGradeStatus(
  status: string | null | undefined,
): GradeStatus {
  const normalized = status?.trim().toUpperCase();

  if (GRADE_STATUSES.includes(normalized as GradeStatus)) {
    return normalized as GradeStatus;
  }

  return 'PENDING';
}

function normalizeAttendanceStatus(
  status: string | null | undefined,
): AttendanceStatus {
  const normalized = status?.trim().toUpperCase();

  if (
    ATTENDANCE_RECORD_STATUSES.includes(
      normalized as AttendanceStatus,
    )
  ) {
    return normalized as AttendanceStatus;
  }

  return 'PRESENT';
}

function normalizeSessionStatus(
  status: string | null | undefined,
): AttendanceSessionStatus {
  const normalized = status?.trim().toUpperCase();

  if (
    ATTENDANCE_SESSION_STATUSES.includes(
      normalized as AttendanceSessionStatus,
    )
  ) {
    return normalized as AttendanceSessionStatus;
  }

  return 'DRAFT';
}

function normalizeClosureStatus(
  status: string | null | undefined,
): TermClosureStatus {
  const normalized = status?.trim().toUpperCase();

  if (
    TERM_CLOSURE_STATUSES.includes(
      normalized as TermClosureStatus,
    )
  ) {
    return normalized as TermClosureStatus;
  }

  return 'OPEN';
}

function createTermClosingError(
  error: unknown,
  fallbackCode: TermClosingServiceErrorCode,
): TermClosingServiceError {
  const supabaseError = error as SupabaseErrorLike;

  if (supabaseError?.message) {
    return new TermClosingServiceError(
      fallbackCode,
      supabaseError.message,
      error,
    );
  }

  return new TermClosingServiceError(
    fallbackCode,
    'Nao foi possivel concluir a operacao de fechamento.',
    error,
  );
}

function normalizeClosure(
  row: TermClosureRow,
): TermClosure {
  return {
    id: row.id,
    institutionId: row.institution_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    subjectOfferingId: row.subject_offering_id,
    status: normalizeClosureStatus(row.status),
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
    reopenedBy: row.reopened_by,
    reopenedAt: row.reopened_at,
    reopenReason: row.reopen_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOffering(
  row: OfferingRow,
  closure: TermClosure | null,
): TermClosureOffering | null {
  const classRecord = normalizeRelation(row.classes);
  const subject = normalizeRelation(row.subjects);
  const teacher = normalizeRelation(row.profiles);
  const term = normalizeRelation(row.terms);
  const academicYear = normalizeRelation(
    classRecord?.academic_years,
  );

  if (
    !classRecord ||
    !subject ||
    !teacher ||
    !term ||
    !academicYear ||
    classRecord.institution_id !== subject.institution_id ||
    classRecord.institution_id !==
      academicYear.institution_id ||
    classRecord.academic_year_id !== term.academic_year_id
  ) {
    return null;
  }

  return {
    id: row.id,
    institutionId: classRecord.institution_id,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    classId: classRecord.id,
    className: classRecord.name,
    gradeLevel: classRecord.grade_level,
    shift: classRecord.shift,
    subjectId: subject.id,
    subjectName: subject.name,
    subjectCode: subject.code,
    workload: subject.workload,
    teacherProfileId: row.teacher_profile_id,
    teacherName: teacher.full_name,
    teacherEmail: teacher.email,
    termId: term.id,
    termName: term.name,
    termStartDate: term.start_date,
    termEndDate: term.end_date,
    active:
      isActive(row.active) &&
      isActive(classRecord.active) &&
      isActive(subject.active) &&
      isActive(term.active) &&
      isActive(academicYear.active),
    closure,
  };
}

function normalizeStudent(
  enrollment: EnrollmentRow,
): TermClosureStudent | null {
  const student = normalizeRelation(enrollment.students);
  const profile = normalizeRelation(student?.profiles);

  if (!student || !profile) {
    return null;
  }

  return {
    id: student.id,
    profileId: student.profile_id,
    fullName: profile.full_name,
    email: profile.email,
    registrationNumber: student.registration_number,
    enrollmentId: enrollment.id,
  };
}

function normalizeAssessment(
  row: AssessmentRow,
): TermClosureAssessment {
  return {
    id: row.id,
    title: row.title,
    assessmentType: row.assessment_type as AssessmentType,
    assessmentDate: row.assessment_date,
    maxScore: toNumber(row.max_score),
    weight: toNumber(row.weight),
    status: normalizeAssessmentStatus(row.status),
  };
}

function getGradeForStudent(
  assessment: AssessmentRow,
  studentId: string,
): GradeRow | null {
  return (
    (assessment.grades ?? []).find(
      (grade) => grade.student_id === studentId,
    ) ?? null
  );
}

function getAttendanceRecordsForStudent(
  sessions: readonly AttendanceSessionRow[],
  studentId: string,
): { status: AttendanceStatus }[] {
  return sessions
    .filter(
      (session) =>
        normalizeSessionStatus(session.status) === 'CLOSED',
    )
    .flatMap((session) =>
      (session.attendance_records ?? [])
        .filter((record) => record.student_id === studentId)
        .map((record) => ({
          status: normalizeAttendanceStatus(record.status),
        })),
    );
}

function hasBlockingIssues(
  issues: readonly TermClosureIssue[],
): boolean {
  return issues.length > 0;
}

export function buildTermClosurePreview(
  offering: TermClosureOffering,
  policy: AcademicPolicyRule | null,
  closure: TermClosure | null,
  enrollments: readonly EnrollmentRow[],
  assessmentRows: readonly AssessmentRow[],
  attendanceSessions: readonly AttendanceSessionRow[],
): TermClosurePreview {
  const issues: TermClosureIssue[] = [];
  const assessments = assessmentRows.map(normalizeAssessment);
  const publishedAssessmentRows = assessmentRows.filter((row) => {
    const status = normalizeAssessmentStatus(row.status);
    return status === 'PUBLISHED' || status === 'CLOSED';
  });

  if (!policy) {
    issues.push({
      code: 'ACADEMIC_POLICY_NOT_CONFIGURED',
      message:
        'Configure a politica academica antes do fechamento.',
    });
  }

  if (!offering.active) {
    issues.push({
      code: 'TERM_CLOSURE_INVALID_PERIOD',
      message:
        'A oferta, turma, disciplina, ano ou periodo esta inativa.',
    });
  }

  if (closure?.status === 'CLOSED') {
    issues.push({
      code: 'TERM_CLOSURE_ALREADY_CLOSED',
      message:
        'Este periodo ja esta fechado. Reabra para recalcular.',
    });
  }

  if (publishedAssessmentRows.length === 0) {
    issues.push({
      code: 'TERM_RESULT_INSUFFICIENT_DATA',
      message:
        'Nao ha avaliacoes publicadas ou fechadas no periodo.',
    });
  }

  const closedSessions = attendanceSessions.filter(
    (session) =>
      normalizeSessionStatus(session.status) === 'CLOSED',
  );

  if (closedSessions.length === 0) {
    issues.push({
      code: 'TERM_RESULT_INSUFFICIENT_DATA',
      message:
        'Nao ha chamadas fechadas dentro do periodo.',
    });
  }

  const eligibleStudents = enrollments
    .filter((enrollment) =>
      isEnrollmentValidForAttendanceDate(
        enrollment,
        offering.termEndDate,
      ),
    )
    .map(normalizeStudent)
    .filter(
      (
        student,
      ): student is TermClosureStudent => student !== null,
    );

  if (eligibleStudents.length === 0) {
    issues.push({
      code: 'TERM_RESULT_INSUFFICIENT_DATA',
      message:
        'Nao ha alunos ativos obrigatorios nesta oferta.',
    });
  }

  const students = eligibleStudents.map((student) => {
    const studentIssues: TermClosureIssue[] = [];
    const gradeRecords = publishedAssessmentRows.map(
      (assessment) => {
        const grade = getGradeForStudent(
          assessment,
          student.id,
        );
        const gradeStatus = normalizeGradeStatus(
          grade?.status,
        );

        if (!grade || gradeStatus === 'PENDING') {
          studentIssues.push({
            code: 'TERM_CLOSURE_HAS_PENDING_GRADES',
            message: `${student.fullName} possui nota pendente em ${assessment.title}.`,
            studentId: student.id,
            assessmentId: assessment.id,
          });
        }

        return {
          score:
            grade && grade.score !== null
              ? toNumber(grade.score)
              : null,
          maxScore: toNumber(assessment.max_score),
          weight: toNumber(assessment.weight),
          gradeStatus,
          assessmentStatus: normalizeAssessmentStatus(
            assessment.status,
          ),
        };
      },
    );

    const attendanceRecords =
      getAttendanceRecordsForStudent(
        attendanceSessions,
        student.id,
      );

    if (attendanceRecords.length === 0) {
      studentIssues.push({
        code: 'TERM_RESULT_INSUFFICIENT_DATA',
        message: `${student.fullName} nao possui frequencia fechada no periodo.`,
        studentId: student.id,
      });
    }

    const calculation = calculateTermResult(
      policy,
      gradeRecords,
      attendanceRecords,
    );

    if (
      calculation.resultStatus === 'PENDING' &&
      studentIssues.length === 0
    ) {
      studentIssues.push({
        code: 'TERM_RESULT_INSUFFICIENT_DATA',
        message: `${student.fullName} nao possui dados suficientes para resultado final.`,
        studentId: student.id,
      });
    }

    issues.push(...studentIssues);

    return {
      student,
      gradePercentage: calculation.gradePercentage,
      attendancePercentage:
        calculation.attendancePercentage,
      resultStatus: calculation.resultStatus,
      gradeSummary: calculateGradeSummary(
        gradeRecords.map((record) => ({
          score: record.score,
          maxScore: record.maxScore,
          weight: record.weight,
          status: record.gradeStatus,
        })),
      ),
      attendanceSummary:
        calculateAttendanceSummary(attendanceRecords),
      issues: studentIssues,
    };
  });

  const uniqueIssues = issues.filter(
    (issue, index, source) =>
      source.findIndex(
        (candidate) =>
          candidate.code === issue.code &&
          candidate.message === issue.message &&
          candidate.studentId === issue.studentId &&
          candidate.assessmentId === issue.assessmentId,
      ) === index,
  );

  const blocked = hasBlockingIssues(uniqueIssues);

  return {
    offering: {
      ...offering,
      closure,
    },
    policy,
    closure,
    assessments,
    students,
    issues: uniqueIssues,
    canSubmit:
      !blocked &&
      (!closure ||
        closure.status === 'OPEN' ||
        closure.status === 'REOPENED'),
    canClose:
      !blocked &&
      (!closure ||
        closure.status === 'SUBMITTED' ||
        closure.status === 'REOPENED' ||
        closure.status === 'OPEN'),
  };
}

async function loadClosures(
  institutionId: string,
): Promise<Map<string, TermClosure>> {
  const { data, error } = await supabase
    .from('term_closures')
    .select(
      `
      id,
      institution_id,
      academic_year_id,
      term_id,
      subject_offering_id,
      status,
      submitted_by,
      submitted_at,
      closed_by,
      closed_at,
      reopened_by,
      reopened_at,
      reopen_reason,
      created_at,
      updated_at
    `,
    )
    .eq('institution_id', institutionId);

  if (error) {
    throw createTermClosingError(
      error,
      'TERM_CLOSURE_FORBIDDEN',
    );
  }

  return new Map(
    ((data ?? []) as unknown as TermClosureRow[]).map(
      (row) => {
        const closure = normalizeClosure(row);
        return [
          `${closure.subjectOfferingId}:${closure.termId}`,
          closure,
        ];
      },
    ),
  );
}

async function listOfferings(
  institutionId: string,
  filters: ListTermClosureOfferingsFilters,
): Promise<TermClosureOffering[]> {
  let query = supabase.from('subject_offerings').select(
    `
      id,
      class_id,
      subject_id,
      teacher_profile_id,
      term_id,
      active,
      created_at,
      classes:class_id (
        id,
        institution_id,
        academic_year_id,
        name,
        grade_level,
        shift,
        active,
        academic_years:academic_year_id (
          id,
          institution_id,
          name,
          start_date,
          end_date,
          active
        )
      ),
      subjects:subject_id (
        id,
        institution_id,
        name,
        code,
        workload,
        active
      ),
      profiles:teacher_profile_id (
        full_name,
        email,
        active
      ),
      terms:term_id (
        id,
        academic_year_id,
        name,
        start_date,
        end_date,
        active
      )
    `,
  );

  if (filters.teacherProfileId) {
    query = query.eq(
      'teacher_profile_id',
      filters.teacherProfileId,
    );
  }

  if (filters.termId) {
    query = query.eq('term_id', filters.termId);
  }

  const [{ data, error }, closures] = await Promise.all([
    query.order('created_at', {
      ascending: false,
    }),
    loadClosures(institutionId),
  ]);

  if (error) {
    throw createTermClosingError(
      error,
      'TERM_CLOSURE_FORBIDDEN',
    );
  }

  return ((data ?? []) as unknown as OfferingRow[])
    .map((row) => {
      const closure =
        closures.get(`${row.id}:${row.term_id}`) ?? null;
      return normalizeOffering(row, closure);
    })
    .filter(
      (
        offering,
      ): offering is TermClosureOffering =>
        offering !== null &&
        offering.institutionId === institutionId,
    )
    .filter((offering) => {
      if (
        filters.academicYearId &&
        offering.academicYearId !== filters.academicYearId
      ) {
        return false;
      }

      if (
        filters.classId &&
        offering.classId !== filters.classId
      ) {
        return false;
      }

      if (
        filters.subjectId &&
        offering.subjectId !== filters.subjectId
      ) {
        return false;
      }

      if (
        filters.status &&
        filters.status !== 'ALL' &&
        (offering.closure?.status ?? 'OPEN') !==
          filters.status
      ) {
        return false;
      }

      return true;
    });
}

async function loadOffering(
  institutionId: string,
  subjectOfferingId: string,
): Promise<TermClosureOffering> {
  const offerings = await listOfferings(institutionId, {});
  const offering = offerings.find(
    (item) => item.id === subjectOfferingId,
  );

  if (!offering) {
    throw new TermClosingServiceError(
      'TERM_CLOSURE_INVALID_PERIOD',
      'Oferta academica nao encontrada para esta instituicao.',
    );
  }

  return offering;
}

async function loadEnrollments(
  offering: TermClosureOffering,
): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      `
      id,
      student_id,
      class_id,
      academic_year_id,
      status,
      active,
      enrolled_at,
      students:student_id (
        id,
        profile_id,
        institution_id,
        registration_number,
        active,
        profiles:profile_id (
          full_name,
          email
        )
      )
    `,
    )
    .eq('class_id', offering.classId)
    .eq('academic_year_id', offering.academicYearId)
    .order('enrolled_at', {
      ascending: true,
    });

  if (error) {
    throw createTermClosingError(
      error,
      'TERM_CLOSURE_FORBIDDEN',
    );
  }

  return (data ?? []) as unknown as EnrollmentRow[];
}

async function loadAssessments(
  offering: TermClosureOffering,
): Promise<AssessmentRow[]> {
  const { data, error } = await supabase
    .from('assessments')
    .select(
      `
      id,
      title,
      assessment_type,
      assessment_date,
      max_score,
      weight,
      status,
      grades (
        id,
        student_id,
        score,
        status
      )
    `,
    )
    .eq('institution_id', offering.institutionId)
    .eq('subject_offering_id', offering.id)
    .eq('term_id', offering.termId)
    .neq('status', 'CANCELED')
    .order('assessment_date', {
      ascending: true,
    });

  if (error) {
    throw createTermClosingError(
      error,
      'TERM_CLOSURE_FORBIDDEN',
    );
  }

  return (data ?? []) as unknown as AssessmentRow[];
}

async function loadAttendanceSessions(
  offering: TermClosureOffering,
): Promise<AttendanceSessionRow[]> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select(
      `
      id,
      session_date,
      status,
      attendance_records (
        id,
        student_id,
        status
      )
    `,
    )
    .eq('institution_id', offering.institutionId)
    .eq('subject_offering_id', offering.id)
    .gte('session_date', offering.termStartDate)
    .lte('session_date', offering.termEndDate)
    .neq('status', 'CANCELED')
    .order('session_date', {
      ascending: true,
    });

  if (error) {
    throw createTermClosingError(
      error,
      'TERM_CLOSURE_FORBIDDEN',
    );
  }

  return (data ?? []) as unknown as AttendanceSessionRow[];
}

async function rpcClosure(
  name:
    | 'submit_term_closure'
    | 'close_term_closure',
  input: SubmitTermClosureInput,
): Promise<TermClosure> {
  const { data, error } = await supabase.rpc(name, {
    p_institution_id: input.institutionId,
    p_academic_year_id: input.academicYearId,
    p_term_id: input.termId,
    p_subject_offering_id: input.subjectOfferingId,
  });

  if (error || !data) {
    throw createTermClosingError(
      error,
      name === 'submit_term_closure'
        ? 'TERM_CLOSURE_HAS_PENDING_GRADES'
        : 'TERM_RESULT_INSUFFICIENT_DATA',
    );
  }

  const row = normalizeRelation(
    data as TermClosureRow | TermClosureRow[],
  );

  if (!row) {
    throw new TermClosingServiceError(
      'TERM_CLOSURE_INVALID_PERIOD',
      'Fechamento nao retornado pelo banco.',
    );
  }

  return normalizeClosure(row);
}

export const termClosingService = {
  async listTeacherOfferings(
    profileId: string,
    institutionId: string,
  ): Promise<TermClosureOffering[]> {
    return listOfferings(institutionId, {
      teacherProfileId: profileId,
    });
  },

  async listInstitutionOfferings(
    institutionId: string,
    filters: ListTermClosureOfferingsFilters = {},
  ): Promise<TermClosureOffering[]> {
    return listOfferings(institutionId, filters);
  },

  async getPreview(
    institutionId: string,
    subjectOfferingId: string,
  ): Promise<TermClosurePreview> {
    const offering = await loadOffering(
      institutionId,
      subjectOfferingId,
    );

    const [
      policy,
      enrollments,
      assessments,
      attendanceSessions,
    ] = await Promise.all([
      academicPolicyService.getActivePolicy(
        institutionId,
        offering.academicYearId,
      ),
      loadEnrollments(offering),
      loadAssessments(offering),
      loadAttendanceSessions(offering),
    ]);

    return buildTermClosurePreview(
      offering,
      policy,
      offering.closure,
      enrollments,
      assessments,
      attendanceSessions,
    );
  },

  async submitForReview(
    input: SubmitTermClosureInput,
  ): Promise<TermClosure> {
    const preview = await this.getPreview(
      input.institutionId,
      input.subjectOfferingId,
    );

    if (!preview.canSubmit) {
      throw new TermClosingServiceError(
        preview.issues.some(
          (issue) =>
            issue.code ===
            'ACADEMIC_POLICY_NOT_CONFIGURED',
        )
          ? 'ACADEMIC_POLICY_NOT_CONFIGURED'
          : 'TERM_CLOSURE_HAS_PENDING_GRADES',
        preview.issues
          .map((issue) => issue.message)
          .slice(0, 5)
          .join(' '),
      );
    }

    return rpcClosure('submit_term_closure', input);
  },

  async closeOffering(
    input: SubmitTermClosureInput,
  ): Promise<TermClosure> {
    const preview = await this.getPreview(
      input.institutionId,
      input.subjectOfferingId,
    );

    if (!preview.canClose) {
      throw new TermClosingServiceError(
        preview.issues.some(
          (issue) =>
            issue.code ===
            'ACADEMIC_POLICY_NOT_CONFIGURED',
        )
          ? 'ACADEMIC_POLICY_NOT_CONFIGURED'
          : 'TERM_RESULT_INSUFFICIENT_DATA',
        preview.issues
          .map((issue) => issue.message)
          .slice(0, 5)
          .join(' '),
      );
    }

    return rpcClosure('close_term_closure', input);
  },

  async reopenClosure(
    input: ReopenTermClosureInput,
  ): Promise<TermClosure> {
    if (!input.reason.trim()) {
      throw new TermClosingServiceError(
        'TERM_CLOSURE_REOPEN_REASON_REQUIRED',
        'Informe o motivo da reabertura.',
      );
    }

    const { data, error } = await supabase.rpc(
      'reopen_term_closure',
      {
        p_institution_id: input.institutionId,
        p_term_closure_id: input.termClosureId,
        p_reopen_reason: input.reason.trim(),
      },
    );

    if (error || !data) {
      throw createTermClosingError(
        error,
        'TERM_CLOSURE_FORBIDDEN',
      );
    }

    const row = normalizeRelation(
      data as TermClosureRow | TermClosureRow[],
    );

    if (!row) {
      throw new TermClosingServiceError(
        'TERM_CLOSURE_INVALID_PERIOD',
        'Fechamento nao retornado pelo banco.',
      );
    }

    return normalizeClosure(row);
  },
};
