export const UNIFIED_USER_INVITE_TARGETS = [
  'STUDENT',
  'TEACHER',
  'GUARDIAN',
  'DIRECTOR',
  'SCHOOL_ADMIN_PLANNED',
  'SECRETARY_PLANNED',
] as const;

export type UnifiedUserInviteTarget =
  (typeof UNIFIED_USER_INVITE_TARGETS)[number];

export type UnifiedUserInviteAvailabilityStatus =
  | 'available_now_visual_only'
  | 'planned_requires_database'
  | 'planned_requires_edge_function'
  | 'planned_requires_migration_reconciliation';

export interface UnifiedUserInviteOption {
  target: UnifiedUserInviteTarget;
  label: string;
  description: string;
  rolePreview: string;
  availabilityStatuses: readonly UnifiedUserInviteAvailabilityStatus[];
  futureRecords: readonly string[];
  isPlanned: boolean;
}

export const UNIFIED_USER_INVITE_OPTIONS = [
  {
    target: 'STUDENT',
    label: 'Aluno',
    description:
      'Cadastro acadêmico do aluno. Login pode ser opcional no futuro.',
    rolePreview: 'STUDENT',
    availabilityStatuses: [
      'available_now_visual_only',
      'planned_requires_edge_function',
    ],
    futureRecords: [
      'profile',
      'membership',
      'student record',
      'convite/senha, quando aplicável',
    ],
    isPlanned: false,
  },
  {
    target: 'TEACHER',
    label: 'Professor',
    description:
      'Usuário com vínculo docente e possível acesso ao painel de professor.',
    rolePreview: 'TEACHER',
    availabilityStatuses: [
      'available_now_visual_only',
      'planned_requires_edge_function',
    ],
    futureRecords: [
      'profile',
      'membership',
      'convite/senha, quando aplicável',
      'atribuições acadêmicas futuras',
    ],
    isPlanned: false,
  },
  {
    target: 'GUARDIAN',
    label: 'Responsável',
    description:
      'Usuário vinculado a aluno por guardianships no futuro.',
    rolePreview: 'GUARDIAN',
    availabilityStatuses: [
      'available_now_visual_only',
      'planned_requires_edge_function',
    ],
    futureRecords: [
      'profile',
      'membership',
      'guardianship',
      'convite/senha, quando aplicável',
    ],
    isPlanned: false,
  },
  {
    target: 'DIRECTOR',
    label: 'Diretor',
    description:
      'Papel escolar atual compatível com DIRECTOR.',
    rolePreview: 'DIRECTOR',
    availabilityStatuses: [
      'available_now_visual_only',
      'planned_requires_edge_function',
    ],
    futureRecords: [
      'profile',
      'membership',
      'convite/senha',
    ],
    isPlanned: false,
  },
  {
    target: 'SCHOOL_ADMIN_PLANNED',
    label: 'Administração escolar',
    description:
      'Papel futuro SCHOOL_ADMIN, ainda não ativo no banco.',
    rolePreview: 'SCHOOL_ADMIN planejado',
    availabilityStatuses: [
      'planned_requires_database',
      'planned_requires_edge_function',
      'planned_requires_migration_reconciliation',
    ],
    futureRecords: [
      'profile',
      'membership com papel futuro',
      'convite/senha',
    ],
    isPlanned: true,
  },
  {
    target: 'SECRETARY_PLANNED',
    label: 'Secretaria escolar',
    description:
      'Papel futuro SECRETARY, ainda não ativo no banco.',
    rolePreview: 'SECRETARY planejado',
    availabilityStatuses: [
      'planned_requires_database',
      'planned_requires_edge_function',
      'planned_requires_migration_reconciliation',
    ],
    futureRecords: [
      'profile',
      'membership com papel futuro',
      'convite/senha',
    ],
    isPlanned: true,
  },
] as const satisfies readonly UnifiedUserInviteOption[];

export function getUnifiedUserInviteOption(
  target: UnifiedUserInviteTarget,
): UnifiedUserInviteOption {
  return UNIFIED_USER_INVITE_OPTIONS.find(
    (option) => option.target === target,
  )!;
}

export function isUnifiedInviteTargetCurrentlySupported(
  target: UnifiedUserInviteTarget,
): boolean {
  return !getUnifiedUserInviteOption(target).isPlanned;
}
