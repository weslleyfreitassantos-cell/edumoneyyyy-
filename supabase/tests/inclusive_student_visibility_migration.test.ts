import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261017000100_inclusive_student_visibility.sql'),
  'utf8',
);
const studentsSelectPolicy =
  migration.match(/create policy students_select_policy[\s\S]*?;/i)?.[0] ?? '';

describe('inclusive student visibility migration', () => {
  it('exposes only students authorized for the active profile', () => {
    expect(studentsSelectPolicy).toContain('for select');
    expect(studentsSelectPolicy).toContain('to authenticated');
    expect(studentsSelectPolicy).toContain('private.is_current_profile_active()');
    expect(studentsSelectPolicy).toContain('public.can_manage_institution_operations(institution_id)');
    expect(studentsSelectPolicy).toContain('profile_id = (select auth.uid())');
    expect(studentsSelectPolicy).toContain('private.is_guardian_of_student(id)');
    expect(studentsSelectPolicy).toContain('private.inclusive_teacher_can_student(institution_id, id)');
    expect(studentsSelectPolicy).toContain('private.inclusive_aee_can_student(institution_id, id)');
    expect(studentsSelectPolicy).not.toMatch(/\bfor\s+(insert|update|delete|all)\b/i);
  });

  it('does not modify student or inclusive-plan records', () => {
    expect(migration).not.toMatch(/\b(insert\s+into|update\s+public\.|delete\s+from)\b/i);
    expect(migration).not.toMatch(/create\s+policy\s+\w+[\s\S]*?\bfor\s+(insert|update|delete|all)\b/i);
  });
});
