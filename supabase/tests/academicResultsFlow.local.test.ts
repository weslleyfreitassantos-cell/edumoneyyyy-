import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type AnyClient = SupabaseClient<any, any, any>;
type Role = 'ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'STUDENT' | 'GUARDIAN';
type Actor = { id: string; email: string; client: AnyClient; role: Role };

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

async function createActor(
  service: AnyClient,
  role: Role,
  label: string,
  suffix: string,
): Promise<Actor> {
  const email = `academic-results-${suffix}-${label}@local.test`;
  const password = 'AcademicResults!2026';
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`auth ${label}: ${error.message}`);

  const user = required(data.user, `auth ${label}`);
  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: `Academic results ${label}`,
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
  return { id: user.id, email, client, role };
}

async function readRows(
  client: AnyClient,
  table: string,
  select: string,
  filters: ReadonlyArray<readonly [string, string, unknown]> = [],
): Promise<{ rows: any[]; error: any }> {
  let query = client.from(table).select(select);
  for (const [operator, column, value] of filters) {
    query = operator === 'in'
      ? query.in(column, value as string[])
      : query.eq(column, value);
  }
  const { data, error } = await query;
  return { rows: data ?? [], error };
}

async function expectRpcError(
  client: AnyClient,
  name: string,
  args: Record<string, unknown>,
  code: string,
): Promise<void> {
  const { data, error } = await client.rpc(name, args);
  expect(data, `${name} data`).toBeNull();
  expect(error?.code, `${name} code`).toBe(code);
}

async function expectMutationError(
  request: PromiseLike<{ data: unknown; error: any }>,
  code: string,
): Promise<void> {
  const { data, error } = await request;
  expect(data ?? []).toEqual([]);
  expect(error?.code).toBe(code);
}

type Fixture = {
  service: AnyClient;
  actors: Record<string, Actor>;
  institutionA: string;
  institutionB: string;
  yearA: string;
  termA: string;
  classA: string;
  classB: string;
  offeringA: string;
  offeringB: string;
  studentA: string;
  studentB: string;
  assessmentPublished: string;
  assessmentExcused: string;
  assessmentCanceled: string;
  gradePublished: string;
  attendanceSession: string;
  resultId: string;
};

