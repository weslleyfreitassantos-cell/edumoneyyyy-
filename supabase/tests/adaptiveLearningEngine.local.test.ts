import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type AnyClient = SupabaseClient<any, any, any>;

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const runtimeDescribe = localUrl && anonKey && serviceRoleKey ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(client: AnyClient, table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert result`);
}

async function createActor(
  service: AnyClient,
  institutionId: string,
  role: 'TEACHER' | 'STUDENT' | 'DIRECTOR',
  label: string,
  suffix: string,
) {
  const email = `adaptive-${suffix}-${label}@local.test`;
  const password = 'AdaptiveLearning!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${label}: ${error.message}`);
  const user = required(data.user, `auth ${label}`);

  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: `Adaptive ${label}`,
    email,
    role,
    active: true,
  });
  await insertOne(service, 'memberships', {
    profile_id: user.id,
    institution_id: institutionId,
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

  return { id: user.id, email, client };
}

runtimeDescribe('adaptive learning runtime database contract', () => {
  const suffix = `runtime-${Date.now()}`;
  let service: AnyClient;
  let institutionA: string;
  let institutionB: string;
  let classA: string;
  let classUnassigned: string;
  let classB: string;
  let studentA: string;
  let studentUnassigned: string;
  let studentB: string;
  let teacherA: { id: string; client: AnyClient };
  let teacherB: { id: string; client: AnyClient };
  let teacherForeign: { id: string; client: AnyClient };
  let directorA: { id: string; client: AnyClient };
  let studentClient: AnyClient;
  let activityId: string;
  let questionId: string;
  let termIds: string[] = [];
  let subjectIds: string[] = [];
  let mathCanonicalId: string;
  let linearCanonicalId: string;
  let portugueseCanonicalId: string;
  let cycleIds: string[] = [];
  const userIds: string[] = [];
  const institutionSkills: string[] = [];
  const stateIds: string[] = [];

  beforeAll(async () => {
    service = createClient(localUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    institutionA = (await insertOne(service, 'institutions', { name: `Adaptive A ${suffix}`, active: true })).id;
    institutionB = (await insertOne(service, 'institutions', { name: `Adaptive B ${suffix}`, active: true })).id;

    const yearA = (await insertOne(service, 'academic_years', {
      institution_id: institutionA, name: `2026 A ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
    })).id;
    const termA = (await insertOne(service, 'terms', {
      academic_year_id: yearA, name: `1º Bimestre ${suffix}`, start_date: '2026-01-01', end_date: '2026-03-31', active: true,
    })).id;
    const yearB = (await insertOne(service, 'academic_years', {
      institution_id: institutionB, name: `2026 B ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
    })).id;
    const termB = (await insertOne(service, 'terms', {
      academic_year_id: yearB, name: `1º Bimestre B ${suffix}`, start_date: '2026-01-01', end_date: '2026-03-31', active: true,
    })).id;
    termIds = [termA, termB];

    classA = (await insertOne(service, 'classes', {
      institution_id: institutionA, academic_year_id: yearA, name: `1ª série EM A ${suffix}`, grade_level: '1º EM', shift: 'INTEGRAL', active: true,
    })).id;
    classUnassigned = (await insertOne(service, 'classes', {
      institution_id: institutionA, academic_year_id: yearA, name: `1ª série EM B ${suffix}`, grade_level: '1º EM', shift: 'INTEGRAL', active: true,
    })).id;
    classB = (await insertOne(service, 'classes', {
      institution_id: institutionB, academic_year_id: yearB, name: `1ª série EM B ${suffix}`, grade_level: '1º EM', shift: 'INTEGRAL', active: true,
    })).id;

    teacherA = await createActor(service, institutionA, 'TEACHER', 'math', suffix);
    teacherB = await createActor(service, institutionA, 'TEACHER', 'portuguese', suffix);
    teacherForeign = await createActor(service, institutionB, 'TEACHER', 'foreign-teacher', suffix);
    directorA = await createActor(service, institutionA, 'DIRECTOR', 'director', suffix);
    const studentActor = await createActor(service, institutionA, 'STUDENT', 'student', suffix);
    const unassignedActor = await createActor(service, institutionA, 'STUDENT', 'unassigned', suffix);
    const foreignActor = await createActor(service, institutionB, 'STUDENT', 'foreign-student', suffix);
    userIds.push(teacherA.id, teacherB.id, teacherForeign.id, directorA.id, studentActor.id, unassignedActor.id, foreignActor.id);
    studentClient = studentActor.client;

    studentA = (await insertOne(service, 'students', {
      profile_id: studentActor.id, institution_id: institutionA, registration_number: `A-${suffix}`, active: true,
    })).id;
    studentUnassigned = (await insertOne(service, 'students', {
      profile_id: unassignedActor.id, institution_id: institutionA, registration_number: `U-${suffix}`, active: true,
    })).id;
    studentB = (await insertOne(service, 'students', {
      profile_id: foreignActor.id, institution_id: institutionB, registration_number: `B-${suffix}`, active: true,
    })).id;

    await insertOne(service, 'enrollments', { student_id: studentA, class_id: classA, academic_year_id: yearA, status: 'active', active: true });
    await insertOne(service, 'enrollments', { student_id: studentUnassigned, class_id: classUnassigned, academic_year_id: yearA, status: 'active', active: true });
    await insertOne(service, 'enrollments', { student_id: studentB, class_id: classB, academic_year_id: yearB, status: 'active', active: true });

    const mathSubject = (await insertOne(service, 'subjects', { institution_id: institutionA, name: `Matemática ${suffix}`, code: `MAT-${suffix}`, active: true })).id;
    const portugueseSubject = (await insertOne(service, 'subjects', { institution_id: institutionA, name: `Português ${suffix}`, code: `POR-${suffix}`, active: true })).id;
    const foreignSubject = (await insertOne(service, 'subjects', { institution_id: institutionB, name: `Matemática B ${suffix}`, code: `MATB-${suffix}`, active: true })).id;
    subjectIds = [mathSubject, portugueseSubject, foreignSubject];
    await insertOne(service, 'class_curriculum_items', { institution_id: institutionA, class_id: classA, subject_id: mathSubject, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
    await insertOne(service, 'class_curriculum_items', { institution_id: institutionA, class_id: classA, subject_id: portugueseSubject, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
    await insertOne(service, 'class_curriculum_items', { institution_id: institutionA, class_id: classUnassigned, subject_id: mathSubject, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
    await insertOne(service, 'class_curriculum_items', { institution_id: institutionB, class_id: classB, subject_id: foreignSubject, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
    await insertOne(service, 'subject_offerings', { class_id: classA, subject_id: mathSubject, teacher_profile_id: teacherA.id, term_id: termA, active: true });
    await insertOne(service, 'subject_offerings', { class_id: classA, subject_id: portugueseSubject, teacher_profile_id: teacherB.id, term_id: termA, active: true });
    await insertOne(service, 'subject_offerings', { class_id: classUnassigned, subject_id: mathSubject, teacher_profile_id: teacherB.id, term_id: termA, active: true });
    await insertOne(service, 'subject_offerings', { class_id: classB, subject_id: foreignSubject, teacher_profile_id: teacherForeign.id, term_id: termB, active: true });

    const catalog = (await insertOne(service, 'learning_curriculum_catalogs', {
      code: `ADAPTIVE_RUNTIME_${suffix}`, name: 'Adaptive runtime', version: '1.0', active: true,
    })).id;
    mathCanonicalId = (await insertOne(service, 'learning_curriculum_skills', {
      catalog_id: catalog, code: `MATH_RUNTIME_${suffix}`, stage: 'ENSINO_MEDIO', grade_level: 1, subject_area: 'MATEMATICA', domain: 'ALGEBRA', title: 'Função afim', active: true,
    })).id;
    linearCanonicalId = mathCanonicalId;
    portugueseCanonicalId = (await insertOne(service, 'learning_curriculum_skills', {
      catalog_id: catalog, code: `PORT_RUNTIME_${suffix}`, stage: 'ENSINO_MEDIO', grade_level: 1, subject_area: 'LINGUAGENS', domain: 'LEITURA', title: 'Leitura', active: true,
    })).id;
    const foreignCanonicalId = (await insertOne(service, 'learning_curriculum_skills', {
      catalog_id: catalog, code: `FOREIGN_RUNTIME_${suffix}`, stage: 'ENSINO_MEDIO', grade_level: 1, subject_area: 'MATEMATICA', domain: 'ALGEBRA', title: 'Função B', active: true,
    })).id;
    cycleIds = (await Promise.all(['A', 'B', 'C', 'D', 'E', 'F'].map((code) => service.from('learning_curriculum_skills').insert({
      catalog_id: catalog, code: `CYCLE_${code}_${suffix}`, stage: 'ENSINO_MEDIO', grade_level: 1, subject_area: 'MATEMATICA', domain: 'TEST', title: `Ciclo ${code}`, active: true,
    }).select('id').single().then((result) => required(result.data, `cycle ${code}`))))).map((row) => row.id);

    await insertOne(service, 'learning_curriculum_grade_targets', {
      catalog_id: catalog, stage: 'ENSINO_MEDIO', grade_level: 1, subject_area: 'MATEMATICA', canonical_skill_id: mathCanonicalId, priority: 0, sort_order: 0, active: true,
    });
    const unitMath = (await insertOne(service, 'learning_units', { institution_id: institutionA, subject_id: mathSubject, title: `Álgebra ${suffix}`, active: true })).id;
    const unitPortuguese = (await insertOne(service, 'learning_units', { institution_id: institutionA, subject_id: portugueseSubject, title: `Leitura ${suffix}`, active: true })).id;
    const unitForeign = (await insertOne(service, 'learning_units', { institution_id: institutionB, subject_id: foreignSubject, title: `Álgebra B ${suffix}`, active: true })).id;
    const mathSkill = (await insertOne(service, 'learning_skills', { institution_id: institutionA, unit_id: unitMath, title: `Função afim ${suffix}`, active: true })).id;
    const portugueseSkill = (await insertOne(service, 'learning_skills', { institution_id: institutionA, unit_id: unitPortuguese, title: `Leitura ${suffix}`, active: true })).id;
    const foreignSkill = (await insertOne(service, 'learning_skills', { institution_id: institutionB, unit_id: unitForeign, title: `Função B ${suffix}`, active: true })).id;
    institutionSkills.push(mathSkill, portugueseSkill, foreignSkill);
    await insertOne(service, 'learning_curriculum_subject_links', { institution_id: institutionA, subject_id: mathSubject, subject_area: 'MATEMATICA', active: true });
    await insertOne(service, 'learning_curriculum_subject_links', { institution_id: institutionA, subject_id: portugueseSubject, subject_area: 'LINGUAGENS', active: true });
    await insertOne(service, 'learning_curriculum_subject_links', { institution_id: institutionB, subject_id: foreignSubject, subject_area: 'MATEMATICA', active: true });
    await insertOne(service, 'learning_skill_canonical_links', { institution_id: institutionA, learning_skill_id: mathSkill, canonical_skill_id: mathCanonicalId, active: true });
    await insertOne(service, 'learning_skill_canonical_links', { institution_id: institutionA, learning_skill_id: portugueseSkill, canonical_skill_id: portugueseCanonicalId, active: true });
    await insertOne(service, 'learning_skill_canonical_links', { institution_id: institutionB, learning_skill_id: foreignSkill, canonical_skill_id: foreignCanonicalId, active: true });

    const mathState = await insertOne(service, 'learning_student_skill_state', {
      institution_id: institutionA, student_id: studentA, canonical_skill_id: mathCanonicalId, state: 'NEEDS_REVIEW', mastery_estimate: 40, evidence_count: 2, confidence: 0.67,
    });
    const portugueseState = await insertOne(service, 'learning_student_skill_state', {
      institution_id: institutionA, student_id: studentA, canonical_skill_id: portugueseCanonicalId, state: 'INTRODUCED', mastery_estimate: 50, evidence_count: 1, confidence: 0.33,
    });
    const unassignedState = await insertOne(service, 'learning_student_skill_state', {
      institution_id: institutionA, student_id: studentUnassigned, canonical_skill_id: mathCanonicalId, state: 'NEEDS_REVIEW', mastery_estimate: 40, evidence_count: 2, confidence: 0.67,
    });
    const foreignState = await insertOne(service, 'learning_student_skill_state', {
      institution_id: institutionB, student_id: studentB, canonical_skill_id: foreignCanonicalId, state: 'NEEDS_REVIEW', mastery_estimate: 40, evidence_count: 2, confidence: 0.67,
    });
    stateIds.push(mathState.id, portugueseState.id, unassignedState.id, foreignState.id);

    const activity = await insertOne(service, 'learning_activities', {
      institution_id: institutionA, subject_id: mathSubject, unit_id: unitMath, skill_id: mathSkill, teacher_id: teacherA.id, title: `Função afim ${suffix}`, description: 'runtime', activity_type: 'PRACTICE', status: 'PUBLISHED',
    });
    activityId = activity.id;
    const question = await insertOne(service, 'learning_questions', {
      institution_id: institutionA, activity_id: activityId, question_text: 'Qual opção está correta?', question_type: 'MULTIPLE_CHOICE', options_json: ['A', 'B'], correct_answer_json: 'A', points: 1, sort_order: 0,
    });
    questionId = question.id;
    await insertOne(service, 'learning_assignments', {
      institution_id: institutionA, activity_id: activityId, class_id: classA, assigned_by: teacherA.id,
    });
    userIds.push(teacherA.id, teacherB.id, teacherForeign.id, studentActor.id, unassignedActor.id, foreignActor.id);
  }, 120_000);

  it('teacher roster RPC normalizes legacy enrollment statuses', async () => {
    const rosterFor = async (client: AnyClient, institutionId: string) => {
      const result = await client.rpc('list_teacher_learning_students', { p_institution_id: institutionId });
      expect(result.error).toBeNull();
      return (result.data ?? []) as Array<{ student_id: string }>;
    };

    const expectOnlyAssignedStudent = async (client: AnyClient, institutionId: string) => {
      const rows = await rosterFor(client, institutionId);
      expect(rows.map((row) => row.student_id)).toEqual([studentA]);
    };

    await expectOnlyAssignedStudent(teacherA.client, institutionA);

    for (const status of ['ACTIVE', ' ACTIVE ']) {
      const update = await service.from('enrollments').update({ status }).eq('student_id', studentA).eq('class_id', classA);
      expect(update.error).toBeNull();
      await expectOnlyAssignedStudent(teacherA.client, institutionA);
    }

    const crossTenant = await rosterFor(teacherA.client, institutionB);
    expect(crossTenant).toEqual([]);

    const unauthorizedTeacher = await rosterFor(teacherA.client, institutionA);
    expect(unauthorizedTeacher.some((row) => row.student_id === studentUnassigned)).toBe(false);

    await expectOnlyAssignedStudent(directorA.client, institutionA);

    const restore = await service.from('enrollments').update({ status: 'active' }).eq('student_id', studentA).eq('class_id', classA);
    expect(restore.error).toBeNull();
  }, 90_000);

  it('blocks self, direct and indirect prerequisite cycles at runtime', async () => {
    const self = await service.from('learning_skill_prerequisites').insert({ skill_id: cycleIds[0], prerequisite_skill_id: cycleIds[0] });
    expect(self.error).not.toBeNull();

    expect((await service.from('learning_skill_prerequisites').insert({ skill_id: cycleIds[0], prerequisite_skill_id: cycleIds[1] })).error).toBeNull();
    const direct = await service.from('learning_skill_prerequisites').insert({ skill_id: cycleIds[1], prerequisite_skill_id: cycleIds[0] });
    expect(direct.error).not.toBeNull();

    expect((await service.from('learning_skill_prerequisites').insert({ skill_id: cycleIds[3], prerequisite_skill_id: cycleIds[4] })).error).toBeNull();
    expect((await service.from('learning_skill_prerequisites').insert({ skill_id: cycleIds[4], prerequisite_skill_id: cycleIds[5] })).error).toBeNull();
    const indirect = await service.from('learning_skill_prerequisites').insert({ skill_id: cycleIds[5], prerequisite_skill_id: cycleIds[3] });
    expect(indirect.error).not.toBeNull();
  }, 60_000);

  it('enforces student ownership and teacher subject scope', async () => {
    const ownStudent = await studentClient.from('learning_student_skill_state').select('canonical_skill_id').eq('student_id', studentA);
    expect(ownStudent.error).toBeNull();
    expect(ownStudent.data?.map((row: { canonical_skill_id: string }) => row.canonical_skill_id)).toEqual(expect.arrayContaining([mathCanonicalId, portugueseCanonicalId]));

    const otherStudent = await studentClient.from('learning_student_skill_state').select('id').eq('student_id', studentUnassigned);
    expect(otherStudent.error).toBeNull();
    expect(otherStudent.data).toEqual([]);
    const foreignTenant = await studentClient.from('learning_student_skill_state').select('id').eq('institution_id', institutionB);
    expect(foreignTenant.error).toBeNull();
    expect(foreignTenant.data).toEqual([]);

    const ownSubject = await teacherA.client.from('learning_student_skill_state').select('canonical_skill_id').eq('student_id', studentA);
    expect(ownSubject.error).toBeNull();
    expect(ownSubject.data?.map((row: { canonical_skill_id: string }) => row.canonical_skill_id)).toEqual([mathCanonicalId]);
    const otherSubject = await teacherA.client.from('learning_student_skill_state').select('id').eq('canonical_skill_id', portugueseCanonicalId).eq('student_id', studentA);
    expect(otherSubject.error).toBeNull();
    expect(otherSubject.data).toEqual([]);
    const unassigned = await teacherA.client.from('learning_student_skill_state').select('id').eq('student_id', studentUnassigned);
    expect(unassigned.error).toBeNull();
    expect(unassigned.data).toEqual([]);
    const crossTenant = await teacherA.client.from('learning_student_skill_state').select('id').eq('institution_id', institutionB);
    expect(crossTenant.error).toBeNull();
    expect(crossTenant.data).toEqual([]);

    const insights = await teacherA.client.rpc('get_teacher_adaptive_insights', { p_institution_id: institutionA });
    expect(insights.error).toBeNull();
    expect(insights.data?.map((row: { canonical_skill_id: string }) => row.canonical_skill_id)).toEqual([mathCanonicalId]);

    await service.from('enrollments').update({ status: 'inactive' }).eq('student_id', studentA).eq('class_id', classA);
    const inactiveEnrollment = await teacherA.client.from('learning_student_skill_state').select('id').eq('student_id', studentA);
    expect(inactiveEnrollment.error).toBeNull();
    expect(inactiveEnrollment.data).toEqual([]);
    await service.from('enrollments').update({ status: 'active' }).eq('student_id', studentA).eq('class_id', classA);
  }, 90_000);

  it('preserves append-only runs while keeping the legacy summary at latest state', async () => {
    const before = await studentClient.rpc('list_student_learning_activities', { p_institution_id: institutionA });
    expect(before.error).toBeNull();
    const activity = before.data?.find((row: { id: string }) => row.id === activityId);
    const question = activity?.learning_questions?.[0];
    expect(question?.correct_answer_json).toBeUndefined();
    expect(question?.explanation).toBeUndefined();

    const first = await studentClient.rpc('submit_learning_attempt', {
      p_activity_id: activityId,
      p_answers: [{ question_id: questionId, answer: 'B' }],
    });
    expect(first.error).toBeNull();
    const second = await studentClient.rpc('submit_learning_attempt', {
      p_activity_id: activityId,
      p_answers: [{ question_id: questionId, answer: 'A' }],
    });
    expect(second.error).toBeNull();

    const runs = await service.from('learning_attempt_runs').select('run_number,score').eq('activity_id', activityId).eq('student_id', studentA).order('run_number');
    expect(runs.error).toBeNull();
    expect(runs.data?.map((row: { run_number: number }) => row.run_number)).toEqual([1, 2]);
    expect(runs.data?.map((row: { score: number }) => row.score)).toEqual([0, 1]);
    const summary = await service.from('learning_attempts').select('score').eq('activity_id', activityId).eq('student_id', studentA).single();
    expect(summary.error).toBeNull();
    expect(summary.data?.score).toBe(1);
  }, 90_000);

  afterAll(async () => {
    if (!service) return;
    if (activityId) {
      const runs = await service.from('learning_attempt_runs').select('id').eq('activity_id', activityId);
      const runIds = runs.data?.map((row: { id: string }) => row.id) ?? [];
      if (runIds.length) {
        await service.from('learning_skill_evidence').delete().in('attempt_run_id', runIds);
        await service.from('learning_attempt_run_answers').delete().in('run_id', runIds);
      }
      const attempt = await service.from('learning_attempts').select('id').eq('activity_id', activityId).single();
      if (attempt.data?.id) await service.from('learning_answers').delete().eq('attempt_id', attempt.data.id);
      await service.from('learning_skill_progress').delete().in('student_id', [studentA, studentUnassigned]);
      await service.from('learning_attempt_runs').delete().eq('activity_id', activityId);
      await service.from('learning_attempts').delete().eq('activity_id', activityId);
      await service.from('learning_assignments').delete().eq('activity_id', activityId);
      await service.from('learning_questions').delete().eq('activity_id', activityId);
      await service.from('learning_activities').delete().eq('id', activityId);
    }
    if (stateIds.length) await service.from('learning_student_skill_state').delete().in('id', stateIds);
    if (institutionSkills.length) await service.from('learning_skill_canonical_links').delete().in('learning_skill_id', institutionSkills);
    if (institutionSkills.length) await service.from('learning_skills').delete().in('id', institutionSkills);
    if (institutionA) await service.from('learning_curriculum_subject_links').delete().in('institution_id', [institutionA, institutionB]);
    if (institutionA) await service.from('learning_curriculum_grade_targets').delete().eq('canonical_skill_id', mathCanonicalId);
    if (cycleIds.length) await service.from('learning_skill_prerequisites').delete().in('skill_id', cycleIds);
    if (cycleIds.length) await service.from('learning_skill_prerequisites').delete().in('prerequisite_skill_id', cycleIds);
    if (cycleIds.length) await service.from('learning_curriculum_skills').delete().in('id', [...cycleIds, mathCanonicalId, portugueseCanonicalId, linearCanonicalId]);
    if (institutionA) await service.from('learning_units').delete().eq('institution_id', institutionA);
    if (institutionA) await service.from('subject_offerings').delete().in('class_id', [classA, classUnassigned, classB]);
    if (termIds.length) await service.from('terms').delete().in('id', termIds);
    if (institutionA) await service.from('enrollments').delete().in('student_id', [studentA, studentUnassigned, studentB]);
    if (institutionA) await service.from('students').delete().in('id', [studentA, studentUnassigned, studentB]);
    if (institutionA) await service.from('memberships').delete().in('profile_id', userIds);
    if (institutionA) await service.from('profiles').delete().in('id', userIds);
    for (const userId of [...new Set(userIds)]) await service.auth.admin.deleteUser(userId);
    if (subjectIds.length) await service.from('subjects').delete().in('id', subjectIds);
    if (institutionA) await service.from('classes').delete().in('id', [classA, classUnassigned, classB]);
    if (institutionA) await service.from('academic_years').delete().in('institution_id', [institutionA, institutionB]);
    if (institutionA) await service.from('institutions').delete().in('id', [institutionA, institutionB]);
    if (service) await service.from('learning_curriculum_catalogs').delete().eq('code', `ADAPTIVE_RUNTIME_${suffix}`);
  }, 120_000);
});
