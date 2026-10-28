import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; client: Db };

const url = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const isLoopback = (() => {
  if (!url) return false;
  try { return ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname); }
  catch { return false; }
})();
if (url && !isLoopback) throw new Error('Tec Idiomas Beta tests are restricted to loopback Supabase.');
const localDescribe = url && anonKey && serviceRoleKey && isLoopback ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(client: Db, table: string, row: Record<string, unknown>) {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(service: Db, role: 'ADMIN' | 'STUDENT', suffix: string, platformRole?: 'SUPER_ADMIN'): Promise<Actor> {
  const email = `tec-idiomas-beta-${suffix}@local.test`;
  const password = 'TecIdiomasBeta!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${role}: ${error.message}`);
  const user = required(data.user, `${role} user`);
  await insertOne(service, 'profiles', {
    id: user.id, full_name: `Tec Idiomas Beta ${suffix}`, email, role, active: true,
    ...(platformRole ? { platform_role: platformRole } : {}),
  });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ${role}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, client };
}

localDescribe('Tec Idiomas V3 institution-scoped Beta release', () => {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const courseCode = 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION';
  let service: Db;
  let institutionA: string;
  let institutionB: string;
  let admin: Actor;
  let ordinaryAdmin: Actor;
  let studentA: Actor;
  let studentB: Actor;
  let studentIdA: string;
  let studentIdB: string;
  let contentVersion = 0;
  let fingerprint = '';
  const authUserIds: string[] = [];

  beforeAll(async () => {
    service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    institutionA = required((await insertOne(service, 'institutions', { name: `Beta QA ${suffix}`, active: true })).id, 'institution A id');
    institutionB = required((await insertOne(service, 'institutions', { name: `Beta foreign ${suffix}`, active: true })).id, 'institution B id');
    admin = await createActor(service, 'ADMIN', `${suffix}-super`, 'SUPER_ADMIN');
    ordinaryAdmin = await createActor(service, 'ADMIN', `${suffix}-admin`);
    studentA = await createActor(service, 'STUDENT', `${suffix}-student-a`);
    studentB = await createActor(service, 'STUDENT', `${suffix}-student-b`);
    authUserIds.push(admin.id, ordinaryAdmin.id, studentA.id, studentB.id);

    for (const [actor, institutionId, label] of [[studentA, institutionA, 'a'], [studentB, institutionB, 'b']] as const) {
      await insertOne(service, 'memberships', { profile_id: actor.id, institution_id: institutionId, role: 'STUDENT', active: true });
      const student = await insertOne(service, 'students', {
        profile_id: actor.id, institution_id: institutionId, registration_number: `BETA-${suffix}-${label}`, active: true,
      });
      if (label === 'a') studentIdA = student.id;
      else studentIdB = student.id;
    }

    const { data: course, error: courseError } = await service.from('tec_english_courses')
      .select('content_version,publication_status,review_status,is_test_fixture')
      .eq('course_code', courseCode).single();
    if (courseError) throw new Error(`course fixture: ${courseError.message}`);
    contentVersion = course.content_version;
    expect(course).toMatchObject({ publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING', is_test_fixture: false });

    const { data: queue, error: queueError } = await admin.client.rpc('get_tec_english_review_queue_v1');
    if (queueError) throw new Error(`review queue: ${queueError.message}`);
    const queuedCourse = (queue as Array<{ course_code: string; content_version: number; snapshot_fingerprint: string }>).find((item) => item.course_code === courseCode);
    fingerprint = required(queuedCourse?.snapshot_fingerprint, 'course fingerprint');
  });

  afterAll(async () => {
    if (!service) return;
    await service.from('tec_idiomas_v3_beta_release_events').delete().in('institution_id', [institutionA, institutionB].filter(Boolean));
    await service.from('tec_idiomas_v3_beta_releases').delete().in('institution_id', [institutionA, institutionB].filter(Boolean));
    if (studentIdA || studentIdB) await service.from('students').delete().in('id', [studentIdA, studentIdB].filter(Boolean));
    if (authUserIds.length) {
      await service.from('memberships').delete().in('profile_id', authUserIds);
      await service.from('profiles').delete().in('id', authUserIds);
      for (const id of authUserIds) await service.auth.admin.deleteUser(id);
    }
    await service.from('institutions').delete().in('id', [institutionA, institutionB].filter(Boolean));
  });

  it('requires an exact audited Beta release and keeps access within its institution', async () => {
    const before = await studentA.client.rpc('get_tec_language_course_map_v1', { p_institution_id: institutionA, p_course_code: courseCode });
    expect(before.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');

    const forbiddenTargets = await ordinaryAdmin.client.rpc('get_tec_idiomas_v3_beta_targets_v1', {
      p_course_code: courseCode, p_content_version: contentVersion, p_search: `Beta QA ${suffix}`,
    });
    expect(forbiddenTargets.error?.message).toContain('TEC_IDIOMAS_BETA_FORBIDDEN');
    const forbiddenEnable = await ordinaryAdmin.client.rpc('set_tec_idiomas_v3_beta_release_v1', {
      p_course_code: courseCode, p_content_version: contentVersion, p_institution_id: institutionA,
      p_enabled: true, p_expected_fingerprint: fingerprint, p_reason: 'This non-super-admin action must be denied.',
    });
    expect(forbiddenEnable.error?.message).toContain('TEC_IDIOMAS_BETA_FORBIDDEN');

    const targets = await admin.client.rpc('get_tec_idiomas_v3_beta_targets_v1', {
      p_course_code: courseCode, p_content_version: contentVersion, p_search: `Beta QA ${suffix}`,
    });
    expect(targets.error).toBeNull();
    expect(targets.data).toHaveLength(1);
    expect(targets.data[0]).toMatchObject({ institution_id: institutionA, enabled: false, effective: false });

    const enabled = await admin.client.rpc('set_tec_idiomas_v3_beta_release_v1', {
      p_course_code: courseCode,
      p_content_version: contentVersion,
      p_institution_id: institutionA,
      p_enabled: true,
      p_expected_fingerprint: fingerprint,
      p_reason: 'Isolated QA validation of institution-scoped Beta access.',
    });
    expect(enabled.error).toBeNull();
    expect(enabled.data).toMatchObject({ enabled: true, snapshot_fingerprint: fingerprint, institution_id: institutionA });

    const mapA = await studentA.client.rpc('get_tec_language_course_map_v1', { p_institution_id: institutionA, p_course_code: courseCode });
    expect(mapA.error).toBeNull();
    expect(mapA.data.course).toMatchObject({ publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' });
    const firstLesson = mapA.data.units[0].lessons[0];
    const started = await studentA.client.rpc('start_tec_language_lesson_v1', {
      p_institution_id: institutionA, p_course_code: courseCode, p_lesson_id: firstLesson.id,
    });
    expect(started.error).toBeNull();
    expect(started.data.exercise).not.toHaveProperty('answer_key');
    expect(started.data.exercise).not.toHaveProperty('accepted_answers');

    const mapB = await studentB.client.rpc('get_tec_language_course_map_v1', { p_institution_id: institutionB, p_course_code: courseCode });
    expect(mapB.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');
    const hiddenLedger = await studentA.client.from('tec_idiomas_v3_beta_releases').select('course_code');
    expect(hiddenLedger.error).not.toBeNull();

    const revoked = await admin.client.rpc('set_tec_idiomas_v3_beta_release_v1', {
      p_course_code: courseCode,
      p_content_version: contentVersion,
      p_institution_id: institutionA,
      p_enabled: false,
      p_expected_fingerprint: fingerprint,
      p_reason: 'Revoke the isolated QA release after gate validation.',
    });
    expect(revoked.error).toBeNull();
    expect(revoked.data).toMatchObject({ enabled: false, institution_id: institutionA });
    const after = await studentA.client.rpc('get_tec_language_course_map_v1', { p_institution_id: institutionA, p_course_code: courseCode });
    expect(after.error?.message).toContain('TEC_ENGLISH_COURSE_NOT_AVAILABLE');

    const { count, error: eventError } = await service.from('tec_idiomas_v3_beta_release_events')
      .select('id', { count: 'exact', head: true }).eq('course_code', courseCode).eq('institution_id', institutionA);
    expect(eventError).toBeNull();
    expect(count).toBe(2);
  });
});
