import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260927000100_guardian_dependent_profile_visibility.sql', import.meta.url),
  'utf8',
);

describe('guardian dependent profile visibility migration', () => {
  it('limits dependent profile access to active linked guardians in the institution', () => {
    expect(migration).toContain('private.can_guardian_view_student_profile');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('private.is_current_profile_active()');
    expect(migration).toContain('student_profile.active is true');
    expect(migration).toContain('student.active is true');
    expect(migration).toContain('guardianship.guardian_profile_id = (select auth.uid())');
    expect(migration).toContain('guardianship.active is true');
    expect(migration).toContain("guardian_membership.role = 'GUARDIAN'::public.user_role");
    expect(migration).toContain('guardian_membership.active is true');
    expect(migration).toContain('public.is_institution_operational(student.institution_id)');
    expect(migration).toContain('or private.can_guardian_view_student_profile(profiles.id)');
    expect(migration).toContain('owner to postgres');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to authenticated, service_role');
  });

  it('preserves existing profile visibility paths and reloads PostgREST', () => {
    expect(migration).toContain('id = (select auth.uid())');
    expect(migration).toContain('public.is_platform_super_admin()');
    expect(migration).toContain("array['DIRECTOR', 'SECRETARY']::public.user_role[]");
    expect(migration).toContain('private.can_access_academic_institution');
    expect(migration).toContain('private.can_view_teacher_profile(profiles.id)');
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
