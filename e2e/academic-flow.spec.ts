import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type DbClient = SupabaseClient<any, any, any>;
type Actor = { email: string; password: string; id: string };

type Fixture = {
  admin: Actor;
  director: Actor;
  secretary: Actor;
  teacher: Actor;
  student: Actor;
  guardian: Actor;
  directorB: Actor;
  studentB: Actor;
  institutionId: string;
  institutionBId: string;
  institutionName: string;
  institutionBName: string;
  academicYearId: string;
  termId: string;
  offeringId: string;
  yearName: string;
  className: string;
  subjectName: string;
  studentName: string;
  studentBName: string;
  studentId: string;
  studentBId: string;
  assessmentTitle: string;
  diaryDate: string;
};

type Observations = {
  consoleErrors: string[];
  expectedNegative4xx: string[];
  unexpected4xx: string[];
  network5xx: string[];
  requestFailed: string[];
};

type ExpectedNegative4xxRule = {
  label: string;
  method: string;
  path: RegExp;
  queryIncludes: string;
  statuses: number[];
};

const localUrl = process.env.E2E_SUPABASE_URL ?? process.env.MULTI_TENANT_SUPABASE_URL;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const webBaseUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(client: DbClient, table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(service: DbClient, role: string, label: string, suffix: string): Promise<Actor> {
  const email = `e2e-${label}-${suffix}@local.test`;
  const password = 'E2E-Academic!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${label}: ${error.message}`);
  const user = required(data.user, `auth ${label}`);
  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: `E2E ${label}`,
    email,
    role,
    active: true,
  });
  return { email, password, id: user.id };
}

async function signInClient(actor: Actor): Promise<DbClient> {
  const client = createClient(localUrl!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: actor.email, password: actor.password });
  if (error) throw new Error(`login ${actor.email}: ${error.message}`);
  return client;
}

async function createInstitution(
  service: DbClient,
  owner: Actor,
  name: string,
  suffix: string,
): Promise<{ id: string; name: string }> {
  const account = await insertOne(service, 'accounts', {
    name: `E2E account ${suffix}`,
    owner_profile_id: owner.id,
    institution_limit: 1,
    status: 'ACTIVE',
  });
  const institution = await insertOne(service, 'institutions', {
    account_id: account.id,
    name,
    active: true,
  });
  return { id: institution.id as string, name: institution.name as string };
}

async function addMembership(service: DbClient, actor: Actor, institutionId: string, role: string): Promise<void> {
  await insertOne(service, 'memberships', {
    profile_id: actor.id,
    institution_id: institutionId,
    role,
    active: true,
  });
}

