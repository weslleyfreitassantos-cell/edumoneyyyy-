import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; password: string; client: Db };
type ExerciseRow = Record<string, any> & { id: string; position: number; exercise_type: string; accepted_answers: string[]; answer_key: Record<string, any> };

const url = process.env.E2E_SUPABASE_URL ?? process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
if (process.env.CI && (!url || !anonKey || !serviceRoleKey)) {
  throw new Error('O Playwright do Tec Inglês exige as credenciais locais do Supabase descartável da CI.');
}
const englishDescribe = url && anonKey && serviceRoleKey ? test.describe : test.describe.skip;
const TEST_COURSE_CODE = 'TEC_ENGLISH_FOUNDATIONS_TEST';

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(db: Db, table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await db.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(service: Db, name: string, suffix: string, testMode = false, role = 'STUDENT'): Promise<Actor> {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  const email = `tec-english-${slug}-${suffix}@local.test`;
  const password = 'TecEnglishE2E!2026';
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: testMode ? { tec_english_test_mode: true } : {},
  });
  if (error) throw error;
  const user = required(data.user, `${name} auth user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: name, email, role, active: true });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const auth = await client.auth.signInWithPassword({ email, password });
  if (auth.error || !auth.data.session) throw new Error(`sign in ${name}: ${auth.error?.message ?? 'no session'}`);
  return { id: user.id, email, password, client };
}

async function cloneCourseForDisposableTest(service: Db, suffix: string): Promise<{ lessonId: string; exercises: ExerciseRow[] }> {
  const { data: source, error: sourceError } = await service.from('tec_english_courses').select('*').eq('course_code', 'TEC_ENGLISH_FOUNDATIONS').single();
  if (sourceError || !source) throw new Error(`source course: ${sourceError?.message ?? 'not found'}`);

  // The CI database is disposable. Remove only this fixed test fixture if an earlier local run was interrupted.
  const removed = await service.from('tec_english_courses').delete().eq('course_code', TEST_COURSE_CODE);
  if (removed.error) throw new Error(`clear disposable English fixture: ${removed.error.message}`);

  const { created_at: _courseCreated, updated_at: _courseUpdated, ...course } = source;
  const insertedCourse = await service.from('tec_english_courses').insert({ ...course, course_code: TEST_COURSE_CODE, is_test_fixture: true });
  if (insertedCourse.error) throw new Error(`test course: ${insertedCourse.error.message}`);

  const { data: sourceUnits, error: unitsError } = await service.from('tec_english_units').select('*').eq('course_code', source.course_code).order('position');
  if (unitsError || !sourceUnits) throw new Error(`source units: ${unitsError?.message ?? 'not found'}`);
  const unitIds = new Map<string, string>();
  for (const unit of sourceUnits) {
    const id = `${suffix}-${unit.id}`;
    unitIds.set(unit.id, id);
    const { created_at: _createdAt, ...unitRow } = unit;
    const inserted = await service.from('tec_english_units').insert({ ...unitRow, id, course_code: TEST_COURSE_CODE });
    if (inserted.error) throw new Error(`test unit: ${inserted.error.message}`);
  }

  const sourceUnitIds = sourceUnits.map((unit) => unit.id);
  const { data: sourceLessons, error: lessonsError } = await service.from('tec_english_lessons').select('*').in('unit_id', sourceUnitIds).order('position');
  if (lessonsError || !sourceLessons) throw new Error(`source lessons: ${lessonsError?.message ?? 'not found'}`);
  const lessonIds = new Map<string, string>();
  for (const lesson of sourceLessons) {
    const id = `${suffix}-${lesson.id}`;
    lessonIds.set(lesson.id, id);
    const { created_at: _createdAt, ...lessonRow } = lesson;
    const inserted = await service.from('tec_english_lessons').insert({ ...lessonRow, id, unit_id: required(unitIds.get(lesson.unit_id), 'test unit id') });
    if (inserted.error) throw new Error(`test lesson: ${inserted.error.message}`);
  }

  const { data: sourceExercises, error: exercisesError } = await service.from('tec_english_exercises').select('*').in('lesson_id', sourceLessons.map((lesson) => lesson.id)).order('position');
  if (exercisesError || !sourceExercises) throw new Error(`source exercises: ${exercisesError?.message ?? 'not found'}`);
  for (const exercise of sourceExercises) {
    const { created_at: _createdAt, ...exerciseRow } = exercise;
    const inserted = await service.from('tec_english_exercises').insert({
      ...exerciseRow,
      id: `${suffix}-${exercise.id}`,
      lesson_id: required(lessonIds.get(exercise.lesson_id), 'test lesson id'),
    });
    if (inserted.error) throw new Error(`test exercise: ${inserted.error.message}`);
  }

  const firstSourceLesson = sourceLessons.find((lesson) => lesson.unit_id === sourceUnits[0].id && lesson.position === 1);
  const firstFixtureLessonId = required(firstSourceLesson && lessonIds.get(firstSourceLesson.id), 'first fixture lesson');
  const { data: exercises, error } = await service.from('tec_english_exercises').select('*').eq('lesson_id', firstFixtureLessonId).order('position');
  if (error || !exercises) throw new Error(`fixture exercise rows: ${error?.message ?? 'not found'}`);
  return { lessonId: firstFixtureLessonId, exercises: exercises as ExerciseRow[] };
}

function responseFor(exercise: ExerciseRow): Record<string, unknown> {
  if (exercise.exercise_type === 'MULTIPLE_CHOICE' || exercise.exercise_type === 'FILL_BLANK') return { choice: exercise.accepted_answers[0] };
  if (exercise.exercise_type === 'WORD_ORDER') return { tokens: exercise.accepted_answers[0].split(' ') };
  if (exercise.exercise_type === 'MATCHING') return { pairs: exercise.answer_key.pairs };
  return { text: exercise.accepted_answers[0] };
}

async function submitRpc(actor: Actor, institutionId: string, sessionId: string, exercise: ExerciseRow, key = crypto.randomUUID()) {
  return actor.client.rpc('submit_tec_english_answer_v1', {
    p_institution_id: institutionId,
    p_session_id: sessionId,
    p_exercise_id: exercise.id,
    p_response: responseFor(exercise),
    p_idempotency_key: key,
  });
}

async function answerInUi(page: Page, exercise: ExerciseRow): Promise<void> {
  if (exercise.exercise_type === 'MULTIPLE_CHOICE' || exercise.exercise_type === 'FILL_BLANK') {
    const answer = exercise.accepted_answers[0];
    await page.getByRole('button', { name: new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
  } else if (exercise.exercise_type === 'WORD_ORDER') {
    const availableWords = page.locator('[aria-label="Palavras disponíveis"]');
    for (const token of exercise.accepted_answers[0].split(' ')) await availableWords.getByRole('button', { name: token, exact: true }).click();
  } else if (exercise.exercise_type === 'MATCHING') {
    for (const [left, right] of Object.entries(exercise.answer_key.pairs as Record<string, string>)) {
      await page.getByLabel(`Significado para ${left}`).selectOption(right);
    }
  } else {
    const label = exercise.exercise_type === 'LISTENING' ? 'O que você ouviu?' : exercise.exercise_type === 'SPEAKING' ? 'Sua frase em inglês' : 'Sua tradução';
    if (exercise.exercise_type === 'LISTENING') {
      await page.getByRole('button', { name: 'Ouvir novamente' }).click();
      await page.getByLabel('Velocidade do áudio').selectOption('0.75');
    }
    await page.getByRole('textbox', { name: label, exact: true }).fill(exercise.accepted_answers[0]);
  }

  await page.getByRole('button', { name: 'Conferir resposta' }).click();
  await expect(page.getByText('Muito bem! Você acertou.')).toBeVisible();
  if (exercise.position < 7) await page.getByRole('button', { name: 'Próximo desafio' }).click();
  else await page.getByRole('button', { name: 'Ver resultado' }).click();
}

async function login(page: Page, actor: Actor): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

englishDescribe('Tec Inglês interactive v1', () => {
  test('runs the interactive course, secure grading, English-only XP and persisted resume', async ({ browser }) => {
    test.setTimeout(240_000);
    const service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = Date.now().toString(36);
    const userIds: string[] = [];
    const institutionIds: string[] = [];
    const accountIds: string[] = [];
    const pages: Page[] = [];
    let fixtureCourseCode: string | undefined;

    try {
      const owner = await createActor(service, 'English Test Owner', suffix, false, 'ADMIN');
      const learner = await createActor(service, 'English Learner', suffix, true);
      const probe = await createActor(service, 'English Security Probe', suffix, true);
      const regularLearner = await createActor(service, 'English Regular Learner', suffix);
      const unlinked = await createActor(service, 'English Unlinked Learner', suffix);
      const otherTenant = await createActor(service, 'English Other Tenant Learner', suffix);
      userIds.push(owner.id, learner.id, probe.id, regularLearner.id, unlinked.id, otherTenant.id);

      const account = await insertOne(service, 'accounts', { name: `Tec English E2E ${suffix}`, owner_profile_id: owner.id, institution_limit: 1, status: 'ACTIVE' });
      accountIds.push(account.id);
      const institution = await insertOne(service, 'institutions', { account_id: account.id, name: `Tec English Test ${suffix}`, active: true });
      institutionIds.push(institution.id);
      const secondAccount = await insertOne(service, 'accounts', { name: `Tec English Other E2E ${suffix}`, owner_profile_id: otherTenant.id, institution_limit: 1, status: 'ACTIVE' });
      accountIds.push(secondAccount.id);
      const secondInstitution = await insertOne(service, 'institutions', { account_id: secondAccount.id, name: `Tec English Other Tenant ${suffix}`, active: true });
      institutionIds.push(secondInstitution.id);

      for (const actor of [owner, learner, probe, regularLearner, unlinked]) {
        await insertOne(service, 'memberships', { profile_id: actor.id, institution_id: institution.id, role: actor === owner ? 'ADMIN' : 'STUDENT', active: true });
      }
      await insertOne(service, 'memberships', { profile_id: otherTenant.id, institution_id: secondInstitution.id, role: 'STUDENT', active: true });
      const studentIds = new Map<string, string>();
      for (const actor of [learner, probe, regularLearner, otherTenant]) {
        const student = await insertOne(service, 'students', { profile_id: actor.id, institution_id: actor === otherTenant ? secondInstitution.id : institution.id, registration_number: `ENG-${actor.id.slice(0, 12)}`, active: true });
        studentIds.set(actor.id, student.id);
      }

      fixtureCourseCode = TEST_COURSE_CODE;
      const fixture = await cloneCourseForDisposableTest(service, suffix);
      expect(fixture.exercises).toHaveLength(7);
      expect(new Set(fixture.exercises.map((exercise) => exercise.exercise_type))).toEqual(new Set(['MULTIPLE_CHOICE', 'WORD_ORDER', 'TRANSLATION', 'LISTENING', 'MATCHING', 'FILL_BLANK', 'SPEAKING']));

      const normalMap = await regularLearner.client.rpc('get_tec_english_map_v1', { p_institution_id: institution.id });
      expect(normalMap.error).toBeNull();
      expect(normalMap.data.course.code).toBe('TEC_ENGLISH_FOUNDATIONS');
      expect(normalMap.data.units[0].lessons[0].status).toBe('REVIEW_PENDING');
      expect(JSON.stringify(normalMap.data)).not.toContain('answer_key');
      const normalStart = await regularLearner.client.rpc('start_tec_english_lesson_v1', { p_institution_id: institution.id, p_lesson_id: 'english-v1-u1-l1' });
      expect(normalStart.error?.message).toContain('TEC_ENGLISH_CONTENT_NOT_APPROVED');
      const fixtureStartDenied = await regularLearner.client.rpc('start_tec_english_lesson_v1', { p_institution_id: institution.id, p_lesson_id: fixture.lessonId });
      expect(fixtureStartDenied.error?.message).toContain('TEC_ENGLISH_CONTENT_NOT_APPROVED');

      const unlinkedMap = await unlinked.client.rpc('get_tec_english_map_v1', { p_institution_id: institution.id });
      expect(unlinkedMap.error?.message).toContain('TEC_ENGLISH_STUDENT_SCOPE_DENIED');
      const crossTenantMap = await otherTenant.client.rpc('get_tec_english_map_v1', { p_institution_id: institution.id });
      expect(crossTenantMap.error?.message).toContain('TEC_ENGLISH_STUDENT_SCOPE_DENIED');

      const fixtureMap = await probe.client.rpc('get_tec_english_map_v1', { p_institution_id: institution.id });
      expect(fixtureMap.error).toBeNull();
      expect(fixtureMap.data.course.code).toBe(TEST_COURSE_CODE);
      expect(fixtureMap.data.units).toHaveLength(3);
      expect(fixtureMap.data.units.every((unit: any) => unit.lessons.length === 4)).toBe(true);
      expect(fixtureMap.data.units[0].lessons[0].status).toBe('AVAILABLE');

      const directAnswerRead = await probe.client.from('tec_english_exercises').select('answer_key').eq('id', fixture.exercises[0].id).maybeSingle();
      expect(directAnswerRead.error).not.toBeNull();
      const probeSessionResult = await probe.client.rpc('start_tec_english_lesson_v1', { p_institution_id: institution.id, p_lesson_id: fixture.lessonId });
      expect(probeSessionResult.error).toBeNull();
      const probeSession = required(probeSessionResult.data, 'probe session');
      expect(probeSession.exercise).not.toHaveProperty('answer_key');

      const invalidResponse = await probe.client.rpc('submit_tec_english_answer_v1', {
        p_institution_id: institution.id,
        p_session_id: probeSession.session_id,
        p_exercise_id: fixture.exercises[0].id,
        p_response: {},
        p_idempotency_key: crypto.randomUUID(),
      });
      expect(invalidResponse.error?.message).toContain('TEC_ENGLISH_INVALID_RESPONSE');

      const replayKey = crypto.randomUUID();
      const firstAttempt = await submitRpc(probe, institution.id, probeSession.session_id, fixture.exercises[0], replayKey);
      expect(firstAttempt.error).toBeNull();
      expect(firstAttempt.data.is_correct).toBe(true);
      const replay = await submitRpc(probe, institution.id, probeSession.session_id, fixture.exercises[0], replayKey);
      expect(replay.error).toBeNull();
      expect(replay.data).toEqual(firstAttempt.data);
      const reusedKey = await probe.client.rpc('submit_tec_english_answer_v1', {
        p_institution_id: institution.id,
        p_session_id: probeSession.session_id,
        p_exercise_id: fixture.exercises[0].id,
        p_response: { choice: 'different response' },
        p_idempotency_key: replayKey,
      });
      expect(reusedKey.error?.message).toContain('TEC_ENGLISH_IDEMPOTENCY_KEY_REUSED');
      const attemptCount = await service.from('tec_english_answer_attempts').select('id', { count: 'exact', head: true }).eq('student_id', studentIds.get(probe.id));
      expect(attemptCount.error).toBeNull();
      expect(attemptCount.count).toBe(1);

      for (const exercise of fixture.exercises.slice(1)) {
        const submitted = await submitRpc(probe, institution.id, probeSession.session_id, exercise);
        expect(submitted.error).toBeNull();
        expect(submitted.data.is_correct).toBe(true);
      }
      const probeStats = await service.from('tec_english_student_stats').select('xp').eq('student_id', studentIds.get(probe.id)).single();
      expect(probeStats.data?.xp).toBe(30);
      const repeatSession = await probe.client.rpc('start_tec_english_lesson_v1', { p_institution_id: institution.id, p_lesson_id: fixture.lessonId });
      expect(repeatSession.error).toBeNull();
      for (const exercise of fixture.exercises) {
        const submitted = await submitRpc(probe, institution.id, repeatSession.data.session_id, exercise);
        expect(submitted.error).toBeNull();
      }
      const xpEvents = await service.from('tec_english_xp_events').select('id', { count: 'exact', head: true }).eq('student_id', studentIds.get(probe.id));
      const probeProgress = await service.from('tec_english_lesson_progress').select('completion_count,xp_awarded,best_score').eq('student_id', studentIds.get(probe.id)).eq('lesson_id', fixture.lessonId).single();
      const repeatedStats = await service.from('tec_english_student_stats').select('xp').eq('student_id', studentIds.get(probe.id)).single();
      expect(xpEvents.count).toBe(1);
      expect(repeatedStats.data?.xp).toBe(30);
      expect(probeProgress.data).toMatchObject({ completion_count: 2, xp_awarded: 30, best_score: 100 });

      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      pages.push(page);
      await login(page, learner);
      await page.goto('/student/study/english');
      await expect(page.getByRole('heading', { name: 'Lições de inglês' })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Inglês para começar')).toBeVisible();
      await expect(page.getByText(/Plano diário|Química|Biologia|Caderno de Erros|Jornada V9/i)).toHaveCount(0);
      await page.getByRole('button', { name: 'Começar próxima lição' }).click();
      await expect(page.getByRole('heading', { name: 'Cumprimentos' })).toBeVisible();
      await page.getByRole('button', { name: 'Começar os desafios' }).click();

      await page.getByRole('button', { name: /Good night, class\./ }).click();
      await page.getByRole('button', { name: 'Conferir resposta' }).click();
      await expect(page.getByText('Quase! Revise a dica e tente novamente.')).toBeVisible();
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await page.getByRole('button', { name: /Good morning, class\./ }).click();
      await page.getByRole('button', { name: 'Conferir resposta' }).click();
      await expect(page.getByText('Muito bem! Você acertou.')).toBeVisible();
      await page.getByRole('button', { name: 'Próximo desafio' }).click();

      for (const exercise of fixture.exercises.slice(1)) await answerInUi(page, exercise);
      await expect(page.getByRole('heading', { name: 'Lição concluída' })).toBeVisible();
      await expect(page.getByText('+30 XP')).toBeVisible();
      await expect(page.getByText('30 XP', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Voltar ao mapa' }).click();
      await expect(page.getByRole('heading', { name: 'Lições de inglês' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /2\. Apresente-se/ })).toBeVisible();

      await page.getByRole('button', { name: 'Começar próxima lição' }).click();
      await page.getByRole('button', { name: 'Começar os desafios' }).click();
      await page.getByRole('button', { name: /Good night, class\./ }).click();
      await page.getByRole('button', { name: 'Conferir resposta' }).click();
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await page.getByRole('button', { name: /Good morning, class\./ }).click();
      await page.getByRole('button', { name: 'Conferir resposta' }).click();
      await page.getByRole('button', { name: 'Próximo desafio' }).click();
      await page.getByRole('button', { name: 'Sair da lição' }).click();
      await expect(page.getByRole('button', { name: 'Continuar de onde parei' })).toBeVisible();
      await page.close();

      const resumedPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      pages.push(resumedPage);
      await login(resumedPage, learner);
      await resumedPage.goto('/student/study/english');
      await expect(resumedPage.getByRole('heading', { name: 'Lições de inglês' })).toBeVisible({ timeout: 30_000 });
      await resumedPage.getByRole('button', { name: 'Continuar de onde parei' }).click();
      await expect(resumedPage.getByText('Desafio 2 de 7')).toBeVisible();
      await expect(resumedPage.getByText('Monte: “Meu nome é Bruno.”')).toBeVisible();
      expect(await resumedPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    } finally {
      for (const page of pages) await page.close();
      if (userIds.length) await service.from('memberships').delete().in('profile_id', userIds);
      if (userIds.length) await service.from('students').delete().in('profile_id', userIds);
      if (institutionIds.length) await service.from('institutions').delete().in('id', institutionIds);
      if (fixtureCourseCode) await service.from('tec_english_courses').delete().eq('course_code', fixtureCourseCode);
      if (accountIds.length) await service.from('accounts').delete().in('id', accountIds);
      if (userIds.length) await service.from('profiles').delete().in('id', userIds);
      for (const userId of userIds) await service.auth.admin.deleteUser(userId);
    }
  });
});
