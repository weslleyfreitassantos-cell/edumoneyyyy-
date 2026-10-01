import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('./20260910000100_timetable_integrity_guards.sql', import.meta.url),
  'utf8',
);

describe('timetable integrity guards migration', () => {
  it('serializes each timetable resource with a transaction-scoped advisory lock', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain("'timetable:', p_resource_type, ':'");
    expect(migration).toContain("private.lock_timetable_resource('room', new.room_id)");
    expect(migration).toContain("private.lock_timetable_resource('teacher', v_teacher_profile_id)");
    expect(migration).toContain("private.lock_timetable_resource('class', v_class_id)");
  });

  it('keeps strict time and overlapping-term semantics for all resources', () => {
    expect(migration).toContain('entry.start_time < new.end_time');
    expect(migration).toContain('new.start_time < entry.end_time');
    expect(migration).toContain('private.timetable_terms_overlap(entry.subject_offering_id, new.subject_offering_id)');
    expect(migration).toContain('entry.institution_id = new.institution_id');
  });

  it('revalidates related tenant records and keeps invalid ranges delegated to the existing check', () => {
    expect(migration).toContain('v_subject_institution_id');
    expect(migration).toContain('v_term_institution_id');
    expect(migration).toContain('Timetable entry teacher must have a teacher membership');
    expect(migration).not.toContain('timetable_entries_time_range_check');
  });
});
