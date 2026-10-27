import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type DbClient = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; password: string; client: DbClient };

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL ?? process.env.E2E_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY ?? process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(client: DbClient, table: string, row: Record<string, unknown>) {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(service: DbClient, role: string, suffix: string): Promise<Actor> {
  const email = `psychology-subdomain-${role.toLowerCase()}-${suffix}@local.test`;
  const password = `Psychology-${role}-E2E!2026`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${role}: ${error.message}`);
  const user = required(data.user, `${role} user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: `E2E ${role} ${suffix}`, email, role, active: true });

  const client = createClient(localUrl!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  return { id: user.id, email, password, client };
}

function saoPauloDate(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return new Date(Date.UTC(values.year, values.month - 1, values.day + offsetDays)).toISOString().slice(0, 10);
}

async function login(page: Page, host: string, actor: Actor): Promise<void> {
  await page.goto(`http://${host}:3000/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  const submit = page.locator('form button[type="submit"]');
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function createFixture() {
  if (!localUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase descartável não configuradas.');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(localUrl).hostname)) {
    throw new Error('Este E2E aceita somente um Supabase local descartável.');
  }

  const service = createClient(localUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const owner = await createActor(service, 'ADMIN', `${suffix}-owner`);
  const account = await insertOne(service, 'accounts', {
    name: `Psychology Subdomain E2E ${suffix}`, owner_profile_id: owner.id, institution_limit: 3, status: 'ACTIVE',
  });
  const institutions = await Promise.all(['a', 'b', 'c'].map((school) => insertOne(service, 'institutions', {
    account_id: account.id,
    name: `Psychology E2E ${school.toUpperCase()} ${suffix}`,
    subdomain: `psych-${school}-${suffix}`,
    active: true,
    plan: 'PROFESSIONAL',
  })));
  const director = await createActor(service, 'DIRECTOR', suffix);
  const psychologist = await createActor(service, 'PSYCHOLOGIST', suffix);

  for (const institution of institutions.slice(0, 2)) {
    await insertOne(service, 'memberships', { profile_id: director.id, institution_id: institution.id, role: 'DIRECTOR', active: true });
  }
  await insertOne(service, 'memberships', { profile_id: psychologist.id, institution_id: institutions[0].id, role: 'PSYCHOLOGIST', active: true });
  await insertOne(service, 'memberships', { profile_id: psychologist.id, institution_id: institutions[1].id, role: 'TEACHER', active: true });

  const directorSession = await director.client.auth.signInWithPassword({ email: director.email, password: director.password });
  if (directorSession.error) throw new Error(`sign in director: ${directorSession.error.message}`);
  for (const institution of institutions.slice(0, 2)) {
    const enabled = await director.client.rpc('psychology_set_module_enabled', {
      target_institution_id: institution.id, target_enabled: true,
    });
    if (enabled.error) throw new Error(`enable psychology module: ${enabled.error.message}`);
  }

  const registered = await director.client.rpc('psychology_register_professional', {
    target_institution_id: institutions[0].id,
    target_profile_id: psychologist.id,
    target_crp_registration: '03/77123',
    target_crp_state: 'BA',
  });
  if (registered.error || registered.data?.verification_status !== 'PENDING') {
    throw new Error(`register pending CRP: ${registered.error?.message ?? 'unexpected status'}`);
  }

  const signedInPsychologist = await psychologist.client.auth.signInWithPassword({ email: psychologist.email, password: psychologist.password });
  if (signedInPsychologist.error) throw new Error(`sign in psychologist: ${signedInPsychologist.error.message}`);
  const ruleDate = saoPauloDate(1);
  const [year, month, day] = ruleDate.split('-').map(Number);
  const pendingRule = await psychologist.client.rpc('psychology_set_availability_rule', {
    target_institution_id: institutions[0].id,
    target_rule_id: null,
    target_day_of_week: new Date(Date.UTC(year, month - 1, day, 15)).getUTCDay(),
    target_start_local: '09:00:00',
    target_end_local: '10:00:00',
    target_timezone: 'America/Sao_Paulo',
    target_session_minutes: 50,
    target_preparation_minutes: 10,
    target_valid_from: ruleDate,
    target_valid_until: null,
    target_active: true,
  });
  expect(pendingRule.error?.code).toBe('P0001');

  const verified = await director.client.rpc('psychology_verify_professional', {
    target_institution_id: institutions[0].id,
    target_profile_id: psychologist.id,
    human_crp_verified: true,
  });
  if (verified.error) throw new Error(`verify CRP in local fixture: ${verified.error.message}`);
  const activeRule = await psychologist.client.rpc('psychology_set_availability_rule', {
    target_institution_id: institutions[0].id,
    target_rule_id: null,
    target_day_of_week: new Date(Date.UTC(year, month - 1, day, 15)).getUTCDay(),
    target_start_local: '09:00:00',
    target_end_local: '10:00:00',
    target_timezone: 'America/Sao_Paulo',
    target_session_minutes: 50,
    target_preparation_minutes: 10,
    target_valid_from: ruleDate,
    target_valid_until: null,
    target_active: true,
  });
  if (activeRule.error) throw new Error(`verified professional availability: ${activeRule.error.message}`);

  return {
    psychologist,
    hosts: institutions.map((institution) => `${institution.subdomain}.grupotec.dev.br`),
  };
}

test('psicóloga entra na agenda no subdomínio vinculado e não herda autorização no segundo', async ({ page }) => {
  test.setTimeout(180_000);
  const fixture = await createFixture();

  await login(page, fixture.hosts[0], fixture.psychologist);
  await page.goto(`http://${fixture.hosts[0]}:3000/psychology/agenda`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Agenda profissional' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Nenhum atendimento atribuído nesse período.')).toBeVisible({ timeout: 30_000 });

  await login(page, fixture.hosts[1], fixture.psychologist);
  await page.goto(`http://${fixture.hosts[1]}:3000/psychology/agenda`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard(?:$|\?)/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Agenda profissional' })).toHaveCount(0);

  await page.goto(`http://${fixture.hosts[2]}:3000/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('E-mail institucional').fill(fixture.psychologist.email);
  await page.locator('#login-password').fill(fixture.psychologist.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.', { timeout: 30_000 });
});
