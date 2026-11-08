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

      const canonical = await service.from('learning_curriculum_skills')
        .select('id,code,subject_area')
        .in('code', ['PHYSICS_AVERAGE_SPEED', 'MATH_PERCENT_OF_QUANTITY', 'MATH_RATIO_UNIT_RATE', 'PORTUGUESE_ARGUMENT_EVIDENCE', 'HISTORY_INTERPRET_EVIDENCE'])
        .eq('active', true);
      if (canonical.error) throw new Error(`canonical skills: ${canonical.error.message}`);
      const targetRows = await service.from('learning_curriculum_grade_targets')
        .select('canonical_skill_id,subject_area,stage,grade_level')
        .in('canonical_skill_id', canonical.data.map((row: any) => row.id))
        .eq('active', true)
        .order('priority');
      if (targetRows.error) throw new Error(`BNCC target rows: ${targetRows.error.message}`);

      let selected: { id: string; area: string; stage: string; grade: number } | undefined;
      for (const target of targetRows.data) {
        const skill = canonical.data.find((row: any) => row.id === target.canonical_skill_id);
        if (!skill || skill.subject_area !== target.subject_area || !['ENSINO_FUNDAMENTAL', 'ENSINO_MEDIO'].includes(target.stage)) continue;
        const [lesson, probe] = await Promise.all([
          service.from('learning_skill_lessons').select('id').eq('canonical_skill_id', skill.id).eq('version', 4).eq('active', true).limit(1),
          service.from('learning_question_sets').select('id,metadata').eq('canonical_skill_id', skill.id).eq('scope', 'GLOBAL').eq('purpose', 'PROBE').eq('version', 4).eq('active', true).is('institution_id', null).is('teacher_profile_id', null).limit(1),
        ]);
        if (lesson.error || probe.error) throw new Error(`V4 content query: ${lesson.error?.message ?? probe.error?.message}`);
        if (!lesson.data.length || !probe.data.length) continue;
        const probeMetadata = probe.data[0].metadata ?? {};
        if (probeMetadata.demo_preview || probeMetadata.demo_preview_only || probeMetadata.demonstration_only) continue;
        const items = await service.from('learning_question_set_items').select('question_bank_id').eq('question_set_id', probe.data[0].id);
        if (items.error) throw new Error(`probe items: ${items.error.message}`);
        if (!items.data.length) continue;
        const questions = await service.from('learning_question_bank')
          .select('id,active,metadata')
          .in('id', items.data.map((item: any) => item.question_bank_id))
          .eq('active', true);
        if (questions.error) throw new Error(`active probe questions: ${questions.error.message}`);
        if (questions.data.length !== items.data.length || questions.data.some((question: any) => {
          const metadata = question.metadata ?? {};
          return metadata.demo_preview || metadata.demo_preview_only || metadata.demonstration_only;
        })) continue;
        selected = { id: skill.id, area: target.subject_area, stage: target.stage, grade: target.grade_level };
        break;
      }
      if (!selected) throw new Error('No published BNCC skill has a real V4 lesson and PROBE set in the seeded curriculum.');

      const year = await insertOne(service, 'academic_years', {
        institution_id: institutionId, name: `2026 ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
      });
      const term = await insertOne(service, 'terms', {
        academic_year_id: year.id, name: `Term ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true,
      });
      const gradeLabel = selected.stage === 'ENSINO_MEDIO'
        ? `${selected.grade}ª série do Ensino Médio`
        : `${selected.grade}º ano do Ensino Fundamental`;
      const schoolClass = await insertOne(service, 'classes', {
        institution_id: institutionId, academic_year_id: year.id, name: `${gradeLabel} V11 ${suffix}`,
        grade_level: gradeLabel, shift: 'INTEGRAL', active: true,
      });
      const subject = await insertOne(service, 'subjects', {
        institution_id: institutionId, name: `V11 ${selected.area} ${suffix}`, code: `V11-E2E-${suffix}`, active: true,
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

      const targets = await student.client.rpc('list_student_guided_learning_targets', {
        p_institution_id: institutionId, p_student_id: studentRow.id,
      });
      expect(targets.error).toBeNull();
      expect(targets.data?.some((target: any) => target.target_canonical_skill_id === selected?.id && target.availability_status === 'NO_ACTIVE_SESSION')).toBe(true);
      const overview = await student.client.rpc('get_guided_study_overview_v11', { p_institution_id: institutionId });
      expect(overview.error).toBeNull();
      expect(overview.data?.state).toBe('READY');

      await login(page, student);
      await page.goto('/student/study');
      const startButton = page.getByRole('button', { name: 'Iniciar meu estudo' });
      await expect(startButton).toBeEnabled({ timeout: 30_000 });
      await startButton.click();
      await expect(page).toHaveURL(/\/student\/study\/guided\?session=/, { timeout: 30_000 });
      guidedSessionId = new URL(page.url()).searchParams.get('session') ?? undefined;
      expect(guidedSessionId).toBeTruthy();
      await expect(page.getByRole('heading', { name: 'Vamos descobrir seu ponto de partida' })).toBeVisible();
      await expect(page.locator('input[type="radio"]').first()).toBeVisible();
      await page.getByRole('button', { name: 'Pausar' }).click();
      await expect(page).toHaveURL(/\/student\/study$/, { timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Continuar meu estudo' })).toBeEnabled({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Continuar meu estudo' }).click();
      await expect.poll(() => {
        const currentUrl = new URL(page.url());
        return currentUrl.pathname === '/student/study/guided' && currentUrl.searchParams.get('session') === guidedSessionId;
      }, { timeout: 30_000 }).toBe(true);
      await expect(page.locator('input[type="radio"]').first()).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Vamos descobrir seu ponto de partida' })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('input[type="radio"]').first()).toBeVisible();

      const persisted = await service.from('learning_guided_sessions')
        .select('status,current_step_id,metadata')
        .eq('id', guidedSessionId!)
        .single();
      expect(persisted.error).toBeNull();
      expect(persisted.data?.status).toBe('ACTIVE');
      expect(persisted.data?.metadata?.initial_diagnostic).toBe(true);
    } finally {
      if (institutionId) await service.from('institutions').delete().eq('id', institutionId);
      if (accountId) await service.from('accounts').delete().eq('id', accountId);
      for (const userId of userIds) {
        await service.from('profiles').delete().eq('id', userId);
        await service.auth.admin.deleteUser(userId);
      }
    }
  });
});
