import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; password: string; client: Db };

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
  const email = `adaptive-v2-${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${suffix}@local.test`;
  const password = 'AdaptiveV2E2E!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = required(data.user, `${name} auth user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: name, email, role, active: true });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ${name}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, password, client };
}

async function submitCurrentStep(service: Db, student: Actor, sessionId: string, suffix: string): Promise<any> {
  const session = await service.from('learning_guided_sessions').select('current_step_id').eq('id', sessionId).single();
  const stepId = required(session.data?.current_step_id, 'current V2 step');
  const step = await service.from('learning_guided_steps').select('id,step_type,purpose,question_set_id').eq('id', stepId).single();
  if (step.error || !step.data) throw new Error(`step lookup: ${step.error?.message ?? 'missing'}`);
  const items = await service.from('learning_question_set_items').select('question_bank_id').eq('question_set_id', step.data.question_set_id).order('position');
  if (items.error) throw new Error(`question items: ${items.error.message}`);
  const questionIds = items.data.map((item: any) => item.question_bank_id);
  const banks = await service.from('learning_question_bank').select('id,correct_answer').in('id', questionIds);
  if (banks.error) throw new Error(`question bank: ${banks.error.message}`);
  const byId = new Map(banks.data.map((row: any) => [row.id, row.correct_answer]));
  const answers = questionIds.map((questionId: string) => ({ question_bank_id: questionId, answer: String(byId.get(questionId)) }));
  const result = await student.client.rpc('submit_guided_learning_step_v2', {
    p_step_id: stepId,
    p_answers: answers,
    p_idempotency_key: `v2-e2e:${suffix}:${stepId}`,
  });
  expect(result.error).toBeNull();
  return { step: step.data, result: result.data };
}

async function login(page: import('@playwright/test').Page, actor: Actor): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

