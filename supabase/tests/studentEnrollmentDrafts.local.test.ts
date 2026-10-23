import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type AnyClient = SupabaseClient<any, any, any>;
type ActorRole = 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'STUDENT' | 'GUARDIAN';
type Actor = { id: string; email: string; password: string; client: AnyClient };

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const runtimeDescribe = localUrl && anonKey && serviceRoleKey ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(
  client: AnyClient,
  table: string,
  row: Record<string, unknown>,
): Promise<Record<string, any>> {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert result`);
}

runtimeDescribe('student enrollment drafts isolated Supabase integration', () => {
  const suffix = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let service: AnyClient;
  let institutionA: string;
  let institutionB: string;
  let studentId: string;
  let studentProfileId: string;
  let guardianProfileId: string;
  let academicYearId: string;
  let classId: string;
  let finalizedDraftId: string | null = null;
  const actors: Actor[] = [];

  async function createActor(
    institutionId: string,
    role: ActorRole,
    label: string,
  ): Promise<Actor> {
    const email = `${suffix}-${label}@local.test`;
    const password = `DraftTest-${suffix}-2026!`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`auth actor setup failed: ${error.message}`);
    const user = required(data.user, `auth actor ${label}`);

    await insertOne(service, 'profiles', {
      id: user.id,
      full_name: `Draft test ${label}`,
      email,
      role,
      active: true,
    });
    await insertOne(service, 'memberships', {
      profile_id: user.id,
      institution_id: institutionId,
      role,
      active: true,
    });

    const client = createClient(localUrl!, anonKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `${suffix}-${label}`,
      },
    });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error || signedIn.data.user?.id !== user.id) {
      throw new Error(`auth sign-in setup failed for ${label}`);
    }

    const actor = { id: user.id, email, password, client };
    actors.push(actor);
    return actor;
  }

  beforeAll(async () => {
    service = createClient(localUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    institutionA = (await insertOne(service, 'institutions', {
      name: `Draft isolation A ${suffix}`,
      active: true,
    })).id;
    institutionB = (await insertOne(service, 'institutions', {
      name: `Draft isolation B ${suffix}`,
      active: true,
    })).id;

    await createActor(institutionA, 'DIRECTOR', 'director-a');
    await createActor(institutionA, 'SECRETARY', 'secretary-a');
    await createActor(institutionA, 'TEACHER', 'teacher-a');
    const studentActor = await createActor(institutionA, 'STUDENT', 'student-a');
    const guardianActor = await createActor(institutionA, 'GUARDIAN', 'guardian-a');
    await createActor(institutionB, 'DIRECTOR', 'director-b');

    studentProfileId = studentActor.id;
    guardianProfileId = guardianActor.id;
    academicYearId = (await insertOne(service, 'academic_years', {
      institution_id: institutionA,
      name: `2026 ${suffix}`,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      active: true,
    })).id;
    classId = (await insertOne(service, 'classes', {
      institution_id: institutionA,
      academic_year_id: academicYearId,
      name: `1º A ${suffix}`,
      grade_level: '1º ano',
      shift: 'MATUTINO',
      active: true,
    })).id;
    studentId = (await insertOne(service, 'students', {
      profile_id: studentProfileId,
      institution_id: institutionA,
      registration_number: suffix,
      birth_date: '2018-01-01',
      active: true,
    })).id;
  });

  afterAll(async () => {
    if (!service) return;
    if (finalizedDraftId && institutionA) {
      await service.from('student_enrollment_drafts').delete()
        .eq('institution_id', institutionA).eq('id', finalizedDraftId);
    }
    if (studentId) {
      await service.from('academic_document_issuances').delete().eq('student_id', studentId);
      await service.from('student_documents').delete().eq('student_id', studentId);
      await service.from('student_registration_details').delete().eq('student_id', studentId);
      await service.from('student_addresses').delete().eq('student_id', studentId);
      await service.from('student_previous_schooling').delete().eq('student_id', studentId);
      await service.from('student_health_information').delete().eq('student_id', studentId);
      await service.from('guardianships').delete().eq('student_id', studentId);
      await service.from('enrollments').delete().eq('student_id', studentId);
      await service.from('students').delete().eq('id', studentId);
    }
    if (classId) await service.from('classes').delete().eq('id', classId);
    if (academicYearId) await service.from('academic_years').delete().eq('id', academicYearId);
    for (const actor of actors) {
      await service.from('memberships').delete().eq('profile_id', actor.id);
      await service.from('profiles').delete().eq('id', actor.id);
      await service.auth.admin.deleteUser(actor.id);
    }
    if (institutionA) await service.from('institutions').delete().eq('id', institutionA);
    if (institutionB) await service.from('institutions').delete().eq('id', institutionB);
  });

  it('resumes for authorized school roles and isolates every other role and institution', async () => {
    const director = actors.find((actor) => actor.email.endsWith('director-a@local.test'))!;
    const secretary = actors.find((actor) => actor.email.endsWith('secretary-a@local.test'))!;
    const teacher = actors.find((actor) => actor.email.endsWith('teacher-a@local.test'))!;
    const student = actors.find((actor) => actor.email.endsWith('student-a@local.test'))!;
    const guardian = actors.find((actor) => actor.email.endsWith('guardian-a@local.test'))!;
    const foreignDirector = actors.find((actor) => actor.email.endsWith('director-b@local.test'))!;
    const sensitiveMarker = `health-marker-${suffix}`;
    const payload = {
      identity: {
        full_name: `Student ${suffix}`,
        email: '',
        birth_date: '2018-01-01',
        cpf: '',
        social_name: '',
        rg: '',
        rg_issuing_authority: '',
        rg_state: '',
        birth_certificate: '',
        nationality: 'Brasileira',
        birthplace: '',
        birth_state: '',
        sex: '',
        phone: '',
      },
      address: {
        postal_code: '', street: '', number: '', complement: '',
        neighborhood: '', city: '', state: '', rural_zone: false,
      },
      guardians: [],
      previous_schooling: {
        origin_school: '', origin_network: '', city: '', state: '', last_grade: '',
        origin_year: '', status: '', observations: '', history_delivered: false,
        transfer_declaration: false,
      },
      health: {
        allergies: sensitiveMarker,
        health_conditions: '', emergency_medication: '', disability: '',
        autism: false, giftedness: false, needs_special_education: false,
        school_care_notes: '',
      },
      documents: [],
      academic_year_id: '',
      class_id: '',
      enrolled_at: '2026-01-01',
    };

    const issuance = await director.client.rpc('record_academic_document_issuance', {
      p_institution_id: institutionA,
      p_student_id: studentId,
      p_document_type: 'TRANSCRIPT_PREVIEW',
      p_enrollment_id: null,
      p_academic_year_id: academicYearId,
    });
    expect(issuance.error).toBeNull();
    expect(typeof issuance.data).toBe('string');
    const auditRow = await director.client
      .from('academic_document_issuances')
      .select('student_id, document_type, actor_profile_id')
      .eq('id', issuance.data)
      .single();
    expect(auditRow.error).toBeNull();
    expect(auditRow.data).toMatchObject({
      student_id: studentId,
      document_type: 'TRANSCRIPT_PREVIEW',
      actor_profile_id: director.id,
    });
    const deniedIssuance = await teacher.client.rpc('record_academic_document_issuance', {
      p_institution_id: institutionA,
      p_student_id: studentId,
      p_document_type: 'TRANSCRIPT_PREVIEW',
      p_enrollment_id: null,
      p_academic_year_id: academicYearId,
    });
    expect(deniedIssuance.error).toBeTruthy();

    const invalidPayload = structuredClone(payload) as typeof payload & { health: Record<string, unknown> };
    invalidPayload.health.unexpected_extra = 'rejected';
    const invalidDraft = await director.client.rpc('save_student_enrollment_draft', {
      p_institution_id: institutionA,
      p_draft_id: null,
      p_expected_version: null,
      p_payload: invalidPayload,
      p_current_step: 3,
    });
    expect(invalidDraft.error).toBeTruthy();

    const created = await director.client.rpc('save_student_enrollment_draft', {
      p_institution_id: institutionA,
      p_draft_id: null,
      p_expected_version: null,
      p_payload: payload,
      p_current_step: 3,
    });
    expect(created.error).toBeNull();
    const draftId = required(created.data?.draft_id, 'created draft id') as string;
    const firstVersion = Number(created.data?.version);
    expect(firstVersion).toBe(1);

    const resumed = await secretary.client.rpc('get_student_enrollment_draft', {
      p_institution_id: institutionA,
      p_draft_id: draftId,
    });
    expect(resumed.error).toBeNull();
    expect(resumed.data).toMatchObject({
      draft_id: draftId,
      current_step: 3,
      payload: { health: { allergies: sensitiveMarker } },
    });
    expect(Number(resumed.data?.version)).toBe(firstVersion);

    const listed = await secretary.client.rpc('list_student_enrollment_drafts', {
      p_institution_id: institutionA,
    });
    expect(listed.error).toBeNull();
    expect(listed.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ draft_id: draftId, current_step: 3 }),
    ]));
    expect(JSON.stringify(listed.data)).not.toContain(sensitiveMarker);

    for (const deniedActor of [teacher, student, guardian, foreignDirector]) {
      const denied = await deniedActor.client.rpc('get_student_enrollment_draft', {
        p_institution_id: institutionA,
        p_draft_id: draftId,
      });
      expect(denied.error).toBeTruthy();
      expect(denied.error?.message).not.toContain(sensitiveMarker);
    }

    const directRead = await student.client.from('student_enrollment_drafts').select('id');
    expect(directRead.error).toBeTruthy();

    const directorEdit = structuredClone(payload);
    directorEdit.identity.full_name = `Edit by director ${suffix}`;
    const savedByDirector = await director.client.rpc('save_student_enrollment_draft', {
      p_institution_id: institutionA,
      p_draft_id: draftId,
      p_expected_version: firstVersion,
      p_payload: directorEdit,
      p_current_step: 4,
    });
    expect(savedByDirector.error).toBeNull();
    expect(Number(savedByDirector.data?.version)).toBe(firstVersion + 1);

    const staleSecretaryEdit = structuredClone(payload);
    staleSecretaryEdit.identity.full_name = `Edit by secretary ${suffix}`;
    const versionConflict = await secretary.client.rpc('save_student_enrollment_draft', {
      p_institution_id: institutionA,
      p_draft_id: draftId,
      p_expected_version: firstVersion,
      p_payload: staleSecretaryEdit,
      p_current_step: 4,
    });
    expect(versionConflict.error?.code).toBe('40001');
    expect(versionConflict.error?.message).toBe('ENROLLMENT_DRAFT_VERSION_CONFLICT');

    const current = await director.client.rpc('get_student_enrollment_draft', {
      p_institution_id: institutionA,
      p_draft_id: draftId,
    });
    expect(current.error).toBeNull();
    expect(Number(current.data?.version)).toBe(firstVersion + 1);
    const discarded = await secretary.client.rpc('discard_student_enrollment_draft', {
      p_institution_id: institutionA,
      p_draft_id: draftId,
      p_expected_version: Number(current.data?.version),
    });
    expect(discarded.error).toBeNull();

    const noDrafts = await director.client.rpc('list_student_enrollment_drafts', {
      p_institution_id: institutionA,
    });
    expect(noDrafts.error).toBeNull();
    expect(noDrafts.data).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ draft_id: draftId }),
    ]));

    const studentCount = await service
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionA);
    expect(studentCount.error).toBeNull();
    expect(studentCount.count).toBe(1);
  }, 60000);

  it('creates enrollment only on final confirmation and returns the same result on retries', async () => {
    const director = actors.find((actor) => actor.email.endsWith('director-a@local.test'))!;
    const guardian = actors.find((actor) => actor.id === guardianProfileId)!;
    const payload = {
      identity: {
        full_name: `Student ${suffix}`,
        email: '',
        birth_date: '2018-01-01',
        cpf: '',
        social_name: '',
        rg: '',
        rg_issuing_authority: '',
        rg_state: '',
        birth_certificate: '',
        nationality: 'Brasileira',
        birthplace: '',
        birth_state: '',
        sex: '',
        phone: '',
      },
      address: {
        postal_code: '', street: '', number: '', complement: '',
        neighborhood: '', city: '', state: '', rural_zone: false,
      },
      guardians: [{
        mode: 'existing', profile_id: guardian.id, full_name: 'Responsável de teste',
        email: guardian.email, phone: '', relationship: 'Mãe', is_primary: true,
      }],
      previous_schooling: {
        origin_school: '', origin_network: '', city: '', state: '', last_grade: '',
        origin_year: '', status: '', observations: '', history_delivered: false,
        transfer_declaration: false,
      },
      health: {
        allergies: '', health_conditions: '', emergency_medication: '', disability: '',
        autism: false, giftedness: false, needs_special_education: false,
        school_care_notes: '',
      },
      documents: [],
      academic_year_id: academicYearId,
      class_id: classId,
      enrolled_at: '2026-02-01',
    };

    const created = await director.client.rpc('save_student_enrollment_draft', {
      p_institution_id: institutionA,
      p_draft_id: null,
      p_expected_version: null,
      p_payload: payload,
      p_current_step: 7,
    });
    expect(created.error).toBeNull();
    finalizedDraftId = required(created.data?.draft_id, 'finalization draft id') as string;
    const version = Number(created.data?.version);

    const beforeFinalization = await service
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId);
    expect(beforeFinalization.error).toBeNull();
    expect(beforeFinalization.count).toBe(0);

    const claim = await director.client.rpc('claim_student_enrollment_draft_finalization', {
      p_institution_id: institutionA,
      p_draft_id: finalizedDraftId,
      p_expected_version: version,
    });
    expect(claim.error).toBeNull();
    expect(claim.data?.state).toBe('CLAIMED');

    const progress = await director.client.rpc('record_student_enrollment_draft_progress', {
      p_institution_id: institutionA,
      p_draft_id: finalizedDraftId,
      p_student_id: studentId,
      p_guardian_profile_ids: { '0': guardianProfileId },
    });
    expect(progress.error).toBeNull();

    const finalizeRequest = () => director.client.rpc('finalize_student_enrollment_draft', {
      p_institution_id: institutionA,
      p_draft_id: finalizedDraftId,
    });
    const [first, retry] = await Promise.all([finalizeRequest(), finalizeRequest()]);
    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    expect(first.data?.student_id).toBe(studentId);
    expect(typeof first.data?.enrollment_id).toBe('string');
    expect(retry.data).toEqual(first.data);

    const enrollmentCount = await service
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId);
    expect(enrollmentCount.error).toBeNull();
    expect(enrollmentCount.count).toBe(1);
  });
});
