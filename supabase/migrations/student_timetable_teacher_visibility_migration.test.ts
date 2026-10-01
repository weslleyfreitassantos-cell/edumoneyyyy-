import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260917000200_student_timetable_teacher_visibility.sql', import.meta.url),
  'utf8',
);

describe('student timetable teacher visibility migration', () => {
  it('redefines profile read access without granting write access', () => {
    expect(migration).toContain('drop policy if exists profiles_select_policy');
    expect(migration).toContain('create policy profiles_select_policy');
    expect(migration).toContain("teacher_membership.role = 'TEACHER'::public.user_role");
    expect(migration).toContain('private.can_access_academic_institution');
    expect(migration).not.toContain('for insert');
    expect(migration).not.toContain('for update');
    expect(migration).not.toContain('for delete');
  });

  it('preserva a visibilidade operacional e recarrega o PostgREST', () => {
    expect(migration).toContain("array['DIRECTOR', 'SECRETARY']::public.user_role[]");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
