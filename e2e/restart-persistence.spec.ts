import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

type Actor = { email: string; password: string; id: string };
type PersistenceFixture = {
  teacher: Actor;
  student: Actor;
  studentRecordId: string;
  offeringId: string;
  subjectName: string;
  studentName: string;
  assessmentTitle: string;
  diaryDate: string;
};

function readFixture(): PersistenceFixture {
  return JSON.parse(readFileSync(join(process.cwd(), 'e2e', '.runtime', 'full-local-fixture.json'), 'utf8')) as PersistenceFixture;
}

async function login(page: Page, actor: Actor): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test('retém fluxo acadêmico depois de restart do Supabase e do frontend @restart', async ({ browser }) => {
  const fixture = readFixture();
  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await login(teacherPage, fixture.teacher);
  await teacherPage.goto('/dashboard/class-diary');
  await expect(teacherPage.getByRole('heading', { name: 'Diário de Classe', exact: true })).toBeVisible({ timeout: 30_000 });
  await teacherPage.locator('#attendance-offering').selectOption(fixture.offeringId);
  await teacherPage.locator('#attendance-date').fill(fixture.diaryDate);
  await expect(teacherPage.locator('#diary-topic')).toHaveValue('Equações do segundo grau', { timeout: 30_000 });
  await expect(teacherPage.locator('#diary-activity')).toHaveValue('Exercícios de revisão');
  await expect(teacherPage.locator('#diary-homework')).toHaveValue('Lista de exercícios');
  await expect(teacherPage.locator('#diary-notes')).toHaveValue('Aula criada pelo fluxo E2E.');
  await expect(teacherPage.locator(`#attendance-status-${fixture.studentRecordId}`)).toHaveValue('PRESENT');
  await teacherPage.goto('/dashboard/grades');
  await expect(teacherPage.getByRole('heading', { name: 'Avaliações e notas', exact: true })).toBeVisible({ timeout: 30_000 });
  await teacherPage.locator('#grade-offering').selectOption(fixture.offeringId);
  await expect(teacherPage.getByText(fixture.assessmentTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(teacherPage.locator(`#grade-score-${fixture.studentRecordId}`)).toHaveValue('4');
  await teacherContext.close();

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await login(studentPage, fixture.student);
  await studentPage.goto('/student/attendance');
  await expect(studentPage.getByText(fixture.subjectName, { exact: true })).toBeVisible({ timeout: 30_000 });
  await studentPage.goto('/student/grades');
  await expect(studentPage.getByText(fixture.assessmentTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(studentPage.getByText('4/10', { exact: true })).toBeVisible({ timeout: 30_000 });
  await studentPage.goto('/student/report-card');
  await expect(studentPage.getByRole('heading', { name: /Boletim/i })).toBeVisible({ timeout: 30_000 });
  await expect(studentPage.getByText(fixture.subjectName, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(studentPage.getByText('70%', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await studentContext.close();
});