async function createFixture(): Promise<Fixture> {
  if (!localUrl || !serviceRoleKey || !anonKey) throw new Error('Credenciais locais do Supabase não configuradas.');

  const service = createClient(localUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const actors = {
    admin: await createActor(service, 'ADMIN', 'admin', suffix),
    director: await createActor(service, 'DIRECTOR', 'director', suffix),
    secretary: await createActor(service, 'SECRETARY', 'secretary', suffix),
    teacher: await createActor(service, 'TEACHER', 'teacher', suffix),
    student: await createActor(service, 'STUDENT', 'student', suffix),
    guardian: await createActor(service, 'GUARDIAN', 'guardian', suffix),
    directorB: await createActor(service, 'DIRECTOR', 'director-b', suffix),
    studentB: await createActor(service, 'STUDENT', 'student-b', suffix),
  };

  const institution = await createInstitution(service, actors.admin, `E2E Escola A ${suffix}`, suffix);
  const accountOwnerB = await createActor(service, 'ADMIN', 'admin-b', suffix);
  const institutionB = await createInstitution(service, accountOwnerB, `E2E Escola B ${suffix}`, `${suffix}-b`);

  await addMembership(service, actors.admin, institution.id, 'ADMIN');
  await addMembership(service, actors.director, institution.id, 'DIRECTOR');
  await addMembership(service, actors.secretary, institution.id, 'SECRETARY');
  await addMembership(service, actors.teacher, institution.id, 'TEACHER');
  await addMembership(service, actors.student, institution.id, 'STUDENT');
  await addMembership(service, actors.guardian, institution.id, 'GUARDIAN');
  await addMembership(service, actors.directorB, institutionB.id, 'DIRECTOR');
  await addMembership(service, actors.studentB, institutionB.id, 'STUDENT');

  const director = await signInClient(actors.director);
  const yearName = `2026 E2E ${suffix}`;
  const academicYear = await insertOne(director, 'academic_years', {
    institution_id: institution.id,
    name: yearName,
    start_date: '2026-09-01',
    end_date: '2026-12-31',
    active: true,
  });
  const term = await insertOne(director, 'terms', {
    academic_year_id: academicYear.id,
    name: `1º Bimestre E2E ${suffix}`,
    start_date: '2026-09-01',
    end_date: '2026-10-31',
    active: true,
  });
  await insertOne(director, 'academic_policies', {
    institution_id: institution.id,
    academic_year_id: academicYear.id,
    minimum_grade_percentage: 60,
    minimum_attendance_percentage: 75,
    decimal_places: 1,
    active: true,
  });
  const schoolClass = await insertOne(director, 'classes', {
    institution_id: institution.id,
    academic_year_id: academicYear.id,
    name: `8º A E2E ${suffix}`,
    grade_level: '8º ano',
    shift: 'MATUTINO',
    capacity: 30,
    active: true,
  });
  const subject = await insertOne(director, 'subjects', {
    institution_id: institution.id,
    name: `Matemática E2E ${suffix}`,
    code: `E2E-${suffix}`,
    workload: 100,
    active: true,
  });
  await insertOne(director, 'class_curriculum_items', {
    institution_id: institution.id,
    class_id: schoolClass.id,
    subject_id: subject.id,
    weekly_lessons: 1,
    lesson_duration_minutes: 50,
    active: true,
  });
  const offering = await insertOne(director, 'subject_offerings', {
    class_id: schoolClass.id,
    subject_id: subject.id,
    teacher_profile_id: actors.teacher.id,
    term_id: term.id,
    active: true,
  });
  const room = await insertOne(director, 'rooms', {
    institution_id: institution.id,
    name: `Sala E2E ${suffix}`,
    capacity: 30,
    active: true,
  });
  await insertOne(director, 'timetable_entries', {
    institution_id: institution.id,
    subject_offering_id: offering.id,
    room_id: room.id,
    day_of_week: 1,
    start_time: '07:00',
    end_time: '07:50',
    academic_year_id: academicYear.id,
    term_id: term.id,
    active: true,
  });

  const studentName = `E2E Aluno ${suffix}`;
  const studentBName = `E2E Aluno B ${suffix}`;
  await service.from('profiles').update({ full_name: studentName }).eq('id', actors.student.id);
  await service.from('profiles').update({ full_name: studentBName }).eq('id', actors.studentB.id);
  const student = await insertOne(service, 'students', {
    institution_id: institution.id,
    profile_id: actors.student.id,
    registration_number: `E2E-${suffix}`,
    birth_date: '2010-01-01',
    active: true,
  });
  const studentB = await insertOne(service, 'students', {
    institution_id: institutionB.id,
    profile_id: actors.studentB.id,
    registration_number: `E2E-B-${suffix}`,
    birth_date: '2010-02-02',
    active: true,
  });
  await insertOne(director, 'enrollments', {
    student_id: student.id,
    class_id: schoolClass.id,
    academic_year_id: academicYear.id,
    enrolled_at: '2026-09-01',
    status: 'ACTIVE',
    active: true,
  });
  await insertOne(service, 'guardianships', {
    student_id: student.id,
    guardian_profile_id: actors.guardian.id,
    relationship: 'Responsável',
    is_primary: true,
    active: true,
  });

  return {
    ...actors,
    institutionId: institution.id,
    institutionBId: institutionB.id,
    institutionName: institution.name,
    institutionBName: institutionB.name,
    academicYearId: academicYear.id as string,
    termId: term.id as string,
    offeringId: offering.id as string,
    yearName,
    className: schoolClass.name as string,
    subjectName: subject.name as string,
    studentName,
    studentBName,
    studentId: student.id as string,
    studentBId: studentB.id as string,
    assessmentTitle: `Avaliação E2E ${suffix}`,
    diaryDate: '2026-09-14',
  };
}

async function login(page: Page, actor: Actor): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await expect(page.locator('body')).not.toContainText('E-mail ou senha incorretos.');
}

