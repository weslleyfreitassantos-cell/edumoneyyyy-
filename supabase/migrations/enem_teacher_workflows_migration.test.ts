import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationSql = readFileSync(
  resolve(__dirname, '20261003000800_enem_teacher_workflows_v1.sql'),
  'utf8',
);

describe('ENEM teacher workflows migration', () => {
  it('creates scoped simulation assignments and derived result RPCs', () => {
    expect(migrationSql).toContain('create table if not exists public.learning_simulation_assignments');
    expect(migrationSql).toContain('learning_simulation_assignment_target_check');
    expect(migrationSql).toContain('assign_learning_simulation');
    expect(migrationSql).toContain('list_student_learning_simulation_assignments');
    expect(migrationSql).toContain('list_teacher_learning_simulation_assignments');
    expect(migrationSql).toContain('get_teacher_learning_simulation_results');
    expect(migrationSql).toContain("'completion_rate'");
    expect(migrationSql).toContain("'area_breakdown'");
    expect(migrationSql).toContain("'skill_breakdown'");
  });

  it('keeps assignment authorization inside the institution and teacher class scope', () => {
    expect(migrationSql).toContain('LEARNING_SIMULATION_ASSIGNMENT_SCOPE_DENIED');
    expect(migrationSql).toContain('offering.teacher_profile_id = auth.uid()');
    expect(migrationSql).toContain('assignment.institution_id = p_institution_id');
    expect(migrationSql).toContain('learning_simulation_assignments_select');
  });

  it('provides a review queue without allowing source-field mutation', () => {
    expect(migrationSql).toContain('create table if not exists public.learning_pedagogical_reviews');
    expect(migrationSql).toContain('learning_pedagogical_review_audits');
    expect(migrationSql).toContain('list_teacher_learning_pedagogical_reviews');
    expect(migrationSql).toContain('review_teacher_learning_item');
    expect(migrationSql).toContain('question.statement');
    expect(migrationSql).toContain('question.correct_answer');
    expect(migrationSql).toContain('before_json');
    expect(migrationSql).toContain('after_json');
    expect(migrationSql).toContain('revoke all on table public.learning_pedagogical_reviews, public.learning_pedagogical_review_audits from authenticated');
  });
});
