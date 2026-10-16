import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261013003800_teacher_learning_guided_performance.sql'),
  'utf8',
);

describe('teacher guided performance migration', () => {
  it('leaves the roster mastery null unless the student has recorded evidence', () => {
    expect(migration).toContain('round(avg(state_row.mastery_estimate)) as average_mastery');
    expect(migration).toContain('state_row.evidence_count > 0');
    expect(migration).toContain('cross join lateral');
    expect(migration).not.toContain('coalesce(round(avg(state_row.mastery_estimate)), 0)');
    expect(migration).toContain('private.learning_teacher_can_access_subject_scope');
    expect(migration).toContain('offering.teacher_profile_id = auth.uid()');
  });

  it('includes guided submissions only within the authorized institution, student and subject scope', () => {
    expect(migration).toContain('create or replace function public.get_teacher_guided_learning_attempts');
    expect(migration).toContain("raise exception 'LEARNING_TEACHER_SUBJECT_SCOPE_DENIED'");
    expect(migration).toContain('attempt.institution_id = p_institution_id');
    expect(migration).toContain('attempt.student_id = p_student_id');
    expect(migration).toContain('session.class_id = p_class_id');
    expect(migration).toContain("create or replace function public.get_teacher_learning_student_detail(");
    expect(migration).toContain('revoke all on function public.get_teacher_learning_student_detail(uuid, uuid, uuid, uuid) from public, anon');
    expect(migration).toContain('grant execute on function public.get_teacher_learning_student_detail(uuid, uuid, uuid, uuid) to authenticated');
    expect(migration).toContain('private.learning_teacher_skill_in_subject');
    expect(migration).toContain('join public.learning_guided_steps step');
    expect(migration).toContain('revoke all on function public.get_teacher_guided_learning_attempts(uuid, uuid, uuid, uuid) from public, anon');
    expect(migration).toContain('grant execute on function public.get_teacher_guided_learning_attempts(uuid, uuid, uuid, uuid) to authenticated');
  });
});
