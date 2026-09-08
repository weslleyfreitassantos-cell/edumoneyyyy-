import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260828000300_school_schedule_breaks.sql',
  ),
  'utf8',
);

describe('school schedule breaks migration', () => {
  it('creates an institution-scoped shift break configuration', () => {
    expect(migration).toContain('create table if not exists public.school_schedule_breaks');
    expect(migration).toContain('school_schedule_breaks_supported_shift');
    expect(migration).toContain('school_schedule_breaks_time_range');
  });

  it('replaces a shift configuration transactionally and validates overlaps', () => {
    expect(migration).toContain('public.replace_school_schedule_breaks');
    expect(migration).toContain('SCHOOL_SCHEDULE_BREAKS_OVERLAP');
    expect(migration).toContain('public.is_institution_admin(p_institution_id)');
  });

  it('protects published timetable entries from lunch and recess windows', () => {
    expect(migration).toContain('TIMETABLE_ENTRY_DURING_SCHEDULE_BREAK');
    expect(migration).toContain('timetable_entries_validate_schedule_break');
  });
});
