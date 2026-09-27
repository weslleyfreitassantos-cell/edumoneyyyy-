import { expect, test } from '@playwright/test';

type PilotUser = {
  role: 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'STUDENT' | 'GUARDIAN' | 'ADMIN' | 'SUPER_ADMIN';
  email: string;
  password: string;
};

const pilotUsers = JSON.parse(process.env.PROD_SMOKE_USERS_JSON ?? '[]') as PilotUser[];
const supportedRoles = new Set<PilotUser['role']>([
  'DIRECTOR', 'SECRETARY', 'TEACHER', 'STUDENT', 'GUARDIAN', 'ADMIN', 'SUPER_ADMIN',
]);

if (!pilotUsers.length || pilotUsers.some((user) =>
  !supportedRoles.has(user.role) || !user.email || !user.password
)) {
  throw new Error('PROD_SMOKE_USERS_JSON must contain pilot users with supported role, email and password fields.');
}

function safePath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[invalid URL]';
  }
}

function observeRuntime(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const httpFailures: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push('console.error');
  });
  page.on('pageerror', () => pageErrors.push('pageerror'));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${safePath(request.url())}`));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpFailures.push(`${response.status()} ${response.request().method()} ${safePath(response.url())}`);
    }
  });

  return { consoleErrors, pageErrors, failedRequests, httpFailures };
}

async function setSensitiveInputValue(
  locator: import('@playwright/test').Locator,
  value: string,
): Promise<void> {
  await locator.evaluate((element, nextValue) => {
    if (!(element instanceof HTMLInputElement)) throw new Error('Expected a login input.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Native input setter is unavailable.');
    setter.call(element, nextValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function attachObservations(
  page: import('@playwright/test').Page,
  observations: ReturnType<typeof observeRuntime>,
) {
  await test.info().attach('production-smoke-observations.json', {
    body: JSON.stringify(observations, null, 2),
    contentType: 'application/json',
  });
}

test('unauthenticated academic route returns to login', async ({ page }) => {
  const observations = observeRuntime(page);
  try {
    await page.goto('/dashboard/class-diary');
    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
    expect(observations.consoleErrors).toEqual([]);
    expect(observations.pageErrors).toEqual([]);
    expect(observations.failedRequests).toEqual([]);
    expect(observations.httpFailures).toEqual([]);
  } finally {
    await attachObservations(page, observations);
  }
});

test('password recovery entry point is available without sending mail', async ({ page }) => {
  const observations = observeRuntime(page);
  try {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByLabel('E-mail institucional')).toBeVisible();
    await expect(page.getByRole('button').first()).toBeVisible();
    expect(observations.consoleErrors).toEqual([]);
    expect(observations.pageErrors).toEqual([]);
    expect(observations.failedRequests).toEqual([]);
    expect(observations.httpFailures).toEqual([]);
  } finally {
    await attachObservations(page, observations);
  }
});

for (const user of pilotUsers) {
  test(`pilot login, role dashboard and logout: ${user.role}`, async ({ page }) => {
    const observations = observeRuntime(page);
    try {
      await page.goto('/login');
      await expect(page.getByLabel('E-mail institucional')).toBeVisible();
      await setSensitiveInputValue(page.getByLabel('E-mail institucional'), user.email);
      await setSensitiveInputValue(page.getByLabel('Senha', { exact: true }), user.password);
      await page.getByRole('button', { name: 'Entrar no sistema' }).click();
      await expect(page).toHaveURL((url) => url.pathname.startsWith('/dashboard'));
      await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Sair' }).click();
      await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);

      expect(observations.consoleErrors).toEqual([]);
      expect(observations.pageErrors).toEqual([]);
      expect(observations.failedRequests).toEqual([]);
      expect(observations.httpFailures).toEqual([]);
    } finally {
      await attachObservations(page, observations);
    }
  });
}
