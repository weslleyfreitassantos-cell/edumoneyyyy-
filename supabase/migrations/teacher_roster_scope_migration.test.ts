import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261003001200_normalize_teacher_learning_roster_scope.sql'),
  'utf8',
);

describe('teacher roster scope migration', () => {
  it('normalizes enrollment status without broadening institution or teacher scope', () => {
    expect(migration).toContain("lower(btrim(enrollment.status)) = 'active'");
    expect(migration).toContain('student.institution_id = p_institution_id');
    expect(migration).toContain('private.learning_teacher_can_access_student_any');
    expect(migration).not.toContain("enrollment.status = 'ACTIVE'");
  });
});