adaptiveDescribe('adaptive learning V2 guided journey', () => {
  test('runs prerequisite recovery, real review questions, second subject and daily plan', async ({ browser }) => {
    const service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = Date.now().toString(36);
    const userIds: string[] = [];
    let accountId: string | undefined;
    let institutionId: string | undefined;
    const pages: import('@playwright/test').Page[] = [];

    try {
      const admin = await createActor(service, 'ADMIN', 'Admin Adaptive V2', suffix);
      const teacher = await createActor(service, 'TEACHER', 'Professor Adaptive V2', suffix);
      const student = await createActor(service, 'STUDENT', 'Alice Adaptive V2', suffix);
      userIds.push(admin.id, teacher.id, student.id);

      accountId = (await insertOne(service, 'accounts', { name: `Adaptive V2 ${suffix}`, owner_profile_id: admin.id, institution_limit: 1, status: 'ACTIVE' })).id;
      institutionId = (await insertOne(service, 'institutions', { account_id: accountId, name: `TecEscola Adaptive V2 ${suffix}`, active: true })).id;
      for (const actor of [admin, teacher, student]) await insertOne(service, 'memberships', { profile_id: actor.id, institution_id: institutionId, role: actor === admin ? 'ADMIN' : actor === teacher ? 'TEACHER' : 'STUDENT', active: true });
      const year = await insertOne(service, 'academic_years', { institution_id: institutionId, name: `2026 V2 ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true });
      const term = await insertOne(service, 'terms', { academic_year_id: year.id, name: `V2 Term ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true });
      const schoolClass = await insertOne(service, 'classes', { institution_id: institutionId, academic_year_id: year.id, name: `1º ano V2 ${suffix}`, grade_level: '1º ano', shift: 'INTEGRAL', active: true });
      const math = await insertOne(service, 'subjects', { institution_id: institutionId, name: `Matemática V2 ${suffix}`, code: `V2-MATH-${suffix}`, active: true });
      await insertOne(service, 'class_curriculum_items', { institution_id: institutionId, class_id: schoolClass.id, subject_id: math.id, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
      await insertOne(service, 'subject_offerings', { class_id: schoolClass.id, subject_id: math.id, teacher_profile_id: teacher.id, term_id: term.id, active: true });
      const studentRow = await insertOne(service, 'students', { institution_id: institutionId, profile_id: student.id, registration_number: `V2-${suffix}`, active: true });
      await insertOne(service, 'enrollments', { student_id: studentRow.id, class_id: schoolClass.id, academic_year_id: year.id, status: 'active', active: true });

      const canonical = await service.from('learning_curriculum_skills').select('id,code').in('code', ['EQUATIONS', 'LINEAR_FUNCTION', 'READING_ARGUMENT', 'READING_INFERENCE']).eq('active', true);
      if (canonical.error) throw canonical.error;
      const skillByCode = new Map(canonical.data.map((row: any) => [row.code, row.id]));
      const equationsId = required(skillByCode.get('EQUATIONS'), 'EQUATIONS skill');
      const linearId = required(skillByCode.get('LINEAR_FUNCTION'), 'LINEAR_FUNCTION skill');
      const prerequisite = await service.from('learning_skill_prerequisites').select('skill_id,prerequisite_skill_id').eq('skill_id', linearId).eq('prerequisite_skill_id', equationsId).single();
      expect(prerequisite.error).toBeNull();

      const mathUnit = await insertOne(service, 'learning_units', { institution_id: institutionId, subject_id: math.id, title: `Álgebra V2 ${suffix}`, active: true });
      const mathSkill = await insertOne(service, 'learning_skills', { institution_id: institutionId, unit_id: mathUnit.id, title: `Função afim V2 ${suffix}`, active: true });
      await insertOne(service, 'learning_skill_canonical_links', { institution_id: institutionId, learning_skill_id: mathSkill.id, canonical_skill_id: linearId, active: true });

      const started = await student.client.rpc('start_guided_learning_session_v2', { p_institution_id: institutionId, p_student_id: studentRow.id, p_target_canonical_skill_id: linearId });
      expect(started.error).toBeNull();
      const sessionId = required(started.data?.session_id, 'V2 session');
      const session = await student.client.rpc('get_guided_learning_session_v2', { p_institution_id: institutionId, p_student_id: studentRow.id });
      expect(session.error).toBeNull();
      expect(session.data.original_target_canonical_skill_id).toBe(linearId);
      expect(session.data.current_canonical_skill_id).toBe(equationsId);

      const teacherInsights = await teacher.client.rpc('get_teacher_guided_learning_insights_v2', { p_institution_id: institutionId });
      expect(teacherInsights.error).toBeNull();
      expect(teacherInsights.data?.some((item: any) => item.session_id === sessionId)).toBe(true);
      const teacherResume = await teacher.client.rpc('resolve_teacher_guided_learning_session_v2', {
        p_session_id: sessionId,
        p_action: 'RESUME',
        p_target_canonical_skill_id: null,
      });
      expect(teacherResume.error).toBeNull();
      const studentTeacherAction = await student.client.rpc('resolve_teacher_guided_learning_session_v2', {
        p_session_id: sessionId,
        p_action: 'RESUME',
        p_target_canonical_skill_id: null,
      });
      expect(studentTeacherAction.error?.message).toContain('LEARNING_TEACHER_SCOPE_DENIED');

      const firstStep = await student.client.rpc('get_guided_learning_step_v2', { p_step_id: session.data.current_step_id });
      expect(firstStep.error).toBeNull();
      expect(firstStep.data.questions[0]).not.toHaveProperty('correct_answer');
      expect(firstStep.data.questions[0]).not.toHaveProperty('explanation');

      const evidenceSources: string[] = [];
      for (let index = 0; index < 4; index += 1) {
        const submitted = await submitCurrentStep(service, student, sessionId, suffix);
        evidenceSources.push(submitted.step.purpose === 'PROBE' ? 'DIAGNOSTIC' : submitted.step.purpose);
      }
      expect(evidenceSources).toEqual(['DIAGNOSTIC', 'PRACTICE', 'TRANSFER', 'LOCK_IN']);
      const equationsEvidence = await service.from('learning_skill_evidence').select('source').eq('institution_id', institutionId).eq('student_id', studentRow.id).eq('canonical_skill_id', equationsId).order('recorded_at');
      expect(equationsEvidence.data?.map((row: any) => row.source)).toEqual(evidenceSources);
      const afterPrerequisite = await service.from('learning_guided_sessions').select('current_canonical_skill_id,current_step_id').eq('id', sessionId).single();
      expect(afterPrerequisite.data?.current_canonical_skill_id).toBe(linearId);
      const returned = await student.client.rpc('advance_guided_learning_session_v2', {
        p_session_id: sessionId,
        p_step_id: afterPrerequisite.data?.current_step_id,
        p_action: 'TARGET_RETURNED',
        p_idempotency_key: `v2-e2e:return:${suffix}`,
      });
      expect(returned.error).toBeNull();

      const reviewPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      pages.push(reviewPage);
      await login(reviewPage, student);
      await reviewPage.goto('/student/study/guided');
      await expect(reviewPage.getByRole('heading', { name: /Vamos praticar|Voltar ao objetivo/i })).toBeVisible({ timeout: 30_000 });
      expect(await reviewPage.getByText(/resposta correta:/i).count()).toBe(0);
      const radios = reviewPage.locator('input[type="radio"]');
      const radioCount = await radios.count();
      expect(radioCount).toBeGreaterThan(0);
      for (let index = 0; index < radioCount; index += 1) await radios.nth(index).check();
      await reviewPage.getByRole('button', { name: 'Enviar respostas' }).click();
      await expect(reviewPage.getByText('Evidência registrada')).toBeVisible({ timeout: 30_000 });

      const secondSubjects = [
        { code: 'READING_ARGUMENT', name: `Leitura V2 ${suffix}` },
        { code: 'READING_INFERENCE', name: `Inferência V2 ${suffix}` },
      ];
      for (const subjectDraft of secondSubjects) {
        const subject = await insertOne(service, 'subjects', { institution_id: institutionId, name: subjectDraft.name, code: `V2-${subjectDraft.code}-${suffix}`, active: true });
        await insertOne(service, 'class_curriculum_items', { institution_id: institutionId, class_id: schoolClass.id, subject_id: subject.id, weekly_lessons: 1, lesson_duration_minutes: 50, active: true });
        await insertOne(service, 'subject_offerings', { class_id: schoolClass.id, subject_id: subject.id, teacher_profile_id: teacher.id, term_id: term.id, active: true });
        const unit = await insertOne(service, 'learning_units', { institution_id: institutionId, subject_id: subject.id, title: `${subjectDraft.code} V2`, active: true });
        const skill = await insertOne(service, 'learning_skills', { institution_id: institutionId, unit_id: unit.id, title: `${subjectDraft.code} V2`, active: true });
        await insertOne(service, 'learning_skill_canonical_links', { institution_id: institutionId, learning_skill_id: skill.id, canonical_skill_id: required(skillByCode.get(subjectDraft.code), `${subjectDraft.code} skill`), active: true });
        const startedSubject = await student.client.rpc('start_guided_learning_session_v2', { p_institution_id: institutionId, p_student_id: studentRow.id, p_target_canonical_skill_id: required(skillByCode.get(subjectDraft.code), `${subjectDraft.code} skill`) });
        expect(startedSubject.error).toBeNull();
      }

      const foreignAdmin = await createActor(service, 'ADMIN', 'Admin Adaptive V2 Foreign', `${suffix}-foreign`);
      const foreignTeacher = await createActor(service, 'TEACHER', 'Professor Adaptive V2 Foreign', `${suffix}-foreign`);
      const foreignStudent = await createActor(service, 'STUDENT', 'Alice Adaptive V2 Foreign', `${suffix}-foreign`);
      userIds.push(foreignAdmin.id, foreignTeacher.id, foreignStudent.id);
      const foreignAccount = await insertOne(service, 'accounts', { name: `Adaptive V2 Foreign ${suffix}`, owner_profile_id: foreignAdmin.id, institution_limit: 1, status: 'ACTIVE' });
      const foreignInstitution = await insertOne(service, 'institutions', { account_id: foreignAccount.id, name: `TecEscola Adaptive V2 Foreign ${suffix}`, active: true });
      const foreignInstitutionId = foreignInstitution.id as string;
      for (const [actor, role] of [[foreignAdmin, 'ADMIN'], [foreignTeacher, 'TEACHER'], [foreignStudent, 'STUDENT']] as const) {
        await insertOne(service, 'memberships', { profile_id: actor.id, institution_id: foreignInstitutionId, role, active: true });
      }
      const foreignYear = await insertOne(service, 'academic_years', { institution_id: foreignInstitutionId, name: `2026 V2 Foreign ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true });
      const foreignTerm = await insertOne(service, 'terms', { academic_year_id: foreignYear.id, name: `V2 Foreign Term ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true });
      const foreignClass = await insertOne(service, 'classes', { institution_id: foreignInstitutionId, academic_year_id: foreignYear.id, name: `1º ano V2 Foreign ${suffix}`, grade_level: '1º ano', shift: 'INTEGRAL', active: true });
      const foreignSubject = await insertOne(service, 'subjects', { institution_id: foreignInstitutionId, name: `Matemática V2 Foreign ${suffix}`, code: `V2-MATH-FOREIGN-${suffix}`, active: true });
      await insertOne(service, 'class_curriculum_items', { institution_id: foreignInstitutionId, class_id: foreignClass.id, subject_id: foreignSubject.id, weekly_lessons: 1, lesson_duration_minutes: 50, active: true });
      await insertOne(service, 'subject_offerings', { class_id: foreignClass.id, subject_id: foreignSubject.id, teacher_profile_id: foreignTeacher.id, term_id: foreignTerm.id, active: true });
      const foreignStudentRow = await insertOne(service, 'students', { institution_id: foreignInstitutionId, profile_id: foreignStudent.id, registration_number: `V2-FOREIGN-${suffix}`, active: true });
      await insertOne(service, 'enrollments', { student_id: foreignStudentRow.id, class_id: foreignClass.id, academic_year_id: foreignYear.id, status: 'active', active: true });
      const foreignUnit = await insertOne(service, 'learning_units', { institution_id: foreignInstitutionId, subject_id: foreignSubject.id, title: `Álgebra V2 Foreign ${suffix}`, active: true });
      const foreignSkill = await insertOne(service, 'learning_skills', { institution_id: foreignInstitutionId, unit_id: foreignUnit.id, title: `Equações V2 Foreign ${suffix}`, active: true });
      await insertOne(service, 'learning_skill_canonical_links', { institution_id: foreignInstitutionId, learning_skill_id: foreignSkill.id, canonical_skill_id: equationsId, active: true });
      const foreignStarted = await foreignStudent.client.rpc('start_guided_learning_session_v2', { p_institution_id: foreignInstitutionId, p_student_id: foreignStudentRow.id, p_target_canonical_skill_id: equationsId });
      expect(foreignStarted.error).toBeNull();
      const foreignSessionId = required(foreignStarted.data?.session_id, 'foreign V2 session');
      const foreignStep = await service.from('learning_guided_sessions').select('current_step_id').eq('id', foreignSessionId).single();
      const foreignStepId = required(foreignStep.data?.current_step_id, 'foreign V2 step');
      const crossTenantGet = await student.client.rpc('get_guided_learning_session_v2', { p_institution_id: foreignInstitutionId, p_student_id: foreignStudentRow.id });
      expect(crossTenantGet.error?.message).toContain('LEARNING_STUDENT_SCOPE_DENIED');
      const crossTenantSubmit = await student.client.rpc('submit_guided_learning_step_v2', { p_step_id: foreignStepId, p_answers: [], p_idempotency_key: `v2-e2e:cross-tenant:${suffix}` });
      expect(crossTenantSubmit.error?.message).toContain('LEARNING_STEP_SCOPE_DENIED');
      const crossTenantTeacher = await teacher.client.rpc('resolve_teacher_guided_learning_session_v2', { p_session_id: foreignSessionId, p_action: 'RESUME', p_target_canonical_skill_id: null });
      expect(crossTenantTeacher.error?.message).toContain('LEARNING_TEACHER_SCOPE_DENIED');
      const plan = await student.client.rpc('create_or_get_learning_daily_plan', { p_institution_id: institutionId, p_student_id: studentRow.id, p_plan_date: '2026-09-30' });
      expect(plan.error).toBeNull();
      const planItems = await service.from('learning_daily_plan_items').select('session_id').eq('plan_id', plan.data).not('session_id', 'is', null);
      expect(new Set(planItems.data?.map((row: any) => row.session_id)).size).toBeGreaterThanOrEqual(2);

      const review = await insertOne(service, 'learning_skill_reviews', { institution_id: institutionId, student_id: studentRow.id, canonical_skill_id: linearId, source: 'REVIEW', interval_days: 1, review_due_at: '2026-09-29T00:00:00Z' });
      const legacyReview = await student.client.rpc('complete_learning_skill_review', { p_review_id: review.id, p_score: 100 });
      expect(legacyReview.error?.message).toContain('LEARNING_REVIEW_REQUIRES_REAL_QUESTIONS');
    } finally {
      for (const page of pages) await page.close();
      if (institutionId) await service.from('institutions').delete().eq('id', institutionId);
      if (accountId) await service.from('accounts').delete().eq('id', accountId);
      const foreignInstitutions = await service.from('institutions').select('id').like('name', 'TecEscola Adaptive V2 Foreign %');
      if (foreignInstitutions.data?.length) await service.from('institutions').delete().in('id', foreignInstitutions.data.map((row: any) => row.id));
      const foreignAccounts = await service.from('accounts').select('id').like('name', 'Adaptive V2 Foreign %');
      if (foreignAccounts.data?.length) await service.from('accounts').delete().in('id', foreignAccounts.data.map((row: any) => row.id));
      for (const userId of userIds) {
        await service.from('profiles').delete().eq('id', userId);
        await service.auth.admin.deleteUser(userId);
      }
    }
  }, 240_000);
});
