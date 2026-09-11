import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../migrations/20260911000400_active_profile_authorization.sql', import.meta.url),
  'utf8',
);

describe('active profile authorization migration', () => {
  it('defines a locked-down database helper for the current profile', () => {
    expect(migration).toContain('create or replace function private.is_current_profile_active()');
    expect(migration).toMatch(/profile\.id = auth\.uid\(\)/i);
    expect(migration).toMatch(/profile\.active is true/i);
    expect(migration).toMatch(/set search_path = ''/i);
    expect(migration).toMatch(/grant execute on function private\.is_current_profile_active\(\)\s+to authenticated, service_role/i);
    expect(migration).not.toMatch(/grant all/i);
    expect(migration).not.toMatch(/to anon/i);
  });

  it('composes profile activity into the authorization helpers and audience paths', () => {
    for (const helper of [
      'public.is_platform_super_admin',
      'public.owns_account',
      'public.owns_institution',
      'public.can_access_institution',
      'public.is_institution_admin',
      'public.can_manage_institution_operations',
      'private.has_institution_role',
      'private.has_exact_institution_role',
      'private.is_teacher_for_offering',
      'private.is_student_owner',
      'private.is_student_enrolled_in_offering',
      'private.is_guardian_of_student',
      'private.is_active_student_of_institution',
      'private.is_active_guardian_of_institution',
      'private.is_active_student_of_calendar_class',
      'private.is_active_guardian_of_calendar_class',
      'private.is_active_teacher_of_calendar_class',
    ]) {
      expect(migration).toContain(`private.is_current_profile_active()`);
      expect(migration).toContain(`create or replace function ${helper}`);
    }
  });

  it('protects direct self-owned policies that do not go through an institution helper', () => {
    for (const policy of [
      'profiles_select_policy',
      'profiles_update_own_name_policy',
      'memberships_select_policy',
      'students_select_policy',
      'guardianships_select_policy',
      'guardianships_student_select',
      'subject_offerings_select_policy',
      'academic_calendar_events_teacher_select',
      'finance_contract_guardian',
      'finance_invoice_guardian',
      'finance_payment_guardian',
      'finance_provider_staff',
    ]) {
      expect(migration).toContain(policy);
    }
  });
});
