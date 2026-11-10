import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; password: string; client: Db };

const url = process.env.E2E_SUPABASE_URL ?? process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const e2eDescribe = url && anonKey && serviceRoleKey ? test.describe : test.describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(db: Db, table: string, row: Record<string, unknown>) {
  const { data, error } = await db.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(service: Db, role: 'ADMIN' | 'TEACHER' | 'STUDENT', label: string, suffix: string): Promise<Actor> {
  const email = `guided-v11-e2e-${label}-${suffix}@local.test`;
  const password = 'GuidedV11E2E!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${label}: ${error.message}`);
  const user = required(data.user, `${label} auth user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: `Guided V11 ${label}`, email, role, active: true });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ${label}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, password, client };
}

async function login(page: Page, actor: Actor) {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(actor.email);
  await page.locator('#login-password').fill(actor.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

e2eDescribe('Estudo Guiado V11 browser flow', () => {
  test('starts a real diagnostic, pauses, resumes the same server session and survives reload', async ({ page }) => {
    const service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = Date.now().toString(36);
    const userIds: string[] = [];
    let accountId: string | undefined;
    let institutionId: string | undefined;
    let guidedSessionId: string | undefined;
    let canonicalSkillId: string | undefined;
    let previousReviewStatus: string | undefined;

    try {
      const admin = await createActor(service, 'ADMIN', 'admin', suffix);
      const teacher = await createActor(service, 'TEACHER', 'teacher', suffix);
      const student = await createActor(service, 'STUDENT', 'student', suffix);
      userIds.push(admin.id, teacher.id, student.id);
      accountId = (await insertOne(service, 'accounts', {
        name: `Guided V11 E2E ${suffix}`, owner_profile_id: admin.id, institution_limit: 1, status: 'ACTIVE',
      })).id;
      institutionId = (await insertOne(service, 'institutions', {
        account_id: accountId, name: `Guided V11 E2E ${suffix}`, active: true,
      })).id;
      for (const [actor, role] of [[admin, 'ADMIN'], [teacher, 'TEACHER'], [student, 'STUDENT']] as const) {
        await insertOne(service, 'memberships', { profile_id: actor.id, institution_id: institutionId, role, active: true });
      }

      const catalogs = await service.from('learning_curriculum_catalogs')
        .select('id').eq('code', 'BNCC_2018').eq('active', true);
      if (catalogs.error || !catalogs.data?.length) {
        throw new Error(`V13 active BNCC catalog: ${catalogs.error?.message ?? 'not found'}`);
      }
      const canonicalSkillResult = await service.from('learning_curriculum_skills')
        .select('id,code,subject_area,stage,grade_level,pedagogical_review_status,publication_status,technical_validation_status,technical_validation_errors,catalog_id')
        .in('catalog_id', catalogs.data.map((row: any) => row.id)).eq('code', 'EM13CNT101')
        .order('catalog_id');
      if (canonicalSkillResult.error) {
        throw new Error(`V13 published EM13CNT101 skill query: ${canonicalSkillResult.error.message}`);
      }
      const publishedSkills = (canonicalSkillResult.data ?? []).filter((skill: any) =>
        skill.publication_status === 'PUBLISHED' && skill.technical_validation_status === 'PUBLISHED');
      if (publishedSkills.length !== 1) {
        const diagnostics = (canonicalSkillResult.data ?? []).map((skill: any) => ({
          id: skill.id,
          catalog_id: skill.catalog_id,
          publication_status: skill.publication_status,
          technical_validation_status: skill.technical_validation_status,
          technical_validation_errors: skill.technical_validation_errors,
        }));
        throw new Error(`Expected one technically published EM13CNT101 skill; found ${publishedSkills.length}. Candidates: ${JSON.stringify(diagnostics)}`);
      }
      const canonicalSkill = publishedSkills[0];
      canonicalSkillId = canonicalSkill.id;
      previousReviewStatus = canonicalSkill.pedagogical_review_status;
      const pendingReview = await service.from('learning_curriculum_skills')
        .update({ pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING' })
        .eq('id', canonicalSkillId).select('id').single();
      if (pendingReview.error) throw new Error(`set historical pending status: ${pendingReview.error.message}`);
      const selected = {
        id: canonicalSkillId,
        area: canonicalSkill.subject_area,
        stage: 'ENSINO_MEDIO',
        grade: 1,
      };

      const year = await insertOne(service, 'academic_years', {
        institution_id: institutionId, name: `2026 ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
      });
      const term = await insertOne(service, 'terms', {
        academic_year_id: year.id, name: `Term ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
      });
      const gradeLabel = `${selected.grade}ª série do Ensino Médio`;
      const schoolClass = await insertOne(service, 'classes', {
        institution_id: institutionId, academic_year_id: year.id, name: `${gradeLabel} V11 ${suffix}`,
        grade_level: gradeLabel, shift: 'INTEGRAL', active: true,
      });
      const existingSubjectResult = await service.from('subjects').select('*')
        .eq('institution_id', institutionId).eq('code', 'FIS').maybeSingle();
      if (existingSubjectResult.error) throw new Error(`Physics subject lookup: ${existingSubjectResult.error.message}`);
      const subject = existingSubjectResult.data ?? await insertOne(service, 'subjects', {
        institution_id: institutionId, name: `Física V16 ${suffix}`, code: 'FIS', active: true,
      });
      await insertOne(service, 'class_curriculum_items', {
        institution_id: institutionId, class_id: schoolClass.id, subject_id: subject.id,
        weekly_lessons: 1, lesson_duration_minutes: 45, active: true,
      });
      await insertOne(service, 'subject_offerings', {
        class_id: schoolClass.id, subject_id: subject.id, teacher_profile_id: teacher.id, term_id: term.id, active: true,
      });
      await insertOne(service, 'learning_curriculum_subject_links', {
        institution_id: institutionId, subject_id: subject.id, subject_area: selected.area, active: true,
      });
      const studentRow = await insertOne(service, 'students', {
        institution_id: institutionId, profile_id: student.id, registration_number: `V11-E2E-${suffix}`, active: true,
      });
      await insertOne(service, 'enrollments', {
        student_id: studentRow.id, class_id: schoolClass.id, academic_year_id: year.id, status: 'active', active: true,
      });
      const unit = await insertOne(service, 'learning_units', {
        institution_id: institutionId, subject_id: subject.id, title: `V11 unit ${suffix}`, active: true,
      });
      const learningSkill = await insertOne(service, 'learning_skills', {
        institution_id: institutionId, unit_id: unit.id, title: `V11 skill ${suffix}`, active: true,
      });
      await insertOne(service, 'learning_skill_canonical_links', {
        institution_id: institutionId, learning_skill_id: learningSkill.id, canonical_skill_id: selected.id, active: true,
      });

      const overview = await student.client.rpc('get_guided_study_subject_overview_v16', {
        p_institution_id: institutionId, p_subject_id: subject.id,
      });
      expect(overview.error).toBeNull();
      expect(overview.data?.state).toBe('READY');
      const topicTitle = String(overview.data?.topic_title ?? '');
      expect(topicTitle).not.toBe('');

      await login(page, student);
      await page.goto(`/student/study/subject/${subject.id}`);
      const startButton = page.getByRole('button', { name: 'Começar estudo guiado' });
      await expect(startButton).toBeEnabled({ timeout: 30_000 });
      await startButton.click();
      await expect(page).toHaveURL(/\/student\/study\/guided\?session=.*subject=/, { timeout: 30_000 });
      guidedSessionId = new URL(page.url()).searchParams.get('session') ?? undefined;
      expect(guidedSessionId).toBeTruthy();
      await expect(page.getByRole('heading', { name: topicTitle })).toBeVisible();
      await expect(page.getByText('Diagnóstico inicial', { exact: true })).toBeVisible();
      await expect(page.locator('input[type="radio"]').first()).toBeVisible();
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/student/study/subject/${subject.id}$`), { timeout: 30_000 });
      const resumeButton = page.getByRole('button', { name: 'Continuar estudo' });
      await expect(resumeButton).toBeEnabled({ timeout: 30_000 });
      await resumeButton.click();
      await expect.poll(() => {
        const currentUrl = new URL(page.url());
        return currentUrl.pathname === '/student/study/guided'
          && currentUrl.searchParams.get('session') === guidedSessionId
          && currentUrl.searchParams.get('subject') === subject.id;
      }, { timeout: 30_000 }).toBe(true);
      await expect(page.locator('input[type="radio"]').first()).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: topicTitle })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Diagnóstico inicial', { exact: true })).toBeVisible();
      await expect(page.locator('input[type="radio"]').first()).toBeVisible();

      const persisted = await service.from('learning_guided_sessions')
        .select('status,current_step_id,subject_id,target_canonical_skill_id,metadata')
        .eq('id', guidedSessionId!)
        .single();
      expect(persisted.error).toBeNull();
      expect(persisted.data?.status).toBe('ACTIVE');
      expect(persisted.data?.subject_id).toBe(subject.id);
      expect(persisted.data?.target_canonical_skill_id).toBe(selected.id);
      expect(persisted.data?.metadata?.subject_scope_version).toBe('V16');
    } finally {
      if (institutionId) await service.from('institutions').delete().eq('id', institutionId);
      if (accountId) await service.from('accounts').delete().eq('id', accountId);
      if (canonicalSkillId && previousReviewStatus) {
        await service.from('learning_curriculum_skills')
          .update({ pedagogical_review_status: previousReviewStatus })
          .eq('id', canonicalSkillId);
      }
      for (const userId of userIds) {
        await service.from('profiles').delete().eq('id', userId);
        await service.auth.admin.deleteUser(userId);
      }
    }
  });
});
