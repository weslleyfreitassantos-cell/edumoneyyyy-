import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type Client = SupabaseClient<any, any>;
type Role = 'ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'STUDENT' | 'GUARDIAN';
type Actor = { id: string; client: Client };

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const localDescribe = localUrl && anonKey && serviceRoleKey ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(client: Client, table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function actor(service: Client, role: Role, label: string, suffix: string): Promise<Actor> {
  const email = `class-council-${label}-${suffix}@local.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password: 'ClassCouncil!2026', email_confirm: true });
  if (error) throw new Error(`auth ${label}: ${error.message}`);
  const user = required(data.user, `auth ${label}`);
  await insertOne(service, 'profiles', { id: user.id, full_name: `Council ${label}`, email, role, active: true });
  const client = createClient(localUrl!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password: 'ClassCouncil!2026' });
  if (session.error || !session.data.session) throw new Error(`login ${label}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, client };
}

localDescribe('class council runtime', () => {
  let service: Client;
  let director: Actor;
  let secretary: Actor;
  let teacher: Actor;
  let unassignedTeacher: Actor;
  let studentActor: Actor;
  let guardian: Actor;
  let foreignDirector: Actor;
  let admin: Actor;
  let institutionId: string;
  let yearId: string;
  let termId: string;
  let classId: string;
  let studentId: string;
  let councilId: string;

  beforeAll(async () => {
    service = createClient(localUrl!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    director = await actor(service, 'DIRECTOR', 'director', suffix);
    secretary = await actor(service, 'SECRETARY', 'secretary', suffix);
    teacher = await actor(service, 'TEACHER', 'teacher', suffix);
    unassignedTeacher = await actor(service, 'TEACHER', 'unassigned-teacher', suffix);
    studentActor = await actor(service, 'STUDENT', 'student', suffix);
    guardian = await actor(service, 'GUARDIAN', 'guardian', suffix);
    foreignDirector = await actor(service, 'DIRECTOR', 'foreign-director', suffix);
    admin = await actor(service, 'ADMIN', 'admin', suffix);
    const accountId = (await insertOne(service, 'accounts', { name: `Council account ${suffix}`, owner_profile_id: admin.id, institution_limit: 1, status: 'ACTIVE' })).id;
    institutionId = (await insertOne(service, 'institutions', { account_id: accountId, name: `Council school ${suffix}`, active: true })).id;
    for (const [profileId, role] of [[director.id, 'DIRECTOR'], [secretary.id, 'SECRETARY'], [teacher.id, 'TEACHER'], [unassignedTeacher.id, 'TEACHER'], [studentActor.id, 'STUDENT'], [guardian.id, 'GUARDIAN'], [admin.id, 'ADMIN']] as const) {
      await insertOne(service, 'memberships', { profile_id: profileId, institution_id: institutionId, role, active: true });
    }
    yearId = (await insertOne(director.client, 'academic_years', { institution_id: institutionId, name: `2026 ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true })).id;
    termId = (await insertOne(director.client, 'terms', { academic_year_id: yearId, name: `1º período ${suffix}`, start_date: '2026-01-01', end_date: '2026-04-30', active: true })).id;
    classId = (await insertOne(director.client, 'classes', { institution_id: institutionId, academic_year_id: yearId, name: `Turma ${suffix}`, grade_level: '1º EM', shift: 'MATUTINO', capacity: 30, active: true })).id;
    const subjectId = (await insertOne(director.client, 'subjects', { institution_id: institutionId, name: `Matemática ${suffix}`, code: `CC-${suffix}`, active: true })).id;
    await insertOne(director.client, 'class_curriculum_items', { institution_id: institutionId, class_id: classId, subject_id: subjectId, weekly_lessons: 2, lesson_duration_minutes: 50, needs_review: false, active: true });
    await insertOne(director.client, 'subject_offerings', { subject_id: subjectId, class_id: classId, teacher_profile_id: teacher.id, term_id: termId, active: true });
    studentId = (await insertOne(service, 'students', { institution_id: institutionId, profile_id: studentActor.id, registration_number: `CC-${suffix}`, birth_date: '2010-01-01', active: true })).id;
    await insertOne(director.client, 'enrollments', { student_id: studentId, class_id: classId, academic_year_id: yearId, enrolled_at: '2026-01-01', status: 'ACTIVE', active: true });
    await insertOne(service, 'guardianships', { student_id: studentId, guardian_profile_id: guardian.id, relationship: 'Parent', is_primary: true, active: true });
    const foreignAccountId = (await insertOne(service, 'accounts', { name: `Foreign council account ${suffix}`, owner_profile_id: foreignDirector.id, institution_limit: 1, status: 'ACTIVE' })).id;
    const foreignInstitutionId = (await insertOne(service, 'institutions', { account_id: foreignAccountId, name: `Foreign council school ${suffix}`, active: true })).id;
    await insertOne(service, 'memberships', { profile_id: foreignDirector.id, institution_id: foreignInstitutionId, role: 'DIRECTOR', active: true });
  }, 120_000);

  it('enforces one non-canceled council per context and allows a new one after cancellation', async () => {
    const first = await director.client.rpc('create_class_council', { p_institution_id: institutionId, p_academic_year_id: yearId, p_term_id: termId, p_class_id: classId, p_scheduled_at: null, p_general_notes: 'Primeiro conselho' });
    expect(first.error).toBeNull();
    councilId = required(first.data?.id, 'council id');
    const duplicate = await director.client.rpc('create_class_council', { p_institution_id: institutionId, p_academic_year_id: yearId, p_term_id: termId, p_class_id: classId, p_scheduled_at: null, p_general_notes: null });
    expect(duplicate.data).toBeNull();
    expect(duplicate.error?.code).toBe('23505');
    expect((await director.client.rpc('cancel_class_council', { p_council_id: councilId })).error).toBeNull();
    const replacement = await director.client.rpc('create_class_council', { p_institution_id: institutionId, p_academic_year_id: yearId, p_term_id: termId, p_class_id: classId, p_scheduled_at: null, p_general_notes: 'Novo conselho' });
    expect(replacement.error).toBeNull();
    councilId = required(replacement.data?.id, 'replacement council id');
  }, 60_000);

  it('opens atomically with a complete snapshot, scopes reads, and preserves the snapshot on reopen', async () => {
    const snapshot = [{ student_id: studentId, full_name: 'Aluno do conselho', registration_number: 'CC-STUDENT', class_id: classId, class_name: 'Turma do conselho', average_grade: 72, attendance_percentage: 91, low_performance_subjects: 0, low_attendance_subjects: 0, pending_items: 0, risk_level: 'NORMAL', risk_reasons: [], data_status: 'PARTIAL' }];
    const opened = await director.client.rpc('open_class_council', { p_council_id: councilId, p_snapshots: snapshot });
    expect(opened.error).toBeNull();
    expect(opened.data?.status).toBe('OPEN');
    const notes = await director.client.from('class_council_student_notes').select('student_id, average_grade, data_status').eq('council_id', councilId);
    expect(notes.error).toBeNull();
    expect(notes.data).toEqual([{ student_id: studentId, average_grade: 72, data_status: 'PARTIAL' }]);
    const secretaryRead = await secretary.client.from('class_councils').select('id, status').eq('id', councilId).single();
    expect(secretaryRead.error).toBeNull();
    expect(secretaryRead.data?.status).toBe('OPEN');
    const secretaryNote = await secretary.client.rpc('update_class_council_student_note', { p_council_id: councilId, p_student_id: studentId, p_observation: 'Registro operacional da secretaria.' });
    expect(secretaryNote.error).toBeNull();
    expect((await director.client.rpc('add_class_council_participant', { p_council_id: councilId, p_profile_id: teacher.id, p_participant_role: 'TEACHER' })).error).toBeNull();
    expect((await secretary.client.rpc('complete_class_council', { p_council_id: councilId })).error?.code).toBe('42501');
    expect((await director.client.rpc('complete_class_council', { p_council_id: councilId })).error).toBeNull();
    const reopened = await director.client.rpc('reopen_class_council', { p_council_id: councilId, p_reason: 'Revisar decisão pedagógica' });
    expect(reopened.error).toBeNull();
    expect(reopened.data?.status).toBe('OPEN');
    const afterReopen = await director.client.from('class_council_student_notes').select('average_grade, data_status').eq('council_id', councilId).single();
    expect(afterReopen.data).toEqual({ average_grade: 72, data_status: 'PARTIAL' });
  }, 60_000);

  it('allows the assigned teacher to save only its own contribution and blocks ADMIN access', async () => {
    const note = await teacher.client.rpc('update_class_council_student_note', { p_council_id: councilId, p_student_id: studentId, p_teacher_contribution: 'Participa bem das discussões.' });
    expect(note.error).toBeNull();
    expect(note.data.teacher_contributions[teacher.id]).toBe('Participa bem das discussões.');
    const adminRead = await admin.client.from('class_councils').select('id').eq('id', councilId);
    expect(adminRead.error).toBeNull();
    expect(adminRead.data).toEqual([]);
  }, 60_000);

  it('keeps teacher assignment, audience, and tenant boundaries enforced by RLS', async () => {
    const unassignedTeacherRead = await unassignedTeacher.client.from('class_councils').select('id').eq('id', councilId);
    expect(unassignedTeacherRead.error).toBeNull();
    expect(unassignedTeacherRead.data).toEqual([]);
    const studentRead = await studentActor.client.from('class_councils').select('id').eq('id', councilId);
    expect(studentRead.error).toBeNull();
    expect(studentRead.data).toEqual([]);
    const guardianRead = await guardian.client.from('class_councils').select('id').eq('id', councilId);
    expect(guardianRead.error).toBeNull();
    expect(guardianRead.data).toEqual([]);
    const foreignRead = await foreignDirector.client.from('class_councils').select('id').eq('id', councilId);
    expect(foreignRead.error).toBeNull();
    expect(foreignRead.data).toEqual([]);
  }, 60_000);
});