async function createFixture(): Promise<Fixture> {
  const service = createClient(localUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const actors: Record<string, Actor> = {};

  for (const [role, label] of [
    ['ADMIN', 'admin-a'],
    ['DIRECTOR', 'director-a'],
    ['DIRECTOR', 'director-b'],
    ['SECRETARY', 'secretary-a'],
    ['TEACHER', 'teacher-a'],
    ['STUDENT', 'student-a'],
    ['GUARDIAN', 'guardian-a'],
    ['GUARDIAN', 'guardian-unlinked-a'],
    ['TEACHER', 'teacher-b'],
    ['STUDENT', 'student-b'],
    ['GUARDIAN', 'guardian-b'],
  ] as Array<[Role, string]>) {
    actors[label] = await createActor(service, role, label, suffix);
  }

  const accountA = (await insertOne(service, 'accounts', {
    name: `Academic results A ${suffix}`,
    owner_profile_id: actors['admin-a'].id,
    institution_limit: 1,
    status: 'ACTIVE',
  })).id;
  const accountB = (await insertOne(service, 'accounts', {
    name: `Academic results B ${suffix}`,
    owner_profile_id: actors['teacher-b'].id,
    institution_limit: 1,
    status: 'ACTIVE',
  })).id;
  const institutionA = (await insertOne(service, 'institutions', {
    account_id: accountA,
    name: `Results institution A ${suffix}`,
    active: true,
  })).id;
  const institutionB = (await insertOne(service, 'institutions', {
    account_id: accountB,
    name: `Results institution B ${suffix}`,
    active: true,
  })).id;

  const memberships: Array<[string, string, Role]> = [
    ['admin-a', institutionA, 'ADMIN'],
    ['director-a', institutionA, 'DIRECTOR'],
    ['director-b', institutionB, 'DIRECTOR'],
    ['secretary-a', institutionA, 'SECRETARY'],
    ['teacher-a', institutionA, 'TEACHER'],
    ['student-a', institutionA, 'STUDENT'],
    ['guardian-a', institutionA, 'GUARDIAN'],
    ['guardian-unlinked-a', institutionA, 'GUARDIAN'],
    ['teacher-b', institutionB, 'TEACHER'],
    ['student-b', institutionB, 'STUDENT'],
    ['guardian-b', institutionB, 'GUARDIAN'],
  ];
  for (const [label, institutionId, role] of memberships) {
    await insertOne(service, 'memberships', {
      profile_id: actors[label].id,
      institution_id: institutionId,
      role,
      active: true,
    });
  }

  const directorA = actors['director-a'].client;
  const directorB = actors['director-b'].client;

  const yearA = (await insertOne(directorA, 'academic_years', {
    institution_id: institutionA,
    name: `Ano letivo ${suffix}`,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    active: true,
  })).id;
  const yearB = (await insertOne(directorB, 'academic_years', {
    institution_id: institutionB,
    name: `Ano letivo B ${suffix}`,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    active: true,
  })).id;
  const termA = (await insertOne(directorA, 'terms', {
    academic_year_id: yearA,
    name: `1o bimestre ${suffix}`,
    start_date: '2026-01-01',
    end_date: '2026-06-30',
    active: true,
  })).id;
  const termB = (await insertOne(directorB, 'terms', {
    academic_year_id: yearB,
    name: `1o bimestre B ${suffix}`,
    start_date: '2026-01-01',
    end_date: '2026-06-30',
    active: true,
  })).id;
  const classA = (await insertOne(directorA, 'classes', {
    institution_id: institutionA,
    academic_year_id: yearA,
    name: `Turma A ${suffix}`,
    grade_level: '1o EM',
    shift: 'MATUTINO',
    capacity: 30,
    active: true,
  })).id;
  const classB = (await insertOne(directorB, 'classes', {
    institution_id: institutionB,
    academic_year_id: yearB,
    name: `Turma B ${suffix}`,
    grade_level: '1o EM',
    shift: 'MATUTINO',
    capacity: 30,
    active: true,
  })).id;
  const subjectA = (await insertOne(directorA, 'subjects', {
    institution_id: institutionA,
    name: `Matematica ${suffix}`,
    code: `MAT-${suffix}`,
    workload: 100,
    active: true,
  })).id;
  const subjectB = (await insertOne(directorB, 'subjects', {
    institution_id: institutionB,
    name: `Ciencias ${suffix}`,
    code: `CIE-${suffix}`,
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
    teacher_profile_id: actors['teacher-a'].id,
    subject_id: subjectA,
    primary_subject: true,
    active: true,
  });
  await insertOne(directorB, 'teacher_subjects', {
    institution_id: institutionB,
    teacher_profile_id: actors['teacher-b'].id,
    subject_id: subjectB,
    primary_subject: true,
    active: true,
  });
  const offeringA = (await insertOne(directorA, 'subject_offerings', {
    subject_id: subjectA,
    class_id: classA,
    teacher_profile_id: actors['teacher-a'].id,
    term_id: termA,
    active: true,
  })).id;
  const offeringB = (await insertOne(directorB, 'subject_offerings', {
    subject_id: subjectB,
    class_id: classB,
    teacher_profile_id: actors['teacher-b'].id,
    term_id: termB,
    active: true,
  })).id;

  const studentA = (await insertOne(service, 'students', {
    profile_id: actors['student-a'].id,
    institution_id: institutionA,
    registration_number: `RESULT-A-${suffix}`,
    birth_date: '2010-01-01',
    active: true,
  })).id;
  const studentB = (await insertOne(service, 'students', {
    profile_id: actors['student-b'].id,
    institution_id: institutionB,
    registration_number: `RESULT-B-${suffix}`,
    birth_date: '2010-01-01',
    active: true,
  })).id;
  await insertOne(service, 'guardianships', {
    student_id: studentA,
    guardian_profile_id: actors['guardian-a'].id,
    relationship: 'PARENT',
    is_primary: true,
    active: true,
  });
  await insertOne(service, 'guardianships', {
    student_id: studentB,
    guardian_profile_id: actors['guardian-b'].id,
    relationship: 'PARENT',
    is_primary: true,
    active: true,
  });
  await insertOne(directorA, 'enrollments', {
    student_id: studentA,
    class_id: classA,
    academic_year_id: yearA,
    enrolled_at: '2026-01-01',
    status: 'ACTIVE',
    active: true,
  });
  await insertOne(directorB, 'enrollments', {
    student_id: studentB,
    class_id: classB,
    academic_year_id: yearB,
    enrolled_at: '2026-01-01',
    status: 'ACTIVE',
    active: true,
  });

  await insertOne(directorA, 'academic_policies', {
    institution_id: institutionA,
    academic_year_id: yearA,
    minimum_grade_percentage: 60,
    minimum_attendance_percentage: 75,
    decimal_places: 1,
    active: true,
  });
  const roomA = (await insertOne(directorA, 'rooms', {
    institution_id: institutionA,
    name: `Sala A ${suffix}`,
    capacity: 30,
    active: true,
  })).id;
  await insertOne(directorA, 'timetable_entries', {
    institution_id: institutionA,
    subject_offering_id: offeringA,
    room_id: roomA,
    day_of_week: 1,
    start_time: '08:00',
    end_time: '08:50',
    academic_year_id: yearA,
    term_id: termA,
    active: true,
  });

  const assessmentPublished = (await insertOne(directorA, 'assessments', {
    institution_id: institutionA,
    subject_offering_id: offeringA,
    term_id: termA,
    title: `Prova publicada ${suffix}`,
    assessment_type: 'EXAM',
    assessment_date: '2026-05-01',
    max_score: 10,
    weight: 1,
    status: 'PUBLISHED',
    created_by: actors['teacher-a'].id,
  })).id;
  const assessmentExcused = (await insertOne(directorA, 'assessments', {
    institution_id: institutionA,
    subject_offering_id: offeringA,
    term_id: termA,
    title: `Atividade abonada ${suffix}`,
    assessment_type: 'ASSIGNMENT',
    assessment_date: '2026-05-15',
    max_score: 10,
    weight: 1,
    status: 'PUBLISHED',
    created_by: actors['teacher-a'].id,
  })).id;
  const assessmentCanceled = (await insertOne(directorA, 'assessments', {
    institution_id: institutionA,
    subject_offering_id: offeringA,
    term_id: termA,
    title: `Atividade cancelada ${suffix}`,
    assessment_type: 'ASSIGNMENT',
    assessment_date: '2026-05-20',
    max_score: 10,
    weight: 1,
    status: 'CANCELED',
    created_by: actors['teacher-a'].id,
  })).id;
  await insertOne(directorB, 'assessments', {
    institution_id: institutionB,
    subject_offering_id: offeringB,
    term_id: termB,
    title: `Prova estrangeira ${suffix}`,
    assessment_type: 'EXAM',
    assessment_date: '2026-05-01',
    max_score: 10,
    weight: 1,
    status: 'PUBLISHED',
    created_by: actors['teacher-b'].id,
  });
  const attendanceSession = (await insertOne(directorA, 'attendance_sessions', {
    institution_id: institutionA,
    subject_offering_id: offeringA,
    session_date: '2026-05-04',
    starts_at: '08:00',
    ends_at: '08:50',
    status: 'CLOSED',
    created_by: actors['teacher-a'].id,
  })).id;
  await insertOne(service, 'attendance_records', {
    institution_id: institutionA,
    attendance_session_id: attendanceSession,
    student_id: studentA,
    status: 'PRESENT',
    recorded_by: actors['teacher-a'].id,
  });

  return {
    service,
    actors,
    institutionA,
    institutionB,
    yearA,
    termA,
    classA,
    classB,
    offeringA,
    offeringB,
    studentA,
    studentB,
    assessmentPublished,
    assessmentExcused,
    assessmentCanceled,
    gradePublished: '',
    attendanceSession,
    resultId: '',
  };
}

const assessmentSelect = `
  id,
  title,
  status,
  subject_offerings:subject_offering_id (
    id,
    classes:class_id (id, name),
    subjects:subject_id (id, name),
    terms:term_id (
      id,
      name,
      academic_year_id,
      academic_years:academic_year_id (id, name)
    )
  ),
  grades (id, student_id, score, status)
`;

localDescribe('academic results runtime flow', () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  }, 120_000);

  it('scopes assessments by role and preserves the open assessment without a grade', async () => {
    const own = await readRows(fixture.actors['director-a'].client, 'assessments', assessmentSelect, [
      ['eq', 'institution_id', fixture.institutionA],
    ]);
    expect(own.error).toBeNull();
    expect(own.rows.map((row) => row.id)).toEqual(expect.arrayContaining([
      fixture.assessmentPublished,
      fixture.assessmentExcused,
      fixture.assessmentCanceled,
    ]));

    for (const label of ['secretary-a', 'teacher-a'] as const) {
      const result = await readRows(fixture.actors[label].client, 'assessments', assessmentSelect, [
        ['eq', 'institution_id', fixture.institutionA],
        ['in', 'status', ['PUBLISHED', 'CLOSED']],
      ]);
      expect(result.error, label).toBeNull();
      expect(result.rows).toHaveLength(2);
    }

    for (const label of ['student-a', 'guardian-a'] as const) {
      const result = await readRows(fixture.actors[label].client, 'assessments', assessmentSelect, [
        ['eq', 'id', fixture.assessmentPublished],
      ]);
      expect(result.error, label).toBeNull();
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].subject_offerings.terms.academic_years.name).toContain('Ano letivo');
    }

    for (const label of ['admin-a', 'teacher-b', 'student-b', 'guardian-b'] as const) {
      const result = await readRows(fixture.actors[label].client, 'assessments', assessmentSelect, [
        ['eq', 'id', fixture.assessmentPublished],
      ]);
      expect(result.error, label).toBeNull();
      expect(result.rows).toHaveLength(0);
    }

    const unlinked = await readRows(
      fixture.actors['guardian-unlinked-a'].client,
      'assessments',
      assessmentSelect,
      [['eq', 'id', fixture.assessmentPublished]],
    );
    expect(unlinked.error).toBeNull();
    expect(unlinked.rows).toHaveLength(0);
  }, 60_000);

  it('blocks pending closure, records graded and excused states, and closes idempotently', async () => {
    const args = {
      p_institution_id: fixture.institutionA,
      p_academic_year_id: fixture.yearA,
      p_term_id: fixture.termA,
      p_subject_offering_id: fixture.offeringA,
    };
    await expectRpcError(fixture.actors['director-a'].client, 'submit_term_closure', args, '23514');

    const grade = await fixture.actors['teacher-a'].client
      .from('grades')
      .insert({
        institution_id: fixture.institutionA,
        assessment_id: fixture.assessmentPublished,
        student_id: fixture.studentA,
        score: 9,
        status: 'GRADED',
        recorded_by: fixture.actors['teacher-a'].id,
      })
      .select('id')
      .single();
    expect(grade.error).toBeNull();
    fixture.gradePublished = required(grade.data?.id, 'published grade');

    await expectRpcError(fixture.actors['director-a'].client, 'submit_term_closure', args, '23514');

    const excused = await fixture.actors['teacher-a'].client
      .from('grades')
      .insert({
        institution_id: fixture.institutionA,
        assessment_id: fixture.assessmentExcused,
        student_id: fixture.studentA,
        score: null,
        status: 'EXCUSED',
        recorded_by: fixture.actors['teacher-a'].id,
      })
      .select('id')
      .single();
    expect(excused.error).toBeNull();

    const teacherSubmit = await fixture.actors['teacher-a'].client.rpc('submit_term_closure', args);
    expect(teacherSubmit.error).toBeNull();
    expect(teacherSubmit.data.status).toBe('SUBMITTED');

    const directorSubmit = await fixture.actors['director-a'].client.rpc('submit_term_closure', args);
    expect(directorSubmit.error).toBeNull();
    expect(directorSubmit.data.status).toBe('SUBMITTED');

    const firstClose = await fixture.actors['director-a'].client.rpc('close_term_closure', args);
    expect(firstClose.error).toBeNull();
    expect(firstClose.data.status).toBe('CLOSED');

    const result = await fixture.actors['student-a'].client
      .from('student_term_results')
      .select('id, grade_percentage, attendance_percentage, result_status, finalized_at')
      .eq('student_id', fixture.studentA)
      .eq('subject_offering_id', fixture.offeringA)
      .eq('term_id', fixture.termA)
      .single();
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      grade_percentage: 90,
      attendance_percentage: 100,
      result_status: 'APPROVED',
    });
    fixture.resultId = required(result.data?.id, 'student term result');

    const secondClose = await fixture.actors['director-a'].client.rpc('close_term_closure', args);
    expect(secondClose.error).toBeNull();
    expect(secondClose.data.id).toBe(firstClose.data.id);
  }, 60_000);

  it('freezes closed data, requires a reason to reopen, and re-closes the same result', async () => {
    const updateGrade = fixture.actors['teacher-a'].client
      .from('grades')
      .update({ score: 8 })
      .eq('id', fixture.gradePublished)
      .select('id');
    await expectMutationError(updateGrade, '23514');

    const updateAssessment = fixture.actors['teacher-a'].client
      .from('assessments')
      .update({ title: 'Alteracao bloqueada' })
      .eq('id', fixture.assessmentPublished)
      .select('id');
    await expectMutationError(updateAssessment, '23514');

    const updateResult = fixture.service
      .from('student_term_results')
      .update({ grade_percentage: 1 })
      .eq('id', fixture.resultId)
      .select('id');
    await expectMutationError(updateResult, '23514');

    const args = {
      p_institution_id: fixture.institutionA,
      p_academic_year_id: fixture.yearA,
      p_term_id: fixture.termA,
      p_subject_offering_id: fixture.offeringA,
    };
    await expectRpcError(fixture.actors['director-a'].client, 'reopen_term_closure', {
      p_institution_id: fixture.institutionA,
      p_term_closure_id: (await fixture.service
        .from('term_closures')
        .select('id')
        .eq('id', (await fixture.actors['director-a'].client.rpc('close_term_closure', args)).data.id)
        .single()).data.id,
      p_reopen_reason: '   ',
    }, '23514');

    const closure = await fixture.service
      .from('term_closures')
      .select('id')
      .eq('subject_offering_id', fixture.offeringA)
      .eq('term_id', fixture.termA)
      .single();
    expect(closure.error).toBeNull();
    const closureId = required(closure.data?.id, 'term closure');

    await expectRpcError(fixture.actors['admin-a'].client, 'reopen_term_closure', {
      p_institution_id: fixture.institutionA,
      p_term_closure_id: closureId,
      p_reopen_reason: 'admin sem permissao academica',
    }, '42501');
    await expectRpcError(fixture.actors['teacher-a'].client, 'reopen_term_closure', {
      p_institution_id: fixture.institutionA,
      p_term_closure_id: closureId,
      p_reopen_reason: 'professor sem permissao de reabertura',
    }, '42501');

    const reopened = await fixture.actors['director-a'].client.rpc('reopen_term_closure', {
      p_institution_id: fixture.institutionA,
      p_term_closure_id: closureId,
      p_reopen_reason: 'Revisao da nota pelo diretor',
    });
    expect(reopened.error).toBeNull();
    expect(reopened.data.status).toBe('REOPENED');

    const afterReopenGrade = await fixture.actors['teacher-a'].client
      .from('grades')
      .update({ score: 8 })
      .eq('id', fixture.gradePublished)
      .select('id, score')
      .single();
    expect(afterReopenGrade.error).toBeNull();
    expect(afterReopenGrade.data.score).toBe(8);

    const beforeReclose = await fixture.actors['student-a'].client
      .from('student_term_results')
      .select('id, grade_percentage')
      .eq('id', fixture.resultId)
      .single();
    expect(beforeReclose.error).toBeNull();
    expect(beforeReclose.data.grade_percentage).toBe(90);

    const reclosed = await fixture.actors['director-a'].client.rpc('close_term_closure', args);
    expect(reclosed.error).toBeNull();
    expect(reclosed.data.id).toBe(closureId);

    const afterReclose = await fixture.actors['student-a'].client
      .from('student_term_results')
      .select('id, grade_percentage, attendance_percentage, result_status')
      .eq('id', fixture.resultId)
      .single();
    expect(afterReclose.error).toBeNull();
    expect(afterReclose.data).toMatchObject({
      id: fixture.resultId,
      grade_percentage: 80,
      attendance_percentage: 100,
      result_status: 'APPROVED',
    });
  }, 60_000);

  it('serves the official result only to allowed audiences and revokes the same JWT', async () => {
    const resultSelect = 'id, student_id, subject_offering_id, term_id, grade_percentage, attendance_percentage, result_status';
    for (const label of ['director-a', 'teacher-a', 'student-a', 'guardian-a'] as const) {
      const result = await readRows(fixture.actors[label].client, 'student_term_results', resultSelect, [
        ['eq', 'id', fixture.resultId],
      ]);
      expect(result.error, label).toBeNull();
      expect(result.rows).toHaveLength(1);
    }
    for (const label of ['admin-a', 'teacher-b', 'student-b', 'guardian-b'] as const) {
      const result = await readRows(fixture.actors[label].client, 'student_term_results', resultSelect, [
        ['eq', 'id', fixture.resultId],
      ]);
      expect(result.error, label).toBeNull();
      expect(result.rows).toHaveLength(0);
    }

    const activeAccess: Array<[string, string]> = [
      ['admin-a', 'academic_years'],
      ['director-a', 'academic_years'],
      ['secretary-a', 'academic_years'],
      ['teacher-a', 'assessments'],
      ['student-a', 'assessments'],
      ['guardian-a', 'assessments'],
    ];
    for (const [label, table] of activeAccess) {
      const actor = fixture.actors[label];
      const before = await readRows(actor.client, table, 'id', [
        ['eq', 'institution_id', fixture.institutionA],
      ]);
      const expectedBefore = actor.role === 'ADMIN' ? 0 : 1;
      expect(before.error, `${label} before`).toBeNull();
      expect(before.rows.length).toBeGreaterThanOrEqual(expectedBefore);

      await fixture.service.from('profiles').update({ active: false }).eq('id', actor.id);
      const after = await readRows(actor.client, table, 'id', [
        ['eq', 'institution_id', fixture.institutionA],
      ]);
      expect(after.error, `${label} after`).toBeNull();
      expect(after.rows, `${label} active=false`).toHaveLength(0);
      await fixture.service.from('profiles').update({ active: true }).eq('id', actor.id);
    }
  }, 60_000);

  it('revokes student academic reads when membership becomes inactive on the same JWT', async () => {
    const student = fixture.actors['student-a'].client;
    const beforeAssessment = await readRows(student, 'assessments', 'id', [
      ['eq', 'id', fixture.assessmentPublished],
    ]);
    const beforeGrade = await readRows(student, 'grades', 'id', [
      ['eq', 'id', fixture.gradePublished],
    ]);
    const beforeResult = await readRows(student, 'student_term_results', 'id', [
      ['eq', 'id', fixture.resultId],
    ]);
    expect(beforeAssessment.error).toBeNull();
    expect(beforeGrade.error).toBeNull();
    expect(beforeResult.error).toBeNull();
    expect(beforeAssessment.rows).toHaveLength(1);
    expect(beforeGrade.rows).toHaveLength(1);
    expect(beforeResult.rows).toHaveLength(1);

    await fixture.service
      .from('memberships')
      .update({ active: false })
      .eq('profile_id', fixture.actors['student-a'].id)
      .eq('institution_id', fixture.institutionA);

    const state = await fixture.service
      .from('profiles')
      .select('active')
      .eq('id', fixture.actors['student-a'].id)
      .single();
    expect(state.error).toBeNull();
    expect(state.data.active).toBe(true);

    for (const [table, id] of [
      ['assessments', fixture.assessmentPublished],
      ['grades', fixture.gradePublished],
      ['student_term_results', fixture.resultId],
    ] as const) {
      const after = await readRows(student, table, 'id', [['eq', 'id', id]]);
      expect(after.error, table).toBeNull();
      expect(after.rows, `${table} with inactive membership`).toHaveLength(0);
    }

    await fixture.service
      .from('memberships')
      .update({ active: true })
      .eq('profile_id', fixture.actors['student-a'].id)
      .eq('institution_id', fixture.institutionA);

    for (const [table, id] of [
      ['assessments', fixture.assessmentPublished],
      ['grades', fixture.gradePublished],
      ['student_term_results', fixture.resultId],
    ] as const) {
      const afterReactivation = await readRows(student, table, 'id', [['eq', 'id', id]]);
      expect(afterReactivation.error, `${table} reactivation`).toBeNull();
      expect(afterReactivation.rows, `${table} after reactivation`).toHaveLength(1);
    }
  }, 60_000);

  it('revokes guardian academic reads when membership becomes inactive on the same JWT', async () => {
    const guardian = fixture.actors['guardian-a'].client;
    const beforeAssessment = await readRows(guardian, 'assessments', 'id', [
      ['eq', 'id', fixture.assessmentPublished],
    ]);
    const beforeGrade = await readRows(guardian, 'grades', 'id', [
      ['eq', 'id', fixture.gradePublished],
    ]);
    const beforeResult = await readRows(guardian, 'student_term_results', 'id', [
      ['eq', 'id', fixture.resultId],
    ]);
    const beforeAttendance = await readRows(guardian, 'attendance_records', 'id', [
      ['eq', 'attendance_session_id', fixture.attendanceSession],
      ['eq', 'student_id', fixture.studentA],
    ]);
    expect(beforeAssessment.error).toBeNull();
    expect(beforeGrade.error).toBeNull();
    expect(beforeResult.error).toBeNull();
    expect(beforeAttendance.error).toBeNull();
    expect(beforeAssessment.rows).toHaveLength(1);
    expect(beforeGrade.rows).toHaveLength(1);
    expect(beforeResult.rows).toHaveLength(1);
    expect(beforeAttendance.rows).toHaveLength(1);

    await fixture.service
      .from('memberships')
      .update({ active: false })
      .eq('profile_id', fixture.actors['guardian-a'].id)
      .eq('institution_id', fixture.institutionA);

    const state = await fixture.service
      .from('profiles')
      .select('active')
      .eq('id', fixture.actors['guardian-a'].id)
      .single();
    const guardianship = await fixture.service
      .from('guardianships')
      .select('active')
      .eq('guardian_profile_id', fixture.actors['guardian-a'].id)
      .eq('student_id', fixture.studentA)
      .single();
    expect(state.error).toBeNull();
    expect(state.data.active).toBe(true);
    expect(guardianship.error).toBeNull();
    expect(guardianship.data.active).toBe(true);

    for (const [table, filters] of [
      ['assessments', [['eq', 'id', fixture.assessmentPublished]]],
      ['grades', [['eq', 'id', fixture.gradePublished]]],
      ['student_term_results', [['eq', 'id', fixture.resultId]]],
      ['attendance_records', [
        ['eq', 'attendance_session_id', fixture.attendanceSession],
        ['eq', 'student_id', fixture.studentA],
      ]],
    ] as const) {
      const after = await readRows(guardian, table, 'id', filters);
      expect(after.error, table).toBeNull();
      expect(after.rows, `${table} with inactive membership`).toHaveLength(0);
    }

    await fixture.service
      .from('memberships')
      .update({ active: true })
      .eq('profile_id', fixture.actors['guardian-a'].id)
      .eq('institution_id', fixture.institutionA);

    for (const [table, filters] of [
      ['assessments', [['eq', 'id', fixture.assessmentPublished]]],
      ['grades', [['eq', 'id', fixture.gradePublished]]],
      ['student_term_results', [['eq', 'id', fixture.resultId]]],
      ['attendance_records', [
        ['eq', 'attendance_session_id', fixture.attendanceSession],
        ['eq', 'student_id', fixture.studentA],
      ]],
    ] as const) {
      const afterReactivation = await readRows(guardian, table, 'id', filters);
      expect(afterReactivation.error, `${table} reactivation`).toBeNull();
      expect(afterReactivation.rows, `${table} after reactivation`).toHaveLength(1);
    }
  }, 60_000);

  it('keeps same-tenant guardianship isolation', async () => {
    for (const [table, select, filters] of [
      ['assessments', 'id', [['eq', 'id', fixture.assessmentPublished]]],
      ['grades', 'id', [['eq', 'id', fixture.gradePublished]]],
      ['student_term_results', 'id', [['eq', 'id', fixture.resultId]]],
    ] as const) {
      const result = await readRows(
        fixture.actors['guardian-unlinked-a'].client,
        table,
        select,
        filters,
      );
      expect(result.error, table).toBeNull();
      expect(result.rows, `${table} for unlinked guardian`).toHaveLength(0);
    }
  }, 60_000);
});
