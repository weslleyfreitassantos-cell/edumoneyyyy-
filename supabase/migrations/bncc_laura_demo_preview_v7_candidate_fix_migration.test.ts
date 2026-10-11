import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261010000900_bncc_laura_demo_preview_v7_candidate_fix.sql', import.meta.url),
  'utf8',
);

describe('Laura BNCC demonstration candidate scope fix', () => {
  it('allows candidate alignment only through the existing restricted preview branch', () => {
    expect(migration).toContain('list_student_guided_learning_targets');
    expect(migration).toContain('assert_bncc_guided_session_scope');
    expect(migration).toContain("skill.bncc_alignment_status in (''MAPPED'', ''CANDIDATE'')");
    expect(migration).not.toMatch(/publication_status\s*=\s*'PUBLISHED'/i);
    expect(migration).not.toMatch(/update\s+public\.learning_curriculum_skills/i);
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/truncate\s/i);
  });
});
