import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type AnyClient = SupabaseClient<any, any, any>;
type Role = 'ADMIN' | 'DIRECTOR' | 'TEACHER' | 'STUDENT';
type Actor = { id: string; client: AnyClient };

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
  return required(data, `${table} insert`);
}

async function createActor(
  service: AnyClient,
  role: Role,
  label: string,
  suffix: string,
): Promise<Actor> {
  const email = `director-panorama-${suffix}-${label}@local.test`;
  const password = 'DirectorPanorama!2026';
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw new Error(`auth ${label}: ${created.error.message}`);
  const user = required(created.data.user, `auth ${label}`);

  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: `Director Panorama ${label}`,
    email,
    role,
    active: true,
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

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function dayOfWeek(value: string): number {
  const day = new Date(`${value}T12:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

async function expectRpcDenied(
  client: AnyClient,
  institutionId: string,
  fromDate: string,
  toDate: string,
): Promise<void> {
  const result = await client.rpc('get_director_academic_panorama_v1', {
    p_institution_id: institutionId,
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  expect(result.data).toBeNull();
  expect(result.error?.code).toBe('42501');
}

localDescribe('Director Panorama runtime RPC', () => {
  let service: AnyClient;
  let directorA: Actor;
  let teacherA: Actor;
  let directorB: Actor;
  let institutionA: string;
  let institutionB: string;
  let yearA: string;
  let termA: string;
  let classA: string;
  let offeringA: string;
  let studentA: string;
  let studentB: string;
  let assessmentA: string;
  let assessmentB: string;
  let sessionA: string;
  let sessionB: string;
  let fromDate: string;
  let toDate: string;
  let attendanceDateA: string;
  let attendanceDateB: string;

  beforeAll(async () => {
    service = createClient(localUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const today = dateKey(new Date());
    toDate = today;
    attendanceDateA = shiftDate(today, -1);
    while (dayOfWeek(attendanceDateA) > 6) {
      attendanceDateA = shiftDate(attendanceDateA, -1);
    }
    attendanceDateB = shiftDate(attendanceDateA, -1);
    while (dayOfWeek(attendanceDateB) > 6) {
      attendanceDateB = shiftDate(attendanceDateB, -1);
    }
    fromDate = attendanceDateB;

    const adminA = await createActor(service, 'ADMIN', 'admin-a', suffix);
    directorA = await createActor(service, 'DIRECTOR', 'director-a', suffix);
    teacherA = await createActor(service, 'TEACHER', 'teacher-a', suffix);
    directorB = await createActor(service, 'DIRECTOR', 'director-b', suffix);

    const studentActorA = await createActor(service, 'STUDENT', 'student-a', suffix);
    const studentActorB = await createActor(service, 'STUDENT', 'student-b', suffix);

    institutionA = (await insertOne(service, 'institutions', {
      name: `Panorama institution A ${suffix}`,
      active: true,
    })).id;
    institutionB = (await insertOne(service, 'institutions', {
      name: `Panorama institution B ${suffix}`,
      active: true,
    })).id;

    for (const [profileId, institutionId, role] of [
      [adminA.id, institutionA, 'ADMIN'],
      [directorA.id, institutionA, 'DIRECTOR'],
      [teacherA.id, institutionA, 'TEACHER'],
      [directorB.id, institutionB, 'DIRECTOR'],
    ] as Array<[string, string, Role]>) {
      await insertOne(service, 'memberships', {
        profile_id: profileId,
        institution_id: institutionId,
        role,
        active: true,
      });
    }

    const year = new Date(`${today}T12:00:00.000Z`).getUTCFullYear();
    yearA = (await insertOne(service, 'academic_years', {
      institution_id: institutionA,
      name: `Ano ${suffix}`,
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
      active: true,
    })).id;
    termA = (await insertOne(service, 'terms', {
      academic_year_id: yearA,
      name: `Periodo ${suffix}`,
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
      active: true,
    })).id;
    classA = (await insertOne(service, 'classes', {
      institution_id: institutionA,
      academic_year_id: yearA,
      name: `Turma A ${suffix}`,
      grade_level: '1o EM',
      shift: 'MATUTINO',
      capacity: 30,
      active: true,
    })).id;
    const subjectA = (await insertOne(service, 'subjects', {
      institution_id: institutionA,
      name: `Matematica ${suffix}`,
      code: `MAT-${suffix}`,
      workload: 80,
      active: true,
    })).id;
    await insertOne(service, 'class_curriculum_items', {
      institution_id: institutionA,
      class_id: classA,
      subject_id: subjectA,
      weekly_lessons: 2,
      lesson_duration_minutes: 50,
      active: true,
    });
    offeringA = (await insertOne(service, 'subject_offerings', {
      subject_id: subjectA,
      class_id: classA,
      teacher_profile_id: teacherA.id,
      term_id: termA,
      active: true,
    })).id;

    studentA = (await insertOne(service, 'students', {
      profile_id: studentActorA.id,
      institution_id: institutionA,
      registration_number: `A-${suffix}`,
      active: true,
    })).id;
    studentB = (await insertOne(service, 'students', {
      profile_id: studentActorB.id,
      institution_id: institutionA,
      registration_number: `B-${suffix}`,
      active: true,
    })).id;
    for (const studentId of [studentA, studentB]) {
      await insertOne(service, 'enrollments', {
        student_id: studentId,
        class_id: classA,
        academic_year_id: yearA,
        status: 'ACTIVE',
        active: true,
        enrolled_at: `${year}-01-01T00:00:00Z`,
      });
    }

    await insertOne(directorA.client, 'timetable_entries', {
      institution_id: institutionA,
      subject_offering_id: offeringA,
      day_of_week: dayOfWeek(attendanceDateA),
      start_time: '07:00:00',
      end_time: '08:00:00',
      active: true,
    });
    await insertOne(directorA.client, 'timetable_entries', {
      institution_id: institutionA,
      subject_offering_id: offeringA,
      day_of_week: dayOfWeek(attendanceDateB),
      start_time: '07:00:00',
      end_time: '08:00:00',
      active: true,
    });

    const assessmentRows = await Promise.all([
      insertOne(service, 'assessments', {
        institution_id: institutionA,
        subject_offering_id: offeringA,
        term_id: termA,
        title: `Atividade 1 ${suffix}`,
        assessment_type: 'ASSIGNMENT',
        assessment_date: attendanceDateA,
        max_score: 10,
        weight: 1,
        status: 'PUBLISHED',
        created_by: directorA.id,
      }),
      insertOne(service, 'assessments', {
        institution_id: institutionA,
        subject_offering_id: offeringA,
        term_id: termA,
        title: `Atividade 2 ${suffix}`,
        assessment_type: 'ASSIGNMENT',
        assessment_date: attendanceDateB,
        max_score: 10,
        weight: 1,
        status: 'PUBLISHED',
        created_by: directorA.id,
      }),
    ]);
    assessmentA = assessmentRows[0].id;
    assessmentB = assessmentRows[1].id;

    await insertOne(service, 'grades', {
      institution_id: institutionA,
      assessment_id: assessmentA,
      student_id: studentA,
      score: 8,
      status: 'GRADED',
      recorded_by: directorA.id,
    });
    await insertOne(service, 'grades', {
      institution_id: institutionA,
      assessment_id: assessmentA,
      student_id: studentB,
      score: 6,
      status: 'GRADED',
      recorded_by: directorA.id,
    });
    await insertOne(service, 'grades', {
      institution_id: institutionA,
      assessment_id: assessmentB,
      student_id: studentA,
      score: 9,
      status: 'GRADED',
      recorded_by: directorA.id,
    });
    await insertOne(service, 'grades', {
      institution_id: institutionA,
      assessment_id: assessmentB,
      student_id: studentB,
      score: 7,
      status: 'GRADED',
      recorded_by: directorA.id,
    });

    sessionB = (await insertOne(service, 'attendance_sessions', {
      institution_id: institutionA,
      subject_offering_id: offeringA,
      session_date: attendanceDateB,
      starts_at: '07:00:00',
      ends_at: '08:00:00',
      status: 'CLOSED',
      created_by: teacherA.id,
    })).id;
    await insertOne(service, 'attendance_records', {
      institution_id: institutionA,
      attendance_session_id: sessionB,
      student_id: studentA,
      status: 'PRESENT',
      recorded_by: teacherA.id,
    });
    await insertOne(service, 'attendance_records', {
      institution_id: institutionA,
      attendance_session_id: sessionB,
      student_id: studentB,
      status: 'ABSENT',
      recorded_by: teacherA.id,
    });
  }, 120_000);

  it('calcula a RPC e as pendencias de chamada no banco', async () => {
    const beforeSession = await directorA.client.rpc('get_director_academic_panorama_v1', {
      p_institution_id: institutionA,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_term_id: termA,
    });
    expect(beforeSession.error).toBeNull();
    expect(beforeSession.data.pending.attendancePending).toBe(1);

    sessionA = (await insertOne(service, 'attendance_sessions', {
      institution_id: institutionA,
      subject_offering_id: offeringA,
      session_date: attendanceDateA,
      starts_at: '07:00:00',
      ends_at: '08:00:00',
      status: 'CLOSED',
      created_by: teacherA.id,
    })).id;
    await insertOne(service, 'attendance_records', {
      institution_id: institutionA,
      attendance_session_id: sessionA,
      student_id: studentA,
      status: 'PRESENT',
      recorded_by: teacherA.id,
    });
    await insertOne(service, 'attendance_records', {
      institution_id: institutionA,
      attendance_session_id: sessionA,
      student_id: studentB,
      status: 'LATE',
      recorded_by: teacherA.id,
    });

    const complete = await directorA.client.rpc('get_director_academic_panorama_v1', {
      p_institution_id: institutionA,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_term_id: termA,
    });
    expect(complete.error).toBeNull();
    expect(complete.data.attendance.summary).toMatchObject({
      totalRecords: 4,
      presentRecords: 3,
      absentRecords: 1,
      lateRecords: 1,
      attendanceRate: 75,
    });
    expect(complete.data.pending.attendancePending).toBe(0);
    expect(complete.data.pending.missingGrades).toBe(0);
    expect(complete.data.performance.summary.averagePercent).toBe(75);
    expect(complete.data.students.situations).toEqual(expect.arrayContaining([
      { situation: 'REGULAR', count: 1 },
      { situation: 'CRITICAL', count: 1 },
    ]));
    expect(complete.data.classes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classId: classA,
        adequate: 1,
        attention: 1,
        critical: 0,
        total: 2,
        withoutPerformance: 0,
      }),
    ]));

    const deleted = await service
      .from('grades')
      .delete()
      .eq('assessment_id', assessmentB)
      .eq('student_id', studentB);
    expect(deleted.error).toBeNull();

    const incomplete = await directorA.client.rpc('get_director_academic_panorama_v1', {
      p_institution_id: institutionA,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_term_id: termA,
    });
    expect(incomplete.error).toBeNull();
    expect(incomplete.data.pending.missingGrades).toBe(1);
    expect(incomplete.data.performance.activities.pendingGrades).toBe(1);
    expect(incomplete.data.performance.summary.averagePercent).toBe(80);
  });

  it('aplica escopo, autorizacao e validacao de intervalo', async () => {
    const filtered = await directorA.client.rpc('get_director_academic_panorama_v1', {
      p_institution_id: institutionA,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_class_id: classA,
      p_term_id: termA,
    });
    expect(filtered.error).toBeNull();
    expect(filtered.data.classes).toHaveLength(1);
    expect(filtered.data.classes[0].classId).toBe(classA);

    await expectRpcDenied(teacherA.client, institutionA, fromDate, toDate);
    await expectRpcDenied(createClient(localUrl!, anonKey!, { auth: { persistSession: false } }), institutionA, fromDate, toDate);
    await expectRpcDenied(directorB.client, institutionA, fromDate, toDate);

    const invalid = await directorA.client.rpc('get_director_academic_panorama_v1', {
      p_institution_id: institutionA,
      p_from_date: toDate,
      p_to_date: fromDate,
    });
    expect(invalid.data).toBeNull();
    expect(invalid.error?.code).toBe('22023');
  });
});
