import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type Client = SupabaseClient<any, any, any>;

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const localDescribe = localUrl && anonKey && serviceRoleKey ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(
  client: Client,
  table: string,
  row: Record<string, unknown>,
): Promise<Record<string, any>> {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(
  service: Client,
  role: string,
  label: string,
  suffix: string,
): Promise<{ id: string; client: Client }> {
  const email = `class-diary-${label}-${suffix}@local.test`;
  const password = 'ClassDiary!2026';
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`auth ${label}: ${error.message}`);
  const user = required(data.user, `auth ${label}`);
  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: `Diary ${label}`,
    email,
    role,
    active: true,
  });
  const client = createClient(localUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`login ${label}: ${signIn.error?.message ?? 'no session'}`);
  }
  return { id: user.id, client };
}

localDescribe('class diary runtime', () => {
  let service: Client;
  let director: Client;
  let teacher: Client;
  let institutionId = '';
  let offeringId = '';
  let studentId = '';
  let sessionId = '';
  let recordId = '';

  beforeAll(async () => {
    service = createClient(localUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const admin = await createActor(service, 'ADMIN', 'admin', suffix);
    const directorActor = await createActor(service, 'DIRECTOR', 'director', suffix);
    const teacherActor = await createActor(service, 'TEACHER', 'teacher', suffix);
    const studentActor = await createActor(service, 'STUDENT', 'student', suffix);
    teacher = teacherActor.client;
    director = directorActor.client;

    const account = await insertOne(service, 'accounts', {
      name: `Diary account ${suffix}`,
      owner_profile_id: admin.id,
      institution_limit: 1,
      status: 'ACTIVE',
    });
    institutionId = (await insertOne(service, 'institutions', {
      account_id: account.id,
      name: `Diary school ${suffix}`,
      active: true,
    })).id;

    for (const [profileId, role] of [[admin.id, 'ADMIN'], [directorActor.id, 'DIRECTOR'], [teacherActor.id, 'TEACHER'], [studentActor.id, 'STUDENT']] as const) {
      await insertOne(service, 'memberships', {
        profile_id: profileId,
        institution_id: institutionId,
        role,
        active: true,
      });
    }

    const academicYear = await insertOne(director, 'academic_years', {
      institution_id: institutionId,
      name: `2026 ${suffix}`,
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      active: true,
    });
    const term = await insertOne(director, 'terms', {
      academic_year_id: academicYear.id,
      name: `September ${suffix}`,
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      active: true,
    });
    const schoolClass = await insertOne(director, 'classes', {
      institution_id: institutionId,
      academic_year_id: academicYear.id,
      name: `Turma ${suffix}`,
      grade_level: '1º EM',
      shift: 'MATUTINO',
      capacity: 30,
      active: true,
    });
    const subject = await insertOne(director, 'subjects', {
      institution_id: institutionId,
      name: `Matemática ${suffix}`,
      code: `DIARY-${suffix}`,
      workload: 100,
      active: true,
    });
    await insertOne(director, 'class_curriculum_items', {
      institution_id: institutionId,
      class_id: schoolClass.id,
      subject_id: subject.id,
      weekly_lessons: 1,
      lesson_duration_minutes: 50,
      active: true,
    });
    offeringId = (await insertOne(director, 'subject_offerings', {
      subject_id: subject.id,
      class_id: schoolClass.id,
      teacher_profile_id: teacherActor.id,
      term_id: term.id,
      active: true,
    })).id;
    const room = await insertOne(director, 'rooms', {
      institution_id: institutionId,
      name: `Sala ${suffix}`,
      capacity: 30,
      active: true,
    });
    await insertOne(director, 'timetable_entries', {
      institution_id: institutionId,
      subject_offering_id: offeringId,
      room_id: room.id,
      day_of_week: 1,
      start_time: '07:00',
      end_time: '07:50',
      academic_year_id: academicYear.id,
      term_id: term.id,
      active: true,
    });
    studentId = (await insertOne(service, 'students', {
      institution_id: institutionId,
      profile_id: studentActor.id,
      registration_number: `DIARY-${suffix}`,
      birth_date: '2010-01-01',
      active: true,
    })).id;
    await insertOne(director, 'enrollments', {
      student_id: studentId,
      class_id: schoolClass.id,
      academic_year_id: academicYear.id,
      enrolled_at: '2026-09-01',
      status: 'ACTIVE',
      active: true,
    });
  }, 120_000);

  it('salva campos do diário, finaliza a sessão e bloqueia alterações após CLOSED', async () => {
    const base = {
      p_institution_id: institutionId,
      p_subject_offering_id: offeringId,
      p_session_date: '2026-09-14',
      p_starts_at: '07:00',
      p_ends_at: '07:50',
      p_topic: 'Equações do segundo grau',
      p_class_activity: 'Exercícios 1 a 10',
      p_homework: 'Lista de revisão',
      p_notes: 'Retomar Bhaskara na próxima aula.',
      p_records: [{ student_id: studentId, status: 'PRESENT', notes: 'Chegou cedo.' }],
    };
    const draft = await teacher.rpc('save_attendance_class_diary', {
      ...base,
      p_status: 'DRAFT',
    });
    expect(draft.error).toBeNull();
    sessionId = required(draft.data?.id, 'draft session');
    expect(draft.data).toMatchObject({
      status: 'DRAFT',
      topic: base.p_topic,
      class_activity: base.p_class_activity,
      homework: base.p_homework,
      notes: base.p_notes,
      closed_at: null,
    });

    const finalized = await teacher.rpc('save_attendance_class_diary', {
      ...base,
      p_status: 'CLOSED',
    });
    expect(finalized.error).toBeNull();
    expect(finalized.data).toMatchObject({
      id: sessionId,
      status: 'CLOSED',
      topic: base.p_topic,
      class_activity: base.p_class_activity,
      homework: base.p_homework,
      notes: base.p_notes,
    });
    expect(finalized.data?.closed_at).toBeTruthy();

    const record = await teacher
      .from('attendance_records')
      .select('id, status')
      .eq('attendance_session_id', sessionId)
      .single();
    expect(record.error).toBeNull();
    recordId = required(record.data?.id, 'attendance record');

    const sessionUpdate = await teacher
      .from('attendance_sessions')
      .update({ topic: 'Alteração indevida' })
      .eq('id', sessionId)
      .select('id')
      .single();
    expect(sessionUpdate.data).toBeNull();
    expect(sessionUpdate.error).toBeTruthy();

    const recordUpdate = await teacher
      .from('attendance_records')
      .update({ status: 'ABSENT' })
      .eq('id', recordId)
      .select('id')
      .single();
    expect(recordUpdate.data).toBeNull();
    expect(recordUpdate.error).toBeTruthy();
  });

  it('não permite finalizar novamente uma sessão CLOSED pelo RPC', async () => {
    const result = await teacher.rpc('save_attendance_class_diary', {
      p_institution_id: institutionId,
      p_subject_offering_id: offeringId,
      p_session_date: '2026-09-14',
      p_starts_at: '07:00',
      p_ends_at: '07:50',
      p_topic: 'Outra tentativa',
      p_class_activity: null,
      p_homework: null,
      p_notes: null,
      p_status: 'CLOSED',
      p_records: [{ student_id: studentId, status: 'PRESENT', notes: null }],
    });
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('42501');
    expect(result.error?.message).toContain('ATTENDANCE_SESSION_CLOSED');
  });
});
