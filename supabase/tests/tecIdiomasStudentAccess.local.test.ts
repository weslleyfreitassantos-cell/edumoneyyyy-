import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; client: Db };
type ExerciseFixture = {
  id: string;
  position: number;
  exercise_type: string;
  accepted_answers: string[];
  answer_key: Record<string, unknown>;
};

const url = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const isLoopback = (() => {
  if (!url) return false;
  try { return ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname); }
  catch { return false; }
})();
if (url && !isLoopback) throw new Error('Tec Idiomas student access tests are restricted to loopback Supabase.');
const localDescribe = url && anonKey && serviceRoleKey && isLoopback ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(client: Db, table: string, row: Record<string, unknown>) {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createStudent(service: Db, suffix: string): Promise<Actor> {
  const email = `tec-idiomas-student-${suffix}@local.test`;
  const password = 'TecIdiomasStudent!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth student: ${error.message}`);
  const user = required(data.user, 'student user');
  await insertOne(service, 'profiles', {
    id: user.id, full_name: `Tec Idiomas Student ${suffix}`, email, role: 'STUDENT', active: true,
  });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`student sign in: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, client };
}

function answerFor(exercise: ExerciseFixture): Record<string, unknown> {
  if (exercise.exercise_type === 'MATCHING') {
    const rawPairs = exercise.answer_key.pairs;
    if (typeof rawPairs !== 'object' || rawPairs === null || Array.isArray(rawPairs)) {
      throw new Error(`Exercise ${exercise.id} has no valid matching pairs in the isolated fixture.`);
    }
    const pairs = rawPairs as Record<string, unknown>;
    const entries = Object.entries(pairs);
    if (entries.length < 2 || entries.some(([left, right]) => !left.trim() || typeof right !== 'string' || !right.trim())) {
      throw new Error(`Exercise ${exercise.id} has incomplete matching pairs in the isolated fixture.`);
    }
    return { pairs };
  }

  const answer = exercise.accepted_answers[0];
  if (!answer) throw new Error(`Exercise ${exercise.id} has no accepted answer in the isolated fixture.`);
  if (exercise.exercise_type === 'MULTIPLE_CHOICE' || exercise.exercise_type === 'FILL_BLANK') return { choice: answer };
  if (exercise.exercise_type === 'WORD_ORDER') return { tokens: answer.split(' ') };
  return { text: answer };
}

async function exercisesFor(service: Db, lessonId: string): Promise<ExerciseFixture[]> {
  const { data, error } = await service.from('tec_english_exercises')
    .select('id,position,exercise_type,accepted_answers,answer_key')
    .eq('lesson_id', lessonId)
    .order('position');
  if (error) throw new Error(`read isolated exercises for ${lessonId}: ${error.message}`);
  return data as ExerciseFixture[];
}

async function completeLesson(service: Db, actor: Actor, institutionId: string, courseCode: string, lessonId: string) {
  const started = await actor.client.rpc('start_tec_language_lesson_v1', {
    p_institution_id: institutionId,
    p_course_code: courseCode,
    p_lesson_id: lessonId,
  });
  if (started.error) throw new Error(`start ${courseCode}/${lessonId}: ${started.error.message}`);
  const exercises = await exercisesFor(service, lessonId);
  let lastResult: Record<string, unknown> | null = null;
  for (const exercise of exercises) {
    const result = await actor.client.rpc('submit_tec_language_answer_v1', {
      p_institution_id: institutionId,
      p_course_code: courseCode,
      p_session_id: started.data.session_id,
      p_exercise_id: exercise.id,
      p_response: answerFor(exercise),
      p_idempotency_key: randomUUID(),
    });
    if (result.error) throw new Error(`complete ${courseCode}/${exercise.id}: ${result.error.message}`);
    if (result.data.is_correct !== true) throw new Error(`fixture answer rejected for ${courseCode}/${exercise.id}`);
    lastResult = result.data;
  }
  if (!lastResult || lastResult.session_complete !== true) throw new Error(`lesson did not complete for ${courseCode}/${lessonId}`);
  return started.data.session_id as string;
}

localDescribe('Tec Idiomas direct student access and isolation', () => {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  let service: Db;
  let institutionA = '';
  let institutionB = '';
  let institutionInactive = '';
  let studentA: Actor;
  let studentB: Actor;
  let studentInactive: Actor;
  let studentIdA = '';
  let studentIdB = '';
  let studentIdInactive = '';
  const userIds: string[] = [];

  beforeAll(async () => {
    service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    institutionA = required((await insertOne(service, 'institutions', { name: `Tec Idiomas QA ${suffix}`, active: true })).id, 'institution A id');
    institutionB = required((await insertOne(service, 'institutions', { name: `Tec Idiomas QA B ${suffix}`, active: true })).id, 'institution B id');
    institutionInactive = required((await insertOne(service, 'institutions', { name: `Tec Idiomas QA inactive ${suffix}`, active: false })).id, 'inactive institution id');
    studentA = await createStudent(service, `${suffix}-a`);
    studentB = await createStudent(service, `${suffix}-b`);
    studentInactive = await createStudent(service, `${suffix}-inactive`);
    userIds.push(studentA.id, studentB.id, studentInactive.id);

    for (const [actor, institutionId, label] of [
      [studentA, institutionA, 'a'], [studentB, institutionB, 'b'], [studentInactive, institutionInactive, 'inactive'],
    ] as const) {
      await insertOne(service, 'memberships', { profile_id: actor.id, institution_id: institutionId, role: 'STUDENT', active: true });
      const student = await insertOne(service, 'students', {
        profile_id: actor.id, institution_id: institutionId, registration_number: `IDIOMAS-${suffix}-${label}`, active: true,
      });
      if (label === 'a') studentIdA = student.id;
      else if (label === 'b') studentIdB = student.id;
      else studentIdInactive = student.id;
    }

    // Student A represents a learner already using each legacy language path.
    // Seed one active session per legacy course so the V4 gate can distinguish
    // this learner from Student B, who must complete the beginner path first.
    for (const courseCode of [
      'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
      'TEC_SPANISH_FOUNDATIONS_V1',
      'TEC_KOREAN_FOUNDATIONS_V1',
    ]) {
      const unitQuery = await service.from('tec_english_units')
        .select('id').eq('course_code', courseCode).order('position').limit(1).maybeSingle();
      if (unitQuery.error || !unitQuery.data) throw new Error(`legacy fixture unit ${courseCode}: ${unitQuery.error?.message ?? 'missing'}`);
      const lessonQuery = await service.from('tec_english_lessons')
        .select('id').eq('unit_id', unitQuery.data.id).order('position').limit(1).maybeSingle();
      if (lessonQuery.error || !lessonQuery.data) throw new Error(`legacy fixture lesson ${courseCode}: ${lessonQuery.error?.message ?? 'missing'}`);
      await insertOne(service, 'tec_english_lesson_sessions', {
        institution_id: institutionA,
        student_id: studentIdA,
        lesson_id: lessonQuery.data.id,
        status: 'IN_PROGRESS',
        current_position: 1,
      });
    }
  });

  afterAll(async () => {
    if (!service) return;
    const studentIds = [studentIdA, studentIdB, studentIdInactive].filter(Boolean);
    if (studentIds.length) {
      await service.from('tec_language_placement_attempts_v1').delete().in('student_id', studentIds);
      await service.from('tec_english_answer_attempts').delete().in('student_id', studentIds);
      await service.from('tec_english_lesson_sessions').delete().in('student_id', studentIds);
      await service.from('tec_english_lesson_progress').delete().in('student_id', studentIds);
      await service.from('tec_language_course_stats_v1').delete().in('student_id', studentIds);
      await service.from('tec_english_xp_events').delete().in('student_id', studentIds);
      await service.from('tec_english_student_stats').delete().in('student_id', studentIds);
      await service.from('students').delete().in('id', studentIds);
    }
    if (userIds.length) {
      await service.from('memberships').delete().in('profile_id', userIds);
      await service.from('profiles').delete().in('id', userIds);
      for (const id of userIds) await service.auth.admin.deleteUser(id);
    }
    await service.from('institutions').delete().in('id', [institutionA, institutionB, institutionInactive].filter(Boolean));
  });

  it('opens staging courses to active enrolled students, preserves lesson progress, and isolates XP and sessions', async () => {
    const courses = [
      { code: 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', units: 4, lessons: 16, exercises: 112 },
      { code: 'TEC_SPANISH_FOUNDATIONS_V1', units: 2, lessons: 8, exercises: 56 },
      { code: 'TEC_KOREAN_FOUNDATIONS_V1', units: 2, lessons: 8, exercises: 56 },
    ];
    const anonymous = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const anonymousMap = await anonymous.rpc('get_tec_language_course_map_v1', { p_institution_id: institutionA, p_course_code: courses[0].code });
    expect(anonymousMap.error?.code).toBe('42501');

    const inactiveMap = await studentInactive.client.rpc('get_tec_language_course_map_v1', { p_institution_id: institutionInactive, p_course_code: courses[0].code });
    expect(inactiveMap.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');

    for (let index = 0; index < courses.length; index += 1) {
      const course = courses[index];
      const mapA = await studentA.client.rpc('get_tec_language_course_map_v1', { p_institution_id: institutionA, p_course_code: course.code });
      expect(mapA.error).toBeNull();
      expect(mapA.data.course).toMatchObject({ code: course.code, publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' });
      expect(mapA.data.units).toHaveLength(course.units);
      expect(mapA.data.units.flatMap((unit: { lessons: unknown[] }) => unit.lessons)).toHaveLength(course.lessons);
      expect(mapA.data.units.flatMap((unit: { lessons: { exercise_count: number }[] }) => unit.lessons).reduce((sum: number, lesson: { exercise_count: number }) => sum + lesson.exercise_count, 0)).toBe(course.exercises);
      expect(mapA.data.stats.xp).toBe(0);

      const firstLesson = mapA.data.units[0].lessons[0];
      const started = await studentA.client.rpc('start_tec_language_lesson_v1', {
        p_institution_id: institutionA, p_course_code: course.code, p_lesson_id: firstLesson.id,
      });
      expect(started.error).toBeNull();
      expect(started.data.exercise).not.toHaveProperty('answer_key');
      expect(started.data.exercise).not.toHaveProperty('accepted_answers');

      const resumed = await studentA.client.rpc('get_tec_language_session_v1', {
        p_institution_id: institutionA, p_course_code: course.code, p_session_id: started.data.session_id,
      });
      expect(resumed.error).toBeNull();
      expect(resumed.data).toMatchObject({ session_id: started.data.session_id, current_position: 1 });
      expect(resumed.data.exercise).not.toHaveProperty('answer_key');
      expect(resumed.data.exercise).not.toHaveProperty('accepted_answers');

      if (index === 0) {
        const foreignSession = await studentB.client.rpc('get_tec_language_session_v1', {
          p_institution_id: institutionA, p_course_code: course.code, p_session_id: started.data.session_id,
        });
        expect(foreignSession.error?.code).toBe('42501');
      }

      const exercisesQuery = await service.from('tec_english_exercises')
        .select('id,position,exercise_type,accepted_answers,answer_key').eq('lesson_id', firstLesson.id).order('position');
      if (exercisesQuery.error) throw new Error(`read isolated exercise fixtures: ${exercisesQuery.error.message}`);
      const exercises = exercisesQuery.data as ExerciseFixture[];
      expect(exercises).toHaveLength(7);

      let lastResult: Record<string, unknown> | null = null;
      let lastKey = '';
      let lastExerciseId = '';
      let lastResponse: Record<string, unknown> = {};
      for (const exercise of exercises) {
        lastKey = randomUUID();
        lastExerciseId = exercise.id;
        lastResponse = answerFor(exercise);
        const result = await studentA.client.rpc('submit_tec_language_answer_v1', {
          p_institution_id: institutionA, p_course_code: course.code, p_session_id: started.data.session_id,
          p_exercise_id: exercise.id, p_response: lastResponse, p_idempotency_key: lastKey,
        });
        if (result.error) throw new Error(`submit ${course.code} exercise ${exercise.position}: ${result.error.message}`);
        expect(result.data.is_correct).toBe(true);
        lastResult = result.data;
      }
      expect(lastResult).toMatchObject({ session_complete: true, xp_awarded: firstLesson.xp_reward, total_xp: firstLesson.xp_reward });

      const replay = await studentA.client.rpc('submit_tec_language_answer_v1', {
        p_institution_id: institutionA, p_course_code: course.code, p_session_id: started.data.session_id,
        p_exercise_id: lastExerciseId, p_response: lastResponse, p_idempotency_key: lastKey,
      });
      expect(replay.error).toBeNull();
      expect(replay.data).toEqual(lastResult);
    }

    for (const course of courses) {
      const persistedA = await studentA.client.rpc('get_tec_language_course_map_v1', { p_institution_id: institutionA, p_course_code: course.code });
      const independentB = await studentB.client.rpc('get_tec_language_course_map_v1', { p_institution_id: institutionB, p_course_code: course.code });
      expect(persistedA.error).toBeNull();
      expect(persistedA.data.stats.xp).toBe(30);
      expect(persistedA.data.completed_lessons).toBe(1);
      expect(independentB.error).toBeNull();
      expect(independentB.data.stats.xp).toBe(0);
      expect(independentB.data.completed_lessons).toBe(0);
    }
  });

  it('routes new students to each beginner course and preserves the existing legacy path', async () => {
    const courses = [
      { beginner: 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', legacy: 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', lessons: 16 },
      { beginner: 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', legacy: 'TEC_SPANISH_FOUNDATIONS_V1', lessons: 16 },
      { beginner: 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', legacy: 'TEC_KOREAN_FOUNDATIONS_V1', lessons: 16 },
    ];

    for (const course of courses) {
      const beginnerMap = await studentB.client.rpc('get_tec_language_course_map_v1', {
        p_institution_id: institutionB, p_course_code: course.beginner,
      });
      expect(beginnerMap.error).toBeNull();
      expect(beginnerMap.data.units.flatMap((unit: { lessons: unknown[] }) => unit.lessons)).toHaveLength(course.lessons);
      expect(beginnerMap.data.course).toMatchObject({ publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' });

      const firstBeginnerLesson = beginnerMap.data.units[0].lessons[0];
      const begun = await studentB.client.rpc('start_tec_language_lesson_v1', {
        p_institution_id: institutionB, p_course_code: course.beginner, p_lesson_id: firstBeginnerLesson.id,
      });
      expect(begun.error).toBeNull();
      expect(begun.data.exercise).not.toHaveProperty('answer_key');
      expect(begun.data.exercise).not.toHaveProperty('accepted_answers');

      const legacyMapForNewStudent = await studentB.client.rpc('get_tec_language_course_map_v1', {
        p_institution_id: institutionB, p_course_code: course.legacy,
      });
      expect(legacyMapForNewStudent.error).toBeNull();
      const blockedLegacyStart = await studentB.client.rpc('start_tec_language_lesson_v1', {
        p_institution_id: institutionB,
        p_course_code: course.legacy,
        p_lesson_id: legacyMapForNewStudent.data.units[0].lessons[0].id,
      });
      expect(blockedLegacyStart.error?.code).toBe('42501');
      expect(blockedLegacyStart.error?.message).toContain('TEC_ENGLISH_BEGINNER_PATH_REQUIRED');

      const legacyMapForExistingStudent = await studentA.client.rpc('get_tec_language_course_map_v1', {
        p_institution_id: institutionA, p_course_code: course.legacy,
      });
      expect(legacyMapForExistingStudent.error).toBeNull();
      const existingStudentContinue = await studentA.client.rpc('start_tec_language_lesson_v1', {
        p_institution_id: institutionA,
        p_course_code: course.legacy,
        p_lesson_id: legacyMapForExistingStudent.data.units[0].lessons[1].id,
      });
      expect(existingStudentContinue.error).toBeNull();
      expect(existingStudentContinue.data.course_code).toBe(course.legacy);
    }
  });

  it('persists placement per student, institution, and course with idempotency and RLS', async () => {
    const courseCode = 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER';
    const attemptId = randomUUID();
    const record = {
      version: 1,
      kind: 'ASSESSMENT',
      score: 4,
      questionCount: 5,
      highestDifficulty: 3,
      recommendedUnitPosition: 3,
      completedAt: new Date().toISOString(),
    };
    const statsBefore = await service.from('tec_language_course_stats_v1').select('*')
      .eq('institution_id', institutionA).eq('student_id', studentIdA).order('course_code');
    if (statsBefore.error) throw new Error(`read placement XP before: ${statsBefore.error.message}`);

    const empty = await studentA.client.rpc('get_tec_language_placement_v1', {
      p_institution_id: institutionA, p_course_code: courseCode,
    });
    expect(empty.error).toBeNull();
    expect(empty.data).toEqual({ attemptId: null, record: null });

    const incompleteRecord = await studentA.client.rpc('save_tec_language_placement_v1', {
      p_institution_id: institutionA,
      p_course_code: courseCode,
      p_attempt_id: randomUUID(),
      p_record: { version: 1, kind: 'ASSESSMENT', questionCount: 2, highestDifficulty: 1, recommendedUnitPosition: 1 },
    });
    expect(incompleteRecord.error?.code).toBe('22023');
    expect(incompleteRecord.error?.message).toContain('TEC_IDIOMAS_PLACEMENT_INVALID_RECORD');

    const firstSave = await studentA.client.rpc('save_tec_language_placement_v1', {
      p_institution_id: institutionA, p_course_code: courseCode, p_attempt_id: attemptId, p_record: record,
    });
    expect(firstSave.error).toBeNull();
    expect(firstSave.data.attemptId).toBe(attemptId);
    expect(firstSave.data.record).toMatchObject({ ...record, completedAt: expect.any(String) });

    const replay = await studentA.client.rpc('save_tec_language_placement_v1', {
      p_institution_id: institutionA, p_course_code: courseCode, p_attempt_id: attemptId, p_record: record,
    });
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(firstSave.data);

    const conflict = await studentA.client.rpc('save_tec_language_placement_v1', {
      p_institution_id: institutionA,
      p_course_code: courseCode,
      p_attempt_id: attemptId,
      p_record: { ...record, score: 3, recommendedUnitPosition: 2 },
    });
    expect(conflict.error?.code).toBe('23505');
    expect(conflict.error?.message).toContain('TEC_IDIOMAS_PLACEMENT_IDEMPOTENCY_CONFLICT');

    const readOwn = await studentA.client.rpc('get_tec_language_placement_v1', {
      p_institution_id: institutionA, p_course_code: courseCode,
    });
    expect(readOwn.error).toBeNull();
    expect(readOwn.data.attemptId).toBe(attemptId);
    const readOtherTenant = await studentB.client.rpc('get_tec_language_placement_v1', {
      p_institution_id: institutionA, p_course_code: courseCode,
    });
    expect(readOtherTenant.error?.code).toBe('42501');
    const emptyOtherStudent = await studentB.client.rpc('get_tec_language_placement_v1', {
      p_institution_id: institutionB, p_course_code: courseCode,
    });
    expect(emptyOtherStudent.error).toBeNull();
    expect(emptyOtherStudent.data).toEqual({ attemptId: null, record: null });

    const visibleOwnRows = await studentA.client.from('tec_language_placement_attempts_v1')
      .select('id').eq('institution_id', institutionA);
    expect(visibleOwnRows.error).toBeNull();
    expect(visibleOwnRows.data).toHaveLength(1);
    const hiddenForeignRows = await studentB.client.from('tec_language_placement_attempts_v1')
      .select('id').eq('institution_id', institutionA);
    expect(hiddenForeignRows.error).toBeNull();
    expect(hiddenForeignRows.data).toHaveLength(0);

    const directWrite = await studentA.client.from('tec_language_placement_attempts_v1').insert({
      institution_id: institutionA,
      student_id: studentIdA,
      course_code: courseCode,
      attempt_id: randomUUID(),
      diagnostic_version: 1,
      result_kind: 'ASSESSMENT',
      score: 5,
      question_count: 5,
      highest_difficulty: 3,
      recommended_unit_position: 4,
    });
    expect(directWrite.error?.code).toBe('42501');

    const forbiddenCourse = await studentA.client.rpc('get_tec_language_placement_v1', {
      p_institution_id: institutionA, p_course_code: 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
    });
    expect(forbiddenCourse.error?.code).toBe('22023');
    const nullCourse = await studentA.client.rpc('get_tec_language_placement_v1', {
      p_institution_id: institutionA, p_course_code: null,
    });
    expect(nullCourse.error?.code).toBe('22023');

    const rowCount = await service.from('tec_language_placement_attempts_v1')
      .select('id', { count: 'exact', head: true }).eq('student_id', studentIdA);
    expect(rowCount.error).toBeNull();
    expect(rowCount.count).toBe(1);
    const statsAfter = await service.from('tec_language_course_stats_v1').select('*')
      .eq('institution_id', institutionA).eq('student_id', studentIdA).order('course_code');
    expect(statsAfter.error).toBeNull();
    expect(statsAfter.data).toEqual(statsBefore.data);
  });

  it('resets only the selected active activity, serializes retries, and rejects another student', async () => {
    const courseCode = 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION';
    const map = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: courseCode,
    });
    expect(map.error).toBeNull();
    const lesson = map.data.units[0].lessons[1];
    const started = await studentA.client.rpc('start_tec_language_lesson_v1', {
      p_institution_id: institutionA, p_course_code: courseCode, p_lesson_id: lesson.id,
    });
    expect(started.error).toBeNull();
    const sourceSessionId = started.data.session_id as string;
    const exercise = (await exercisesFor(service, lesson.id))[0];
    const partialAnswer = await studentA.client.rpc('submit_tec_language_answer_v1', {
      p_institution_id: institutionA,
      p_course_code: courseCode,
      p_session_id: sourceSessionId,
      p_exercise_id: exercise.id,
      p_response: answerFor(exercise),
      p_idempotency_key: randomUUID(),
    });
    expect(partialAnswer.error).toBeNull();
    expect(partialAnswer.data.session_complete).toBe(false);
    expect(partialAnswer.data.xp_awarded).toBe(0);

    const unaffectedCourse = 'TEC_SPANISH_FOUNDATIONS_V1';
    const unaffectedMap = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: unaffectedCourse,
    });
    const unaffectedLesson = unaffectedMap.data.units[0].lessons[1];
    const unaffectedSession = await studentA.client.rpc('start_tec_language_lesson_v1', {
      p_institution_id: institutionA, p_course_code: unaffectedCourse, p_lesson_id: unaffectedLesson.id,
    });
    expect(unaffectedSession.error).toBeNull();
    const xpBefore = map.data.stats.xp;

    const foreignReset = await studentB.client.rpc('reset_tec_language_activity_v1', {
      p_institution_id: institutionA, p_course_code: courseCode, p_lesson_id: lesson.id, p_session_id: sourceSessionId,
    });
    expect(foreignReset.error?.code).toBe('42501');

    const resetArgs = {
      p_institution_id: institutionA,
      p_course_code: courseCode,
      p_lesson_id: lesson.id,
      p_session_id: sourceSessionId,
    };
    const [first, retry] = await Promise.all([
      studentA.client.rpc('reset_tec_language_activity_v1', resetArgs),
      studentA.client.rpc('reset_tec_language_activity_v1', resetArgs),
    ]);
    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    expect(first.data.session_id).toBe(retry.data.session_id);
    expect([first.data.replayed, retry.data.replayed].sort()).toEqual([false, true]);
    expect(first.data).toMatchObject({ course_code: courseCode, lesson_id: lesson.id, current_position: 1, reset: true });

    const oldSession = await service.from('tec_english_lesson_sessions').select('id').eq('id', sourceSessionId);
    expect(oldSession.error).toBeNull();
    expect(oldSession.data).toHaveLength(0);
    const oldAnswers = await service.from('tec_english_answer_attempts').select('id').eq('session_id', sourceSessionId);
    expect(oldAnswers.error).toBeNull();
    expect(oldAnswers.data).toHaveLength(0);
    const otherSession = await service.from('tec_english_lesson_sessions').select('id,status')
      .eq('id', unaffectedSession.data.session_id).eq('student_id', studentIdA).single();
    expect(otherSession.error).toBeNull();
    expect(otherSession.data.status).toBe('IN_PROGRESS');

    const mapAfter = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: courseCode,
    });
    expect(mapAfter.error).toBeNull();
    expect(mapAfter.data.stats.xp).toBe(xpBefore);
  });

  it('resets one learner language without changing other languages, learners, or institutions', async () => {
    const englishCode = 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION';
    const spanishCode = 'TEC_SPANISH_FOUNDATIONS_V1';
    const koreanCode = 'TEC_KOREAN_FOUNDATIONS_V1';
    const beginnerEnglishCode = 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER';

    const beginnerMap = await studentB.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionB, p_course_code: beginnerEnglishCode,
    });
    expect(beginnerMap.error).toBeNull();
    const beginnerLessonId = beginnerMap.data.units[0].lessons[0].id as string;
    await completeLesson(service, studentB, institutionB, beginnerEnglishCode, beginnerLessonId);

    const englishBefore = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: englishCode,
    });
    const spanishBefore = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: spanishCode,
    });
    const koreanBefore = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: koreanCode,
    });
    const otherLearnerBefore = await studentB.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionB, p_course_code: beginnerEnglishCode,
    });
    expect(englishBefore.data.completed_lessons).toBeGreaterThan(0);
    expect(spanishBefore.data.stats.xp).toBe(30);
    expect(koreanBefore.data.stats.xp).toBe(30);
    expect(otherLearnerBefore.data.stats.xp).toBe(30);

    const placementBefore = await studentA.client.rpc('get_tec_language_placement_v1', {
      p_institution_id: institutionA, p_course_code: beginnerEnglishCode,
    });
    expect(placementBefore.error).toBeNull();
    expect(placementBefore.data.attemptId).toBeTruthy();

    const anonymous = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const anonymousReset = await anonymous.rpc('reset_tec_language_course_v1', {
      p_institution_id: institutionA, p_locale: 'en',
    });
    expect(anonymousReset.error).toBeTruthy();
    const crossInstitutionReset = await studentB.client.rpc('reset_tec_language_course_v1', {
      p_institution_id: institutionA, p_locale: 'en',
    });
    expect(crossInstitutionReset.error?.code).toBe('42501');
    const inactiveReset = await studentInactive.client.rpc('reset_tec_language_course_v1', {
      p_institution_id: institutionInactive, p_locale: 'en',
    });
    expect(inactiveReset.error?.code).toBe('42501');

    const reset = await studentA.client.rpc('reset_tec_language_course_v1', {
      p_institution_id: institutionA, p_locale: 'en',
    });
    expect(reset.error).toBeNull();
    expect(reset.data).toMatchObject({ reset: true, locale: 'en', replayed: false });
    expect(reset.data.course_codes).toContain(englishCode);
    const repeatedReset = await studentA.client.rpc('reset_tec_language_course_v1', {
      p_institution_id: institutionA, p_locale: 'en',
    });
    expect(repeatedReset.error).toBeNull();
    expect(repeatedReset.data.global_xp_removed).toBe(0);

    const englishAfter = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: englishCode,
    });
    const beginnerEnglishAfter = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: beginnerEnglishCode,
    });
    const spanishAfter = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: spanishCode,
    });
    const koreanAfter = await studentA.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionA, p_course_code: koreanCode,
    });
    const otherLearnerAfter = await studentB.client.rpc('get_tec_language_course_map_v1', {
      p_institution_id: institutionB, p_course_code: beginnerEnglishCode,
    });
    expect(englishAfter.error).toBeNull();
    expect(englishAfter.data.completed_lessons).toBe(0);
    expect(englishAfter.data.stats.xp).toBe(0);
    expect(beginnerEnglishAfter.data.completed_lessons).toBe(0);
    expect(beginnerEnglishAfter.data.stats.xp).toBe(0);
    expect(spanishAfter.data.completed_lessons).toBe(1);
    expect(spanishAfter.data.stats.xp).toBe(30);
    expect(koreanAfter.data.completed_lessons).toBe(1);
    expect(koreanAfter.data.stats.xp).toBe(30);
    expect(otherLearnerAfter.data.completed_lessons).toBe(1);
    expect(otherLearnerAfter.data.stats.xp).toBe(30);

    const placementAfter = await studentA.client.rpc('get_tec_language_placement_v1', {
      p_institution_id: institutionA, p_course_code: beginnerEnglishCode,
    });
    expect(placementAfter.error).toBeNull();
    expect(placementAfter.data).toEqual({ attemptId: null, record: null });
  });
});
