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
const TEST_V2_COURSE_CODE = 'TEC_ENGLISH_FOUNDATIONS_V2_TEST';

type V2Fixture = {
  courseCode: string;
  unitTitle: string;
  lessons: Array<{ id: string; title: string; exercises: ExerciseRow[] }>;
};

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

async function cloneV2CourseForDisposableTest(service: Db, suffix: string): Promise<V2Fixture> {
  const { data: sourceCourse, error: courseError } = await service.from('tec_english_courses').select('*').eq('course_code', 'TEC_ENGLISH_FOUNDATIONS_V2').single();
  if (courseError || !sourceCourse) throw new Error(`V2 source course: ${courseError?.message ?? 'not found'}`);
  const removed = await service.from('tec_english_courses').delete().eq('course_code', TEST_V2_COURSE_CODE);
  if (removed.error) throw new Error(`clear disposable V2 fixture: ${removed.error.message}`);
  const { created_at: _courseCreated, updated_at: _courseUpdated, ...course } = sourceCourse;
  const insertedCourse = await service.from('tec_english_courses').insert({ ...course, course_code: TEST_V2_COURSE_CODE, is_test_fixture: true });
  if (insertedCourse.error) throw new Error(`V2 test course: ${insertedCourse.error.message}`);

  const { data: sourceUnits, error: unitsError } = await service.from('tec_english_units').select('*').eq('course_code', sourceCourse.course_code).order('position').limit(1);
  if (unitsError || !sourceUnits?.[0]) throw new Error(`V2 source unit: ${unitsError?.message ?? 'not found'}`);
  const sourceUnit = sourceUnits[0];
  const unitId = `${suffix}-${sourceUnit.id}`;
  const { created_at: _unitCreated, ...unit } = sourceUnit;
  const insertedUnit = await service.from('tec_english_units').insert({ ...unit, id: unitId, course_code: TEST_V2_COURSE_CODE });
  if (insertedUnit.error) throw new Error(`V2 test unit: ${insertedUnit.error.message}`);

  const { data: sourceLessons, error: lessonsError } = await service.from('tec_english_lessons').select('*').eq('unit_id', sourceUnit.id).order('position').limit(2);
  if (lessonsError || !sourceLessons || sourceLessons.length !== 2) throw new Error(`V2 source lessons: ${lessonsError?.message ?? 'expected two lessons'}`);
  const lessonIds = new Map<string, string>();
  for (const sourceLesson of sourceLessons) {
    const id = `${suffix}-${sourceLesson.id}`;
    lessonIds.set(sourceLesson.id, id);
    const { created_at: _lessonCreated, ...lesson } = sourceLesson;
    const inserted = await service.from('tec_english_lessons').insert({ ...lesson, id, unit_id: unitId });
    if (inserted.error) throw new Error(`V2 test lesson: ${inserted.error.message}`);
  }

  const { data: sourceExercises, error: exercisesError } = await service.from('tec_english_exercises').select('*').in('lesson_id', sourceLessons.map((lesson: any) => lesson.id)).order('position');
  if (exercisesError || !sourceExercises) throw new Error(`V2 source exercises: ${exercisesError?.message ?? 'not found'}`);
  for (const sourceExercise of sourceExercises) {
    const { created_at: _exerciseCreated, ...exercise } = sourceExercise;
    const inserted = await service.from('tec_english_exercises').insert({
      ...exercise,
      id: `${suffix}-${sourceExercise.id}`,
      lesson_id: required(lessonIds.get(sourceExercise.lesson_id), 'V2 fixture lesson id'),
    });
    if (inserted.error) throw new Error(`V2 test exercise: ${inserted.error.message}`);
  }
  const fixtureLessonIds = [...lessonIds.values()];
  const { data: fixtureExercises, error: fixtureExerciseError } = await service.from('tec_english_exercises').select('*').in('lesson_id', fixtureLessonIds).order('position');
  if (fixtureExerciseError || !fixtureExercises) throw new Error(`V2 fixture exercises: ${fixtureExerciseError?.message ?? 'not found'}`);
  return {
    courseCode: TEST_V2_COURSE_CODE,
    unitTitle: sourceUnit.title,
    lessons: sourceLessons.map((lesson: any) => ({
      id: required(lessonIds.get(lesson.id), 'V2 fixture lesson id'),
      title: lesson.title,
      exercises: (fixtureExercises as ExerciseRow[]).filter((exercise) => exercise.lesson_id === lessonIds.get(lesson.id)),
    })),
  };
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

async function submitV2Rpc(actor: Actor, institutionId: string, courseCode: string, sessionId: string, exercise: ExerciseRow, response = responseFor(exercise), key = crypto.randomUUID()) {
  return actor.client.rpc('submit_tec_english_answer_v2', {
    p_institution_id: institutionId,
    p_course_code: courseCode,
    p_session_id: sessionId,
    p_exercise_id: exercise.id,
    p_response: response,
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
  if (exercise.position < 7) {
    await expect(page.getByText('Muito bem! Você acertou.')).toBeVisible();
    await page.getByRole('button', { name: 'Próximo desafio' }).click();
  } else {
    await expect(page.getByText('Lição concluída')).toBeVisible();
    await expect(page.getByText('Você concluiu os desafios desta etapa.')).toBeVisible();
  }
}

async function login(page: Page, actor: Actor): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

englishDescribe('Tec Inglês interactive V1/V2', () => {
  test('runs both course versions, adaptive review, secure grading and persisted resume', async ({ browser }) => {
    test.setTimeout(240_000);
    const service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = Date.now().toString(36);
    const userIds: string[] = [];
    const institutionIds: string[] = [];
    const accountIds: string[] = [];
    const pages: Page[] = [];
    let fixtureCourseCode: string | undefined;
    let fixtureV2CourseCode: string | undefined;

    try {
      const owner = await createActor(service, 'English Test Owner', suffix, false, 'ADMIN');
      const reviewer = await createActor(service, 'English Pedagogical Reviewer', suffix, false, 'ADMIN');
      const reviewerProfile = await service.from('profiles').update({ platform_role: 'SUPER_ADMIN' }).eq('id', reviewer.id);
      if (reviewerProfile.error) throw new Error(`set disposable reviewer role: ${reviewerProfile.error.message}`);
      const learner = await createActor(service, 'English Learner', suffix, true);
      const v2Learner = await createActor(service, 'English V2 Learner', suffix, true);
      const probe = await createActor(service, 'English Security Probe', suffix, true);
      const regularLearner = await createActor(service, 'English Regular Learner', suffix);
      const unlinked = await createActor(service, 'English Unlinked Learner', suffix);
      const otherTenant = await createActor(service, 'English Other Tenant Learner', suffix);
      userIds.push(owner.id, reviewer.id, learner.id, v2Learner.id, probe.id, regularLearner.id, unlinked.id, otherTenant.id);

      const account = await insertOne(service, 'accounts', { name: `Tec English E2E ${suffix}`, owner_profile_id: owner.id, institution_limit: 1, status: 'ACTIVE' });
      accountIds.push(account.id);
      const institution = await insertOne(service, 'institutions', { account_id: account.id, name: `Tec English Test ${suffix}`, active: true });
      institutionIds.push(institution.id);
      const secondAccount = await insertOne(service, 'accounts', { name: `Tec English Other E2E ${suffix}`, owner_profile_id: otherTenant.id, institution_limit: 1, status: 'ACTIVE' });
      accountIds.push(secondAccount.id);
      const secondInstitution = await insertOne(service, 'institutions', { account_id: secondAccount.id, name: `Tec English Other Tenant ${suffix}`, active: true });
      institutionIds.push(secondInstitution.id);

      for (const actor of [owner, learner, v2Learner, probe, regularLearner, unlinked]) {
        await insertOne(service, 'memberships', { profile_id: actor.id, institution_id: institution.id, role: actor === owner ? 'ADMIN' : 'STUDENT', active: true });
      }
      await insertOne(service, 'memberships', { profile_id: otherTenant.id, institution_id: secondInstitution.id, role: 'STUDENT', active: true });
      const studentIds = new Map<string, string>();
      for (const actor of [learner, v2Learner, probe, regularLearner, otherTenant]) {
        const student = await insertOne(service, 'students', { profile_id: actor.id, institution_id: actor === otherTenant ? secondInstitution.id : institution.id, registration_number: `ENG-${actor.id.slice(0, 12)}`, active: true });
        studentIds.set(actor.id, student.id);
      }

      fixtureCourseCode = TEST_COURSE_CODE;
      const fixture = await cloneCourseForDisposableTest(service, suffix);
      fixtureV2CourseCode = TEST_V2_COURSE_CODE;
      const fixtureV2 = await cloneV2CourseForDisposableTest(service, suffix);
      expect(fixture.exercises).toHaveLength(7);
      expect(new Set(fixture.exercises.map((exercise) => exercise.exercise_type))).toEqual(new Set(['MULTIPLE_CHOICE', 'WORD_ORDER', 'TRANSLATION', 'LISTENING', 'MATCHING', 'FILL_BLANK', 'SPEAKING']));

      const normalMap = await regularLearner.client.rpc('get_tec_english_map_v1', { p_institution_id: institution.id });
      expect(normalMap.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');
      const normalStart = await regularLearner.client.rpc('start_tec_english_lesson_v1', { p_institution_id: institution.id, p_lesson_id: 'english-v1-u1-l1' });
      expect(normalStart.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');
      const fixtureStartDenied = await regularLearner.client.rpc('start_tec_english_lesson_v1', { p_institution_id: institution.id, p_lesson_id: fixture.lessonId });
      expect(fixtureStartDenied.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');

      let canonicalReviewApplied = false;
      try {
        if (process.env.CI) {
          const forbiddenQueue = await regularLearner.client.rpc('get_tec_english_review_queue_v1');
          expect(forbiddenQueue.error?.message).toContain('TEC_ENGLISH_REVIEW_FORBIDDEN');
          const queue = await reviewer.client.rpc('get_tec_english_review_queue_v1');
          expect(queue.error).toBeNull();
          const courseReview = (queue.data as any[]).find((item) => item.course_code === 'TEC_ENGLISH_FOUNDATIONS' && item.content_version === 1);
          expect(courseReview).toBeTruthy();
          const preview = await reviewer.client.rpc('get_tec_english_review_preview_v1', { p_course_code: 'TEC_ENGLISH_FOUNDATIONS', p_content_version: 1 });
          expect(preview.error).toBeNull();
          expect(preview.data.units).toHaveLength(3);
          expect(preview.data.units[0].lessons[0].exercises[0].answer_key).toBeTruthy();
          const approval = await reviewer.client.rpc('review_tec_english_course_v1', {
            p_course_code: 'TEC_ENGLISH_FOUNDATIONS',
            p_content_version: 1,
            p_decision: 'APPROVED',
            p_notes: 'CI descartável: verifica a fila de aprovação e o bloqueio de publicação por fingerprint.',
            p_expected_fingerprint: preview.data.snapshot_fingerprint,
            p_checklist: { translation: true, audio: true, instructions: true, alternatives: true, progression: true, brazilian: true, accessibility: true, references: true },
          });
          expect(approval.error).toBeNull();
          canonicalReviewApplied = true;
          expect(approval.data).toMatchObject({ decision: 'APPROVED', reviewer_name: 'English Pedagogical Reviewer' });

          const targets = await reviewer.client.rpc('get_tec_english_release_targets_v1', {
            p_course_code: 'TEC_ENGLISH_FOUNDATIONS', p_content_version: 1, p_search: `Tec English Test ${suffix}`,
          });
          expect(targets.error).toBeNull();
          expect(targets.data).toHaveLength(1);
          expect(targets.data[0]).toMatchObject({ institution_id: institution.id, enabled: false });
          const enabled = await reviewer.client.rpc('set_tec_english_institution_release_v1', {
            p_course_code: 'TEC_ENGLISH_FOUNDATIONS', p_content_version: 1, p_institution_id: institution.id, p_enabled: true,
          });
          expect(enabled.error).toBeNull();
          expect(enabled.data).toMatchObject({ enabled: true, institution_id: institution.id, actor_name: 'English Pedagogical Reviewer' });

          const publishedMap = await regularLearner.client.rpc('get_tec_english_map_v1', { p_institution_id: institution.id });
          expect(publishedMap.error).toBeNull();
          expect(publishedMap.data.units[0].lessons[0].status).toBe('AVAILABLE');
          const publishedStart = await regularLearner.client.rpc('start_tec_english_lesson_v1', { p_institution_id: institution.id, p_lesson_id: 'english-v1-u1-l1' });
          expect(publishedStart.error).toBeNull();
          expect(publishedStart.data.exercise).not.toHaveProperty('answer_key');

          const originalPrompt = await service.from('tec_english_exercises').select('prompt').eq('id', 'english-v1-u1-l1-e1').single();
          expect(originalPrompt.error).toBeNull();
          const tamper = await service.from('tec_english_exercises').update({ prompt: `${originalPrompt.data.prompt} conteúdo alterado` }).eq('id', 'english-v1-u1-l1-e1');
          expect(tamper.error).toBeNull();
          const changedMap = await regularLearner.client.rpc('get_tec_english_map_v1', { p_institution_id: institution.id });
          expect(changedMap.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');
          const changedStart = await regularLearner.client.rpc('start_tec_english_lesson_v1', { p_institution_id: institution.id, p_lesson_id: 'english-v1-u1-l1' });
          expect(changedStart.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');
          const restorePrompt = await service.from('tec_english_exercises').update({ prompt: originalPrompt.data.prompt }).eq('id', 'english-v1-u1-l1-e1');
          expect(restorePrompt.error).toBeNull();
        }
      } finally {
        if (canonicalReviewApplied) {
          const removeReleaseEvents = await service.from('tec_english_course_release_events').delete().eq('course_code', 'TEC_ENGLISH_FOUNDATIONS').eq('institution_id', institution.id);
          const removeReleases = await service.from('tec_english_course_releases').delete().eq('course_code', 'TEC_ENGLISH_FOUNDATIONS').eq('institution_id', institution.id);
          const removeReview = await service.from('tec_english_pedagogical_reviews').delete().eq('course_code', 'TEC_ENGLISH_FOUNDATIONS').eq('content_version', 1);
          for (const result of [removeReleaseEvents, removeReleases, removeReview]) if (result.error) throw new Error(`restore disposable release/review ledger: ${result.error.message}`);
          const resetExercises = await service.from('tec_english_exercises').update({ publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' }).like('id', 'english-v1-%');
          const resetLessons = await service.from('tec_english_lessons').update({ publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' }).like('id', 'english-v1-%');
          const resetUnits = await service.from('tec_english_units').update({ publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' }).like('id', 'english-v1-%');
          const resetCourse = await service.from('tec_english_courses').update({ publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' }).eq('course_code', 'TEC_ENGLISH_FOUNDATIONS');
          for (const result of [resetExercises, resetLessons, resetUnits, resetCourse]) if (result.error) throw new Error(`restore disposable course to STAGING: ${result.error.message}`);
        }
      }

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

      const canonicalV2Hidden = await regularLearner.client.rpc('get_tec_english_course_map_v2', {
        p_institution_id: institution.id,
        p_course_code: 'TEC_ENGLISH_FOUNDATIONS_V2',
      });
      expect(canonicalV2Hidden.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');
      const v2FixtureMap = await probe.client.rpc('get_tec_english_course_map_v2', {
        p_institution_id: institution.id,
        p_course_code: fixtureV2.courseCode,
      });
      expect(v2FixtureMap.error).toBeNull();
      expect(v2FixtureMap.data.course.publication_status).toBe('STAGING');
      expect(v2FixtureMap.data.units).toHaveLength(1);
      expect(v2FixtureMap.data.units[0].lessons).toHaveLength(2);
      expect(v2FixtureMap.data.units[0].lessons[0].status).toBe('AVAILABLE');
      const crossTenantV2Map = await otherTenant.client.rpc('get_tec_english_course_map_v2', {
        p_institution_id: institution.id,
        p_course_code: fixtureV2.courseCode,
      });
      expect(crossTenantV2Map.error?.message).toContain('TEC_ENGLISH_STUDENT_SCOPE_DENIED');

      const firstV2Lesson = fixtureV2.lessons[0];
      const firstV2Exercise = firstV2Lesson.exercises[0];
      const directV2AnswerRead = await probe.client.from('tec_english_exercises').select('answer_key').eq('id', firstV2Exercise.id).maybeSingle();
      expect(directV2AnswerRead.error).not.toBeNull();
      const v2SessionResult = await probe.client.rpc('start_tec_english_lesson_v2', {
        p_institution_id: institution.id,
        p_course_code: fixtureV2.courseCode,
        p_lesson_id: firstV2Lesson.id,
      });
      expect(v2SessionResult.error).toBeNull();
      const v2Session = required(v2SessionResult.data, 'V2 student session');
      expect(v2Session.exercise).not.toHaveProperty('answer_key');
      expect(v2Session.exercise.dialogue_speaker).toBeTruthy();
      const wrongV2Choice = firstV2Exercise.options.find((option) => !firstV2Exercise.accepted_answers.includes(option));
      if (!wrongV2Choice) throw new Error('V2 dialogue exercise must have at least one incorrect option.');
      const wrongV2Response = { choice: wrongV2Choice };
      const wrongV2Key = crypto.randomUUID();
      const [wrongV2Attempt, wrongV2Replay] = await Promise.all([
        submitV2Rpc(probe, institution.id, fixtureV2.courseCode, v2Session.session_id, firstV2Exercise, wrongV2Response, wrongV2Key),
        submitV2Rpc(probe, institution.id, fixtureV2.courseCode, v2Session.session_id, firstV2Exercise, wrongV2Response, wrongV2Key),
      ]);
      expect(wrongV2Attempt.error).toBeNull();
      expect(wrongV2Attempt.data.is_correct).toBe(false);
      expect(wrongV2Replay.error).toBeNull();
      expect(wrongV2Replay.data).toEqual(wrongV2Attempt.data);
      const concurrentReplayCount = await service.from('tec_english_answer_attempts').select('id', { count: 'exact', head: true })
        .eq('session_id', v2Session.session_id).eq('idempotency_key', wrongV2Key);
      expect(concurrentReplayCount.error).toBeNull();
      expect(concurrentReplayCount.count).toBe(1);
      const v2Home = await probe.client.rpc('get_tec_english_learning_home_v2', { p_institution_id: institution.id });
      expect(v2Home.error).toBeNull();
      expect(v2Home.data.due_reviews).toBeGreaterThan(0);
      expect(v2Home.data.due_skills[0].label).toBe('Horários da rotina');
      expect(v2Home.data.due_skills[0].label).not.toMatch(/legacy|[a-f0-9]{8,}/i);
      const reviewStart = await probe.client.rpc('start_tec_english_skill_review_v2', {
        p_institution_id: institution.id,
        p_skill_code: firstV2Exercise.skill_code,
      });
      expect(reviewStart.error).toBeNull();
      expect(reviewStart.data.exercise).not.toHaveProperty('answer_key');
      const reviewExerciseId = reviewStart.data.exercise.id;
      const { data: reviewExercise, error: reviewExerciseError } = await service.from('tec_english_exercises').select('*').eq('id', reviewExerciseId).single();
      if (reviewExerciseError || !reviewExercise) throw new Error(`V2 review exercise: ${reviewExerciseError?.message ?? 'not found'}`);
      const reviewKey = crypto.randomUUID();
      const reviewResponse = responseFor(reviewExercise as ExerciseRow);
      const xpBeforeReview = await service.from('tec_english_student_stats').select('xp').eq('student_id', studentIds.get(probe.id)).single();
      const reviewAttempt = await probe.client.rpc('submit_tec_english_skill_review_v2', {
        p_institution_id: institution.id, p_skill_code: firstV2Exercise.skill_code,
        p_response: reviewResponse, p_idempotency_key: reviewKey,
      });
      expect(reviewAttempt.error).toBeNull();
      expect(reviewAttempt.data.is_correct).toBe(true);
      const reviewReplay = await probe.client.rpc('submit_tec_english_skill_review_v2', {
        p_institution_id: institution.id, p_skill_code: firstV2Exercise.skill_code,
        p_response: reviewResponse, p_idempotency_key: reviewKey,
      });
      expect(reviewReplay.error).toBeNull();
      expect(reviewReplay.data).toEqual(reviewAttempt.data);
      const reviewAttemptCount = await service.from('tec_english_skill_review_attempts_v2').select('id', { count: 'exact', head: true })
        .eq('student_id', studentIds.get(probe.id)).eq('idempotency_key', reviewKey);
      expect(reviewAttemptCount.error).toBeNull();
      expect(reviewAttemptCount.count).toBe(1);
      const xpAfterReview = await service.from('tec_english_student_stats').select('xp').eq('student_id', studentIds.get(probe.id)).single();
      expect(xpAfterReview.data?.xp ?? 0).toBe(xpBeforeReview.data?.xp ?? 0);

      const makeReviewDueAgain = await service.from('tec_english_skill_mastery_v2')
        .update({ next_review_at: new Date(Date.now() - 60_000).toISOString() })
        .eq('institution_id', institution.id).eq('student_id', studentIds.get(probe.id)).eq('skill_code', firstV2Exercise.skill_code);
      expect(makeReviewDueAgain.error).toBeNull();
      const nextReview = await probe.client.rpc('start_tec_english_skill_review_v2', {
        p_institution_id: institution.id, p_skill_code: firstV2Exercise.skill_code,
      });
      expect(nextReview.error).toBeNull();
      expect(nextReview.data.exercise.id).not.toBe(reviewExerciseId);

      const correctV2First = await submitV2Rpc(probe, institution.id, fixtureV2.courseCode, v2Session.session_id, firstV2Exercise, responseFor(firstV2Exercise));
      expect(correctV2First.error).toBeNull();
      expect(correctV2First.data.is_correct).toBe(true);
      const secondV2Exercise = firstV2Lesson.exercises[1];
      const correctV2Second = await submitV2Rpc(probe, institution.id, fixtureV2.courseCode, v2Session.session_id, secondV2Exercise, responseFor(secondV2Exercise));
      expect(correctV2Second.error).toBeNull();
      expect(correctV2Second.data.is_correct).toBe(true);
      const adaptiveMastery = await service.from('tec_english_skill_mastery_v2').select('difficulty_level,correct_streak,interval_days')
        .eq('institution_id', institution.id).eq('student_id', studentIds.get(probe.id)).eq('skill_code', firstV2Exercise.skill_code).single();
      expect(adaptiveMastery.error).toBeNull();
      expect(adaptiveMastery.data).toMatchObject({ difficulty_level: 2, correct_streak: 3, interval_days: 7 });

      const thirdV2Exercise = firstV2Lesson.exercises[2];
      const wrongWordOrder = await submitV2Rpc(probe, institution.id, fixtureV2.courseCode, v2Session.session_id, thirdV2Exercise, { tokens: ['wrong', 'order'] });
      expect(wrongWordOrder.error).toBeNull();
      expect(wrongWordOrder.data).toMatchObject({ is_correct: false, explanation: thirdV2Exercise.explanation });
      const secondWrongWordOrder = await submitV2Rpc(probe, institution.id, fixtureV2.courseCode, v2Session.session_id, thirdV2Exercise, { tokens: ['wrong', 'order'] });
      expect(secondWrongWordOrder.error).toBeNull();
      expect(secondWrongWordOrder.data.is_correct).toBe(false);
      const regressedMastery = await service.from('tec_english_skill_mastery_v2').select('difficulty_level,incorrect_streak,interval_days')
        .eq('institution_id', institution.id).eq('student_id', studentIds.get(probe.id)).eq('skill_code', thirdV2Exercise.skill_code).single();
      expect(regressedMastery.error).toBeNull();
      expect(regressedMastery.data).toMatchObject({ difficulty_level: 2, incorrect_streak: 2, interval_days: 0 });
      const correctedWordOrder = await submitV2Rpc(probe, institution.id, fixtureV2.courseCode, v2Session.session_id, thirdV2Exercise);
      expect(correctedWordOrder.error).toBeNull();
      expect(correctedWordOrder.data.is_correct).toBe(true);
      const distinctSkillMastery = await service.from('tec_english_skill_mastery_v2').select('incorrect_streak,correct_streak')
        .eq('institution_id', institution.id).eq('student_id', studentIds.get(probe.id)).eq('skill_code', thirdV2Exercise.skill_code).single();
      expect(distinctSkillMastery.error).toBeNull();
      expect(distinctSkillMastery.data).toMatchObject({ incorrect_streak: 0, correct_streak: 1 });

      const attemptCountBeforeLoad = await service.from('tec_english_answer_attempts').select('id', { count: 'exact', head: true })
        .eq('session_id', v2Session.session_id);
      expect(attemptCountBeforeLoad.error).toBeNull();
      const loadAttempts = Array.from({ length: 250 }, (_, index) => ({
        institution_id: institution.id,
        student_id: studentIds.get(probe.id),
        session_id: v2Session.session_id,
        exercise_id: firstV2Exercise.id,
        idempotency_key: crypto.randomUUID(),
        response: { qualification_probe: index },
        is_correct: index % 2 === 0,
        result_payload: { qualification_probe: true },
      }));
      const loadStartedAt = Date.now();
      const loadInsert = await service.from('tec_english_answer_attempts').insert(loadAttempts);
      const loadElapsedMs = Date.now() - loadStartedAt;
      expect(loadInsert.error).toBeNull();
      expect(loadElapsedMs).toBeLessThan(15_000);
      const attemptCountAfterLoad = await service.from('tec_english_answer_attempts').select('id', { count: 'exact', head: true })
        .eq('session_id', v2Session.session_id);
      expect(attemptCountAfterLoad.error).toBeNull();
      expect(attemptCountAfterLoad.count).toBe((attemptCountBeforeLoad.count ?? 0) + 250);

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
      const attemptCount = await service.from('tec_english_answer_attempts').select('id', { count: 'exact', head: true })
        .eq('student_id', studentIds.get(probe.id)).eq('idempotency_key', replayKey);
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
      await expect(page.getByText('Lição concluída', { exact: true })).toBeVisible();
      await expect(page.getByText('+30 XP')).toBeVisible();
      await expect(page.getByText('30 XP', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Voltar ao mapa' }).click();
      await expect(page.getByRole('heading', { name: 'Lições de inglês' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /2\. Apresente-se/ })).toBeVisible();

      await page.getByRole('button', { name: 'Começar próxima lição' }).click();
      await page.getByRole('button', { name: 'Começar os desafios' }).click();
      await expect(page.getByText('Como dizer “Qual é o seu nome?” em inglês?')).toBeVisible();
      await page.getByRole('button', { name: /What is your name\?/ }).click();
      await page.getByRole('button', { name: 'Conferir resposta' }).click();
      await expect(page.getByText('Muito bem! Você acertou.')).toBeVisible();
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
      await resumedPage.getByRole('button', { name: 'Abrir menu de navegação' }).click();
      await resumedPage.getByRole('button', { name: 'Sair', exact: true }).click();
      await expect(resumedPage).toHaveURL(/\/login/, { timeout: 30_000 });
      await login(resumedPage, learner);
      await resumedPage.goto('/student/study/english');
      await expect(resumedPage.getByRole('heading', { name: 'Lições de inglês' })).toBeVisible({ timeout: 30_000 });
      await resumedPage.getByRole('button', { name: 'Continuar de onde parei' }).click();
      await expect(resumedPage.getByText('Desafio 2 de 7')).toBeVisible();
      await expect(resumedPage.getByText('Monte: “Meu nome é Bruno.”')).toBeVisible();

      const v2Page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      pages.push(v2Page);
      await login(v2Page, v2Learner);
      await v2Page.goto('/student/study/english');
      await expect(v2Page.getByRole('heading', { name: 'Lições de inglês' })).toBeVisible({ timeout: 30_000 });
      const v2Unit = v2Page.getByRole('region', { name: 'Minha rotina' });
      await expect(v2Unit.getByRole('heading', { name: '1. Meu dia começa' })).toBeVisible();
      await v2Unit.getByRole('button', { name: 'Começar lição' }).click();
      await v2Page.getByRole('button', { name: 'Começar os desafios' }).click();
      for (const exercise of fixtureV2.lessons[0].exercises) {
        if (exercise.position === 2) {
          const dialogueContext = v2Page.getByRole('region', { name: 'Contexto da conversa' });
          await expect(dialogueContext).toContainText('What time do you wake up?');
          await expect(dialogueContext).toContainText('I wake up at seven.');
        }
        await answerInUi(v2Page, exercise);
      }
      await expect(v2Page.getByText('+30 XP')).toBeVisible();
      await v2Page.getByRole('button', { name: 'Voltar ao mapa' }).click();
      const nextV2Unit = v2Page.getByRole('region', { name: 'Minha rotina' });
      await nextV2Unit.getByRole('button', { name: 'Começar lição' }).click();
      await v2Page.getByRole('button', { name: 'Começar os desafios' }).click();
      await answerInUi(v2Page, fixtureV2.lessons[1].exercises[0]);
      await v2Page.getByRole('button', { name: 'Sair da lição' }).click();
      await v2Page.reload();
      await expect(v2Page.getByRole('button', { name: 'Continuar de onde parei' })).toBeVisible();
      await v2Page.getByRole('button', { name: 'Continuar de onde parei' }).click();
      await expect(v2Page.getByText('Desafio 2 de 7')).toBeVisible();
      expect(await v2Page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    } finally {
      for (const page of pages) await page.close();
      if (userIds.length) await service.from('memberships').delete().in('profile_id', userIds);
      if (userIds.length) await service.from('students').delete().in('profile_id', userIds);
      if (institutionIds.length) await service.from('institutions').delete().in('id', institutionIds);
      if (fixtureCourseCode) await service.from('tec_english_courses').delete().eq('course_code', fixtureCourseCode);
      if (fixtureV2CourseCode) await service.from('tec_english_courses').delete().eq('course_code', fixtureV2CourseCode);
      if (accountIds.length) await service.from('accounts').delete().in('id', accountIds);
      if (userIds.length) await service.from('profiles').delete().in('id', userIds);
      for (const userId of userIds) await service.auth.admin.deleteUser(userId);
    }
  });
});