function observePage(
  page: Page,
  label: string,
  observations: Observations,
  expectedNegative4xxAllowlist: ExpectedNegative4xxRule[] = [],
): void {
  page.on('console', (message) => {
    if (message.type() === 'error') observations.consoleErrors.push(`[${label}] ${message.text()}`);
  });
  page.on('pageerror', (error) => observations.consoleErrors.push(`[${label}] ${error.message}`));
  page.on('requestfailed', (request) => {
    observations.requestFailed.push(`[${label}] ${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const item = `[${label}] ${response.status()} ${response.request().method()} ${response.url()}`;
    if (response.status() >= 500) {
      observations.network5xx.push(item);
      return;
    }
    const url = new URL(response.url());
    const expected = expectedNegative4xxAllowlist.some((rule) => (
      rule.label === label
      && rule.method === response.request().method()
      && rule.path.test(url.pathname)
      && url.search.includes(rule.queryIncludes)
      && rule.statuses.includes(response.status())
    ));
    (expected ? observations.expectedNegative4xx : observations.unexpected4xx).push(item);
  });
}

async function selectOffering(page: Page, selector: string, offeringId: string): Promise<void> {
  await page.locator(selector).selectOption(offeringId);
}

async function performTeacherDiary(page: Page, fixture: Fixture): Promise<void> {
  await page.goto('/dashboard/class-diary');
  await expect(page.getByRole('heading', { name: 'Diário de Classe', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await selectOffering(page, '#attendance-offering', fixture.offeringId);
  await page.locator('#attendance-date').fill(fixture.diaryDate);
  const scheduleSlot = page.locator('#attendance-schedule-slot');
  if (await scheduleSlot.count()) await scheduleSlot.selectOption({ label: /07:00/ });
  await expect(page.getByRole('button', { name: 'Marcar presentes', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.locator('#diary-topic').fill('Equações do segundo grau');
  await page.locator('#diary-activity').fill('Exercícios de revisão');
  await page.locator('#diary-homework').fill('Lista de exercícios');
  await page.locator('#diary-notes').fill('Aula criada pelo fluxo E2E.');
  await page.getByRole('button', { name: 'Marcar presentes', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Finalizar aula/ }).click();
  await expect(page.getByText('Aula finalizada. O diário e a chamada estão disponíveis somente para leitura.')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Diário de Classe', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await selectOffering(page, '#attendance-offering', fixture.offeringId);
  await page.locator('#attendance-date').fill(fixture.diaryDate);
  const reloadedScheduleSlot = page.locator('#attendance-schedule-slot');
  if (await reloadedScheduleSlot.count()) await reloadedScheduleSlot.selectOption({ label: /07:00/ });
  await expect(page.locator('#diary-topic')).toHaveValue('Equações do segundo grau', { timeout: 30_000 });
  await expect(page.locator('#diary-activity')).toHaveValue('Exercícios de revisão');
  await expect(page.locator('#attendance-status-' + fixture.studentId)).toHaveValue('PRESENT');
}

async function performTeacherAssessment(page: Page, fixture: Fixture): Promise<void> {
  await page.goto('/dashboard/grades');
  await expect(page.getByRole('heading', { name: 'Avaliações e notas', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await selectOffering(page, '#grade-offering', fixture.offeringId);
  await page.locator('#assessment-title').fill(fixture.assessmentTitle);
  await page.locator('#assessment-type').selectOption('EXAM');
  await page.locator('#assessment-date').fill('2026-09-15');
  await page.locator('#assessment-max-score').fill('10');
  await page.locator('#assessment-weight').fill('1');
  await page.locator('#assessment-status').selectOption('PUBLISHED');
  await page.getByRole('button', { name: 'Criar avaliação', exact: true }).click();
  await expect(page.getByText(fixture.assessmentTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#grade-score-' + fixture.studentId)).toBeVisible({ timeout: 30_000 });
  await page.locator('#grade-score-' + fixture.studentId).fill('4');
  await page.locator('#grade-feedback-' + fixture.studentId).fill('Acompanhar recuperação.');
  const gradeSaveResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname.endsWith('/rest/v1/grades')
    && response.request().method() === 'POST'
    && response.ok()
  ));
  await page.getByRole('button', { name: 'Salvar notas', exact: true }).click();
  await gradeSaveResponse;
  await page.reload();
  await expect(page.getByText(fixture.assessmentTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#grade-score-' + fixture.studentId)).toHaveValue('4');
}

async function submitTeacherTermClosing(page: Page, fixture: Fixture): Promise<void> {
  await page.goto('/dashboard/term-closing');
  await expect(page.getByRole('heading', { name: 'Fechamento de Período', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('combobox', { name: 'Oferta e período para fechamento' }).selectOption(fixture.offeringId);
  await expect(page.getByRole('heading', { name: 'Prévia de Resultados', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Enviar para Revisão', exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Enviar para Revisão', exact: true }).click();
  await expect(page.getByText('Fechamento submetido para revisão da direção com sucesso.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Fechamento de Período', exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function closeAndReopenAsDirector(page: Page, fixture: Fixture): Promise<void> {
  await page.goto('/admin?module=term-closing');
  await expect(page.getByRole('heading', { name: 'Gestão de Fechamento de Período', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.locator('select').first().selectOption(fixture.offeringId);
  await expect(page.getByRole('heading', { name: 'Revisão de Resultados', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Fechar Período Definitivo', exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Fechar Período Definitivo', exact: true }).click();
  await expect(page.getByText('Período fechado com sucesso.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await page.locator('select').first().selectOption(fixture.offeringId);
  await expect(page.getByRole('button', { name: 'Reabrir Período', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Reabrir Período', exact: true }).click();
  await page.getByPlaceholder('Ex: Correção de notas pendentes autorizada pela direção.').fill('Correção autorizada para o fluxo E2E.');
  await page.getByRole('button', { name: 'Confirmar Reabertura', exact: true }).click();
  await expect(page.getByText('Período reaberto com sucesso.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.reload();
}

async function closeSubmittedPeriodAsDirector(page: Page, fixture: Fixture): Promise<void> {
  await page.goto('/admin?module=term-closing');
  await expect(page.getByRole('heading', { name: 'Gestão de Fechamento de Período', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.locator('select').first().selectOption(fixture.offeringId);
  await expect(page.getByRole('heading', { name: 'Revisão de Resultados', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Fechar Período Definitivo', exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Fechar Período Definitivo', exact: true }).click();
  await expect(page.getByText('Período fechado com sucesso.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.reload();
}

async function publishRecovery(page: Page, fixture: Fixture): Promise<void> {
  await page.goto('/dashboard/term-closing');
  await expect(page.getByRole('heading', { name: 'Recuperação acadêmica', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.locator('#academic-recovery-offering').selectOption(fixture.offeringId);
  await expect(page.locator('#recovery-' + fixture.studentId)).toBeVisible({ timeout: 30_000 });
  await page.locator('#recovery-' + fixture.studentId).fill('70');
  await page.getByRole('button', { name: 'Publicar recuperação', exact: true }).click();
  await expect(page.getByText('Recuperação publicada com sucesso.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await page.locator('#academic-recovery-offering').selectOption(fixture.offeringId);
  await expect(page.getByText('Status salvo: Publicado.', { exact: true })).toBeVisible({ timeout: 30_000 });
}

async function auditUiState(fixture: Fixture): Promise<void> {
  const service = createClient(localUrl!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await service.from('attendance_sessions').select('id,status,topic,class_activity,homework,notes').eq('institution_id', fixture.institutionId).eq('subject_offering_id', fixture.offeringId).eq('session_date', fixture.diaryDate).eq('starts_at', '07:00:00').single();
  if (session.error || !session.data || session.data.status !== 'CLOSED') throw new Error(`UI diary audit failed: ${session.error?.message ?? 'session not CLOSED'}`);
  const record = await service.from('attendance_records').select('status').eq('attendance_session_id', session.data.id).eq('student_id', fixture.studentId).single();
  if (record.error || record.data?.status !== 'PRESENT') throw new Error(`UI attendance audit failed: ${record.error?.message ?? 'record not PRESENT'}`);
  const assessment = await service.from('assessments').select('id,status,title').eq('institution_id', fixture.institutionId).eq('subject_offering_id', fixture.offeringId).eq('title', fixture.assessmentTitle).single();
  if (assessment.error || assessment.data?.status !== 'PUBLISHED') throw new Error(`UI assessment audit failed: ${assessment.error?.message ?? 'assessment not PUBLISHED'}`);
  const grade = await service.from('grades').select('score,status').eq('assessment_id', assessment.data.id).eq('student_id', fixture.studentId).single();
  if (grade.error || grade.data?.score !== 4 || grade.data?.status !== 'GRADED') throw new Error(`UI grade audit failed: ${grade.error?.message ?? 'grade mismatch'}`);
  const closure = await service.from('term_closures').select('status').eq('institution_id', fixture.institutionId).eq('subject_offering_id', fixture.offeringId).eq('term_id', fixture.termId).single();
  if (closure.error || closure.data?.status !== 'CLOSED') throw new Error(`UI closure audit failed: ${closure.error?.message ?? 'closure not CLOSED after recovery review'}`);
  const result = await service.from('student_term_results').select('result_status,recovery_percentage,final_grade_percentage').eq('institution_id', fixture.institutionId).eq('subject_offering_id', fixture.offeringId).eq('term_id', fixture.termId).eq('student_id', fixture.studentId).single();
  if (result.error || result.data?.recovery_percentage !== 70 || result.data?.final_grade_percentage !== 70 || result.data?.result_status !== 'APPROVED') throw new Error(`UI result audit failed: ${result.error?.message ?? 'recovery result mismatch'}`);
  const recovery = await service.from('student_term_recoveries').select('status,recovery_percentage').eq('institution_id', fixture.institutionId).eq('subject_offering_id', fixture.offeringId).eq('term_id', fixture.termId).eq('student_id', fixture.studentId).single();
  if (recovery.error || recovery.data?.status !== 'PUBLISHED' || recovery.data?.recovery_percentage !== 70) throw new Error(`UI recovery audit failed: ${recovery.error?.message ?? 'recovery not PUBLISHED'}`);
}

test.describe.configure({ mode: 'serial' });

test('homologa o fluxo acadêmico local por papel, UI, recargas e isolamento de tenant', async ({ page, browser }) => {
  test.setTimeout(480_000);
  const fixture = await createFixture();
  const observations: Observations = { consoleErrors: [], expectedNegative4xx: [], unexpected4xx: [], network5xx: [], requestFailed: [] };
  observePage(page, 'director', observations);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'print', {
      configurable: true,
      value: () => sessionStorage.setItem('e2e-document-print-requested', 'yes'),
    });
  });

  await login(page, fixture.director);
  await expect(page).toHaveURL(/\/admin\?module=overview/);
  await page.goto('/admin?module=academic-years');
  await expect(
    page.getByRole('row').filter({ hasText: fixture.yearName }).first(),
  ).toBeVisible({ timeout: 30_000 });
  await page.goto('/admin?module=students');
  await expect(page.getByText(fixture.studentName, { exact: true })).toBeVisible({ timeout: 30_000 });

  const directorBClient = await signInClient(fixture.directorB);
  const directorBStudents = await directorBClient.rpc('list_students_page', {
    p_institution_id: fixture.institutionBId,
    p_search: null,
    p_limit: 25,
    p_offset: 0,
  });
  expect(directorBStudents.error).toBeNull();
  expect(directorBStudents.data?.map((row) => row.id)).toContain(fixture.studentBId);
  expect(directorBStudents.data?.map((row) => row.id)).not.toContain(fixture.studentId);

  const directorBContext = await browser.newContext({ baseURL: webBaseUrl });
  const directorBPage = await directorBContext.newPage();
  observePage(directorBPage, 'director-b', observations);
  await login(directorBPage, fixture.directorB);
  await directorBPage.goto('/admin?module=students');
  await expect(directorBPage.getByText(fixture.studentBName, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(directorBPage.getByText(fixture.studentName, { exact: true })).toHaveCount(0);
  await directorBContext.close();

  await page.goto(`/admin?module=academic-documents&student=${fixture.studentId}`);
  await expect(page.getByRole('heading', { name: 'Documentos acadêmicos', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: new RegExp(fixture.studentName) }).click();
  await expect(page.getByRole('heading', { name: 'Declaração de matrícula', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(fixture.className, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ficha de matrícula', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ficha de matrícula', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Imprimir documento/ }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('e2e-document-print-requested'))).toBe('yes');
  await page.goto('/admin?module=class-diary');
  await expect(page.getByRole('heading', { name: /Diário de Classe/i }).first()).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: /Diário de Classe/i }).first()).toBeVisible({ timeout: 30_000 });

  const secretaryContext = await browser.newContext({ baseURL: webBaseUrl });
  const secretaryPage = await secretaryContext.newPage();
  observePage(secretaryPage, 'secretary', observations);
  await login(secretaryPage, fixture.secretary);
  await secretaryPage.goto('/admin?module=class-diary');
  await expect(secretaryPage.getByRole('heading', { name: /Diário de Classe/i }).first()).toBeVisible({ timeout: 30_000 });
  await secretaryPage.goto('/admin?module=secretaries');
  await expect(secretaryPage).toHaveURL(/module=overview/, { timeout: 30_000 });
  await expect(secretaryPage.getByRole('region', { name: 'Configuração da escola' })).toBeVisible({ timeout: 30_000 });
  await secretaryPage.goto(`/admin?module=academic-documents&student=${fixture.studentId}`);
  await expect(secretaryPage.getByRole('heading', { name: 'Documentos acadêmicos', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await secretaryContext.close();

  const teacherContext = await browser.newContext({ baseURL: webBaseUrl });
  const teacherPage = await teacherContext.newPage();
  observePage(teacherPage, 'teacher', observations);
  await login(teacherPage, fixture.teacher);
  await performTeacherDiary(teacherPage, fixture);
  await performTeacherAssessment(teacherPage, fixture);
  await submitTeacherTermClosing(teacherPage, fixture);
  await closeAndReopenAsDirector(page, fixture);
  await publishRecovery(teacherPage, fixture);
  await submitTeacherTermClosing(teacherPage, fixture);
  await closeSubmittedPeriodAsDirector(page, fixture);
  await teacherContext.close();

  const studentContext = await browser.newContext({ baseURL: webBaseUrl });
  const studentPage = await studentContext.newPage();
  observePage(studentPage, 'student', observations);
  await login(studentPage, fixture.student);
  await expect(studentPage.getByText('Disciplinas e professores', { exact: true })).toBeVisible();
  await studentPage.goto('/student/attendance');
  await expect(studentPage.getByText(fixture.subjectName, { exact: true })).toBeVisible({ timeout: 30_000 });
  await studentPage.reload();
  await expect(studentPage.getByText(fixture.subjectName, { exact: true })).toBeVisible({ timeout: 30_000 });
  await studentPage.goto('/student/grades');
  await expect(studentPage.getByText(fixture.assessmentTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(studentPage.getByText('4/10', { exact: true })).toBeVisible({ timeout: 30_000 });
  await studentPage.goto('/student/report-card');
  await expect(studentPage.locator('h1').filter({ hasText: 'Boletim' })).toBeVisible({ timeout: 30_000 });
  await expect(studentPage.getByText(fixture.subjectName, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(studentPage.getByText('70%', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await studentContext.close();

  const guardianContext = await browser.newContext({ baseURL: webBaseUrl });
  const guardianPage = await guardianContext.newPage();
  observePage(guardianPage, 'guardian', observations, [{
    label: 'guardian',
    method: 'GET',
    path: /\/rest\/v1\/(?:grades|student_term_results|attendance_records)$/,
    queryIncludes: fixture.studentBId,
    statuses: [401, 403, 404],
  }]);
  await login(guardianPage, fixture.guardian);
  await expect(guardianPage.getByText('Área do responsável', { exact: true })).toBeVisible();
  await guardianPage.goto('/guardian/attendance');
  await expect(guardianPage.getByRole('heading', { name: 'Frequência dos dependentes', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(guardianPage.locator('#guardian-academic-student')).toHaveValue(fixture.studentId, { timeout: 30_000 });
  await guardianPage.goto('/guardian/grades');
  await expect(guardianPage.getByText(fixture.assessmentTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await guardianPage.goto('/guardian/report-card');
  await expect(guardianPage.locator('h1').filter({ hasText: 'Boletim' })).toBeVisible({ timeout: 30_000 });
  await expect(guardianPage.getByText('70%', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(guardianPage.getByText(fixture.studentBName, { exact: true })).toHaveCount(0);
  await guardianPage.goto(`/guardian/grades?student=${fixture.studentBId}`);
  await expect(guardianPage.getByText(fixture.studentBName, { exact: true })).toHaveCount(0);
  await guardianContext.close();

  await auditUiState(fixture);

  const adminContext = await browser.newContext({ baseURL: webBaseUrl });
  const adminPage = await adminContext.newPage();
  observePage(adminPage, 'admin', observations);
  await login(adminPage, fixture.admin);
  await adminPage.goto('/admin?module=class-diary');
  await expect(adminPage).not.toHaveURL(/module=class-diary/, { timeout: 30_000 });
  await expect(adminPage.getByRole('link', { name: 'Diário de Classe', exact: true })).toHaveCount(0);
  await adminContext.close();

  expect(observations.consoleErrors, `console errors:\n${observations.consoleErrors.join('\n')}`).toEqual([]);
  expect(observations.unexpected4xx, `unexpected 4xx:\n${observations.unexpected4xx.join('\n')}`).toEqual([]);
  expect(observations.network5xx, `network 5xx:\n${observations.network5xx.join('\n')}`).toEqual([]);
  expect(observations.requestFailed, `request failures:\n${observations.requestFailed.join('\n')}`).toEqual([]);
  console.log(`[e2e-observations] expected-negative-4xx=${observations.expectedNegative4xx.length} unexpected-4xx=${observations.unexpected4xx.length} network-5xx=${observations.network5xx.length} request-failed=${observations.requestFailed.length} console-errors=${observations.consoleErrors.length}`);

  const runtimeDirectory = join(process.cwd(), 'e2e', '.runtime');
  mkdirSync(runtimeDirectory, { recursive: true });
  writeFileSync(join(runtimeDirectory, 'full-local-fixture.json'), JSON.stringify({
    teacher: fixture.teacher,
    student: fixture.student,
    studentRecordId: fixture.studentId,
    guardian: fixture.guardian,
    institutionId: fixture.institutionId,
    offeringId: fixture.offeringId,
    subjectName: fixture.subjectName,
    studentName: fixture.studentName,
    assessmentTitle: fixture.assessmentTitle,
    diaryDate: fixture.diaryDate,
  }, null, 2));
});
