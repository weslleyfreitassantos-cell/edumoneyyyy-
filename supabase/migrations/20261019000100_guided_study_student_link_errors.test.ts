import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261019000100_guided_study_student_link_errors.sql', import.meta.url),
  'utf8',
);

describe('guided study student-link error states', () => {
  it('returns safe states for missing or ambiguous student profiles without weakening access', () => {
    expect(migration).toContain("student.profile_id = auth.uid()");
    expect(migration).toContain("'STUDENT_PROFILE_LINK_MISSING'");
    expect(migration).toContain("'AMBIGUOUS_STUDENT_LINK'");
    expect(migration).toContain('private.recommend_guided_discipline_study_v10(');
    expect(migration).toContain('revoke all on function public.get_recommended_guided_study_v10(uuid, uuid)');
    expect(migration).toContain('to authenticated');
    expect(migration).not.toMatch(/raise\s+exception/i);
    expect(migration).not.toMatch(/p_student_id/i);
  });
});
