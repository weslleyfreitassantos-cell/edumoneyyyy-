export const UNIFIED_USER_INVITE_TARGETS = [
  'STUDENT',
  'TEACHER',
  'GUARDIAN',
  'DIRECTOR',
] as const;

export type UnifiedUserInviteTarget =
  (typeof UNIFIED_USER_INVITE_TARGETS)[number];

export type UnifiedUserInviteAvailabilityStatus =
  | 'available_now';

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
      'Cadastro academico do aluno com vinculo institucional.',
    rolePreview: 'STUDENT',
    availabilityStatuses: [
      'available_now',
    ],
    futureRecords: [
      'profile',
      'membership',
      'student record',
      'acesso e senha, quando aplicavel',
    ],
    isPlanned: false,
  },
  {
    target: 'TEACHER',
    label: 'Professor',
    description:
      'Usuario com vinculo docente e acesso ao painel de professor.',
    rolePreview: 'TEACHER',
    availabilityStatuses: [
      'available_now',
    ],
    futureRecords: [
      'profile',
      'membership',
      'acesso e senha, quando aplicavel',
    ],
    isPlanned: false,
  },
  {
    target: 'GUARDIAN',
    label: 'Responsavel',
    description:
      'Usuario vinculado a aluno por guardianships.',
    rolePreview: 'GUARDIAN',
    availabilityStatuses: [
      'available_now',
    ],
    futureRecords: [
      'profile',
      'membership',
      'guardianship',
      'acesso e senha, quando aplicavel',
    ],
    isPlanned: false,
  },
  {
    target: 'DIRECTOR',
    label: 'Diretor',
    description:
      'Administrador institucional com membership DIRECTOR.',
    rolePreview: 'DIRECTOR',
    availabilityStatuses: [
      'available_now',
    ],
    futureRecords: [
      'profile',
      'membership',
      'acesso e senha',
    ],
    isPlanned: false,
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

export const UNIFIED_USER_INVITE_ROLES =
  UNIFIED_USER_INVITE_TARGETS;

export type UnifiedUserInviteRole =
  (typeof UNIFIED_USER_INVITE_ROLES)[number];

export interface UnifiedUserInvitePayload {
  institutionId: string;
  role: UnifiedUserInviteRole;
  fullName: string;
  email: string;
  phone?: string;
  continueOnEmailFailure?: boolean;
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

export function getAllowedInviteTargets(
  currentRole: string | null | undefined,
): UnifiedUserInviteRole[] {
  if (currentRole === 'ADMIN') {
    return [
      'DIRECTOR',
      'TEACHER',
      'STUDENT',
      'GUARDIAN',
    ];
  }

  if (currentRole === 'DIRECTOR') {
    return [
      'TEACHER',
      'STUDENT',
      'GUARDIAN',
    ];
  }

  if (currentRole === 'SECRETARY') {
    return [
      'STUDENT',
      'GUARDIAN',
    ];
  }

  return [];
}

export function canInviteTarget(
  currentRole: string | null | undefined,
  target: UnifiedUserInviteRole,
): boolean {
  return getAllowedInviteTargets(currentRole).includes(
    target,
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
      'Este papel nao pode receber acesso.';
  } else if (
    !canInviteTarget(input.currentRole, input.target)
  ) {
    fieldErrors.target =
      'Seu papel atual nao permite convidar este tipo de usuario.';
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
