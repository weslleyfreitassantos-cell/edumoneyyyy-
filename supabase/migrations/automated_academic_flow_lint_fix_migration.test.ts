import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260921000100_fix_local_lint_errors.sql', import.meta.url),
  'utf8',
);

describe('automated academic flow lint fixes', () => {
  it('makes the academic year copy RPC resolve its temporary table', () => {
    expect(migration).toContain("set search_path = 'pg_catalog, public, pg_temp'");
    expect(migration).toContain('copy_academic_year_structure(uuid, uuid, uuid, boolean, boolean)');
  });

  it('keeps the enrollment birth date assignment typed as date', () => {
    expect(migration).toContain("->>'birth_date', '')::date");
    expect(migration).toContain("'public.update_full_student_enrollment_bundle(jsonb)'::regprocedure");
  });
});
