import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260924000200_attendance_rls_role_short_circuit.sql',
  ),
  'utf8',
).replace(/\r\n/g, '\n');

describe('attendance RLS role short-circuit migration', () => {
  it('short-circuits the opposite role before correlated record scans', () => {
    for (const role of ['STUDENT', 'GUARDIAN']) {
      expect(migrationSql).toContain(
        `array['${role}'::public.user_role]`,
      );
    }

    expect(migrationSql.match(/when not private\.has_exact_institution_role/g)).toHaveLength(4);
    expect(migrationSql).toContain('select case');
    expect(migrationSql).toContain('from public.attendance_records as attendance_record');
  });

  it('keeps security-definer helpers locked down and tenant-scoped', () => {
    for (const signature of [
      'private.can_student_view_attendance(uuid, uuid, uuid)',
      'private.can_student_view_attendance_session(uuid, uuid)',
      'private.can_guardian_view_attendance(uuid, uuid, uuid)',
      'private.can_guardian_view_attendance_session(uuid, uuid)',
    ]) {
      expect(migrationSql).toContain(`alter function ${signature}`);
      expect(migrationSql).toContain(
        `revoke all on function ${signature}`,
      );
      expect(migrationSql).toContain(
        `grant execute on function ${signature}`,
      );
    }

    expect(migrationSql.match(/set search_path = ''/g)).toHaveLength(4);
    expect(migrationSql).toContain('guardianship.guardian_profile_id = auth.uid()');
    expect(migrationSql).toContain('student.institution_id = target_institution_id');
    expect(migrationSql).toMatch(
      /attendance_record\.institution_id\s*=\s*target_institution_id/,
    );
    expect(migrationSql).not.toContain('disable row level security');
  });
});
