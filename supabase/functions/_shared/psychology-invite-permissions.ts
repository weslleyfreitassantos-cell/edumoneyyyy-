export interface InstitutionMembershipForPsychologyInvite {
  institution_id: string;
  role: string;
  active: boolean | null;
}

export function canManagePsychologistInvites(
  memberships: readonly InstitutionMembershipForPsychologyInvite[],
  targetInstitutionId: string,
): boolean {
  return memberships.some((membership) =>
    membership.institution_id === targetInstitutionId &&
    membership.active === true &&
    (membership.role === 'DIRECTOR' || membership.role === 'SECRETARY')
  );
}
