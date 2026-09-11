import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

type AnyClient = SupabaseClient<any, any, any>;
type Role =
  | 'ADMIN'
  | 'DIRECTOR'
  | 'SECRETARY'
  | 'TEACHER'
  | 'STUDENT'
  | 'GUARDIAN';

type Actor = {
  id: string;
  email: string;
  client: AnyClient;
  role: Role;
};

type TenantFixture = {
  accountA: string;
  accountB: string;
  institutionA: string;
  institutionA2: string;
  institutionB: string;
  membershipA: string;
  membershipB: string;
  yearA: string;
  yearB: string;
  termA: string;
  termB: string;
  classA: string;
  classB: string;
  subjectA: string;
  subjectB: string;
  offeringA: string;
  offeringB: string;
  studentA: string;
  studentB: string;
  guardianshipA: string;
  guardianshipB: string;
  enrollmentA: string;
  enrollmentB: string;
  guardianA: string;
  guardianB: string;
  assessmentA: string;
  assessmentB: string;
  gradeA: string;
  gradeB: string;
  attendanceSessionA: string;
  attendanceSessionB: string;
  attendanceRecordA: string;
  attendanceRecordB: string;
  roomA: string;
  roomB: string;
  timetableEntryA: string;
  timetableEntryB: string;
  learningPostA: string;
  learningPostB: string;
  announcementA: string;
  announcementB: string;
  announcementStudentA: string;
  announcementStudentB: string;
  announcementGuardianA: string;
  announcementGuardianB: string;
  accessDeviceA: string;
  accessDeviceB: string;
  accessEventA: string;
  accessEventB: string;
  contractA: string;
  contractB: string;
  invoiceA: string;
  invoiceB: string;
  paymentA: string;
  paymentB: string;
  actors: Record<string, Actor>;
  admin: AnyClient;
};

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(localUrl && anonKey && serviceRoleKey);
const localDescribe = enabled ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

