import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260819000100_academic_authenticated_table_grants.sql', import.meta.url),
  'utf8',
);

describe('academic authenticated table grants migration', () => {
  it('declares only the direct frontend operations for authenticated', () => {
    expect(migration).toContain(
      'grant select, insert, update on table public.class_curriculum_items',
    );
    expect(migration).toContain(
      'grant select, insert, update on table public.teacher_subjects',
    );
    expect(migration).toContain(
      'grant select, insert, update on table public.teacher_availability',
    );
    expect(migration).toContain(
      'grant select, insert, update on table public.school_time_slots',
    );
    expect(migration).toContain(
      'grant select, insert on table public.curriculum_templates',
    );
    expect(migration).toContain(
      'grant insert on table public.curriculum_template_items',
    );
    expect(migration).toContain(
      'grant select, insert on table public.timetable_versions',
    );
    expect(migration).toContain(
      'grant select, insert, update on table public.timetable_version_entries',
    );
  });

  it('does not grant anon access or broad table privileges', () => {
    expect(migration).toContain('from anon');
    expect(migration).not.toMatch(/grant\s+all\s+on\s+table/i);
    expect(migration).not.toMatch(/to\s+anon/i);
  });
});
