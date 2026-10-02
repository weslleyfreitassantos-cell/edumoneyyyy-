const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administração',
  DIRECTOR: 'Direção',
  SECRETARY: 'Secretaria',
  TEACHER: 'Docente',
  STUDENT: 'Estudante',
  GUARDIAN: 'Responsável',
  PARENT: 'Responsável',
};

export function getRoleDisplayLabel(
  role: string | null | undefined,
): string {
  if (!role) return '';

  const normalizedRole = role.trim().toUpperCase();
  return roleLabels[normalizedRole] ?? role;
}
