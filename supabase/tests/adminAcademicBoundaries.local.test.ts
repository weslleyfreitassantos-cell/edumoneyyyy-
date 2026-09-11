import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type AnyClient = SupabaseClient<any, any, any>;
type Role = 'ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'STUDENT' | 'GUARDIAN';
type Actor = { id: string; client: AnyClient };
type Result = { rows: any[]; error: string | null };

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const localDescribe = localUrl && anonKey && serviceRoleKey ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(
  client: AnyClient,
  table: string,
  row: Record<string, unknown>,
): Promise<Record<string, any>> {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert result`);
}

async function readId(client: AnyClient, table: string, id: string): Promise<Result> {
  const { data, error } = await client.from(table).select('id').eq('id', id);
  return { rows: data ?? [], error: error?.message ?? null };
}

async function readMembershipByProfile(client: AnyClient, profileId: string): Promise<Result> {
  const { data, error } = await client.from('memberships').select('id').eq('profile_id', profileId);
  return { rows: data ?? [], error: error?.message ?? null };
}

async function createActor(
  service: AnyClient,
  role: Role,
  label: string,
  suffix: string,
  platformRole = 'USER',
): Promise<Actor> {
  const email = `admin-boundary-${suffix}-${label}@local.test`;
  const password = 'AdminBoundary!2026';
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`auth ${label}: ${error.message}`);

  const user = required(data.user, `auth ${label}`);
  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: `Admin boundary ${label}`,
    email,
    role,
    active: true,
    platform_role: platformRole,
  });
  const client = createClient(localUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) {
    throw new Error(`sign in ${label}: ${session.error?.message ?? 'no session'}`);
  }
  return { id: user.id, client };
}

type Fixture = {
  actors: Record<string, Actor>;
  accountA: string;
  accountB: string;
  institutionA: string;
  institutionA2: string;
  institutionB: string;
  yearA: string;
  yearA2: string;
  yearB: string;
  termA: string;
  classA: string;
  classA2: string;
  classB: string;
  subjectA: string;
  offeringA: string;
  offeringB: string;
  studentA: string;
  studentB: string;
  guardianshipA: string;
  enrollmentA: string;
  roomA: string;
  timetableA: string;
  assessmentA: string;
  gradeA: string;
  attendanceSessionA: string;
  attendanceRecordA: string;
  calendarEventA: string;
  bookRecommendationA: string;
};

async function createFixture(): Promise<Fixture> {
  const service = createClient(localUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const actors: Record<string, Actor> = {};
  const actorDefinitions: Array<[Role, string]> = [
    ['ADMIN', 'admin-a'],
    ['DIRECTOR', 'director-a'],
    ['SECRETARY', 'secretary-a'],
    ['TEACHER', 'teacher-a'],
    ['STUDENT', 'student-a'],
    ['GUARDIAN', 'guardian-a'],
    ['ADMIN', 'admin-b'],
    ['DIRECTOR', 'director-b'],
    ['TEACHER', 'teacher-b'],
    ['STUDENT', 'student-b'],
    ['GUARDIAN', 'guardian-b'],
  ];
  for (const [role, label] of actorDefinitions) actors[label] = await createActor(service, role, label, suffix);
  actors.superAdmin = await createActor(service, 'ADMIN', 'super-admin', suffix, 'SUPER_ADMIN');

  const accountA = (await insertOne(service, 'accounts', {
    name: `Admin boundary A ${suffix}`,
    owner_profile_id: actors['admin-a'].id,
    institution_limit: 2,
    status: 'ACTIVE',
  })).id;
  const accountB = (await insertOne(service, 'accounts', {
    name: `Admin boundary B ${suffix}`,
    owner_profile_id: actors['admin-b'].id,
    institution_limit: 1,
    status: 'ACTIVE',
  })).id;
  const institutionA = (await insertOne(service, 'institutions', { account_id: accountA, name: `Boundary A1 ${suffix}`, active: true })).id;
  const institutionA2 = (await insertOne(service, 'institutions', { account_id: accountA, name: `Boundary A2 ${suffix}`, active: true })).id;
  const institutionB = (await insertOne(service, 'institutions', { account_id: accountB, name: `Boundary B1 ${suffix}`, active: true })).id;

  const memberships: Array<[string, string, Role]> = [
    ['admin-a', institutionA, 'ADMIN'],
    ['director-a', institutionA, 'DIRECTOR'],
    ['secretary-a', institutionA, 'SECRETARY'],
    ['teacher-a', institutionA, 'TEACHER'],
    ['student-a', institutionA, 'STUDENT'],
    ['guardian-a', institutionA, 'GUARDIAN'],
    ['admin-b', institutionB, 'ADMIN'],
    ['director-b', institutionB, 'DIRECTOR'],
    ['teacher-b', institutionB, 'TEACHER'],
    ['student-b', institutionB, 'STUDENT'],
    ['guardian-b', institutionB, 'GUARDIAN'],
  ];
  for (const [label, institutionId, role] of memberships) {
    await insertOne(service, 'memberships', { profile_id: actors[label].id, institution_id: institutionId, role, active: true });
  }

  const directorA = actors['director-a'].client;
  const directorB = actors['director-b'].client;
  await insertOne(service, 'memberships', { profile_id: actors['director-a'].id, institution_id: institutionA2, role: 'DIRECTOR', active: true });
  const yearA = (await insertOne(directorA, 'academic_years', { institution_id: institutionA, name: `Year A ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true })).id;
  const yearA2 = (await insertOne(directorA, 'academic_years', { institution_id: institutionA2, name: `Year A2 ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true })).id;
  const yearB = (await insertOne(directorB, 'academic_years', { institution_id: institutionB, name: `Year B ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true })).id;
  const termA = (await insertOne(directorA, 'terms', { academic_year_id: yearA, name: `Term A ${suffix}`, start_date: '2026-01-01', end_date: '2026-06-30', active: true })).id;
  const termB = (await insertOne(directorB, 'terms', { academic_year_id: yearB, name: `Term B ${suffix}`, start_date: '2026-01-01', end_date: '2026-06-30', active: true })).id;
  const classA = (await insertOne(directorA, 'classes', { institution_id: institutionA, academic_year_id: yearA, name: `Class A ${suffix}`, grade_level: '1º EM', shift: 'MATUTINO', capacity: 30, active: true })).id;
  const classA2 = (await insertOne(directorA, 'classes', { institution_id: institutionA2, academic_year_id: yearA2, name: `Class A2 ${suffix}`, grade_level: '1º EM', shift: 'MATUTINO', capacity: 30, active: true })).id;
  const classB = (await insertOne(directorB, 'classes', { institution_id: institutionB, academic_year_id: yearB, name: `Class B ${suffix}`, grade_level: '1º EM', shift: 'MATUTINO', capacity: 30, active: true })).id;
  const subjectA = (await insertOne(directorA, 'subjects', { institution_id: institutionA, name: `Subject A ${suffix}`, code: `BOUNDARY-A-${suffix}`, workload: 100, active: true })).id;
  const subjectB = (await insertOne(directorB, 'subjects', { institution_id: institutionB, name: `Subject B ${suffix}`, code: `BOUNDARY-B-${suffix}`, workload: 100, active: true })).id;
  await insertOne(directorA, 'class_curriculum_items', { institution_id: institutionA, class_id: classA, subject_id: subjectA, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
  await insertOne(directorB, 'class_curriculum_items', { institution_id: institutionB, class_id: classB, subject_id: subjectB, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
  await insertOne(directorA, 'teacher_subjects', { institution_id: institutionA, teacher_profile_id: actors['teacher-a'].id, subject_id: subjectA, primary_subject: true, active: true });
  await insertOne(directorB, 'teacher_subjects', { institution_id: institutionB, teacher_profile_id: actors['teacher-b'].id, subject_id: subjectB, primary_subject: true, active: true });
  const offeringA = (await insertOne(directorA, 'subject_offerings', { subject_id: subjectA, class_id: classA, teacher_profile_id: actors['teacher-a'].id, term_id: termA, active: true })).id;
  const offeringB = (await insertOne(directorB, 'subject_offerings', { subject_id: subjectB, class_id: classB, teacher_profile_id: actors['teacher-b'].id, term_id: termB, active: true })).id;
  const studentA = (await insertOne(service, 'students', { profile_id: actors['student-a'].id, institution_id: institutionA, registration_number: `STUDENT-A-${suffix}`, birth_date: '2010-01-01', active: true })).id;
  const studentB = (await insertOne(service, 'students', { profile_id: actors['student-b'].id, institution_id: institutionB, registration_number: `STUDENT-B-${suffix}`, birth_date: '2010-01-01', active: true })).id;
  const guardianshipA = (await insertOne(service, 'guardianships', { student_id: studentA, guardian_profile_id: actors['guardian-a'].id, relationship: 'PARENT', is_primary: true, active: true })).id;
  await insertOne(service, 'guardianships', { student_id: studentB, guardian_profile_id: actors['guardian-b'].id, relationship: 'PARENT', is_primary: true, active: true });
  const enrollmentA = (await insertOne(directorA, 'enrollments', { student_id: studentA, class_id: classA, academic_year_id: yearA, enrolled_at: '2026-01-01', status: 'ACTIVE', active: true })).id;
  await insertOne(directorB, 'enrollments', { student_id: studentB, class_id: classB, academic_year_id: yearB, enrolled_at: '2026-01-01', status: 'ACTIVE', active: true });
  const roomA = (await insertOne(directorA, 'rooms', { institution_id: institutionA, name: `Room A ${suffix}`, capacity: 30, active: true })).id;
  const roomB = (await insertOne(directorB, 'rooms', { institution_id: institutionB, name: `Room B ${suffix}`, capacity: 30, active: true })).id;
  const timetableA = (await insertOne(directorA, 'timetable_entries', { institution_id: institutionA, subject_offering_id: offeringA, room_id: roomA, day_of_week: 1, start_time: '08:00', end_time: '08:50', academic_year_id: yearA, term_id: termA, active: true })).id;
  await insertOne(directorB, 'timetable_entries', { institution_id: institutionB, subject_offering_id: offeringB, room_id: roomB, day_of_week: 1, start_time: '08:00', end_time: '08:50', academic_year_id: yearB, term_id: termB, active: true });
  const assessmentA = (await insertOne(directorA, 'assessments', { institution_id: institutionA, subject_offering_id: offeringA, term_id: termA, title: `Assessment A ${suffix}`, assessment_type: 'EXAM', assessment_date: '2026-05-01', max_score: 10, weight: 1, status: 'PUBLISHED', created_by: actors['teacher-a'].id })).id;
  const assessmentB = (await insertOne(directorB, 'assessments', { institution_id: institutionB, subject_offering_id: offeringB, term_id: termB, title: `Assessment B ${suffix}`, assessment_type: 'EXAM', assessment_date: '2026-05-01', max_score: 10, weight: 1, status: 'PUBLISHED', created_by: actors['teacher-b'].id })).id;
  const gradeA = (await insertOne(directorA, 'grades', { institution_id: institutionA, assessment_id: assessmentA, student_id: studentA, score: 9, status: 'GRADED', recorded_by: actors['teacher-a'].id })).id;
  await insertOne(directorB, 'grades', { institution_id: institutionB, assessment_id: assessmentB, student_id: studentB, score: 8, status: 'GRADED', recorded_by: actors['teacher-b'].id });
  const attendanceSessionA = (await insertOne(directorA, 'attendance_sessions', { institution_id: institutionA, subject_offering_id: offeringA, session_date: '2026-05-04', starts_at: '08:00', ends_at: '08:50', status: 'CLOSED', created_by: actors['teacher-a'].id })).id;
  const attendanceSessionB = (await insertOne(directorB, 'attendance_sessions', { institution_id: institutionB, subject_offering_id: offeringB, session_date: '2026-05-04', starts_at: '08:00', ends_at: '08:50', status: 'CLOSED', created_by: actors['teacher-b'].id })).id;
  const attendanceRecordA = (await insertOne(directorA, 'attendance_records', { institution_id: institutionA, attendance_session_id: attendanceSessionA, student_id: studentA, status: 'PRESENT', recorded_by: actors['teacher-a'].id })).id;
  await insertOne(directorB, 'attendance_records', { institution_id: institutionB, attendance_session_id: attendanceSessionB, student_id: studentB, status: 'PRESENT', recorded_by: actors['teacher-b'].id });
  const calendarEventA = (await insertOne(directorA, 'academic_calendar_events', { institution_id: institutionA, academic_year_id: yearA, title: `Calendar A ${suffix}`, event_type: 'SCHOOL_EVENT', starts_at: '2026-09-20T00:00:00Z', all_day: true, audience: 'ALL', active: true, created_by: actors['director-a'].id })).id;
  await insertOne(directorB, 'academic_calendar_events', { institution_id: institutionB, academic_year_id: yearB, title: `Calendar B ${suffix}`, event_type: 'SCHOOL_EVENT', starts_at: '2026-09-20T00:00:00Z', all_day: true, audience: 'ALL', active: true, created_by: actors['director-b'].id });
  const teacherA = actors['teacher-a'].client;
  const bookRecommendationA = (await insertOne(teacherA, 'book_recommendations', { institution_id: institutionA, subject_offering_id: offeringA, title: `Book A ${suffix}`, author: 'Boundary test', isbn: '9780000000000', active: true, created_by: actors['teacher-a'].id })).id;

  return { actors, accountA, accountB, institutionA, institutionA2, institutionB, yearA, yearA2, yearB, termA, classA, classA2, classB, subjectA, offeringA, offeringB, studentA, studentB, guardianshipA, enrollmentA, roomA, timetableA, assessmentA, gradeA, attendanceSessionA, attendanceRecordA, calendarEventA, bookRecommendationA };
}

localDescribe('admin academic boundaries runtime', () => {
  let fixture: Fixture;

  beforeAll(async () => { fixture = await createFixture(); }, 120_000);

  it('preserves commercial ownership and ADMIN to DIRECTOR management only', async () => {
    const admin = fixture.actors['admin-a'].client;
    for (const [table, id, expected] of [
      ['accounts', fixture.accountA, 1],
      ['accounts', fixture.accountB, 0],
      ['institutions', fixture.institutionA, 1],
      ['institutions', fixture.institutionA2, 1],
      ['institutions', fixture.institutionB, 0],
      ['profiles', fixture.actors['director-a'].id, 1],
      ['profiles', fixture.actors['secretary-a'].id, 0],
      ['profiles', fixture.actors['teacher-a'].id, 0],
    ] as const) {
      expect((await readId(admin, table, id)).rows, `ADMIN ${table}`).toHaveLength(expected);
    }
    expect((await readMembershipByProfile(admin, fixture.actors['director-a'].id)).rows, 'ADMIN DIRECTOR membership').toHaveLength(2);
    expect((await readMembershipByProfile(admin, fixture.actors['secretary-a'].id)).rows, 'ADMIN SECRETARY membership').toHaveLength(0);
    for (const [name, args, expected] of [
      ['can_access_institution', { target_institution_id: fixture.institutionA }, true],
      ['owns_institution', { target_institution_id: fixture.institutionA }, true],
      ['is_institution_admin', { target_institution_id: fixture.institutionA }, false],
      ['can_manage_institution_operations', { target_institution_id: fixture.institutionA }, false],
    ] as const) {
      const { data, error } = await admin.rpc(name, args);
      expect(error, name).toBeNull();
      expect(data, name).toBe(expected);
    }
  }, 60_000);

  it('blocks ADMIN from academic records and operational RPCs', async () => {
    const admin = fixture.actors['admin-a'].client;
    const checks = [
      ['academic_years', fixture.yearA], ['academic_years', fixture.yearA2], ['terms', fixture.termA], ['classes', fixture.classA], ['classes', fixture.classA2], ['subjects', fixture.subjectA],
      ['class_curriculum_items', fixture.subjectA], ['enrollments', fixture.enrollmentA], ['subject_offerings', fixture.offeringA],
      ['rooms', fixture.roomA], ['teacher_subjects', fixture.subjectA], ['timetable_entries', fixture.timetableA],
      ['students', fixture.studentA], ['guardianships', fixture.guardianshipA], ['assessments', fixture.assessmentA],
      ['grades', fixture.gradeA], ['attendance_sessions', fixture.attendanceSessionA], ['attendance_records', fixture.attendanceRecordA],
      ['academic_calendar_events', fixture.calendarEventA], ['book_recommendations', fixture.bookRecommendationA],
    ] as const;
    for (const [table, id] of checks) expect((await readId(admin, table, id)).rows, `ADMIN ${table}`).toHaveLength(0);

    const inserted = await admin.from('academic_years').insert({ institution_id: fixture.institutionA, name: `Blocked ${Date.now()}`, start_date: '2027-01-01', end_date: '2027-12-31' }).select('id');
    expect(inserted.data ?? []).toHaveLength(0);
    expect(inserted.error?.message).toMatch(/permission denied|row-level security/i);
    const updated = await admin.from('classes').update({ name: 'ADMIN tampered class' }).eq('id', fixture.classA).select('id');
    expect(updated.data ?? []).toHaveLength(0);
    const service = createClient(localUrl!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    expect((await service.from('classes').select('name').eq('id', fixture.classA).single()).data?.name).not.toBe('ADMIN tampered class');

    const bundle = await admin.rpc('create_academic_year_with_terms', { p_institution_id: fixture.institutionA, p_name: `Blocked bundle ${Date.now()}`, p_start_date: '2027-01-01', p_end_date: '2027-12-31', p_active: true, p_terms: [] });
    expect(bundle.data).toBeNull();
    expect(bundle.error?.code).toBe('42501');
    const blockers = await admin.rpc('get_academic_day_blockers', { p_institution_id: fixture.institutionA, p_date: '2026-09-20' });
    expect(blockers.data).toBeNull();
    expect(blockers.error?.code).toBe('42501');
    const workload = await admin.rpc('get_subject_offering_workload_progress', { p_institution_id: fixture.institutionA, p_subject_offering_id: fixture.offeringA, p_reference_date: '2026-09-20' });
    expect(workload.data).toBeNull();
    expect(workload.error?.code).toBe('42501');
  }, 60_000);

  it('keeps academic access available to operational roles and scoped to the tenant', async () => {
    const ownChecks = [
      ['director-a', 'academic_years', fixture.yearA], ['director-a', 'classes', fixture.classA], ['secretary-a', 'classes', fixture.classA],
      ['teacher-a', 'subject_offerings', fixture.offeringA], ['student-a', 'students', fixture.studentA], ['guardian-a', 'students', fixture.studentA],
      ['student-a', 'academic_calendar_events', fixture.calendarEventA], ['guardian-a', 'academic_calendar_events', fixture.calendarEventA],
      ['superAdmin', 'academic_years', fixture.yearA], ['superAdmin', 'academic_years', fixture.yearB],
    ] as const;
    for (const [actor, table, id] of ownChecks) {
      const result = await readId(fixture.actors[actor].client, table, id);
      expect(result.error, `${actor} ${table}`).toBeNull();
      expect(result.rows, `${actor} ${table}`).toHaveLength(1);
    }
    const foreignChecks = [
      ['director-a', 'classes', fixture.classB], ['secretary-a', 'classes', fixture.classB], ['teacher-a', 'subject_offerings', fixture.offeringB],
      ['student-a', 'students', fixture.studentB], ['guardian-a', 'students', fixture.studentB], ['director-a', 'academic_years', fixture.yearB],
    ] as const;
    for (const [actor, table, id] of foreignChecks) {
      const result = await readId(fixture.actors[actor].client, table, id);
      expect(result.error, `${actor} cross ${table}`).toBeNull();
      expect(result.rows, `${actor} cross ${table}`).toHaveLength(0);
    }
  }, 60_000);

  it('revokes the same JWT when membership or profile becomes inactive', async () => {
    const service = createClient(localUrl!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const director = fixture.actors['director-a'];
    const membership = await service.from('memberships').select('id').eq('profile_id', director.id).eq('institution_id', fixture.institutionA).single();
    expect(membership.error).toBeNull();
    await service.from('memberships').update({ active: false }).eq('id', membership.data?.id);
    expect((await readId(director.client, 'classes', fixture.classA)).rows).toHaveLength(0);
    await service.from('memberships').update({ active: true }).eq('id', membership.data?.id);
    await service.from('profiles').update({ active: false }).eq('id', director.id);
    expect((await readId(director.client, 'classes', fixture.classA)).rows).toHaveLength(0);
    await service.from('profiles').update({ active: true }).eq('id', director.id);
  }, 60_000);
});
