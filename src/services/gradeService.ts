import { supabase } from '../lib/supabaseClient';

export const ASSESSMENT_TYPES = [
  'EXAM',
  'ASSIGNMENT',
  'PROJECT',
  'QUIZ',
  'OTHER',
] as const;

export type AssessmentType =
  (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'CLOSED',
  'CANCELED',
] as const;

export type AssessmentStatus =
  (typeof ASSESSMENT_STATUSES)[number];

export const GRADE_STATUSES = [
  'PENDING',
  'GRADED',
  'EXCUSED',
] as const;

export type GradeStatus =
  (typeof GRADE_STATUSES)[number];

export type GradeServiceErrorCode =
  | 'ASSESSMENT_NOT_FOUND'
  | 'ASSESSMENT_FORBIDDEN'
  | 'ASSESSMENT_PERIOD_INVALID'
  | 'ASSESSMENT_MAX_SCORE_INVALID'
  | 'ASSESSMENT_ALREADY_EXISTS'
  | 'GRADE_STUDENT_NOT_ENROLLED'
  | 'GRADE_OUT_OF_RANGE'
  | 'GRADE_SAVE_FAILED'
  | 'GRADE_FORBIDDEN';

export class GradeServiceError extends Error {
  readonly code: GradeServiceErrorCode;

  readonly originalError: unknown;

