import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261018000400_inclusive_student_registration_bridge.sql'),
  'utf8',
);

describe('inclusive student registration bridge migration', () => {
  it('creates an idempotent bridge from enrollment health flags to PEI and AEE', () => {
    expect(migration).toContain('private.ensure_inclusive_student_registration');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('from public.inclusive_pei_plans plan');
    expect(migration).toContain('from public.inclusive_aee_plans plan');
    expect(migration).toContain("health_row.needs_special_education, false");
    expect(migration).toContain("after insert or update of autism, giftedness, needs_special_education");
  });

  it('does not invent a staff actor or run an unscoped backfill', () => {
    expect(migration).toContain("reason', 'no_authorized_actor");
    expect(migration).toContain("registration_bridge_created is true");
    expect(migration).toContain("reason', 'no_active_enrollment");
    expect(migration).not.toContain('order by case membership.role');
    expect(migration).not.toContain('for health_row in');
    expect(migration).not.toMatch(/delete\s+from\s+public\.inclusive_/i);
    expect(migration).not.toMatch(/truncate\s+public\.inclusive_/i);
  });
});
