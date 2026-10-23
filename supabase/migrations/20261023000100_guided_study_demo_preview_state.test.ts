import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261023000100_guided_study_demo_preview_state.sql', import.meta.url),
  'utf8',
);

describe('guided study preview scope response', () => {
  it('converts only the demo-preview gate into a safe state and preserves authorization failures', () => {
    expect(migration).toContain('student.profile_id = auth.uid()');
    expect(migration).toContain('student.institution_id = p_institution_id');
    expect(migration).toContain("jsonb_build_object('state', 'STUDENT_PROFILE_LINK_MISSING')");
    expect(migration).toContain("jsonb_build_object('state', 'AMBIGUOUS_STUDENT_LINK')");
    expect(migration).toContain("sqlerrm = 'LEARNING_V10_DEMO_SCOPE_DENIED'");
    expect(migration).toContain("jsonb_build_object('state', 'DEMO_PREVIEW_UNAVAILABLE')");
    expect(migration).toMatch(/exception\s+when\s+raise_exception[\s\S]*?\braise\s*;/i);
    expect(migration).toContain('revoke all on function public.get_recommended_guided_study_v10(uuid, uuid)');
    expect(migration).toContain('to authenticated');
    expect(migration).not.toMatch(/bncc_demo_preview_allowed\s*\([^)]*\)\s*then/i);
  });
});
