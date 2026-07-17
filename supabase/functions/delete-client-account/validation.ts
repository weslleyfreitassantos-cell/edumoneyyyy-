export interface DeleteSafetySnapshot {
  institutionCount: number;
  ownerMembershipCount: number;
  ownerStudentCount: number;
  ownerGuardianshipCount: number;
  ownerTeachingCount: number;
  ownerAuditReferenceCount: number;
}

export interface DeleteOwnerProfile {
  role: string;
  platform_role: string;
}

export type OwnerDeletionMode =
  | "delete_admin_user"
  | "preserve_super_admin"
  | "unsupported_owner";

export function hasBlockingDependencies(
  snapshot: DeleteSafetySnapshot,
): boolean {
  return (
    snapshot.institutionCount > 0 ||
    snapshot.ownerMembershipCount > 0 ||
    snapshot.ownerStudentCount > 0 ||
    snapshot.ownerGuardianshipCount > 0 ||
    snapshot.ownerTeachingCount > 0 ||
    snapshot.ownerAuditReferenceCount > 0
  );
}

export function getOwnerDeletionMode(
  owner: DeleteOwnerProfile,
): OwnerDeletionMode {
  if (owner.platform_role === "SUPER_ADMIN") {
    return "preserve_super_admin";
  }

  if (
    owner.platform_role === "USER" &&
    owner.role === "ADMIN"
  ) {
    return "delete_admin_user";
  }

  return "unsupported_owner";
}
