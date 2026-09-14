import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type AnyClient = SupabaseClient<any, any, any>;
type Role = 'ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'STUDENT' | 'GUARDIAN';
type Actor = { id: string; client: AnyClient; role: Role };

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const localDescribe = localUrl && anonKey && serviceRoleKey ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(client: AnyClient, table: string, row: Record<string, unknown>) {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function actor(service: AnyClient, role: Role, label: string, suffix: string): Promise<Actor> {
  const email = `recovery-${suffix}-${label}@local.test`;
  const created = await service.auth.admin.createUser({
    email,
    password: 'AcademicRecovery!2026',
    email_confirm: true,
  });
  if (created.error) throw new Error(created.error.message);
  const user = required(created.data.user, `${label} auth user`);
  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: `Recovery ${label}`,
    email,
    role,
    active: true,
  });
  const client = createClient(localUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const session = await client.auth.signInWithPassword({ email, password: 'AcademicRecovery!2026' });
  if (session.error || !session.data.session) throw new Error(session.error?.message ?? `No session for ${label}`);
  return { id: user.id, client, role };
}

async function expectRpcForbidden(client: AnyClient, args: Record<string, unknown>, name = 'save_academic_recovery') {
  const result = await client.rpc(name, args);
  expect(result.data).toBeNull();
  expect(result.error?.code).toBe('42501');
}

