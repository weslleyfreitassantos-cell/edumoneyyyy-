import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260930000200_adaptive_learning_hardening_v1.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning hardening v1 migration', () => {
  it('keeps bank provenance when teachers build or edit an activity', () => {
    expect(migration).toContain('question_bank_id uuid');
    expect(migration).toContain('private.add_learning_activity_question');
    expect(migration).toContain('update_learning_activity_with_questions');
    expect(migration).toContain('learning_question_bank_skill_links');
  });

  it('supports explicit diagnostic and lock-in activity kinds', () => {
    expect(migration).toContain("'DIAGNOSTIC', 'LOCK_IN'");
    expect(migration).toContain('learning_activities_activity_type_check');
    expect(migration).toContain("activity.activity_type = 'DIAGNOSTIC'");
    expect(migration).toContain("activity.activity_type = 'LOCK_IN'");
  });

  it('keeps teacher activity creation inside the subject and curriculum tenant scope', () => {
    expect(migration).toContain('private.learning_teacher_owns_subject');
    expect(migration).toContain('LEARNING_ACTIVITY_UNIT_SCOPE_DENIED');
    expect(migration).toContain('LEARNING_ACTIVITY_SKILL_SCOPE_DENIED');
  });

  it('completes plan items and spaced reviews transactionally', () => {
    expect(migration).toContain('complete_learning_daily_plan_item');
    expect(migration).toContain('complete_learning_skill_review');
    expect(migration).toContain("'REVIEW'");
    expect(migration).toContain("'next_interval_days'");
  });

  it('exposes class-level learning gaps without widening teacher scope', () => {
    expect(migration).toContain('get_teacher_learning_class_gaps');
    expect(migration).toContain('learning_teacher_can_access_student_any');
    expect(migration).toContain("enrollment.status = 'active'");
  });

  it('uses a stable attempt reward key for retry safety', () => {
    expect(migration).toContain("'attempt:' || new.id::text");
    expect(migration).toContain("event.event_key like 'attempt:' || new.id::text || '%'");
  });
});