async function insertOne(
  client: AnyClient,
  table: string,
  row: Record<string, unknown>,
): Promise<Record<string, any>> {
  const { data, error } = await client
    .from(table)
    .insert(row)
    .select('*')
    .single();

  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert result`);
}

async function insertWithoutSelect(
  client: AnyClient,
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  const { error } = await client.from(table).insert(row);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function createActor(
  admin: AnyClient,
  role: Role,
  label: string,
  suffix: string,
  platformRole = 'USER',
): Promise<Actor> {
  const email = `mt-${suffix}-${label.toLowerCase()}@local.test`;
  const password = 'MultiTenantAudit!2026';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw new Error(`auth ${label}: ${error.message}`);
  const user = required(data.user, `auth ${label}`);

  await insertOne(admin, 'profiles', {
    id: user.id,
    full_name: `Multi Tenant ${label}`,
    email,
    role,
    active: true,
    platform_role: platformRole,
  });

  const client = createClient(localUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`sign in ${label}: ${signIn.error?.message ?? 'no session'}`);
  }

  return { id: user.id, email, client, role };
}

async function readIds(
  client: AnyClient,
  table: string,
  id: string,
): Promise<{ rows: any[]; error: string | null }> {
  const { data, error } = await client.from(table).select('id').eq('id', id);
  return { rows: data ?? [], error: error?.message ?? null };
}

async function readCount(client: AnyClient, table: string): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

type IsolationClassification =
  | 'PASS_RLS'
  | 'BLOCKED_BY_GRANTS'
  | 'LEAK'
  | 'NOT_AVAILABLE';

function classifyScopedRead(
  own: { rows: any[]; error: string | null },
  foreign: { rows: any[]; error: string | null },
): IsolationClassification {
  if (own.error?.match(/permission denied/i) || foreign.error?.match(/permission denied/i)) {
    return 'BLOCKED_BY_GRANTS';
  }
  if (foreign.rows.length > 0) return 'LEAK';
  if (!own.error && !foreign.error && own.rows.length === 1) return 'PASS_RLS';
  return 'NOT_AVAILABLE';
}

async function writeAttempt(
  operation: () => Promise<{ data: any; error: any }>,
): Promise<{
  rows: any[];
  error: string | null;
  explicitDenied: boolean;
}> {
  const { data, error } = await operation();
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return {
    rows,
    error: error?.message ?? null,
    explicitDenied: Boolean(error),
  };
}

async function createFixture(): Promise<TenantFixture> {
  const admin = createClient(localUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const actors: Record<string, Actor> = {};

  actors.adminA = await createActor(admin, 'ADMIN', 'admin-a', suffix);
  actors.directorA = await createActor(admin, 'DIRECTOR', 'director-a', suffix);
  actors.secretaryA = await createActor(admin, 'SECRETARY', 'secretary-a', suffix);
  actors.teacherA = await createActor(admin, 'TEACHER', 'teacher-a', suffix);
  actors.studentA = await createActor(admin, 'STUDENT', 'student-a', suffix);
  actors.guardianA = await createActor(admin, 'GUARDIAN', 'guardian-a', suffix);

  actors.adminB = await createActor(admin, 'ADMIN', 'admin-b', suffix);
  actors.directorB = await createActor(admin, 'DIRECTOR', 'director-b', suffix);
  actors.secretaryB = await createActor(admin, 'SECRETARY', 'secretary-b', suffix);
  actors.teacherB = await createActor(admin, 'TEACHER', 'teacher-b', suffix);
  actors.studentB = await createActor(admin, 'STUDENT', 'student-b', suffix);
  actors.guardianB = await createActor(admin, 'GUARDIAN', 'guardian-b', suffix);
  actors.superAdmin = await createActor(
    admin,
    'ADMIN',
    'super-admin',
    suffix,
    'SUPER_ADMIN',
  );

  const accountA = (await insertOne(admin, 'accounts', {
    name: `Tenant A ${suffix}`,
    owner_profile_id: actors.adminA.id,
    institution_limit: 3,
    status: 'ACTIVE',
  })).id;
  const accountB = (await insertOne(admin, 'accounts', {
    name: `Tenant B ${suffix}`,
    owner_profile_id: actors.adminB.id,
    institution_limit: 1,
    status: 'ACTIVE',
  })).id;

  const institutionA = (await insertOne(admin, 'institutions', {
    account_id: accountA,
    name: `Institution A1 ${suffix}`,
    active: true,
  })).id;
  const institutionA2 = (await insertOne(admin, 'institutions', {
    account_id: accountA,
    name: `Institution A2 ${suffix}`,
    active: true,
  })).id;
  const institutionB = (await insertOne(admin, 'institutions', {
    account_id: accountB,
    name: `Institution B1 ${suffix}`,
    active: true,
  })).id;

  const memberships = [
    ['adminA', institutionA, 'ADMIN'],
    ['directorA', institutionA, 'DIRECTOR'],
    ['secretaryA', institutionA, 'SECRETARY'],
    ['teacherA', institutionA, 'TEACHER'],
    ['studentA', institutionA, 'STUDENT'],
    ['guardianA', institutionA, 'GUARDIAN'],
    ['adminB', institutionB, 'ADMIN'],
    ['directorB', institutionB, 'DIRECTOR'],
    ['secretaryB', institutionB, 'SECRETARY'],
    ['teacherB', institutionB, 'TEACHER'],
    ['studentB', institutionB, 'STUDENT'],
    ['guardianB', institutionB, 'GUARDIAN'],
  ] as const;
  let membershipA = '';
  let membershipB = '';
  for (const [actorKey, institutionId, role] of memberships) {
    const membership = await insertOne(admin, 'memberships', {
      profile_id: actors[actorKey].id,
      institution_id: institutionId,
      role,
      active: true,
    });
    if (actorKey === 'adminA') membershipA = membership.id;
    if (actorKey === 'adminB') membershipB = membership.id;
  }

  const directorA = actors.directorA.client;
  const directorB = actors.directorB.client;
  const teacherA = actors.teacherA.client;
  const teacherB = actors.teacherB.client;

  // Use authenticated operational actors for product data. The service role
  // is reserved for identity/bootstrap data and system-only event ingestion.
  const yearA = (await insertOne(directorA, 'academic_years', {
    institution_id: institutionA,
    name: `2026 A ${suffix}`,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    active: true,
  })).id;
  const yearB = (await insertOne(directorB, 'academic_years', {
    institution_id: institutionB,
    name: `2026 B ${suffix}`,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    active: true,
  })).id;
  const termA = (await insertOne(directorA, 'terms', {
    academic_year_id: yearA,
    name: `1º Bimestre A ${suffix}`,
    start_date: '2026-01-01',
    end_date: '2026-03-31',
    active: true,
  })).id;
  const termB = (await insertOne(directorB, 'terms', {
    academic_year_id: yearB,
    name: `1º Bimestre B ${suffix}`,
    start_date: '2026-01-01',
    end_date: '2026-03-31',
    active: true,
  })).id;

  const classA = (await insertOne(directorA, 'classes', {
    institution_id: institutionA,
    academic_year_id: yearA,
    name: `Turma A ${suffix}`,
    grade_level: '1º EM',
    shift: 'MATUTINO',
    capacity: 30,
    active: true,
  })).id;
  const classB = (await insertOne(directorB, 'classes', {
    institution_id: institutionB,
    academic_year_id: yearB,
    name: `Turma B ${suffix}`,
    grade_level: '1º EM',
    shift: 'MATUTINO',
    capacity: 30,
    active: true,
  })).id;
  const subjectA = (await insertOne(directorA, 'subjects', {
    institution_id: institutionA,
    name: `Matemática A ${suffix}`,
    code: `MTA-${suffix}`,
    workload: 100,
    active: true,
  })).id;
  const subjectB = (await insertOne(directorB, 'subjects', {
    institution_id: institutionB,
    name: `Matemática B ${suffix}`,
    code: `MTB-${suffix}`,
    workload: 100,
    active: true,
  })).id;

  await insertOne(directorA, 'class_curriculum_items', {
    institution_id: institutionA,
    class_id: classA,
    subject_id: subjectA,
    weekly_lessons: 2,
    lesson_duration_minutes: 50,
    active: true,
  });
  await insertOne(directorB, 'class_curriculum_items', {
    institution_id: institutionB,
    class_id: classB,
    subject_id: subjectB,
    weekly_lessons: 2,
    lesson_duration_minutes: 50,
    active: true,
  });
  await insertOne(directorA, 'teacher_subjects', {
    institution_id: institutionA,
    teacher_profile_id: actors.teacherA.id,
    subject_id: subjectA,
    primary_subject: true,
    active: true,
  });
  await insertOne(directorB, 'teacher_subjects', {
    institution_id: institutionB,
    teacher_profile_id: actors.teacherB.id,
    subject_id: subjectB,
    primary_subject: true,
    active: true,
  });

  const offeringA = (await insertOne(directorA, 'subject_offerings', {
    subject_id: subjectA,
    class_id: classA,
    teacher_profile_id: actors.teacherA.id,
    term_id: termA,
    active: true,
  })).id;
  const offeringB = (await insertOne(directorB, 'subject_offerings', {
    subject_id: subjectB,
    class_id: classB,
    teacher_profile_id: actors.teacherB.id,
    term_id: termB,
    active: true,
  })).id;

  const studentA = (await insertOne(admin, 'students', {
    profile_id: actors.studentA.id,
    institution_id: institutionA,
    registration_number: `A-${suffix}`,
    birth_date: '2010-01-01',
    active: true,
  })).id;
  const studentB = (await insertOne(admin, 'students', {
    profile_id: actors.studentB.id,
    institution_id: institutionB,
    registration_number: `B-${suffix}`,
    birth_date: '2010-01-01',
    active: true,
  })).id;
  const guardianshipA = (await insertOne(admin, 'guardianships', {
    student_id: studentA,
    guardian_profile_id: actors.guardianA.id,
    relationship: 'PARENT',
    is_primary: true,
    active: true,
  })).id;
  const guardianshipB = (await insertOne(admin, 'guardianships', {
    student_id: studentB,
    guardian_profile_id: actors.guardianB.id,
    relationship: 'PARENT',
    is_primary: true,
    active: true,
  })).id;
  const enrollmentA = (await insertOne(directorA, 'enrollments', {
    student_id: studentA,
    class_id: classA,
    academic_year_id: yearA,
    status: 'ACTIVE',
    enrolled_at: '2026-01-01T00:00:00Z',
    active: true,
  })).id;
  const enrollmentB = (await insertOne(directorB, 'enrollments', {
    student_id: studentB,
    class_id: classB,
    academic_year_id: yearB,
    status: 'ACTIVE',
    enrolled_at: '2026-01-01T00:00:00Z',
    active: true,
  })).id;

  const roomA = (await insertOne(directorA, 'rooms', {
    institution_id: institutionA,
    name: `Sala A ${suffix}`,
    capacity: 30,
    active: true,
  })).id;
  const roomB = (await insertOne(directorB, 'rooms', {
    institution_id: institutionB,
    name: `Sala B ${suffix}`,
    capacity: 30,
    active: true,
  })).id;
  const timetableEntryA = (await insertOne(directorA, 'timetable_entries', {
    institution_id: institutionA,
    subject_offering_id: offeringA,
    room_id: roomA,
    day_of_week: 1,
    start_time: '08:00',
    end_time: '08:50',
    academic_year_id: yearA,
    term_id: termA,
    active: true,
  })).id;
  const timetableEntryB = (await insertOne(directorB, 'timetable_entries', {
    institution_id: institutionB,
    subject_offering_id: offeringB,
    room_id: roomB,
    day_of_week: 1,
    start_time: '08:00',
    end_time: '08:50',
    academic_year_id: yearB,
    term_id: termB,
    active: true,
  })).id;

  const assessmentA = (await insertOne(admin, 'assessments', {
    institution_id: institutionA,
    subject_offering_id: offeringA,
    term_id: termA,
    title: `Avaliação A ${suffix}`,
    assessment_type: 'EXAM',
    assessment_date: '2026-09-07',
    max_score: 10,
    weight: 1,
    status: 'PUBLISHED',
    created_by: actors.teacherA.id,
  })).id;
  const assessmentB = (await insertOne(admin, 'assessments', {
    institution_id: institutionB,
    subject_offering_id: offeringB,
    term_id: termB,
    title: `Avaliação B ${suffix}`,
    assessment_type: 'EXAM',
    assessment_date: '2026-09-07',
    max_score: 10,
    weight: 1,
    status: 'PUBLISHED',
    created_by: actors.teacherB.id,
  })).id;
  const gradeA = (await insertOne(admin, 'grades', {
    institution_id: institutionA,
    assessment_id: assessmentA,
    student_id: studentA,
    score: 9,
    status: 'GRADED',
    recorded_by: actors.teacherA.id,
  })).id;
  const gradeB = (await insertOne(admin, 'grades', {
    institution_id: institutionB,
    assessment_id: assessmentB,
    student_id: studentB,
    score: 8,
    status: 'GRADED',
    recorded_by: actors.teacherB.id,
  })).id;

  const attendanceSessionA = (await insertOne(admin, 'attendance_sessions', {
    institution_id: institutionA,
    subject_offering_id: offeringA,
    session_date: '2026-09-07',
    starts_at: '08:00',
    ends_at: '08:50',
    status: 'CLOSED',
    created_by: actors.teacherA.id,
  })).id;
  const attendanceSessionB = (await insertOne(admin, 'attendance_sessions', {
    institution_id: institutionB,
    subject_offering_id: offeringB,
    session_date: '2026-09-07',
    starts_at: '08:00',
    ends_at: '08:50',
    status: 'CLOSED',
    created_by: actors.teacherB.id,
  })).id;
  const attendanceRecordA = (await insertOne(admin, 'attendance_records', {
    institution_id: institutionA,
    attendance_session_id: attendanceSessionA,
    student_id: studentA,
    status: 'PRESENT',
    recorded_by: actors.teacherA.id,
  })).id;
  const attendanceRecordB = (await insertOne(admin, 'attendance_records', {
    institution_id: institutionB,
    attendance_session_id: attendanceSessionB,
    student_id: studentB,
    status: 'PRESENT',
    recorded_by: actors.teacherB.id,
  })).id;

  const learningPostA = (await insertOne(teacherA, 'learning_posts', {
    institution_id: institutionA,
    class_id: classA,
    subject_id: subjectA,
    created_by: actors.teacherA.id,
    post_type: 'MATERIAL',
    title: `Material A ${suffix}`,
    body: 'Conteúdo de teste do tenant A',
    active: true,
    published_at: new Date().toISOString(),
  })).id;
  const learningPostB = (await insertOne(teacherB, 'learning_posts', {
    institution_id: institutionB,
    class_id: classB,
    subject_id: subjectB,
    created_by: actors.teacherB.id,
    post_type: 'MATERIAL',
    title: `Material B ${suffix}`,
    body: 'Conteúdo de teste do tenant B',
    active: true,
    published_at: new Date().toISOString(),
  })).id;
  const announcementA = (await insertOne(directorA, 'institution_announcements', {
    institution_id: institutionA,
    title: `Comunicado A ${suffix}`,
    message: 'Comunicado exclusivo do tenant A',
    audience: 'ALL',
    active: true,
    created_by: actors.directorA.id,
  })).id;
  const announcementB = (await insertOne(directorB, 'institution_announcements', {
    institution_id: institutionB,
    title: `Comunicado B ${suffix}`,
    message: 'Comunicado exclusivo do tenant B',
    audience: 'ALL',
    active: true,
    created_by: actors.directorB.id,
  })).id;
  const announcementStudentA = (await insertOne(directorA, 'institution_announcements', {
    institution_id: institutionA,
    title: `Aviso estudantes A ${suffix}`,
    message: 'Aviso exclusivo para estudantes do tenant A',
    audience: 'STUDENTS',
    active: true,
    created_by: actors.directorA.id,
  })).id;
  const announcementStudentB = (await insertOne(directorB, 'institution_announcements', {
    institution_id: institutionB,
    title: `Aviso estudantes B ${suffix}`,
    message: 'Aviso exclusivo para estudantes do tenant B',
    audience: 'STUDENTS',
    active: true,
    created_by: actors.directorB.id,
  })).id;
  const announcementGuardianA = (await insertOne(directorA, 'institution_announcements', {
    institution_id: institutionA,
    title: `Aviso responsáveis A ${suffix}`,
    message: 'Aviso exclusivo para responsáveis do tenant A',
    audience: 'GUARDIANS',
    active: true,
    created_by: actors.directorA.id,
  })).id;
  const announcementGuardianB = (await insertOne(directorB, 'institution_announcements', {
    institution_id: institutionB,
    title: `Aviso responsáveis B ${suffix}`,
    message: 'Aviso exclusivo para responsáveis do tenant B',
    audience: 'GUARDIANS',
    active: true,
    created_by: actors.directorB.id,
  })).id;

  const accessDeviceA = (await insertOne(directorA, 'access_devices', {
    institution_id: institutionA,
    name: `Portaria A ${suffix}`,
    provider: 'TEST',
    model: 'AUDIT',
    status: 'OFFLINE',
  })).id;
  const accessDeviceB = (await insertOne(directorB, 'access_devices', {
    institution_id: institutionB,
    name: `Portaria B ${suffix}`,
    provider: 'TEST',
    model: 'AUDIT',
    status: 'OFFLINE',
  })).id;
  const accessEventA = globalThis.crypto.randomUUID();
  await insertWithoutSelect(admin, 'access_events', {
    id: accessEventA,
    institution_id: institutionA,
    student_id: studentA,
    device_id: accessDeviceA,
    provider: 'TEST',
    provider_event_id: `event-a-${suffix}`,
    event_type: 'ENTRY',
    direction: 'ENTRY',
    occurred_at: '2026-09-07T08:00:00Z',
    status: 'ACCEPTED',
  });
  const accessEventB = globalThis.crypto.randomUUID();
  await insertWithoutSelect(admin, 'access_events', {
    id: accessEventB,
    institution_id: institutionB,
    student_id: studentB,
    device_id: accessDeviceB,
    provider: 'TEST',
    provider_event_id: `event-b-${suffix}`,
    event_type: 'ENTRY',
    direction: 'ENTRY',
    occurred_at: '2026-09-07T08:00:00Z',
    status: 'ACCEPTED',
  });

  const contractA = (await insertOne(directorA, 'financial_contracts', {
    institution_id: institutionA,
    student_id: studentA,
    academic_year_id: yearA,
    financial_responsible_profile_id: actors.guardianA.id,
    status: 'ACTIVE',
    base_amount: 100000,
    enrollment_fee_amount: 0,
    installment_count: 1,
    first_due_date: '2026-02-10',
    default_due_day: 10,
    created_by: actors.directorA.id,
  })).id;
  const contractB = (await insertOne(directorB, 'financial_contracts', {
    institution_id: institutionB,
    student_id: studentB,
    academic_year_id: yearB,
    financial_responsible_profile_id: actors.guardianB.id,
    status: 'ACTIVE',
    base_amount: 100000,
    enrollment_fee_amount: 0,
    installment_count: 1,
    first_due_date: '2026-02-10',
    default_due_day: 10,
    created_by: actors.directorB.id,
  })).id;
  const invoiceA = (await insertOne(directorA, 'invoices', {
    institution_id: institutionA,
    contract_id: contractA,
    student_id: studentA,
    financial_responsible_profile_id: actors.guardianA.id,
    reference: `A-${suffix}`,
    due_date: '2026-02-10',
    base_amount: 100000,
    sequence_number: 1,
    status: 'OPEN',
  })).id;
  const invoiceB = (await insertOne(directorB, 'invoices', {
    institution_id: institutionB,
    contract_id: contractB,
    student_id: studentB,
    financial_responsible_profile_id: actors.guardianB.id,
    reference: `B-${suffix}`,
    due_date: '2026-02-10',
    base_amount: 100000,
    sequence_number: 1,
    status: 'OPEN',
  })).id;
  const paymentA = (await insertOne(directorA, 'payments', {
    institution_id: institutionA,
    invoice_id: invoiceA,
    provider: 'MOCK',
    provider_payment_id: `A-${suffix}`,
    method: 'MANUAL',
    amount: 100000,
    status: 'PAID',
    registered_by: actors.directorA.id,
  })).id;
  const paymentB = (await insertOne(directorB, 'payments', {
    institution_id: institutionB,
    invoice_id: invoiceB,
    provider: 'MOCK',
    provider_payment_id: `B-${suffix}`,
    method: 'MANUAL',
    amount: 100000,
    status: 'PAID',
    registered_by: actors.directorB.id,
  })).id;

  return {
    accountA,
    accountB,
    institutionA,
    institutionA2,
    institutionB,
    membershipA,
    membershipB,
    yearA,
    yearB,
    termA,
    termB,
    classA,
    classB,
    subjectA,
    subjectB,
    offeringA,
    offeringB,
    studentA,
    studentB,
    guardianshipA,
    guardianshipB,
    enrollmentA,
    enrollmentB,
    guardianA: actors.guardianA.id,
    guardianB: actors.guardianB.id,
    assessmentA,
    assessmentB,
    gradeA,
    gradeB,
    attendanceSessionA,
    attendanceSessionB,
    attendanceRecordA,
    attendanceRecordB,
    roomA,
    roomB,
    timetableEntryA,
    timetableEntryB,
    learningPostA,
    learningPostB,
    announcementA,
    announcementB,
    announcementStudentA,
    announcementStudentB,
    announcementGuardianA,
    announcementGuardianB,
    accessDeviceA,
    accessDeviceB,
    accessEventA,
    accessEventB,
    contractA,
    contractB,
    invoiceA,
    invoiceB,
    paymentA,
    paymentB,
    actors,
    admin,
  };
}

localDescribe('multi-tenant isolation against local Supabase', () => {
  let fixture: TenantFixture;

  it('creates a complete two-tenant authenticated fixture', async () => {
    fixture = await createFixture();
    expect(fixture.institutionA).not.toBe(fixture.institutionB);
    expect(fixture.actors.teacherA.client).toBeDefined();
  }, 120_000);

  it('allows legitimate tenant access and blocks cross-tenant reads', async () => {
    const rows = [
      ['adminA', 'institutions', fixture.institutionA],
      ['adminA', 'profiles', fixture.actors.adminA.id],
      ['adminA', 'memberships', fixture.membershipA],
      ['directorA', 'academic_years', fixture.yearA],
      ['directorA', 'terms', fixture.termA],
      ['directorA', 'subjects', fixture.subjectA],
      ['adminA', 'enrollments', fixture.enrollmentA],
      ['adminA', 'rooms', fixture.roomA],
      ['adminA', 'timetable_entries', fixture.timetableEntryA],
      ['directorA', 'students', fixture.studentA],
      ['secretaryA', 'classes', fixture.classA],
      ['teacherA', 'subject_offerings', fixture.offeringA],
      ['teacherA', 'assessments', fixture.assessmentA],
      ['teacherA', 'grades', fixture.gradeA],
      ['teacherA', 'attendance_sessions', fixture.attendanceSessionA],
      ['teacherA', 'attendance_records', fixture.attendanceRecordA],
      ['teacherA', 'learning_posts', fixture.learningPostA],
      ['studentA', 'students', fixture.studentA],
      ['studentA', 'assessments', fixture.assessmentA],
      ['studentA', 'grades', fixture.gradeA],
      ['studentA', 'attendance_sessions', fixture.attendanceSessionA],
      ['studentA', 'attendance_records', fixture.attendanceRecordA],
      ['guardianA', 'students', fixture.studentA],
      ['guardianA', 'guardianships', fixture.guardianshipA],
      ['studentA', 'institution_announcements', fixture.announcementA],
    ] as const;
    for (const [actorKey, table, id] of rows) {
      const result = await readIds(fixture.actors[actorKey].client, table, id);
      expect(result.error, `${actorKey} own ${table}`).toBeNull();
      expect(result.rows, `${actorKey} own ${table}`).toHaveLength(1);
    }

    const crossTenantRows = [
      ['adminA', 'institutions', fixture.institutionB],
      ['adminA', 'profiles', fixture.actors.adminB.id],
      ['adminA', 'memberships', fixture.membershipB],
      ['directorA', 'academic_years', fixture.yearB],
      ['directorA', 'terms', fixture.termB],
      ['directorA', 'subjects', fixture.subjectB],
      ['adminA', 'enrollments', fixture.enrollmentB],
      ['adminA', 'rooms', fixture.roomB],
      ['adminA', 'timetable_entries', fixture.timetableEntryB],
      ['directorA', 'students', fixture.studentB],
      ['secretaryA', 'classes', fixture.classB],
      ['teacherA', 'subject_offerings', fixture.offeringB],
      ['teacherA', 'assessments', fixture.assessmentB],
      ['teacherA', 'grades', fixture.gradeB],
      ['teacherA', 'attendance_sessions', fixture.attendanceSessionB],
      ['teacherA', 'attendance_records', fixture.attendanceRecordB],
      ['teacherA', 'learning_posts', fixture.learningPostB],
      ['studentA', 'students', fixture.studentB],
      ['studentA', 'assessments', fixture.assessmentB],
      ['studentA', 'grades', fixture.gradeB],
      ['studentA', 'institution_announcements', fixture.announcementB],
      ['guardianA', 'students', fixture.studentB],
      ['guardianA', 'guardianships', fixture.guardianshipB],
    ] as const;
    for (const [actorKey, table, id] of crossTenantRows) {
      const result = await readIds(fixture.actors[actorKey].client, table, id);
      expect(result.error, `${actorKey} cross ${table}`).toBeNull();
      expect(result.rows, `${actorKey} cross ${table}`).toHaveLength(0);
    }
  }, 120_000);

  it('audits announcements by staff, student, guardian, audience, and tenant', async () => {
    const staffChecks = [
      ['directorA', fixture.announcementA],
      ['directorA', fixture.announcementStudentA],
      ['directorA', fixture.announcementGuardianA],
      ['directorA', fixture.announcementB],
      ['secretaryA', fixture.announcementA],
      ['secretaryA', fixture.announcementB],
    ] as const;
    for (const [actorKey, id] of staffChecks) {
      const result = await readIds(fixture.actors[actorKey].client, 'institution_announcements', id);
      expect(result.error, `${actorKey} announcements`).toBeNull();
      expect(result.rows, `${actorKey} announcements`).toHaveLength(id === fixture.announcementB ? 0 : 1);
    }

    const studentChecks = [
      [fixture.announcementA, 1],
      [fixture.announcementStudentA, 1],
      [fixture.announcementGuardianA, 0],
      [fixture.announcementB, 0],
      [fixture.announcementStudentB, 0],
      [fixture.announcementGuardianB, 0],
    ] as const;
    for (const [id, expectedLength] of studentChecks) {
      const result = await readIds(fixture.actors.studentA.client, 'institution_announcements', id);
      expect(result.error, `studentA announcement ${id}`).toBeNull();
      expect(result.rows, `studentA announcement ${id}`).toHaveLength(expectedLength);
    }

    const guardianChecks = [
      [fixture.announcementA, 1],
      [fixture.announcementStudentA, 0],
      [fixture.announcementGuardianA, 1],
      [fixture.announcementB, 0],
      [fixture.announcementStudentB, 0],
      [fixture.announcementGuardianB, 0],
    ] as const;
    for (const [id, expectedLength] of guardianChecks) {
      const result = await readIds(fixture.actors.guardianA.client, 'institution_announcements', id);
      expect(result.error, `guardianA announcement ${id}`).toBeNull();
      expect(result.rows, `guardianA announcement ${id}`).toHaveLength(expectedLength);
    }
  }, 120_000);

  it('audits Portaria reads and writes across institutions', async () => {
    const eventResults = [];
    for (const actorKey of ['directorA', 'secretaryA'] as const) {
      const ownEvent = await readIds(
        fixture.actors[actorKey].client,
        'access_events',
        fixture.accessEventA,
      );
      const foreignEvent = await readIds(
        fixture.actors[actorKey].client,
        'access_events',
        fixture.accessEventB,
      );
      const classification = classifyScopedRead(ownEvent, foreignEvent);
      eventResults.push({ actorKey, ownEvent, foreignEvent, classification });
      expect(foreignEvent.rows, `${actorKey} foreign access event`).toHaveLength(0);
      if (classification === 'LEAK') {
        throw new Error(`${actorKey}: cross-tenant Portaria event leak`);
      }
    }

    for (const actorKey of ['adminA', 'teacherA', 'studentA', 'guardianA'] as const) {
      const ownEvent = await readIds(
        fixture.actors[actorKey].client,
        'access_events',
        fixture.accessEventA,
      );
      const ownDevice = await readIds(
        fixture.actors[actorKey].client,
        'access_devices',
        fixture.accessDeviceA,
      );
      expect(ownEvent.error, `${actorKey} Portaria event authorization`).toBeNull();
      expect(ownEvent.rows, `${actorKey} Portaria event authorization`).toHaveLength(0);
      expect(ownDevice.error, `${actorKey} Portaria device authorization`).toBeNull();
      expect(ownDevice.rows, `${actorKey} Portaria device authorization`).toHaveLength(0);
    }

    const ownDevice = await readIds(
      fixture.actors.directorA.client,
      'access_devices',
      fixture.accessDeviceA,
    );
    const foreignDevice = await readIds(
      fixture.actors.directorA.client,
      'access_devices',
      fixture.accessDeviceB,
    );
    const deviceReadClassification = classifyScopedRead(ownDevice, foreignDevice);
    expect(foreignDevice.rows).toHaveLength(0);
    if (deviceReadClassification === 'LEAK') {
      throw new Error('directorA: cross-tenant Portaria device leak');
    }

    const originalDevice = await fixture.actors.directorA.client
      .from('access_devices')
      .select('name')
      .eq('id', fixture.accessDeviceA)
      .single();
    const foreignDeviceBefore = await fixture.actors.directorB.client
      .from('access_devices')
      .select('name')
      .eq('id', fixture.accessDeviceB)
      .single();
    const ownUpdate = await writeAttempt(() =>
      fixture.actors.directorA.client
        .from('access_devices')
        .update({ name: 'Portaria A auditada' })
        .eq('id', fixture.accessDeviceA)
        .select('id'),
    );
    const foreignUpdate = await writeAttempt(() =>
      fixture.actors.directorA.client
        .from('access_devices')
        .update({ name: 'Portaria B adulterada' })
        .eq('id', fixture.accessDeviceB)
        .select('id'),
    );
    const foreignInsert = await writeAttempt(() =>
      fixture.actors.directorA.client
        .from('access_devices')
        .insert({
          institution_id: fixture.institutionB,
          name: 'Dispositivo B adulterado',
          provider: 'TEST',
          model: 'AUDIT',
        })
        .select('id'),
    );
    const eventInsert = await writeAttempt(() =>
      fixture.actors.directorA.client
        .from('access_events')
        .insert({
          id: globalThis.crypto.randomUUID(),
          institution_id: fixture.institutionA,
          provider: 'TEST',
          provider_event_id: `manual-event-${Date.now()}`,
          event_type: 'ENTRY',
          occurred_at: '2026-09-07T08:00:00Z',
        })
        .select('id'),
    );

    const ownUpdateClassification = ownUpdate.error?.match(/permission denied/i)
      ? 'BLOCKED_BY_GRANTS'
      : ownUpdate.rows.length === 1
        ? 'PASS_RLS'
        : 'NOT_AVAILABLE';
    expect(foreignUpdate.rows).toHaveLength(0);
    expect(foreignInsert.rows).toHaveLength(0);
    expect(eventInsert.rows).toHaveLength(0);
    expect(eventInsert.error).toMatch(/permission denied|row-level security/i);
    if (ownUpdateClassification === 'PASS_RLS') {
      expect(
        (await fixture.actors.directorA.client.from('access_devices').select('name').eq('id', fixture.accessDeviceA).single()).data?.name,
      ).toBe('Portaria A auditada');
    }
    expect(
      (await fixture.actors.directorB.client.from('access_devices').select('name').eq('id', fixture.accessDeviceB).single()).data?.name,
    ).toBe(foreignDeviceBefore.data?.name);
    if (foreignUpdate.rows.length > 0 || foreignInsert.rows.length > 0) {
      throw new Error('directorA: cross-tenant Portaria write leak');
    }

    if (ownUpdateClassification === 'PASS_RLS') {
      await fixture.actors.directorA.client
        .from('access_devices')
        .update({ name: originalDevice.data?.name })
        .eq('id', fixture.accessDeviceA);
    }

    console.log(JSON.stringify({
      finding: 'ACCESS_CONTROL_TENANT_BOUNDARY',
      eventResults,
      deviceReadClassification,
      ownUpdateClassification,
      ownDeviceUpdate: ownUpdate,
      foreignDeviceUpdate: foreignUpdate,
      foreignDeviceInsert: foreignInsert,
      authenticatedEventInsert: eventInsert,
      profilesActiveCoverage: 'covered by the profiles.active matrix below',
    }));
  }, 120_000);

  it('audits finance table privileges separately from tenant isolation', async () => {
    const checks = [
      ['financial_contracts', fixture.contractA, fixture.contractB],
      ['invoices', fixture.invoiceA, fixture.invoiceB],
      ['payments', fixture.paymentA, fixture.paymentB],
    ] as const;
    const results = [];
    for (const [table, ownId, foreignId] of checks) {
      const own = await readIds(fixture.actors.directorA.client, table, ownId);
      const foreign = await readIds(fixture.actors.directorA.client, table, foreignId);
      const classification = classifyScopedRead(own, foreign);
      results.push({ table, own, foreign, classification });
      expect(foreign.rows, `${table} cross-tenant rows`).toHaveLength(0);
      if (classification === 'LEAK') {
        throw new Error(`${table}: cross-tenant finance read leak`);
      }
    }

    const guardianResults = [];
    for (const [table, ownId, foreignId] of checks) {
      const own = await readIds(fixture.actors.guardianA.client, table, ownId);
      const foreign = await readIds(fixture.actors.guardianA.client, table, foreignId);
      guardianResults.push({ table, own, foreign });
      expect(own.error, `${table} guardian own access`).toBeNull();
      expect(own.rows, `${table} guardian own access`).toHaveLength(1);
      expect(foreign.rows, `${table} guardian cross-tenant rows`).toHaveLength(0);
    }

    const adminContract = await readIds(
      fixture.actors.adminA.client,
      'financial_contracts',
      fixture.contractA,
    );
    expect(adminContract.error, 'adminA finance authorization').toBeNull();
    expect(adminContract.rows, 'adminA finance authorization').toHaveLength(0);

    const adminFinanceWrite = await writeAttempt(() =>
      fixture.actors.adminA.client
        .from('financial_contracts')
        .insert({
          institution_id: fixture.institutionA,
          student_id: fixture.studentA,
          academic_year_id: fixture.yearA,
          financial_responsible_profile_id: fixture.actors.guardianA.id,
          status: 'ACTIVE',
          base_amount: 1,
          enrollment_fee_amount: 0,
          installment_count: 1,
          first_due_date: '2026-02-10',
          default_due_day: 10,
          created_by: fixture.actors.adminA.id,
        })
        .select('id'),
    );
    expect(adminFinanceWrite.rows, 'adminA finance write authorization').toHaveLength(0);
    expect(adminFinanceWrite.error, 'adminA finance write authorization').toMatch(
      /permission denied|row-level security/i,
    );

    console.log(JSON.stringify({
      finding: 'FINANCE_ISOLATION_RESULTS',
      staffActor: 'directorA',
      results,
      guardianResults,
      adminFinanceRead: adminContract,
      adminFinanceWrite,
      note: 'BLOCKED_BY_GRANTS is not treated as RLS proof',
    }));
  }, 60_000);

  it('denies IDOR writes and does not change tenant B records', async () => {
    const institutionBefore = await fixture.admin
      .from('institutions')
      .select('name')
      .eq('id', fixture.institutionB)
      .single();
    const gradeBefore = await fixture.admin
      .from('grades')
      .select('score')
      .eq('id', fixture.gradeB)
      .single();
    const studentBefore = await fixture.admin
      .from('students')
      .select('registration_number')
      .eq('id', fixture.studentB)
      .single();
    for (const table of [
      'classes',
      'enrollments',
      'assessments',
      'attendance_records',
      'institution_announcements',
      'financial_contracts',
    ]) {
      expect((await fixture.actors.directorB.client.from(table).select('id').limit(1)).error, `${table} snapshot`).toBeNull();
    }
    const countsBefore = new Map(
      await Promise.all(
        ['classes', 'enrollments', 'assessments', 'attendance_records', 'institution_announcements', 'financial_contracts']
          .map(async (table) => [table, await readCount(fixture.actors.directorB.client, table)] as const),
      ),
    );

    const checks = [
      ['adminA updates institution B', () => fixture.actors.adminA.client.from('institutions').update({ name: 'tampered' }).eq('id', fixture.institutionB).select('id')],
      ['directorA creates class B', () => fixture.actors.directorA.client.from('classes').insert({ institution_id: fixture.institutionB, academic_year_id: fixture.yearB, name: 'tampered', grade_level: '1º EM', shift: 'MATUTINO', capacity: 30 }).select('id')],
      ['secretaryA enrolls student B', () => fixture.actors.secretaryA.client.from('enrollments').insert({ student_id: fixture.studentB, class_id: fixture.classB, academic_year_id: fixture.yearB, status: 'ACTIVE', active: true }).select('id')],
      ['teacherA creates assessment B', () => fixture.actors.teacherA.client.from('assessments').insert({ institution_id: fixture.institutionB, subject_offering_id: fixture.offeringB, term_id: fixture.termB, title: 'tampered', assessment_type: 'EXAM', assessment_date: '2026-09-07', max_score: 10, weight: 1, status: 'DRAFT', created_by: fixture.actors.teacherA.id }).select('id')],
      ['teacherA records grade B', () => fixture.actors.teacherA.client.from('grades').insert({ institution_id: fixture.institutionB, assessment_id: fixture.assessmentB, student_id: fixture.studentB, score: 1, status: 'GRADED', recorded_by: fixture.actors.teacherA.id }).select('id')],
      ['teacherA records attendance B', () => fixture.actors.teacherA.client.from('attendance_records').insert({ institution_id: fixture.institutionB, attendance_session_id: fixture.attendanceSessionB, student_id: fixture.studentB, status: 'ABSENT', recorded_by: fixture.actors.teacherA.id }).select('id')],
      ['guardianA updates student B', () => fixture.actors.guardianA.client.from('students').update({ registration_number: 'tampered' }).eq('id', fixture.studentB).select('id')],
      ['studentA updates grade B', () => fixture.actors.studentA.client.from('grades').update({ score: 1 }).eq('id', fixture.gradeB).select('id')],
      ['adminA creates announcement B', () => fixture.actors.adminA.client.from('institution_announcements').insert({ institution_id: fixture.institutionB, title: 'tampered', message: 'tampered', audience: 'ALL', created_by: fixture.actors.adminA.id }).select('id')],
      ['guardianA creates financial contract B', () => fixture.actors.guardianA.client.from('financial_contracts').insert({ institution_id: fixture.institutionB, student_id: fixture.studentB, academic_year_id: fixture.yearB, financial_responsible_profile_id: fixture.guardianA, status: 'ACTIVE', base_amount: 1, enrollment_fee_amount: 0, installment_count: 1, first_due_date: '2026-02-10', default_due_day: 10, created_by: fixture.guardianA }).select('id')],
    ] as const;
    const results = [];
    for (const [label, operation] of checks) {
      const result = await writeAttempt(operation);
      const verificationTable = label.includes('institution')
        ? 'institutions'
        : label.includes('class')
          ? 'classes'
          : label.includes('enroll')
            ? 'enrollments'
            : label.includes('assessment')
              ? 'assessments'
              : label.includes('grade')
                ? 'grades'
                : label.includes('attendance')
                  ? 'attendance_records'
                  : label.includes('student')
                    ? 'students'
                    : label.includes('announcement')
                      ? 'institution_announcements'
                      : 'financial_contracts';
      results.push({ label, ...result, verificationTable });
      expect(result.rows, label).toHaveLength(0);
    }
    expect(results.every((result) => result.rows.length === 0)).toBe(true);
    expect(results.some((result) => !result.explicitDenied)).toBe(true);
    expect((await fixture.admin.from('institutions').select('name').eq('id', fixture.institutionB).single()).data?.name)
      .toBe(institutionBefore.data?.name);
    expect((await fixture.admin.from('grades').select('score').eq('id', fixture.gradeB).single()).data?.score)
      .toBe(gradeBefore.data?.score);
    expect((await fixture.admin.from('students').select('registration_number').eq('id', fixture.studentB).single()).data?.registration_number)
      .toBe(studentBefore.data?.registration_number);
    for (const [table, count] of countsBefore) {
      expect(await readCount(fixture.actors.directorB.client, table), `${table} row count`).toBe(count);
    }
    console.log(JSON.stringify({
      finding: 'IDOR_WRITE_RESULTS',
      results,
      note: 'zero rows were verified against tenant-B director snapshots; explicitDenied distinguishes HTTP/RLS errors from silent no-op updates',
    }));
  }, 120_000);

  it('revokes institutional access when membership.active becomes false', async () => {
    await fixture.admin
      .from('memberships')
      .update({ active: false })
      .eq('profile_id', fixture.actors.directorA.id)
      .eq('institution_id', fixture.institutionA);

    const result = await readIds(
      fixture.actors.directorA.client,
      'classes',
      fixture.classA,
    );
    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(0);

    await fixture.admin
      .from('memberships')
      .update({ active: true })
      .eq('profile_id', fixture.actors.directorA.id)
      .eq('institution_id', fixture.institutionA);
  }, 60_000);

  it('revokes guardian access when the guardianship becomes inactive', async () => {
    const { error: deactivateError } = await fixture.admin
      .from('guardianships')
      .update({ active: false })
      .eq('id', fixture.guardianshipA);
    expect(deactivateError).toBeNull();

    const result = await readIds(
      fixture.actors.guardianA.client,
      'students',
      fixture.studentA,
    );
    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(0);

    const { error: restoreError } = await fixture.admin
      .from('guardianships')
      .update({ active: true })
      .eq('id', fixture.guardianshipA);
    expect(restoreError).toBeNull();
  }, 60_000);

  it('audits profiles.active independently for every role with an old JWT', async () => {
    const checks = [
      ['adminA', 'classes', fixture.classA],
      ['directorA', 'classes', fixture.classA],
      ['secretaryA', 'classes', fixture.classA],
      ['teacherA', 'subject_offerings', fixture.offeringA],
      ['studentA', 'students', fixture.studentA],
      ['guardianA', 'students', fixture.studentA],
    ] as const;
    const results = [];

    for (const [actorKey, table, id] of checks) {
      const actor = fixture.actors[actorKey];
      const before = await readIds(actor.client, table, id);
      expect(before.error, `${actorKey} access before deactivation`).toBeNull();
      expect(before.rows, `${actorKey} access before deactivation`).toHaveLength(1);
      const portariaBefore = actorKey === 'directorA' || actorKey === 'secretaryA'
        ? await readIds(actor.client, 'access_events', fixture.accessEventA)
        : null;
      if (portariaBefore) {
        expect(portariaBefore.error, `${actorKey} Portaria before deactivation`).toBeNull();
        expect(portariaBefore.rows, `${actorKey} Portaria before deactivation`).toHaveLength(1);
      }

      const { error: deactivateError } = await fixture.admin
        .from('profiles')
        .update({ active: false })
        .eq('id', actor.id);
      expect(deactivateError, `${actorKey} profile deactivation`).toBeNull();

      const after = await readIds(actor.client, table, id);
      const portariaAfter = portariaBefore
        ? await readIds(actor.client, 'access_events', fixture.accessEventA)
        : null;
      const classification = after.rows.length > 0
        ? 'KNOWN GAP'
        : after.error
          ? 'BLOCKED'
          : 'SAFE';
      results.push({
        role: actor.role,
        actorKey,
        jwtIssuedBeforeDeactivation: true,
        table,
        before,
        after,
        portariaBefore,
        portariaAfter,
        classification,
      });

      const { error: restoreError } = await fixture.admin
        .from('profiles')
        .update({ active: true })
        .eq('id', actor.id);
      expect(restoreError, `${actorKey} profile restore`).toBeNull();
    }

    console.log(JSON.stringify({
      finding: 'PROFILE_ACTIVE_REVOCATION_MATRIX',
      jwtWasNotRefreshed: true,
      results,
    }));
  }, 120_000);

  it('keeps SUPER_ADMIN global access distinct from a normal administrator', async () => {
    const superAdminRows = await readIds(
      fixture.actors.superAdmin.client,
      'institutions',
      fixture.institutionB,
    );
    const normalAdminRows = await readIds(
      fixture.actors.adminA.client,
      'institutions',
      fixture.institutionB,
    );

    expect(superAdminRows.rows).toHaveLength(1);
    expect(normalAdminRows.rows).toHaveLength(0);
  }, 60_000);

  it('keeps same-account institution ownership distinct from membership access', async () => {
    const ownerAccess = await readIds(
      fixture.actors.adminA.client,
      'institutions',
      fixture.institutionA2,
    );
    const teacherAccess = await readIds(
      fixture.actors.teacherA.client,
      'institutions',
      fixture.institutionA2,
    );

    expect(ownerAccess.error).toBeNull();
    expect(ownerAccess.rows).toHaveLength(1);
    expect(teacherAccess.error).toBeNull();
    expect(teacherAccess.rows).toHaveLength(0);
  }, 60_000);

  it('enforces tenant boundaries in exposed authorization RPCs', async () => {
    const rpcChecks = [
      ['adminA can_access own institution', 'adminA', 'can_access_institution', { target_institution_id: fixture.institutionA }, true],
      ['adminA can_access foreign institution', 'adminA', 'can_access_institution', { target_institution_id: fixture.institutionB }, false],
      ['adminA can_manage own institution', 'adminA', 'can_manage_institution_operations', { target_institution_id: fixture.institutionA }, true],
      ['adminA can_manage foreign institution', 'adminA', 'can_manage_institution_operations', { target_institution_id: fixture.institutionB }, false],
      ['adminA is_institution_admin own institution', 'adminA', 'is_institution_admin', { target_institution_id: fixture.institutionA }, true],
      ['adminA is_institution_admin foreign institution', 'adminA', 'is_institution_admin', { target_institution_id: fixture.institutionB }, false],
      ['adminA owns own account', 'adminA', 'owns_account', { target_account_id: fixture.accountA }, true],
      ['adminA does not own foreign account', 'adminA', 'owns_account', { target_account_id: fixture.accountB }, false],
      ['adminA owns own institution', 'adminA', 'owns_institution', { target_institution_id: fixture.institutionA }, true],
      ['adminA does not own foreign institution', 'adminA', 'owns_institution', { target_institution_id: fixture.institutionB }, false],
      ['teacherA can_access own institution', 'teacherA', 'can_access_institution', { target_institution_id: fixture.institutionA }, true],
      ['teacherA cannot_access foreign institution', 'teacherA', 'can_access_institution', { target_institution_id: fixture.institutionB }, false],
      ['superAdmin can_access foreign institution', 'superAdmin', 'can_access_institution', { target_institution_id: fixture.institutionB }, true],
    ] as const;

    const results = [];
    for (const [label, actorKey, functionName, args, expected] of rpcChecks) {
      const { data, error } = await fixture.actors[actorKey].client.rpc(functionName, args);
      results.push({ label, data, error: error?.message ?? null });
      expect(error, label).toBeNull();
      expect(data, label).toBe(expected);
    }

    const enrollmentCountBefore = await readCount(fixture.actors.directorB.client, 'enrollments');
    const bundleAttempt = await fixture.actors.adminA.client.rpc(
      'create_full_student_enrollment_bundle',
      {
        p_payload: {
          institution_id: fixture.institutionB,
          student_id: fixture.studentB,
          academic_year_id: fixture.yearB,
          class_id: fixture.classB,
          identity: {},
          address: {},
          previous_schooling: {},
          health: {},
          documents: [],
          guardians: [],
        },
      },
    );
    expect(bundleAttempt.data).toBeNull();
    expect(bundleAttempt.error?.message).toMatch(/papel|matr[ií]cula|institui[cç][aã]o/i);
    expect(await readCount(fixture.actors.directorB.client, 'enrollments')).toBe(enrollmentCountBefore);

    console.log(JSON.stringify({
      finding: 'AUTHORIZATION_RPC_BOUNDARIES',
      results,
      crossTenantBundle: {
        error: bundleAttempt.error?.message ?? null,
        enrollmentCountUnchanged: true,
      },
    }));
  }, 60_000);
});
