import { describe, expect, it } from "vitest";

import {
  getOwnerDeletionMode,
  hasBlockingDependencies,
  type DeleteSafetySnapshot,
} from "./validation";

const emptySnapshot: DeleteSafetySnapshot = {
  institutionCount: 0,
  ownerMembershipCount: 0,
  ownerStudentCount: 0,
  ownerGuardianshipCount: 0,
  ownerTeachingCount: 0,
  ownerAuditReferenceCount: 0,
};

describe("delete-client-account safety helpers", () => {
  it("permite conta completamente vazia", () => {
    expect(hasBlockingDependencies(emptySnapshot)).toBe(false);
  });

  it("bloqueia conta com instituicao", () => {
    expect(
      hasBlockingDependencies({
        ...emptySnapshot,
        institutionCount: 1,
      }),
    ).toBe(true);
  });

  it("bloqueia owner com vinculos academicos", () => {
    expect(
      hasBlockingDependencies({
        ...emptySnapshot,
        ownerMembershipCount: 1,
      }),
    ).toBe(true);
    expect(
      hasBlockingDependencies({
        ...emptySnapshot,
        ownerStudentCount: 1,
      }),
    ).toBe(true);
    expect(
      hasBlockingDependencies({
        ...emptySnapshot,
        ownerGuardianshipCount: 1,
      }),
    ).toBe(true);
    expect(
      hasBlockingDependencies({
        ...emptySnapshot,
        ownerTeachingCount: 1,
      }),
    ).toBe(true);
  });

  it("bloqueia referencias academicas historicas do owner", () => {
    expect(
      hasBlockingDependencies({
        ...emptySnapshot,
        ownerAuditReferenceCount: 1,
      }),
    ).toBe(true);
  });

  it("remove ADMIN comum e preserva SUPER_ADMIN", () => {
    expect(
      getOwnerDeletionMode({
        role: "ADMIN",
        platform_role: "USER",
      }),
    ).toBe("delete_admin_user");

    expect(
      getOwnerDeletionMode({
        role: "ADMIN",
        platform_role: "SUPER_ADMIN",
      }),
    ).toBe("preserve_super_admin");
  });

  it("bloqueia owner fora do contrato removivel", () => {
    expect(
      getOwnerDeletionMode({
        role: "TEACHER",
        platform_role: "USER",
      }),
    ).toBe("unsupported_owner");
  });
});
