import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; password: string; client: Db };
type TargetCode =
  | 'MATH_PERCENT_OF_QUANTITY'
  | 'MATH_RATIO_UNIT_RATE'
  | 'PHYSICS_AVERAGE_SPEED'
  | 'PORTUGUESE_ARGUMENT_EVIDENCE'
  | 'HISTORY_INTERPRET_EVIDENCE';

const url = process.env.E2E_SUPABASE_URL ?? process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const adaptiveDescribe = url && anonKey && serviceRoleKey ? test.describe : test.describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(db: Db, table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await db.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(service: Db, role: 'ADMIN' | 'TEACHER' | 'STUDENT', name: string, suffix: string): Promise<Actor> {
  const email = `adaptive-v4-${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${suffix}@local.test`;
  const password = 'AdaptiveV4E2E!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = required(data.user, `${name} auth user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: name, email, role, active: true });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ${name}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, password, client };
}

async function readServiceSession(service: Db, sessionId: string): Promise<Record<string, any>> {
  const result = await service.from('learning_guided_sessions').select('*').eq('id', sessionId).single();
  if (result.error || !result.data) throw new Error(`session lookup: ${result.error?.message ?? 'missing'}`);
  return result.data;
}

async function completeCurrentStep(service: Db, student: Actor, sessionId: string, suffix: string): Promise<Record<string, any>> {
  const session = await readServiceSession(service, sessionId);
  const stepId = required(session.current_step_id, 'V4 current step');
  const step = await service.from('learning_guided_steps').select('id,canonical_skill_id,step_type,purpose,question_set_id').eq('id', stepId).single();
  if (step.error || !step.data) throw new Error(`V4 step lookup: ${step.error?.message ?? 'missing'}`);

  if (step.data.step_type === 'LESSON' || step.data.step_type === 'RETURN_TO_TARGET') {
    const advanced = await student.client.rpc('advance_guided_learning_session_v4', {
      p_session_id: sessionId,
      p_step_id: stepId,
      p_action: step.data.step_type === 'RETURN_TO_TARGET' ? 'TARGET_RETURNED' : 'LESSON_COMPLETED',
      p_idempotency_key: `v4-e2e:${suffix}:${stepId}`,
    });
    expect(advanced.error, `${step.data.step_type} advance`).toBeNull();
    return { step: step.data, result: advanced.data };
  }

  const items = await service.from('learning_question_set_items').select('question_bank_id').eq('question_set_id', step.data.question_set_id).order('position');
  if (items.error) throw new Error(`V4 question items: ${items.error.message}`);
  const questionIds = items.data.map((item: any) => item.question_bank_id);
  const banks = await service.from('learning_question_bank').select('id,correct_answer').in('id', questionIds);
  if (banks.error) throw new Error(`V4 question bank: ${banks.error.message}`);
  const answers = questionIds.map((questionId: string) => {
    const bank = banks.data.find((row: any) => row.id === questionId);
    return { question_bank_id: questionId, answer: String(required(bank?.correct_answer, `correct answer ${questionId}`)) };
  });
  const submitted = await student.client.rpc('submit_guided_learning_step_v4', {
    p_step_id: stepId,
    p_answers: answers,
    p_idempotency_key: `v4-e2e:${suffix}:${stepId}`,
  });
  expect(submitted.error, `${step.data.step_type} submit`).toBeNull();
  expect(submitted.data?.score).toBe(100);
  return { step: step.data, result: submitted.data };
}

async function runUntilSkill(service: Db, student: Actor, sessionId: string, targetSkillId: string, suffix: string): Promise<{ steps: Record<string, any>[]; final: Record<string, any> }> {
  const steps: Record<string, any>[] = [];
  for (let index = 0; index < 8; index += 1) {
    const session = await readServiceSession(service, sessionId);
    if (session.current_canonical_skill_id === targetSkillId || !session.current_step_id || session.status !== 'ACTIVE') break;
    const completed = await completeCurrentStep(service, student, sessionId, `${suffix}:${index}`);
    steps.push(completed.step);
  }
  return { steps, final: await readServiceSession(service, sessionId) };
}

adaptiveDescribe('adaptive learning V4 real proof slices', () => {
  test('runs real lessons, evidence, canonical attribution and the physics-to-math bridge', async () => {
    const service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = Date.now().toString(36);
    const userIds: string[] = [];
    let accountId: string | undefined;
    let institutionId: string | undefined;

    try {
      const admin = await createActor(service, 'ADMIN', 'Admin Adaptive V4', suffix);
      const teacher = await createActor(service, 'TEACHER', 'Professor Adaptive V4', suffix);
      const student = await createActor(service, 'STUDENT', 'Alice Adaptive V4', suffix);
      userIds.push(admin.id, teacher.id, student.id);

      accountId = (await insertOne(service, 'accounts', { name: `Adaptive V4 ${suffix}`, owner_profile_id: admin.id, institution_limit: 1, status: 'ACTIVE' })).id;
      institutionId = (await insertOne(service, 'institutions', { account_id: accountId, name: `TecEscola Adaptive V4 ${suffix}`, active: true })).id;
      for (const [actor, role] of [[admin, 'ADMIN'], [teacher, 'TEACHER'], [student, 'STUDENT']] as const) {
        await insertOne(service, 'memberships', { profile_id: actor.id, institution_id: institutionId, role, active: true });
      }
      const year = await insertOne(service, 'academic_years', { institution_id: institutionId, name: `2026 V4 ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true });
      const term = await insertOne(service, 'terms', { academic_year_id: year.id, name: `V4 Term ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true });
      const schoolClass = await insertOne(service, 'classes', { institution_id: institutionId, academic_year_id: year.id, name: `1º ano V4 ${suffix}`, grade_level: '1º ano', shift: 'INTEGRAL', active: true });
      const studentRow = await insertOne(service, 'students', { institution_id: institutionId, profile_id: student.id, registration_number: `V4-${suffix}`, active: true });
      await insertOne(service, 'enrollments', { student_id: studentRow.id, class_id: schoolClass.id, academic_year_id: year.id, status: 'active', active: true });

      const targetCodes: TargetCode[] = [
        'PHYSICS_AVERAGE_SPEED',
        'MATH_PERCENT_OF_QUANTITY',
        'MATH_RATIO_UNIT_RATE',
        'PORTUGUESE_ARGUMENT_EVIDENCE',
        'HISTORY_INTERPRET_EVIDENCE',
      ];
      const canonical = await service.from('learning_curriculum_skills').select('id,code').in('code', targetCodes).eq('active', true);
      if (canonical.error) throw canonical.error;
      const skillByCode = new Map(canonical.data.map((row: any) => [row.code as TargetCode, row.id as string]));
      for (const code of targetCodes) expect(skillByCode.get(code), `${code} canonical skill`).toBeTruthy();

      for (const code of targetCodes) {
        const subject = await insertOne(service, 'subjects', { institution_id: institutionId, name: `${code} V4 ${suffix}`, code: `V4-${code}-${suffix}`, active: true });
        await insertOne(service, 'class_curriculum_items', { institution_id: institutionId, class_id: schoolClass.id, subject_id: subject.id, weekly_lessons: 1, lesson_duration_minutes: 50, active: true });
        await insertOne(service, 'subject_offerings', { class_id: schoolClass.id, subject_id: subject.id, teacher_profile_id: teacher.id, term_id: term.id, active: true });
        const unit = await insertOne(service, 'learning_units', { institution_id: institutionId, subject_id: subject.id, title: `${code} V4 Unit ${suffix}`, active: true });
        const learningSkill = await insertOne(service, 'learning_skills', { institution_id: institutionId, unit_id: unit.id, title: `${code} V4 Skill ${suffix}`, active: true });
        await insertOne(service, 'learning_skill_canonical_links', { institution_id: institutionId, learning_skill_id: learningSkill.id, canonical_skill_id: skillByCode.get(code), active: true });
      }

      const prerequisite = await service.from('learning_skill_prerequisites').select('skill_id,prerequisite_skill_id').eq('skill_id', skillByCode.get('PHYSICS_AVERAGE_SPEED')).eq('prerequisite_skill_id', skillByCode.get('MATH_RATIO_UNIT_RATE')).single();
      expect(prerequisite.error, 'physics -> math prerequisite').toBeNull();

      const physicsStarted = await student.client.rpc('start_guided_learning_session_v4', { p_institution_id: institutionId, p_student_id: studentRow.id, p_target_canonical_skill_id: skillByCode.get('PHYSICS_AVERAGE_SPEED') });
      expect(physicsStarted.error, 'physics V4 start').toBeNull();
      const physicsSessionId = required(physicsStarted.data?.session_id, 'physics V4 session');
      const physicsJourney = await runUntilSkill(service, student, physicsSessionId, required(skillByCode.get('MATH_RATIO_UNIT_RATE'), 'math ratio canonical skill'), `${suffix}:physics`);
      expect(physicsJourney.steps.some((step) => step.canonical_skill_id === skillByCode.get('PHYSICS_AVERAGE_SPEED') && step.step_type === 'LESSON')).toBe(true);
      expect(physicsJourney.final.current_canonical_skill_id).toBe(skillByCode.get('MATH_RATIO_UNIT_RATE'));
      expect(physicsJourney.final.original_target_canonical_skill_id).toBe(skillByCode.get('PHYSICS_AVERAGE_SPEED'));
      const bridgeEvidence = await completeCurrentStep(service, student, physicsSessionId, `${suffix}:physics-bridge-evidence`);
      expect(bridgeEvidence.step.canonical_skill_id).toBe(skillByCode.get('MATH_RATIO_UNIT_RATE'));
      const physicsEvents = await service.from('learning_guided_session_events').select('event_type,payload').eq('session_id', physicsSessionId).order('created_at');
      expect(physicsEvents.error).toBeNull();
      expect(physicsEvents.data?.some((event: any) => event.event_type === 'REPLANNED')).toBe(true);
      const physicsEvidence = await service.from('learning_skill_evidence').select('canonical_skill_id,source,metadata').eq('institution_id', institutionId).eq('student_id', studentRow.id).in('canonical_skill_id', [skillByCode.get('PHYSICS_AVERAGE_SPEED'), skillByCode.get('MATH_RATIO_UNIT_RATE')]);
      expect(physicsEvidence.error).toBeNull();
      expect(physicsEvidence.data?.some((item: any) => item.canonical_skill_id === skillByCode.get('PHYSICS_AVERAGE_SPEED') && item.metadata?.engine_version === 'V4')).toBe(true);
      expect(physicsEvidence.data?.some((item: any) => item.canonical_skill_id === skillByCode.get('MATH_RATIO_UNIT_RATE') && item.metadata?.engine_version === 'V4')).toBe(true);

      for (const code of ['MATH_PERCENT_OF_QUANTITY', 'MATH_RATIO_UNIT_RATE', 'PORTUGUESE_ARGUMENT_EVIDENCE', 'HISTORY_INTERPRET_EVIDENCE'] as TargetCode[]) {
        const started = await student.client.rpc('start_guided_learning_session_v4', { p_institution_id: institutionId, p_student_id: studentRow.id, p_target_canonical_skill_id: skillByCode.get(code) });
        expect(started.error, `${code} V4 start`).toBeNull();
        const sessionId = required(started.data?.session_id, `${code} V4 session`);
        const initial = await readServiceSession(service, sessionId);
        const initialStepId = required(initial.current_step_id, `${code} initial step`);
        const initialStep = await service.from('learning_guided_steps').select('id,canonical_skill_id,step_type,lesson_id').eq('id', initialStepId).single();
        expect(initialStep.error).toBeNull();
        expect(initialStep.data?.step_type, `${code} V4 lesson`).toBe('LESSON');
        expect(initialStep.data?.lesson_id, `${code} real lesson`).toBeTruthy();
        const renderedLesson = await student.client.rpc('get_guided_learning_step_v4', { p_step_id: initialStepId });
        expect(renderedLesson.error, `${code} lesson RPC`).toBeNull();
        expect(renderedLesson.data?.lesson?.title, `${code} lesson title`).toBeTruthy();
        expect(renderedLesson.data?.lesson?.content_markdown, `${code} lesson content`).toBeTruthy();
        await completeCurrentStep(service, student, sessionId, `${suffix}:${code}:lesson`);
        const practice = await readServiceSession(service, sessionId);
        const practiceStep = await service.from('learning_guided_steps').select('id,canonical_skill_id,step_type').eq('id', practice.current_step_id).single();
        expect(practiceStep.error).toBeNull();
        expect(practiceStep.data?.step_type, `${code} practice`).toBe('PRACTICE');
        await completeCurrentStep(service, student, sessionId, `${suffix}:${code}:practice`);
        const evidence = await service.from('learning_skill_evidence').select('canonical_skill_id,metadata').eq('institution_id', institutionId).eq('student_id', studentRow.id).eq('canonical_skill_id', skillByCode.get(code));
        expect(evidence.error).toBeNull();
        expect(evidence.data?.some((item: any) => item.metadata?.engine_version === 'V4')).toBe(true);
      }
    } finally {
      if (institutionId) await service.from('institutions').delete().eq('id', institutionId);
      if (accountId) await service.from('accounts').delete().eq('id', accountId);
      for (const userId of userIds) {
        await service.from('profiles').delete().eq('id', userId);
        await service.auth.admin.deleteUser(userId);
      }
    }
  }, 240_000);
});
