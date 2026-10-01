import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260924000400_attendance_rls_direct_membership_path.sql',
  ),
  'utf8',
).replace(/\r\n/g, '\n');

describe('attendance RLS direct membership path migration', () => {
  it('uses direct indexed identity, membership, session, and record joins', () => {
    expect(migrationSql).toContain('join public.memberships as membership');
    expect(migrationSql).toContain('join public.attendance_records as attendance_record');
    expect(migrationSql).toContain('join public.attendance_sessions as attendance_session');
    expect(migrationSql).toContain('student.profile_id = (select auth.uid())');
    expect(migrationSql).toContain('guardianship.guardian_profile_id = (select auth.uid())');
    expect(migrationSql).not.toContain(
      'private.can_student_view_attendance(\n          attendance_record.student_id',
    );
    expect(migrationSql).not.toContain(
      'private.can_guardian_view_attendance(\n          attendance_record.student_id',
    );
  });

  it('uses explicit CASE role gates so opposite-role helpers are not evaluated', () => {
    expect(migrationSql.match(/case\n\s+when \(select private\.current_profile_has_role/g)).toHaveLength(4);
    expect(migrationSql).toContain("'STUDENT'::public.user_role");
    expect(migrationSql).toContain("'GUARDIAN'::public.user_role");
    expect(migrationSql).toContain(
      'drop policy if exists attendance_sessions_select_policy',
    );
    expect(migrationSql).toContain(
      'drop policy if exists attendance_records_select_policy',
    );
  });

  it('preserves active, tenant, enrollment, guardianship, and CLOSED checks', () => {
    expect(migrationSql).toContain('private.is_current_profile_active()');
    expect(migrationSql).toContain('public.is_institution_operational(target_institution_id)');
    expect(migrationSql).toContain('membership.institution_id = student.institution_id');
    expect(migrationSql).toContain("membership.role = 'STUDENT'::public.user_role");
    expect(migrationSql).toContain('student.institution_id = target_institution_id');
    expect(migrationSql).toContain('student.active is true');
    expect(migrationSql).toContain('guardianship.active is true');
    expect(migrationSql).toContain("array['GUARDIAN'::public.user_role]");
    expect(migrationSql).toContain("attendance_session.status = 'CLOSED'");
    expect(migrationSql).not.toContain('disable row level security');
  });

  it('keeps all replacement helpers security-definer and search-path locked', () => {
    expect(migrationSql.match(/security definer/g)).toHaveLength(4);
    expect(migrationSql.match(/set search_path = ''/g)).toHaveLength(4);
    expect(migrationSql.match(/alter function private\./g)).toHaveLength(4);
    expect(migrationSql).toContain("notify pgrst, 'reload schema'");
  });
});
