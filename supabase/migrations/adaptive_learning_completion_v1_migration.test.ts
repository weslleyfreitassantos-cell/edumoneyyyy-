import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260930000100_adaptive_learning_completion_v1.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning completion v1 migration', () => {
  it('keeps teacher roster and detail tenant-scoped', () => {
    expect(migration).toContain('learning_teacher_can_access_student_any');
    expect(migration).toContain('list_teacher_learning_students');
    expect(migration).toContain('get_teacher_learning_student_detail');
    expect(migration).toContain('LEARNING_TEACHER_STUDENT_SCOPE_DENIED');
    expect(migration).toContain("membership.role = 'TEACHER'::public.user_role");
  });

  it('does not expose an error answer before submit', () => {
    const reviewRpc = migration.slice(migration.indexOf('get_learning_error_review'));
    const submitRpc = reviewRpc.indexOf('submit_learning_error_review');
    expect(reviewRpc.slice(0, submitRpc)).not.toContain('correct_answer');
    expect(reviewRpc.slice(0, submitRpc)).not.toContain('explanation');
    expect(migration).toContain('submit_learning_error_review');
  });

  it('persists simulation result breakdowns and retains idempotent completion', () => {
    expect(migration).toContain('area_breakdown = v_area_breakdown');
    expect(migration).toContain('skill_breakdown = v_skill_breakdown');
    expect(migration).toContain("if attempt_row.status = 'COMPLETED' then");
    expect(migration).toContain("'area_breakdown', attempt_row.area_breakdown");
  });
});
