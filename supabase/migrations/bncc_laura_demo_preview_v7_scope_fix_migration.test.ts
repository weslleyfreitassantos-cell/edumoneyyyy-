import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261010000700_bncc_laura_demo_preview_v7_scope_fix.sql', import.meta.url),
  'utf8',
);

describe('Laura BNCC demonstration preview scope fix', () => {
  it('matches the authenticated fictitious demo student and production status representation', () => {
    expect(migration).toContain('Laura Cristina Moreira Azevedo');
    expect(migration).toContain("upper(enrollment.status::text) = 'ACTIVE'");
    expect(migration).toContain('private.bncc_demo_preview_institutions');
    expect(migration).not.toMatch(/update\s+public\.learning_curriculum_skills[\s\S]*publication_status\s*=\s*'PUBLISHED'/i);
  });

  it('rewrites only the v7 discovery and session gates', () => {
    expect(migration).toContain('pg_get_functiondef(proc.oid)');
    expect(migration).toContain('list_student_guided_learning_targets');
    expect(migration).toContain('start_guided_learning_session_v4');
    expect(migration).toContain('assert_published_v4_session_target');
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/truncate\s/i);
  });
});
