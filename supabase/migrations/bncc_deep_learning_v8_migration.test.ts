import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261010001100_bncc_deep_learning_v8.sql', import.meta.url),
  'utf8',
);

describe('BNCC deep learning V8 migration', () => {
  it('publishes a forward-only, review-pending V8 content pack', () => {
    expect(migration).toContain('TECESCOLA_BNCC_DEEP_LEARNING_V8');
    expect(migration).toContain("content_version',5");
    expect(migration).toContain("pedagogical_review_status','PENDING'");
    expect(migration).toContain('UNSEEN_FIRST_LIMIT_TWO');
    expect(migration).toContain('error_focus');
    expect(migration).toContain('remediation_hint');
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/truncate\s+/i);
  });

  it('keeps catalog lookups scoped and does not use ambiguous column variables', () => {
    expect(migration).toContain('v_catalog_id');
    expect(migration).toContain('v_skill_id');
    expect(migration).toContain('canonical.catalog_id = v_catalog_id');
    expect(migration).not.toMatch(/where\s+catalog_id\s*=\s*catalog_id/i);
    expect(migration).not.toMatch(/where\s+catalog_id\s*=\s*v_catalog_id/i);
  });

  it('keeps the existing V4 engine contract while selecting up to two unseen items', () => {
    expect(migration).toContain('start_guided_learning_session_v4');
    expect(migration).toContain('get_guided_learning_step_v4');
    expect(migration).toContain('submit_guided_learning_step_v4');
    expect(migration).toContain('limit 2');
    expect(migration).toContain('private.append_guided_v4_next_step');
    expect(migration).toContain("planner_version='V4'");
  });
});
