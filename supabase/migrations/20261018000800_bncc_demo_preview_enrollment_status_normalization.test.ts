import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261018000800_bncc_demo_preview_enrollment_status_normalization.sql', import.meta.url),
  'utf8',
);

describe('BNCC demo preview enrollment status normalization', () => {
  it('uses the same case-insensitive active-enrollment rule as the guided-study recommender', () => {
    expect(migration).toContain('create or replace function private.bncc_demo_preview_allowed');
    expect(migration).toContain("upper(enrollment.status::text) = 'ACTIVE'");
    expect(migration).not.toContain("enrollment.status = 'active'");
  });

  it('retains the institution, active student, enrollment, class, and preview gates', () => {
    expect(migration).toContain('preview.institution_id = p_institution_id');
    expect(migration).toContain('preview.active');
    expect(migration).toContain('student.id = p_student_id');
    expect(migration).toContain('student.active');
    expect(migration).toContain('enrollment.active');
    expect(migration).toContain('class.institution_id = preview.institution_id');
    expect(migration).toContain('class.active');
    expect(migration).toContain('revoke all on function private.bncc_demo_preview_allowed(uuid, uuid)');
  });
});
