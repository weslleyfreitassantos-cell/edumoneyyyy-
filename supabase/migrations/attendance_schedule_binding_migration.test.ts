import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260907170000_attendance_schedule_binding.sql',
  ),
  'utf8',
);

describe('attendance schedule binding migration', () => {
  it('validates the weekday and exact published timetable interval', () => {
    expect(migration).toContain(
      'extract(isodow from new.session_date)::smallint',
    );
    expect(migration).toContain(
      'timetable_entry.day_of_week = expected_day',
    );
    expect(migration).toContain(
      'timetable_entry.start_time = new.starts_at',
    );
    expect(migration).toContain(
      'timetable_entry.end_time = new.ends_at',
    );
    expect(migration).toContain(
      "timetable_entry.active is true",
    );
  });

  it('keeps legacy sessions without schedule data readable', () => {
    expect(migration).toContain(
      'old.starts_at is null',
    );
    expect(migration).toContain(
      'old.ends_at is null',
    );
  });
});
