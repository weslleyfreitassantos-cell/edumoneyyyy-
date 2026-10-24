import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20261023000100_inventory_physical_count.sql',
), 'utf8').toLowerCase();
const inventory = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20261022000200_inventory_management.sql',
), 'utf8').toLowerCase();

describe('inventory physical count migration security and consistency', () => {
  it('isolates count sessions and lines by institution and allows manager reads only', () => {
    expect(migration).toContain('alter table public.inventory_count_sessions enable row level security');
    expect(migration).toContain('alter table public.inventory_count_lines enable row level security');
    expect(migration).toContain("array['director', 'secretary']::public.user_role[]");
    expect(migration).toContain('grant select on public.inventory_count_sessions, public.inventory_count_lines');
    expect(migration).toContain('references public.inventory_locations(institution_id, id)');
    expect(migration).toContain('references public.inventory_items(institution_id, id)');
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete|all)\s+on\s+public\.inventory_count_/i);
  });

  it('snapshots balances, prevents concurrent changes at counted locations, and uses a consistent lock order', () => {
    expect(migration).toContain('expected_quantity numeric(14,3) not null');
    expect(migration).toContain('inventory_count_one_open_per_location_idx');
    expect(migration).toContain('inventory_guard_open_count_mutation');
    expect(migration).toContain('before insert or update or delete on public.inventory_balances');
    expect(migration).toContain('inventory_count_in_progress');
    expect(migration).toContain('order by balance.item_id for update');
    expect(migration).toContain('order by line.item_id');
    expect(inventory).toContain('stock operations and physical counts always lock the location before balances');
    expect(inventory).toContain('order by location.id for update');
  });

  it('requires complete nonnegative counts and reconciles only through audited idempotent ledger entries', () => {
    expect(migration).toContain('inventory_count_incomplete');
    expect(migration).toContain('inventory_finalize_count');
    expect(migration).toContain("'adjustment'");
    expect(migration).toContain('inventory_count_session_id');
    expect(migration).toContain('count_finalized');
    expect(migration).toContain('finalization_key');
    expect(migration).toContain('inventory_cancel_count');
    expect(migration).not.toMatch(/delete\s+from\s+public\.inventory_/i);
    expect(migration).not.toMatch(/on delete cascade/i);
  });
});
