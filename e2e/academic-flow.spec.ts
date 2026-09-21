import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type DbClient = SupabaseClient<any, any, any>;
type Actor = { email: string; password: string; id: string };

type Fixture = {
  admin: Actor;
  director: Actor;
  teacher: Actor;
  student: Actor;
  guardian: Actor;
  institutionName: string;
  yearName: string;
  className: string;
  subjectName: string;
  studentName: string;
  studentId: string;
  assessmentTitle: string;
};

const localUrl = process.env.E2E_SUPABASE_URL ?? process.env.MULTI_TENANT_SUPABASE_URL;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.MULTI_TENANT_SUPABASE_ANON_KEY;

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

async function createFixture(): Promise<Fixture> {
  if (!localUrl || !serviceRoleKey || !anonKey) throw new Error('Credenciais locais do Supabase não configuradas.');

  const service = createClient(localUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const actors = {
    admin: await createActor(service, 'ADMIN', 'admin', suffix),
    director: await createActor(service, 'DIRECTOR', 'director', suffix),
    teacher: await createActor(service, 'TEACHER', 'teacher', suffix),
    student: await createActor(service, 'STUDENT', 'student', suffix),
    guardian: await createActor(service, 'GUARDIAN', 'guardian', suffix),
  };

  const account = await insertOne(service, 'accounts', {
    name: `E2E account ${suffix}`,
    owner_profile_id: actors.admin.id,
    institution_limit: 1,
    status: 'ACTIVE',
  });
  const institution = await insertOne(service, 'institutions', {
    account_id: account.id,
    name: `E2E Escola ${suffix}`,
    active: true,
  });
  const institutionId = institution.id as string;

  for (const [actor, role] of [
    [actors.admin, 'ADMIN'],
    [actors.director, 'DIRECTOR'],
    [actors.teacher, 'TEACHER'],
    [actors.student, 'STUDENT'],
    [actors.guardian, 'GUARDIAN'],
  ] as const) {
    await insertOne(service, 'memberships', {
      profile_id: actor.id,
      institution_id: institutionId,
      role,
      active: true,
    });
  }

  const director = await signInClient(actors.director);
  const yearName = `2026 E2E ${suffix}`;
  const academicYear = await insertOne(director, 'academic_years', {
    institution_id: institutionId,
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
  const className = `8º A E2E ${suffix}`;
  const schoolClass = await insertOne(director, 'classes', {
    institution_id: institutionId,
    academic_year_id: academicYear.id,
    name: className,
    grade_level: '8º ano',
    shift: 'MATUTINO',
    capacity: 30,
    active: true,
  });
  const subjectName = `Matemática E2E ${suffix}`;
  const subject = await insertOne(director, 'subjects', {
    institution_id: institutionId,
    name: subjectName,
    code: `E2E-${suffix}`,
    workload: 100,
    active: true,
  });
  await insertOne(director, 'class_curriculum_items', {
    institution_id: institutionId,
    class_id: schoolClass.id,
    subject_id: subject.id,
    weekly_lessons: 2,
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
    institution_id: institutionId,
    name: `Sala E2E ${suffix}`,
    capacity: 30,
    active: true,
  });
  await insertOne(director, 'timetable_entries', {
    institution_id: institutionId,
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
  await service.from('profiles').update({ full_name: studentName }).eq('id', actors.student.id);
  const student = await insertOne(service, 'students', {
    institution_id: institutionId,
    profile_id: actors.student.id,
    registration_number: `E2E-${suffix}`,
    birth_date: '2010-01-01',
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

  const assessmentTitle = `Avaliação E2E ${suffix}`;
  const assessment = await insertOne(service, 'assessments', {
    institution_id: institutionId,
    subject_offering_id: offering.id,
    term_id: term.id,
    title: assessmentTitle,
    description: 'Avaliação criada pela homologação local.',
    assessment_type: 'EXAM',
    assessment_date: '2026-09-15',
    max_score: 10,
    weight: 1,
    status: 'PUBLISHED',
    created_by: actors.teacher.id,
    published_at: new Date().toISOString(),
  });
  await insertOne(service, 'grades', {
    institution_id: institutionId,
    assessment_id: assessment.id,
    student_id: student.id,
    score: 8,
    status: 'GRADED',
    feedback: 'Bom desempenho.',
    recorded_by: actors.teacher.id,
    recorded_at: new Date().toISOString(),
  });

  const teacher = await signInClient(actors.teacher);
  const diary = await teacher.rpc('save_attendance_class_diary', {
    p_institution_id: institutionId,
    p_subject_offering_id: offering.id,
    p_session_date: '2026-09-14',
    p_starts_at: '07:00',
    p_ends_at: '07:50',
    p_topic: 'Equações do segundo grau',
    p_class_activity: 'Exercícios de revisão',
    p_homework: 'Lista de exercícios',
    p_notes: 'Aula criada pelo fluxo E2E.',
    p_records: [{ student_id: student.id, status: 'PRESENT', notes: null }],
    p_status: 'CLOSED',
  });
  if (diary.error) throw new Error(`diary fixture: ${diary.error.message}`);

  return {
    ...actors,
    institutionName: institution.name as string,
    yearName,
    className,
    subjectName,
    studentName,
    studentId: student.id as string,
    assessmentTitle,
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
  consoleErrors: string[],
  networkErrors: string[],
): void {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(`[${label}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(`[${label}] ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    networkErrors.push(`[${label}] ${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkErrors.push(`[${label}] ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
}

test.describe.configure({ mode: 'serial' });

test('homologa o fluxo acadêmico local por papel, recarga e isolamento de sessão', async ({ page, browser }) => {
  const fixture = await createFixture();
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  observePage(page, 'director', consoleErrors, networkErrors);
  await login(page, fixture.director);
  await expect(page).toHaveURL(/\/admin\?module=overview/);
  await expect(page.getByText('Visão geral', { exact: true })).toBeVisible();
  await page.goto('/admin?module=academic-years');
  await expect(page.getByText(fixture.yearName, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.goto('/admin?module=students');
  await expect(page.getByText(fixture.studentName, { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.goto(`/admin?module=academic-documents&student=${fixture.studentId}`);
  await expect(page.getByRole('heading', { name: 'Documentos acadêmicos', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Operação escolar', exact: true }).click();
  await page.getByRole('link', { name: 'Diário de Classe', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Diário de Classe/i }).first()).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: /Diário de Classe/i }).first()).toBeVisible({ timeout: 30_000 });

  const teacherBrowserContext = await browser.newContext({ baseURL: process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000' });
  const teacherPage = await teacherBrowserContext.newPage();
  observePage(teacherPage, 'teacher', consoleErrors, networkErrors);
  await login(teacherPage, fixture.teacher);
  await teacherPage.goto('/dashboard/class-diary');
  await expect(teacherPage.getByRole('heading', { name: 'Diário de Classe', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await teacherPage.goto('/dashboard/grades');
  await expect(teacherPage.getByRole('heading', { name: 'Avaliações e notas', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(teacherPage.getByText(fixture.assessmentTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await teacherPage.goto('/dashboard/term-closing');
  await expect(teacherPage.getByRole('heading', { name: 'Fechamento de período', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(teacherPage.getByRole('heading', { name: 'Recuperação acadêmica', exact: true })).toBeVisible({ timeout: 30_000 });
  await teacherBrowserContext.close();

  const studentBrowserContext = await browser.newContext({ baseURL: process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000' });
  const studentPage = await studentBrowserContext.newPage();
  observePage(studentPage, 'student', consoleErrors, networkErrors);
  await login(studentPage, fixture.student);
  await expect(studentPage.getByText('Disciplinas e professores', { exact: true })).toBeVisible();
  await studentPage.goto('/student/attendance');
  await expect(studentPage.getByText('Frequência', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await studentPage.reload();
  await expect(studentPage.getByText('Frequência', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await studentPage.goto('/student/grades');
  await expect(studentPage.getByText(fixture.assessmentTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await studentPage.goto('/student/report-card');
  await expect(studentPage.locator('h1').filter({ hasText: 'Boletim' })).toBeVisible({ timeout: 30_000 });
  await studentBrowserContext.close();

  const guardianBrowserContext = await browser.newContext({ baseURL: process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000' });
  const guardianPage = await guardianBrowserContext.newPage();
  observePage(guardianPage, 'guardian', consoleErrors, networkErrors);
  await login(guardianPage, fixture.guardian);
  await expect(guardianPage.getByText('Área do responsável', { exact: true })).toBeVisible();
  await guardianPage.goto('/guardian/attendance');
  await expect(guardianPage.getByRole('heading', { name: 'Frequência dos dependentes', exact: true })).toBeVisible({ timeout: 30_000 });
  await guardianPage.goto('/guardian/grades');
  await expect(guardianPage.getByText(fixture.assessmentTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await guardianPage.goto('/guardian/report-card');
  await expect(guardianPage.locator('h1').filter({ hasText: 'Boletim' })).toBeVisible({ timeout: 30_000 });
  await guardianBrowserContext.close();

  const adminBrowserContext = await browser.newContext({ baseURL: process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000' });
  const adminPage = await adminBrowserContext.newPage();
  observePage(adminPage, 'admin', consoleErrors, networkErrors);
  await login(adminPage, fixture.admin);
  await expect(adminPage).toHaveURL(/\/dashboard/);
  await expect(adminPage.getByText(/Conta Ativa/)).toBeVisible({ timeout: 30_000 });
  await adminBrowserContext.close();

  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  expect(networkErrors, `network errors:\n${networkErrors.join('\n')}`).toEqual([]);
});
