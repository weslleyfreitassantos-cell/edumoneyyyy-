import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260924000300_attendance_rls_policy_role_gate.sql',
  ),
  'utf8',
).replace(/\r\n/g, '\n');

describe('attendance RLS policy role gate migration', () => {
  it('evaluates student and guardian roles once per statement before row helpers', () => {
    expect(migrationSql).toContain(
      'create or replace function private.current_profile_has_role(',
    );
    expect(migrationSql).toContain(
      "(select private.current_profile_has_role(\n          'STUDENT'::public.user_role",
    );
    expect(migrationSql).toContain(
      "(select private.current_profile_has_role(\n          'GUARDIAN'::public.user_role",
    );
    expect(migrationSql).toContain(
      'drop policy if exists attendance_sessions_select_policy',
    );
    expect(migrationSql).toContain(
      'drop policy if exists attendance_records_select_policy',
    );
  });

  it('preserves tenant and role authorization inside the gated helpers', () => {
    expect(migrationSql).toContain(
      'private.is_student_owner(\n      target_student_id',
    );
    expect(migrationSql).toContain(
      "array['GUARDIAN'::public.user_role]",
    );
    expect(migrationSql).toContain(
      'guardianship.guardian_profile_id = auth.uid()',
    );
    expect(migrationSql).toMatch(
      /student\.institution_id\s*=\s*target_institution_id/,
    );
    expect(migrationSql).toMatch(
      /attendance_record\.institution_id\s*=\s*target_institution_id/,
    );
    expect(migrationSql).toContain("status = 'CLOSED'");
    expect(migrationSql).toContain(
      'private.is_teacher_for_offering(subject_offering_id, institution_id)',
    );
    expect(migrationSql).toContain(
      'private.can_view_attendance_institution(institution_id)',
    );
  });

  it('keeps all helpers security-definer and locked to the intended roles', () => {
    expect(migrationSql.match(/security definer/g)).toHaveLength(5);
    expect(migrationSql.match(/set search_path = ''/g)).toHaveLength(5);
    expect(migrationSql).toContain(
      'revoke all on function private.current_profile_has_role(public.user_role)',
    );
    expect(migrationSql).not.toContain('disable row level security');
  });
});
