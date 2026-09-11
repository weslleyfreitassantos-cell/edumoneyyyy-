import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type AnyClient = SupabaseClient<any, any, any>;

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

async function signIn(
  email: string,
  password: string,
): Promise<AnyClient> {
  const client = createClient(localUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`sign in ${email}: ${error?.message ?? 'no session'}`);
  }
  return client;
}

async function createActor(
  admin: AnyClient,
  role: 'ADMIN' | 'DIRECTOR' | 'TEACHER',
  label: string,
  suffix: string,
): Promise<{ id: string; email: string; client: AnyClient }> {
  const email = `attendance-${suffix}-${label.toLowerCase()}@local.test`;
  const password = 'AttendanceRuntime!2026';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`auth ${label}: ${error.message}`);

  const user = required(data.user, `auth ${label}`);
  await insertOne(admin, 'profiles', {
    id: user.id,
    full_name: `Attendance ${label}`,
    email,
    role,
    active: true,
  });

  return { id: user.id, email, client: await signIn(email, password) };
}

async function readWorkload(
  client: AnyClient,
  institutionId: string,
  offeringId: string,
  referenceDate = '2026-09-11',
): Promise<Record<string, any>> {
  const { data, error } = await client.rpc('get_subject_offering_workload_progress', {
    p_institution_id: institutionId,
    p_subject_offering_id: offeringId,
    p_reference_date: referenceDate,
  });
  if (error) throw new Error(`workload: ${error.message}`);
  return required(Array.isArray(data) ? data[0] : data, 'workload result');
}

async function insertSession(
  client: AnyClient,
  row: Record<string, unknown>,
): Promise<{ data: Record<string, any> | null; error: any }> {
  return client
    .from('attendance_sessions')
    .insert(row)
    .select('id, subject_offering_id, session_date, starts_at, ends_at, status')
    .single();
}

