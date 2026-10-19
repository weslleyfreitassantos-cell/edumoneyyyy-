import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261018000500_inclusive_education_hardening.sql'),
  'utf8',
);

describe('inclusive education hardening migration', () => {
  it('opens the student roster only through the inclusive authorization boundary', () => {
    expect(migration).toContain("role in ('ADMIN', 'DIRECTOR', 'SECRETARY')");
    expect(migration).toContain('private.inclusive_teacher_can_student');
    expect(migration).toContain('students_inclusive_select_policy');
    expect(migration).toContain('offering.active is true');
    expect(migration).toContain('enrollment.active is true');
  });

  it('enforces one editable plan per student and academic year', () => {
    expect(migration).toContain('inclusive_pei_editable_identity_unique');
    expect(migration).toContain('inclusive_aee_editable_identity_unique');
    expect(migration).toContain("where status <> 'ARCHIVED'");
    expect(migration).toContain('registration_bridge_created');
  });
});
