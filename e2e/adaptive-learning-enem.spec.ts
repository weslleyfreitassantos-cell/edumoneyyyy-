import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; password: string; client: Db };

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

async function createActor(service: Db, role: 'ADMIN' | 'STUDENT', name: string, suffix: string): Promise<Actor> {
  const email = `enem-official-${role.toLowerCase()}-${suffix}@local.test`;
  const password = 'EnemOfficialE2E!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = required(data.user, `ENEM ${role.toLowerCase()} auth user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: name, email, role, active: true });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ENEM ${role.toLowerCase()}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, password, client };
}

async function login(page: import('@playwright/test').Page, actor: Actor): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

adaptiveDescribe('official ENEM learning journey', () => {
  test('keeps historical practice hidden until dynamic readiness gates pass', async ({ browser }) => {
    const service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = Date.now().toString(36);
    const userIds: string[] = [];
    let accountId: string | undefined;
    let institutionId: string | undefined;
    let studentId: string | undefined;
    let page: import('@playwright/test').Page | undefined;

    try {
      const admin = await createActor(service, 'ADMIN', 'Admin ENEM Oficial', suffix);
      const student = await createActor(service, 'STUDENT', 'Alice ENEM Oficial', suffix);
      userIds.push(admin.id, student.id);

      accountId = (await insertOne(service, 'accounts', {
        name: `ENEM official ${suffix}`,
        owner_profile_id: admin.id,
        institution_limit: 1,
        status: 'ACTIVE',
      })).id;
      institutionId = (await insertOne(service, 'institutions', {
        account_id: accountId,
        name: `TecEscola ENEM official ${suffix}`,
        active: true,
      })).id;
      await insertOne(service, 'memberships', { profile_id: admin.id, institution_id: institutionId, role: 'ADMIN', active: true });
      await insertOne(service, 'memberships', { profile_id: student.id, institution_id: institutionId, role: 'STUDENT', active: true });

      const yearId = (await insertOne(service, 'academic_years', {
        institution_id: institutionId,
        name: `2026 ENEM ${suffix}`,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        active: true,
      })).id;
      const classId = (await insertOne(service, 'classes', {
        institution_id: institutionId,
        academic_year_id: yearId,
        name: `3º ano ENEM ${suffix}`,
        grade_level: '3º ano',
        shift: 'INTEGRAL',
        active: true,
      })).id;
      studentId = (await insertOne(service, 'students', {
        institution_id: institutionId,
        profile_id: student.id,
        registration_number: `ENEM-${suffix}`,
        active: true,
      })).id;
      await insertOne(service, 'enrollments', {
        student_id: studentId,
        class_id: classId,
        academic_year_id: yearId,
        status: 'active',
        active: true,
      });

      const simulation = await service
        .from('learning_simulations')
        .select('id,title,simulation_type,source_year')
        .eq('title', 'ENEM 2023 · Matemática · Caderno 5')
        .is('institution_id', null)
        .single();
      expect(simulation.error).toBeNull();
      expect(simulation.data).toMatchObject({ simulation_type: 'HISTORICAL_EXAM', source_year: 2023 });

      const simulationQuestions = await service
        .from('learning_simulation_questions')
        .select('position,question_bank_id')
        .eq('simulation_id', simulation.data.id)
        .order('position');
      expect(simulationQuestions.error).toBeNull();
      expect(simulationQuestions.data).toHaveLength(1);
      const question = await service
        .from('learning_question_bank')
        .select('id,package_type,source_type,source_year,source_number,options,correct_answer,source_reference')
        .eq('id', simulationQuestions.data[0].question_bank_id)
        .single();
      expect(question.error).toBeNull();
      expect(question.data).toMatchObject({
        package_type: 'ENEM',
        source_type: 'ENEM_OFFICIAL_2023_D2_CD5',
        source_year: 2023,
        source_number: 136,
        source_reference: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2023_PV_impresso_D2_CD5.pdf',
      });

      page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await login(page, student);
      await page.goto('/student/study');
      await expect(page.getByRole('heading', { name: 'Práticas oficiais' })).toBeVisible({ timeout: 30_000 });
    } finally {
      await page?.close();
      if (institutionId) await service.from('institutions').delete().eq('id', institutionId);
      if (accountId) await service.from('accounts').delete().eq('id', accountId);
      if (userIds.length) await service.from('profiles').delete().in('id', userIds);
      for (const userId of userIds) await service.auth.admin.deleteUser(userId);
    }
  }, 240_000);
});