localDescribe('attendance calendar workload runtime', () => {
  let admin: AnyClient;
  let director: AnyClient;
  let teacher: AnyClient;
  let teacherB: AnyClient;
  let anonymous: AnyClient;
  let adminId = '';
  let directorId = '';
  let teacherId = '';
  let teacherBId = '';
  let institutionId = '';
  let academicYearId = '';
  let termId = '';
  let classId = '';
  let subjectA = '';
  let offeringA = '';
  let offeringB = '';
  let session07 = '';
  let session08 = '';
  let suffix = '';

  beforeAll(async () => {
    const service = createClient(localUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const adminActor = await createActor(service, 'ADMIN', 'admin', suffix);
    const directorActor = await createActor(service, 'DIRECTOR', 'director', suffix);
    const teacherActor = await createActor(service, 'TEACHER', 'teacher', suffix);
    const teacherBActor = await createActor(service, 'TEACHER', 'teacher-b', suffix);
    adminId = adminActor.id;
    directorId = directorActor.id;
    teacherId = teacherActor.id;
    teacherBId = teacherBActor.id;
    admin = adminActor.client;
    director = directorActor.client;
    teacher = teacherActor.client;
    teacherB = teacherBActor.client;
    anonymous = createClient(localUrl!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const account = await insertOne(service, 'accounts', {
      name: `Attendance runtime ${suffix}`,
      owner_profile_id: adminId,
      institution_limit: 1,
      status: 'ACTIVE',
    });
    institutionId = (await insertOne(service, 'institutions', {
      account_id: account.id,
      name: `Attendance institution ${suffix}`,
      active: true,
    })).id;

    await insertOne(service, 'memberships', {
      profile_id: adminId,
      institution_id: institutionId,
      role: 'ADMIN',
      active: true,
    });
    await insertOne(service, 'memberships', {
      profile_id: directorId,
      institution_id: institutionId,
      role: 'DIRECTOR',
      active: true,
    });
    await insertOne(service, 'memberships', {
      profile_id: teacherId,
      institution_id: institutionId,
      role: 'TEACHER',
      active: true,
    });
    await insertOne(service, 'memberships', {
      profile_id: teacherBId,
      institution_id: institutionId,
      role: 'TEACHER',
      active: true,
    });

    academicYearId = (await insertOne(director, 'academic_years', {
      institution_id: institutionId,
      name: `2026 ${suffix}`,
      start_date: '2026-09-07',
      end_date: '2026-09-11',
      active: true,
    })).id;
    termId = (await insertOne(director, 'terms', {
      academic_year_id: academicYearId,
      name: `1º período ${suffix}`,
      start_date: '2026-09-07',
      end_date: '2026-09-11',
      active: true,
    })).id;
    classId = (await insertOne(director, 'classes', {
      institution_id: institutionId,
      academic_year_id: academicYearId,
      name: `Turma ${suffix}`,
      grade_level: '1º EM',
      shift: 'MATUTINO',
      capacity: 30,
      active: true,
    })).id;

    subjectA = (await insertOne(director, 'subjects', {
      institution_id: institutionId,
      name: `Matemática ${suffix}`,
      code: `MAT-${suffix}`,
      workload: 100,
      active: true,
    })).id;
    const subjectB = (await insertOne(director, 'subjects', {
      institution_id: institutionId,
      name: `Ciências ${suffix}`,
      code: `CIE-${suffix}`,
      workload: 100,
      active: true,
    })).id;

    await insertOne(director, 'class_curriculum_items', {
      institution_id: institutionId,
      class_id: classId,
      subject_id: subjectA,
      weekly_lessons: 2,
      lesson_duration_minutes: 50,
      active: true,
    });
    await insertOne(director, 'class_curriculum_items', {
      institution_id: institutionId,
      class_id: classId,
      subject_id: subjectB,
      weekly_lessons: 1,
      lesson_duration_minutes: 50,
      active: true,
    });
    await insertOne(director, 'teacher_subjects', {
      institution_id: institutionId,
      teacher_profile_id: teacherId,
      subject_id: subjectA,
      primary_subject: true,
      active: true,
    });
    await insertOne(director, 'teacher_subjects', {
      institution_id: institutionId,
      teacher_profile_id: teacherBId,
      subject_id: subjectB,
      primary_subject: false,
      active: true,
    });

    offeringA = (await insertOne(director, 'subject_offerings', {
      subject_id: subjectA,
      class_id: classId,
      teacher_profile_id: teacherId,
      term_id: termId,
      active: true,
    })).id;
    offeringB = (await insertOne(director, 'subject_offerings', {
      subject_id: subjectB,
      class_id: classId,
      teacher_profile_id: teacherBId,
      term_id: termId,
      active: true,
    })).id;

    const room = (await insertOne(director, 'rooms', {
      institution_id: institutionId,
      name: `Sala ${suffix}`,
      capacity: 30,
      active: true,
    })).id;
    await insertOne(director, 'timetable_entries', {
      institution_id: institutionId,
      subject_offering_id: offeringA,
      room_id: room,
      day_of_week: 1,
      start_time: '07:00',
      end_time: '07:50',
      academic_year_id: academicYearId,
      term_id: termId,
      active: true,
    });
    await insertOne(director, 'timetable_entries', {
      institution_id: institutionId,
      subject_offering_id: offeringA,
      room_id: room,
      day_of_week: 1,
      start_time: '08:00',
      end_time: '08:50',
      academic_year_id: academicYearId,
      term_id: termId,
      active: true,
    });

    for (const dayOfWeek of [1, 2, 3, 4, 5] as const) {
      await insertOne(director, 'timetable_entries', {
        institution_id: institutionId,
        subject_offering_id: offeringB,
        room_id: room,
        day_of_week: dayOfWeek,
        start_time: '09:00',
        end_time: '09:50',
        academic_year_id: academicYearId,
        term_id: termId,
        active: true,
      });
    }
  });

  it('respeita os limites do período no cálculo da carga', async () => {
    const beforeTerm = await readWorkload(teacher, institutionId, offeringA, '2026-09-06');
    expect(beforeTerm.term_start_date).toBe('2026-09-07');
    expect(beforeTerm.term_end_date).toBe('2026-09-11');
    expect(Number(beforeTerm.planned_occurrences)).toBe(2);
    expect(Number(beforeTerm.planned_occurrences_to_date)).toBe(0);

    const afterTerm = await readWorkload(teacher, institutionId, offeringA, '2026-09-12');
    expect(Number(afterTerm.planned_occurrences)).toBe(2);
    expect(Number(afterTerm.planned_occurrences_to_date)).toBe(2);
  });

  it('permite UUID default e dois slots, mas rejeita a duplicata do mesmo slot', async () => {
    const first = await insertSession(teacher, {
      institution_id: institutionId,
      subject_offering_id: offeringA,
      session_date: '2026-09-07',
      starts_at: '07:00',
      ends_at: '07:50',
      status: 'DRAFT',
      created_by: teacherId,
    });
    expect(first.error).toBeNull();
    session07 = required(first.data?.id, '07:00 attendance session');

    const second = await insertSession(teacher, {
      institution_id: institutionId,
      subject_offering_id: offeringA,
      session_date: '2026-09-07',
      starts_at: '08:00',
      ends_at: '08:50',
      status: 'DRAFT',
      created_by: teacherId,
    });
    expect(second.error).toBeNull();
    session08 = required(second.data?.id, '08:00 attendance session');
    expect(session08).not.toBe(session07);

    const duplicate = await insertSession(teacher, {
      institution_id: institutionId,
      subject_offering_id: offeringA,
      session_date: '2026-09-07',
      starts_at: '07:00',
      ends_at: '07:50',
      status: 'DRAFT',
      created_by: teacherId,
    });
    expect(duplicate.data).toBeNull();
    expect(duplicate.error?.code).toBe('23505');
  });

  it('rejeita uma chamada sem intervalo correspondente na grade', async () => {
    const missingSchedule = await insertSession(teacher, {
      institution_id: institutionId,
      subject_offering_id: offeringA,
      session_date: '2026-09-07',
      starts_at: '09:30',
      ends_at: '10:20',
      status: 'DRAFT',
      created_by: teacherId,
    });
    expect(missingSchedule.data).toBeNull();
    expect(missingSchedule.error?.code).toBe('23514');
    expect(missingSchedule.error?.message).toContain('ATTENDANCE_SCHEDULE_NOT_FOUND');
  });

  it('consolida minutos entregues por slot fechado', async () => {
    const firstClosed = await teacher
      .from('attendance_sessions')
      .update({ status: 'CLOSED', closed_at: '2026-09-07T08:00:00Z' })
      .eq('id', session07)
      .select('id')
      .single();
    expect(firstClosed.error).toBeNull();

    const afterFirst = await readWorkload(teacher, institutionId, offeringA);
    expect(Number(afterFirst.planned_occurrences)).toBe(2);
    expect(Number(afterFirst.planned_minutes)).toBe(100);
    expect(Number(afterFirst.delivered_sessions)).toBe(1);
    expect(Number(afterFirst.delivered_minutes)).toBe(50);

    const secondClosed = await teacher
      .from('attendance_sessions')
      .update({ status: 'CLOSED', closed_at: '2026-09-07T09:00:00Z' })
      .eq('id', session08)
      .select('id')
      .single();
    expect(secondClosed.error).toBeNull();

    const afterSecond = await readWorkload(teacher, institutionId, offeringA);
    expect(Number(afterSecond.delivered_sessions)).toBe(2);
    expect(Number(afterSecond.delivered_minutes)).toBe(100);
  });

  it('bloqueia feriado, recesso e suspensão all-day, mas preserva exceções', async () => {
    const events = [
      ['HOLIDAY', 'Feriado', '2026-09-07T00:00:00Z', null, true, null],
      ['RECESS', 'Recesso', '2026-09-08T00:00:00Z', null, true, null],
      ['CLASS_SUSPENSION', 'Suspensão', '2026-09-09T00:00:00Z', null, true, null],
      ['SCHOOL_EVENT', 'Evento escolar', '2026-09-10T00:00:00Z', null, true, null],
      ['CLASS_SUSPENSION', 'Suspensão parcial', '2026-09-10T00:00:00Z', '2026-09-10T08:00:00Z', false, null],
      ['HOLIDAY', 'Feriado de outra disciplina', '2026-09-11T00:00:00Z', null, true, subjectA],
    ] as const;

    for (const [eventType, title, startsAt, endsAt, allDay, subjectId] of events) {
      const result = await insertOne(director, 'academic_calendar_events', {
        institution_id: institutionId,
        academic_year_id: academicYearId,
        title: `${title} ${suffix}`,
        event_type: eventType,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: allDay,
        audience: 'CLASS',
        class_id: classId,
        subject_id: subjectId,
        created_by: directorId,
      });
      expect(result.id).toBeTruthy();
    }

    for (const date of ['2026-09-07', '2026-09-08', '2026-09-09']) {
      const blocked = await insertSession(teacherB, {
        institution_id: institutionId,
        subject_offering_id: offeringB,
        session_date: date,
        starts_at: '09:00',
        ends_at: '09:50',
        status: 'DRAFT',
        created_by: teacherBId,
      });
      expect(blocked.data).toBeNull();
      expect(blocked.error?.code).toBe('23514');
      expect(blocked.error?.message).toContain('ATTENDANCE_CALENDAR_BLOCKED');
    }

    const timedSuspension = await insertSession(teacherB, {
      institution_id: institutionId,
      subject_offering_id: offeringB,
      session_date: '2026-09-10',
      starts_at: '09:00',
      ends_at: '09:50',
      status: 'DRAFT',
      created_by: teacherBId,
    });
    expect(timedSuspension.error).toBeNull();

    const differentContext = await insertSession(teacherB, {
      institution_id: institutionId,
      subject_offering_id: offeringB,
      session_date: '2026-09-11',
      starts_at: '09:00',
      ends_at: '09:50',
      status: 'DRAFT',
      created_by: teacherBId,
    });
    expect(differentContext.error).toBeNull();

    const afterBlocker = await readWorkload(teacher, institutionId, offeringA);
    expect(Number(afterBlocker.planned_occurrences)).toBe(0);
    expect(Number(afterBlocker.suspended_occurrences)).toBe(2);
    expect(Number(afterBlocker.planned_minutes)).toBe(0);
    expect(Number(afterBlocker.delivered_sessions)).toBe(2);
    expect(Number(afterBlocker.delivered_minutes)).toBe(100);
  });

  it('autoriza a carga apenas para o professor da atribuição e rejeita anônimo', async () => {
    const own = await readWorkload(teacher, institutionId, offeringA);
    expect(own.subject_offering_id).toBe(offeringA);

    const foreign = await teacher.rpc('get_subject_offering_workload_progress', {
      p_institution_id: institutionId,
      p_subject_offering_id: offeringB,
      p_reference_date: '2026-09-11',
    });
    expect(foreign.data).toBeNull();
    expect(foreign.error?.code).toBe('42501');

    const unauthenticated = await anonymous.rpc('get_subject_offering_workload_progress', {
      p_institution_id: institutionId,
      p_subject_offering_id: offeringA,
      p_reference_date: '2026-09-11',
    });
    expect(unauthenticated.data).toBeNull();
    expect(unauthenticated.error?.code).toBe('42501');
  });
});
