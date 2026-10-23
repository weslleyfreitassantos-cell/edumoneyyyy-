import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Db = SupabaseClient<any, any, any>;
type Role = 'DIRECTOR' | 'SECRETARY' | 'TEACHER';
type Actor = { id: string; client: Db };

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

async function createActor(service: Db, institutionId: string, role: Role, label: string, suffix: string): Promise<Actor> {
  const email = `inventory-${suffix}-${label}@local.test`;
  const password = 'InventoryPhysicalCount!2026';
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const user = required(created.data.user, `${role} auth user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: `Inventory ${label}`, email, role, active: true });
  await insertOne(service, 'memberships', { profile_id: user.id, institution_id: institutionId, role, active: true });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`${role} sign in failed: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, client };
}

async function expectDeleted(db: Db, table: string, institutionId: string): Promise<void> {
  const { error } = await db.from(table).delete().eq('institution_id', institutionId);
  if (error) throw new Error(`cleanup ${table}: ${error.message}`);
}

runtimeDescribe('inventory physical count runtime contract', () => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? 'local'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  let service: Db;
  let institutionId: string;
  let foreignInstitutionId: string;
  const actors: Actor[] = [];

  beforeAll(async () => {
    service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    institutionId = (await insertOne(service, 'institutions', { name: `Inventory count ${suffix}`, active: true })).id;
    foreignInstitutionId = (await insertOne(service, 'institutions', { name: `Inventory foreign ${suffix}`, active: true })).id;
    actors.push(await createActor(service, institutionId, 'DIRECTOR', 'director', suffix));
    actors.push(await createActor(service, institutionId, 'SECRETARY', 'secretary', suffix));
    actors.push(await createActor(service, institutionId, 'TEACHER', 'teacher', suffix));
    actors.push(await createActor(service, foreignInstitutionId, 'DIRECTOR', 'foreign-director', suffix));
  }, 120_000);

  it('snapshots, blocks concurrent stock writes, reconciles exactly once, and releases on cancel', async () => {
    const [director, secretary, teacher, foreignDirector] = actors;
    const created = await director.client.rpc('inventory_create_item', {
      p_institution_id: institutionId,
      p_name: `Papel A4 ${suffix}`,
      p_category: `Papelaria ${suffix}`,
      p_unit: 'resma',
      p_location: `Almoxarifado ${suffix}`,
      p_supplier: null,
      p_supplier_contact: null,
      p_sku: null,
      p_description: null,
      p_minimum_quantity: 1,
      p_initial_quantity: 5,
      p_idempotency_key: `item-${suffix}`,
    });
    expect(created.error).toBeNull();
    const itemId = required(created.data, 'inventory item id');
    const location = await service.from('inventory_locations').select('id')
      .eq('institution_id', institutionId).eq('name', `Almoxarifado ${suffix}`).single();
    expect(location.error).toBeNull();
    const locationId = required(location.data?.id, 'inventory location id');

    const started = await director.client.rpc('inventory_start_count', {
      p_institution_id: institutionId,
      p_location_id: locationId,
      p_note: 'Contagem dinâmica de CI',
      p_idempotency_key: `start-${suffix}`,
    });
    expect(started.error).toBeNull();
    const sessionId = required(started.data, 'inventory count session id');

    const teacherRows = await teacher.client.from('inventory_count_sessions').select('id')
      .eq('institution_id', institutionId);
    expect(teacherRows.error).toBeNull();
    expect(teacherRows.data).toEqual([]);
    const foreignAttempt = await foreignDirector.client.rpc('inventory_start_count', {
      p_institution_id: institutionId,
      p_location_id: locationId,
      p_note: null,
      p_idempotency_key: `foreign-${suffix}`,
    });
    expect(foreignAttempt.error?.code).toBe('42501');

    const lines = await secretary.client.from('inventory_count_lines').select('id, expected_quantity')
      .eq('institution_id', institutionId).eq('session_id', sessionId).single();
    expect(lines.error).toBeNull();
    expect(Number(lines.data?.expected_quantity)).toBe(5);
    const lineId = required(lines.data?.id, 'inventory count line id');

    const directWrite = await director.client.from('inventory_balances').update({ quantity: 999 })
      .eq('institution_id', institutionId).eq('item_id', itemId).eq('location_id', locationId);
    expect(directWrite.error).not.toBeNull();
    const blockedMovement = await director.client.rpc('inventory_record_movement', {
      p_institution_id: institutionId,
      p_item_id: itemId,
      p_location_id: locationId,
      p_movement_type: 'RECEIPT',
      p_quantity: 1,
      p_note: null,
      p_idempotency_key: `blocked-${suffix}`,
    });
    expect(blockedMovement.error?.message).toContain('INVENTORY_COUNT_IN_PROGRESS');

    const incomplete = await secretary.client.rpc('inventory_save_count', {
      p_session_id: sessionId,
      p_lines: [],
      p_idempotency_key: `incomplete-${suffix}`,
    });
    expect(incomplete.error?.message).toContain('INVENTORY_COUNT_INCOMPLETE');
    const saved = await secretary.client.rpc('inventory_save_count', {
      p_session_id: sessionId,
      p_lines: [{ line_id: lineId, counted_quantity: 4 }],
      p_idempotency_key: `save-${suffix}`,
    });
    expect(saved.error).toBeNull();

    const finalizationKey = `finalize-${suffix}`;
    const finalized = await secretary.client.rpc('inventory_finalize_count', {
      p_session_id: sessionId,
      p_idempotency_key: finalizationKey,
    });
    expect(finalized.error).toBeNull();
    const replay = await secretary.client.rpc('inventory_finalize_count', {
      p_session_id: sessionId,
      p_idempotency_key: finalizationKey,
    });
    expect(replay.error).toBeNull();
    expect(replay.data).toBe(sessionId);

    const balance = await service.from('inventory_balances').select('quantity')
      .eq('institution_id', institutionId).eq('item_id', itemId).eq('location_id', locationId).single();
    expect(Number(balance.data?.quantity)).toBe(4);
    const adjustments = await service.from('inventory_movements').select('id, quantity_delta')
      .eq('institution_id', institutionId).eq('inventory_count_session_id', sessionId);
    expect(adjustments.error).toBeNull();
    expect(adjustments.data).toHaveLength(1);
    expect(Number(adjustments.data?.[0].quantity_delta)).toBe(-1);

    const cancelledSession = await director.client.rpc('inventory_start_count', {
      p_institution_id: institutionId,
      p_location_id: locationId,
      p_note: null,
      p_idempotency_key: `start-cancel-${suffix}`,
    });
    expect(cancelledSession.error).toBeNull();
    const cancelled = await director.client.rpc('inventory_cancel_count', {
      p_session_id: cancelledSession.data,
      p_idempotency_key: `cancel-${suffix}`,
    });
    expect(cancelled.error).toBeNull();
    const resumedMovement = await director.client.rpc('inventory_record_movement', {
      p_institution_id: institutionId,
      p_item_id: itemId,
      p_location_id: locationId,
      p_movement_type: 'RECEIPT',
      p_quantity: 1,
      p_note: null,
      p_idempotency_key: `resumed-${suffix}`,
    });
    expect(resumedMovement.error).toBeNull();
  }, 120_000);

  afterAll(async () => {
    if (!service) return;
    for (const id of [institutionId, foreignInstitutionId].filter(Boolean)) {
      for (const table of [
        'inventory_movements', 'inventory_count_lines', 'inventory_count_sessions',
        'inventory_audit_events', 'inventory_request_items', 'inventory_requests',
        'inventory_balances', 'inventory_items', 'inventory_suppliers',
        'inventory_categories', 'inventory_units', 'inventory_locations',
      ]) await expectDeleted(service, table, id);
      await service.from('memberships').delete().eq('institution_id', id);
      await service.from('institutions').delete().eq('id', id);
    }
    for (const actor of actors) {
      await service.from('profiles').delete().eq('id', actor.id);
      await service.auth.admin.deleteUser(actor.id);
    }
  }, 120_000);
});
