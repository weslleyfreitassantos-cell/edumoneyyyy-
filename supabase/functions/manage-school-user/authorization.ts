export interface UpdateAuthorizationContext {
  isSuperAdmin: boolean;
  isAccountOwner: boolean;
  isLocalAdmin: boolean;
  isOperationalManager: boolean;
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
