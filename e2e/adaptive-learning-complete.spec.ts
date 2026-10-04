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
  const email = `adaptive-complete-${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${suffix}@local.test`;
  const password = 'AdaptiveE2E!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = required(data.user, `${name} auth user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: name, email, role, active: true });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ${name}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, password, client };
}

async function login(page: import('@playwright/test').Page, actor: Actor): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

adaptiveDescribe('adaptive learning completion journeys', () => {
  test('covers support, packages, daily plan, review and simulation recovery', async ({ browser }, testInfo) => {
    const service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = Date.now().toString(36);
    const userIds: string[] = [];
    let accountId: string | undefined;
    let institutionId: string | undefined;
    let studentId: string | undefined;
    let mariaStudentId: string | undefined;
    let classId: string | undefined;
    let termId: string | undefined;
    let subjectId: string | undefined;
    let skillId: string | undefined;
    let canonicalSkillId: string | undefined;
    let admin: Actor | undefined;
    let teacher: Actor | undefined;
    let alice: Actor | undefined;
    let maria: Actor | undefined;
    const pages: import('@playwright/test').Page[] = [];

    try {
      admin = await createActor(service, 'ADMIN', 'Admin Adaptive Complete', suffix);
      teacher = await createActor(service, 'TEACHER', 'Pedro Adaptive Complete', suffix);
      alice = await createActor(service, 'STUDENT', 'Alice Adaptive Complete', suffix);
      maria = await createActor(service, 'STUDENT', 'Maria Support Complete', suffix);
      userIds.push(admin.id, teacher.id, alice.id, maria.id);

      accountId = (await insertOne(service, 'accounts', {
        name: `Adaptive complete ${suffix}`,
        owner_profile_id: admin.id,
        institution_limit: 1,
        status: 'ACTIVE',
      })).id;
      institutionId = (await insertOne(service, 'institutions', {
        account_id: accountId,
        name: `TecEscola Adaptive Complete ${suffix}`,
        active: true,
      })).id;
      await insertOne(service, 'memberships', { profile_id: admin.id, institution_id: institutionId, role: 'ADMIN', active: true });
      await insertOne(service, 'memberships', { profile_id: teacher.id, institution_id: institutionId, role: 'TEACHER', active: true });
      await insertOne(service, 'memberships', { profile_id: alice.id, institution_id: institutionId, role: 'STUDENT', active: true });
      await insertOne(service, 'memberships', { profile_id: maria.id, institution_id: institutionId, role: 'STUDENT', active: true });

      const yearId = (await insertOne(service, 'academic_years', {
        institution_id: institutionId, name: `2026 Complete ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
      })).id;
      termId = (await insertOne(service, 'terms', {
        academic_year_id: yearId, name: `Bimestre Complete ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
      })).id;
      classId = (await insertOne(service, 'classes', {
        institution_id: institutionId, academic_year_id: yearId, name: `1º ano Complete ${suffix}`, grade_level: '1º ano', shift: 'INTEGRAL', active: true,
      })).id;
      subjectId = (await insertOne(service, 'subjects', {
        institution_id: institutionId, name: `Matemática Complete ${suffix}`, code: `ADAPTIVE-COMPLETE-${suffix}`, active: true,
      })).id;
      await insertOne(service, 'class_curriculum_items', { institution_id: institutionId, class_id: classId, subject_id: subjectId, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
      await insertOne(service, 'subject_offerings', { class_id: classId, subject_id: subjectId, teacher_profile_id: teacher.id, term_id: termId, active: true });

      studentId = (await insertOne(service, 'students', { institution_id: institutionId, profile_id: alice.id, registration_number: `COMPLETE-${suffix}`, active: true })).id;
      mariaStudentId = (await insertOne(service, 'students', { institution_id: institutionId, profile_id: maria.id, registration_number: `SUPPORT-COMPLETE-${suffix}`, active: true })).id;
      await insertOne(service, 'enrollments', { student_id: studentId, class_id: classId, academic_year_id: yearId, status: 'active', active: true });
      await insertOne(service, 'enrollments', { student_id: mariaStudentId, class_id: classId, academic_year_id: yearId, status: 'active', active: true });

      const canonical = await service.from('learning_curriculum_skills').select('id').eq('code', 'FRACTIONS').single();
      canonicalSkillId = required(canonical.data?.id, 'FRACTIONS canonical skill');
      const physicsSkill = await service.from('learning_curriculum_skills').select('id').eq('code', 'PHYSICS_AVERAGE_SPEED').single();
      const ratioSkill = await service.from('learning_curriculum_skills').select('id').eq('code', 'RATIO_PROPORTION').single();
      const speedTag = await service.from('learning_misconception_tags').select('id').eq('code', 'SPEED_UNIT_CONVERSION').single();
      expect(physicsSkill.error).toBeNull();
      expect(ratioSkill.error).toBeNull();
      expect(speedTag.error).toBeNull();
      const authoredPhysics = await service.from('learning_question_bank').select('id,statement,correct_answer').eq('source_type', 'TECESCOLA_CORE_V3').ilike('statement', 'Um carro percorre 120 km em 2 h%').single();
      expect(authoredPhysics.error).toBeNull();
      expect(authoredPhysics.data?.statement).toContain('120 km em 2 h');
      const physicsBridgeSignal = await service.from('learning_misconception_signals').insert({
        institution_id: institutionId,
        student_id: studentId,
        canonical_skill_id: ratioSkill.data.id,
        misconception_tag_id: speedTag.data.id,
        state: 'CONFIRMED',
        signal_count: 3,
        distinct_context_count: 2,
        confidence: 0.9,
        first_signal_at: '2026-09-01T00:00:00Z',
        last_signal_at: '2026-09-20T00:00:00Z',
      });
      expect(physicsBridgeSignal.error).toBeNull();
      const unitId = (await insertOne(service, 'learning_units', { institution_id: institutionId, subject_id: subjectId, title: `Frações ${suffix}`, active: true })).id;
      skillId = (await insertOne(service, 'learning_skills', { institution_id: institutionId, unit_id: unitId, title: `Frações ${suffix}`, active: true })).id;
      await insertOne(service, 'learning_skill_canonical_links', { institution_id: institutionId, learning_skill_id: skillId, canonical_skill_id: canonicalSkillId, active: true });

      for (const activityType of ['DIAGNOSTIC', 'PRACTICE', 'LOCK_IN']) {
        const activity = await insertOne(service, 'learning_activities', {
          institution_id: institutionId, subject_id: subjectId, unit_id: unitId, skill_id: skillId, teacher_id: teacher.id,
          title: `${activityType} Frações ${suffix}`, description: 'Atividade E2E', activity_type: activityType, status: 'PUBLISHED',
        });
        await insertOne(service, 'learning_questions', {
          institution_id: institutionId, activity_id: activity.id, question_text: `Quanto é 1/2 + 1/2? ${activityType}`, question_type: 'MULTIPLE_CHOICE',
          options_json: ['1', '2'], correct_answer_json: '1', explanation: 'Duas metades formam um inteiro.', points: 1, sort_order: 0,
        });
      }

      const aliceSession = await alice.client.rpc('start_guided_learning_session', { p_institution_id: institutionId, p_student_id: studentId, p_target_canonical_skill_id: canonicalSkillId });
      expect(aliceSession.error).toBeNull();
      const mariaSession = await maria.client.rpc('start_guided_learning_session', { p_institution_id: institutionId, p_student_id: mariaStudentId, p_target_canonical_skill_id: canonicalSkillId });
      expect(mariaSession.error).toBeNull();
      const physicsBridge = await alice.client.rpc('get_adaptive_v3_plan', {
        p_institution_id: institutionId,
        p_student_id: studentId,
        p_target_canonical_skill_id: physicsSkill.data.id,
      });
      expect(physicsBridge.error).toBeNull();
      expect(physicsBridge.data).toMatchObject({
        decision: 'CROSS_SUBJECT_BRIDGE',
        reason_code: 'PREREQUISITE_CONFIRMED_GAP',
        original_target_skill: 'PHYSICS_AVERAGE_SPEED',
        current_skill: 'RATIO_PROPORTION',
      });

      const alicePlan = await alice.client.rpc('create_or_get_learning_daily_plan', { p_institution_id: institutionId, p_student_id: studentId, p_plan_date: '2026-09-29' });
      const alicePlanAgain = await alice.client.rpc('create_or_get_learning_daily_plan', { p_institution_id: institutionId, p_student_id: studentId, p_plan_date: '2026-09-29' });
      expect(alicePlan.error).toBeNull();
      expect(alicePlanAgain.data).toBe(alicePlan.data);
      const planItem = await service.from('learning_daily_plan_items').select('id').eq('plan_id', alicePlan.data).order('position').limit(1).single();
      expect(planItem.error).toBeNull();
      const planCompleted = await alice.client.rpc('complete_learning_daily_plan_item', { p_item_id: planItem.data.id, p_status: 'COMPLETED' });
      const planRetried = await alice.client.rpc('complete_learning_daily_plan_item', { p_item_id: planItem.data.id, p_status: 'COMPLETED' });
      expect(planCompleted.data?.idempotent).toBe(false);
      expect(planRetried.data?.idempotent).toBe(true);

      const review = await insertOne(service, 'learning_skill_reviews', {
        institution_id: institutionId, student_id: studentId, canonical_skill_id: canonicalSkillId, source: 'REVIEW', interval_days: 1, review_due_at: '2026-09-28T00:00:00Z',
      });
      const reviewCompleted = await alice.client.rpc('complete_learning_skill_review', { p_review_id: review.id, p_score: 90 });
      const reviewRetried = await alice.client.rpc('complete_learning_skill_review', { p_review_id: review.id, p_score: 90 });
      expect(reviewCompleted.error?.message).toContain('LEARNING_REVIEW_REQUIRES_REAL_QUESTIONS');
      expect(reviewRetried.error?.message).toContain('LEARNING_REVIEW_REQUIRES_REAL_QUESTIONS');

      const mariaLockIn = await service.from('learning_guided_steps').select('id').eq('session_id', mariaSession.data.session_id).eq('step_type', 'LOCK_IN').single();
      expect(mariaLockIn.error).toBeNull();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await maria.client.rpc('complete_guided_learning_step', {
          p_step_id: mariaLockIn.data.id,
          p_status: 'COMPLETED',
          p_metadata: { mastery_confirmed: false },
        });
        expect(result.error).toBeNull();
      }
      const mariaSupport = await service.from('learning_guided_sessions').select('status').eq('id', mariaSession.data.session_id).single();
      expect(mariaSupport.data?.status).toBe('NEEDS_TEACHER_SUPPORT');

      const starterPackage = await service.from('learning_packages').select('id').eq('title', 'Fundamentos de Frações').eq('visibility', 'GLOBAL').single();
      expect(starterPackage.error).toBeNull();

      const teacherPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      pages.push(teacherPage);
      await login(teacherPage, teacher);
      await teacherPage.goto('/dashboard');
      await expect(teacherPage.getByRole('link', { name: 'Desempenho', exact: true })).toBeVisible({ timeout: 30_000 });
      await teacherPage.getByRole('link', { name: 'Desempenho', exact: true }).click();
      await expect(teacherPage).toHaveURL(/\/teacher\/pedagogical-center$/, { timeout: 30_000 });
      await expect(teacherPage.getByRole('heading', { name: 'Desempenho', exact: true })).toBeVisible({ timeout: 30_000 });
      await teacherPage.getByLabel('Turma selecionada').selectOption(classId);
      await expect(teacherPage.getByRole('region', { name: 'Dificuldades da turma' })).toBeVisible({ timeout: 30_000 });
      await teacherPage.screenshot({ path: testInfo.outputPath('visual/teacher-class-desktop.png'), fullPage: true });
      await teacherPage.goto(`/teacher/pedagogical-center/students/${studentId}`);
      await expect(teacherPage.getByRole('heading', { name: 'Alice Adaptive Complete', exact: true })).toBeVisible({ timeout: 30_000 });
      expect(await teacherPage.getByRole('button', { name: 'Atribuir ao aluno' }).count()).toBe(0);
      await teacherPage.screenshot({ path: testInfo.outputPath('visual/teacher-student-desktop.png'), fullPage: true });
      const assignment = await teacher.client.rpc('assign_learning_package', { p_institution_id: institutionId, p_package_id: starterPackage.data.id, p_student_id: studentId });
      expect(assignment.error).toBeNull();
      const assignmentRetry = await teacher.client.rpc('assign_learning_package', { p_institution_id: institutionId, p_package_id: starterPackage.data.id, p_student_id: studentId });
      expect(assignmentRetry.data).toBe(assignment.data);

      const mariaPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      pages.push(mariaPage);
      await login(mariaPage, maria);
      await mariaPage.goto('/student/study');
      await expect(mariaPage.getByRole('heading', { name: 'O que você quer estudar?' })).toBeVisible({ timeout: 30_000 });
      expect(await mariaPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await mariaPage.screenshot({ path: testInfo.outputPath('visual/student-home-mobile.png'), fullPage: true });

      await teacherPage.goto(`/teacher/pedagogical-center/students/${mariaStudentId}`);
      await expect(teacherPage.getByText('Desempenho do aluno', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(teacherPage.getByRole('region', { name: 'Desempenho por matéria' })).toBeVisible({ timeout: 30_000 });

      const alicePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      pages.push(alicePage);
      await login(alicePage, alice);
      await alicePage.goto('/student/study');
      await expect(alicePage.getByRole('heading', { name: 'O que você quer estudar?' })).toBeVisible({ timeout: 30_000 });
      expect(await alicePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await alicePage.screenshot({ path: testInfo.outputPath('visual/student-home-mobile-alice.png'), fullPage: true });
      await alicePage.setViewportSize({ width: 1440, height: 900 });
      await alicePage.goto('/student/study');
      await expect(alicePage.getByRole('heading', { name: 'O que você quer estudar?' })).toBeVisible({ timeout: 30_000 });
      await alicePage.screenshot({ path: testInfo.outputPath('visual/student-home-desktop.png'), fullPage: true });
      await alicePage.setViewportSize({ width: 390, height: 844 });
      await alicePage.goto('/student/study/guided');
      await expect(alicePage.getByText(/Sua jornada/).first()).toBeVisible({ timeout: 30_000 });
      await alicePage.screenshot({ path: testInfo.outputPath('visual/subject-session-mobile.png'), fullPage: true });
      await alicePage.setViewportSize({ width: 1440, height: 900 });
      await alicePage.reload();
      await expect(alicePage.getByText(/Sua jornada/).first()).toBeVisible({ timeout: 30_000 });
      await alicePage.screenshot({ path: testInfo.outputPath('visual/subject-session-desktop.png'), fullPage: true });

      const simulation = await service.from('learning_simulations').select('id,learning_simulation_questions(position,question_bank_id)').eq('title', 'Matemática · diagnóstico rápido').is('institution_id', null).single();
      expect(simulation.error).toBeNull();
      const simulationQuestions = [...(simulation.data.learning_simulation_questions ?? [])].sort((left: any, right: any) => left.position - right.position);
      const bankIds = simulationQuestions.map((question: any) => question.question_bank_id);
      const bankRows = await service.from('learning_question_bank').select('id,options,correct_answer').in('id', bankIds);
      expect(bankRows.error).toBeNull();
      const bankById = new Map(bankRows.data.map((row: any) => [row.id, row]));

      await alicePage.goto('/student/study/simulation');
      await expect(alicePage.getByRole('button', { name: 'Começar simulado' })).toBeVisible({ timeout: 30_000 });
      await alicePage.getByRole('button').filter({ hasText: 'Matemática · diagnóstico rápido' }).click();
      await expect(alicePage).toHaveURL(new RegExp(`simulation=${simulation.data.id}`));
      await alicePage.getByRole('button', { name: 'Começar simulado' }).click();
      const firstBank = bankById.get(simulationQuestions[0].question_bank_id);
      const firstOptions = firstBank.options as string[];
      const firstWrong = firstOptions.find((option) => option !== firstBank.correct_answer) ?? firstOptions[0];
      await alicePage.getByRole('radio', { name: firstWrong, exact: true }).check();
      await expect(alicePage.getByRole('status')).toContainText('Resposta salva.', { timeout: 30_000 });
      await alicePage.reload();
      await expect(alicePage.getByRole('radio', { name: firstWrong, exact: true })).toBeChecked({ timeout: 30_000 });

      for (let index = 0; index < simulationQuestions.length; index += 1) {
        const bank = bankById.get(simulationQuestions[index].question_bank_id);
        const options = bank.options as string[];
        const answer = index === 0 ? firstWrong : String(bank.correct_answer);
        await alicePage.getByRole('radio', { name: answer, exact: true }).check();
        if (index < simulationQuestions.length - 1) await alicePage.getByRole('button', { name: 'Próxima' }).click();
      }
      await alicePage.getByRole('button', { name: 'Revisar e finalizar' }).click();
      await alicePage.getByRole('button', { name: 'Finalizar simulado' }).click();
      await expect(alicePage.getByText('Simulado concluído')).toBeVisible({ timeout: 30_000 });
      const completedAttempt = await service.from('learning_simulation_attempts').select('id,score,status').eq('simulation_id', simulation.data.id).eq('student_id', studentId).single();
      expect(completedAttempt.data?.status).toBe('COMPLETED');
      expect(completedAttempt.data?.score).toBeLessThan(100);
      const simulationError = await service.from('learning_error_notebook').select('id').eq('student_id', studentId).eq('question_bank_id', simulationQuestions[0].question_bank_id).single();
      expect(simulationError.error).toBeNull();
      const simulationEvidence = await service.from('learning_skill_evidence').select('id').eq('student_id', studentId).eq('source', 'SIMULATION');
      expect(simulationEvidence.data?.length).toBeGreaterThan(0);
      const simulationXp = await service.from('learning_gamification_events').select('event_key').eq('student_id', studentId).eq('event_type', 'SIMULATION');
      expect(simulationXp.data?.length).toBe(1);
    } finally {
      for (const page of pages) await page.close();
      if (institutionId) await service.from('institutions').delete().eq('id', institutionId);
      if (accountId) await service.from('accounts').delete().eq('id', accountId);
      if (userIds.length) await service.from('profiles').delete().in('id', userIds);
      for (const userId of userIds) await service.auth.admin.deleteUser(userId);
    }
  }, 240_000);
});
