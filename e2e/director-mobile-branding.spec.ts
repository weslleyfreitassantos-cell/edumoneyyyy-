import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type DbClient = SupabaseClient<any, any, any>;

const localUrl = process.env.E2E_SUPABASE_URL ?? process.env.MULTI_TENANT_SUPABASE_URL;
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

async function createDirector(): Promise<{ email: string; password: string }> {
  if (!localUrl || !serviceRoleKey) throw new Error('Credenciais locais do Supabase não configuradas.');

  const service = createClient(localUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `e2e-director-mobile-${suffix}@local.test`;
  const password = 'E2E-Director-Mobile!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth director: ${error.message}`);
  const user = required(data.user, 'director auth');

  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: 'E2E Diretor Mobile',
    email,
    role: 'DIRECTOR',
    active: true,
  });
  const account = await insertOne(service, 'accounts', {
    name: `E2E mobile account ${suffix}`,
    owner_profile_id: user.id,
    institution_limit: 1,
    status: 'ACTIVE',
  });
  const institution = await insertOne(service, 'institutions', {
    account_id: account.id,
    name: `E2E mobile school ${suffix}`,
    subdomain: `e2e-mobile-${suffix}`,
    active: true,
  });
  await insertOne(service, 'memberships', {
    profile_id: user.id,
    institution_id: institution.id,
    role: 'DIRECTOR',
    active: true,
  });

  return { email, password };
}

async function login(page: Page, credentials: { email: string; password: string }): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('E-mail institucional').fill(credentials.email);
  await page.locator('#login-password').fill(credentials.password);
  const submitButton = page.locator('form button[type="submit"]');
  await expect(submitButton).toBeVisible({ timeout: 30_000 });
  await expect(submitButton).toBeEnabled({ timeout: 30_000 });
  await submitButton.click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

test('panorama e personalização do diretor permanecem utilizáveis em telas estreitas', async ({ page }) => {
  test.setTimeout(180_000);
  const credentials = await createDirector();
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];

  await page.setViewportSize(viewports[0]);
  await login(page, credentials);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/admin?module=overview', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Desempenho, frequência e pontos de atenção' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Frequência média ao longo do tempo' })).toBeVisible({ timeout: 30_000 });
    await expectNoDocumentOverflow(page);
  }

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
    await page.goto('/personalizar-login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Personalizar login' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Visualizar no celular' })).toBeVisible();
    await expectNoDocumentOverflow(page);
  }
});
