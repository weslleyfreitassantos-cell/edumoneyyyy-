import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Db = SupabaseClient<any, any, any>;
const url = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const runtimeDescribe = url && anonKey && serviceRoleKey ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(db: Db, table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await db.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function actor(db: Db, institutionId: string, role: 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'STUDENT', name: string, suffix: string) {
  const actorKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const email = `manual.timetable.${role.toLowerCase()}.${actorKey}.${suffix}@example.com`;
  const password = 'ManualTimetable!2026';
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const user = required(created.data.user, `${role} auth user`);
  await insertOne(db, 'profiles', { id: user.id, full_name: name, email, role, active: true });
  await insertOne(db, 'memberships', { profile_id: user.id, institution_id: institutionId, role, active: true });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`${role} sign in failed: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, client };
}

runtimeDescribe('manual timetable editor runtime database contract', () => {
  const suffix = [
    process.env.GITHUB_RUN_ID ?? 'local',
    process.env.GITHUB_RUN_ATTEMPT ?? '0',
    Date.now().toString(36),
  ].join('-');
  let service: Db;
  let institutionA: string;
  let institutionB: string;
  let yearA: string;
  let termA: string;
  let classA: string;
  let classB: string;
  let subjectMath: string;
  let subjectPortuguese: string;
  let mathOfferingA: string;
  let portugueseOfferingA: string;
  let mathOfferingB: string;
  let roomA: string;
  let director: { id: string; client: Db };
  let secretary: { id: string; client: Db };
  let teacher: { id: string; client: Db };
  let student: { id: string; client: Db };
  let foreignDirector: { id: string; client: Db };
  let draftId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    institutionA = (await insertOne(service, 'institutions', { name: `Manual Editor A ${suffix}`, active: true })).id;
    institutionB = (await insertOne(service, 'institutions', { name: `Manual Editor B ${suffix}`, active: true })).id;
    const year = await insertOne(service, 'academic_years', { institution_id: institutionA, name: `2026 Manual ${suffix}`, start_date: '2026-01-01', end_date: '2026-12-31', active: true });
    yearA = year.id;
    termA = (await insertOne(service, 'terms', { academic_year_id: yearA, name: `1º Bimestre ${suffix}`, start_date: '2026-01-01', end_date: '2026-06-30', active: true })).id;
    classA = (await insertOne(service, 'classes', { institution_id: institutionA, academic_year_id: yearA, name: `1º ano A ${suffix}`, grade_level: '1º ano', shift: 'MATUTINO', active: true })).id;
    classB = (await insertOne(service, 'classes', { institution_id: institutionA, academic_year_id: yearA, name: `1º ano B ${suffix}`, grade_level: '1º ano', shift: 'MATUTINO', active: true })).id;

    director = await actor(service, institutionA, 'DIRECTOR', `Director ${suffix}`, suffix);
    secretary = await actor(service, institutionA, 'SECRETARY', `Secretary ${suffix}`, suffix);
    teacher = await actor(service, institutionA, 'TEACHER', `Teacher ${suffix}`, suffix);
    student = await actor(service, institutionA, 'STUDENT', `Student ${suffix}`, suffix);
    foreignDirector = await actor(service, institutionB, 'DIRECTOR', `Foreign ${suffix}`, suffix);
    userIds.push(director.id, secretary.id, teacher.id, student.id, foreignDirector.id);

    subjectMath = (await insertOne(service, 'subjects', { institution_id: institutionA, name: `Matemática ${suffix}`, code: `MAT-${suffix}`, active: true })).id;
    subjectPortuguese = (await insertOne(service, 'subjects', { institution_id: institutionA, name: `Português ${suffix}`, code: `POR-${suffix}`, active: true })).id;
    await insertOne(service, 'class_curriculum_items', { institution_id: institutionA, class_id: classA, subject_id: subjectMath, weekly_lessons: 2, lesson_duration_minutes: 50, active: true });
    await insertOne(service, 'class_curriculum_items', { institution_id: institutionA, class_id: classA, subject_id: subjectPortuguese, weekly_lessons: 1, lesson_duration_minutes: 50, active: true });
    await insertOne(service, 'class_curriculum_items', { institution_id: institutionA, class_id: classB, subject_id: subjectMath, weekly_lessons: 1, lesson_duration_minutes: 50, active: true });
    mathOfferingA = (await insertOne(service, 'subject_offerings', { class_id: classA, subject_id: subjectMath, teacher_profile_id: teacher.id, term_id: termA, active: true })).id;
    portugueseOfferingA = (await insertOne(service, 'subject_offerings', { class_id: classA, subject_id: subjectPortuguese, teacher_profile_id: teacher.id, term_id: termA, active: true })).id;
    mathOfferingB = (await insertOne(service, 'subject_offerings', { class_id: classB, subject_id: subjectMath, teacher_profile_id: teacher.id, term_id: termA, active: true })).id;
    roomA = (await insertOne(director.client, 'rooms', { institution_id: institutionA, name: `Sala Manual ${suffix}`, capacity: 30, active: true })).id;
    for (const day of [1, 2, 3]) {
      await insertOne(director.client, 'school_time_slots', { institution_id: institutionA, shift: 'MATUTINO', day_of_week: day, slot_number: 1, start_time: '07:00', end_time: '07:50', active: true });
      await insertOne(director.client, 'school_time_slots', { institution_id: institutionA, shift: 'MATUTINO', day_of_week: day, slot_number: 2, start_time: '07:50', end_time: '08:40', active: true });
    }
    await insertOne(director.client, 'teacher_availability', { institution_id: institutionA, teacher_profile_id: teacher.id, day_of_week: 1, start_time: '07:00', end_time: '08:40', active: true });
    await insertOne(director.client, 'teacher_availability', { institution_id: institutionA, teacher_profile_id: teacher.id, day_of_week: 2, start_time: '07:00', end_time: '08:40', active: true });
    await insertOne(director.client, 'teacher_availability', { institution_id: institutionA, teacher_profile_id: teacher.id, day_of_week: 3, start_time: '07:00', end_time: '08:40', active: true });
    await insertOne(director.client, 'school_schedule_breaks', { institution_id: institutionA, shift: 'MATUTINO', day_of_week: 1, name: `Intervalo ${suffix}`, start_time: '07:50', end_time: '08:40', active: true });

    const draft = await director.client.rpc('create_timetable_draft', {
      p_institution_id: institutionA,
      p_academic_year_id: yearA,
      p_name: `Manual runtime ${suffix}`,
      p_generation_source: 'MANUAL',
      p_generation_shift: 'MATUTINO',
      p_created_by: director.id,
      p_source_version_id: null,
      p_entries: [],
    });
    if (draft.error) throw draft.error;
    draftId = required(draft.data, 'draft id');
  }, 120_000);

  it('allows director and secretary, denies teacher, student, and cross-tenant calls', async () => {
    const allowed = await secretary.client.rpc('add_timetable_draft_entry', {
      p_version_id: draftId, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA,
      p_class_id: classA, p_subject_offering_id: mathOfferingA, p_room_id: roomA, p_day_of_week: 2,
      p_start_time: '07:00', p_end_time: '07:50', p_locked: false,
    });
    expect(allowed.error).toBeNull();

    const attempts = [
      teacher.client.rpc('add_timetable_draft_entry', { p_version_id: draftId, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA, p_class_id: classA, p_subject_offering_id: mathOfferingA, p_room_id: roomA, p_day_of_week: 3, p_start_time: '07:00', p_end_time: '07:50', p_locked: false }),
      student.client.rpc('add_timetable_draft_entry', { p_version_id: draftId, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA, p_class_id: classA, p_subject_offering_id: mathOfferingA, p_room_id: roomA, p_day_of_week: 3, p_start_time: '07:00', p_end_time: '07:50', p_locked: false }),
      foreignDirector.client.rpc('add_timetable_draft_entry', { p_version_id: draftId, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA, p_class_id: classA, p_subject_offering_id: mathOfferingA, p_room_id: roomA, p_day_of_week: 3, p_start_time: '07:00', p_end_time: '07:50', p_locked: false }),
    ];
    for (const attempt of await Promise.all(attempts)) expect(attempt.error).not.toBeNull();
  });

  it('validates invalid slots, breaks, move, duplicate, remove, and copy-day behavior', async () => {
    const invalid = await director.client.rpc('add_timetable_draft_entry', {
      p_version_id: draftId, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA,
      p_class_id: classA, p_subject_offering_id: mathOfferingA, p_room_id: roomA, p_day_of_week: 2,
      p_start_time: '09:00', p_end_time: '09:50', p_locked: false,
    });
    expect(invalid.error?.message).toContain('SCHOOL_TIME_SLOT_NOT_CONFIGURED');
    const breakConflict = await director.client.rpc('add_timetable_draft_entry', {
      p_version_id: draftId, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA,
      p_class_id: classA, p_subject_offering_id: mathOfferingA, p_room_id: roomA, p_day_of_week: 1,
      p_start_time: '07:50', p_end_time: '08:40', p_locked: false,
    });
    expect(breakConflict.error?.message).toContain('TIMETABLE_BREAK_CONFLICT');

    const existing = await service.from('timetable_version_entries').select('id').eq('version_id', draftId).eq('day_of_week', 2).eq('start_time', '07:00').single();
    const entryId = required(existing.data?.id, 'runtime entry');
    const moved = await director.client.rpc('update_timetable_draft_entry', { p_entry_id: entryId, p_version_id: draftId, p_institution_id: institutionA, p_day_of_week: 3, p_start_time: '07:00', p_end_time: '07:50', p_locked: false, p_room_id: roomA });
    expect(moved.error).toBeNull();
    const persisted = await service.from('timetable_version_entries').select('day_of_week, start_time').eq('id', entryId).single();
    expect(persisted.data).toMatchObject({ day_of_week: 3, start_time: '07:00:00' });

    const duplicate = await director.client.rpc('duplicate_timetable_draft_entry', { p_entry_id: entryId, p_version_id: draftId, p_institution_id: institutionA, p_day_of_week: 3, p_start_time: '07:50', p_end_time: '08:40' });
    expect(duplicate.error).toBeNull();
    const duplicateId = required(duplicate.data, 'duplicate id');
    const removed = await director.client.rpc('remove_timetable_draft_entry', { p_entry_id: duplicateId, p_version_id: draftId, p_institution_id: institutionA });
    expect(removed.error).toBeNull();

    const copied = await director.client.rpc('copy_timetable_draft_day', { p_version_id: draftId, p_institution_id: institutionA, p_source_day: 3, p_target_day: 2 });
    expect(copied.error).toBeNull();
    expect(copied.data.created).toBeGreaterThanOrEqual(1);
  });

  it('creates two consecutive entries atomically and exposes real conflicts in validation', async () => {
    const before = await service.from('timetable_version_entries').select('id').eq('version_id', draftId).eq('class_id', classB);
    const double = await director.client.rpc('add_timetable_draft_double_slot', {
      p_version_id: draftId, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA,
      p_class_id: classB, p_subject_offering_id: mathOfferingB, p_room_id: roomA, p_day_of_week: 1,
      p_start_time: '07:00', p_end_time: '07:50', p_next_start_time: '07:50', p_next_end_time: '08:40', p_locked: false,
    });
    expect(double.error).toBeNull();
    expect(double.data.first_id).toBeTruthy();
    expect(double.data.second_id).toBeTruthy();
    const two = await service.from('timetable_version_entries').select('id').eq('version_id', draftId).eq('class_id', classB);
    expect((two.data ?? []).length - (before.data ?? []).length).toBe(2);

    const atomicBefore = await service.from('timetable_version_entries').select('id').eq('version_id', draftId).eq('class_id', classB);
    const failedDouble = await director.client.rpc('add_timetable_draft_double_slot', {
      p_version_id: draftId, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA,
      p_class_id: classB, p_subject_offering_id: mathOfferingB, p_room_id: roomA, p_day_of_week: 2,
      p_start_time: '07:00', p_end_time: '07:50', p_next_start_time: '09:00', p_next_end_time: '09:50', p_locked: false,
    });
    expect(failedDouble.error?.message).toContain('TIMETABLE_DOUBLE_SLOT_NOT_CONSECUTIVE');
    const atomicAfter = await service.from('timetable_version_entries').select('id').eq('version_id', draftId).eq('class_id', classB);
    expect((atomicAfter.data ?? []).length).toBe((atomicBefore.data ?? []).length);

    const conflictEntry = await director.client.rpc('add_timetable_draft_entry', {
      p_version_id: draftId, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA,
      p_class_id: classA, p_subject_offering_id: portugueseOfferingA, p_room_id: roomA, p_day_of_week: 1,
      p_start_time: '07:00', p_end_time: '07:50', p_locked: false,
    });
    expect(conflictEntry.error).toBeNull();

    const conflict = await director.client.rpc('validate_timetable_draft', { p_version_id: draftId, p_institution_id: institutionA });
    expect(conflict.error).toBeNull();
    expect(conflict.data.diagnostics.map((item: { code: string }) => item.code)).toEqual(expect.arrayContaining(['TEACHER_CONFLICT', 'ROOM_CONFLICT']));
    const invalidPublication = await director.client.rpc('publish_timetable_version', { p_version_id: draftId });
    expect(invalidPublication.error).not.toBeNull();
  });

  it('does not mutate a published version through editor RPCs', async () => {
    const published = await service.from('timetable_versions').insert({ institution_id: institutionA, academic_year_id: yearA, name: `Published ${suffix}`, status: 'PUBLISHED', generation_source: 'MANUAL', generation_shift: 'MATUTINO', created_by: director.id }).select('id').single();
    expect(published.error).toBeNull();
    const result = await director.client.rpc('add_timetable_draft_entry', { p_version_id: published.data.id, p_institution_id: institutionA, p_academic_year_id: yearA, p_term_id: termA, p_class_id: classA, p_subject_offering_id: portugueseOfferingA, p_room_id: roomA, p_day_of_week: 1, p_start_time: '07:00', p_end_time: '07:50', p_locked: false });
    expect(result.error?.message).toContain('TIMETABLE_VERSION_NOT_DRAFT');
  });

  afterAll(async () => {
    if (!service) return;
    await service.from('institutions').delete().in('id', [institutionA, institutionB]);
    for (const userId of userIds) await service.auth.admin.deleteUser(userId);
  });
}, 180_000);
