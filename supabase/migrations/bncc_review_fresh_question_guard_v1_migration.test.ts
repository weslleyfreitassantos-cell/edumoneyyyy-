import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261011000400_bncc_review_fresh_question_guard_v1.sql', import.meta.url),
  'utf8',
);

describe('BNCC review fresh-question guard migration', () => {
  it('requires a complete two-question set unseen by the student for this skill', () => {
    expect(migration).toContain('private.pick_guided_v4_fresh_question_set');
    expect(migration).toContain('prior_session.student_id = target_session.student_id');
    expect(migration).toContain('prior_step.canonical_skill_id = target_skill_id');
    expect(migration).toContain("jsonb_typeof(prior_attempt.answers) = 'array'");
    expect(migration).toContain(') = 2');
    expect(migration).toContain("'fresh_questions_only', true");
  });

  it('preserves history and routes exhausted pools to teacher support', () => {
    expect(migration).toContain("'REMEDIATION_QUESTION_POOL_EXHAUSTED'");
    expect(migration).toContain("status = 'NEEDS_TEACHER_SUPPORT'");
    expect(migration).toContain("status = 'SKIPPED'");
    expect(migration).toContain('current_attempt.step_id = current_step.id');
    expect(migration.toLowerCase()).not.toContain('delete from public.learning_guided_step_attempts');
    expect(migration.toLowerCase()).not.toContain('truncate ');
  });
});
