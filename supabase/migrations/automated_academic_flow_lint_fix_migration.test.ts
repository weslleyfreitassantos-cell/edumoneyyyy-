import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260921000100_fix_local_lint_errors.sql', import.meta.url),
  'utf8',
);

describe('automated academic flow lint fixes', () => {
  it('defines the academic year copy RPC deterministically without dynamic SQL', () => {
    expect(migration).toContain("set search_path = 'pg_catalog, public, pg_temp'");
    expect(migration).toMatch(/create or replace function public\.copy_academic_year_structure\(/i);
    expect(migration).not.toContain('academic_class_copy_map');
    expect(migration).not.toMatch(/pg_get_functiondef|regexp_replace|\bexecute\s+fixed_definition/i);
  });

  it('defines the enrollment RPC explicitly with a typed birth date', () => {
    expect(migration).toMatch(/create or replace function public\.update_full_student_enrollment_bundle\(p_payload jsonb\)/i);
    expect(migration).toContain("->>'birth_date', '')::date");
    expect(migration).toContain('private.has_institution_role');
  });
});
