import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260928000100_adaptive_learning_engine_v1.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning engine v1 migration', () => {
  it('adds a global curriculum catalog without replacing institutional learning skills', () => {
    expect(migration).toContain('create table public.learning_curriculum_catalogs');
    expect(migration).toContain('create table public.learning_curriculum_skills');
    expect(migration).toContain('create table public.learning_skill_canonical_links');
    expect(migration).toContain('create table public.learning_curriculum_subject_links');
    expect(migration).toContain('create table public.learning_curriculum_grade_targets');
    expect(migration).toContain('references public.learning_skills(id)');
    expect(migration).not.toContain('drop table public.learning_skills');
  });

  it('protects the prerequisite graph from self references and cycles', () => {
    expect(migration).toContain('learning_skill_prerequisites_not_self');
    expect(migration).toContain('private.prevent_learning_skill_cycle');
    expect(migration).toContain('with recursive reachable(skill_id)');
    expect(migration).toContain('LEARNING_SKILL_PREREQUISITE_CYCLE');
    expect(migration).toContain('after insert or update on public.learning_skill_prerequisites');
  });

  it('keeps append-only attempt history and evidence separate from the legacy summary', () => {
    expect(migration).toContain('create table public.learning_attempt_runs');
    expect(migration).toContain('create table public.learning_attempt_run_answers');
    expect(migration).toContain('create table public.learning_skill_evidence');
    expect(migration).toContain('insert into public.learning_attempt_runs');
    expect(migration).toContain('insert into public.learning_skill_evidence');
    expect(migration).toContain('on conflict (activity_id, student_id) do update');
    expect(migration).not.toMatch(/delete from public\.learning_attempt_runs/i);
    expect(migration).not.toMatch(/delete from public\.learning_skill_evidence/i);
  });

  it('materializes cautious learner state with explicit thresholds', () => {
    expect(migration).toContain('create table public.learning_student_skill_state');
    expect(migration).toContain("when evidence_total = 1 then 'INTRODUCED'");
    expect(migration).toContain("when evidence_total >= 3 and evidence_average >= 80 then 'MASTERED'");
    expect(migration).toContain("when evidence_total >= 2 and evidence_average < 60 then 'NEEDS_REVIEW'");
  });

  it('keeps pre-submit answer and solution data out of the student RPC', () => {
    expect(migration).toContain('create or replace function public.list_student_learning_activities');
    const studentRpc = migration.slice(migration.indexOf('create or replace function public.list_student_learning_activities'));
    expect(studentRpc).not.toContain("'correct_answer_json'");
    expect(studentRpc).not.toContain("'explanation'");
  });

  it('defines tenant and role-scoped read policies for learner state', () => {
    expect(migration).toContain('private.learning_student_owns_state');
    expect(migration).toContain('private.learning_teacher_can_access_student');
    expect(migration).toContain('learning_student_skill_state_select');
    expect(migration).toContain('learning_skill_evidence_select');
    expect(migration).toContain('public.can_manage_institution_operations(institution_id)');
    expect(migration).toContain('get_teacher_adaptive_insights');
  });

  it('uses the canonical lowercase enrollment status and subject-scoped teacher access', () => {
    expect(migration).toContain("enrollment.status = 'active'");
    expect(migration).not.toContain("enrollment.status = 'ACTIVE'");
    expect(migration).toContain('offering.subject_id = learning_unit.subject_id');
    expect(migration).toContain('learning_teacher_can_access_activity');
  });

  it('keeps the student target curricular and explicit', () => {
    expect(migration).toContain('learning_curriculum_subject_links');
    expect(migration).toContain('learning_curriculum_grade_targets');
    expect(migration).toContain('learning_curriculum_grade_targets_lookup_idx');
  });
});
