import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261006000200_director_academic_panorama_v1.sql'),
  'utf8',
);

describe('director academic panorama aggregation migration', () => {
  it('requires bounded, institution-scoped filters and manager authorization', () => {
    expect(migration).toContain('p_institution_id uuid');
    expect(migration).toContain('p_from_date date');
    expect(migration).toContain('p_to_date date');
    expect(migration).toContain('p_class_id uuid default null');
    expect(migration).toContain('p_term_id uuid default null');
    expect(migration).toContain('p_academic_year_id uuid default null');
    expect(migration).toContain('p_from_date > p_to_date');
    expect(migration).toContain('public.can_manage_institution_operations(p_institution_id)');
    expect(migration).toContain('set search_path = \'\'');
  });

  it('aggregates attendance, assessments, student situations and pending work in one response', () => {
    expect(migration).toContain('selected_attendance_records');
    expect(migration).toContain('attendance_student_totals');
    expect(migration).toContain('attendance_student_context');
    expect(migration).toContain('select distinct on (student_id)');
    expect(migration).not.toContain('min(class_id)');
    expect(migration).not.toContain('min(class_name)');
    expect(migration).toContain('assessment_results_fixed');
    expect(migration).toContain('student_performance_context');
    expect(migration).toContain('student_situation_counts');
    expect(migration).toContain('class_performance');
    expect(migration).toContain('pending_attendance');
    expect(migration).toContain('join public.timetable_entries as timetable');
    expect(migration).toContain("'attendance'");
    expect(migration).toContain("'performance'");
    expect(migration).toContain("'pending'");
    expect(migration).toContain("'PRESENT', 'LATE'");
    expect(migration).toContain("'EXCUSED'");
    expect(migration).toContain('expected_student_count');
    expect(migration).toContain('launched_count');
  });

  it('materializes pending attendance inputs before counting occurrences', () => {
    const pendingCountStart = migration.indexOf('  pending_attendance as (');
    const responseStart = migration.indexOf('  select jsonb_build_object(', pendingCountStart);
    const pendingCount = migration.slice(pendingCountStart, responseStart);

    expect(migration).toContain('pending_class_enrollments as materialized');
    expect(migration).toContain('pending_class_eligibility as materialized');
    expect(migration).toContain('pending_existing_slots as materialized');
    expect(migration).toContain('pending_blocking_events as materialized');
    expect(migration).toContain('pending_candidate_occurrences as materialized');
    expect(pendingCount).toContain('from pending_candidate_occurrences as occurrence');
    expect(pendingCount).toContain('left join pending_existing_slots as existing');
    expect(pendingCount).not.toContain('from public.enrollments as enrollment');
    expect(pendingCount).not.toContain('from public.students as student');
  });

  it('exposes the RPC only to authenticated callers and never to anonymous callers', () => {
    expect(migration).toContain('revoke all on function public.get_director_academic_panorama_v1');
    expect(migration).toContain('from public, anon');
    expect(migration).toContain('to authenticated;');
  });
});
