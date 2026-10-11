import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261011000300_bncc_review_failure_remediation_v1.sql', import.meta.url),
  'utf8',
);

describe('BNCC review failure remediation migration', () => {
  it('reopens the original skill lesson after an incorrect review without claiming mastery', () => {
    expect(migration).toContain("completed_step.step_type = 'REVIEW' and outcome = 'GAP'");
    expect(migration).toContain('lesson.canonical_skill_id = session_row.original_target_canonical_skill_id');
    expect(migration).toContain("nullif(btrim(lesson.title), '') is not null");
    expect(migration).toContain("nullif(btrim(lesson.content_markdown), '') is not null");
    expect(migration).toContain("nullif(btrim(lesson.worked_example), '') is not null");
    expect(migration).toContain("'review_remediation', true");
    expect(migration).toContain("'mastery_unproven', true");
    expect(migration).toContain("decision_reason = 'REVIEW_REMEDIATION_REQUIRED'");
    expect(migration).toContain("replan_count = coalesce(replan_count, 0) + 1");
  });

  it('routes missing content or exhausted remediation to teacher support, never successful completion', () => {
    expect(migration).toContain("status = 'NEEDS_TEACHER_SUPPORT'");
    expect(migration).toContain("'REVIEW_REMEDIATION_CONTENT_UNAVAILABLE'");
    expect(migration).toContain("'REVIEW_REMEDIATION_LIMIT_REACHED'");
    expect(migration).toContain('coalesce(session_row.replan_count, 0) < 2');
    expect(migration).toContain('LEARNING_GUIDED_REVIEW_OUTCOME_INVALID');
  });
});
