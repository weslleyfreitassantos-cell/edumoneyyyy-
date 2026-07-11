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
  | 'available_now'
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
      'available_now',
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
      'available_now',
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
      'available_now',
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
      'available_now',
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

export const UNIFIED_USER_INVITE_ROLES = [
  'DIRECTOR',
  'TEACHER',
  'STUDENT',
  'GUARDIAN',
] as const;

export type UnifiedUserInviteRole =
  (typeof UNIFIED_USER_INVITE_ROLES)[number];

export interface UnifiedUserInvitePayload {
  institutionId: string;
  role: UnifiedUserInviteRole;
  fullName: string;
  email: string;
  student?: {
    birthDate: string;
    cpf?: string;
  };
  guardian?: {
    studentId: string;
    relationship: string;
  };
}

export interface UnifiedUserInviteFormValues {
  institutionId: string | null | undefined;
  target: UnifiedUserInviteTarget;
  fullName: string;
  email: string;
  birthDate?: string;
  cpf?: string;
  guardianStudentId?: string;
  relationship?: string;
  currentRole?: string | null;
}

export type UnifiedUserInviteField =
  | 'institutionId'
  | 'target'
  | 'fullName'
  | 'email'
  | 'birthDate'
  | 'cpf'
  | 'guardianStudentId'
  | 'relationship';

export type UnifiedUserInviteFieldErrors =
  Partial<Record<UnifiedUserInviteField, string>>;

export type UnifiedUserInviteValidationResult =
  | {
      success: true;
      payload: UnifiedUserInvitePayload;
    }
  | {
      success: false;
      fieldErrors: UnifiedUserInviteFieldErrors;
    };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const cpfPattern =
  /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeOptional(
  value: string | undefined,
): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

export function isUnifiedInviteRole(
  target: UnifiedUserInviteTarget,
): target is UnifiedUserInviteRole {
  return UNIFIED_USER_INVITE_ROLES.includes(
    target as UnifiedUserInviteRole,
  );
}

export function buildUnifiedUserInvitePayload(
  input: UnifiedUserInviteFormValues,
): UnifiedUserInviteValidationResult {
  const fieldErrors: UnifiedUserInviteFieldErrors = {};
  const institutionId =
    input.institutionId?.trim() ?? '';
  const fullName = normalizeName(input.fullName);
  const email = input.email.trim().toLowerCase();
  const cpf = normalizeOptional(input.cpf);
  const relationship = normalizeOptional(
    input.relationship,
  );
  const guardianStudentId = normalizeOptional(
    input.guardianStudentId,
  );
  const birthDate = normalizeOptional(
    input.birthDate,
  );

  if (!institutionId) {
    fieldErrors.institutionId =
      'Selecione uma escola ativa.';
  }

  if (!isUnifiedInviteRole(input.target)) {
    fieldErrors.target =
      'Este papel ainda nao pode receber convite.';
  }

  if (
    input.target === 'DIRECTOR' &&
    input.currentRole !== 'ADMIN'
  ) {
    fieldErrors.target =
      'Somente ADMIN ativo pode convidar outro diretor.';
  }

  if (fullName.length < 3) {
    fieldErrors.fullName =
      'Informe o nome completo.';
  }

  if (!emailPattern.test(email)) {
    fieldErrors.email =
      'Informe um e-mail valido.';
  }

  if (input.target === 'STUDENT') {
    if (!birthDate || !datePattern.test(birthDate)) {
      fieldErrors.birthDate =
        'Informe a data de nascimento.';
    }

    if (cpf && !cpfPattern.test(cpf)) {
      fieldErrors.cpf =
        'CPF deve conter 11 digitos.';
    }
  }

  if (input.target === 'GUARDIAN') {
    if (!guardianStudentId) {
      fieldErrors.guardianStudentId =
        'Selecione um aluno da escola.';
    }

    if (!relationship || relationship.length < 2) {
      fieldErrors.relationship =
        'Informe o relacionamento.';
    }
  }

  if (
    !isUnifiedInviteRole(input.target) ||
    Object.keys(fieldErrors).length > 0
  ) {
    return {
      success: false,
      fieldErrors,
    };
  }

  const payload: UnifiedUserInvitePayload = {
    institutionId,
    role: input.target,
    fullName,
    email,
  };

  if (input.target === 'STUDENT') {
    payload.student = {
      birthDate: birthDate!,
      ...(cpf ? { cpf } : {}),
    };
  }

  if (input.target === 'GUARDIAN') {
    payload.guardian = {
      studentId: guardianStudentId!,
      relationship: relationship!,
    };
  }

  return {
    success: true,
    payload,
  };
}
