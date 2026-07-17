export type IdentityFieldName = "adminEmail" | "email";

export type IdentityConflictCode =
  | "SUPER_ADMIN_EMAIL_RESERVED"
  | "EMAIL_ALREADY_REGISTERED"
  | "EMAIL_BELONGS_TO_ACCOUNT_OWNER"
  | "AUTH_USER_ALREADY_EXISTS";

export interface ExistingIdentityProfile {
  id: string;
  email: string;
  role: string;
  platform_role: string;
  active: boolean | null;
}

export interface IdentityConflict {
  status: 409;
  code: IdentityConflictCode;
  message: string;
  fieldErrors: Record<IdentityFieldName, string>;
}

const conflictMessages: Record<
  IdentityConflictCode,
  { message: string; fieldError: string }
> = {
  SUPER_ADMIN_EMAIL_RESERVED: {
    message:
      "Este e-mail pertence a um Super Administrador e não pode ser usado em uma conta cliente.",
    fieldError: "Este e-mail pertence ao Super Administrador.",
  },
  EMAIL_ALREADY_REGISTERED: {
    message: "Já existe um usuário cadastrado com este e-mail.",
    fieldError: "Este e-mail já está cadastrado.",
  },
  EMAIL_BELONGS_TO_ACCOUNT_OWNER: {
    message: "Este e-mail já pertence ao administrador de outra conta.",
    fieldError: "Este usuário já administra outra conta.",
  },
  AUTH_USER_ALREADY_EXISTS: {
    message: "Já existe um usuário de autenticação com este e-mail.",
    fieldError: "Este e-mail já está cadastrado.",
  },
};

export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildIdentityConflict(
  code: IdentityConflictCode,
  fieldName: IdentityFieldName,
): IdentityConflict {
  const messages = conflictMessages[code];

  return {
    status: 409,
    code,
    message: messages.message,
    fieldErrors: {
      [fieldName]: messages.fieldError,
    } as Record<IdentityFieldName, string>,
  };
}

export function getExistingProfileIdentityConflict(
  profile: ExistingIdentityProfile | null,
  ownsAccount: boolean,
  fieldName: IdentityFieldName,
): IdentityConflict | null {
  if (!profile) {
    return null;
  }

  if (profile.platform_role === "SUPER_ADMIN") {
    return buildIdentityConflict(
      "SUPER_ADMIN_EMAIL_RESERVED",
      fieldName,
    );
  }

  if (ownsAccount) {
    return buildIdentityConflict(
      "EMAIL_BELONGS_TO_ACCOUNT_OWNER",
      fieldName,
    );
  }

  return buildIdentityConflict(
    "EMAIL_ALREADY_REGISTERED",
    fieldName,
  );
}
