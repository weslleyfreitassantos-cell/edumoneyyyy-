import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20261022000200_inventory_management.sql',
), 'utf8').toLowerCase();

describe('inventory management migration security invariants', () => {
  it('enables row-level security and grants read-only table access to authenticated clients', () => {
    const tables = [
      'inventory_categories', 'inventory_units', 'inventory_locations',
      'inventory_suppliers', 'inventory_items', 'inventory_balances',
      'inventory_movements', 'inventory_requests', 'inventory_request_items',
      'inventory_audit_events',
    ];
    for (const table of tables) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain('grant select on public.inventory_categories');
    expect(migration).toContain('from anon, authenticated');
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete|all)\s+on\s+public\.inventory_/i);
  });

  it('uses active exact institution memberships and only allows the defined staff roles', () => {
    expect(migration).toContain('private.has_exact_institution_role');
    expect(migration).toContain("array['director', 'secretary', 'teacher']::public.user_role[]");
    expect(migration).toContain("array['director', 'secretary']::public.user_role[]");
    expect(migration).toContain("array['teacher']::public.user_role[]");
    expect(migration).not.toContain("array['admin', 'director'");
    expect(migration).not.toContain("array['super_admin'");
    expect(migration).toContain('request.requester_id = auth.uid()');
  });

  it('keeps stock mutations transactional, idempotent and append-only', () => {
    expect(migration).toContain('for update');
    expect(migration).toContain('on conflict (institution_id, idempotency_key) do nothing');
    expect(migration).toContain('inventory_insufficient_stock');
    expect(migration).toContain('check (quantity >= 0)');
    expect(migration).toContain('inventory_audit_events');
    expect(migration).not.toMatch(/create policy[^;]+for\s+delete\s+to\s+authenticated/is);
    expect(migration).not.toMatch(/create policy[^;]+for\s+update\s+to\s+authenticated/is);
    expect(migration).not.toMatch(/create policy[^;]+for\s+insert\s+to\s+authenticated/is);
  });

  it('supports audited transfers, returns, justified adjustments, cancellation and soft deactivation', () => {
    expect(migration).toContain("'transfer_in', 'transfer_out'");
    expect(migration).toContain("'receipt', 'issue', 'return', 'adjustment'");
    expect(migration).toContain('inventory_adjustment_reason_required');
    expect(migration).toContain('inventory_transfer_stock');
    expect(migration).toContain('inventory_cancel_request');
    expect(migration).toContain('inventory_set_item_active');
    expect(migration).toContain("'item_deactivated'");
    expect(migration).not.toMatch(/delete\s+from\s+public\.inventory_/i);
    expect(migration).not.toMatch(/on delete cascade/i);
  });
});
