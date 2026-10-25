import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type DbClient = SupabaseClient<any, any, any>;

const localUrl = process.env.E2E_SUPABASE_URL ?? process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(client: DbClient, table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createUser(service: DbClient, institutionId: string, role: string, name: string, suffix: string) {
  const email = `finance-${role.toLowerCase()}-${suffix}@local.test`;
  const password = `Finance-${role}-E2E!2026`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${role}: ${error.message}`);
  const user = required(data.user, `${role} user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: name, email, role, active: true });
  await insertOne(service, 'memberships', { profile_id: user.id, institution_id: institutionId, role, active: true });
  return { id: user.id, email, password };
}

async function createFinanceFixture(): Promise<{
  credentials: { email: string; password: string };
  studentName: string;
  registrationNumber: string;
  guardianName: string;
  academicYearName: string;
  className: string;
}> {
  if (!localUrl || !anonKey || !serviceRoleKey) throw new Error('Credenciais do Supabase descartável não configuradas.');
  const host = new URL(localUrl).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('O E2E financeiro aceita somente um Supabase local descartável.');
  }

  const service = createClient(localUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `finance-owner-${suffix}@local.test`;
  const ownerAuth = await service.auth.admin.createUser({ email: ownerEmail, password: 'Finance-Owner-E2E!2026', email_confirm: true });
  if (ownerAuth.error) throw new Error(`auth account owner: ${ownerAuth.error.message}`);
  const owner = required(ownerAuth.data.user, 'account owner');
  await insertOne(service, 'profiles', { id: owner.id, full_name: `Finance Owner ${suffix}`, email: ownerEmail, role: 'ADMIN', active: true });
  const account = await insertOne(service, 'accounts', { name: `Finance E2E ${suffix}`, owner_profile_id: owner.id, institution_limit: 1, status: 'ACTIVE' });
  const institution = await insertOne(service, 'institutions', {
    account_id: account.id, name: `Finance E2E ${suffix}`, subdomain: `finance-e2e-${suffix}`, active: true, plan: 'PROFESSIONAL',
  });
  const institutionId = institution.id as string;

  const director = await createUser(service, institutionId, 'DIRECTOR', `Diretora Finance ${suffix}`, suffix);
  const guardianName = `Responsável Finance ${suffix}`;
  const guardian = await createUser(service, institutionId, 'GUARDIAN', guardianName, `${suffix}-guardian`);
  const studentName = `Estudante Finance ${suffix}`;
  const registrationNumber = `FIN-${suffix}`;
  const student = await createUser(service, institutionId, 'STUDENT', studentName, `${suffix}-student`);
  const studentRow = await insertOne(service, 'students', {
    profile_id: student.id, institution_id: institutionId, registration_number: registrationNumber, active: true,
  });
  await insertOne(service, 'guardianships', {
    student_id: studentRow.id, guardian_profile_id: guardian.id, relationship: 'responsável', active: true, is_primary: true,
  });
  const academicYearName = `Ano Finance ${suffix}`;
  const academicYear = await insertOne(service, 'academic_years', {
    institution_id: institutionId, name: academicYearName, start_date: '2026-01-01', end_date: '2028-12-31', active: true,
  });
  const className = `Turma Finance ${suffix}`;
  const schoolClass = await insertOne(service, 'classes', {
    institution_id: institutionId, academic_year_id: academicYear.id, name: className, active: true,
  });
  await insertOne(service, 'enrollments', {
    student_id: studentRow.id, class_id: schoolClass.id, academic_year_id: academicYear.id, status: 'active', active: true,
  });

  return { credentials: { email: director.email, password: director.password }, studentName, registrationNumber, guardianName, academicYearName, className };
}

