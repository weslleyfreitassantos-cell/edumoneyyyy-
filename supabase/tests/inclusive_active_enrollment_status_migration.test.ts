import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261019000500_fix_inclusive_active_enrollment_status.sql'),
  'utf8',
);

describe('inclusive active enrollment status migration', () => {
  it('accepts both legacy lowercase and canonical uppercase active statuses', () => {
    expect(migration.match(/upper\(pg_catalog\.btrim\(enrollment\.status\)\) = 'ACTIVE'/g)).toHaveLength(2);
    expect(migration).not.toMatch(/enrollment\.status\s*=\s*'active'/i);
  });

  it('keeps authorized roles and teacher access boundaries', () => {
    expect(migration).toContain("membership.role in ('ADMIN', 'DIRECTOR', 'SECRETARY')");
    expect(migration).toContain('private.inclusive_teacher_can_student');
    expect(migration).toContain('public.register_student_for_inclusive_education');
    expect(migration).toContain('drop trigger if exists student_health_inclusive_registration_bridge');
    expect(migration).not.toMatch(/for\s+health_row\s+in/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.inclusive_/i);
    expect(migration).not.toMatch(/truncate\s+public\.inclusive_/i);
  });

  it('registers through an explicit manager action, independent of health flags', () => {
    const registrationRpc = migration.split('create or replace function public.register_student_for_inclusive_education')[1];
    expect(registrationRpc).toContain('membership.role in (\'ADMIN\', \'DIRECTOR\', \'SECRETARY\')');
    expect(registrationRpc).toContain('inclusive_pei_plans');
    expect(registrationRpc).not.toContain('registration_bridge_created');
    expect(registrationRpc).not.toMatch(/student_health_information|autism|giftedness|needs_special_education/i);
    expect(migration).toContain('drop trigger if exists student_health_inclusive_registration_bridge');
  });
});
