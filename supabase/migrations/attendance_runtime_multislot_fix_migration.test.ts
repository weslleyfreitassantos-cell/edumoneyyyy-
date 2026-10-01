import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260911000200_attendance_runtime_multislot_fix.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');
const historicalAttendanceMigration = readFileSync(
  new URL('./20260710000200_attendance_and_grades.sql', import.meta.url),
  'utf8',
);

describe('attendance runtime multi-slot fix migration', () => {
  it('concede UUID default apenas a authenticated', () => {
    expect(migration).toContain(
      'grant execute on function public.uuid_generate_v4()\n  to authenticated;',
    );
    expect(migration).not.toMatch(/to\s+anon/i);
  });

  it('remove o índice antigo por oferta/data', () => {
    expect(migration).toContain(
      'drop index if exists public.attendance_sessions_offering_date_active_unique_idx;',
    );
  });

  it('preserva a unicidade histórica por oferta, data e início', () => {
    expect(historicalAttendanceMigration).toMatch(
      /constraint attendance_sessions_slot_unique[\s\S]*?unique\s*\(\s*subject_offering_id,\s*session_date,\s*starts_at\s*\)/i,
    );
    expect(migration).not.toContain('create unique index');
  });
});
