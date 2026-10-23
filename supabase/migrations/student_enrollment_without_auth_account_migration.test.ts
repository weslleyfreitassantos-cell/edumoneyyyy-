import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261023000600_student_enrollment_without_auth_account.sql', import.meta.url),
  'utf8',
);

describe('student enrollment without an auth account migration', () => {
  it('keeps student identity on the school record and makes the auth link optional', () => {
    expect(migration).toContain('alter column profile_id drop not null');
    expect(migration).toContain('add column if not exists full_name text');
    expect(migration).toContain('profile_id is not null');
    expect(migration).toContain('left join public.profiles as profile');
    expect(migration).toContain('student.full_name');
  });

  it('keeps the teacher roster institution-scoped while allowing students without profiles', () => {
    expect(migration).toContain('public.get_teacher_offering_rosters');
    expect(migration).toContain('left join public.profiles p on p.id = s.profile_id');
    expect(migration).toContain('(p.id is null or p.active is true)');
    expect(migration).toContain('m.role = \'TEACHER\'');
    expect(migration).toContain('m.active is true');
  });

  it('creates an accountless student only during finalization and restricts identity edits', () => {
    expect(migration).toContain('profile_id, institution_id, registration_number, full_name');
    expect(migration).toContain('null, p_institution_id, \'\'');
    expect(migration).toContain('public.create_full_student_enrollment_bundle(v_payload)');
    expect(migration).toContain('public.update_student_without_auth_identity');
    expect(migration).toContain('profile_id is null');
    expect(migration).toContain('grant execute on function public.update_student_without_auth_identity(uuid, uuid, text, text) to authenticated');
  });

  it('rechecks duplicates server-side and records explicit, actor-bound approval', () => {
    expect(migration).toContain('private.find_student_duplicate_ids(');
    expect(migration).toContain('STUDENT_DUPLICATE_REVIEW_REQUIRED');
    expect(migration).toContain('STUDENT_DUPLICATE_REVIEW_STALE');
    expect(migration).toContain('public.approve_student_enrollment_duplicate_review');
    expect(migration).toContain('approval.approved_by = auth.uid()');
    expect(migration).toContain('approval.candidate_student_ids = v_duplicate_ids');
    expect(migration).toContain('candidate_student_ids = excluded.candidate_student_ids');
    expect(migration).toContain('set used_at = now()');
    expect(migration).toContain('revoke all on public.student_enrollment_duplicate_approvals from public, anon, authenticated');
    expect(migration).toContain('grant select, delete on public.student_enrollment_duplicate_approvals to service_role');
  });
});
