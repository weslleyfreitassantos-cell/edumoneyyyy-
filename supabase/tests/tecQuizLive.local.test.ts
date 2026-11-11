import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; client: Db; fullName: string };

const url = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const isLoopback = (() => {
  if (!url) return false;
  try { return ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname); }
  catch { return false; }
})();
if (url && !isLoopback) throw new Error('Tec Quiz Live integration tests require a loopback Supabase instance.');
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

async function createActor(
  service: Db,
  institutionId: string,
  role: 'TEACHER' | 'STUDENT',
  emailLabel: string,
  suffix: string,
): Promise<Actor> {
  const email = `tec-quiz-${suffix}-${emailLabel}@local.test`;
  const fullName = `Fake Quiz ${emailLabel} ${suffix}`;
  const password = 'TecQuizLive-Test!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${role}: ${error.message}`);
  const user = required(data.user, `${role} auth user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: fullName, email, role, active: true });
  await insertOne(service, 'memberships', { profile_id: user.id, institution_id: institutionId, role, active: true });
  const client = createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: `tec-quiz-${suffix}-${emailLabel}` },
  });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ${role}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, client, fullName };
}

async function waitFor<T>(predicate: () => T | undefined, timeoutMs: number, label: string): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = predicate();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function executeLocalSql(sql: string) {
  const tempDir = mkdtempSync(join(tmpdir(), 'tec-quiz-live-sql-'));
  const sqlFile = join(tempDir, 'fixture.sql');
  const supabaseCli = resolve(process.cwd(), 'node_modules/supabase/dist/supabase.js');

  try {
    writeFileSync(sqlFile, sql, { encoding: 'utf8', mode: 0o600 });
    execFileSync(process.execPath, [supabaseCli, 'db', 'query', '--local', '--file', sqlFile], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function requireGameUuid(id: string) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) {
    throw new Error('Quiz game RPC returned an invalid UUID.');
  }
  return id;
}

function expireRound(id: string) {
  const gameId = requireGameUuid(id);
  executeLocalSql(`
    UPDATE public.tec_quiz_games
    SET round_deadline_at = now() - interval '5 seconds'
    WHERE id = '${gameId}'::uuid;
  `);
}

function clearRoundDeadline(id: string) {
  const gameId = requireGameUuid(id);
  executeLocalSql(`
    UPDATE public.tec_quiz_games
    SET round_deadline_at = NULL
    WHERE id = '${gameId}'::uuid;
  `);
}

localDescribe('Tec Quiz Live V1 against disposable local Supabase', () => {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const profileIds: string[] = [];
  let service: Db;
  let institutionId: string;
  let foreignInstitutionId: string;
  let yearId: string;
  let foreignYearId: string;
  let termId: string;
  let classId: string;
  let foreignClassId: string;
  let subjectId: string;
  let activityId: string;
  let studentIds: string[] = [];
  let gameId: string;
  let pin: string;
  let teacher: Actor;
  let hostTeacher: Actor;
  let studentOne: Actor;
  let studentTwo: Actor;
  let foreignStudent: Actor;
  let realtimeChannel: ReturnType<Db['channel']> | undefined;

  beforeAll(async () => {
    service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    institutionId = (await insertOne(service, 'institutions', { name: `Tec Quiz ${suffix}`, active: true })).id;
    foreignInstitutionId = (await insertOne(service, 'institutions', { name: `Tec Quiz Foreign ${suffix}`, active: true })).id;
    yearId = (await insertOne(service, 'academic_years', {
      institution_id: institutionId, name: `Year ${suffix}`, start_date: '2026-01-01', end_date: '2027-12-31', active: true,
    })).id;
    foreignYearId = (await insertOne(service, 'academic_years', {
      institution_id: foreignInstitutionId, name: `Foreign Year ${suffix}`, start_date: '2026-01-01', end_date: '2027-12-31', active: true,
    })).id;
    termId = (await insertOne(service, 'terms', {
      academic_year_id: yearId, name: `Term ${suffix}`, start_date: '2026-01-01', end_date: '2027-12-31', active: true,
    })).id;
    classId = (await insertOne(service, 'classes', {
      institution_id: institutionId, academic_year_id: yearId, name: `Quiz Class ${suffix}`, active: true,
    })).id;
    foreignClassId = (await insertOne(service, 'classes', {
      institution_id: foreignInstitutionId, academic_year_id: foreignYearId, name: `Foreign Class ${suffix}`, active: true,
    })).id;
    [teacher, hostTeacher, studentOne, studentTwo, foreignStudent] = await Promise.all([
      createActor(service, institutionId, 'TEACHER', 'teacher', suffix),
      createActor(service, institutionId, 'TEACHER', 'quiz-host', suffix),
      createActor(service, institutionId, 'STUDENT', 'student-one', suffix),
      createActor(service, institutionId, 'STUDENT', 'student-two', suffix),
      createActor(service, foreignInstitutionId, 'STUDENT', 'foreign-student', suffix),
    ]);
    profileIds.push(teacher.id, hostTeacher.id, studentOne.id, studentTwo.id, foreignStudent.id);
    const studentOneId = (await insertOne(service, 'students', {
      profile_id: studentOne.id, institution_id: institutionId, registration_number: `Q-${suffix}-1`, active: true,
    })).id;
    const studentTwoId = (await insertOne(service, 'students', {
      profile_id: studentTwo.id, institution_id: institutionId, registration_number: `Q-${suffix}-2`, active: true,
    })).id;
    const foreignStudentId = (await insertOne(service, 'students', {
      profile_id: foreignStudent.id, institution_id: foreignInstitutionId, registration_number: `QF-${suffix}`, active: true,
    })).id;
    studentIds = [studentOneId, studentTwoId, foreignStudentId];
    await Promise.all([
      insertOne(service, 'enrollments', { student_id: studentOneId, class_id: classId, academic_year_id: yearId, status: 'active', active: true }),
      insertOne(service, 'enrollments', { student_id: studentTwoId, class_id: classId, academic_year_id: yearId, status: 'active', active: true }),
      insertOne(service, 'enrollments', { student_id: foreignStudentId, class_id: foreignClassId, academic_year_id: foreignYearId, status: 'active', active: true }),
    ]);
    subjectId = (await insertOne(service, 'subjects', {
      institution_id: institutionId, name: `Quiz Subject ${suffix}`, code: `QZ-${suffix}`, active: true,
    })).id;
    await insertOne(service, 'class_curriculum_items', {
      institution_id: institutionId, class_id: classId, subject_id: subjectId,
      weekly_lessons: 1, lesson_duration_minutes: 45, active: true,
    });
    await insertOne(service, 'subject_offerings', {
      class_id: classId, subject_id: subjectId, teacher_profile_id: teacher.id, term_id: termId, active: true,
    });
    await insertOne(service, 'subject_offerings', {
      class_id: classId, subject_id: subjectId, teacher_profile_id: hostTeacher.id, term_id: termId, active: true,
    });
    activityId = (await insertOne(service, 'learning_activities', {
      institution_id: institutionId, subject_id: subjectId, teacher_id: teacher.id,
      title: `Live quiz activity ${suffix}`, status: 'PUBLISHED',
    })).id;
    await insertOne(service, 'learning_assignments', {
      institution_id: institutionId, activity_id: activityId, class_id: classId, assigned_by: teacher.id,
    });
    for (let index = 0; index < 3; index += 1) {
      await insertOne(service, 'learning_questions', {
        institution_id: institutionId, activity_id: activityId,
        question_text: `Question ${index + 1} ${suffix}`, question_type: 'MULTIPLE_CHOICE',
        options_json: ['Correct answer', 'Distractor'], correct_answer_json: 'Correct answer',
        explanation: `Explanation ${index + 1}`, points: 1, sort_order: index,
      });
    }
    await insertOne(service, 'learning_questions', {
      institution_id: institutionId, activity_id: activityId,
      question_text: `Short answer ${suffix}`, question_type: 'SHORT_ANSWER',
      options_json: [], correct_answer_json: 'Written response', points: 1, sort_order: 3,
    });
  }, 120_000);

  afterAll(async () => {
    if (realtimeChannel) await hostTeacher?.client.removeChannel(realtimeChannel);
    if (!service) return;
    if (institutionId) await service.from('tec_quiz_games').delete().eq('institution_id', institutionId);
    if (activityId) {
      await service.from('learning_assignments').delete().eq('activity_id', activityId);
      await service.from('learning_questions').delete().eq('activity_id', activityId);
      await service.from('learning_activities').delete().eq('id', activityId);
    }
    if (classId || foreignClassId) await service.from('subject_offerings').delete().in('class_id', [classId, foreignClassId].filter(Boolean));
    if (classId) await service.from('class_curriculum_items').delete().eq('class_id', classId);
    if (studentIds.length) await service.from('enrollments').delete().in('student_id', studentIds);
    if (studentIds.length) await service.from('students').delete().in('id', studentIds);
    if (classId || foreignClassId) await service.from('classes').delete().in('id', [classId, foreignClassId].filter(Boolean));
    if (termId) await service.from('terms').delete().eq('id', termId);
    if (yearId || foreignYearId) await service.from('academic_years').delete().in('id', [yearId, foreignYearId].filter(Boolean));
    if (subjectId) await service.from('subjects').delete().eq('id', subjectId);
    if (profileIds.length) {
      await service.from('memberships').delete().in('profile_id', profileIds);
      await service.from('profiles').delete().in('id', profileIds);
      for (const id of profileIds) await service.auth.admin.deleteUser(id);
    }
    if (institutionId || foreignInstitutionId) {
      await service.from('institutions').delete().in('id', [institutionId, foreignInstitutionId].filter(Boolean));
    }
  }, 120_000);

  it('plays, scores, reveals and resumes one isolated live game with two authenticated students', async () => {
    const ownerOptions = await teacher.client.rpc('tec_quiz_teacher_options_v1');
    expect(ownerOptions.error).toBeNull();
    expect(ownerOptions.data).toHaveLength(1);
    const available = await hostTeacher.client.rpc('tec_quiz_teacher_options_v1');
    expect(available.error).toBeNull();
    expect(available.data).toHaveLength(1);
    expect(available.data[0]).toMatchObject({ activity_id: activityId, class_id: classId, question_count: 3 });

    const created = await hostTeacher.client.rpc('tec_quiz_create_game_v1', {
      p_activity_id: activityId, p_class_id: classId,
      p_time_per_question_seconds: 20, p_base_points: 500,
    });
    expect(created.error).toBeNull();
    gameId = created.data.game_id;
    pin = created.data.pin;
    expect(pin).toMatch(/^[0-9]{6}$/);

    const realtimeEvents: unknown[] = [];
    const realtimeStatuses: string[] = [];
    let finishSubscribe!: (status: string) => void;
    const subscribed = new Promise<string>((resolve) => { finishSubscribe = resolve; });
    realtimeChannel = hostTeacher.client
      .channel(`tec-quiz:${gameId}`, { config: { private: true } })
      .on('broadcast', { event: 'tec_quiz_state_changed' }, (payload: unknown) => realtimeEvents.push(payload))
      .subscribe((status) => {
        realtimeStatuses.push(status);
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') finishSubscribe(status);
      });
    expect(await Promise.race([subscribed, new Promise<string>((resolve) => setTimeout(() => resolve('WAIT_TIMEOUT'), 10_000))])).toBe('SUBSCRIBED');

    const deniedForeignJoin = await foreignStudent.client.rpc('tec_quiz_join_v1', { p_pin: pin });
    expect(deniedForeignJoin.error?.message).toContain('TEC_QUIZ_STUDENT_CLASS_SCOPE_DENIED');
    const joinOne = await studentOne.client.rpc('tec_quiz_join_v1', { p_pin: pin });
    const prematureStart = await hostTeacher.client.rpc('tec_quiz_start_v1', { p_game_id: gameId });
    expect(prematureStart.error?.message).toContain('TEC_QUIZ_REQUIRES_TWO_STUDENTS');
    const joinTwo = await studentTwo.client.rpc('tec_quiz_join_v1', { p_pin: pin });
    expect(joinOne.error).toBeNull();
    expect(joinTwo.error).toBeNull();
    expect(joinOne.data.game_id).toBe(gameId);
    expect(joinTwo.data.game_id).toBe(gameId);
    const [rosterOne, currentGameOne] = await Promise.all([
      studentOne.client.rpc('tec_quiz_state_v1', { p_game_id: gameId }),
      studentOne.client.rpc('tec_quiz_my_current_game_v1'),
    ]);
    expect(rosterOne.data.participants).toHaveLength(2);
    expect(currentGameOne.data).toBe(gameId);
    expect(await waitFor(() => realtimeEvents[0], 20_000, `private Realtime event (${realtimeStatuses.join(',')})`)).toBeTruthy();

    const started = await hostTeacher.client.rpc('tec_quiz_start_v1', { p_game_id: gameId });
    expect(started.error).toBeNull();
    expect(started.data.status).toBe('IN_PROGRESS');
    const startedState = await hostTeacher.client.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    expect(startedState.error).toBeNull();
    expect(Number.isFinite(Date.parse(startedState.data.server_now))).toBe(true);
    expect(Date.parse(startedState.data.round_deadline_at)).toBeGreaterThan(Date.now());
    const initialSeconds = Date.parse(startedState.data.round_deadline_at) - Date.parse(startedState.data.server_now);
    expect(initialSeconds).toBeGreaterThan(15_000);
    expect(initialSeconds).toBeLessThanOrEqual(20_000);
    const foreignState = await foreignStudent.client.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    expect(foreignState.error?.message).toContain('TEC_QUIZ_ACCESS_DENIED');
    const foreignTick = await foreignStudent.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId });
    expect(foreignTick.error?.message).toContain('TEC_QUIZ_ACCESS_DENIED');
    const foreignAnswer = await foreignStudent.client.rpc('tec_quiz_submit_answer_v2', {
      p_game_id: gameId, p_expected_question_index: 1, p_selected_option_index: 0,
    });
    expect(foreignAnswer.error?.message).toContain('TEC_QUIZ_STUDENT_SCOPE_DENIED');
    const invalidOption = await studentOne.client.rpc('tec_quiz_submit_answer_v2', {
      p_game_id: gameId, p_expected_question_index: 1, p_selected_option_index: 9,
    });
    expect(invalidOption.error?.message).toContain('TEC_QUIZ_OPTION_INVALID');

    const beforeReveal = await studentOne.client.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    expect(beforeReveal.error).toBeNull();
    expect(Number.isFinite(Date.parse(beforeReveal.data.server_now))).toBe(true);
    expect(beforeReveal.data.question).not.toHaveProperty('correct_option_index');
    expect(beforeReveal.data.question).not.toHaveProperty('explanation');
    expect(beforeReveal.data.leaderboard).toEqual([]);
    expect(beforeReveal.data.participants).toHaveLength(2);
    expect(JSON.stringify(beforeReveal.data)).not.toContain(studentOne.fullName);
    expect(JSON.stringify(beforeReveal.data)).not.toContain(studentTwo.fullName);

    const staleClientAnswer = await studentOne.client.rpc('tec_quiz_submit_answer_v1', {
      p_game_id: gameId,
      p_selected_option_index: 0,
    });
    expect(staleClientAnswer.error?.message).toContain('TEC_QUIZ_CLIENT_UPDATE_REQUIRED');

    const [firstAnswer, repeatedAnswer, wrongAnswer] = await Promise.all([
      studentOne.client.rpc('tec_quiz_submit_answer_v2', {
        p_game_id: gameId, p_expected_question_index: 1, p_selected_option_index: 0,
      }),
      studentOne.client.rpc('tec_quiz_submit_answer_v2', {
        p_game_id: gameId, p_expected_question_index: 1, p_selected_option_index: 0,
      }),
      studentTwo.client.rpc('tec_quiz_submit_answer_v2', {
        p_game_id: gameId, p_expected_question_index: 1, p_selected_option_index: 1,
      }),
    ]);
    expect(firstAnswer.error).toBeNull();
    expect(repeatedAnswer.error).toBeNull();
    expect([firstAnswer.data.already_submitted, repeatedAnswer.data.already_submitted].sort()).toEqual([false, true]);
    expect(firstAnswer.data.accepted).toBe(true);
    expect(repeatedAnswer.data.accepted).toBe(true);
    expect(wrongAnswer.error).toBeNull();
    expireRound(gameId);
    const [revealedOne, revealedTwo] = await Promise.all([
      studentOne.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId }),
      studentTwo.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId }),
    ]);
    expect(revealedOne.error).toBeNull();
    expect(revealedTwo.error).toBeNull();
    expect(revealedOne.data.status).toBe('INTERMISSION');
    expect(revealedTwo.data.status).toBe('INTERMISSION');
    expect(Date.parse(revealedOne.data.round_deadline_at)).toBeGreaterThan(Date.now());
    const afterReveal = await studentOne.client.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    expect(afterReveal.data.question).toMatchObject({ correct_option_index: 0, explanation: 'Explanation 1' });
    expect(afterReveal.data.my_answer).toMatchObject({ submitted: true, is_correct: true });
    expect(afterReveal.data.leaderboard).toHaveLength(2);
    expect(afterReveal.data.leaderboard.every((entry: { score: number | null }) => typeof entry.score === 'number')).toBe(true);
    const revealedScores = afterReveal.data.leaderboard as Array<{ score: number; correct_count: number }>;
    expect(revealedScores.filter((entry) => entry.score >= 500 && entry.score <= 750 && entry.correct_count === 1)).toHaveLength(1);
    expect(revealedScores.filter((entry) => entry.score === 0 && entry.correct_count === 0)).toHaveLength(1);

    clearRoundDeadline(gameId);
    const repairedReveal = await studentTwo.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId });
    expect(repairedReveal.error).toBeNull();
    expect(repairedReveal.data).toMatchObject({ status: 'INTERMISSION', question_index: 1 });
    expect(Date.parse(repairedReveal.data.round_deadline_at)).toBeGreaterThan(Date.now());

    const studentControl = await studentOne.client.rpc('tec_quiz_control_reveal_v1', {
      p_game_id: gameId,
      p_action: 'PAUSE',
    });
    expect(studentControl.error?.message).toContain('TEC_QUIZ_TEACHER_SCOPE_DENIED');
    const pausedReveal = await hostTeacher.client.rpc('tec_quiz_control_reveal_v1', {
      p_game_id: gameId,
      p_action: 'PAUSE',
    });
    expect(pausedReveal.error).toBeNull();
    expect(pausedReveal.data.reveal_paused_at).toBeTruthy();
    const pausedState = await studentOne.client.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    expect(pausedState.data.reveal_paused_at).toBe(pausedReveal.data.reveal_paused_at);

    const pausedTick = await studentTwo.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId });
    expect(pausedTick.error).toBeNull();
    expect(pausedTick.data.status).toBe('INTERMISSION');
    expect(pausedTick.data.reveal_paused_at).toBe(pausedReveal.data.reveal_paused_at);
    await new Promise((resolve) => setTimeout(resolve, 80));

    const resumedReveal = await hostTeacher.client.rpc('tec_quiz_control_reveal_v1', {
      p_game_id: gameId,
      p_action: 'RESUME',
    });
    expect(resumedReveal.error).toBeNull();
    expect(resumedReveal.data.reveal_paused_at).toBeNull();
    expect(Date.parse(resumedReveal.data.round_deadline_at)).toBeGreaterThan(
      Date.parse(pausedReveal.data.round_deadline_at),
    );

    const earlyTick = await studentTwo.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId });
    expect(earlyTick.error).toBeNull();
    expect(earlyTick.data.status).toBe('INTERMISSION');
    const nextQuestion = await hostTeacher.client.rpc('tec_quiz_control_reveal_v1', {
      p_game_id: gameId,
      p_action: 'ADVANCE',
    });
    expect(nextQuestion.error).toBeNull();
    expect(nextQuestion.data).toMatchObject({ status: 'IN_PROGRESS', question_index: 2 });
    expect(Date.parse(nextQuestion.data.round_deadline_at)).toBeGreaterThan(Date.now());

    const staleQuestionAnswer = await studentOne.client.rpc('tec_quiz_submit_answer_v2', {
      p_game_id: gameId,
      p_expected_question_index: 1,
      p_selected_option_index: 0,
    });
    expect(staleQuestionAnswer.error?.message).toContain('TEC_QUIZ_QUESTION_CHANGED');

    clearRoundDeadline(gameId);
    const repairedTimer = await studentOne.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId });
    expect(repairedTimer.error).toBeNull();
    expect(repairedTimer.data).toMatchObject({ status: 'IN_PROGRESS', question_index: 2 });
    expect(Date.parse(repairedTimer.data.round_deadline_at)).toBeGreaterThan(Date.now());

    const [answerOne, answerTwo] = await Promise.all([
      studentOne.client.rpc('tec_quiz_submit_answer_v2', {
        p_game_id: gameId, p_expected_question_index: 2, p_selected_option_index: 0,
      }),
      studentTwo.client.rpc('tec_quiz_submit_answer_v2', {
        p_game_id: gameId, p_expected_question_index: 2, p_selected_option_index: 0,
      }),
    ]);
    expect(answerOne.error).toBeNull();
    expect(answerTwo.error).toBeNull();
    expireRound(gameId);
    const revealSecondQuestion = await studentOne.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId });
    expect(revealSecondQuestion.error).toBeNull();
    expect(revealSecondQuestion.data.status).toBe('INTERMISSION');
    const secondRevealState = await studentTwo.client.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    expect(secondRevealState.data.question).toMatchObject({ correct_option_index: 0, explanation: 'Explanation 2' });
    expireRound(gameId);

    const thirdQuestion = await studentTwo.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId });
    expect(thirdQuestion.error).toBeNull();
    expect(thirdQuestion.data).toMatchObject({ status: 'IN_PROGRESS', question_index: 3 });
    expireRound(gameId);
    const lateAnswer = await studentOne.client.rpc('tec_quiz_submit_answer_v2', {
      p_game_id: gameId,
      p_expected_question_index: 3,
      p_selected_option_index: 0,
    });
    expect(lateAnswer.error?.message).toContain('TEC_QUIZ_ROUND_CLOSED');
    const revealThirdQuestion = await studentTwo.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId });
    expect(revealThirdQuestion.error).toBeNull();
    expect(revealThirdQuestion.data.status).toBe('INTERMISSION');
    expireRound(gameId);

    const finished = await studentOne.client.rpc('tec_quiz_tick_v1', { p_game_id: gameId });
    expect(finished.error).toBeNull();
    expect(finished.data.status).toBe('FINISHED');
    const [finalTeacher, finalStudent] = await Promise.all([
      hostTeacher.client.rpc('tec_quiz_state_v1', { p_game_id: gameId }),
      studentOne.client.rpc('tec_quiz_state_v1', { p_game_id: gameId }),
    ]);
    expect(finalTeacher.data.report).toHaveLength(2);
    expect(finalStudent.data.report).toEqual(finalTeacher.data.report);
    expect(JSON.stringify(finalStudent.data.report)).not.toContain(studentOne.fullName);
    const rejoined = await studentOne.client.rpc('tec_quiz_join_v1', { p_pin: pin });
    expect(rejoined.error).toBeNull();
    expect(rejoined.data).toMatchObject({ game_id: gameId, status: 'FINISHED' });

    for (const duration of [10, 120]) {
      const durationGame = await hostTeacher.client.rpc('tec_quiz_create_game_v1', {
        p_activity_id: activityId,
        p_class_id: classId,
        p_time_per_question_seconds: duration,
        p_base_points: 500,
      });
      expect(durationGame.error).toBeNull();
      const durationPin = durationGame.data.pin as string;
      const [durationJoinOne, durationJoinTwo] = await Promise.all([
        studentOne.client.rpc('tec_quiz_join_v1', { p_pin: durationPin }),
        studentTwo.client.rpc('tec_quiz_join_v1', { p_pin: durationPin }),
      ]);
      expect(durationJoinOne.error).toBeNull();
      expect(durationJoinTwo.error).toBeNull();
      const durationStarted = await hostTeacher.client.rpc('tec_quiz_start_v1', {
        p_game_id: durationGame.data.game_id,
      });
      expect(durationStarted.error).toBeNull();
      const durationState = await studentOne.client.rpc('tec_quiz_state_v1', {
        p_game_id: durationGame.data.game_id,
      });
      expect(durationState.error).toBeNull();
      const actualDuration = Date.parse(durationState.data.round_deadline_at)
        - Date.parse(durationState.data.server_now);
      expect(actualDuration).toBeGreaterThan(duration * 1000 - 1_000);
      expect(actualDuration).toBeLessThanOrEqual(duration * 1000);
    }

    const directTableRead = await studentOne.client.from('tec_quiz_answers').select('*').limit(1);
    expect(directTableRead.error).not.toBeNull();
  }, 120_000);
});
