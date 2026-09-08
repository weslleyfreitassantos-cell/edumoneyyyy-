import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260902000100_institution_admin_memberships.sql', import.meta.url),
  'utf8',
);

describe('institution admin memberships migration', () => {
  it('recognizes ADMIN memberships in account-backed institutions', () => {
    expect(migration).toContain("'ADMIN'::public.user_role");
    expect(migration).toContain('public.is_institution_operational');
    expect(migration).not.toContain('institution.account_id is null');
  });

  it('keeps helper functions restricted to authenticated and service roles', () => {
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to authenticated, service_role');
  });
});
