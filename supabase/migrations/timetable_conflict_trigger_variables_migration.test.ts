import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '20260901000200_fix_timetable_conflict_trigger_variables.sql'),
  'utf8',
);

describe('timetable conflict trigger variable migration', () => {
  it('uses distinct local variable names for teacher and class conflicts', () => {
    expect(migration).toContain('v_teacher_profile_id uuid');
    expect(migration).toContain('v_class_id uuid');
    expect(migration).not.toMatch(/declare\s+teacher_profile_id\s+uuid/i);
    expect(migration).not.toMatch(/declare\s+class_id\s+uuid/i);
    expect(migration).toContain('offering.teacher_profile_id = v_teacher_profile_id');
    expect(migration).toContain('offering.class_id = v_class_id');
  });

  it('keeps conflict checks scoped to overlapping academic periods', () => {
    expect(migration).toContain(
      'private.timetable_terms_overlap(entry.subject_offering_id, new.subject_offering_id)',
    );
  });

  it('does not grant trigger execution to client roles', () => {
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to service_role');
  });
});
