import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261010001000_bncc_laura_demo_preview_v7_runtime_fix.sql', import.meta.url),
  'utf8',
);

describe('Laura BNCC demonstration runtime fix', () => {
  it('keeps the readiness exception restricted to the existing preview gate', () => {
    expect(migration).not.toContain('$$migration$');
    expect(migration).toContain('append_guided_v4_next_step');
    expect(migration).toContain('private.bncc_demo_preview_allowed(session_row.institution_id, session_row.student_id)');
    expect(migration).toContain("preview_skill.publication_status = 'STAGING'");
    expect(migration).toContain("preview_skill.content_readiness = 'CONTENT_READY'");
    expect(migration).toContain("preview_skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4'");
    expect(migration).toContain('PEDAGOGICAL_REVIEW_PENDING');
  });

  it('recovers only an existing paused demo session and never publishes content', () => {
    expect(migration).toContain('recover_bncc_demo_preview_session');
    expect(migration).toContain("session.metadata->>'runtime_reason' = 'CONTENT_NOT_READY'");
    expect(migration).toContain("'demo_preview_recovery', true");
    expect(migration).not.toMatch(/update\s+public\.learning_curriculum_skills/i);
    expect(migration).not.toMatch(/publication_status\s*=\s*'PUBLISHED'/i);
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/truncate\s/i);
  });
});
