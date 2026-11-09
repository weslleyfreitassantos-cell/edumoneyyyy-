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
  let academicYearId: string;
  let termId: string;
  let studentId: string;
  let otherStudentId: string;
  let canonicalSkillId: string;
  const probeSetIds: string[] = [];
  const probeQuestionIds: string[] = [];
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
    academicYearId = year.id;
    const term = await insertOne(service, 'terms', {
      academic_year_id: year.id, name: `Term ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
    });
    termId = term.id;
    const schoolClass = await insertOne(service, 'classes', {
      institution_id: institutionId, academic_year_id: year.id, name: `1º ano V11 ${suffix}`,
      grade_level: '1', shift: 'INTEGRAL', active: true,
    });
    studentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: student.id, registration_number: `V11-${suffix}`, active: true,
    })).id;
    otherStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: otherStudent.id, registration_number: `V11-OTHER-${suffix}`, active: true,
    })).id;
    await insertOne(service, 'enrollments', {
      student_id: studentId, class_id: schoolClass.id, academic_year_id: year.id, status: 'active', active: true,
    });

    const catalog = await service.from('learning_curriculum_catalogs')
      .select('id').eq('code', 'BNCC_2018').eq('active', true).limit(1).single();
    if (catalog.error) throw new Error(`active BNCC catalog: ${catalog.error.message}`);

    const fixtureCode = 'EF01MA01';
    const canonicalSkill = await insertOne(service, 'learning_curriculum_skills', {
      catalog_id: catalog.data.id, code: fixtureCode, stage: 'ENSINO_FUNDAMENTAL', grade_level: 1,
      subject_area: 'MATHEMATICS', domain: 'NUMBER_SENSE', title: 'Números naturais em situações cotidianas',
      description: 'Utilizar números naturais como indicador de quantidade ou de ordem em diferentes situações cotidianas e reconhecer situações em que os números são usados como código de identificação.',
      active: true, node_kind: 'LEAF',
      content_readiness: 'ADAPTIVE_READY', mastery_targetable: true,
      pedagogical_review_status: 'PEDAGOGICAL_REVIEWED', bncc_alignment_status: 'MAPPED',
      publication_status: 'PUBLISHED',
      metadata: { official_code: fixtureCode },
    });
    canonicalSkillId = canonicalSkill.id;
    await insertOne(service, 'learning_curriculum_grade_targets', {
      catalog_id: catalog.data.id, stage: 'ENSINO_FUNDAMENTAL', grade_level: 1,
      subject_area: 'MATHEMATICS', canonical_skill_id: canonicalSkillId, active: true,
    });
    await insertOne(service, 'learning_skill_lessons', {
      canonical_skill_id: canonicalSkillId, version: 4, title: 'Números para contar e ordenar',
      summary: 'Números naturais podem indicar quantidades, posições em uma sequência ou códigos de identificação.',
      content_markdown: '## Usos dos números naturais\n\nOs números aparecem em situações diferentes. Ao contar objetos, indicam uma quantidade. Em uma fila, podem indicar a posição de cada pessoa. Em uma etiqueta ou matrícula, identificam algo e não representam uma quantidade.\n\nPara interpretar um número, observe o contexto e pergunte o que ele está informando. Uma coleção com oito livros tem quantidade oito; uma pessoa em terceiro lugar ocupa uma posição; um número de sala funciona como código. O mesmo símbolo pode ter funções diferentes em situações diferentes.',
      worked_example: 'Em uma caixa há oito lápis. O número 8 informa quantos lápis existem. Se Ana ocupa o terceiro lugar na fila, o número 3 informa sua ordem.',
      tips: ['Observe o contexto antes de interpretar o número.', 'Diferencie quantidade, ordem e código.'],
      estimated_minutes: 5, active: true, metadata: {},
    });
    const guidedQuestions = [
      { purpose: 'PROBE', statement: 'Uma coleção tem oito lápis. Qual número representa essa quantidade?', options: ['6', '7', '8', '9'], answer: '8', explanation: 'A quantidade de lápis pode ser contada e representada pelo número 8.' },
      { purpose: 'PRACTICE', statement: 'Em uma fila, Caio está imediatamente depois da segunda pessoa. Qual é sua posição?', options: ['1ª', '2ª', '3ª', '4ª'], answer: '3ª', explanation: 'Depois da segunda posição vem a terceira posição na ordem da fila.' },
      { purpose: 'TRANSFER', statement: 'Uma sala identificada pelo número 12 usa esse número principalmente como:', options: ['Quantidade de salas', 'Código de identificação', 'Posição de uma pessoa', 'Quantidade de estudantes'], answer: 'Código de identificação', explanation: 'O número no nome da sala identifica o local; não informa quantas salas há.' },
      { purpose: 'LOCK_IN', statement: 'Uma cesta tem cinco laranjas. O número 5, nessa situação, indica:', options: ['Uma posição', 'Um código', 'Uma quantidade', 'Um horário'], answer: 'Uma quantidade', explanation: 'O número informa quantas laranjas estão na cesta.' },
      { purpose: 'REVIEW', statement: 'Qual situação usa o número para indicar ordem?', options: ['O ônibus de código 14', 'A caixa com 14 livros', 'A 14ª pessoa da fila', 'A sala número 14'], answer: 'A 14ª pessoa da fila', explanation: 'O ordinal 14ª informa a posição ocupada pela pessoa na sequência.' },
    ] as const;
    for (const [position, question] of guidedQuestions.entries()) {
      const bankQuestion = await insertOne(service, 'learning_question_bank', {
        package_type: 'TECESCOLA', source_type: 'AUTHORED', subject_area: 'MATHEMATICS',
        domain: 'NUMBER_SENSE', topic: 'natural_numbers', statement: question.statement,
        options: question.options, correct_answer: question.answer, explanation: question.explanation,
        difficulty: position === 0 ? 'EASY' : 'MEDIUM', estimated_minutes: 1,
        provenance: 'AUTHORED', active: true, metadata: { official_bncc_code: fixtureCode },
      });
      probeQuestionIds.push(bankQuestion.id);
      const questionSet = await insertOne(service, 'learning_question_sets', {
        canonical_skill_id: canonicalSkillId, scope: 'GLOBAL', purpose: question.purpose, version: 4,
        difficulty: position === 0 ? 'EASY' : 'MEDIUM', active: true, metadata: {},
      });
      probeSetIds.push(questionSet.id);
      await insertOne(service, 'learning_question_set_items', {
        question_set_id: questionSet.id, question_bank_id: bankQuestion.id, position: 0,
      });
    }

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
    if (probeSetIds.length) {
      await service.from('learning_question_set_items').delete().in('question_set_id', probeSetIds);
      await service.from('learning_question_sets').delete().in('id', probeSetIds);
    }
    if (probeQuestionIds.length) await service.from('learning_question_bank').delete().in('id', probeQuestionIds);
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
    const foreignSubject = await insertOne(service, 'subjects', {
      institution_id: foreignInstitution.id, name: `Foreign V11 ${suffix}`, code: 'MAT', active: true,
    });
    await insertOne(service, 'learning_curriculum_subject_links', {
      institution_id: foreignInstitution.id, subject_id: foreignSubject.id, subject_area: 'MATEMATICA', active: true,
    });
    const foreignCurriculumLinks = await student.client.from('learning_curriculum_subject_links')
      .select('institution_id,subject_id').eq('institution_id', foreignInstitution.id);
    expect(foreignCurriculumLinks.error).toBeNull();
    expect(foreignCurriculumLinks.data).toEqual([]);
    await service.from('institutions').delete().eq('id', foreignInstitution.id);

    const highSchoolClass = await insertOne(service, 'classes', {
      institution_id: institutionId, academic_year_id: academicYearId, name: `1ª série EM V13 ${suffix}`,
      grade_level: '1ª série do Ensino Médio', shift: 'INTEGRAL', active: true,
    });
    await insertOne(service, 'enrollments', {
      student_id: otherStudentId, class_id: highSchoolClass.id, academic_year_id: academicYearId, status: 'active', active: true,
    });
    const mathSubject = await insertOne(service, 'subjects', {
      institution_id: institutionId, name: `Matemática V13 ${suffix}`, code: 'MAT', active: true,
    });
    await insertOne(service, 'class_curriculum_items', {
      institution_id: institutionId, class_id: highSchoolClass.id, subject_id: mathSubject.id,
      weekly_lessons: 4, lesson_duration_minutes: 50, active: true,
    });
    await insertOne(service, 'subject_offerings', {
      class_id: highSchoolClass.id, subject_id: mathSubject.id, teacher_profile_id: teacher.id,
      term_id: termId, active: true,
    });

    const v13Overview = await otherStudent.client.rpc('get_guided_study_overview_v11', { p_institution_id: institutionId });
    expect(v13Overview.error).toBeNull();
    expect(v13Overview.data?.state).toBe('READY');
    const v13Targets = await otherStudent.client.rpc('list_student_guided_learning_targets', {
      p_institution_id: institutionId, p_student_id: otherStudentId,
    });
    expect(v13Targets.error).toBeNull();
    expect(v13Targets.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ official_code: 'EM13MAT101', availability_status: expect.stringMatching(/READY|NO_ACTIVE_SESSION/) }),
    ]));
    const crossStudentTargets = await student.client.rpc('list_student_guided_learning_targets', {
      p_institution_id: institutionId, p_student_id: otherStudentId,
    });
    expect(crossStudentTargets.error).toBeNull();
    expect(crossStudentTargets.data).toEqual([]);
    const crossStudentProgress = await student.client.from('learning_student_skill_state')
      .select('student_id').eq('institution_id', institutionId).eq('student_id', otherStudentId);
    expect(crossStudentProgress.error).toBeNull();
    expect(crossStudentProgress.data).toEqual([]);

    const v13Start = await otherStudent.client.rpc('start_guided_study_v11', { p_institution_id: institutionId });
    expect(v13Start.error).toBeNull();
    const v13SessionId = required(v13Start.data?.session_id, 'V13 V11 session ID');
    const v13Session = await service.from('learning_guided_sessions')
      .select('id,metadata,current_step_id,status').eq('id', v13SessionId).single();
    expect(v13Session.error).toBeNull();
    expect(v13Session.data?.metadata).toEqual(expect.objectContaining({
      orchestration_version: 'V11', adaptive_policy_version: 'V8', content_version: 6,
    }));
    const initialV13Step = await service.from('learning_guided_steps')
      .select('step_type,purpose,question_set_id').eq('id', v13Session.data?.current_step_id).single();
    expect(initialV13Step.error).toBeNull();
    expect(initialV13Step.data).toMatchObject({ step_type: 'PROBE', purpose: 'PROBE' });
    const initialV13QuestionSet = await service.from('learning_question_sets')
      .select('canonical_skill_id,version,purpose').eq('id', initialV13Step.data?.question_set_id).single();
    expect(initialV13QuestionSet.error).toBeNull();
    expect(initialV13QuestionSet.data).toMatchObject({
      canonical_skill_id: v13Targets.data?.find((target: { official_code: string }) => target.official_code === 'EM13MAT101')?.target_canonical_skill_id,
      version: 6,
      purpose: 'PROBE',
    });

    const answerCurrentStep = async (stepId: string, makeFirstWrong = false) => {
      const currentStep = await service.from('learning_guided_steps')
        .select('id,step_type,purpose,question_set_id,lesson_id').eq('id', stepId).single();
      expect(currentStep.error).toBeNull();
      const stepView = await otherStudent.client.rpc('get_guided_learning_step_v4', { p_step_id: stepId });
      expect(stepView.error).toBeNull();
      const items = await service.from('learning_question_set_items').select('question_bank_id')
        .eq('question_set_id', currentStep.data?.question_set_id).order('position');
      expect(items.error).toBeNull();
      const bankRows = await service.from('learning_question_bank').select('id,correct_answer,options')
        .in('id', (items.data ?? []).map((item: { question_bank_id: string }) => item.question_bank_id));
      expect(bankRows.error).toBeNull();
      const answers = (items.data ?? []).map((item: { question_bank_id: string }, index: number) => {
        const bank = bankRows.data?.find((row: { id: string }) => row.id === item.question_bank_id);
        const correct = String(required(bank?.correct_answer, `V13 answer ${item.question_bank_id}`));
        const wrong = (bank?.options as unknown[]).find((option) => String(option) !== correct);
        return { question_bank_id: item.question_bank_id, answer: makeFirstWrong && index === 0 ? String(wrong) : correct };
      });
      const submitted = await otherStudent.client.rpc('submit_guided_learning_step_v4', {
        p_step_id: stepId, p_answers: answers, p_idempotency_key: `guided-v13:${suffix}:${stepId}`,
      });
      expect(submitted.error).toBeNull();
      return { step: currentStep.data, submission: submitted.data };
    };

    const probe = await answerCurrentStep(v13Session.data!.current_step_id!);
    expect(probe.step?.step_type).toBe('PROBE');
    expect(probe.submission?.score).toBe(100);
    const probeEvidence = await service.from('learning_skill_evidence').select('metadata,score')
      .eq('student_id', otherStudentId).contains('metadata', { guided_attempt_id: probe.submission?.attempt_id }).single();
    expect(probeEvidence.error).toBeNull();
    expect(probeEvidence.data?.metadata?.content_version).toBe(6);
    expect(probeEvidence.data?.score).toBe(100);

    const practiceStepId = required(probe.submission?.current_step_id, 'V13 practice step ID');
    const practice = await answerCurrentStep(practiceStepId, true);
    expect(practice.step?.step_type).toBe('PRACTICE');
    expect(practice.step?.purpose).toBe('PRACTICE');
    expect(practice.submission?.score).toBeLessThan(80);
    const remediationStepId = required(practice.submission?.current_step_id, 'V13 remediation lesson ID');
    const remediation = await service.from('learning_guided_steps')
      .select('id,step_type,lesson_id').eq('id', remediationStepId).single();
    expect(remediation.error).toBeNull();
    expect(remediation.data?.step_type).toBe('LESSON');
    const remediationLesson = await service.from('learning_skill_lessons').select('version')
      .eq('id', remediation.data?.lesson_id).single();
    expect(remediationLesson.data?.version).toBe(6);
    const remediationLessonView = await otherStudent.client.rpc('get_guided_learning_step_v4', { p_step_id: remediationStepId });
    expect(remediationLessonView.error).toBeNull();
    expect(remediationLessonView.data?.lesson?.content_markdown).toContain('Grandezas que variam');

    const crossStudentPause = await student.client.rpc('pause_guided_study_v11', {
      p_institution_id: institutionId, p_session_id: v13SessionId,
    });
    expect(crossStudentPause.error?.code).toBe('42501');

    const pausedV13 = await otherStudent.client.rpc('pause_guided_study_v11', {
      p_institution_id: institutionId, p_session_id: v13SessionId,
    });
    expect(pausedV13.error).toBeNull();
    expect(pausedV13.data?.status).toBe('PAUSED');
    const resumedV13 = await otherStudent.client.rpc('start_guided_study_v11', { p_institution_id: institutionId });
    expect(resumedV13.error).toBeNull();
    expect(resumedV13.data?.session_id).toBe(v13SessionId);
    const resumedV13Session = await service.from('learning_guided_sessions')
      .select('status,current_step_id').eq('id', v13SessionId).single();
    expect(resumedV13Session.data?.status).toBe('ACTIVE');
    expect(resumedV13Session.data?.current_step_id).toBe(remediationStepId);

    const completedRemediation = await otherStudent.client.rpc('advance_guided_learning_session_v4', {
      p_session_id: v13SessionId, p_step_id: remediationStepId, p_action: 'LESSON_COMPLETED',
      p_idempotency_key: `guided-v13:${suffix}:lesson:${remediationStepId}`,
    });
    expect(completedRemediation.error).toBeNull();
    const nextPracticeStepId = required(completedRemediation.data?.current_step_id, 'V13 practice after remediation');
    const nextPractice = await answerCurrentStep(nextPracticeStepId);
    expect(nextPractice.step?.step_type).toBe('PRACTICE');
    expect(nextPractice.submission?.score).toBeGreaterThanOrEqual(80);
    const transferStepId = required(nextPractice.submission?.current_step_id, 'V13 transfer step ID');
    const transferStep = await service.from('learning_guided_steps')
      .select('step_type,purpose,question_set_id').eq('id', transferStepId).single();
    expect(transferStep.error).toBeNull();
    expect(transferStep.data?.step_type).toBe('TRANSFER');
    expect(transferStep.data?.purpose).toBe('TRANSFER');
  }, 90_000);
});
