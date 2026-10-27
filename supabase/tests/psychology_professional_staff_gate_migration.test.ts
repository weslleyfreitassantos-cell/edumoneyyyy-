import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../migrations/20261026000200_psychology_professional_school_staff_gate.sql', import.meta.url),
  'utf8',
);

describe('psychology professional school-staff gate migration', () => {
  it('requires an active Director or Secretary membership in the selected institution', () => {
    expect(migration).toContain('membership.profile_id = auth.uid()');
    expect(migration).toContain('membership.institution_id = target_institution_id');
    expect(migration).toContain('membership.active is true');
    expect(migration).toContain("'DIRECTOR'::public.user_role");
    expect(migration).toContain("'SECRETARY'::public.user_role");
    expect(migration).toContain('private.psychology_is_manager(target_institution_id)');
  });

  it('applies the same narrow guard to both professional registration and verification RPCs', () => {
    expect(migration.match(/private\.psychology_can_manage_professionals\(target_institution_id\)/g)).toHaveLength(2);
    expect(migration).toContain("'PROFESSIONAL_REGISTERED'");
    expect(migration).toContain("'CRP_VERIFIED'");
  });

  it('leaves the broader manager helper and unrelated Psychology RPCs untouched', () => {
    expect(migration).not.toContain('create or replace function private.psychology_is_manager');
    expect(migration).not.toContain('psychology_set_module_enabled');
    expect(migration).not.toContain('psychology_set_student_assignment');
    expect(migration).not.toContain('psychology_record_authorization');
  });
});
