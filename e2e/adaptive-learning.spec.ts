import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; password: string };

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

async function createActor(db: Db, role: 'ADMIN' | 'TEACHER' | 'STUDENT', name: string, suffix: string): Promise<Actor> {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const email = `adaptive-${normalizedName}-${suffix}@local.test`;
  const password = 'AdaptiveE2E!2026';
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = required(data.user, `${name} auth user`);
  await insertOne(db, 'profiles', { id: user.id, full_name: name, email, role, active: true });
  return { id: user.id, email, password };
}

async function login(page: import('@playwright/test').Page, actor: Actor): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

adaptiveDescribe('adaptive learning student and teacher journey', () => {
  test('Alice studies a guided practice and Pedro sees her learning detail', async ({ browser }) => {
    const service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = Date.now().toString(36);
    const admin = await createActor(service, 'ADMIN', 'Admin Adaptive', suffix);
    const pedro = await createActor(service, 'TEACHER', 'Pedro Adaptive', suffix);
    const alice = await createActor(service, 'STUDENT', 'Alice Adaptive', suffix);
    const maria = await createActor(service, 'STUDENT', 'Maria Support', suffix);
    const account = await insertOne(service, 'accounts', { name: `Adaptive E2E ${suffix}`, owner_profile_id: admin.id, institution_limit: 1, status: 'ACTIVE' });
    const institution = await insertOne(service, 'institutions', { account_id: account.id, name: `TecEscola Adaptive ${suffix}`, active: true });
    await insertOne(service, 'memberships', { profile_id: admin.id, institution_id: institution.id, role: 'ADMIN', active: true });
    await insertOne(service, 'memberships', { profile_id: pedro.id, institution_id: institution.id, role: 'TEACHER', active: true });
    await insertOne(service, 'memberships', { profile_id: alice.id, institution_id: institution.id, role: 'STUDENT', active: true });
    await insertOne(service, 'memberships', { profile_id: maria.id, institution_id: institution.id, role: 'STUDENT', active: true });
    const year = await insertOne(service, 'academic_years', { institution_id: institution.id, name: `2026 Adaptive ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true });
    const term = await insertOne(service, 'terms', { academic_year_id: year.id, name: `Bimestre Adaptive ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true });
    const schoolClass = await insertOne(service, 'classes', { institution_id: institution.id, academic_year_id: year.id, name: `1º ano Adaptive ${suffix}`, grade_level: '1º ano', shift: 'INTEGRAL', active: true });
    const subject = await insertOne(service, 'subjects', { institution_id: institution.id, name: `Matemática Adaptive ${suffix}`, code: `ADAPTIVE-${suffix}`, active: true });
    await insertOne(service, 'class_curriculum_items', { institution_id: institution.id, class_id: schoolClass.id, subject_id: subject.id, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
    await insertOne(service, 'subject_offerings', { class_id: schoolClass.id, subject_id: subject.id, teacher_profile_id: pedro.id, term_id: term.id, active: true });
    const student = await insertOne(service, 'students', { institution_id: institution.id, profile_id: alice.id, registration_number: `ADAPTIVE-${suffix}`, active: true });
    await insertOne(service, 'enrollments', { student_id: student.id, class_id: schoolClass.id, academic_year_id: year.id, status: 'active', active: true });
    const mariaStudent = await insertOne(service, 'students', { institution_id: institution.id, profile_id: maria.id, registration_number: `SUPPORT-${suffix}`, active: true });
    await insertOne(service, 'enrollments', { student_id: mariaStudent.id, class_id: schoolClass.id, academic_year_id: year.id, status: 'active', active: true });
    const canonical = await service.from('learning_curriculum_skills').select('id').eq('code', 'FRACTIONS').single();
    const canonicalSkill = required(canonical.data, 'FRACTIONS canonical skill');
    const unit = await insertOne(service, 'learning_units', { institution_id: institution.id, subject_id: subject.id, title: `Números ${suffix}`, active: true });
    const skill = await insertOne(service, 'learning_skills', { institution_id: institution.id, unit_id: unit.id, title: `Frações ${suffix}`, active: true });
    await insertOne(service, 'learning_skill_canonical_links', { institution_id: institution.id, learning_skill_id: skill.id, canonical_skill_id: canonicalSkill.id, active: true });
    const activity = await insertOne(service, 'learning_activities', { institution_id: institution.id, subject_id: subject.id, unit_id: unit.id, skill_id: skill.id, teacher_id: pedro.id, title: `Prática de frações ${suffix}`, description: 'Prática guiada E2E', activity_type: 'PRACTICE', status: 'PUBLISHED' });
    await insertOne(service, 'learning_questions', { institution_id: institution.id, activity_id: activity.id, question_text: 'Quanto é 1/2 + 1/2?', question_type: 'MULTIPLE_CHOICE', options_json: ['1', '2'], correct_answer_json: '1', explanation: 'Duas metades formam um inteiro.', points: 1, sort_order: 0 });
    await insertOne(service, 'learning_assignments', { institution_id: institution.id, activity_id: activity.id, class_id: schoolClass.id, assigned_by: pedro.id });

    let studentPage: import('@playwright/test').Page | undefined;
    let teacherPage: import('@playwright/test').Page | undefined;
    try {
      const aliceDb = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
      const aliceSession = await aliceDb.auth.signInWithPassword({ email: alice.email, password: alice.password });
      expect(aliceSession.error).toBeNull();
      const started = await aliceDb.rpc('start_guided_learning_session', { p_institution_id: institution.id, p_student_id: student.id, p_target_canonical_skill_id: canonicalSkill.id });
      expect(started.error).toBeNull();

      studentPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await login(studentPage, alice);
      await studentPage.goto('/student/study');
      await expect(studentPage.getByText('Olá, Alice. O que vamos estudar hoje?')).toBeVisible({ timeout: 30_000 });
      expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await expect(studentPage.getByText(`Prática de frações ${suffix}`)).toBeVisible({ timeout: 30_000 });
      await studentPage.getByRole('link', { name: 'Começar atividade' }).click();
      await expect(studentPage.getByText('Quanto é 1/2 + 1/2?')).toBeVisible({ timeout: 30_000 });
      await expect(studentPage.getByText('Duas metades formam um inteiro.')).not.toBeVisible();
      await studentPage.getByLabel('1').check();
      await studentPage.getByRole('button', { name: 'Enviar prática' }).click();
      await expect(studentPage.getByText('Prática concluída')).toBeVisible({ timeout: 30_000 });

      teacherPage = await browser.newPage();
      await login(teacherPage, pedro);
      await teacherPage.goto('/teacher/pedagogical-center/students');
      await expect(teacherPage.getByText('Alunos em acompanhamento')).toBeVisible({ timeout: 30_000 });
      await expect(teacherPage.getByText('Alice Adaptive')).toBeVisible({ timeout: 30_000 });
      await teacherPage.getByRole('link', { name: /Alice Adaptive/ }).click();
      await expect(teacherPage.getByRole('region', { name: 'Mapa de aprendizagem' })).toBeVisible({ timeout: 30_000 });
      await expect(teacherPage.getByText('Pontos para revisar')).toBeVisible({ timeout: 30_000 });
      await teacherPage.goto('/teacher/pedagogical-center/students');
      await teacherPage.getByRole('link', { name: /Maria Support/ }).click();
      await expect(teacherPage.getByText('Ainda não há evidências mapeadas para este aluno.')).toBeVisible({ timeout: 30_000 });
      await expect(teacherPage.getByText('Nenhuma sessão guiada registrada.')).toBeVisible({ timeout: 30_000 });
    } finally {
      await studentPage?.close();
      await teacherPage?.close();
      await service.from('institutions').delete().eq('id', institution.id);
      await service.auth.admin.deleteUser(admin.id);
      await service.auth.admin.deleteUser(pedro.id);
      await service.auth.admin.deleteUser(alice.id);
      await service.auth.admin.deleteUser(maria.id);
    }
  }, 180_000);
});
