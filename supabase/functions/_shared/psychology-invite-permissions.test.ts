import { describe, expect, it } from 'vitest';

import { canManagePsychologistInvites } from './psychology-invite-permissions';

describe('psychologist invite authorization', () => {
  const institutionId = 'school-a';

  it.each(['DIRECTOR', 'SECRETARY'])('accepts active school role %s', (role) => {
    expect(canManagePsychologistInvites([
      { institution_id: institutionId, role, active: true },
    ], institutionId)).toBe(true);
  });

  it.each(['ADMIN', 'TEACHER', 'STUDENT', 'GUARDIAN', 'PSYCHOLOGIST'])('denies role %s without school staff membership', (role) => {
    expect(canManagePsychologistInvites([
      { institution_id: institutionId, role, active: true },
    ], institutionId)).toBe(false);
  });

  it('requires the active membership to belong to the target institution', () => {
    expect(canManagePsychologistInvites([
      { institution_id: 'school-b', role: 'DIRECTOR', active: true },
    ], institutionId)).toBe(false);
  });

  it('ignores inactive staff memberships', () => {
    expect(canManagePsychologistInvites([
      { institution_id: institutionId, role: 'SECRETARY', active: false },
    ], institutionId)).toBe(false);
  });

  it('allows a multi-role account only because it has active school-staff membership', () => {
    expect(canManagePsychologistInvites([
      { institution_id: institutionId, role: 'ADMIN', active: true },
      { institution_id: institutionId, role: 'DIRECTOR', active: true },
    ], institutionId)).toBe(true);
  });
});
