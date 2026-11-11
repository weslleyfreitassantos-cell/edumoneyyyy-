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
  let physicsStudentId: string;
  let v162MathStudentId: string;
  let v162PhysicsStudentId: string;
  let v17ChemistryStudentId: string;
  let v17BiologyStudentId: string;
  let v17EnglishStudentId: string;
  let v17PortugueseStudentId: string;
  let v17HistoryStudentId: string;
  let v17GeographyStudentId: string;
  let v17PhilosophyStudentId: string;
  let v17SociologyStudentId: string;
  let v17ArtStudentId: string;
  let v17PhysicalEducationStudentId: string;
  let canonicalSkillId: string;
  const probeSetIds: string[] = [];
  const probeQuestionIds: string[] = [];
  let teacher: Actor;
  let student: Actor;
  let otherStudent: Actor;
  let physicsStudent: Actor;
  let v162MathStudent: Actor;
  let v162PhysicsStudent: Actor;
  let v17ChemistryStudent: Actor;
  let v17BiologyStudent: Actor;
  let v17EnglishStudent: Actor;
  let v17PortugueseStudent: Actor;
  let v17HistoryStudent: Actor;
  let v17GeographyStudent: Actor;
  let v17PhilosophyStudent: Actor;
  let v17SociologyStudent: Actor;
  let v17ArtStudent: Actor;
  let v17PhysicalEducationStudent: Actor;

  beforeAll(async () => {
    service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const admin = await createActor(service, 'admin', suffix);
    teacher = await createActor(service, 'teacher', suffix);
    student = await createActor(service, 'student', suffix);
    otherStudent = await createActor(service, 'other', suffix);
    physicsStudent = await createActor(service, 'physics', suffix);
    v162MathStudent = await createActor(service, 'v162-math', suffix);
    v162PhysicsStudent = await createActor(service, 'v162-physics', suffix);
    v17ChemistryStudent = await createActor(service, 'v17-chemistry', suffix);
    v17BiologyStudent = await createActor(service, 'v17-biology', suffix);
    v17EnglishStudent = await createActor(service, 'v17-english', suffix);
    v17PortugueseStudent = await createActor(service, 'v17-portuguese', suffix);
    v17HistoryStudent = await createActor(service, 'v17-history', suffix);
    v17GeographyStudent = await createActor(service, 'v17-geography', suffix);
    v17PhilosophyStudent = await createActor(service, 'v17-philosophy', suffix);
    v17SociologyStudent = await createActor(service, 'v17-sociology', suffix);
    v17ArtStudent = await createActor(service, 'v17-art', suffix);
    v17PhysicalEducationStudent = await createActor(service, 'v17-physical-education', suffix);
    userIds.push(admin.id, teacher.id, student.id, otherStudent.id, physicsStudent.id, v162MathStudent.id, v162PhysicsStudent.id,
      v17ChemistryStudent.id, v17BiologyStudent.id, v17EnglishStudent.id, v17PortugueseStudent.id,
      v17HistoryStudent.id, v17GeographyStudent.id, v17PhilosophyStudent.id, v17SociologyStudent.id,
      v17ArtStudent.id, v17PhysicalEducationStudent.id);

    accountId = (await insertOne(service, 'accounts', {
      name: `Guided V11 ${suffix}`, owner_profile_id: admin.id, institution_limit: 1, status: 'ACTIVE',
    })).id;
    institutionId = (await insertOne(service, 'institutions', {
      account_id: accountId, name: `Guided V11 ${suffix}`, active: true,
    })).id;
    for (const actor of [admin, teacher, student, otherStudent, physicsStudent, v162MathStudent, v162PhysicsStudent,
      v17ChemistryStudent, v17BiologyStudent, v17EnglishStudent, v17PortugueseStudent,
      v17HistoryStudent, v17GeographyStudent, v17PhilosophyStudent, v17SociologyStudent,
      v17ArtStudent, v17PhysicalEducationStudent]) {
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
    physicsStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: physicsStudent.id, registration_number: `V11-PHYSICS-${suffix}`, active: true,
    })).id;
    v162MathStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v162MathStudent.id, registration_number: `V16-2-MATH-${suffix}`, active: true,
    })).id;
    v162PhysicsStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v162PhysicsStudent.id, registration_number: `V16-2-PHYSICS-${suffix}`, active: true,
    })).id;
    v17ChemistryStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17ChemistryStudent.id, registration_number: `V17-CHEMISTRY-${suffix}`, active: true,
    })).id;
    v17BiologyStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17BiologyStudent.id, registration_number: `V17-BIOLOGY-${suffix}`, active: true,
    })).id;
    v17EnglishStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17EnglishStudent.id, registration_number: `V17-ENGLISH-${suffix}`, active: true,
    })).id;
    v17PortugueseStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17PortugueseStudent.id, registration_number: `V17-PORTUGUESE-${suffix}`, active: true,
    })).id;
    v17HistoryStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17HistoryStudent.id, registration_number: `V17-HISTORY-${suffix}`, active: true,
    })).id;
    v17GeographyStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17GeographyStudent.id, registration_number: `V17-GEOGRAPHY-${suffix}`, active: true,
    })).id;
    v17PhilosophyStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17PhilosophyStudent.id, registration_number: `V17-PHILOSOPHY-${suffix}`, active: true,
    })).id;
    v17SociologyStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17SociologyStudent.id, registration_number: `V17-SOCIOLOGY-${suffix}`, active: true,
    })).id;
    v17ArtStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17ArtStudent.id, registration_number: `V17-ART-${suffix}`, active: true,
    })).id;
    v17PhysicalEducationStudentId = (await insertOne(service, 'students', {
      institution_id: institutionId, profile_id: v17PhysicalEducationStudent.id, registration_number: `V17-PE-${suffix}`, active: true,
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

  it('starts the published Physics skill only in its exact subject and persists the V4 adaptive journey', async () => {
    const schoolClass = await insertOne(service, 'classes', {
      institution_id: institutionId, academic_year_id: academicYearId, name: `1ª série EM V16 ${suffix}`,
      grade_level: '1ª série do Ensino Médio', shift: 'INTEGRAL', active: true,
    });
    await insertOne(service, 'enrollments', {
      student_id: physicsStudentId, class_id: schoolClass.id, academic_year_id: academicYearId, status: 'active', active: true,
    });
    for (const student_id of [
      v17ChemistryStudentId, v17BiologyStudentId, v17EnglishStudentId, v17PortugueseStudentId,
      v17HistoryStudentId, v17GeographyStudentId, v17PhilosophyStudentId, v17SociologyStudentId,
      v17ArtStudentId, v17PhysicalEducationStudentId,
    ]) {
      await insertOne(service, 'enrollments', {
        student_id, class_id: schoolClass.id, academic_year_id: academicYearId, status: 'active', active: true,
      });
    }

    const subjectCatalog = [
      ['Física', 'FIS'], ['Química', 'QUI'], ['História', 'HIS'], ['Matemática', 'MAT'],
      ['Língua Portuguesa', 'LP'], ['Língua Inglesa', 'ING'], ['Arte', 'ART'],
      ['Educação Física', 'EDF'], ['Biologia', 'BIO'], ['Geografia', 'GEO'],
      ['Filosofia', 'FIL'], ['Sociologia', 'SOC'], ['Ciências sem vínculo disciplinar', 'CIE'],
    ] as const;
    const existingSubjectsResult = await service.from('subjects').select('*')
      .eq('institution_id', institutionId)
      .in('code', subjectCatalog.map(([, code]) => code));
    if (existingSubjectsResult.error) throw new Error(`subjects lookup: ${existingSubjectsResult.error.message}`);
    const existingSubjects = new Map((existingSubjectsResult.data ?? [])
      .map((subject: { code: string }) => [subject.code, subject]));
    const subjects = await Promise.all(subjectCatalog.map(async ([name, code]) => {
      const existing = existingSubjects.get(code);
      if (existing) return existing;
      return insertOne(service, 'subjects', {
        institution_id: institutionId, name: `${name} V16 ${suffix}`, code, active: true,
      });
    }));
    for (const subject of subjects) {
      await insertOne(service, 'class_curriculum_items', {
        institution_id: institutionId, class_id: schoolClass.id, subject_id: subject.id,
        weekly_lessons: 2, lesson_duration_minutes: 50, active: true,
      });
      await insertOne(service, 'subject_offerings', {
        class_id: schoolClass.id, subject_id: subject.id, teacher_profile_id: teacher.id,
        term_id: termId, active: true,
      });
    }
    const v17SubjectAreas = new Map([
      ['QUI', 'CIENCIAS_DA_NATUREZA'], ['BIO', 'CIENCIAS_DA_NATUREZA'],
      ['ING', 'LINGUAGENS'], ['LP', 'LINGUAGENS'],
      ['HIS', 'CIENCIAS_HUMANAS'], ['GEO', 'CIENCIAS_HUMANAS'],
      ['FIL', 'CIENCIAS_HUMANAS'], ['SOC', 'CIENCIAS_HUMANAS'],
      ['ART', 'LINGUAGENS'], ['EDF', 'LINGUAGENS'],
      ['CIE', 'CIENCIAS_DA_NATUREZA'],
    ]);
    for (const subject of subjects as Array<{ id: string; code: string }>) {
      const subjectArea = v17SubjectAreas.get(subject.code);
      if (subjectArea) {
        await insertOne(service, 'learning_curriculum_subject_links', {
          institution_id: institutionId, subject_id: subject.id, subject_area: subjectArea, active: true,
        });
      }
    }
    const [physics, chemistry, history, math] = subjects;

    const unrelatedStudentView = await student.client.rpc('get_guided_study_subject_overview_v16', {
      p_institution_id: institutionId, p_subject_id: physics.id,
    });
    expect(unrelatedStudentView.error).toBeNull();
    expect(unrelatedStudentView.data?.state).toBe('SUBJECT_NOT_AVAILABLE');

    const foreignInstitution = await insertOne(service, 'institutions', {
      name: `Guided V16 foreign ${suffix}`, active: true,
    });
    const foreignSubject = await insertOne(service, 'subjects', {
      institution_id: foreignInstitution.id, name: `Foreign Physics V16 ${suffix}`, code: 'FIS', active: true,
    });
    const foreignSubjectView = await physicsStudent.client.rpc('get_guided_study_subject_overview_v16', {
      p_institution_id: institutionId, p_subject_id: foreignSubject.id,
    });
    expect(foreignSubjectView.error).toBeNull();
    expect(foreignSubjectView.data?.state).toBe('SUBJECT_NOT_AVAILABLE');
    await service.from('institutions').delete().eq('id', foreignInstitution.id);

    const physicsOverview = await physicsStudent.client.rpc('get_guided_study_subject_overview_v16', {
      p_institution_id: institutionId, p_subject_id: physics.id,
    });
    expect(physicsOverview.error).toBeNull();
    expect(physicsOverview.data).toMatchObject({
      state: 'READY', subject_id: physics.id, subject_name: physics.name,
      grade_label: '1ª série do Ensino Médio',
    });
    expect(physicsOverview.data?.topic_title).toBeTruthy();

    const decoySubject = subjects.find((subject: { code: string }) => subject.code === 'CIE');
    expect(decoySubject).toBeTruthy();
    const decoyOverview = await physicsStudent.client.rpc('get_guided_study_subject_overview_v16', {
      p_institution_id: institutionId, p_subject_id: decoySubject!.id,
    });
    expect(decoyOverview.error).toBeNull();
    expect(decoyOverview.data?.state).toBe('NO_ELIGIBLE_CONTENT');
    expect(decoyOverview.data?.topic_title).toBeNull();

    const [firstStart, concurrentStart] = await Promise.all([
      physicsStudent.client.rpc('start_guided_study_subject_v16', {
        p_institution_id: institutionId, p_subject_id: physics.id,
      }),
      physicsStudent.client.rpc('start_guided_study_subject_v16', {
        p_institution_id: institutionId, p_subject_id: physics.id,
      }),
    ]);
    expect(firstStart.error).toBeNull();
    expect(concurrentStart.error).toBeNull();
    const sessionId = required(firstStart.data?.session_id, 'V16 Physics session ID');
    expect(concurrentStart.data?.session_id).toBe(sessionId);
    expect([firstStart.data?.created, concurrentStart.data?.created].filter(Boolean)).toHaveLength(1);

    const session = await service.from('learning_guided_sessions')
      .select('id,student_id,subject_id,current_step_id,status,target_canonical_skill_id,metadata')
      .eq('id', sessionId).single();
    expect(session.error).toBeNull();
    expect(session.data).toMatchObject({
      student_id: physicsStudentId, subject_id: physics.id, status: 'ACTIVE',
      metadata: { orchestration_version: 'V11', adaptive_policy_version: 'V8', content_version: 6, subject_scope_version: 'V16' },
    });
    const skill = await service.from('learning_curriculum_skills').select('code')
      .eq('id', session.data?.target_canonical_skill_id).single();
    expect(skill.data?.code).toBe('EM13CNT101');
    const initialStep = await service.from('learning_guided_steps')
      .select('id,step_type,purpose,question_set_id').eq('id', session.data?.current_step_id).single();
    expect(initialStep.data).toMatchObject({ step_type: 'PROBE', purpose: 'PROBE' });
    const questionSet = await service.from('learning_question_sets').select('version')
      .eq('id', initialStep.data?.question_set_id).single();
    expect(questionSet.data?.version).toBe(6);
    const realProbe = await physicsStudent.client.rpc('get_guided_learning_step_v4', { p_step_id: initialStep.data?.id });
    expect(realProbe.error).toBeNull();
    expect(realProbe.data?.questions?.[0]?.statement).toBeTruthy();

    const items = await service.from('learning_question_set_items').select('question_bank_id')
      .eq('question_set_id', initialStep.data?.question_set_id).order('position');
    expect(items.error).toBeNull();
    const bankRows = await service.from('learning_question_bank').select('id,correct_answer')
      .in('id', (items.data ?? []).map((item: { question_bank_id: string }) => item.question_bank_id));
    expect(bankRows.error).toBeNull();
    const correctProbe = await physicsStudent.client.rpc('submit_guided_learning_step_v4', {
      p_step_id: initialStep.data!.id,
      p_answers: (items.data ?? []).map((item: { question_bank_id: string }) => ({
        question_bank_id: item.question_bank_id,
        answer: bankRows.data?.find((row: { id: string }) => row.id === item.question_bank_id)?.correct_answer,
      })),
      p_idempotency_key: `guided-v16:${suffix}:${initialStep.data!.id}`,
    });
    expect(correctProbe.error).toBeNull();
    expect(correctProbe.data?.score).toBe(100);
    expect(correctProbe.data?.current_step_id).toBeTruthy();

    const conflict = await physicsStudent.client.rpc('get_guided_study_subject_overview_v16', {
      p_institution_id: institutionId, p_subject_id: math.id,
    });
    expect(conflict.error).toBeNull();
    expect(conflict.data).toMatchObject({ state: 'ACTIVE_SESSION_OTHER_SUBJECT', session_id: sessionId });
    const blockedStart = await physicsStudent.client.rpc('start_guided_study_subject_v16', {
      p_institution_id: institutionId, p_subject_id: math.id,
    });
    expect(blockedStart.error).toBeNull();
    expect(blockedStart.data?.state).toBe('ACTIVE_SESSION_OTHER_SUBJECT');

    const pause = await physicsStudent.client.rpc('pause_guided_study_v11', {
      p_institution_id: institutionId, p_session_id: sessionId,
    });
    expect(pause.error).toBeNull();
    const resumed = await physicsStudent.client.rpc('start_guided_study_subject_v16', {
      p_institution_id: institutionId, p_subject_id: physics.id,
    });
    expect(resumed.error).toBeNull();
    expect(resumed.data?.session_id).toBe(sessionId);
    const persisted = await service.from('learning_guided_sessions')
      .select('subject_id,current_step_id,status').eq('id', sessionId).single();
    expect(persisted.data).toMatchObject({
      subject_id: physics.id, current_step_id: correctProbe.data?.current_step_id, status: 'ACTIVE',
    });

    await insertOne(service, 'enrollments', {
      student_id: v162MathStudentId, class_id: schoolClass.id, academic_year_id: academicYearId, status: 'active', active: true,
    });
    await insertOne(service, 'enrollments', {
      student_id: v162PhysicsStudentId, class_id: schoolClass.id, academic_year_id: academicYearId, status: 'active', active: true,
    });

    const sequenceSkills = await service.from('learning_curriculum_skills').select('id,code')
      .in('code', ['EM13MAT101', 'EM13CNT101']);
    expect(sequenceSkills.error).toBeNull();
    const sequenceSkillIds = new Map((sequenceSkills.data ?? []).map((row: { id: string; code: string }) => [row.code, row.id]));
    const mathPrerequisiteId = required(sequenceSkillIds.get('EM13MAT101'), 'V16.2 Math sequence skill');
    const physicsPrerequisiteId = required(sequenceSkillIds.get('EM13CNT101'), 'V16.2 Physics sequence skill');
    const seededProgress = await service.from('learning_student_skill_state').upsert([
      {
        institution_id: institutionId, student_id: v162MathStudentId, canonical_skill_id: mathPrerequisiteId,
        state: 'MASTERED', mastery_estimate: 100, evidence_count: 5, confidence: 1, last_evidence_at: new Date().toISOString(),
      },
      {
        institution_id: institutionId, student_id: v162PhysicsStudentId, canonical_skill_id: physicsPrerequisiteId,
        state: 'MASTERED', mastery_estimate: 100, evidence_count: 5, confidence: 1, last_evidence_at: new Date().toISOString(),
      },
    ], { onConflict: 'institution_id,student_id,canonical_skill_id' });
    expect(seededProgress.error).toBeNull();

    const mathTargets = await v162MathStudent.client.rpc('list_student_guided_learning_targets', {
      p_institution_id: institutionId, p_student_id: v162MathStudentId,
    });
    expect(mathTargets.error).toBeNull();
    expect(mathTargets.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ official_code: 'EM13MAT302', availability_status: expect.stringMatching(/READY|NO_ACTIVE_SESSION/) }),
    ]));
    const physicsTargets = await v162PhysicsStudent.client.rpc('list_student_guided_learning_targets', {
      p_institution_id: institutionId, p_student_id: v162PhysicsStudentId,
    });
    expect(physicsTargets.error).toBeNull();
    expect(physicsTargets.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ official_code: 'EM13CNT204', availability_status: expect.stringMatching(/READY|NO_ACTIVE_SESSION/) }),
    ]));

    const startV162Journey = async (actor: Actor, subject: { id: string; name: string }, expectedCode: string) => {
      const overview = await actor.client.rpc('get_guided_study_subject_overview_v16', {
        p_institution_id: institutionId, p_subject_id: subject.id,
      });
      expect(overview.error).toBeNull();
      expect(overview.data).toMatchObject({ state: 'READY', subject_id: subject.id, subject_name: subject.name });
      const started = await actor.client.rpc('start_guided_study_subject_v16', {
        p_institution_id: institutionId, p_subject_id: subject.id,
      });
      expect(started.error).toBeNull();
      const startedSessionId = required(started.data?.session_id, `${expectedCode} V16.2 session ID`);
      const startedSession = await service.from('learning_guided_sessions')
        .select('student_id,subject_id,current_step_id,status,target_canonical_skill_id,metadata')
        .eq('id', startedSessionId).single();
      expect(startedSession.error).toBeNull();
      expect(startedSession.data).toMatchObject({
        subject_id: subject.id, status: 'ACTIVE',
        metadata: { orchestration_version: 'V11', subject_scope_version: 'V16' },
      });
      const skill = await service.from('learning_curriculum_skills').select('code,metadata')
        .eq('id', startedSession.data?.target_canonical_skill_id).single();
      expect(skill.data?.code).toBe(expectedCode);
      expect(skill.data?.metadata).toMatchObject({ content_version: 7 });
      const step = await service.from('learning_guided_steps').select('id,step_type,purpose,question_set_id')
        .eq('id', startedSession.data?.current_step_id).single();
      expect(step.data).toMatchObject({ step_type: 'PROBE', purpose: 'PROBE' });
      const questionSet = await service.from('learning_question_sets').select('version')
        .eq('id', step.data?.question_set_id).single();
      expect(questionSet.data?.version).toBe(7);
      const content = await actor.client.rpc('get_guided_learning_step_v4', { p_step_id: step.data?.id });
      expect(content.error).toBeNull();
      expect(content.data?.questions?.[0]?.statement).toBeTruthy();
      return { sessionId: startedSessionId, stepId: required(step.data?.id, `${expectedCode} probe step`) };
    };

    const mathV162 = await startV162Journey(v162MathStudent, math, 'EM13MAT302');
    const physicsV162 = await startV162Journey(v162PhysicsStudent, physics, 'EM13CNT204');

    const answerV162Step = async (actor: Actor, stepId: string, idempotencyKey: string, wrongFirst = false) => {
      const step = await service.from('learning_guided_steps').select('step_type,purpose,question_set_id')
        .eq('id', stepId).single();
      expect(step.error).toBeNull();
      const items = await service.from('learning_question_set_items').select('question_bank_id')
        .eq('question_set_id', step.data?.question_set_id).order('position');
      expect(items.error).toBeNull();
      const bankRows = await service.from('learning_question_bank').select('id,correct_answer,options')
        .in('id', (items.data ?? []).map((item: { question_bank_id: string }) => item.question_bank_id));
      expect(bankRows.error).toBeNull();
      const answers = (items.data ?? []).map((item: { question_bank_id: string }, index: number) => {
        const bank = bankRows.data?.find((row: { id: string }) => row.id === item.question_bank_id);
        const correct = String(required(bank?.correct_answer, `V16.2 answer ${item.question_bank_id}`));
        const wrong = (bank?.options as unknown[]).find((option) => String(option) !== correct);
        return { question_bank_id: item.question_bank_id, answer: wrongFirst && index === 0 ? String(wrong) : correct };
      });
      const submitted = await actor.client.rpc('submit_guided_learning_step_v4', {
        p_step_id: stepId, p_answers: answers, p_idempotency_key: idempotencyKey,
      });
      expect(submitted.error).toBeNull();
      return { step: step.data, submission: submitted.data };
    };

    const v17Journeys = [
      { actor: v17ChemistryStudent, studentId: v17ChemistryStudentId, code: 'QUI', skillCode: 'EM13CNT104', wrongFirst: true },
      { actor: v17BiologyStudent, studentId: v17BiologyStudentId, code: 'BIO', skillCode: 'EM13CNT105', wrongFirst: false },
      { actor: v17EnglishStudent, studentId: v17EnglishStudentId, code: 'ING', skillCode: 'EM13LGG403', wrongFirst: false },
      { actor: v17PortugueseStudent, studentId: v17PortugueseStudentId, code: 'LP', skillCode: 'EM13LP05', wrongFirst: false },
      { actor: v17HistoryStudent, studentId: v17HistoryStudentId, code: 'HIS', skillCode: 'EM13CHS101', wrongFirst: false },
      { actor: v17GeographyStudent, studentId: v17GeographyStudentId, code: 'GEO', skillCode: 'EM13CHS106', wrongFirst: false },
      { actor: v17PhilosophyStudent, studentId: v17PhilosophyStudentId, code: 'FIL', skillCode: 'EM13CHS501', wrongFirst: false },
      { actor: v17SociologyStudent, studentId: v17SociologyStudentId, code: 'SOC', skillCode: 'EM13CHS403', wrongFirst: false },
      { actor: v17ArtStudent, studentId: v17ArtStudentId, code: 'ART', skillCode: 'EM13LGG603', wrongFirst: false },
      { actor: v17PhysicalEducationStudent, studentId: v17PhysicalEducationStudentId, code: 'EDF', skillCode: 'EM13LGG501', wrongFirst: false },
    ] as const;
    for (const [index, journey] of v17Journeys.entries()) {
      const subject = subjects.find((candidate: { code: string }) => candidate.code === journey.code);
      if (!subject) throw new Error(`V17 ${journey.code} subject fixture missing`);
      const overview = await journey.actor.client.rpc('get_guided_study_subject_overview_v16', {
        p_institution_id: institutionId, p_subject_id: subject.id,
      });
      expect(overview.error).toBeNull();
      expect(overview.data).toMatchObject({ state: 'READY', subject_id: subject.id, subject_name: subject.name });
      expect(overview.data?.topic_title).toBeTruthy();

      const started = await journey.actor.client.rpc('start_guided_study_subject_v16', {
        p_institution_id: institutionId, p_subject_id: subject.id,
      });
      expect(started.error).toBeNull();
      const sessionId = required(started.data?.session_id, `V17 ${journey.code} session ID`);
      const session = await service.from('learning_guided_sessions')
        .select('subject_id,current_step_id,target_canonical_skill_id,metadata,status').eq('id', sessionId).single();
      expect(session.error).toBeNull();
      expect(session.data).toMatchObject({
        subject_id: subject.id, status: 'ACTIVE',
        metadata: { orchestration_version: 'V11', subject_scope_version: 'V16' },
      });
      const skill = await service.from('learning_curriculum_skills').select('code,metadata')
        .eq('id', session.data?.target_canonical_skill_id).single();
      expect(skill.data?.code).toBe(journey.skillCode);
      expect(skill.data?.metadata).toMatchObject({ content_version: 8 });
      const stepId = required(session.data?.current_step_id, `V17 ${journey.code} probe step`);
      const step = await service.from('learning_guided_steps').select('id,step_type,purpose,question_set_id')
        .eq('id', stepId).single();
      expect(step.data).toMatchObject({ step_type: 'PROBE', purpose: 'PROBE' });
      const questionSet = await service.from('learning_question_sets').select('version')
        .eq('id', step.data?.question_set_id).single();
      expect(questionSet.data?.version).toBe(8);
      const visibleStep = await journey.actor.client.rpc('get_guided_learning_step_v4', { p_step_id: stepId });
      expect(visibleStep.error).toBeNull();
      expect(visibleStep.data?.questions?.[0]?.statement).toBeTruthy();

      const answered = await answerV162Step(journey.actor, stepId, `guided-v17:${suffix}:${index}`, journey.wrongFirst);
      expect(answered.submission?.current_step_id).toBeTruthy();
      if (journey.wrongFirst) expect(answered.submission?.score).toBeLessThan(80);
      else expect(answered.submission?.score).toBe(100);
      const persistedState = await service.from('learning_student_skill_state')
        .select('state,evidence_count').eq('institution_id', institutionId)
        .eq('student_id', journey.studentId).eq('canonical_skill_id', session.data?.target_canonical_skill_id).single();
      expect(persistedState.error).toBeNull();
      expect(persistedState.data?.state).not.toBe('UNKNOWN');
      expect(persistedState.data?.evidence_count).toBeGreaterThan(0);
    }

    const physicsProbe = await answerV162Step(v162PhysicsStudent, physicsV162.stepId, `guided-v16-2:${suffix}:probe`);
    expect(physicsProbe.submission?.score).toBe(100);
    const physicsPracticeId = required(physicsProbe.submission?.current_step_id, 'V16.2 Physics practice step');
    const physicsPractice = await answerV162Step(v162PhysicsStudent, physicsPracticeId, `guided-v16-2:${suffix}:practice`, true);
    expect(physicsPractice.step?.step_type).toBe('PRACTICE');
    expect(physicsPractice.submission?.score).toBeLessThan(80);
    const physicsLessonId = required(physicsPractice.submission?.current_step_id, 'V16.2 Physics remediation lesson');
    const physicsLesson = await service.from('learning_guided_steps').select('lesson_id,step_type')
      .eq('id', physicsLessonId).single();
    expect(physicsLesson.data?.step_type).toBe('LESSON');
    const physicsLessonRecord = await service.from('learning_skill_lessons').select('version,content_markdown')
      .eq('id', physicsLesson.data?.lesson_id).single();
    expect(physicsLessonRecord.data?.version).toBe(7);
    expect(physicsLessonRecord.data?.content_markdown).toContain('A interação gravitacional');

    const pausedV162 = await v162PhysicsStudent.client.rpc('pause_guided_study_v11', {
      p_institution_id: institutionId, p_session_id: physicsV162.sessionId,
    });
    expect(pausedV162.error).toBeNull();
    expect(pausedV162.data?.status).toBe('PAUSED');
    const resumedV162 = await v162PhysicsStudent.client.rpc('start_guided_study_subject_v16', {
      p_institution_id: institutionId, p_subject_id: physics.id,
    });
    expect(resumedV162.error).toBeNull();
    expect(resumedV162.data?.session_id).toBe(physicsV162.sessionId);
    const completedV162Lesson = await v162PhysicsStudent.client.rpc('advance_guided_learning_session_v4', {
      p_session_id: physicsV162.sessionId, p_step_id: physicsLessonId, p_action: 'LESSON_COMPLETED',
      p_idempotency_key: `guided-v16-2:${suffix}:lesson:${physicsLessonId}`,
    });
    expect(completedV162Lesson.error).toBeNull();
    const nextPhysicsPracticeId = required(completedV162Lesson.data?.current_step_id, 'V16.2 practice after reinforcement');
    const reinforcedPhysicsPractice = await answerV162Step(
      v162PhysicsStudent, nextPhysicsPracticeId, `guided-v16-2:${suffix}:reinforced-practice`,
    );
    expect(reinforcedPhysicsPractice.step?.purpose).toBe('PRACTICE');
    expect(reinforcedPhysicsPractice.submission?.score).toBe(100);
  }, 90_000);
});
