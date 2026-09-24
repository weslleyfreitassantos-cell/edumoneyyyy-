import { supabase } from '../lib/supabaseClient';
import { isAcademicTermDateWithinRange } from '../lib/academicTermDates';
import {
  academicCalendarService,
  type AcademicDateStatus,
} from './academicCalendarService';
import { resolveAcademicDateStatus } from '../lib/academicCalendarStatus';
import {
  isAbortError,
  withAcademicReadTimeout,
} from '../lib/academicReadTimeout';

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
  | 'ATTENDANCE_SCHEDULE_NOT_FOUND'
  | 'ATTENDANCE_SLOT_REQUIRED'
  | 'ATTENDANCE_CALENDAR_BLOCKED'
  | 'ATTENDANCE_SESSION_CONFLICT'
  | 'ATTENDANCE_SESSION_CLOSED'
  | 'ATTENDANCE_STUDENT_NOT_ENROLLED'
  | 'ATTENDANCE_SAVE_FAILED'
  | 'ATTENDANCE_TIMEOUT'
  | 'ATTENDANCE_LOAD_FAILED';

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

interface AcademicYearRelation {
  id: string;
  name: string;
}

interface TermRelation {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
  academic_years?: AcademicYearRelation | AcademicYearRelation[] | null;
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
  class_activity: string | null;
  homework: string | null;
  notes: string | null;
  status: string;
  created_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AttendanceScheduleQueryRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface AttendanceOfferingScheduleQueryRow
  extends AttendanceScheduleQueryRow {
  subject_offering_id: string;
}

interface AttendanceOfferingHistoricalSlotQueryRow {
  subject_offering_id: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
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

interface AttendanceSessionKeyQueryRow {
  id: string;
  subject_offering_id: string;
  session_date: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
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
  academicYearId: string | null;
  academicYearName: string | null;
  termStartDate: string | null;
  termEndDate: string | null;
  scheduleSlots?: AttendanceScheduleSlot[];
  selectableSlots?: AttendanceSelectableSlot[];
}

export interface AttendanceSession {
  id: string;
  institutionId: string;
  subjectOfferingId: string;
  sessionDate: string;
  startsAt: string | null;
  endsAt: string | null;
  topic: string | null;
  classActivity: string | null;
  homework: string | null;
  notes: string | null;
  status: AttendanceSessionStatus;
  createdBy: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export type AttendanceSelectableSlotSource =
  | 'TIMETABLE'
  | 'HISTORICAL';

export interface AttendanceSelectableSlot
  extends AttendanceScheduleSlot {
  source: AttendanceSelectableSlotSource;
}

export type AttendanceScheduleSlotSelection = Pick<
  AttendanceScheduleSlot,
  'startTime' | 'endTime'
>;

export function attendanceSlotKey(
  slot: AttendanceScheduleSlotSelection,
): string {
  return `${slot.startTime}|${slot.endTime}`;
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
  scheduleSlot: AttendanceScheduleSlot | null;
  calendarStatus: AcademicDateStatus;
  attendanceAllowed: boolean;
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
  scheduleSlot?: AttendanceScheduleSlotSelection;
  topic?: string | null;
  classActivity?: string | null;
  homework?: string | null;
  notes?: string | null;
  action?: 'SAVE_DRAFT' | 'FINALIZE';
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
  status?: AttendanceSessionStatus;
  termId?: string;
  academicYearId?: string;
  includeCanceled?: boolean;
  sessionIds?: readonly string[];
  limit?: number | null;
}

export interface AttendanceFilterOption {
  id: string;
  label: string;
}

export interface InstitutionAttendanceSession {
  id: string;
  sessionDate: string;
  status: AttendanceSessionStatus;
  startsAt: string | null;
  endsAt: string | null;
  topic: string | null;
  classActivity: string | null;
  homework: string | null;
  notes: string | null;
  createdBy: string | null;
  closedAt: string | null;
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
    academicYears: AttendanceFilterOption[];
    terms: AttendanceFilterOption[];
  };
}

export type InstitutionDiaryEntryStatus =
  | 'COMPLETED'
  | 'DRAFT'
  | 'PENDING'
  | 'FUTURE'
  | 'CANCELED';

export interface InstitutionClassDiaryEntry {
  id: string;
  diaryStatus: InstitutionDiaryEntryStatus;
  session: InstitutionAttendanceSession | null;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  offering: AttendanceOffering;
  historical: boolean;
  summary: AttendanceSummary;
}

export interface InstitutionClassDiaryFilters
  extends Omit<AttendanceInstitutionFilters, 'status'> {
  status?: InstitutionDiaryEntryStatus | 'ALL';
}

export interface InstitutionClassDiarySummary {
  entries: InstitutionClassDiaryEntry[];
  filters: {
    classes: AttendanceFilterOption[];
    subjects: AttendanceFilterOption[];
    teachers: AttendanceFilterOption[];
    academicYears: AttendanceFilterOption[];
    terms: AttendanceFilterOption[];
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

  if (isAbortError(error)) {
    return new AttendanceServiceError(
      'ATTENDANCE_TIMEOUT',
      'A leitura da frequência demorou mais que o esperado. Tente novamente.',
      error,
    );
  }

  if (isSupabaseErrorLike(error)) {
    if (
      error.message?.includes('ATTENDANCE_SCHEDULE_NOT_FOUND')
    ) {
      return new AttendanceServiceError(
        'ATTENDANCE_SCHEDULE_NOT_FOUND',
        'Não existe aula publicada para esta atribuição na data selecionada.',
        error,
      );
    }

    if (
      error.message?.includes('ATTENDANCE_SLOT_REQUIRED')
    ) {
      return new AttendanceServiceError(
        'ATTENDANCE_SLOT_REQUIRED',
        'Há mais de uma aula desta atribuição na data selecionada. Escolha o horário da chamada.',
        error,
      );
    }

    if (
      error.message?.includes('ATTENDANCE_CALENDAR_BLOCKED')
    ) {
      return new AttendanceServiceError(
        'ATTENDANCE_CALENDAR_BLOCKED',
        'Esta aula está suspensa pelo Calendário Acadêmico na data selecionada.',
        error,
      );
    }

    if (
      error.message?.includes('ATTENDANCE_SESSION_CLOSED')
    ) {
      return new AttendanceServiceError(
        'ATTENDANCE_SESSION_CLOSED',
        'Esta aula já foi finalizada e não pode mais ser alterada pelo professor.',
        error,
      );
    }

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
        'Já existe uma chamada conflitante para esta atribuição, data e horário.',
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

function formatDateForAttendanceMessage(value: string): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export function getAttendanceDayOfWeek(
  sessionDate: string,
): number {
  const date = new Date(`${sessionDate}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
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
  const academicYear = normalizeRelation(term?.academic_years);

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
    academicYearId: term?.academic_year_id ?? null,
    academicYearName: academicYear?.name ?? null,
    termStartDate: term?.start_date ?? null,
    termEndDate: term?.end_date ?? null,
  };
}

function sortAttendanceOfferings(
  offerings: AttendanceOffering[],
): AttendanceOffering[] {
  return offerings.sort((first, second) =>
    first.subjectName.localeCompare(second.subjectName, 'pt-BR'),
  );
}

function buildAttendanceSelectableSlots(
  sessionDate: string,
  timetableSlots: readonly AttendanceScheduleSlot[],
  historicalSlots: readonly AttendanceOfferingHistoricalSlotQueryRow[],
): AttendanceSelectableSlot[] {
  const slotsByKey = new Map<
    string,
    AttendanceSelectableSlot
  >();

  for (const slot of timetableSlots) {
    slotsByKey.set(attendanceSlotKey(slot), {
      ...slot,
      source: 'TIMETABLE',
    });
  }

  const dayOfWeek = getAttendanceDayOfWeek(sessionDate);

  for (const session of historicalSlots) {
    if (
      session.status === 'CANCELED' ||
      session.starts_at === null ||
      session.ends_at === null ||
      dayOfWeek < 1 ||
      dayOfWeek > 6
    ) {
      continue;
    }

    const key = attendanceSlotKey({
      startTime: session.starts_at,
      endTime: session.ends_at,
    });

    if (slotsByKey.has(key)) {
      continue;
    }

    slotsByKey.set(key, {
      dayOfWeek,
      startTime: session.starts_at,
      endTime: session.ends_at,
      source: 'HISTORICAL',
    });
  }

  return [...slotsByKey.values()].sort((first, second) =>
    attendanceSlotKey(first).localeCompare(
      attendanceSlotKey(second),
    ),
  );
}

export function selectAttendanceOfferingForDate(
  offerings: readonly AttendanceOffering[],
  sessionDate: string,
  preservedOfferingId?: string,
): AttendanceOffering | null {
  if (preservedOfferingId) {
    const preservedOffering = offerings.find(
      (offering) => offering.id === preservedOfferingId,
    );

    if (preservedOffering) {
      return preservedOffering;
    }
  }

  const offeringsInPeriod = offerings.filter((offering) => {
    const start = offering.termStartDate;
    const end = offering.termEndDate;

    return (
      !start ||
      !end ||
      isAcademicTermDateWithinRange(
        sessionDate,
        start,
        end,
      )
    );
  });

  return (
    offeringsInPeriod.find(
      (offering) =>
        (offering.selectableSlots?.length ??
          offering.scheduleSlots?.length ??
          0) > 0,
    ) ??
    offeringsInPeriod[0] ??
    offerings.find(
      (offering) =>
        (offering.selectableSlots?.length ??
          offering.scheduleSlots?.length ??
          0) > 0,
    ) ??
    offerings[0] ??
    null
  );
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
    classActivity: row.class_activity ?? null,
    homework: row.homework ?? null,
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
        active,
        academic_years:academic_year_id (id, name)
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
        `A data da chamada deve estar entre ${formatDateForAttendanceMessage(offering.termStartDate)} e ${formatDateForAttendanceMessage(offering.termEndDate)}. Atualize o período letivo ou escolha uma data dentro desse intervalo.`,
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
      class_activity,
      homework,
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

async function getAttendanceSessionsForOfferingDate(
  institutionId: string,
  subjectOfferingId: string,
  sessionDate: string,
): Promise<AttendanceSession[]> {
  return getSessionsForOfferingDate(
    institutionId,
    subjectOfferingId,
    sessionDate,
  );
}

function createSlotRequiredError(): AttendanceServiceError {
  return new AttendanceServiceError(
    'ATTENDANCE_SLOT_REQUIRED',
    'Há mais de uma aula desta atribuição na data selecionada. Escolha o horário da chamada.',
  );
}

function createScheduleNotFoundError(): AttendanceServiceError {
  return new AttendanceServiceError(
    'ATTENDANCE_SCHEDULE_NOT_FOUND',
    'Não existe aula publicada para esta atribuição na data selecionada.',
  );
}

export function resolveAttendanceScheduleSlot(
  slots: readonly AttendanceScheduleSlot[],
  requestedSlot?: AttendanceScheduleSlotSelection,
): AttendanceScheduleSlot {
  if (slots.length === 0) {
    throw createScheduleNotFoundError();
  }

  if (!requestedSlot) {
    if (slots.length > 1) {
      throw createSlotRequiredError();
    }

    return slots[0] as AttendanceScheduleSlot;
  }

  const matchingSlot = slots.find(
    (slot) =>
      attendanceSlotKey(slot) ===
      attendanceSlotKey(requestedSlot),
  );

  if (!matchingSlot) {
    throw new AttendanceServiceError(
      'ATTENDANCE_SCHEDULE_NOT_FOUND',
      'O horário selecionado não existe na grade publicada para a data escolhida.',
    );
  }

  return matchingSlot;
}

async function getAttendanceSessionForSlot(
  institutionId: string,
  subjectOfferingId: string,
  sessionDate: string,
  scheduleSlot: AttendanceScheduleSlotSelection,
  allowLegacySession = false,
): Promise<AttendanceSession | null> {
  const sessionQuery = supabase
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
      class_activity,
      homework,
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
    .eq('session_date', sessionDate);
  const { data, error } = await (allowLegacySession
    ? sessionQuery.or(
        `starts_at.eq.${scheduleSlot.startTime},starts_at.is.null`,
      )
    : sessionQuery.eq('starts_at', scheduleSlot.startTime)
  )
    .neq('status', 'CANCELED')
    .order('created_at', { ascending: true });

  if (error) {
    throw createAttendanceError(
      error,
      'ATTENDANCE_FORBIDDEN',
    );
  }

  const sessions = (
    (data ?? []) as unknown as AttendanceSessionQueryRow[]
  ).map(normalizeSession);

  if (sessions.length > 1) {
    throw new AttendanceServiceError(
      'ATTENDANCE_SESSION_CONFLICT',
      'Já existe uma chamada conflitante para esta atribuição, data e horário.',
    );
  }

  const session = sessions[0] ?? null;

  if (
    session &&
    ((session.startsAt === null) !==
      (session.endsAt === null) ||
      (session.startsAt !== null &&
        session.endsAt !== scheduleSlot.endTime))
  ) {
    throw new AttendanceServiceError(
      'ATTENDANCE_SESSION_CONFLICT',
      'Já existe uma chamada conflitante para esta atribuição, data e horário.',
    );
  }

  return session;
}

async function getAttendanceScheduleSlots(
  institutionId: string,
  subjectOfferingId: string,
  sessionDate: string,
): Promise<AttendanceScheduleSlot[]> {
  const dayOfWeek = getAttendanceDayOfWeek(sessionDate);

  if (dayOfWeek < 1 || dayOfWeek > 6) {
    return [];
  }

  const { data, error } = await supabase
    .from('timetable_entries')
    .select('day_of_week, start_time, end_time')
    .eq('institution_id', institutionId)
    .eq('subject_offering_id', subjectOfferingId)
    .eq('day_of_week', dayOfWeek)
    .eq('active', true)
    .order('start_time', { ascending: true });

  if (error) {
    throw createAttendanceError(
      error,
      'ATTENDANCE_FORBIDDEN',
    );
  }

  return (
    (data ?? []) as unknown as AttendanceScheduleQueryRow[]
  )
    .map((row) => ({
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
    }))
    .sort((first, second) =>
      attendanceSlotKey(first).localeCompare(
        attendanceSlotKey(second),
      ),
    );
}

function getScheduleSlotFromSession(
  session: AttendanceSession | null,
): AttendanceScheduleSlot | null {
  if (!session?.startsAt || !session.endsAt) {
    return null;
  }

  const dayOfWeek = getAttendanceDayOfWeek(session.sessionDate);

  if (dayOfWeek < 1 || dayOfWeek > 6) {
    return null;
  }

  return {
    dayOfWeek,
    startTime: session.startsAt,
    endTime: session.endsAt,
  };
}

function toAttendanceScheduleSlot(
  sessionDate: string,
  selection: AttendanceScheduleSlotSelection,
): AttendanceScheduleSlot {
  return {
    dayOfWeek: getAttendanceDayOfWeek(sessionDate),
    startTime: selection.startTime,
    endTime: selection.endTime,
  };
}

interface AttendanceSlotResolution {
  scheduleSlot: AttendanceScheduleSlot | null;
  session: AttendanceSession | null;
}

async function resolveAttendanceSlotForLoad(
  institutionId: string,
  subjectOfferingId: string,
  sessionDate: string,
  requestedSlot?: AttendanceScheduleSlotSelection,
): Promise<AttendanceSlotResolution> {
  const timetableSlots = await getAttendanceScheduleSlots(
    institutionId,
    subjectOfferingId,
    sessionDate,
  );

  if (timetableSlots.length > 0) {
    if (requestedSlot) {
      const matchingTimetableSlot = timetableSlots.find(
        (slot) =>
          attendanceSlotKey(slot) ===
          attendanceSlotKey(requestedSlot),
      );

      if (matchingTimetableSlot) {
        return {
          scheduleSlot: matchingTimetableSlot,
          session: await getAttendanceSessionForSlot(
            institutionId,
            subjectOfferingId,
            sessionDate,
            matchingTimetableSlot,
            timetableSlots.length === 1,
          ),
        };
      }

      const historicalSession =
        await getAttendanceSessionForSlot(
          institutionId,
          subjectOfferingId,
          sessionDate,
          requestedSlot,
        );

      if (historicalSession) {
        return {
          scheduleSlot: toAttendanceScheduleSlot(
            sessionDate,
            requestedSlot,
          ),
          session: historicalSession,
        };
      }

      throw createScheduleNotFoundError();
    }

    const scheduleSlot = resolveAttendanceScheduleSlot(
      timetableSlots,
    );

    if (!scheduleSlot) {
      throw createScheduleNotFoundError();
    }

    return {
      scheduleSlot,
      session: await getAttendanceSessionForSlot(
        institutionId,
        subjectOfferingId,
        sessionDate,
        scheduleSlot,
        timetableSlots.length === 1,
      ),
    };
  }

  if (requestedSlot) {
    const historicalSession =
      await getAttendanceSessionForSlot(
        institutionId,
        subjectOfferingId,
        sessionDate,
        requestedSlot,
      );

    if (!historicalSession) {
      throw createScheduleNotFoundError();
    }

    return {
      scheduleSlot: toAttendanceScheduleSlot(
        sessionDate,
        requestedSlot,
      ),
      session: historicalSession,
    };
  }

  const historicalSessions =
    await getAttendanceSessionsForOfferingDate(
      institutionId,
      subjectOfferingId,
      sessionDate,
    );

  if (historicalSessions.length === 0) {
    throw createScheduleNotFoundError();
  }

  if (historicalSessions.length > 1) {
    throw createSlotRequiredError();
  }

  const session = historicalSessions[0] ?? null;

  return {
    scheduleSlot: getScheduleSlotFromSession(session),
    session,
  };
}

async function resolveAttendanceSlotForSave(
  institutionId: string,
  subjectOfferingId: string,
  sessionDate: string,
  requestedSlot?: AttendanceScheduleSlotSelection,
): Promise<AttendanceSlotResolution> {
  const timetableSlots = await getAttendanceScheduleSlots(
    institutionId,
    subjectOfferingId,
    sessionDate,
  );
  const scheduleSlot = resolveAttendanceScheduleSlot(
    timetableSlots,
    requestedSlot,
  );

  if (!scheduleSlot) {
    throw createScheduleNotFoundError();
  }

  return {
    scheduleSlot,
    session: await getAttendanceSessionForSlot(
      institutionId,
      subjectOfferingId,
      sessionDate,
      scheduleSlot,
      timetableSlots.length === 1,
    ),
  };
}

async function getAttendanceCalendarStatus(
  offering: AttendanceOffering,
  sessionDate: string,
): Promise<AcademicDateStatus> {
  try {
    return await academicCalendarService.getAcademicDateStatus(
      {
        institutionId: offering.institutionId,
        academicYearId: offering.academicYearId,
        classId: offering.classId,
        subjectId: offering.subjectId,
      },
      sessionDate,
    );
  } catch (error) {
    throw createAttendanceError(error, 'ATTENDANCE_FORBIDDEN');
  }
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
  const academicYears = new Map<string, string>();
  const terms = new Map<string, string>();

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
    if (session.offering.academicYearId) {
      academicYears.set(
        session.offering.academicYearId,
        session.offering.academicYearId,
      );
    }
    terms.set(
      session.offering.termId,
      session.offering.termName ?? session.offering.termId,
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
    academicYears: toOptions(academicYears),
    terms: toOptions(terms),
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
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    topic: session.topic,
    classActivity: session.classActivity,
    homework: session.homework,
    notes: session.notes,
    createdBy: session.createdBy,
    closedAt: session.closedAt,
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
        !filters.includeCanceled &&
        session.status === 'CANCELED'
      ) {
        return null;
      }

      if (filters.status && session.status !== filters.status) {
        return null;
      }

      if (
        filters.termId &&
        session.offering.termId !== filters.termId
      ) {
        return null;
      }

      if (
        filters.academicYearId &&
        session.offering.academicYearId !== filters.academicYearId
      ) {
        return null;
      }

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

interface TimetableEntryForDiary {
  subject_offering_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean | null;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addLocalDays(value: string, amount: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function dateRange(fromDate: string, toDate: string): string[] {
  const values: string[] = [];
  let current = fromDate;

  while (current <= toDate && values.length < 370) {
    values.push(current);
    current = addLocalDays(current, 1);
  }

  return values;
}

function timeOnLocalDate(
  date: string,
  time: string,
): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes, seconds = 0] = time
    .split(':')
    .map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function isDiaryOccurrencePast(
  date: string,
  endTime: string,
  now = new Date(),
): boolean {
  return timeOnLocalDate(date, endTime).getTime() <= now.getTime();
}

export function getInstitutionDiaryStatus(
  sessionStatus: AttendanceSessionStatus | null,
  occurrencePast: boolean,
): InstitutionDiaryEntryStatus {
  if (sessionStatus === 'CLOSED') return 'COMPLETED';
  if (sessionStatus === 'DRAFT' || sessionStatus === 'OPEN') return 'DRAFT';
  if (sessionStatus === 'CANCELED') return 'CANCELED';
  return occurrencePast ? 'PENDING' : 'FUTURE';
}

export function buildDiaryFilters(
  offerings: readonly AttendanceOffering[],
): InstitutionClassDiarySummary['filters'] {
  const byId = (
    values: Iterable<[string, string]>,
  ): AttendanceFilterOption[] =>
    Array.from(new Map(values).entries())
      .map(([id, label]) => ({ id, label }))
      .sort((first, second) =>
        first.label.localeCompare(second.label, 'pt-BR'),
      );

  return {
    classes: byId(
      offerings.map((offering) => [
        offering.classId,
        offering.className,
      ]),
    ),
    subjects: byId(
      offerings.map((offering) => [
        offering.subjectId,
        offering.subjectName,
      ]),
    ),
    teachers: byId(
      offerings.map((offering) => [
        offering.teacherProfileId,
        offering.teacherName,
      ]),
    ),
    academicYears: byId(
      offerings
        .filter((offering) => offering.academicYearId)
        .map((offering) => [
          offering.academicYearId as string,
          (offering.academicYearName ?? offering.academicYearId) as string,
        ]),
    ),
    terms: byId(
      offerings.map((offering) => [
        offering.termId,
        offering.termName ?? offering.termId,
      ]),
    ),
  };
}

export function institutionDiarySessionKey(
  offeringId: string,
  date: string,
  startsAt: string | null,
): string {
  return `${offeringId}|${date}|${startsAt ?? 'legacy'}`;
}

export function buildInstitutionDiarySessionIndex(
  sessions: readonly InstitutionAttendanceSession[],
): Map<string, InstitutionAttendanceSession> {
  const index = new Map<string, InstitutionAttendanceSession>();

  for (const session of sessions) {
    index.set(
      institutionDiarySessionKey(
        session.offering.id,
        session.sessionDate,
        session.startsAt,
      ),
      session,
    );
  }

  return index;
}

const DIARY_SESSION_PAGE_SIZE = 250;

export async function listInstitutionDiarySessionKeys(
  institutionId: string,
  fromDate: string,
  toDate: string,
): Promise<AttendanceSessionKeyQueryRow[]> {
  const rows: AttendanceSessionKeyQueryRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select(
        'id, subject_offering_id, session_date, starts_at, ends_at, status',
      )
      .eq('institution_id', institutionId)
      .gte('session_date', fromDate)
      .lte('session_date', toDate)
      .order('session_date', { ascending: true })
      .order('starts_at', { ascending: true })
      .range(offset, offset + DIARY_SESSION_PAGE_SIZE - 1);

    if (error) {
      throw createAttendanceError(error, 'ATTENDANCE_FORBIDDEN');
    }

    const page = (data ?? []) as unknown as AttendanceSessionKeyQueryRow[];
    rows.push(...page);

    if (page.length < DIARY_SESSION_PAGE_SIZE) {
      return rows;
    }

    offset += DIARY_SESSION_PAGE_SIZE;
  }
}

function chunkValues<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size) as T[]);
  }

  return chunks;
}

export const attendanceService = {
  async listTeacherOfferings(
    profileId: string,
    institutionId: string,
    sessionDate?: string,
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
          start_date,
          end_date,
          active,
          academic_years:academic_year_id (id, name)
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

    const offerings = (
      (data ?? []) as unknown as OfferingQueryRow[]
    )
      .map((row) => normalizeOffering(row, institutionId))
      .filter(
        (
          offering,
        ): offering is AttendanceOffering =>
          offering !== null,
      );

    if (!sessionDate || offerings.length === 0) {
      return sortAttendanceOfferings(
        offerings.map((offering) => ({
          ...offering,
          scheduleSlots: [],
          selectableSlots: [],
        })),
      );
    }

    const dayOfWeek = getAttendanceDayOfWeek(sessionDate);

    const schedulesByOffering = new Map<
      string,
      AttendanceScheduleSlot[]
    >();

    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      const {
        data: scheduleData,
        error: scheduleError,
      } = await supabase
        .from('timetable_entries')
        .select('subject_offering_id, day_of_week, start_time, end_time')
        .eq('institution_id', institutionId)
        .in(
          'subject_offering_id',
          offerings.map((offering) => offering.id),
        )
        .eq('day_of_week', dayOfWeek)
        .eq('active', true)
        .order('start_time', { ascending: true });

      if (scheduleError) {
        throw createAttendanceError(
          scheduleError,
          'ATTENDANCE_FORBIDDEN',
        );
      }

      for (const row of (scheduleData ?? []) as unknown as AttendanceOfferingScheduleQueryRow[]) {
        const slots = schedulesByOffering.get(row.subject_offering_id) ?? [];
        slots.push({
          dayOfWeek: row.day_of_week,
          startTime: row.start_time,
          endTime: row.end_time,
        });
        schedulesByOffering.set(row.subject_offering_id, slots);
      }
    }

    const {
      data: historicalData,
      error: historicalError,
    } = await supabase
      .from('attendance_sessions')
      .select(
        'subject_offering_id, starts_at, ends_at, status',
      )
      .eq('institution_id', institutionId)
      .in(
        'subject_offering_id',
        offerings.map((offering) => offering.id),
      )
      .eq('session_date', sessionDate)
      .neq('status', 'CANCELED');

    if (historicalError) {
      throw createAttendanceError(
        historicalError,
        'ATTENDANCE_FORBIDDEN',
      );
    }

    const historicalSlotsByOffering = new Map<
      string,
      AttendanceOfferingHistoricalSlotQueryRow[]
    >();

    for (const row of (historicalData ?? []) as unknown as AttendanceOfferingHistoricalSlotQueryRow[]) {
      const slots =
        historicalSlotsByOffering.get(row.subject_offering_id) ?? [];
      slots.push(row);
      historicalSlotsByOffering.set(row.subject_offering_id, slots);
    }

    return sortAttendanceOfferings(
      offerings.map((offering) => ({
        ...offering,
        scheduleSlots:
          schedulesByOffering.get(offering.id) ?? [],
        selectableSlots: buildAttendanceSelectableSlots(
          sessionDate,
          schedulesByOffering.get(offering.id) ?? [],
          historicalSlotsByOffering.get(offering.id) ?? [],
        ),
      })),
    );
  },

  async loadRollCall(
    institutionId: string,
    subjectOfferingId: string,
    sessionDate: string,
    requestedSlot?: AttendanceScheduleSlotSelection,
  ): Promise<AttendanceRollCall> {
    const offering = await getAttendanceOffering(
      subjectOfferingId,
      institutionId,
    );
    const { scheduleSlot, session } =
      await resolveAttendanceSlotForLoad(
        institutionId,
        subjectOfferingId,
        sessionDate,
        requestedSlot,
      );

    const calendarStatus = await getAttendanceCalendarStatus(
      offering,
      sessionDate,
    );
    const attendanceAllowed = !calendarStatus.blocked;
    const students =
      calendarStatus.blocked && !session
        ? []
        : await getValidStudentsForOfferingDate(
            offering,
            sessionDate,
          );
    const records = session
      ? await getRecordsForSession(session.id)
      : [];

    return {
      offering,
      session,
      scheduleSlot,
      calendarStatus,
      attendanceAllowed,
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
    const { scheduleSlot, session: existingSession } =
      await resolveAttendanceSlotForSave(
        input.institutionId,
        input.subjectOfferingId,
        input.sessionDate,
        input.scheduleSlot,
      );

    const calendarStatus = await getAttendanceCalendarStatus(
      offering,
      input.sessionDate,
    );

    if (calendarStatus.blocked) {
      throw new AttendanceServiceError(
        'ATTENDANCE_CALENDAR_BLOCKED',
        'Esta aula está suspensa pelo Calendário Acadêmico na data selecionada.',
      );
    }

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

    const { error } = await supabase.rpc(
      'save_attendance_class_diary',
      {
        p_institution_id: input.institutionId,
        p_subject_offering_id: input.subjectOfferingId,
        p_session_date: input.sessionDate,
        p_starts_at: scheduleSlot.startTime,
        p_ends_at: scheduleSlot.endTime,
        p_topic: input.topic ?? null,
        p_class_activity: input.classActivity ?? null,
        p_homework: input.homework ?? null,
        p_notes: input.notes ?? null,
        p_status:
          input.action === 'SAVE_DRAFT' ? 'DRAFT' : 'CLOSED',
        p_records: input.records.map((record) => ({
          student_id: record.studentId,
          status: record.status,
          notes: record.notes ?? null,
        })),
      },
    );

    if (error) {
      throw createAttendanceError(
        error,
        'ATTENDANCE_SAVE_FAILED',
      );
    }

    return this.loadRollCall(
      input.institutionId,
      input.subjectOfferingId,
      input.sessionDate,
      scheduleSlot,
    );
  },

  async getStudentAttendanceSummary(
    institutionId: string,
    studentId: string,
  ): Promise<StudentAttendanceSummary> {
    try {
      return await withAcademicReadTimeout(async (signal) => {
        let recordsQuery = supabase
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
            updated_at
          `,
          )
          .eq('institution_id', institutionId)
          .eq('student_id', studentId)
          .order('recorded_at', { ascending: false })
          .limit(500);

        recordsQuery = recordsQuery.abortSignal(signal);

        const { data: recordData, error: recordError } =
          await recordsQuery;

        if (recordError) {
          throw createAttendanceError(
            recordError,
            'ATTENDANCE_FORBIDDEN',
          );
        }

        const recordRows = (recordData ?? []) as unknown as AttendanceRecordQueryRow[];

        if (recordRows.length === 0) {
          return {
            summary: calculateAttendanceSummary([]),
            records: [],
            recentRecords: [],
          };
        }

        const sessionIds = [
          ...new Set(
            recordRows.map((record) => record.attendance_session_id),
          ),
        ];
        let sessionsQuery = supabase
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
            class_activity,
            homework,
            notes,
            status,
            created_by,
            closed_at,
            created_at,
            updated_at
          `,
          )
          .eq('institution_id', institutionId)
          .eq('status', 'CLOSED')
          .in('id', sessionIds);

        sessionsQuery = sessionsQuery.abortSignal(signal);

        const { data: sessionData, error: sessionError } =
          await sessionsQuery;

        if (sessionError) {
          throw createAttendanceError(
            sessionError,
            'ATTENDANCE_FORBIDDEN',
          );
        }

        const sessionRows = (sessionData ?? []) as unknown as AttendanceSessionQueryRow[];
        const sessionsById = new Map(
          sessionRows.map((session) => [session.id, session]),
        );
        const closedRecordRows = recordRows.filter((record) =>
          sessionsById.has(record.attendance_session_id),
        );

        if (closedRecordRows.length === 0) {
          return {
            summary: calculateAttendanceSummary([]),
            records: [],
            recentRecords: [],
          };
        }

        const offeringIds = [
          ...new Set(
            closedRecordRows
              .map((record) =>
                sessionsById.get(record.attendance_session_id)
                  ?.subject_offering_id,
              )
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        let offeringsQuery = supabase
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
              active,
              academic_years:academic_year_id (id, name)
            )
          `,
          )
          .eq('active', true)
          .in('id', offeringIds);

        offeringsQuery = offeringsQuery.abortSignal(signal);

        const { data: offeringData, error: offeringError } =
          await offeringsQuery;

        if (offeringError) {
          throw createAttendanceError(
            offeringError,
            'ATTENDANCE_FORBIDDEN',
          );
        }

        const offeringsById = new Map(
          ((offeringData ?? []) as unknown as OfferingQueryRow[]).map(
            (offering) => [offering.id, offering],
          ),
        );
        const records = closedRecordRows
          .map((row) => {
            const sessionRow = sessionsById.get(
              row.attendance_session_id,
            );
            const offeringRow = sessionRow
              ? offeringsById.get(sessionRow.subject_offering_id)
              : undefined;

            if (!sessionRow || !offeringRow) {
              return null;
            }

            const offering = normalizeOffering(
              offeringRow,
              institutionId,
            );

            return offering
              ? normalizeStudentAttendanceRecord(
                  row,
                  normalizeSession(sessionRow),
                  offering,
                )
              : null;
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
      });
    } catch (error) {
      throw createAttendanceError(
        error,
        'ATTENDANCE_LOAD_FAILED',
      );
    }
  },

