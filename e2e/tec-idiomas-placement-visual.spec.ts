import { expect, test, type Page } from '@playwright/test';

const courses = {
  english: 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER',
  spanish: 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER',
  korean: 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER',
} as const;

const locales = [
  { name: 'Inglês', code: courses.english, locale: 'en-US' },
  { name: 'Espanhol', code: courses.spanish, locale: 'es-ES' },
  { name: 'Coreano', code: courses.korean, locale: 'ko-KR' },
] as const;

const correctAnswers: Record<string, number> = {
  'Good morning': 0, 'Thank you': 2, 'brother lives near': 0, 'nearest station': 1,
  'rains tomorrow': 1, 'since 2022': 2,
  'Buenos días': 1, 'Muchas gracias': 0, '¿Dónde está': 0, 'Ayer compré': 1,
  'Aunque estaba': 1, 'Cuando termine': 0,
  '안녕하세요': 0, '감사합니다': 1, '오늘은 친구와': 0, '이 음식은': 1,
  '시간이 있으면': 1, '비가 그친 뒤': 0,
};

type Placement = { attemptId: string; record: Record<string, unknown> };
type PlacementStore = Map<string, Placement>;

function courseMap(code: string, title: string) {
  return {
    course: { code, title, description: 'Percurso iniciante.', version: 4, publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' },
    units: Array.from({ length: 4 }, (_, unitIndex) => ({
      id: `${code}-unit-${unitIndex + 1}`, position: unitIndex + 1, title: `Unidade ${unitIndex + 1}`,
      description: 'Prática de idiomas.',
      lessons: Array.from({ length: 4 }, (_, lessonIndex) => {
        const position = unitIndex * 4 + lessonIndex + 1;
        return {
          id: `${code}-lesson-${position}`, course_code: code, position: lessonIndex + 1,
          title: `Lição ${position}`, status: position === 1 ? 'AVAILABLE' : 'LOCKED',
          exercise_count: 7, xp_reward: 30, active_session_id: null, completed_at: null,
        };
      }),
    })),
    stats: { xp: 0, current_streak: 0, longest_streak: 0, last_study_date: null },
    completed_lessons: 0, total_lessons: 16, continue_lesson_id: `${code}-lesson-1`,
  };
}

async function installFixtureApi(page: Page, store: PlacementStore) {
  await page.route('**/contexts/AuthContext*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `export const useAuth = () => ({ profile: { id: 'visual-student' } });`,
  }));
  await page.route('**/contexts/InstitutionContext*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `export const useInstitution = () => ({ currentInstitutionId: 'visual-institution' });`,
  }));
  await page.route('**/rest/v1/rpc/**', async route => {
    const functionName = new URL(route.request().url()).pathname.split('/').pop();
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    if (functionName === 'get_tec_language_course_map_v1') {
      const code = String(payload.p_course_code);
      const course = locales.find(candidate => candidate.code === code);
      if (!course) {
        await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(courseMap(course.code, course.name)) });
      return;
    }
    if (functionName === 'get_tec_language_placement_v1') {
      const key = `${payload.p_institution_id}:${payload.p_course_code}`;
      const placement = store.get(key);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(placement ?? { attemptId: null, record: null }) });
      return;
    }
    if (functionName === 'save_tec_language_placement_v1') {
      const key = `${payload.p_institution_id}:${payload.p_course_code}`;
      const placement = { attemptId: String(payload.p_attempt_id), record: payload.p_record as Record<string, unknown> };
      store.set(key, placement);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(placement) });
      return;
    }
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: `Unexpected visual fixture RPC: ${functionName}` }) });
  });
}

