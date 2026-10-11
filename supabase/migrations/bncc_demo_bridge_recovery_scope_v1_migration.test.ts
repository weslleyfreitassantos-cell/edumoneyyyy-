import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261011000150_bncc_demo_bridge_recovery_scope_v1.sql', import.meta.url),
  'utf8',
);

describe('BNCC demo bridge recovery scope migration', () => {
  it('limits the migration-only scope exception to the exact allowlisted paused V4 recovery', () => {
    expect(migration).toContain("session_user = 'postgres'");
    expect(migration).toContain("session_row.id = '5f74e2d4-04e8-42e3-996f-ed39dc91fdac'::uuid");
    expect(migration).toContain("session_row.institution_id = '1663123e-5046-41c5-a7db-f712da058536'::uuid");
    expect(migration).toContain("session_row.status = 'PAUSED'");
    expect(migration).toContain("session_row.decision_reason = 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'");
    expect(migration).toContain("new.step_type = 'RETURN_TO_TARGET'");
    expect(migration).toContain('new.purpose is null');
    expect(migration).toContain("new.metadata->>'bridge_limit_recovery' = 'true'");
    expect(migration).toContain("new.metadata->>'mastery_unproven' = 'true'");
    expect(migration).toContain("new.metadata->>'reason' = 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'");
    expect(migration).toContain('private.bncc_demo_preview_allowed(session_row.institution_id, session_row.student_id)');
    expect(migration).toContain('session_row.original_target_canonical_skill_id');
    expect(migration).toContain("journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'");
  });

  it('retains the normal student scope, grade, and discipline guards for every other step', () => {
    expect(migration).toContain('private.learning_v2_scope_student(session_row.institution_id, session_row.student_id)');
    expect(migration).toContain('private.assert_bncc_discipline_journey_v9(');
    expect(migration).toContain('LEARNING_V9_STEP_SKILL_OUT_OF_DISCIPLINE');
    expect(migration).toContain('private.normalize_learning_grade_context(class.grade_level)');
    expect(migration).toContain("journey.publication_status = 'DEMO_PREVIEW'");
    expect(migration).toContain("journey.mapping_status = 'MAPPING_PENDING'");
  });
});
