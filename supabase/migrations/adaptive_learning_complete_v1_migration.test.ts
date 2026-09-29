import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260929000100_adaptive_learning_complete_v1.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning complete v1 migration', () => {
  it('materializes the connected learner journey', () => {
    for (const table of [
      'learning_guided_sessions',
      'learning_guided_steps',
      'learning_skill_lessons',
      'learning_daily_plans',
      'learning_daily_plan_items',
      'learning_error_notebook',
      'learning_skill_reviews',
      'learning_student_gamification',
    ]) {
      expect(migration).toContain(`create table public.${table}`);
    }
    expect(migration).toContain('start_guided_learning_session');
    expect(migration).toContain('complete_guided_learning_step');
    expect(migration).toContain('create_or_get_learning_daily_plan');
    expect(migration).toContain("'RETURN_TO_TARGET'");
  });

  it('supports reusable questions, packages, simulations and provenance', () => {
    expect(migration).toContain('create table public.learning_question_bank');
    expect(migration).toContain('create table public.learning_question_bank_skill_links');
    expect(migration).toContain('create table public.learning_packages');
    expect(migration).toContain('assign_learning_package');
    expect(migration).toContain('learning_package_assignment_class_unique_idx');
    expect(migration).toContain('create table public.learning_simulations');
    expect(migration).toContain("'ENEM'");
    expect(migration).toContain('source_reference');
    expect(migration).toContain('provenance');
    expect(migration).toContain('question_bank_id');
    expect(migration).toContain("'SIMULATION'");
  });

  it('keeps answer and feedback boundaries explicit', () => {
    expect(migration).toContain('submit_learning_attempt_with_feedback');
    expect(migration).toContain('grant execute on function public.submit_learning_attempt_with_feedback');
    expect(migration).toContain('create or replace function public.create_learning_activity_with_questions');
    expect(migration).toContain('learning_question_skill_links');
  });

  it('protects retry boundaries with unique active session, plan and simulation keys', () => {
    expect(migration).toContain('learning_guided_sessions_one_active_idx');
    expect(migration).toContain('unique (institution_id, student_id, plan_date)');
    expect(migration).toContain('learning_simulation_one_open_attempt_idx');
    expect(migration).toContain('unique (student_id, event_key)');
  });

  it('does not expose raw answer keys through the student activity RPC', () => {
    const studentRpc = migration.slice(migration.indexOf('create or replace function public.list_student_learning_activities'));
    const nextFunction = studentRpc.indexOf('create or replace function public.get_teacher_adaptive_insights');
    expect(studentRpc.slice(0, nextFunction)).not.toContain("'correct_answer_json'");
    expect(studentRpc.slice(0, nextFunction)).not.toContain("'explanation'");
  });

  it('applies RLS to every tenant-owned extension', () => {
    for (const table of [
      'learning_guided_sessions',
      'learning_guided_steps',
      'learning_daily_plans',
      'learning_error_notebook',
      'learning_student_gamification',
      'learning_simulation_attempts',
      'learning_package_assignments',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain('private.learning_student_owns_state');
    expect(migration).toContain('public.can_manage_institution_operations');
  });
});
