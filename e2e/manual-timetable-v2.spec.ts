import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; password: string };
const url = process.env.E2E_SUPABASE_URL ?? process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const manualDescribe = url && anonKey && serviceRoleKey ? test.describe : test.describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(db: Db, table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await db.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createDirector(db: Db, institutionId: string, suffix: string): Promise<Actor> {
  const email = `manual-ui-director-${suffix}@local.test`;
  const password = 'ManualUi!2026';
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = required(data.user, 'director user');
  await insertOne(db, 'profiles', { id: user.id, full_name: `Manual Director ${suffix}`, email, role: 'DIRECTOR', active: true });
  await insertOne(db, 'memberships', { profile_id: user.id, institution_id: institutionId, role: 'DIRECTOR', active: true });
  return { id: user.id, email, password };
}

async function createTeacher(db: Db, institutionId: string, suffix: string): Promise<Actor> {
  const email = `manual-ui-teacher-${suffix}@local.test`;
  const password = 'ManualUi!2026';
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = required(data.user, 'teacher user');
  await insertOne(db, 'profiles', { id: user.id, full_name: `Manual Teacher ${suffix}`, email, role: 'TEACHER', active: true });
  await insertOne(db, 'memberships', { profile_id: user.id, institution_id: institutionId, role: 'TEACHER', active: true });
  return { id: user.id, email, password };
}

async function login(page: import('@playwright/test').Page, actor: Actor): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function authenticatedClient(actor: Actor): Promise<Db> {
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: actor.email, password: actor.password });
  if (error) throw error;
  return client;
}

manualDescribe('manual timetable editor v2', () => {
  test('director can create, edit, validate and publish without drag-and-drop', async ({ page }) => {
    const db = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = Date.now().toString(36);
    let institutionId: string | undefined;
    let director: Actor | undefined;
    let teacher: Actor | undefined;
    try {
      institutionId = (await insertOne(db, 'institutions', { name: `Manual UI ${suffix}`, active: true })).id;
      director = await createDirector(db, institutionId, suffix);
      teacher = await createTeacher(db, institutionId, suffix);
      const directorDb = await authenticatedClient(director);
      const yearId = (await insertOne(db, 'academic_years', { institution_id: institutionId, name: `2026 UI ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true })).id;
      const termId = (await insertOne(db, 'terms', { academic_year_id: yearId, name: `1º Bimestre UI ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true })).id;
      const classId = (await insertOne(db, 'classes', { institution_id: institutionId, academic_year_id: yearId, name: `1º ano UI ${suffix}`, grade_level: '1º ano', shift: 'MATUTINO', active: true })).id;
      const subjectId = (await insertOne(db, 'subjects', { institution_id: institutionId, name: `Matemática UI ${suffix}`, code: `UI-${suffix}`, active: true })).id;
      await insertOne(db, 'class_curriculum_items', { institution_id: institutionId, class_id: classId, subject_id: subjectId, weekly_lessons: 1, lesson_duration_minutes: 50, active: true });
      await insertOne(directorDb, 'teacher_subjects', { institution_id: institutionId, teacher_profile_id: teacher.id, subject_id: subjectId, primary_subject: true, active: true });
      const offeringId = (await insertOne(db, 'subject_offerings', { class_id: classId, subject_id: subjectId, teacher_profile_id: teacher.id, term_id: termId, active: true })).id;
      await insertOne(directorDb, 'rooms', { institution_id: institutionId, name: `Sala UI ${suffix}`, capacity: 30, active: true });
      await insertOne(directorDb, 'school_time_slots', { institution_id: institutionId, shift: 'MATUTINO', day_of_week: 1, slot_number: 1, start_time: '07:00', end_time: '07:50', active: true });
      await insertOne(directorDb, 'school_time_slots', { institution_id: institutionId, shift: 'MATUTINO', day_of_week: 1, slot_number: 2, start_time: '07:50', end_time: '08:40', active: true });
      await insertOne(directorDb, 'teacher_availability', { institution_id: institutionId, teacher_profile_id: teacher.id, day_of_week: 1, start_time: '07:00', end_time: '08:40', active: true });

      await login(page, director);
      await page.goto('/admin?module=timetable&view=editor');
      await expect(page.getByText('Editor visual', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Novo rascunho vazio' }).click();
      await expect(page.getByText('Rascunho manual criado.', { exact: false })).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: /Adicionar aula/ }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByText('Aula no rascunho')).toBeVisible();
      await page.getByRole('button', { name: 'Salvar no rascunho' }).click();
      await expect(page.getByText('Aula adicionada ao rascunho.', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('1/1', { exact: true })).toBeVisible({ timeout: 30_000 });

      await page.getByRole('button', { name: 'Validar rascunho' }).click();
      await expect(page.getByText('Sem pendências conhecidas', { exact: true })).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Publicar versão' }).click();
      await expect(page.getByText('Grade publicada.', { exact: false })).toBeVisible({ timeout: 30_000 });

      await page.reload();
      await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      void offeringId;
    } finally {
      if (institutionId) await db.from('institutions').delete().eq('id', institutionId);
      if (director) await db.auth.admin.deleteUser(director.id);
      if (teacher) await db.auth.admin.deleteUser(teacher.id);
    }
  }, 180_000);
});
