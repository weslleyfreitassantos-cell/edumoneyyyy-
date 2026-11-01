const SECTION_ROLE_PREFERENCES: Record<string, readonly string[]> = {
  agenda: ['PSYCHOLOGIST'],
  atendimentos: ['PSYCHOLOGIST'],
  anotacoes: ['PSYCHOLOGIST'],
  disponibilidade: ['PSYCHOLOGIST'],
  agendar: ['STUDENT'],
  agendamentos: ['STUDENT'],
  chat: ['STUDENT'],
  autorizacao: ['STUDENT', 'GUARDIAN'],
  configuracao: ['DIRECTOR', 'SECRETARY', 'ADMIN'],
};

export function getPsychologyRouteRole(
  section: string,
  institutionRole: string | null | undefined,
  activeInstitutionRoles: readonly string[] = [],
): string {
  const availableRoles = new Set(
    [institutionRole, ...activeInstitutionRoles]
      .filter((role): role is string => Boolean(role))
      .map((role) => role.toUpperCase()),
  );

  const preferredRoles = SECTION_ROLE_PREFERENCES[section];
  if (preferredRoles) {
    const matchingRole = preferredRoles.find((role) =>
      availableRoles.has(role),
    );
    if (matchingRole) return matchingRole;
  }

  return institutionRole ?? activeInstitutionRoles[0] ?? '';
}
