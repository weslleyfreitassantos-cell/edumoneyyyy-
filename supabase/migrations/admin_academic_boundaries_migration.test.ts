import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('./20260911000500_admin_academic_boundaries.sql', import.meta.url),
  'utf8',
);

function functionBlock(start: string, end: string): string {
  const startIndex = migration.indexOf(start);
  const endIndex = migration.indexOf(end, startIndex + start.length);
  return migration.slice(startIndex, endIndex < 0 ? undefined : endIndex);
}

describe('admin academic boundaries migration', () => {
  it('keeps ADMIN commercial ownership separate from academic management', () => {
    const institutionAdmin = functionBlock(
      'create or replace function public.is_institution_admin(',
      '-- This helper is only referenced by academic/operational school policies',
    );

    expect(institutionAdmin).toContain("'DIRECTOR'::public.user_role");
    expect(institutionAdmin).toContain("'SECRETARY'::public.user_role");
    expect(institutionAdmin).not.toContain('public.owns_institution(');
    expect(migration).toContain('select public.is_institution_admin(target_institution_id);');
  });

  it('defines an exact operational-role academic helper', () => {
    const academicHelper = functionBlock(
      'create or replace function private.can_access_academic_institution(',
      'alter function public.is_institution_admin(uuid) owner to postgres;',
    );

    expect(academicHelper).toContain("'DIRECTOR'::public.user_role");
    expect(academicHelper).toContain("'SECRETARY'::public.user_role");
    expect(academicHelper).toContain("'TEACHER'::public.user_role");
    expect(academicHelper).toContain("'STUDENT'::public.user_role");
    expect(academicHelper).toContain("'GUARDIAN'::public.user_role");
    expect(migration).toContain('grant execute on function private.can_access_academic_institution(uuid)');
    expect(migration).toContain('to authenticated, service_role');
  });

  it('rebuilds the affected academic policies without broad grants', () => {
    for (const policy of [
      'profiles_select_policy',
      'memberships_select_policy',
      'academic_years_select_policy',
      'classes_select_policy',
      'subject_offerings_select_policy',
      'timetable_entries_select_policy',
      'academic_calendar_events_staff_select',
    ]) {
      expect(migration).toContain(`create policy ${policy}`);
    }

    expect(migration).not.toMatch(/grant\s+all\s+on\s+table/i);
    expect(migration).not.toMatch(/grant\s+.*\s+to\s+anon/i);
  });
});