  constructor(
    code: GradeServiceErrorCode,
    message: string,
    originalError?: unknown,
  ) {
    super(message);
    this.name = 'GradeServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

interface ClassRelation {
  id: string;
  institution_id: string;
  academic_year_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
  active: boolean | null;
}

interface SubjectRelation {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  workload: number | null;
  active: boolean | null;
}

interface TeacherRelation {
  full_name: string;
  email: string;
  active: boolean | null;
}

interface TermRelation {
  id: string;
  academic_year_id: string;
  name: string;
  active: boolean | null;
}

interface OfferingQueryRow {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  term_id: string;
  active: boolean | null;
  created_at: string | null;
  classes: ClassRelation | ClassRelation[] | null;
  subjects: SubjectRelation | SubjectRelation[] | null;
  profiles: TeacherRelation | TeacherRelation[] | null;
  terms: TermRelation | TermRelation[] | null;
}

interface AssessmentQueryRow {
  id: string;
  institution_id: string;
  subject_offering_id: string;
  term_id: string | null;
  title: string;
  description: string | null;
  assessment_type: string;
  assessment_date: string;
  max_score: number | string;
  weight: number | string;
  status: string;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  subject_offerings:
    | OfferingQueryRow
    | OfferingQueryRow[]
    | null;
}

interface ProfileRelation {
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

interface StudentRelation {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  active: boolean | null;
  profiles: ProfileRelation | ProfileRelation[] | null;
}

interface EnrollmentQueryRow {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  status: string | null;
  active: boolean | null;
  enrolled_at: string | null;
  created_at: string | null;
  students: StudentRelation | StudentRelation[] | null;
}

interface GradeQueryRow {
  id: string;
  institution_id: string;
  assessment_id: string;
  student_id: string;
  score: number | string | null;
  status: string;
  feedback: string | null;
  recorded_by: string | null;
  recorded_at: string | null;
  created_at: string;
  updated_at: string;
  students?: StudentRelation | StudentRelation[] | null;
  assessments?: AssessmentQueryRow | AssessmentQueryRow[] | null;
}

interface AssessmentWithGradesQueryRow
  extends AssessmentQueryRow {
  grades: GradeQueryRow[] | null;
}

export interface GradeOffering {
  id: string;
  institutionId: string;
  classId: string;
  subjectId: string;
  teacherProfileId: string;
  termId: string;
  academicYearId: string;
  className: string;
  gradeLevel: string | null;
  shift: string | null;
  subjectName: string;
  subjectCode: string | null;
  workload: number | null;
  teacherName: string;
  teacherEmail: string;
  termName: string | null;
}

export interface AssessmentRecord {
  id: string;
  institutionId: string;
  subjectOfferingId: string;
  termId: string | null;
  title: string;
  description: string | null;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxScore: number;
  weight: number;
  status: AssessmentStatus;
  createdBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  offering: GradeOffering | null;
}

export interface GradeStudent {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  registrationNumber: string;
  enrollmentId: string | null;
}

export interface GradeEntryRecord {
  gradeId: string | null;
  student: GradeStudent;
  score: number | null;
  status: GradeStatus;
  feedback: string | null;
  recordedAt: string | null;
}

export interface GradeEntry {
  assessment: AssessmentRecord;
  records: GradeEntryRecord[];
}

export interface CreateAssessmentInput {
  institutionId: string;
  subjectOfferingId: string;
  termId: string | null;
  title: string;
  description?: string | null;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxScore: number;
  weight: number;
  status: AssessmentStatus;
  profileId: string;
}

export interface UpdateAssessmentInput
  extends CreateAssessmentInput {
  id: string;
}

export interface SaveGradeInput {
  studentId: string;
  score: number | null;
  status?: GradeStatus;
  feedback?: string | null;
}

export interface SaveGradesInput {
  institutionId: string;
  assessmentId: string;
  profileId: string;
  grades: SaveGradeInput[];
}

export interface GradeSummaryInput {
  score: number | null;
  maxScore: number;
  weight?: number;
  status: GradeStatus;
}

export interface GradeSummary {
  totalAssessments: number;
  gradedCount: number;
  pendingCount: number;
  excusedCount: number;
  averageScore: number | null;
  averagePercent: number | null;
  weightedAveragePercent: number | null;
}

export interface StudentGradeRecord {
  assessmentId: string;
  gradeId: string | null;
  subjectOfferingId: string;
  studentId: string;
  title: string;
  subjectName: string;
  subjectCode: string | null;
  className: string;
  teacherName: string;
  termName: string | null;
  assessmentDate: string;
  assessmentType: AssessmentType;
  maxScore: number;
  weight: number;
  score: number | null;
  status: GradeStatus;
  feedback: string | null;
  percentage: number | null;
  recordedAt: string | null;
}

export interface StudentGradeSummary {
  summary: GradeSummary;
  records: StudentGradeRecord[];
  recentRecords: StudentGradeRecord[];
}

export interface InstitutionGradeFilters {
  fromDate?: string;
  toDate?: string;
  termId?: string;
  classId?: string;
  subjectId?: string;
  teacherProfileId?: string;
  studentId?: string;
}

export interface GradeFilterOption {
  id: string;
  label: string;
}

export interface InstitutionAssessmentResult {
  assessment: AssessmentRecord;
  studentIds: string[];
  expectedStudentCount: number;
  launchedCount: number;
  missingCount: number;
  excusedCount: number;
  averageScore: number | null;
  averagePercent: number | null;
}

export interface InstitutionGradeSummary {
  summary: GradeSummary;
  assessments: InstitutionAssessmentResult[];
  filters: {
    terms: GradeFilterOption[];
    classes: GradeFilterOption[];
    subjects: GradeFilterOption[];
    teachers: GradeFilterOption[];
    students: GradeFilterOption[];
  };
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

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeAssessmentType(
  value: string | null | undefined,
): AssessmentType {
  const normalized = value?.trim().toUpperCase();

  if (
    ASSESSMENT_TYPES.includes(
      normalized as AssessmentType,
    )
  ) {
    return normalized as AssessmentType;
  }

  return 'OTHER';
}

function normalizeAssessmentStatus(
  value: string | null | undefined,
): AssessmentStatus {
  const normalized = value?.trim().toUpperCase();

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
  value: string | null | undefined,
): GradeStatus {
  const normalized = value?.trim().toUpperCase();

  if (
    GRADE_STATUSES.includes(
      normalized as GradeStatus,
    )
  ) {
    return normalized as GradeStatus;
  }

  return 'PENDING';
}

function isSupabaseErrorLike(
  error: unknown,
): error is SupabaseErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('code' in error || 'message' in error)
  );
}

function createGradeError(
  error: unknown,
  fallbackCode: GradeServiceErrorCode,
): GradeServiceError {
  if (error instanceof GradeServiceError) {
    return error;
  }

  if (isSupabaseErrorLike(error)) {
    if (
      error.code === '42501' ||
      error.message?.toLowerCase().includes('permission')
    ) {
      return new GradeServiceError(
        fallbackCode === 'GRADE_SAVE_FAILED'
          ? 'GRADE_FORBIDDEN'
          : 'ASSESSMENT_FORBIDDEN',
        'Você não tem permissão para acessar ou alterar estas notas.',
        error,
      );
    }

    if (error.code === '23505') {
      return new GradeServiceError(
        fallbackCode === 'GRADE_SAVE_FAILED'
          ? 'GRADE_SAVE_FAILED'
          : 'ASSESSMENT_ALREADY_EXISTS',
        'Já existe um registro equivalente.',
        error,
      );
    }

    if (error.code === '23514') {
      return new GradeServiceError(
        fallbackCode,
        'Os dados informados violam uma regra acadêmica.',
        error,
      );
    }
  }

  return new GradeServiceError(
    fallbackCode,
    'Não foi possível concluir a operação de notas.',
    error,
  );
}

function getDateEndTimestamp(value: string): number {
  return new Date(`${value}T23:59:59.999Z`).getTime();
}

export function isEnrollmentValidForAssessmentDate(
  enrollment: {
    active: boolean | null | undefined;
    status: string | null | undefined;
    enrolled_at: string | null | undefined;
  },
  assessmentDate: string,
): boolean {
  if (!isActive(enrollment.active)) {
    return false;
  }

  const status =
    enrollment.status?.trim().toUpperCase() ?? 'ACTIVE';

  if (status !== 'ACTIVE') {
    return false;
  }

  if (!enrollment.enrolled_at) {
    return true;
  }

  const enrollmentTime = new Date(
    enrollment.enrolled_at,
  ).getTime();
  const assessmentEndTime =
    getDateEndTimestamp(assessmentDate);

  return (
    Number.isFinite(enrollmentTime) &&
    Number.isFinite(assessmentEndTime) &&
    enrollmentTime <= assessmentEndTime
  );
}

export function calculateGradePercentage(
  score: number | null,
  maxScore: number,
): number | null {
  if (score === null || maxScore <= 0) {
    return null;
  }

  return roundOne((score / maxScore) * 100);
}

export function calculateGradeSummary(
  records: readonly GradeSummaryInput[],
): GradeSummary {
  let gradedCount = 0;
  let excusedCount = 0;
  let scoreTotal = 0;
  let percentTotal = 0;
  let weightedPercentTotal = 0;
  let weightTotal = 0;

  for (const record of records) {
    if (record.status === 'EXCUSED') {
      excusedCount += 1;
      continue;
    }

    if (
      record.status !== 'GRADED' ||
      record.score === null ||
      record.maxScore <= 0
    ) {
      continue;
    }

    const percentage = calculateGradePercentage(
      record.score,
      record.maxScore,
    );

    if (percentage === null) {
      continue;
    }

    gradedCount += 1;
    scoreTotal += record.score;
    percentTotal += percentage;

    const weight = record.weight ?? 1;

    if (weight > 0) {
      weightedPercentTotal += percentage * weight;
      weightTotal += weight;
    }
  }

  const totalAssessments = records.length;

  return {
    totalAssessments,
    gradedCount,
    pendingCount:
      totalAssessments - gradedCount - excusedCount,
    excusedCount,
    averageScore:
      gradedCount === 0
        ? null
        : roundTwo(scoreTotal / gradedCount),
    averagePercent:
      gradedCount === 0
        ? null
        : roundOne(percentTotal / gradedCount),
    weightedAveragePercent:
      weightTotal === 0
        ? null
        : roundOne(weightedPercentTotal / weightTotal),
  };
}

function assertAssessmentInput(
  input: CreateAssessmentInput | UpdateAssessmentInput,
): void {
  if (!normalizeOptionalText(input.title)) {
    throw new GradeServiceError(
      'ASSESSMENT_NOT_FOUND',
      'Informe o título da avaliação.',
    );
  }

  if (input.maxScore <= 0) {
    throw new GradeServiceError(
      'ASSESSMENT_MAX_SCORE_INVALID',
      'A pontuação máxima deve ser maior que zero.',
    );
  }

  if (input.weight <= 0) {
    throw new GradeServiceError(
      'ASSESSMENT_MAX_SCORE_INVALID',
      'O peso da avaliação deve ser maior que zero.',
    );
  }

  if (
    input.termId !== null &&
    input.termId.trim().length === 0
  ) {
    throw new GradeServiceError(
      'ASSESSMENT_PERIOD_INVALID',
      'O período informado é inválido.',
    );
  }
}

export function normalizeGradeInput(
  grade: SaveGradeInput,
  maxScore: number,
): SaveGradeInput {
  const status = grade.status ?? (
    grade.score === null ? 'PENDING' : 'GRADED'
  );

  if (grade.score !== null) {
    if (grade.score < 0 || grade.score > maxScore) {
      throw new GradeServiceError(
        'GRADE_OUT_OF_RANGE',
        'A nota deve ficar entre zero e a pontuação máxima da avaliação.',
      );
    }

    return {
      ...grade,
      status: 'GRADED',
      feedback: normalizeOptionalText(grade.feedback),
    };
  }

  if (status === 'GRADED') {
    throw new GradeServiceError(
      'GRADE_OUT_OF_RANGE',
      'Nota vazia não pode ser marcada como lançada.',
    );
  }

  return {
    ...grade,
    score: null,
    status,
    feedback: normalizeOptionalText(grade.feedback),
  };
}

function normalizeOffering(
  row: OfferingQueryRow,
  institutionId: string,
): GradeOffering | null {
  const classRecord = normalizeRelation(row.classes);
  const subject = normalizeRelation(row.subjects);
  const teacher = normalizeRelation(row.profiles);
  const term = normalizeRelation(row.terms);

  if (
    !classRecord ||
    !subject ||
    classRecord.institution_id !== institutionId ||
    subject.institution_id !== institutionId ||
    !isActive(row.active) ||
    !isActive(classRecord.active) ||
    !isActive(subject.active)
  ) {
    return null;
  }

  return {
    id: row.id,
    institutionId,
    classId: row.class_id,
    subjectId: row.subject_id,
    teacherProfileId: row.teacher_profile_id,
    termId: row.term_id,
    academicYearId: classRecord.academic_year_id,
    className: classRecord.name,
    gradeLevel: classRecord.grade_level,
    shift: classRecord.shift,
    subjectName: subject.name,
    subjectCode: subject.code,
    workload: subject.workload,
    teacherName: teacher?.full_name ?? 'Professor',
    teacherEmail: teacher?.email ?? '',
    termName: term?.name ?? null,
  };
}

function normalizeAssessment(
  row: AssessmentQueryRow,
  institutionId: string,
): AssessmentRecord | null {
  const offeringRow = normalizeRelation(
    row.subject_offerings,
  );
  const offering = offeringRow
    ? normalizeOffering(offeringRow, institutionId)
    : null;

  if (row.institution_id !== institutionId) {
    return null;
  }

  return {
    id: row.id,
    institutionId: row.institution_id,
    subjectOfferingId: row.subject_offering_id,
    termId: row.term_id,
    title: row.title,
    description: row.description,
    assessmentType: normalizeAssessmentType(
      row.assessment_type,
    ),
    assessmentDate: row.assessment_date,
    maxScore: toNumber(row.max_score),
    weight: toNumber(row.weight),
    status: normalizeAssessmentStatus(row.status),
    createdBy: row.created_by,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    offering,
  };
}

function normalizeStudent(
  row: StudentRelation,
  enrollmentId: string | null,
): GradeStudent | null {
  const profile = normalizeRelation(row.profiles);

  if (!profile || !isActive(row.active)) {
    return null;
  }

  return {
    id: row.id,
    profileId: row.profile_id,
    fullName: profile.full_name,
    email: profile.email,
    registrationNumber: row.registration_number,
    enrollmentId,
  };
}

function normalizeGrade(row: GradeQueryRow): {
  id: string;
  studentId: string;
  score: number | null;
  status: GradeStatus;
  feedback: string | null;
  recordedAt: string | null;
  student: GradeStudent | null;
} {
  const studentRelation = normalizeRelation(row.students);

  return {
    id: row.id,
    studentId: row.student_id,
    score:
      row.score === null ? null : toNumber(row.score),
    status: normalizeGradeStatus(row.status),
    feedback: row.feedback,
    recordedAt: row.recorded_at,
    student: studentRelation
      ? normalizeStudent(studentRelation, null)
      : null,
  };
}

function sortGradeEntryRecords(
  first: GradeEntryRecord,
  second: GradeEntryRecord,
): number {
  return first.student.fullName.localeCompare(
    second.student.fullName,
    'pt-BR',
  );
}

export function buildGradeEntryRecords(
  students: readonly GradeStudent[],
  grades: readonly GradeQueryRow[],
): GradeEntryRecord[] {
  const gradesByStudent = new Map(
    grades.map((grade) => [
      grade.student_id,
      normalizeGrade(grade),
    ]),
  );

  const rows = students.map((student) => {
    const grade = gradesByStudent.get(student.id);

    return {
      gradeId: grade?.id ?? null,
      student,
      score: grade?.score ?? null,
      status: grade?.status ?? 'PENDING',
      feedback: grade?.feedback ?? null,
      recordedAt: grade?.recordedAt ?? null,
    };
  });

  for (const grade of grades) {
    if (students.some((student) => student.id === grade.student_id)) {
      continue;
    }

    const normalizedGrade = normalizeGrade(grade);

    if (!normalizedGrade.student) {
      continue;
    }

    rows.push({
      gradeId: normalizedGrade.id,
      student: normalizedGrade.student,
      score: normalizedGrade.score,
      status: normalizedGrade.status,
      feedback: normalizedGrade.feedback,
      recordedAt: normalizedGrade.recordedAt,
    });
  }

  return rows.sort(sortGradeEntryRecords);
}

async function getAssessment(
  institutionId: string,
  assessmentId: string,
): Promise<AssessmentRecord> {
  const { data, error } = await supabase
    .from('assessments')
    .select(
      `
      id,
      institution_id,
      subject_offering_id,
      term_id,
      title,
      description,
      assessment_type,
      assessment_date,
      max_score,
      weight,
      status,
      created_by,
      published_at,
      created_at,
      updated_at,
      subject_offerings:subject_offering_id (
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
          active
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
          active
        )
      )
    `,
    )
    .eq('id', assessmentId)
    .maybeSingle();

  if (error) {
    throw createGradeError(error, 'ASSESSMENT_FORBIDDEN');
  }

  if (!data) {
    throw new GradeServiceError(
      'ASSESSMENT_NOT_FOUND',
      'A avaliação selecionada não foi encontrada.',
    );
  }

  const assessment = normalizeAssessment(
    data as unknown as AssessmentQueryRow,
    institutionId,
  );

  if (!assessment) {
    throw new GradeServiceError(
      'ASSESSMENT_NOT_FOUND',
      'A avaliação selecionada não pertence a esta instituição.',
    );
  }

  return assessment;
}

async function getValidStudentsForAssessment(
  assessment: AssessmentRecord,
): Promise<GradeStudent[]> {
  if (!assessment.offering) {
    return [];
  }

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
      created_at,
      students:student_id (
        id,
        profile_id,
        institution_id,
        registration_number,
        active,
        profiles:profile_id (
          full_name,
          email,
          avatar_url
        )
      )
    `,
    )
    .eq('class_id', assessment.offering.classId)
    .eq('active', true)
    .lte(
      'enrolled_at',
      `${assessment.assessmentDate}T23:59:59.999Z`,
    )
    .order('created_at', {
      ascending: true,
    });

  if (error) {
    throw createGradeError(error, 'GRADE_FORBIDDEN');
  }

  const students = new Map<string, GradeStudent>();

  for (const row of (data ?? []) as unknown as EnrollmentQueryRow[]) {
    const student = normalizeRelation(row.students);

    if (
      !student ||
      student.institution_id !== assessment.institutionId ||
      !isEnrollmentValidForAssessmentDate(
        row,
        assessment.assessmentDate,
      )
    ) {
      continue;
    }

    const normalizedStudent = normalizeStudent(
      student,
      row.id,
    );

    if (normalizedStudent) {
      students.set(
        normalizedStudent.id,
        normalizedStudent,
      );
    }
  }

  return Array.from(students.values()).sort((first, second) =>
    first.fullName.localeCompare(second.fullName, 'pt-BR'),
  );
}

async function getGradesForAssessment(
  assessmentId: string,
): Promise<GradeQueryRow[]> {
  const { data, error } = await supabase
    .from('grades')
    .select(
      `
      id,
      institution_id,
      assessment_id,
      student_id,
      score,
      status,
      feedback,
      recorded_by,
      recorded_at,
      created_at,
      updated_at,
      students:student_id (
        id,
        profile_id,
        institution_id,
        registration_number,
        active,
        profiles:profile_id (
          full_name,
          email,
          avatar_url
        )
      )
    `,
    )
    .eq('assessment_id', assessmentId)
    .order('created_at', {
      ascending: true,
    });

  if (error) {
    throw createGradeError(error, 'GRADE_FORBIDDEN');
  }

  return (data ?? []) as unknown as GradeQueryRow[];
}

function assertStudentsCanBeGraded(
  inputGrades: readonly SaveGradeInput[],
  validStudents: readonly GradeStudent[],
  existingGrades: readonly GradeQueryRow[],
): void {
  const allowedStudentIds = new Set([
    ...validStudents.map((student) => student.id),
    ...existingGrades.map((grade) => grade.student_id),
  ]);

  const invalidGrade = inputGrades.find(
    (grade) => !allowedStudentIds.has(grade.studentId),
  );

  if (invalidGrade) {
    throw new GradeServiceError(
      'GRADE_STUDENT_NOT_ENROLLED',
      'Há aluno sem matrícula válida para esta avaliação.',
    );
  }
}

function shouldPersistGrade(
  grade: SaveGradeInput,
  existingGradeIds: ReadonlySet<string>,
): boolean {
  if (existingGradeIds.has(grade.studentId)) {
    return true;
  }

  return (
    grade.score !== null ||
    grade.status === 'EXCUSED' ||
    Boolean(normalizeOptionalText(grade.feedback))
  );
}

function normalizeStudentGradeRecord(
  assessment: AssessmentRecord,
  grade: GradeQueryRow | null,
  studentId: string,
): StudentGradeRecord | null {
  if (!assessment.offering) {
    return null;
  }

  const score =
    grade?.score === null || grade?.score === undefined
      ? null
      : toNumber(grade.score);
  const status = grade
    ? normalizeGradeStatus(grade.status)
    : 'PENDING';

  return {
    assessmentId: assessment.id,
    gradeId: grade?.id ?? null,
    subjectOfferingId: assessment.subjectOfferingId,
    studentId,
    title: assessment.title,
    subjectName: assessment.offering.subjectName,
    subjectCode: assessment.offering.subjectCode,
    className: assessment.offering.className,
    teacherName: assessment.offering.teacherName,
    termName: assessment.offering.termName,
    assessmentDate: assessment.assessmentDate,
    assessmentType: assessment.assessmentType,
    maxScore: assessment.maxScore,
    weight: assessment.weight,
    score,
    status,
    feedback: grade?.feedback ?? null,
    percentage: calculateGradePercentage(
      score,
      assessment.maxScore,
    ),
    recordedAt: grade?.recorded_at ?? null,
  };
}

function compareGradeRecords(
  first: StudentGradeRecord,
  second: StudentGradeRecord,
): number {
  return second.assessmentDate.localeCompare(
    first.assessmentDate,
  );
}

async function getActiveStudentOfferingIds(
  institutionId: string,
  studentId: string,
): Promise<string[]> {
  const { data: enrollmentData, error: enrollmentError } =
    await supabase
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
        created_at,
        students:student_id (
          id,
          profile_id,
          institution_id,
          registration_number,
          active,
          profiles:profile_id (
            full_name,
            email,
            avatar_url
          )
        )
      `,
      )
      .eq('student_id', studentId)
      .eq('active', true);

  if (enrollmentError) {
    throw createGradeError(
      enrollmentError,
      'GRADE_FORBIDDEN',
    );
  }

  const classIds = Array.from(
    new Set(
      ((enrollmentData ?? []) as unknown as EnrollmentQueryRow[])
        .filter((enrollment) => {
          const student = normalizeRelation(
            enrollment.students,
          );

          return (
            student?.institution_id === institutionId &&
            isActive(enrollment.active) &&
            (
              enrollment.status?.trim().toUpperCase() ??
              'ACTIVE'
            ) === 'ACTIVE'
          );
        })
        .map((enrollment) => enrollment.class_id),
    ),
  );

  if (classIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('subject_offerings')
    .select('id, class_id, active')
    .in('class_id', classIds)
    .eq('active', true);

  if (error) {
    throw createGradeError(error, 'GRADE_FORBIDDEN');
  }

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      class_id: string;
      active: boolean | null;
    }>
  )
    .filter((row) => isActive(row.active))
    .map((row) => row.id);
}