async function login(page: Page, credentials: { email: string; password: string }): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('E-mail institucional').fill(credentials.email);
  await page.locator('#login-password').fill(credentials.password);
  const submit = page.locator('form button[type="submit"]');
  await expect(submit).toBeVisible({ timeout: 30_000 });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test('direção cria contrato, registra recebimento parcial e exporta relatório', async ({ page }) => {
  test.setTimeout(180_000);
  const fixture = await createFinanceFixture();
  await login(page, fixture.credentials);
  await page.goto('/admin?module=finance', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Financeiro escolar' })).toBeVisible({ timeout: 30_000 });

  const financeNav = page.getByRole('navigation', { name: 'Navegação financeira' });
  await financeNav.getByRole('button', { name: 'Contratos' }).click();
  await page.getByLabel('Buscar estudante para contrato').fill(fixture.studentName);
  await expect(page.getByRole('option', { name: new RegExp(fixture.studentName) })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Estudante', { exact: true }).selectOption({ label: `${fixture.studentName} · ${fixture.registrationNumber}` });
  await page.getByLabel('Responsável financeiro', { exact: true }).selectOption({ label: fixture.guardianName });
  await page.getByLabel('Ano letivo', { exact: true }).selectOption({ label: fixture.academicYearName });
  await page.getByLabel('Matrícula (opcional)', { exact: true }).selectOption({ label: `${fixture.className} · ${fixture.academicYearName}` });
  await page.getByLabel('Mensalidade (R$)', { exact: true }).fill('120,00');
  await page.getByLabel('Número de parcelas', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Criar contrato e gerar parcelas' }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 mensalidades geradas' })).toBeVisible({ timeout: 30_000 });

  await financeNav.getByRole('button', { name: 'Mensalidades' }).click();
  const invoiceSort = page.getByLabel('Ordenar por');
  await invoiceSort.selectOption('balance:DESC');
  await expect(invoiceSort).toHaveValue('balance:DESC');
  const invoiceRow = page.getByRole('row').filter({ hasText: fixture.studentName }).first();
  await expect(invoiceRow).toBeVisible({ timeout: 30_000 });
  await invoiceRow.getByRole('button', { name: 'Registrar recebimento' }).click();
  const receiptDialog = page.getByRole('dialog', { name: 'Registrar recebimento manual' });
  await receiptDialog.getByLabel('Valor recebido (R$)').fill('25,00');
  await receiptDialog.getByRole('button', { name: 'Registrar recebimento' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recebimento manual registrado' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('row').filter({ hasText: fixture.studentName }).first()).toContainText('Parcial');

  await financeNav.getByRole('button', { name: 'Recebimentos' }).click();
  await expect(page.getByRole('row').filter({ hasText: fixture.studentName }).first()).toContainText('R$ 25,00', { timeout: 30_000 });

  await financeNav.getByRole('button', { name: 'Despesas' }).click();
  const expenseName = `Energia E2E ${fixture.registrationNumber}`;
  const currentMonth = new Date().toISOString().slice(0, 7);
  await page.getByLabel('Categoria', { exact: true }).selectOption({ label: 'Energia' });
  await page.getByLabel('Descrição', { exact: true }).fill(expenseName);
  await page.getByLabel('Valor (R$)', { exact: true }).fill('80,00');
  await page.getByLabel('Competência', { exact: true }).fill(currentMonth);
  await page.getByLabel('Repetir por quantos meses', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Salvar despesa' }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 lançamento(s) de despesa salvo(s)' })).toBeVisible({ timeout: 30_000 });
  await financeNav.getByRole('button', { name: 'Contas a pagar' }).click();
  await expect(page.getByRole('row').filter({ hasText: expenseName }).first()).toBeVisible({ timeout: 30_000 });

  await financeNav.getByRole('button', { name: 'Visão geral' }).click();
  const receivedCard = page.getByRole('article').filter({ hasText: 'Recebido no período' });
  await expect(receivedCard).toContainText(/R\$\s?25,00/, { timeout: 30_000 });
  const payableCard = page.getByRole('article').filter({ hasText: 'Contas a pagar' });
  await expect(payableCard).toContainText(/R\$\s?80,00/, { timeout: 30_000 });

  await financeNav.getByRole('button', { name: 'Relatórios' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^financeiro-receipts-/);

  await page.setViewportSize({ width: 390, height: 844 });
  await financeNav.getByRole('button', { name: 'Visão geral' }).click();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(horizontalOverflow).toBe(false);
});
