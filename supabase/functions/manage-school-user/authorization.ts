export interface UpdateAuthorizationContext {
  isSuperAdmin: boolean;
  isAccountOwner: boolean;
  isLocalAdmin: boolean;
  isOperationalManager: boolean;
  isDirector?: boolean;
}

export interface UpdateAuthorizationInput {
  targetRole: string;
  targetMembershipActive: boolean | null;
  studentActive: boolean | null | undefined;
  hasPassword: boolean;
  hasFullName: boolean;
  hasRole: boolean;
}

export interface UpdateAuthorizationDecision {
  allowed: boolean;
  code?:
    | "DIRECTOR_PASSWORD_ONLY"
    | "TARGET_MEMBERSHIP_INACTIVE"
    | "TARGET_ROLE_NOT_ALLOWED"
    | "STUDENT_INACTIVE";
}

export interface DeleteAuthorizationInput {
  targetFoundInInstitution: boolean;
  requesterId: string;
  targetProfileId: string;
  targetPlatformRole: string | null;
  targetIsAccountOwner: boolean;
}

export interface DeleteAuthorizationDecision {
  allowed: boolean;
  code?:
    | "TARGET_OUTSIDE_INSTITUTION"
    | "SELF_MANAGEMENT_BLOCKED"
    | "SUPER_ADMIN_PROTECTED"
    | "ACCOUNT_OWNER_PROTECTED"
    | "DIRECTOR_REQUIRED";
}

export function getDeleteAuthorizationDecision(
  authorization: UpdateAuthorizationContext,
  input: DeleteAuthorizationInput,
): DeleteAuthorizationDecision {
  if (!input.targetFoundInInstitution) {
    return { allowed: false, code: "TARGET_OUTSIDE_INSTITUTION" };
  }

  if (input.requesterId === input.targetProfileId) {
    return { allowed: false, code: "SELF_MANAGEMENT_BLOCKED" };
  }

  if (input.targetPlatformRole === "SUPER_ADMIN") {
    return { allowed: false, code: "SUPER_ADMIN_PROTECTED" };
  }

  if (input.targetIsAccountOwner) {
    return { allowed: false, code: "ACCOUNT_OWNER_PROTECTED" };
  }

  if (
    authorization.isSuperAdmin ||
    authorization.isAccountOwner ||
    authorization.isLocalAdmin ||
    authorization.isDirector === true
  ) {
    return { allowed: true };
  }

  return { allowed: false, code: "DIRECTOR_REQUIRED" };
}

function isOperationalManagerOnly(
  authorization: UpdateAuthorizationContext,
): boolean {
  return (
    authorization.isOperationalManager &&
    !authorization.isSuperAdmin &&
    !authorization.isAccountOwner &&
    !authorization.isLocalAdmin
  );
}

export function getUpdateAuthorizationDecision(
  authorization: UpdateAuthorizationContext,
  input: UpdateAuthorizationInput,
): UpdateAuthorizationDecision {
  if (!isOperationalManagerOnly(authorization)) {
    return { allowed: true };
  }

  if (!input.hasPassword || input.hasFullName || input.hasRole) {
    return { allowed: false, code: "DIRECTOR_PASSWORD_ONLY" };
  }

  if (input.targetMembershipActive !== true) {
    return { allowed: false, code: "TARGET_MEMBERSHIP_INACTIVE" };
  }

  if (input.targetRole !== "STUDENT") {
    return { allowed: false, code: "TARGET_ROLE_NOT_ALLOWED" };
  }

  if (input.studentActive !== true) {
    return { allowed: false, code: "STUDENT_INACTIVE" };
  }

  return { allowed: true };
}
