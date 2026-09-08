export interface UpdateAuthorizationContext {
  isSuperAdmin: boolean;
  isAccountOwner: boolean;
  isLocalAdmin: boolean;
  isOperationalManager: boolean;
  isDirector?: boolean;
  isSecretary?: boolean;
}

export interface UpdateAuthorizationInput {
  targetRole: string;
  requestedRole?: string;
  targetMembershipActive: boolean | null;
  studentActive: boolean | null | undefined;
  hasPassword: boolean;
  hasFullName: boolean;
  hasRole: boolean;
}

export interface UpdateAuthorizationDecision {
  allowed: boolean;
  code?:
    | "SECRETARY_CANNOT_CHANGE_DIRECTOR_ROLE"
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
  targetRole: string;
}

export interface DeleteAuthorizationDecision {
  allowed: boolean;
  code?:
    | "TARGET_OUTSIDE_INSTITUTION"
    | "SELF_MANAGEMENT_BLOCKED"
    | "SUPER_ADMIN_PROTECTED"
    | "ACCOUNT_OWNER_PROTECTED"
    | "SECRETARY_CANNOT_REMOVE_DIRECTOR"
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
    authorization.isOperationalManager &&
    authorization.isDirector !== true &&
    authorization.isSecretary === true &&
    input.targetRole === "DIRECTOR"
  ) {
    return { allowed: false, code: "SECRETARY_CANNOT_REMOVE_DIRECTOR" };
  }

  if (
    authorization.isSuperAdmin ||
    authorization.isAccountOwner ||
    authorization.isLocalAdmin ||
    authorization.isDirector === true ||
    authorization.isSecretary === true
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
  if (
    input.requestedRole === "ADMIN" &&
    !authorization.isSuperAdmin &&
    !authorization.isAccountOwner &&
    !authorization.isLocalAdmin
  ) {
    return { allowed: false, code: "TARGET_ROLE_NOT_ALLOWED" };
  }

  if (!isOperationalManagerOnly(authorization)) {
    return { allowed: true };
  }

  if (input.targetMembershipActive !== true) {
    return { allowed: false, code: "TARGET_MEMBERSHIP_INACTIVE" };
  }

  if (input.targetRole === "ADMIN") {
    return { allowed: false, code: "TARGET_ROLE_NOT_ALLOWED" };
  }

  if (
    authorization.isSecretary === true &&
    input.targetRole === "DIRECTOR" &&
    input.requestedRole !== undefined &&
    input.requestedRole !== "DIRECTOR"
  ) {
    return { allowed: false, code: "SECRETARY_CANNOT_CHANGE_DIRECTOR_ROLE" };
  }

  return { allowed: true };
}
