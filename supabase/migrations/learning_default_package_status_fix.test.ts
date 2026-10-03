import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261003001100_fix_learning_default_package_enrollment_status.sql'),
  'utf8',
);

describe('learning default package status fix', () => {
  it('accepts canonical enrollment status case-insensitively', () => {
    expect(migration).toContain("upper(btrim(enrollment.status)) = 'ACTIVE'");
    expect(migration).not.toContain("enrollment.status = 'active'");
  });

  it('keeps the same scoped RPC contract', () => {
    expect(migration).toContain('public.list_student_learning_packages(');
    expect(migration).toContain("raise exception 'LEARNING_PACKAGE_STUDENT_SCOPE_DENIED'");
  });
});
