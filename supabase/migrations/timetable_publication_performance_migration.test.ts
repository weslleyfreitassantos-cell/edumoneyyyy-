import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '20260901000300_optimize_timetable_publication.sql'),
  'utf8',
);

describe('timetable publication performance migration', () => {
  it('adds indexes for draft and published timetable reads', () => {
    expect(migration).toContain('timetable_version_entries_publish_scope_idx');
    expect(migration).toContain('timetable_entries_active_institution_time_idx');
  });

  it('publishes entries in one set-based insert', () => {
    expect(migration).toContain('get diagnostics published_count = row_count');
    expect(migration).not.toContain('for entry_row in');
  });

  it('keeps class, teacher and room conflicts validated', () => {
    expect(migration).toContain('right_entry.class_id = left_entry.class_id');
    expect(migration).toContain('right_offering.teacher_profile_id = left_offering.teacher_profile_id');
    expect(migration).toContain('right_entry.room_id = left_entry.room_id');
    expect(migration).toContain("raise exception 'TIMETABLE_VERSION_CONFLICT'");
  });

  it('allows this admin operation more time without changing the global timeout', () => {
    expect(migration).toContain("set statement_timeout = '60s'");
  });
});
