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

    const canonical = await service.from('learning_curriculum_skills')
      .select('id,code,subject_area')
      .in('code', ['PHYSICS_AVERAGE_SPEED', 'MATH_PERCENT_OF_QUANTITY', 'MATH_RATIO_UNIT_RATE', 'PORTUGUESE_ARGUMENT_EVIDENCE', 'HISTORY_INTERPRET_EVIDENCE'])
      .eq('active', true);
    if (canonical.error) throw new Error(`canonical skills: ${canonical.error.message}`);

    const targets = await service.from('learning_curriculum_grade_targets')
      .select('canonical_skill_id,subject_area,stage,grade_level')
      .in('canonical_skill_id', canonical.data.map((row: any) => row.id))
      .eq('stage', 'ENSINO_FUNDAMENTAL')
      .eq('grade_level', 1)
      .eq('active', true);
    if (targets.error) throw new Error(`grade targets: ${targets.error.message}`);

    let selected: { skillId: string; area: string } | undefined;
    for (const target of targets.data) {
      const skill = canonical.data.find((row: any) => row.id === target.canonical_skill_id);
      if (!skill || skill.subject_area !== target.subject_area) continue;
      const [lesson, probe] = await Promise.all([
        service.from('learning_skill_lessons').select('id').eq('canonical_skill_id', skill.id).eq('version', 4).eq('active', true).limit(1),
        service.from('learning_question_sets').select('id,metadata').eq('canonical_skill_id', skill.id).eq('scope', 'GLOBAL').eq('purpose', 'PROBE').eq('version', 4).eq('active', true).is('institution_id', null).is('teacher_profile_id', null).limit(1),
      ]);
      if (lesson.error || probe.error) throw new Error(`published V4 content lookup: ${lesson.error?.message ?? probe.error?.message}`);
      if (!lesson.data.length || !probe.data.length) continue;
      const probeMetadata = probe.data[0].metadata ?? {};
      if (probeMetadata.demo_preview || probeMetadata.demo_preview_only || probeMetadata.demonstration_only) continue;
      const items = await service.from('learning_question_set_items').select('question_bank_id').eq('question_set_id', probe.data[0].id);
      if (items.error) throw new Error(`probe items: ${items.error.message}`);
      if (!items.data.length) continue;
      const questions = await service.from('learning_question_bank')
        .select('id,active,metadata')
        .in('id', items.data.map((item: any) => item.question_bank_id))
        .eq('active', true);
      if (questions.error) throw new Error(`active probe questions: ${questions.error.message}`);
      if (questions.data.length !== items.data.length || questions.data.some((question: any) => {
        const metadata = question.metadata ?? {};
        return metadata.demo_preview || metadata.demo_preview_only || metadata.demonstration_only;
      })) continue;
      selected = { skillId: skill.id, area: target.subject_area };
      break;
    }
    if (!selected) throw new Error('No published grade-1 BNCC target has both V4 lesson content and an active PROBE question set.');

    const subject = await insertOne(service, 'subjects', {
      institution_id: institutionId, name: `V11 ${selected.area} ${suffix}`, code: `V11-${suffix}`, active: true,
    });
    await insertOne(service, 'class_curriculum_items', {
      institution_id: institutionId, class_id: schoolClass.id, subject_id: subject.id,
      weekly_lessons: 1, lesson_duration_minutes: 45, active: true,
    });
    await insertOne(service, 'subject_offerings', {
      class_id: schoolClass.id, subject_id: subject.id, teacher_profile_id: teacher.id, term_id: term.id, active: true,
    });
    await insertOne(service, 'learning_curriculum_subject_links', {
      institution_id: institutionId, subject_id: subject.id, subject_area: selected.area, active: true,
    });
    const unit = await insertOne(service, 'learning_units', {
      institution_id: institutionId, subject_id: subject.id, title: `V11 unit ${suffix}`, active: true,
    });
    const skill = await insertOne(service, 'learning_skills', {
      institution_id: institutionId, unit_id: unit.id, title: `V11 skill ${suffix}`, active: true,
    });
    await insertOne(service, 'learning_skill_canonical_links', {
      institution_id: institutionId, learning_skill_id: skill.id, canonical_skill_id: selected.skillId, active: true,
    });
  }, 120_000);

  afterAll(async () => {
    if (!service) return;
    if (institutionId) await service.from('institutions').delete().eq('id', institutionId);
    if (accountId) await service.from('accounts').delete().eq('id', accountId);
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