  async getInstitutionAttendanceSummary(
    institutionId: string,
    filters: AttendanceInstitutionFilters = {},
  ): Promise<InstitutionAttendanceSummary> {
    const fromDate =
      filters.fromDate ?? '1900-01-01';
    const toDate =
      filters.toDate ?? '2999-12-31';

    let sessionQuery = supabase
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
        class_activity,
        homework,
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
            active,
            academic_years:academic_year_id (id, name)
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
      .gte('session_date', fromDate)
      .lte('session_date', toDate)
      .order('session_date', {
        ascending: false,
      });

    if (!filters.includeCanceled) {
      sessionQuery = sessionQuery.neq('status', 'CANCELED');
    }

    if (filters.sessionIds) {
      if (filters.sessionIds.length === 0) {
        return {
          summary: calculateAttendanceSummary([]),
          sessions: [],
          filters: buildFilterOptions([]),
        };
      }

      sessionQuery = sessionQuery.in('id', [...filters.sessionIds]);
    }

    const { data, error } = filters.sessionIds || filters.limit === null
      ? await sessionQuery
      : await sessionQuery.limit(filters.limit ?? 250);

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

  async listInstitutionClassDiary(
    institutionId: string,
    filters: InstitutionClassDiaryFilters = {},
  ): Promise<InstitutionClassDiarySummary> {
    const today = localDateKey(new Date());
    const fromDate = filters.fromDate ?? addLocalDays(today, -14);
    const toDate = filters.toDate ?? addLocalDays(today, 45);

    const { data: offeringData, error: offeringError } =
      await supabase
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
            active,
            academic_years:academic_year_id (id, name)
          )
        `,
        )
        .eq('active', true);

    if (offeringError) {
      throw createAttendanceError(
        offeringError,
        'ATTENDANCE_FORBIDDEN',
      );
    }

    const offerings = (offeringData ?? [])
      .map((row) =>
        normalizeOffering(
          row as unknown as OfferingQueryRow,
          institutionId,
        ),
      )
      .filter(
        (offering): offering is AttendanceOffering =>
          offering !== null &&
          offering.institutionId === institutionId &&
          (!filters.classId || offering.classId === filters.classId) &&
          (!filters.subjectId || offering.subjectId === filters.subjectId) &&
          (!filters.teacherProfileId ||
            offering.teacherProfileId === filters.teacherProfileId) &&
          (!filters.termId || offering.termId === filters.termId) &&
          (!filters.academicYearId ||
            offering.academicYearId === filters.academicYearId),
      );

    const timetableEntries: TimetableEntryForDiary[] = [];
    if (offerings.length > 0) {
      const { data, error } = await supabase
        .from('timetable_entries')
        .select(
          'subject_offering_id, day_of_week, start_time, end_time, active',
        )
        .in(
          'subject_offering_id',
          offerings.map((offering) => offering.id),
        )
        .eq('active', true);

      if (error) {
        throw createAttendanceError(error, 'ATTENDANCE_FORBIDDEN');
      }

      timetableEntries.push(
        ...((data ?? []) as unknown as TimetableEntryForDiary[]),
      );
    }

    const sessionKeys = await listInstitutionDiarySessionKeys(
      institutionId,
      fromDate,
      toDate,
    );
    const actualSessions: InstitutionAttendanceSession[] = [];

    for (const sessionIdChunk of chunkValues(
      sessionKeys.map((session) => session.id),
      100,
    )) {
      const detailSummary = await this.getInstitutionAttendanceSummary(
        institutionId,
        {
          fromDate,
          toDate,
          includeCanceled: true,
          sessionIds: sessionIdChunk,
        },
      );
      actualSessions.push(...detailSummary.sessions);
    }

    const sessionByKey = buildInstitutionDiarySessionIndex(actualSessions);

    const blockingCalendarEvents = offerings.length > 0
      ? await academicCalendarService.listBlockingEventsForRange(
        institutionId,
        fromDate,
        toDate,
      )
      : [];
    const calendarCache = new Map<string, AcademicDateStatus>();
    const entries: InstitutionClassDiaryEntry[] = [];
    const generatedSessionIds = new Set<string>();
    const offeringById = new Map(
      offerings.map((offering) => [offering.id, offering]),
    );

    for (const date of dateRange(fromDate, toDate)) {
      const dayOfWeek = (() => {
        const [year, month, day] = date.split('-').map(Number);
        const value = new Date(year, month - 1, day).getDay();
        return value === 0 ? 7 : value;
      })();

      for (const offering of offerings) {
        if (
          offering.termStartDate &&
          offering.termEndDate &&
          !isAcademicTermDateWithinRange(
            date,
            offering.termStartDate,
            offering.termEndDate,
          )
        ) {
          continue;
        }

        const slots = timetableEntries.filter(
          (entry) =>
            entry.subject_offering_id === offering.id &&
            entry.day_of_week === dayOfWeek,
        );

        for (const slot of slots) {
          const cacheKey = [
            date,
            offering.academicYearId ?? '',
            offering.classId,
            offering.subjectId,
          ].join('|');
          let calendarStatus = calendarCache.get(cacheKey);

          if (!calendarStatus) {
            calendarStatus = resolveAcademicDateStatus(
              date,
              blockingCalendarEvents,
              {
                institutionId,
                academicYearId: offering.academicYearId,
                classId: offering.classId,
                subjectId: offering.subjectId,
              },
            );
            calendarCache.set(cacheKey, calendarStatus);
          }

          if (calendarStatus.blocked) {
            continue;
          }

          const session = sessionByKey.get(
            institutionDiarySessionKey(
              offering.id,
              date,
              slot.start_time,
            ),
          );
          if (session) {
            generatedSessionIds.add(session.id);
          }

          const diaryStatus = getInstitutionDiaryStatus(
            session?.status ?? null,
            isDiaryOccurrencePast(date, slot.end_time),
          );
          entries.push({
            id:
              session?.id ??
              `pending:${offering.id}:${date}:${slot.start_time}`,
            diaryStatus,
            session: session ?? null,
            sessionDate: date,
            startsAt: slot.start_time,
            endsAt: slot.end_time,
            offering,
            historical: false,
            summary: session?.summary ?? calculateAttendanceSummary([]),
          });
        }
      }
    }

    for (const session of actualSessions) {
      if (generatedSessionIds.has(session.id)) continue;
      if (
        (filters.classId && session.offering.classId !== filters.classId) ||
        (filters.subjectId && session.offering.subjectId !== filters.subjectId) ||
        (filters.teacherProfileId &&
          session.offering.teacherProfileId !== filters.teacherProfileId) ||
        (filters.termId && session.offering.termId !== filters.termId) ||
        (filters.academicYearId &&
          session.offering.academicYearId !== filters.academicYearId)
      ) {
        continue;
      }
      const offering = offeringById.get(session.offering.id) ?? session.offering;
      entries.push({
        id: session.id,
        diaryStatus: getInstitutionDiaryStatus(session.status, true),
        session,
        sessionDate: session.sessionDate,
        startsAt: session.startsAt ?? '',
        endsAt: session.endsAt ?? '',
        offering,
        historical: true,
        summary: session.summary,
      });
    }

    const filteredEntries = entries
      .filter((entry) =>
        filters.status && filters.status !== 'ALL'
          ? entry.diaryStatus === filters.status
          : true,
      )
      .sort((first, second) =>
        `${second.sessionDate}|${second.startsAt}`.localeCompare(
          `${first.sessionDate}|${first.startsAt}`,
        ),
      )
      .slice(0, 500);

    return {
      entries: filteredEntries,
      filters: buildDiaryFilters(
        Array.from(
          new Map(
            [...offerings, ...actualSessions.map((session) => session.offering)].map(
              (offering) => [offering.id, offering],
            ),
          ).values(),
        ),
      ),
    };
  },
};
