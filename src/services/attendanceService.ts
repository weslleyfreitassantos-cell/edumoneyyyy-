import { supabase } from '../lib/supabaseClient';

export const ATTENDANCE_RECORD_STATUSES = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
] as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_RECORD_STATUSES)[number];

export const ATTENDANCE_SESSION_STATUSES = [
  'DRAFT',
  'OPEN',
  'CLOSED',
  'CANCELED',
] as const;

export type AttendanceSessionStatus =
  (typeof ATTENDANCE_SESSION_STATUSES)[number];

export type AttendanceServiceErrorCode =
  | 'ATTENDANCE_OFFERING_NOT_FOUND'
  | 'ATTENDANCE_FORBIDDEN'
  | 'ATTENDANCE_SESSION_CONFLICT'
  | 'ATTENDANCE_STUDENT_NOT_ENROLLED'
  | 'ATTENDANCE_SAVE_FAILED';

export class AttendanceServiceError extends Error {
  readonly code: AttendanceServiceErrorCode;

  readonly originalError: unknown;

  constructor(
    code: AttendanceServiceErrorCode,
    message: string,
    originalError?: unknown,
  ) {
    super(message);
    this.name = 'AttendanceServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

interface ClassRelation {
  id: string;
  institution_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
  capacity?: number | null;
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
  start_date: string;
  end_date: string;
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

interface AttendanceSessionQueryRow {
  id: string;
  institution_id: string;
  subject_offering_id: string;
  session_date: string;
  starts_at: string | null;
  ends_at: string | null;
  topic: string | null;
  notes: string | null;
  status: string;
  created_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AttendanceRecordQueryRow {
  id: string;
  institution_id: string;
  attendance_session_id: string;
  student_id: string;
  status: string;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  students?: StudentRelation | StudentRelation[] | null;
}

interface AttendanceSessionWithRecordsQueryRow
  extends AttendanceSessionQueryRow {
  subject_offerings:
    | OfferingQueryRow
    | OfferingQueryRow[]
    | null;
  attendance_records:
    | AttendanceRecordQueryRow[]
    | null;
}

export interface AttendanceOffering {
  id: string;
  institutionId: string;
  classId: string;
  subjectId: string;
  teacherProfileId: string;
  termId: string;
  className: string;
  gradeLevel: string | null;
  shift: string | null;
  subjectName: string;
  subjectCode: string | null;
  workload: number | null;
  teacherName: string;
  teacherEmail: string;
  termName: string | null;
  termStartDate: string | null;
  termEndDate: string | null;
}

export interface AttendanceSession {
  id: string;
  institutionId: string;
  subjectOfferingId: string;
  sessionDate: string;
  startsAt: string | null;
  endsAt: string | null;
  topic: string | null;
  notes: string | null;
  status: AttendanceSessionStatus;
  createdBy: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceStudent {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  registrationNumber: string;
  enrollmentId: string | null;
}

export interface AttendanceRollCallRecord {
  recordId: string | null;
  student: AttendanceStudent;
  status: AttendanceStatus;
  notes: string | null;
  recordedAt: string | null;
}

export interface AttendanceRollCall {
  offering: AttendanceOffering;
  session: AttendanceSession | null;
  records: AttendanceRollCallRecord[];
}

export interface SaveAttendanceRecordInput {
  studentId: string;
  status: AttendanceStatus;
  notes?: string | null;
}

export interface SaveAttendanceRollCallInput {
  institutionId: string;
  subjectOfferingId: string;
  sessionDate: string;
  profileId: string;
  topic?: string | null;
  notes?: string | null;
  records: SaveAttendanceRecordInput[];
}

export interface AttendanceSummaryInput {
  status: AttendanceStatus;
}

export interface AttendanceSummary {
  totalRecords: number;
  presentRecords: number;
  absentRecords: number;
  lateRecords: number;
  excusedRecords: number;
  attendanceRate: number;
}

export interface StudentAttendanceRecord {
  id: string;
  sessionId: string;
  subjectOfferingId: string;
  studentId: string;
  studentName: string | null;
  registrationNumber: string | null;
  status: AttendanceStatus;
  notes: string | null;
  recordedAt: string;
  sessionDate: string;
  subjectName: string;
  subjectCode: string | null;
  className: string;
  teacherName: string;
}

export interface StudentAttendanceSummary {
  summary: AttendanceSummary;
  records: StudentAttendanceRecord[];
  recentRecords: StudentAttendanceRecord[];
}

export interface AttendanceInstitutionFilters {
  fromDate?: string;
  toDate?: string;
  classId?: string;
  subjectId?: string;
  teacherProfileId?: string;
  studentId?: string;
}

export interface AttendanceFilterOption {
  id: string;
  label: string;
}

export interface InstitutionAttendanceSession {
  id: string;
  sessionDate: string;
  status: AttendanceSessionStatus;
  offering: AttendanceOffering;
  records: StudentAttendanceRecord[];
  summary: AttendanceSummary;
}

export interface InstitutionAttendanceSummary {
  summary: AttendanceSummary;
  sessions: InstitutionAttendanceSession[];
  filters: {
    classes: AttendanceFilterOption[];
    subjects: AttendanceFilterOption[];
    teachers: AttendanceFilterOption[];
    students: AttendanceFilterOption[];
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

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
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

function createAttendanceError(
  error: unknown,
  fallbackCode: AttendanceServiceErrorCode,
): AttendanceServiceError {
  if (error instanceof AttendanceServiceError) {
    return error;
  }

  if (isSupabaseErrorLike(error)) {
    if (
      error.code === '42501' ||
      error.message?.toLowerCase().includes('permission')
    ) {
      return new AttendanceServiceError(
        'ATTENDANCE_FORBIDDEN',
        'Você não tem permissão para acessar ou alterar esta chamada.',
        error,
      );
    }

    if (error.code === '23505') {
      return new AttendanceServiceError(
        'ATTENDANCE_SESSION_CONFLICT',
        'Já existe uma chamada ativa para esta atribuição e data.',
        error,
      );
    }
  }

  return new AttendanceServiceError(
    fallbackCode,
    'Não foi possível concluir a operação de frequência.',
    error,
  );
}

function getDateEndTimestamp(sessionDate: string): number {
  return new Date(`${sessionDate}T23:59:59.999Z`).getTime();
}

export function isEnrollmentValidForAttendanceDate(
  enrollment: {
    active: boolean | null | undefined;
    status: string | null | undefined;
    enrolled_at: string | null | undefined;
  },
  sessionDate: string,
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
  const sessionEndTime =
    getDateEndTimestamp(sessionDate);

  return (
    Number.isFinite(enrollmentTime) &&
    Number.isFinite(sessionEndTime) &&
    enrollmentTime <= sessionEndTime
  );
}

export function calculateAttendanceSummary(
  records: readonly AttendanceSummaryInput[],
): AttendanceSummary {
  let presentRecords = 0;
  let absentRecords = 0;
  let lateRecords = 0;
  let excusedRecords = 0;

  for (const record of records) {
    if (record.status === 'PRESENT') {
      presentRecords += 1;
    }

    if (record.status === 'LATE') {
      presentRecords += 1;
      lateRecords += 1;
    }

    if (record.status === 'ABSENT') {
      absentRecords += 1;
    }

    if (record.status === 'EXCUSED') {
      excusedRecords += 1;
    }
  }

  const totalRecords = records.length;

  return {
    totalRecords,
    presentRecords,
    absentRecords,
    lateRecords,
    excusedRecords,
    attendanceRate:
      totalRecords === 0
        ? 0
        : Math.round(
            (presentRecords / totalRecords) * 1000,
          ) / 10,
  };
}

function normalizeOffering(
  row: OfferingQueryRow,
  institutionId: string,
): AttendanceOffering | null {
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
    className: classRecord.name,
    gradeLevel: classRecord.grade_level,
    shift: classRecord.shift,
    subjectName: subject.name,
    subjectCode: subject.code,
    workload: subject.workload,
    teacherName: teacher?.full_name ?? 'Professor',
    teacherEmail: teacher?.email ?? '',
    termName: term?.name ?? null,
    termStartDate: term?.start_date ?? null,
    termEndDate: term?.end_date ?? null,
  };
}

function normalizeSession(
  row: AttendanceSessionQueryRow,
): AttendanceSession {
  return {
    id: row.id,
    institutionId: row.institution_id,
    subjectOfferingId: row.subject_offering_id,
    sessionDate: row.session_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    topic: row.topic,
    notes: row.notes,
    status: normalizeSessionStatus(row.status),
    createdBy: row.created_by,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeStudent(
  student: StudentRelation,
  enrollmentId: string | null,
): AttendanceStudent | null {
  const profile = normalizeRelation(student.profiles);

  if (!profile || !isActive(student.active)) {
    return null;
  }

  return {
    id: student.id,
    profileId: student.profile_id,
    fullName: profile.full_name,
    email: profile.email,
    registrationNumber: student.registration_number,
    enrollmentId,
  };
}

function normalizeRecord(
  row: AttendanceRecordQueryRow,
): {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  notes: string | null;
  recordedAt: string;
  student: AttendanceStudent | null;
} {
  const studentRelation = normalizeRelation(row.students);

  return {
    id: row.id,
    studentId: row.student_id,
    status: normalizeAttendanceStatus(row.status),
    notes: row.notes,
    recordedAt: row.recorded_at,
    student: studentRelation
      ? normalizeStudent(studentRelation, null)
      : null,
  };
}

function sortRollCallRecords(
  first: AttendanceRollCallRecord,
  second: AttendanceRollCallRecord,
): number {
  return first.student.fullName.localeCompare(
    second.student.fullName,
    'pt-BR',
  );
}

export function buildRollCallRecords(
  students: readonly AttendanceStudent[],
  records: readonly AttendanceRecordQueryRow[],
): AttendanceRollCallRecord[] {
  const recordsByStudent = new Map(
    records.map((record) => [
      record.student_id,
      normalizeRecord(record),
    ]),
  );

  const rollCallRecords: AttendanceRollCallRecord[] =
    students.map((student) => {
      const record = recordsByStudent.get(student.id);

      return {
        recordId: record?.id ?? null,
        student,
        status: record?.status ?? 'PRESENT',
        notes: record?.notes ?? null,
        recordedAt: record?.recordedAt ?? null,
      };
    });

  for (const record of records) {
    if (students.some((student) => student.id === record.student_id)) {
      continue;
    }

    const normalizedRecord = normalizeRecord(record);

    if (!normalizedRecord.student) {
      continue;
    }

    rollCallRecords.push({
      recordId: normalizedRecord.id,
      student: normalizedRecord.student,
      status: normalizedRecord.status,
      notes: normalizedRecord.notes,
      recordedAt: normalizedRecord.recordedAt,
    });
  }

  return rollCallRecords.sort(sortRollCallRecords);
}

async function getAttendanceOffering(
  subjectOfferingId: string,
  institutionId: string,
): Promise<AttendanceOffering> {
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
        name,
        grade_level,
        shift,
        capacity,
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
        start_date,
        end_date,
        active
      )
    `,
    )
    .eq('id', subjectOfferingId)
    .maybeSingle();

  if (error) {
    throw createAttendanceError(
      error,
      'ATTENDANCE_FORBIDDEN',
    );
  }

  if (!data) {
    throw new AttendanceServiceError(
      'ATTENDANCE_OFFERING_NOT_FOUND',
      'A atribuição selecionada não foi encontrada.',
    );
  }

  const offering = normalizeOffering(
    data as unknown as OfferingQueryRow,
    institutionId,
  );

  if (!offering) {
    throw new AttendanceServiceError(
      'ATTENDANCE_OFFERING_NOT_FOUND',
      'A atribuição selecionada não pertence a esta instituição.',
    );
  }

  return offering;
}

async function getValidStudentsForOfferingDate(
  offering: AttendanceOffering,
  sessionDate: string,
): Promise<AttendanceStudent[]> {
  if (offering.termStartDate && offering.termEndDate) {
    const sessionTime = new Date(`${sessionDate}T00:00:00.000Z`).getTime();
    const startTime = new Date(`${offering.termStartDate}T00:00:00.000Z`).getTime();
    const endTime = new Date(`${offering.termEndDate}T23:59:59.999Z`).getTime();

    if (sessionTime < startTime || sessionTime > endTime) {
      throw new AttendanceServiceError(
        'ATTENDANCE_FORBIDDEN',
        `A data da chamada deve estar entre ${offering.termStartDate} e ${offering.termEndDate}`,
      );
    }
  }

  const { data, error } = await supabase.rpc(
    'get_teacher_offering_rosters',
    {
      target_offering_ids: [offering.id],
      effective_date: sessionDate,
    },
  );

  if (error) {
    throw createAttendanceError(
      error,
      'ATTENDANCE_FORBIDDEN',
    );
  }

  const students = new Map<string, AttendanceStudent>();

  for (const row of (data ?? []) as any[]) {
    students.set(
      row.student_id,
      {
        id: row.student_id,
        profileId: row.profile_id,
        fullName: row.full_name,
        email: '', // Not returned by RPC
        registrationNumber: row.registration_number,
        enrollmentId: row.enrollment_id,
      }
    );
  }

  return Array.from(students.values()).sort((first, second) =>
    first.fullName.localeCompare(second.fullName, 'pt-BR'),
  );
}

async function getSessionsForOfferingDate(
  institutionId: string,
  subjectOfferingId: string,
  sessionDate: string,
): Promise<AttendanceSession[]> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select(
      `
      id,
      institution_id,
      subject_offering_id,
      session_date,
      starts_at,
      ends_at,
      topic,
      notes,
      status,
      created_by,
      closed_at,
      created_at,
      updated_at
    `,
    )
    .eq('institution_id', institutionId)
    .eq('subject_offering_id', subjectOfferingId)
    .eq('session_date', sessionDate)
    .neq('status', 'CANCELED')
    .order('created_at', {
      ascending: true,
    });

  if (error) {
    throw createAttendanceError(
      error,
      'ATTENDANCE_FORBIDDEN',
    );
  }

  return (
    (data ?? []) as unknown as AttendanceSessionQueryRow[]
  ).map(normalizeSession);
}

async function getSingleSessionForOfferingDate(
  institutionId: string,
  subjectOfferingId: string,
  sessionDate: string,
): Promise<AttendanceSession | null> {
  const sessions = await getSessionsForOfferingDate(
    institutionId,
    subjectOfferingId,
    sessionDate,
  );

  if (sessions.length > 1) {
    throw new AttendanceServiceError(
      'ATTENDANCE_SESSION_CONFLICT',
      'Há mais de uma chamada ativa para esta atribuição e data.',
    );
  }

  return sessions[0] ?? null;
}

async function getRecordsForSession(
  sessionId: string,
): Promise<AttendanceRecordQueryRow[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      `
      id,
      institution_id,
      attendance_session_id,
      student_id,
      status,
      notes,
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
    .eq('attendance_session_id', sessionId)
    .order('created_at', {
      ascending: true,
    });

  if (error) {
    throw createAttendanceError(
      error,
      'ATTENDANCE_FORBIDDEN',
    );
  }

  return (data ?? []) as unknown as AttendanceRecordQueryRow[];
}

async function createAttendanceSession(
  input: SaveAttendanceRollCallInput,
): Promise<AttendanceSession> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert({
      institution_id: input.institutionId,
      subject_offering_id: input.subjectOfferingId,
      session_date: input.sessionDate,
      topic: normalizeOptionalText(input.topic),
      notes: normalizeOptionalText(input.notes),
      status: 'CLOSED',
      created_by: input.profileId,
    })
    .select(
      `
      id,
      institution_id,
      subject_offering_id,
      session_date,
      starts_at,
      ends_at,
      topic,
      notes,
      status,
      created_by,
      closed_at,
      created_at,
      updated_at
    `,
    )
    .single();

  if (error) {
    throw createAttendanceError(
      error,
      'ATTENDANCE_SAVE_FAILED',
    );
  }

  return normalizeSession(
    data as unknown as AttendanceSessionQueryRow,
  );
}

async function updateAttendanceSession(
  session: AttendanceSession,
  input: SaveAttendanceRollCallInput,
): Promise<AttendanceSession> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .update({
      topic: normalizeOptionalText(input.topic),
      notes: normalizeOptionalText(input.notes),
      status: 'CLOSED',
    })
    .eq('id', session.id)
    .select(
      `
      id,
      institution_id,
      subject_offering_id,
      session_date,
      starts_at,
      ends_at,
      topic,
      notes,
      status,
      created_by,
      closed_at,
      created_at,
      updated_at
    `,
    )
    .single();

  if (error) {
    throw createAttendanceError(
      error,
      'ATTENDANCE_SAVE_FAILED',
    );
  }

  return normalizeSession(
    data as unknown as AttendanceSessionQueryRow,
  );
}

async function upsertAttendanceRecords(
  input: SaveAttendanceRollCallInput,
  sessionId: string,
): Promise<void> {
  const recordedAt = new Date().toISOString();
  const rows = input.records.map((record) => ({
    institution_id: input.institutionId,
    attendance_session_id: sessionId,
    student_id: record.studentId,
    status: record.status,
    notes: normalizeOptionalText(record.notes),
    recorded_by: input.profileId,
    recorded_at: recordedAt,
  }));

  const { error } = await supabase
    .from('attendance_records')
    .upsert(rows, {
      onConflict: 'attendance_session_id,student_id',
    });

  if (error) {
    throw createAttendanceError(
      error,
      'ATTENDANCE_SAVE_FAILED',
    );
  }
}

function validateSaveInput(
  input: SaveAttendanceRollCallInput,
): void {
  if (input.records.length === 0) {
    throw new AttendanceServiceError(
      'ATTENDANCE_SAVE_FAILED',
      'A chamada não possui alunos para salvar.',
    );
  }

  for (const record of input.records) {
    if (!ATTENDANCE_RECORD_STATUSES.includes(record.status)) {
      throw new AttendanceServiceError(
        'ATTENDANCE_SAVE_FAILED',
        'A chamada possui um status de frequência inválido.',
      );
    }
  }
}

function assertStudentsCanBeSaved(
  submittedRecords: readonly SaveAttendanceRecordInput[],
  validStudents: readonly AttendanceStudent[],
  existingRecords: readonly AttendanceRecordQueryRow[],
): void {
  const allowedStudentIds = new Set([
    ...validStudents.map((student) => student.id),
    ...existingRecords.map((record) => record.student_id),
  ]);

  const invalidRecord = submittedRecords.find(
    (record) => !allowedStudentIds.has(record.studentId),
  );

  if (invalidRecord) {
    throw new AttendanceServiceError(
      'ATTENDANCE_STUDENT_NOT_ENROLLED',
      'Há aluno sem matrícula válida para esta chamada.',
    );
  }
}

function normalizeStudentAttendanceRecord(
  row: AttendanceRecordQueryRow,
  session: AttendanceSession,
  offering: AttendanceOffering,
): StudentAttendanceRecord {
  const student = normalizeRelation(row.students);
  const profile = normalizeRelation(student?.profiles);

  return {
    id: row.id,
    sessionId: row.attendance_session_id,
    subjectOfferingId: session.subjectOfferingId,
    studentId: row.student_id,
    studentName: profile?.full_name ?? null,
    registrationNumber:
      student?.registration_number ?? null,
    status: normalizeAttendanceStatus(row.status),
    notes: row.notes,
    recordedAt: row.recorded_at,
    sessionDate: session.sessionDate,
    subjectName: offering.subjectName,
    subjectCode: offering.subjectCode,
    className: offering.className,
    teacherName: offering.teacherName,
  };
}

function compareRecentRecords(
  first: StudentAttendanceRecord,
  second: StudentAttendanceRecord,
): number {
  return second.sessionDate.localeCompare(first.sessionDate);
}

function buildFilterOptions(
  sessions: readonly InstitutionAttendanceSession[],
): InstitutionAttendanceSummary['filters'] {
  const classes = new Map<string, string>();
  const subjects = new Map<string, string>();
  const teachers = new Map<string, string>();
  const students = new Map<string, string>();

  for (const session of sessions) {
    classes.set(
      session.offering.classId,
      session.offering.className,
    );
    subjects.set(
      session.offering.subjectId,
      session.offering.subjectName,
    );
    teachers.set(
      session.offering.teacherProfileId,
      session.offering.teacherName,
    );

    for (const record of session.records) {
      students.set(
        record.studentId,
        record.studentName ??
          record.registrationNumber ??
          record.studentId,
      );
    }
  }

  const toOptions = (
    values: Map<string, string>,
  ): AttendanceFilterOption[] =>
    Array.from(values.entries())
      .map(([id, label]) => ({
        id,
        label,
      }))
      .sort((first, second) =>
        first.label.localeCompare(second.label, 'pt-BR'),
      );

  return {
    classes: toOptions(classes),
    subjects: toOptions(subjects),
    teachers: toOptions(teachers),
    students: toOptions(students),
  };
}

function normalizeInstitutionSession(
  row: AttendanceSessionWithRecordsQueryRow,
  institutionId: string,
): InstitutionAttendanceSession | null {
  const offeringRow = normalizeRelation(
    row.subject_offerings,
  );

  if (!offeringRow) {
    return null;
  }

  const offering = normalizeOffering(
    offeringRow,
    institutionId,
  );

  if (!offering) {
    return null;
  }

  const session = normalizeSession(row);
  const records = (row.attendance_records ?? [])
    .map((record) =>
      normalizeStudentAttendanceRecord(
        record,
        session,
        offering,
      ),
    )
    .sort(compareRecentRecords);

  return {
    id: session.id,
    sessionDate: session.sessionDate,
    status: session.status,
    offering,
    records,
    summary: calculateAttendanceSummary(records),
  };
}

function filterInstitutionSessions(
  sessions: readonly InstitutionAttendanceSession[],
  filters: AttendanceInstitutionFilters,
): InstitutionAttendanceSession[] {
  return sessions
    .map((session) => {
      if (
        filters.classId &&
        session.offering.classId !== filters.classId
      ) {
        return null;
      }

      if (
        filters.subjectId &&
        session.offering.subjectId !== filters.subjectId
      ) {
        return null;
      }

      if (
        filters.teacherProfileId &&
        session.offering.teacherProfileId !==
          filters.teacherProfileId
      ) {
        return null;
      }

      const records = filters.studentId
        ? session.records.filter(
            (record) => record.studentId === filters.studentId,
          )
        : session.records;

      if (filters.studentId && records.length === 0) {
        return null;
      }

      return {
        ...session,
        records,
        summary: calculateAttendanceSummary(records),
      };
    })
    .filter(
      (
        session,
      ): session is InstitutionAttendanceSession =>
        session !== null,
    );
}

export const attendanceService = {
  async listTeacherOfferings(
    profileId: string,
    institutionId: string,
  ): Promise<AttendanceOffering[]> {
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
          name,
          grade_level,
          shift,
          capacity,
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
      throw createAttendanceError(
        error,
        'ATTENDANCE_FORBIDDEN',
      );
    }

    return (
      (data ?? []) as unknown as OfferingQueryRow[]
    )
      .map((row) => normalizeOffering(row, institutionId))
      .filter(
        (
          offering,
        ): offering is AttendanceOffering =>
          offering !== null,
      )
      .sort((first, second) =>
        first.subjectName.localeCompare(
          second.subjectName,
          'pt-BR',
        ),
      );
  },

  async loadRollCall(
    institutionId: string,
    subjectOfferingId: string,
    sessionDate: string,
  ): Promise<AttendanceRollCall> {
    const offering = await getAttendanceOffering(
      subjectOfferingId,
      institutionId,
    );
    const session =
      await getSingleSessionForOfferingDate(
        institutionId,
        subjectOfferingId,
        sessionDate,
      );
    const students =
      await getValidStudentsForOfferingDate(
        offering,
        sessionDate,
      );
    const records = session
      ? await getRecordsForSession(session.id)
      : [];

    return {
      offering,
      session,
      records: buildRollCallRecords(students, records),
    };
  },

  async saveRollCall(
    input: SaveAttendanceRollCallInput,
  ): Promise<AttendanceRollCall> {
    validateSaveInput(input);

    const offering = await getAttendanceOffering(
      input.subjectOfferingId,
      input.institutionId,
    );
    const existingSession =
      await getSingleSessionForOfferingDate(
        input.institutionId,
        input.subjectOfferingId,
        input.sessionDate,
      );
    const validStudents =
      await getValidStudentsForOfferingDate(
        offering,
        input.sessionDate,
      );
    const existingRecords = existingSession
      ? await getRecordsForSession(existingSession.id)
      : [];

    assertStudentsCanBeSaved(
      input.records,
      validStudents,
      existingRecords,
    );

    const session = existingSession
      ? await updateAttendanceSession(
          existingSession,
          input,
        )
      : await createAttendanceSession(input);

    await upsertAttendanceRecords(input, session.id);

    return this.loadRollCall(
      input.institutionId,
      input.subjectOfferingId,
      input.sessionDate,
    );
  },

  async getStudentAttendanceSummary(
    institutionId: string,
    studentId: string,
  ): Promise<StudentAttendanceSummary> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(
        `
        id,
        institution_id,
        attendance_session_id,
        student_id,
        status,
        notes,
        recorded_by,
        recorded_at,
        created_at,
        updated_at,
        attendance_sessions:attendance_session_id (
          id,
          institution_id,
          subject_offering_id,
          session_date,
          starts_at,
          ends_at,
          topic,
          notes,
          status,
          created_by,
          closed_at,
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
              name,
              grade_level,
              shift,
              capacity,
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
      })
      .limit(500);

    if (error) {
      throw createAttendanceError(
        error,
        'ATTENDANCE_FORBIDDEN',
      );
    }

    const records = (
      (data ?? []) as unknown as Array<
        AttendanceRecordQueryRow & {
          attendance_sessions:
            | (AttendanceSessionQueryRow & {
                subject_offerings:
                  | OfferingQueryRow
                  | OfferingQueryRow[]
                  | null;
              })
            | Array<
                AttendanceSessionQueryRow & {
                  subject_offerings:
                    | OfferingQueryRow
                    | OfferingQueryRow[]
                    | null;
                }
              >
            | null;
        }
      >
    )
      .map((row) => {
        const session = normalizeRelation(
          row.attendance_sessions,
        );
        const offeringRow = normalizeRelation(
          session?.subject_offerings,
        );

        if (
          !session ||
          !offeringRow ||
          normalizeSessionStatus(session.status) !== 'CLOSED'
        ) {
          return null;
        }

        const offering = normalizeOffering(
          offeringRow,
          institutionId,
        );

        if (!offering) {
          return null;
        }

        return normalizeStudentAttendanceRecord(
          row,
          normalizeSession(session),
          offering,
        );
      })
      .filter(
        (
          record,
        ): record is StudentAttendanceRecord =>
          record !== null,
      )
      .sort(compareRecentRecords);

    return {
      summary: calculateAttendanceSummary(records),
      records,
      recentRecords: records.slice(0, 6),
    };
  },

  async getInstitutionAttendanceSummary(
    institutionId: string,
    filters: AttendanceInstitutionFilters = {},
  ): Promise<InstitutionAttendanceSummary> {
    const fromDate =
      filters.fromDate ?? '1900-01-01';
    const toDate =
      filters.toDate ?? '2999-12-31';

    const { data, error } = await supabase
      .from('attendance_sessions')
      .select(
        `
        id,
        institution_id,
        subject_offering_id,
        session_date,
        starts_at,
        ends_at,
        topic,
        notes,
        status,
        created_by,
        closed_at,
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
            name,
            grade_level,
            shift,
            capacity,
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
        attendance_records (
          id,
          institution_id,
          attendance_session_id,
          student_id,
          status,
          notes,
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
      .gte('session_date', fromDate)
      .lte('session_date', toDate)
      .order('session_date', {
        ascending: false,
      })
      .limit(250);

    if (error) {
      throw createAttendanceError(
        error,
        'ATTENDANCE_FORBIDDEN',
      );
    }

    const sessions = (
      (data ?? []) as unknown as AttendanceSessionWithRecordsQueryRow[]
    )
      .map((row) =>
        normalizeInstitutionSession(row, institutionId),
      )
      .filter(
        (
          session,
        ): session is InstitutionAttendanceSession =>
          session !== null,
      );

    const filteredSessions =
      filterInstitutionSessions(sessions, filters);
    const records = filteredSessions.flatMap(
      (session) => session.records,
    );

    return {
      summary: calculateAttendanceSummary(records),
      sessions: filteredSessions,
      filters: buildFilterOptions(sessions),
    };
  },
};
