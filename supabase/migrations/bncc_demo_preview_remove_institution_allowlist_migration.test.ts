import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261019000300_bncc_demo_preview_remove_institution_allowlist.sql', import.meta.url),
  'utf8',
);

describe('BNCC demo preview without institution allowlist', () => {
  it('removes only the institution allowlist while retaining student and institution scope', () => {
    expect(migration).toContain('private.learning_v2_scope_student(p_institution_id, p_student_id)');
    expect(migration).toContain('student.id = p_student_id');
    expect(migration).toContain('student.institution_id = p_institution_id');
    expect(migration).toContain('student.active');
    expect(migration).toContain('enrollment.active');
    expect(migration).toContain("upper(enrollment.status::text) = 'ACTIVE'");
    expect(migration).toContain('class.institution_id = p_institution_id');
    expect(migration).toContain('class.active');
    expect(migration).not.toContain('bncc_demo_preview_institutions');
  });

  it('keeps the helper private and preserves consumer content-state gates', () => {
    expect(migration).toContain('revoke all on function private.bncc_demo_preview_allowed(uuid, uuid)');
    expect(migration).toContain('publication, mapping, grade, and pedagogical-review state checks');
    expect(migration).not.toMatch(/\b(insert\s+into|update\s+public\.|delete\s+from|drop\s+table)\b/i);
  });
});
