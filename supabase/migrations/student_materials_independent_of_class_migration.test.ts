import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261104000100_student_materials_independent_of_class.sql'),
  'utf8',
);

describe('institution-published student materials', () => {
  it('discovers subjects from active class offerings or published material', () => {
    const subjectRpc = migration.slice(
      migration.indexOf('create or replace function public.list_student_learning_subjects'),
      migration.indexOf('create or replace function public.list_student_learning_activities'),
    );
    expect(subjectRpc).toContain("activity.status = 'PUBLISHED'");
    expect(subjectRpc).toContain('public.subject_offerings');
    expect(subjectRpc).toContain('student.profile_id = auth.uid()');
    expect(subjectRpc).toContain('student.institution_id = p_institution_id');
  });

  it('serves published activities to active students of the same institution without class assignments', () => {
    const activitiesRpc = migration.slice(
      migration.indexOf('create or replace function public.list_student_learning_activities'),
      migration.indexOf('revoke all on function public.list_student_learning_subjects'),
    );
    expect(activitiesRpc).toContain("activity.status = 'PUBLISHED'");
    expect(activitiesRpc).toContain('student.profile_id = auth.uid()');
    expect(activitiesRpc).toContain('student.institution_id = p_institution_id');
    expect(activitiesRpc).not.toContain('learning_assignments');
    expect(activitiesRpc).not.toContain('public.enrollments');
    expect(activitiesRpc).not.toContain("'correct_answer_json'");
    expect(activitiesRpc).not.toContain("'explanation'");
  });

  it('grants the two catalog RPCs only to authenticated users', () => {
    expect(migration).toContain('revoke all on function public.list_student_learning_subjects(uuid) from public, anon;');
    expect(migration).toContain('revoke all on function public.list_student_learning_activities(uuid) from public, anon;');
    expect(migration).toContain('grant execute on function public.list_student_learning_subjects(uuid) to authenticated;');
    expect(migration).toContain('grant execute on function public.list_student_learning_activities(uuid) to authenticated;');
  });
});
