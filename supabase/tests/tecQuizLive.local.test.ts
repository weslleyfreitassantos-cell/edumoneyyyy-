import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
    [teacher, studentOne, studentTwo, foreignStudent] = await Promise.all([
      createActor(service, institutionId, 'TEACHER', 'teacher', suffix),
      createActor(service, institutionId, 'STUDENT', 'student-one', suffix),
      createActor(service, institutionId, 'STUDENT', 'student-two', suffix),
      createActor(service, foreignInstitutionId, 'STUDENT', 'foreign-student', suffix),
    ]);
    profileIds.push(teacher.id, studentOne.id, studentTwo.id, foreignStudent.id);
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
    await insertOne(service, 'subject_offerings', {
      class_id: classId, subject_id: subjectId, teacher_profile_id: teacher.id, term_id: termId, active: true,
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
  }, 120_000);

  afterAll(async () => {
    if (realtimeChannel) await teacher?.client.removeChannel(realtimeChannel);
    if (!service) return;
    if (institutionId) await service.from('tec_quiz_games').delete().eq('institution_id', institutionId);
    if (activityId) {
      await service.from('learning_assignments').delete().eq('activity_id', activityId);
      await service.from('learning_questions').delete().eq('activity_id', activityId);
      await service.from('learning_activities').delete().eq('id', activityId);
    }
    if (classId || foreignClassId) await service.from('subject_offerings').delete().in('class_id', [classId, foreignClassId].filter(Boolean));
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
    const available = await teacher.client.rpc('tec_quiz_teacher_options_v1');
    expect(available.error).toBeNull();
    expect(available.data).toHaveLength(1);
    expect(available.data[0]).toMatchObject({ activity_id: activityId, class_id: classId, question_count: 3 });

    const created = await teacher.client.rpc('tec_quiz_create_game_v1', {
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
    realtimeChannel = teacher.client
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
    const prematureStart = await teacher.client.rpc('tec_quiz_start_v1', { p_game_id: gameId });
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

    const started = await teacher.client.rpc('tec_quiz_start_v1', { p_game_id: gameId });
    expect(started.error).toBeNull();
    expect(started.data.status).toBe('IN_PROGRESS');
    const foreignState = await foreignStudent.client.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    expect(foreignState.error?.message).toContain('TEC_QUIZ_ACCESS_DENIED');

    const beforeReveal = await studentOne.client.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    expect(beforeReveal.error).toBeNull();
    expect(beforeReveal.data.question).not.toHaveProperty('correct_option_index');
    expect(beforeReveal.data.question).not.toHaveProperty('explanation');
    expect(beforeReveal.data.leaderboard).toEqual([]);
    expect(beforeReveal.data.participants).toHaveLength(2);
    expect(JSON.stringify(beforeReveal.data)).not.toContain(studentOne.fullName);
    expect(JSON.stringify(beforeReveal.data)).not.toContain(studentTwo.fullName);

    const firstAnswer = await studentOne.client.rpc('tec_quiz_submit_answer_v1', { p_game_id: gameId, p_selected_option_index: 0 });
    const repeatedAnswer = await studentOne.client.rpc('tec_quiz_submit_answer_v1', { p_game_id: gameId, p_selected_option_index: 0 });
    const wrongAnswer = await studentTwo.client.rpc('tec_quiz_submit_answer_v1', { p_game_id: gameId, p_selected_option_index: 1 });
    expect(firstAnswer.error).toBeNull();
    expect(repeatedAnswer.data).toMatchObject({ accepted: true, already_submitted: true });
    expect(wrongAnswer.error).toBeNull();
    const storedAnswers = await service.from('tec_quiz_answers').select('id').eq('game_id', gameId).eq('question_index', 1);
    expect(storedAnswers.error).toBeNull();
    expect(storedAnswers.data).toHaveLength(2);
    const revealed = await teacher.client.rpc('tec_quiz_advance_v1', { p_game_id: gameId });
    expect(revealed.data.status).toBe('INTERMISSION');
    const afterReveal = await studentOne.client.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    expect(afterReveal.data.question).toMatchObject({ correct_option_index: 0, explanation: 'Explanation 1' });
    expect(afterReveal.data.my_answer).toMatchObject({ submitted: true, is_correct: true });
    expect(afterReveal.data.leaderboard).toHaveLength(2);
    expect(afterReveal.data.leaderboard.every((entry: { score: number | null }) => typeof entry.score === 'number')).toBe(true);

    for (const questionIndex of [2, 3]) {
      const next = await teacher.client.rpc('tec_quiz_advance_v1', { p_game_id: gameId });
      expect(next.error).toBeNull();
      expect(next.data).toMatchObject({ status: 'IN_PROGRESS', question_index: questionIndex });
      const [answerOne, answerTwo] = await Promise.all([
        studentOne.client.rpc('tec_quiz_submit_answer_v1', { p_game_id: gameId, p_selected_option_index: 0 }),
        studentTwo.client.rpc('tec_quiz_submit_answer_v1', { p_game_id: gameId, p_selected_option_index: 0 }),
      ]);
      expect(answerOne.error).toBeNull();
      expect(answerTwo.error).toBeNull();
      const revealQuestion = await teacher.client.rpc('tec_quiz_advance_v1', { p_game_id: gameId });
      expect(revealQuestion.error).toBeNull();
      expect(revealQuestion.data.status).toBe('INTERMISSION');
    }

    const finished = await teacher.client.rpc('tec_quiz_advance_v1', { p_game_id: gameId });
    expect(finished.error).toBeNull();
    expect(finished.data.status).toBe('FINISHED');
    const [finalTeacher, finalStudent] = await Promise.all([
      teacher.client.rpc('tec_quiz_state_v1', { p_game_id: gameId }),
      studentOne.client.rpc('tec_quiz_state_v1', { p_game_id: gameId }),
    ]);
    expect(finalTeacher.data.report).toHaveLength(2);
    expect(finalStudent.data.report).toEqual(finalTeacher.data.report);
    expect(JSON.stringify(finalStudent.data.report)).not.toContain(studentOne.fullName);
    const rejoined = await studentOne.client.rpc('tec_quiz_join_v1', { p_pin: pin });
    expect(rejoined.error).toBeNull();
    expect(rejoined.data).toMatchObject({ game_id: gameId, status: 'FINISHED' });

    const directTableRead = await studentOne.client.from('tec_quiz_answers').select('*').limit(1);
    expect(directTableRead.error).not.toBeNull();
  }, 120_000);
});