localDescribe('academic recovery runtime RLS', () => {
  let service: AnyClient;
  let actors: Record<string, Actor>;
  let institutionId: string;
  let yearId: string;
  let termId: string;
  let offeringId: string;
  let studentId: string;
  let recoveryId: string;
  let closureId: string;
  let recoveryArgs: Record<string, unknown>;

  beforeAll(async () => {
    service = createClient(localUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    actors = {};
    for (const [role, label] of [
      ['ADMIN', 'admin'],
      ['DIRECTOR', 'director'],
      ['SECRETARY', 'secretary'],
      ['TEACHER', 'teacher'],
      ['TEACHER', 'foreign-teacher'],
      ['STUDENT', 'student'],
      ['GUARDIAN', 'guardian'],
    ] as Array<[Role, string]>) {
      actors[label] = await actor(service, role, label, suffix);
    }

    const account = await insertOne(service, 'accounts', {
      name: `Recovery account ${suffix}`,
      owner_profile_id: actors.admin.id,
      institution_limit: 1,
      status: 'ACTIVE',
    });
    institutionId = (await insertOne(service, 'institutions', {
      account_id: account.id,
      name: `Recovery institution ${suffix}`,
      active: true,
    })).id;

    for (const [label, role] of Object.entries({
      admin: 'ADMIN',
      director: 'DIRECTOR',
      secretary: 'SECRETARY',
      teacher: 'TEACHER',
      student: 'STUDENT',
      guardian: 'GUARDIAN',
    })) {
      await insertOne(service, 'memberships', {
        profile_id: actors[label].id,
        institution_id: institutionId,
        role,
        active: true,
      });
    }

    const foreignAccount = await insertOne(service, 'accounts', {
      name: `Foreign recovery account ${suffix}`,
      owner_profile_id: actors['foreign-teacher'].id,
      institution_limit: 1,
      status: 'ACTIVE',
    });
    const foreignInstitution = await insertOne(service, 'institutions', {
      account_id: foreignAccount.id,
      name: `Foreign recovery institution ${suffix}`,
      active: true,
    });
    await insertOne(service, 'memberships', {
      profile_id: actors['foreign-teacher'].id,
      institution_id: foreignInstitution.id,
      role: 'TEACHER',
      active: true,
    });

    const director = actors.director.client;
    yearId = (await insertOne(director, 'academic_years', {
      institution_id: institutionId,
      name: `Ano ${suffix}`,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      active: true,
    })).id;
    termId = (await insertOne(director, 'terms', {
      academic_year_id: yearId,
      name: `Bimestre ${suffix}`,
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      active: true,
    })).id;
    const classId = (await insertOne(director, 'classes', {
      institution_id: institutionId,
      academic_year_id: yearId,
      name: `Turma ${suffix}`,
      grade_level: '1o EM',
      shift: 'MATUTINO',
      capacity: 30,
      active: true,
    })).id;
    const subjectId = (await insertOne(director, 'subjects', {
      institution_id: institutionId,
      name: `Matematica ${suffix}`,
      code: `MAT-${suffix}`,
      workload: 80,
      active: true,
    })).id;
    await insertOne(director, 'class_curriculum_items', {
      institution_id: institutionId,
      class_id: classId,
      subject_id: subjectId,
      weekly_lessons: 2,
      lesson_duration_minutes: 50,
      active: true,
    });
    await insertOne(director, 'teacher_subjects', {
      institution_id: institutionId,
      teacher_profile_id: actors.teacher.id,
      subject_id: subjectId,
      primary_subject: true,
      active: true,
    });
    offeringId = (await insertOne(director, 'subject_offerings', {
      subject_id: subjectId,
      class_id: classId,
      teacher_profile_id: actors.teacher.id,
      term_id: termId,
      active: true,
    })).id;
    studentId = (await insertOne(service, 'students', {
      profile_id: actors.student.id,
      institution_id: institutionId,
      registration_number: `REC-${suffix}`,
      birth_date: '2010-01-01',
      active: true,
    })).id;
    await insertOne(service, 'guardianships', {
      student_id: studentId,
      guardian_profile_id: actors.guardian.id,
      relationship: 'PARENT',
      is_primary: true,
      active: true,
    });
    await insertOne(director, 'enrollments', {
      student_id: studentId,
      class_id: classId,
      academic_year_id: yearId,
      enrolled_at: '2026-01-01',
      status: 'ACTIVE',
      active: true,
    });
    await insertOne(director, 'academic_policies', {
      institution_id: institutionId,
      academic_year_id: yearId,
      minimum_grade_percentage: 60,
      minimum_attendance_percentage: 75,
      decimal_places: 1,
      active: true,
    });
    await insertOne(service, 'student_term_results', {
      institution_id: institutionId,
      academic_year_id: yearId,
      term_id: termId,
      subject_offering_id: offeringId,
      student_id: studentId,
      grade_percentage: 50,
      attendance_percentage: 90,
      result_status: 'FAILED_BY_GRADE',
      finalized_at: '2026-06-30T12:00:00Z',
    });
    closureId = (await insertOne(service, 'term_closures', {
      institution_id: institutionId,
      academic_year_id: yearId,
      term_id: termId,
      subject_offering_id: offeringId,
      status: 'CLOSED',
      closed_at: '2026-06-30T12:00:00Z',
    })).id;
    const reopened = await actors.director.client.rpc('reopen_term_closure', {
      p_institution_id: institutionId,
      p_term_closure_id: closureId,
      p_reopen_reason: 'Preparar recuperação acadêmica.',
    });
    if (reopened.error) throw new Error(reopened.error.message);

    recoveryArgs = {
      p_institution_id: institutionId,
      p_academic_year_id: yearId,
      p_term_id: termId,
      p_subject_offering_id: offeringId,
      p_student_id: studentId,
      p_recovery_percentage: 75,
      p_status: 'PUBLISHED',
      p_notes: 'Recuperação v1',
    };
  }, 120_000);

  it('permite ao professor publicar a própria recuperação e bloqueia outras roles', async () => {
    const draft = await actors.teacher.client.rpc('save_academic_recovery', {
      ...recoveryArgs,
      p_status: 'DRAFT',
    });
    expect(draft.error).toBeNull();
    recoveryId = draft.data.id;

    for (const label of ['student', 'guardian']) {
      const hiddenDraft = await actors[label].client
        .from('student_term_recoveries')
        .select('id')
        .eq('id', recoveryId);
      expect(hiddenDraft.error, label).toBeNull();
      expect(hiddenDraft.data).toHaveLength(0);
    }

    const directInsert = await actors.teacher.client
      .from('student_term_recoveries')
      .insert({
        institution_id: institutionId,
        academic_year_id: yearId,
        term_id: termId,
        subject_offering_id: offeringId,
        student_id: studentId,
        status: 'DRAFT',
        recovery_percentage: 76,
        composition_rule: 'HIGHEST_SCORE_V1',
        recorded_by: actors.teacher.id,
      });
    expect(directInsert.error?.code).toBe('42501');

    const directUpdate = await actors.teacher.client
      .from('student_term_recoveries')
      .update({ recovery_percentage: 76 })
      .eq('id', recoveryId);
    expect(directUpdate.error?.code).toBe('42501');

    const directDelete = await actors.teacher.client
      .from('student_term_recoveries')
      .delete()
      .eq('id', recoveryId);
    expect(directDelete.error?.code).toBe('42501');

    const published = await actors.teacher.client.rpc('save_academic_recovery', recoveryArgs);
    expect(published.error).toBeNull();
    recoveryId = published.data.id;

    for (const label of ['director', 'secretary', 'admin', 'student', 'guardian', 'foreign-teacher']) {
      await expectRpcForbidden(actors[label].client, recoveryArgs);
    }
  }, 60_000);

  it('expõe somente recuperação publicada aos públicos acadêmicos autorizados', async () => {
    for (const label of ['director', 'secretary', 'teacher', 'student', 'guardian']) {
      const result = await actors[label].client
        .from('student_term_recoveries')
        .select('id, student_id, recovery_percentage, status')
        .eq('id', recoveryId);
      expect(result.error, label).toBeNull();
      expect(result.data).toHaveLength(1);
    }

    for (const label of ['admin', 'foreign-teacher']) {
      const result = await actors[label].client
        .from('student_term_recoveries')
        .select('id')
        .eq('id', recoveryId);
      expect(result.error, label).toBeNull();
      expect(result.data).toHaveLength(0);
    }
  }, 60_000);

  it('aplica recuperação no snapshot e bloqueia mutação após fechamento', async () => {
    const updated = await service
      .from('student_term_results')
      .update({ grade_percentage: 50, result_status: 'FAILED_BY_GRADE', finalized_at: '2026-06-30T12:01:00Z' })
      .eq('student_id', studentId)
      .eq('subject_offering_id', offeringId)
      .select('final_grade_percentage, recovery_percentage, result_status')
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data).toMatchObject({
      final_grade_percentage: 75,
      recovery_percentage: 75,
      result_status: 'APPROVED',
    });

    const closed = await service
      .from('term_closures')
      .update({ status: 'CLOSED', closed_at: '2026-06-30T13:00:00Z' })
      .eq('id', closureId);
    expect(closed.error).toBeNull();
    await expectRpcForbidden(actors.teacher.client, recoveryArgs);
  }, 60_000);
});
