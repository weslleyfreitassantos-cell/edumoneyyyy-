import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type Db = SupabaseClient<any, any, any>;
type Role = 'DIRECTOR' | 'SECRETARY' | 'TEACHER';
type Actor = { id: string; client: Db };

const url = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const hasRuntimeCredentials = Boolean(url && anonKey && serviceRoleKey);
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const isLocalSupabase = (() => {
  if (!url) return false;
  try {
    return localHosts.has(new URL(url).hostname);
  } catch {
    return false;
  }
})();
if (hasRuntimeCredentials && !isLocalSupabase) {
  throw new Error('Inventory runtime tests are restricted to a loopback Supabase instance.');
}
const runtimeDescribe = hasRuntimeCredentials && isLocalSupabase ? describe : describe.skip;

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
    const location = await director.client.from('inventory_locations').select('id')
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

    const balance = await director.client.from('inventory_balances').select('quantity')
      .eq('institution_id', institutionId).eq('item_id', itemId).eq('location_id', locationId).single();
    expect(Number(balance.data?.quantity)).toBe(4);
    const adjustments = await director.client.from('inventory_movements').select('id, quantity_delta')
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

  it('runs the teacher request lifecycle with partial concurrent fulfillment and an auditable balance', async () => {
    const [director, secretary, teacher, foreignDirector] = actors;
    const created = await director.client.rpc('inventory_create_item', {
      p_institution_id: institutionId,
      p_name: `Caderno workflow ${suffix}`,
      p_category: `Papelaria workflow ${suffix}`,
      p_unit: 'unidade',
      p_location: `Almoxarifado workflow ${suffix}`,
      p_supplier: null,
      p_supplier_contact: null,
      p_sku: null,
      p_description: 'Material de prova do fluxo completo',
      p_minimum_quantity: 2,
      p_initial_quantity: 0,
      p_idempotency_key: `workflow-item-${suffix}`,
    });
    expect(created.error).toBeNull();
    const itemId = required(created.data, 'workflow inventory item id');
    const location = await director.client.from('inventory_locations').select('id')
      .eq('institution_id', institutionId).eq('name', `Almoxarifado workflow ${suffix}`).single();
    expect(location.error).toBeNull();
    const locationId = required(location.data?.id, 'workflow inventory location id');

    const receiptKey = `workflow-receipt-${suffix}`;
    const receipt = await secretary.client.rpc('inventory_record_movement', {
      p_institution_id: institutionId,
      p_item_id: itemId,
      p_location_id: locationId,
      p_movement_type: 'RECEIPT',
      p_quantity: 5,
      p_note: 'Entrada conferida pela secretaria',
      p_idempotency_key: receiptKey,
    });
    expect(receipt.error).toBeNull();
    const receiptReplay = await secretary.client.rpc('inventory_record_movement', {
      p_institution_id: institutionId,
      p_item_id: itemId,
      p_location_id: locationId,
      p_movement_type: 'RECEIPT',
      p_quantity: 5,
      p_note: 'Entrada conferida pela secretaria',
      p_idempotency_key: receiptKey,
    });
    expect(receiptReplay.error).toBeNull();
    expect(receiptReplay.data).toBe(receipt.data);

    const requestKey = `workflow-request-${suffix}`;
    const requestArgs = {
      p_institution_id: institutionId,
      p_item_id: itemId,
      p_quantity: 4,
      p_note: 'Materiais para a turma',
      p_idempotency_key: requestKey,
    };
    const requested = await teacher.client.rpc('inventory_create_request', requestArgs);
    expect(requested.error).toBeNull();
    const requestId = required(requested.data, 'teacher inventory request id');
    const requestReplay = await teacher.client.rpc('inventory_create_request', requestArgs);
    expect(requestReplay.error).toBeNull();
    expect(requestReplay.data).toBe(requestId);

    const requestItem = await teacher.client.from('inventory_request_items').select('id, requested_quantity')
      .eq('institution_id', institutionId).eq('request_id', requestId).single();
    expect(requestItem.error).toBeNull();
    expect(Number(requestItem.data?.requested_quantity)).toBe(4);
    const requestItemId = required(requestItem.data?.id, 'teacher-visible request item id');

    const teacherDecision = await teacher.client.rpc('inventory_decide_request', {
      p_institution_id: institutionId,
      p_request_id: requestId,
      p_decision: 'APPROVED',
      p_idempotency_key: `teacher-decision-${suffix}`,
    });
    expect(teacherDecision.error?.code).toBe('42501');
    const foreignRequests = await foreignDirector.client.from('inventory_requests').select('id')
      .eq('institution_id', institutionId);
    expect(foreignRequests.error).toBeNull();
    expect(foreignRequests.data).toEqual([]);

    const approved = await secretary.client.rpc('inventory_decide_request', {
      p_institution_id: institutionId,
      p_request_id: requestId,
      p_decision: 'APPROVED',
      p_idempotency_key: `workflow-approve-${suffix}`,
    });
    expect(approved.error).toBeNull();
    expect(approved.data).toBe('APPROVED');

    const unauthorizedFulfillment = await teacher.client.rpc('inventory_fulfill_request', {
      p_institution_id: institutionId,
      p_request_id: requestId,
      p_request_item_id: requestItemId,
      p_location_id: locationId,
      p_quantity: 1,
      p_idempotency_key: `teacher-fulfill-${suffix}`,
    });
    expect(unauthorizedFulfillment.error?.code).toBe('42501');

    const concurrentFulfillments = await Promise.all([
      secretary.client.rpc('inventory_fulfill_request', {
        p_institution_id: institutionId,
        p_request_id: requestId,
        p_request_item_id: requestItemId,
        p_location_id: locationId,
        p_quantity: 3,
        p_idempotency_key: `workflow-concurrent-a-${suffix}`,
      }),
      secretary.client.rpc('inventory_fulfill_request', {
        p_institution_id: institutionId,
        p_request_id: requestId,
        p_request_item_id: requestItemId,
        p_location_id: locationId,
        p_quantity: 3,
        p_idempotency_key: `workflow-concurrent-b-${suffix}`,
      }),
    ]);
    const successfulFulfillments = concurrentFulfillments.filter((result) => !result.error);
    const rejectedFulfillments = concurrentFulfillments.filter((result) => result.error);
    expect(successfulFulfillments).toHaveLength(1);
    expect(successfulFulfillments[0]?.data).toBe('PARTIALLY_FULFILLED');
    expect(rejectedFulfillments).toHaveLength(1);
    expect(rejectedFulfillments[0]?.error?.code).toBe('22023');
    expect(rejectedFulfillments[0]?.error?.message).toContain('INVENTORY_FULFILLMENT_EXCEEDS_REMAINING');

    const fulfilledRequest = await teacher.client.from('inventory_requests').select('status')
      .eq('institution_id', institutionId).eq('id', requestId).single();
    expect(fulfilledRequest.error).toBeNull();
    expect(fulfilledRequest.data?.status).toBe('PARTIALLY_FULFILLED');
    const partialRequestItem = await teacher.client.from('inventory_request_items')
      .select('fulfilled_quantity').eq('institution_id', institutionId).eq('id', requestItemId).single();
    expect(Number(partialRequestItem.data?.fulfilled_quantity)).toBe(3);

    const finalFulfillmentKey = `workflow-fulfill-final-${suffix}`;
    const finalized = await secretary.client.rpc('inventory_fulfill_request', {
      p_institution_id: institutionId,
      p_request_id: requestId,
      p_request_item_id: requestItemId,
      p_location_id: locationId,
      p_quantity: 1,
      p_idempotency_key: finalFulfillmentKey,
    });
    expect(finalized.error).toBeNull();
    expect(finalized.data).toBe('FULFILLED');
    const finalizedReplay = await secretary.client.rpc('inventory_fulfill_request', {
      p_institution_id: institutionId,
      p_request_id: requestId,
      p_request_item_id: requestItemId,
      p_location_id: locationId,
      p_quantity: 1,
      p_idempotency_key: finalFulfillmentKey,
    });
    expect(finalizedReplay.error).toBeNull();
    expect(finalizedReplay.data).toBe('FULFILLED');

    const finalRequestItem = await teacher.client.from('inventory_request_items')
      .select('fulfilled_quantity').eq('institution_id', institutionId).eq('id', requestItemId).single();
    expect(Number(finalRequestItem.data?.fulfilled_quantity)).toBe(4);
    const finalRequest = await teacher.client.from('inventory_requests').select('status')
      .eq('institution_id', institutionId).eq('id', requestId).single();
    expect(finalRequest.data?.status).toBe('FULFILLED');

    const balance = await secretary.client.from('inventory_balances').select('quantity')
      .eq('institution_id', institutionId).eq('item_id', itemId).eq('location_id', locationId).single();
    expect(Number(balance.data?.quantity)).toBe(1);
    const teacherMovements = await teacher.client.from('inventory_movements')
      .select('movement_type, quantity_delta').eq('institution_id', institutionId).eq('item_id', itemId);
    expect(teacherMovements.error).toBeNull();
    expect(teacherMovements.data).toHaveLength(0);
    const managerMovements = await director.client.from('inventory_movements')
      .select('movement_type, quantity_delta, balance_after').eq('institution_id', institutionId).eq('item_id', itemId);
    expect(managerMovements.error).toBeNull();
    expect(managerMovements.data).toHaveLength(3);
    expect(managerMovements.data?.reduce((sum, movement) => sum + Number(movement.quantity_delta), 0)).toBe(1);
    const requestAudit = await director.client.from('inventory_audit_events').select('action')
      .eq('institution_id', institutionId).eq('entity_id', requestId);
    expect(requestAudit.error).toBeNull();
    expect(requestAudit.data?.map((event) => event.action).sort()).toEqual([
      'REQUEST_CREATED', 'REQUEST_DECIDED', 'REQUEST_FULFILLED', 'REQUEST_FULFILLED',
    ]);
  }, 120_000);

});
