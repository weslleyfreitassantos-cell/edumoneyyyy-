import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; client: Db };

const url = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const isLoopback = (() => {
  if (!url) return false;
  try { return ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname); }
  catch { return false; }
})();
if (url && !isLoopback) throw new Error('Guided Study V11 integration tests require a loopback Supabase instance.');
const localDescribe = url && anonKey && serviceRoleKey && isLoopback ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(db: Db, table: string, row: Record<string, unknown>) {
  const { data, error } = await db.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(service: Db, label: string, suffix: string): Promise<Actor> {
  const email = `guided-v11-${label}-${suffix}@local.test`;
  const password = 'GuidedV11-Test!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${label}: ${error.message}`);
  const user = required(data.user, `${label} auth user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: `Guided V11 ${label}`, email, role: 'STUDENT', active: true });
  const client = createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: `guided-v11-${label}-${suffix}` },
  });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ${label}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, client };
}

localDescribe('Guided Study V11 against disposable local Supabase', () => {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const userIds: string[] = [];
  let service: Db;
  let accountId: string;
  let institutionId: string;
  let studentId: string;
  let canonicalSkillId: string;
  let probeSetId: string;
  let probeQuestionId: string;
  let teacher: Actor;
  let student: Actor;
  let otherStudent: Actor;

  beforeAll(async () => {
    service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const admin = await createActor(service, 'admin', suffix);
    teacher = await createActor(service, 'teacher', suffix);
    student = await createActor(service, 'student', suffix);
    otherStudent = await createActor(service, 'other', suffix);
    userIds.push(admin.id, teacher.id, student.id, otherStudent.id);

    accountId = (await insertOne(service, 'accounts', {
      name: `Guided V11 ${suffix}`, owner_profile_id: admin.id, institution_limit: 1, status: 'ACTIVE',
    })).id;
    institutionId = (await insertOne(service, 'institutions', {
      account_id: accountId, name: `Guided V11 ${suffix}`, active: true,
    })).id;
    for (const actor of [admin, teacher, student, otherStudent]) {
      await insertOne(service, 'memberships', {
        profile_id: actor.id, institution_id: institutionId,
        role: actor.id === admin.id ? 'ADMIN' : actor.id === teacher.id ? 'TEACHER' : 'STUDENT', active: true,
      });
    }

    const year = await insertOne(service, 'academic_years', {
      institution_id: institutionId, name: `2026 ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
    });
    const term = await insertOne(service, 'terms', {
      academic_year_id: year.id, name: `Term ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
    });
    const schoolClass = await insertOne(service, 'classes', {
      institution_id: institutionId, academic_year_id: year.id, name: `1º ano V11 ${suffix}`,
      grade_level: '1º ano', shift: 'INTEGRAL', active: true,
    });
    studentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: student.id, registration_number: `V11-${suffix}`, active: true,
    })).id;
    await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: otherStudent.id, registration_number: `V11-OTHER-${suffix}`, active: true,
    });
    await insertOne(service, 'enrollments', {
      student_id: studentId, class_id: schoolClass.id, academic_year_id: year.id, status: 'active', active: true,
    });

    const catalog = await service.from('learning_curriculum_catalogs')
      .select('id').eq('code', 'BNCC_2018').eq('active', true).limit(1).single();
    if (catalog.error) throw new Error(`active BNCC catalog: ${catalog.error.message}`);

    const fixtureCode = `V11_TEST_${suffix.replace(/[^a-z0-9]/gi, '').toUpperCase()}`;
    const canonicalSkill = await insertOne(service, 'learning_curriculum_skills', {
      catalog_id: catalog.data.id, code: fixtureCode, stage: 'ENSINO_FUNDAMENTAL', grade_level: 1,
      subject_area: 'MATHEMATICS', domain: 'NUMBER_SENSE', title: `V11 test skill ${suffix}`,
      description: 'Isolated integration-test target.', active: true, node_kind: 'LEAF',
      content_readiness: 'ADAPTIVE_READY', mastery_targetable: true,
      pedagogical_review_status: 'PEDAGOGICAL_REVIEWED', bncc_alignment_status: 'MAPPED',
      publication_status: 'PUBLISHED',
      metadata: { official_code: fixtureCode, content_pack: 'V11_CI_TEST_FIXTURE', fixture_only: true },
    });
    canonicalSkillId = canonicalSkill.id;
    await insertOne(service, 'learning_curriculum_grade_targets', {
      catalog_id: catalog.data.id, stage: 'ENSINO_FUNDAMENTAL', grade_level: 1,
      subject_area: 'MATHEMATICS', canonical_skill_id: canonicalSkillId, active: true,
    });
    await insertOne(service, 'learning_skill_lessons', {
      canonical_skill_id: canonicalSkillId, version: 4, title: 'Comparar quantidades',
      summary: 'Use a mesma unidade para comparar duas quantidades.',
      content_markdown: 'Identifique as quantidades e compare-as usando uma unidade comum.',
      worked_example: 'Se 4 grupos têm 3 objetos cada, há 12 objetos.', tips: ['Confira as unidades.'],
      estimated_minutes: 5, active: true, metadata: { fixture_only: true },
    });
    const probeQuestion = await insertOne(service, 'learning_question_bank', {
      package_type: 'TECESCOLA', source_type: 'AUTHORED', subject_area: 'MATHEMATICS',
      domain: 'NUMBER_SENSE', topic: 'comparison', statement: 'Qual número é maior: 8 ou 5?',
      options: [{ id: 'A', text: '8' }, { id: 'B', text: '5' }],
      correct_answer: 'A', explanation: '8 é maior que 5.', difficulty: 'EASY',
      estimated_minutes: 1, provenance: 'V11 integration-test fixture', active: true,
      metadata: { fixture_only: true },
    });
    probeQuestionId = probeQuestion.id;
    const probeSet = await insertOne(service, 'learning_question_sets', {
      canonical_skill_id: canonicalSkillId, scope: 'GLOBAL', purpose: 'PROBE', version: 4,
      difficulty: 'EASY', active: true, metadata: { fixture_only: true },
    });
    probeSetId = probeSet.id;
    await insertOne(service, 'learning_question_set_items', {
      question_set_id: probeSetId, question_bank_id: probeQuestionId, position: 0,
    });

    const subject = await insertOne(service, 'subjects', {
      institution_id: institutionId, name: `V11 Mathematics ${suffix}`, code: `V11-${suffix}`, active: true,
    });
    await insertOne(service, 'class_curriculum_items', {
      institution_id: institutionId, class_id: schoolClass.id, subject_id: subject.id,
      weekly_lessons: 1, lesson_duration_minutes: 45, active: true,
    });
    await insertOne(service, 'subject_offerings', {
      class_id: schoolClass.id, subject_id: subject.id, teacher_profile_id: teacher.id, term_id: term.id, active: true,
    });
    await insertOne(service, 'learning_curriculum_subject_links', {
      institution_id: institutionId, subject_id: subject.id, subject_area: 'MATHEMATICS', active: true,
    });
    const unit = await insertOne(service, 'learning_units', {
      institution_id: institutionId, subject_id: subject.id, title: `V11 unit ${suffix}`, active: true,
    });
    const skill = await insertOne(service, 'learning_skills', {
      institution_id: institutionId, unit_id: unit.id, title: `V11 skill ${suffix}`, active: true,
    });
    await insertOne(service, 'learning_skill_canonical_links', {
      institution_id: institutionId, learning_skill_id: skill.id, canonical_skill_id: canonicalSkillId, active: true,
    });
  }, 120_000);

  afterAll(async () => {
    if (!service) return;
    if (institutionId) await service.from('institutions').delete().eq('id', institutionId);
    if (accountId) await service.from('accounts').delete().eq('id', accountId);
    if (probeSetId) await service.from('learning_question_sets').delete().eq('id', probeSetId);
    if (probeQuestionId) await service.from('learning_question_bank').delete().eq('id', probeQuestionId);
    if (canonicalSkillId) {
      await service.from('learning_curriculum_grade_targets').delete().eq('canonical_skill_id', canonicalSkillId);
      await service.from('learning_skill_lessons').delete().eq('canonical_skill_id', canonicalSkillId);
      await service.from('learning_curriculum_skills').delete().eq('id', canonicalSkillId);
    }
    for (const userId of userIds) {
      await service.from('profiles').delete().eq('id', userId);
      await service.auth.admin.deleteUser(userId);
    }
  });

  it('starts the real V4 diagnostic once under concurrency, persists it, resumes it and denies cross-student access', async () => {
    const overview = await student.client.rpc('get_guided_study_overview_v11', { p_institution_id: institutionId });
    expect(overview.error).toBeNull();
    expect(overview.data?.state).toBe('READY');
    expect(overview.data?.grade_label).toContain('1º ano');
    expect(overview.data?.student_id).toBeUndefined();
    expect(overview.data?.target_canonical_skill_id).toBeUndefined();

    const [first, concurrent] = await Promise.all([
      student.client.rpc('start_guided_study_v11', { p_institution_id: institutionId }),
      student.client.rpc('start_guided_study_v11', { p_institution_id: institutionId }),
    ]);
    expect(first.error).toBeNull();
    expect(concurrent.error).toBeNull();
    const sessionId = required(first.data?.session_id, 'V11 session ID');
    expect(concurrent.data?.session_id).toBe(sessionId);
    expect([first.data?.created, concurrent.data?.created].filter(Boolean)).toHaveLength(1);

    const session = await service.from('learning_guided_sessions').select('id,student_id,status,metadata,current_step_id').eq('id', sessionId).single();
    expect(session.error).toBeNull();
    expect(session.data?.student_id).toBe(studentId);
    expect(session.data?.metadata?.orchestration_version).toBe('V11');
    expect(session.data?.metadata?.initial_diagnostic).toBe(true);
    const step = await service.from('learning_guided_steps').select('id,step_type,purpose,question_set_id').eq('id', session.data?.current_step_id).single();
    expect(step.error).toBeNull();
    expect(step.data?.step_type).toBe('PROBE');
    expect(step.data?.purpose).toBe('PROBE');
    expect(step.data?.question_set_id).toBeTruthy();
    const realProbe = await student.client.rpc('get_guided_learning_step_v4', { p_step_id: step.data?.id });
    expect(realProbe.error).toBeNull();
    expect(realProbe.data?.questions?.length).toBeGreaterThan(0);

    const paused = await student.client.rpc('pause_guided_study_v11', { p_institution_id: institutionId, p_session_id: sessionId });
    expect(paused.error).toBeNull();
    expect(paused.data?.status).toBe('PAUSED');
    const pauseAgain = await student.client.rpc('pause_guided_study_v11', { p_institution_id: institutionId, p_session_id: sessionId });
    expect(pauseAgain.error).toBeNull();
    expect(pauseAgain.data?.idempotent).toBe(true);

    const otherOverview = await otherStudent.client.rpc('get_guided_study_overview_v11', { p_institution_id: institutionId });
    expect(otherOverview.error).toBeNull();
    expect(otherOverview.data?.state).toBe('NO_ACTIVE_ENROLLMENT');
    const deniedPause = await otherStudent.client.rpc('pause_guided_study_v11', { p_institution_id: institutionId, p_session_id: sessionId });
    expect(deniedPause.error?.code).toBe('42501');

    const resumed = await student.client.rpc('start_guided_study_v11', { p_institution_id: institutionId });
    expect(resumed.error).toBeNull();
    expect(resumed.data?.session_id).toBe(sessionId);
    const afterResume = await service.from('learning_guided_sessions').select('status,current_step_id').eq('id', sessionId).single();
    expect(afterResume.data?.status).toBe('ACTIVE');
    expect(afterResume.data?.current_step_id).toBe(step.data?.id);

    const foreignInstitution = await insertOne(service, 'institutions', { name: `Guided V11 foreign ${suffix}`, active: true });
    const foreignScope = await student.client.rpc('get_guided_study_overview_v11', { p_institution_id: foreignInstitution.id });
    expect(foreignScope.error).toBeNull();
    expect(foreignScope.data?.state).toBe('NO_STUDENT_PROFILE');
    await service.from('institutions').delete().eq('id', foreignInstitution.id);
  }, 90_000);
});
