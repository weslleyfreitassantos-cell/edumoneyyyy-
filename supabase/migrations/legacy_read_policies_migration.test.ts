import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260903000100_remove_legacy_read_policies.sql',
  ),
  'utf8',
);

describe('legacy read policies migration', () => {
  it('removes only the redundant tenant read policies', () => {
    for (const policy of [
      'Users can view academic_years from own institution',
      'Users can view classes from own institution',
      'Users can view enrollments from own institution',
      'Users can view guardianships from own institution',
      'Users can view own institution',
      'Institution admins can view memberships',
      'Users can view own memberships',
      'Institution admins can view institution profiles',
      'Users can view own profile',
      'Users can view own institution students',
      'Users can view students from own institution',
      'Users can view subject_offerings from own institution',
      'Users can view subjects from own institution',
      'Users can view terms from own institution',
    ]) {
      expect(migration).toContain(`drop policy if exists "${policy}"`);
    }

    expect(migration).not.toContain('drop policy if exists guardianships_student_select');
    expect(migration).not.toContain('drop policy if exists students_update_policy');
  });
});
