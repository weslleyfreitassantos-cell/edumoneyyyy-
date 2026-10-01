import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('./20260913000100_academic_recovery.sql', import.meta.url),
  'utf8',
);

describe('academic recovery migration', () => {
  it('keeps one auditable recovery per student, offering and term', () => {
    expect(migration).toContain('create table public.student_term_recoveries');
    expect(migration).toContain('student_term_recoveries_student_offering_term_unique');
    expect(migration).toContain("'DRAFT', 'PUBLISHED', 'CANCELED'");
    expect(migration).toContain("composition_rule text not null default 'HIGHEST_SCORE_V1'");
  });

  it('extends the existing official snapshot without creating a parallel result table', () => {
    expect(migration).toContain('alter table public.student_term_results');
    expect(migration).toContain('recovery_percentage');
    expect(migration).toContain('final_grade_percentage');
    expect(migration).toContain('original_result_status');
    expect(migration).not.toContain('create table public.final_results');
    expect(migration).not.toContain('create table public.recovery_final_results');
  });

  it('protects closed periods and applies published recovery at finalization', () => {
    expect(migration).toContain('prevent_invalid_academic_recovery_change');
    expect(migration).toContain("closure.status = 'REOPENED'");
    expect(migration).toContain('apply_published_academic_recovery');
    expect(migration).toContain("recovery.status = 'PUBLISHED'");
    expect(migration).toContain("'HIGHEST_SCORE_V1'");
    expect(migration).toContain("coalesce(result.original_result_status, result.result_status)");
    expect(migration).toContain("'FAILED_BY_GRADE', 'FAILED_BY_GRADE_AND_ATTENDANCE'");
  });

  it('forces RPC-only mutations for authenticated users', () => {
    expect(migration).toContain('revoke all on table public.student_term_recoveries from anon, authenticated');
    expect(migration).toContain('grant select on table public.student_term_recoveries to authenticated');
    expect(migration).not.toContain('grant select, insert, update on table public.student_term_recoveries to authenticated');
    expect(migration).toContain('drop policy if exists student_term_recoveries_insert_policy');
    expect(migration).toContain('drop policy if exists student_term_recoveries_update_policy');
    expect(migration).toContain('drop policy if exists student_term_recoveries_delete_policy');
  });

  it('keeps operational roles and audiences tenant-scoped', () => {
    expect(migration).toContain('private.is_teacher_for_offering');
    expect(migration).toContain('private.is_student_owner');
    expect(migration).toContain('public.can_manage_institution_operations');
    expect(migration).toContain('alter table public.student_term_recoveries enable row level security');
    expect(migration).toContain('grant execute on function public.save_academic_recovery');
  });
});