async function selectLanguage(page: Page, name: string) {
  const trigger = page.getByRole('button', { name: /^Escolher idioma:/ });
  const currentName = await trigger.getAttribute('aria-label');
  if (currentName?.endsWith(name)) return;
  await trigger.click();
  await page.getByRole('option', { name: new RegExp(`^${name},`) }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

async function finishAssessment(page: Page, locale: string, pattern: 'correct' | 'incorrect' | 'alternating') {
  const beginAssessment = page.getByRole('button', { name: /Descobrir meu nível/ });
  if (await beginAssessment.count()) await beginAssessment.click();
  for (let position = 0; position < 5; position += 1) {
    const prompt = await page.locator('fieldset legend').innerText();
    const expected = Object.entries(correctAnswers).find(([fragment]) => prompt.includes(fragment))?.[1];
    expect(expected, `Missing answer key for visible ${locale} prompt: ${prompt}`).toBeDefined();
    const correct = pattern === 'correct' || (pattern === 'alternating' && position % 2 === 0);
    const selectedIndex = correct ? expected! : (expected! + 1) % 3;
    await page.getByRole('radio').nth(selectedIndex).check();
    await page.getByRole('button', { name: 'Conferir resposta' }).click();
    await page.getByRole('button', { name: position < 4 ? 'Próxima pergunta' : 'Ver recomendação' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Seu ponto de partida recomendado' })).toBeVisible();
}

test('primeiro acesso dos três idiomas em cinco tamanhos, teclado e diagnóstico no navegador real', async ({ page, browser }, testInfo) => {
  test.setTimeout(360_000);
  const remote: PlacementStore = new Map();
  await installFixtureApi(page, remote);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/e2e/tec-idiomas-placement-visual.html');
  await expect(page.getByRole('heading', { name: 'Como você quer começar?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Começar do zero/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Descobrir meu nível/ })).toBeVisible();

  for (const viewport of [
    { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
    { width: 1366, height: 768 }, { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    for (const language of locales) {
      await selectLanguage(page, language.name);
      await expect(page.getByRole('heading', { name: 'Como você quer começar?' })).toBeVisible();
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(dimensions.scrollWidth, `Horizontal overflow at ${viewport.width}px for ${language.name}`).toBeLessThanOrEqual(dimensions.width + 1);
      if (viewport.width === 390 || (viewport.width === 1366 && language.name === 'Inglês')) {
        await page.screenshot({ path: testInfo.outputPath(`first-use-${language.locale}-${viewport.width}x${viewport.height}.png`), fullPage: true });
      }
    }
    await selectLanguage(page, 'Inglês');
  }

  const languageTrigger = page.getByRole('button', { name: 'Escolher idioma: Inglês' });
  await languageTrigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox', { name: 'Meus idiomas' })).toBeVisible();
  await page.getByRole('option', { name: /^Inglês,/ }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: /^Espanhol,/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(languageTrigger).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await selectLanguage(page, 'Inglês');
  await page.getByRole('button', { name: /Descobrir meu nível/ }).click();
  await expect(page.locator('fieldset legend')).toContainText('Good morning');
  await page.getByRole('radio').nth(0).check();
  await page.getByRole('button', { name: 'Conferir resposta' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Como você quer começar?' })).toBeVisible();
  await expect(page.getByText('0 de 16 lições · 0 XP')).toBeVisible();
  expect(remote.size).toBe(0);

  for (const language of locales) {
    await selectLanguage(page, language.name);
    await finishAssessment(page, language.locale, 'correct');
    await expect(page.getByText('Você acertou 5 de 5 perguntas.')).toBeVisible();
    await expect(page.getByText(/Recomendação: comece revisando a Unidade 3/)).toBeVisible();
    await expect(page.getByText(/A recomendação não pula etapas nem altera XP ou progresso/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Começar pela primeira lição' })).toBeVisible();
    await expect(page.getByText('0 de 16 lições · 0 XP')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Próxima lição' })).toHaveCount(0);
    expect(remote.has(`visual-institution:${language.code}`)).toBe(true);
  }

  await selectLanguage(page, 'Inglês');
  await page.getByRole('region', { name: 'Seu resultado inicial' }).getByRole('button', { name: 'Refazer diagnóstico' }).click();
  await finishAssessment(page, 'en-US', 'incorrect');
  await expect(page.getByText('Você acertou 0 de 5 perguntas.')).toBeVisible();
  await expect(page.getByText(/Recomendação: comece revisando a Unidade 1/)).toBeVisible();
  await page.getByRole('button', { name: 'Ver minha trilha' }).click();
  await page.getByRole('region', { name: 'Seu resultado inicial' }).getByRole('button', { name: 'Refazer diagnóstico' }).click();
  await finishAssessment(page, 'en-US', 'alternating');
  await expect(page.getByText('Você acertou 3 de 5 perguntas.')).toBeVisible();
  await expect(page.getByText(/Recomendação: comece revisando a Unidade 2/)).toBeVisible();
  await expect(page.getByText('0 de 16 lições · 0 XP')).toBeVisible();

  const secondDevice = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const secondPage = await secondDevice.newPage();
  await installFixtureApi(secondPage, remote);
  await secondPage.goto('/e2e/tec-idiomas-placement-visual.html');
  await expect(secondPage.getByRole('region', { name: 'Seu resultado inicial' })).toBeVisible();
  await expect(secondPage.getByText('Diagnóstico: 3 de 5 respostas corretas.')).toBeVisible();
  await expect(secondPage.getByText(/sincronizado com sua conta e disponível nos seus dispositivos/i)).toBeVisible();
  await secondDevice.close();
  expect(pageErrors).toEqual([]);
});