async function getAssessmentsForOfferings(
  institutionId: string,
  offeringIds: readonly string[],
): Promise<AssessmentRecord[]> {
  if (offeringIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('assessments')
    .select(
      `
      id,
      institution_id,
      subject_offering_id,
      term_id,
      title,
      description,
      assessment_type,
      assessment_date,
      max_score,
      weight,
      status,
      created_by,
      published_at,
      created_at,
      updated_at,
      subject_offerings:subject_offering_id (
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
          active
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
          active
        )
      )
    `,
    )
    .eq('institution_id', institutionId)
    .in('subject_offering_id', [...offeringIds])
    .in('status', ['PUBLISHED', 'CLOSED'])
    .order('assessment_date', {
      ascending: false,
    })
    .limit(500);

  if (error) {
    throw createGradeError(error, 'ASSESSMENT_FORBIDDEN');
  }

  return (
    (data ?? []) as unknown as AssessmentQueryRow[]
  )
    .map((row) => normalizeAssessment(row, institutionId))
    .filter(
      (
        assessment,
      ): assessment is AssessmentRecord =>
        assessment !== null && assessment.offering !== null,
    );
}

async function getStudentGrades(
  institutionId: string,
  studentId: string,
): Promise<GradeQueryRow[]> {
  const { data, error } = await supabase
    .from('grades')
    .select(
      `
      id,
      institution_id,
      assessment_id,
      student_id,
      score,
      status,
      feedback,
      recorded_by,
      recorded_at,
      created_at,
      updated_at,
      assessments:assessment_id (
        id,
        institution_id,
        subject_offering_id,
        term_id,
        title,
        description,
        assessment_type,
        assessment_date,
        max_score,
        weight,
        status,
        created_by,
        published_at,
        created_at,
        updated_at,
        subject_offerings:subject_offering_id (
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
            active
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
            active
          )
        )
      )
    `,
    )
    .eq('institution_id', institutionId)
    .eq('student_id', studentId)
    .order('recorded_at', {
      ascending: false,
      nullsFirst: false,
    })
    .limit(500);

  if (error) {
    throw createGradeError(error, 'GRADE_FORBIDDEN');
  }

  return (data ?? []) as unknown as GradeQueryRow[];
}

async function getEnrollmentsForClasses(
  classIds: readonly string[],
): Promise<EnrollmentQueryRow[]> {
  if (classIds.length === 0) {
    return [];
  }

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
      created_at,
      students:student_id (
        id,
        profile_id,
        institution_id,
        registration_number,
        active,
        profiles:profile_id (
          full_name,
          email,
          avatar_url
        )
      )
    `,
    )
    .in('class_id', [...classIds])
    .order('created_at', {
      ascending: true,
    });

  if (error) {
    throw createGradeError(error, 'GRADE_FORBIDDEN');
  }

  return (data ?? []) as unknown as EnrollmentQueryRow[];
}

function buildStudentGradeRecords(
  assessments: readonly AssessmentRecord[],
  grades: readonly GradeQueryRow[],
  institutionId: string,
  studentId: string,
): StudentGradeRecord[] {
  const assessmentsById = new Map(
    assessments.map((assessment) => [
      assessment.id,
      assessment,
    ]),
  );

  const gradesByAssessment = new Map(
    grades.map((grade) => [
      grade.assessment_id,
      grade,
    ]),
  );

  for (const grade of grades) {
    const assessmentRow = normalizeRelation(
      grade.assessments,
    );

    if (!assessmentRow) {
      continue;
    }

    const assessment = normalizeAssessment(
      assessmentRow,
      institutionId,
    );

    if (
      assessment &&
      assessment.offering &&
      assessment.status !== 'DRAFT' &&
      assessment.status !== 'CANCELED'
    ) {
      assessmentsById.set(assessment.id, assessment);
    }
  }

  return Array.from(assessmentsById.values())
    .map((assessment) =>
      normalizeStudentGradeRecord(
        assessment,
        gradesByAssessment.get(assessment.id) ?? null,
        studentId,
      ),
    )
    .filter(
      (
        record,
      ): record is StudentGradeRecord => record !== null,
    )
    .sort(compareGradeRecords);
}

function buildAssessmentMutationPayload(
  input: CreateAssessmentInput | UpdateAssessmentInput,
) {
  return {
    institution_id: input.institutionId,
    subject_offering_id: input.subjectOfferingId,
    term_id: input.termId,
    title: normalizeOptionalText(input.title) ?? '',
    description: normalizeOptionalText(input.description),
    assessment_type: input.assessmentType,
    assessment_date: input.assessmentDate,
    max_score: input.maxScore,
    weight: input.weight,
    status: input.status,
    created_by: input.profileId,
  };
}

function buildFilterOptions(
  assessments: readonly InstitutionAssessmentResult[],
  enrollmentRows: readonly EnrollmentQueryRow[],
): InstitutionGradeSummary['filters'] {
  const terms = new Map<string, string>();
  const classes = new Map<string, string>();
  const subjects = new Map<string, string>();
  const teachers = new Map<string, string>();
  const students = new Map<string, string>();

  for (const result of assessments) {
    const offering = result.assessment.offering;

    if (!offering) {
      continue;
    }

    if (result.assessment.termId && offering.termName) {
      terms.set(result.assessment.termId, offering.termName);
    }

    classes.set(offering.classId, offering.className);
    subjects.set(offering.subjectId, offering.subjectName);
    teachers.set(
      offering.teacherProfileId,
      offering.teacherName,
    );
  }

  for (const enrollment of enrollmentRows) {
    const student = normalizeRelation(enrollment.students);
    const profile = normalizeRelation(student?.profiles);

    if (!student || !profile) {
      continue;
    }

    students.set(
      student.id,
      `${profile.full_name} · ${student.registration_number}`,
    );
  }

  const toOptions = (
    values: Map<string, string>,
  ): GradeFilterOption[] =>
    Array.from(values.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((first, second) =>
        first.label.localeCompare(second.label, 'pt-BR'),
      );

  return {
    terms: toOptions(terms),
    classes: toOptions(classes),
    subjects: toOptions(subjects),
    teachers: toOptions(teachers),
    students: toOptions(students),
  };
}

function filterInstitutionAssessments(
  rows: readonly InstitutionAssessmentResult[],
  filters: InstitutionGradeFilters,
): InstitutionAssessmentResult[] {
  return rows.filter((result) => {
    const assessment = result.assessment;
    const offering = assessment.offering;

    if (!offering) {
      return false;
    }

    if (filters.termId && assessment.termId !== filters.termId) {
      return false;
    }

    if (filters.classId && offering.classId !== filters.classId) {
      return false;
    }

    if (
      filters.subjectId &&
      offering.subjectId !== filters.subjectId
    ) {
      return false;
    }

    if (
      filters.teacherProfileId &&
      offering.teacherProfileId !== filters.teacherProfileId
    ) {
      return false;
    }

    if (
      filters.studentId &&
      !result.studentIds.includes(filters.studentId)
    ) {
      return false;
    }

    return true;
  });
}

export const gradeService = {
  async listTeacherOfferings(
    profileId: string,
    institutionId: string,
  ): Promise<GradeOffering[]> {
    const { data, error } = await supabase
      .from('subject_offerings')
      .select(
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
          active
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
          active
        )
      `,
      )
      .eq('teacher_profile_id', profileId)
      .eq('active', true)
      .order('created_at', {
        ascending: true,
      });

    if (error) {
      throw createGradeError(error, 'ASSESSMENT_FORBIDDEN');
    }

    return (
      (data ?? []) as unknown as OfferingQueryRow[]
    )
      .map((row) => normalizeOffering(row, institutionId))
      .filter(
        (
          offering,
        ): offering is GradeOffering => offering !== null,
      )
      .sort((first, second) =>
        first.subjectName.localeCompare(
          second.subjectName,
          'pt-BR',
        ),
      );
  },

  async listAssessments(
    institutionId: string,
    filters: {
      subjectOfferingId?: string;
      termId?: string;
      status?: AssessmentStatus;
    } = {},
  ): Promise<AssessmentRecord[]> {
    let query = supabase
      .from('assessments')
      .select(
        `
        id,
        institution_id,
        subject_offering_id,
        term_id,
        title,
        description,
        assessment_type,
        assessment_date,
        max_score,
        weight,
        status,
        created_by,
        published_at,
        created_at,
        updated_at,
        subject_offerings:subject_offering_id (
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
            active
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
            active
          )
        )
      `,
      )
      .eq('institution_id', institutionId)
      .order('assessment_date', {
        ascending: false,
      });

    if (filters.subjectOfferingId) {
      query = query.eq(
        'subject_offering_id',
        filters.subjectOfferingId,
      );
    }

    if (filters.termId) {
      query = query.eq('term_id', filters.termId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      throw createGradeError(error, 'ASSESSMENT_FORBIDDEN');
    }

    return (
      (data ?? []) as unknown as AssessmentQueryRow[]
    )
      .map((row) => normalizeAssessment(row, institutionId))
      .filter(
        (
          assessment,
        ): assessment is AssessmentRecord =>
          assessment !== null,
      );
  },

  async createAssessment(
    input: CreateAssessmentInput,
  ): Promise<AssessmentRecord> {
    assertAssessmentInput(input);

    const { data, error } = await supabase
      .from('assessments')
      .insert(buildAssessmentMutationPayload(input))
      .select(
        `
        id,
        institution_id,
        subject_offering_id,
        term_id,
        title,
        description,
        assessment_type,
        assessment_date,
        max_score,
        weight,
        status,
        created_by,
        published_at,
        created_at,
        updated_at,
        subject_offerings:subject_offering_id (
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
            active
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
            active
          )
        )
      `,
      )
      .single();

    if (error) {
      throw createGradeError(error, 'ASSESSMENT_FORBIDDEN');
    }

    const assessment = normalizeAssessment(
      data as unknown as AssessmentQueryRow,
      input.institutionId,
    );

    if (!assessment) {
      throw new GradeServiceError(
        'ASSESSMENT_NOT_FOUND',
        'A avaliação criada não pôde ser carregada.',
      );
    }

    return assessment;
  },

  async updateAssessment(
    input: UpdateAssessmentInput,
  ): Promise<AssessmentRecord> {
    assertAssessmentInput(input);

    const { data, error } = await supabase
      .from('assessments')
      .update(buildAssessmentMutationPayload(input))
      .eq('id', input.id)
      .select(
        `
        id,
        institution_id,
        subject_offering_id,
        term_id,
        title,
        description,
        assessment_type,
        assessment_date,
        max_score,
        weight,
        status,
        created_by,
        published_at,
        created_at,
        updated_at,
        subject_offerings:subject_offering_id (
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
            active
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
            active
          )
        )
      `,
      )
      .single();

    if (error) {
      throw createGradeError(error, 'ASSESSMENT_FORBIDDEN');
    }

    const assessment = normalizeAssessment(
      data as unknown as AssessmentQueryRow,
      input.institutionId,
    );

    if (!assessment) {
      throw new GradeServiceError(
        'ASSESSMENT_NOT_FOUND',
        'A avaliação atualizada não pôde ser carregada.',
      );
    }

    return assessment;
  },

  async loadGradeEntry(
    institutionId: string,
    assessmentId: string,
  ): Promise<GradeEntry> {
    const assessment = await getAssessment(
      institutionId,
      assessmentId,
    );
    const [students, grades] = await Promise.all([
      getValidStudentsForAssessment(assessment),
      getGradesForAssessment(assessmentId),
    ]);

    return {
      assessment,
      records: buildGradeEntryRecords(students, grades),
    };
  },

  async saveGrades(
    input: SaveGradesInput,
  ): Promise<GradeEntry> {
    const assessment = await getAssessment(
      input.institutionId,
      input.assessmentId,
    );
    const [students, existingGrades] = await Promise.all([
      getValidStudentsForAssessment(assessment),
      getGradesForAssessment(input.assessmentId),
    ]);

    assertStudentsCanBeGraded(
      input.grades,
      students,
      existingGrades,
    );

    const existingGradeIds = new Set(
      existingGrades.map((grade) => grade.student_id),
    );
    const normalizedGrades = input.grades
      .map((grade) =>
        normalizeGradeInput(grade, assessment.maxScore),
      )
      .filter((grade) =>
        shouldPersistGrade(grade, existingGradeIds),
      );

    if (normalizedGrades.length > 0) {
      const { error } = await supabase
        .from('grades')
        .upsert(
          normalizedGrades.map((grade) => ({
            institution_id: input.institutionId,
            assessment_id: input.assessmentId,
            student_id: grade.studentId,
            score: grade.score,
            status: grade.status,
            feedback: normalizeOptionalText(
              grade.feedback,
            ),
            recorded_by: input.profileId,
          })),
          {
            onConflict: 'assessment_id,student_id',
          },
        );

      if (error) {
        throw createGradeError(error, 'GRADE_SAVE_FAILED');
      }
    }

    return this.loadGradeEntry(
      input.institutionId,
      input.assessmentId,
    );
  },

  async getStudentGradeSummary(
    institutionId: string,
    studentId: string,
  ): Promise<StudentGradeSummary> {
    const [offeringIds, grades] = await Promise.all([
      getActiveStudentOfferingIds(institutionId, studentId),
      getStudentGrades(institutionId, studentId),
    ]);
    const assessments = await getAssessmentsForOfferings(
      institutionId,
      offeringIds,
    );
    const records = buildStudentGradeRecords(
      assessments,
      grades,
      institutionId,
      studentId,
    );

    return {
      summary: calculateGradeSummary(records),
      records,
      recentRecords: records.slice(0, 6),
    };
  },

  async getInstitutionGradeSummary(
    institutionId: string,
    filters: InstitutionGradeFilters = {},
  ): Promise<InstitutionGradeSummary> {
    const fromDate = filters.fromDate ?? '1900-01-01';
    const toDate = filters.toDate ?? '2999-12-31';

    const { data, error } = await supabase
      .from('assessments')
      .select(
        `
        id,
        institution_id,
        subject_offering_id,
        term_id,
        title,
        description,
        assessment_type,
        assessment_date,
        max_score,
        weight,
        status,
        created_by,
        published_at,
        created_at,
        updated_at,
        subject_offerings:subject_offering_id (
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
            active
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
            active
          )
        ),
        grades (
          id,
          institution_id,
          assessment_id,
          student_id,
          score,
          status,
          feedback,
          recorded_by,
          recorded_at,
          created_at,
          updated_at,
          students:student_id (
            id,
            profile_id,
            institution_id,
            registration_number,
            active,
            profiles:profile_id (
              full_name,
              email,
              avatar_url
            )
          )
        )
      `,
      )
      .eq('institution_id', institutionId)
      .neq('status', 'CANCELED')
      .gte('assessment_date', fromDate)
      .lte('assessment_date', toDate)
      .order('assessment_date', {
        ascending: false,
      })
      .limit(250);

    if (error) {
      throw createGradeError(error, 'ASSESSMENT_FORBIDDEN');
    }

    const assessments = (
      (data ?? []) as unknown as AssessmentWithGradesQueryRow[]
    )
      .map((row) => ({
        assessment: normalizeAssessment(row, institutionId),
        grades: row.grades ?? [],
      }))
      .filter(
        (entry): entry is {
          assessment: AssessmentRecord;
          grades: GradeQueryRow[];
        } =>
          entry.assessment !== null &&
          entry.assessment.offering !== null,
      );

    const classIds = Array.from(
      new Set(
        assessments
          .map(
            ({ assessment }) =>
              assessment.offering?.classId,
          )
          .filter(
            (classId): classId is string =>
              Boolean(classId),
          ),
      ),
    );
    const enrollmentRows =
      await getEnrollmentsForClasses(classIds);

    const results = assessments.map(({ assessment, grades }) => {
      const offering = assessment.offering;
      const expectedStudentIds = new Set(
        enrollmentRows
          .filter((enrollment) => {
            const student = normalizeRelation(
              enrollment.students,
            );

            return (
              offering !== null &&
              enrollment.class_id === offering.classId &&
              student?.institution_id === institutionId &&
              isEnrollmentValidForAssessmentDate(
                enrollment,
                assessment.assessmentDate,
              )
            );
          })
          .map((enrollment) => enrollment.student_id),
      );
      const relevantGrades = filters.studentId
        ? grades.filter(
            (grade) =>
              grade.student_id === filters.studentId,
          )
        : grades;

      for (const grade of relevantGrades) {
        expectedStudentIds.add(grade.student_id);
      }

      const gradeInputs = relevantGrades.map((grade) => ({
        score:
          grade.score === null ? null : toNumber(grade.score),
        maxScore: assessment.maxScore,
        weight: assessment.weight,
        status: normalizeGradeStatus(grade.status),
      }));
      const summary = calculateGradeSummary(gradeInputs);
      const expectedStudentCount = filters.studentId
        ? expectedStudentIds.has(filters.studentId)
          ? 1
          : 0
        : expectedStudentIds.size;
      const launchedCount =
        summary.gradedCount + summary.excusedCount;

      return {
        assessment,
        studentIds: Array.from(expectedStudentIds),
        expectedStudentCount,
        launchedCount,
        missingCount: Math.max(
          expectedStudentCount - launchedCount,
          0,
        ),
        excusedCount: summary.excusedCount,
        averageScore: summary.averageScore,
        averagePercent: summary.averagePercent,
      };
    });

    const filteredResults = filterInstitutionAssessments(
      results,
      filters,
    );
    const allGradeRecords = filteredResults.flatMap(
      (result) =>
        result.assessment.id
          ? [
              {
                score: result.averageScore,
                maxScore: result.assessment.maxScore,
                weight: result.assessment.weight,
                status:
                  result.averageScore === null
                    ? 'PENDING'
                    : 'GRADED',
              } satisfies GradeSummaryInput,
            ]
          : [],
    );

    return {
      summary: calculateGradeSummary(allGradeRecords),
      assessments: filteredResults,
      filters: buildFilterOptions(results, enrollmentRows),
    };
  },
};
