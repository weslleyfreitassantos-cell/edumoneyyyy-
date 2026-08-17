import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const foundation = readFileSync(new URL('./20260817000100_academic_automation_foundation.sql', import.meta.url), 'utf8');
const copy = readFileSync(new URL('./20260817000200_academic_year_copy_rpc.sql', import.meta.url), 'utf8');
const publication = readFileSync(new URL('./20260817000300_timetable_publication_validation.sql', import.meta.url), 'utf8');

describe('academic automation migrations', () => {
  it('adds only new automation tables and preserves existing academic tables', () => {
    expect(foundation).toContain('create table if not exists public.teacher_subjects');
    expect(foundation).toContain('create table if not exists public.teacher_availability');
    expect(foundation).toContain('create table if not exists public.school_time_slots');
    expect(foundation).toContain('create table if not exists public.curriculum_templates');
    expect(foundation).toContain('create table if not exists public.timetable_versions');
    expect(foundation).toContain('insert into public.teacher_subjects');
    expect(foundation).toContain('timetable_terms_overlap');
  });

  it('uses tenant helpers and RLS for every new surface', () => {
    expect(foundation).toContain('alter table public.teacher_subjects enable row level security');
    expect(foundation).toContain('alter table public.timetable_version_entries enable row level security');
    expect(foundation).toContain('public.can_access_institution(institution_id)');
    expect(foundation).toContain('public.can_manage_institution_operations(institution_id)');
    expect(foundation).toContain('set search_path = \'\'');
  });

  it('copies structure without students and validates publication server-side', () => {
    expect(copy).toContain('copy_academic_year_structure');
    expect(copy).toContain('class_curriculum_items');
    expect(copy).not.toContain('insert into public.enrollments');
    expect(publication).toContain('TEACHER_SUBJECT_NOT_AUTHORIZED');
    expect(publication).toContain('TEACHER_NOT_AVAILABLE');
    expect(publication).toContain('WEEKLY_LESSONS_MISMATCH');
    expect(publication).toContain('TIMETABLE_VERSION_CONFLICT');
    expect(publication).toContain('ARCHIVED');
  });
});
