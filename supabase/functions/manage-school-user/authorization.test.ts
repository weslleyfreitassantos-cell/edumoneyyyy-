import { describe, expect, it } from "vitest";

import {
  getUpdateAuthorizationDecision,
  type UpdateAuthorizationContext,
  type UpdateAuthorizationInput,
} from "./authorization";

const operationalManager: UpdateAuthorizationContext = {
  isSuperAdmin: false,
  isAccountOwner: false,
  isLocalAdmin: false,
  isOperationalManager: true,
};

const activeStudentReset: UpdateAuthorizationInput = {
  targetRole: "STUDENT",
  targetMembershipActive: true,
  studentActive: true,
  hasPassword: true,
  hasFullName: false,
  hasRole: false,
};

describe("manage-school-user update authorization", () => {
  it("permite DIRECTOR redefinir senha de STUDENT ativo da mesma instituição", () => {
    expect(
      getUpdateAuthorizationDecision(operationalManager, activeStudentReset),
    ).toEqual({ allowed: true });
  });

  it("permite SECRETARY no mesmo cenário operacional", () => {
    expect(
      getUpdateAuthorizationDecision(operationalManager, activeStudentReset),
    ).toEqual({ allowed: true });
  });

  it("bloqueia membership do outro tenant quando ela não é resolvida como alvo ativo", () => {
    expect(
      getUpdateAuthorizationDecision(operationalManager, {
        ...activeStudentReset,
        targetMembershipActive: null,
      }),
    ).toEqual({ allowed: false, code: "TARGET_MEMBERSHIP_INACTIVE" });
  });

  it.each(["TEACHER", "GUARDIAN", "SECRETARY", "DIRECTOR", "ADMIN"])(
    "bloqueia reset de senha para %s",
    (targetRole) => {
      expect(
        getUpdateAuthorizationDecision(operationalManager, {
          ...activeStudentReset,
          targetRole,
          studentActive: null,
        }),
      ).toEqual({ allowed: false, code: "TARGET_ROLE_NOT_ALLOWED" });
    },
  );

  it("bloqueia alteração de nome sem senha", () => {
    expect(
      getUpdateAuthorizationDecision(operationalManager, {
        ...activeStudentReset,
        hasPassword: false,
        hasFullName: true,
      }),
    ).toEqual({ allowed: false, code: "DIRECTOR_PASSWORD_ONLY" });
  });

  it("bloqueia alteração de role sem senha", () => {
    expect(
      getUpdateAuthorizationDecision(operationalManager, {
        ...activeStudentReset,
        hasPassword: false,
        hasRole: true,
      }),
    ).toEqual({ allowed: false, code: "DIRECTOR_PASSWORD_ONLY" });
  });

  it("bloqueia password combinado com fullName", () => {
    expect(
      getUpdateAuthorizationDecision(operationalManager, {
        ...activeStudentReset,
        hasFullName: true,
      }),
    ).toEqual({ allowed: false, code: "DIRECTOR_PASSWORD_ONLY" });
  });

  it("bloqueia membership inativa", () => {
    expect(
      getUpdateAuthorizationDecision(operationalManager, {
        ...activeStudentReset,
        targetMembershipActive: false,
      }),
    ).toEqual({ allowed: false, code: "TARGET_MEMBERSHIP_INACTIVE" });
  });

  it("bloqueia student inativo", () => {
    expect(
      getUpdateAuthorizationDecision(operationalManager, {
        ...activeStudentReset,
        studentActive: false,
      }),
    ).toEqual({ allowed: false, code: "STUDENT_INACTIVE" });
  });

  it.each([
    { name: "ADMIN", isLocalAdmin: true },
    { name: "account owner", isAccountOwner: true },
    { name: "SUPER_ADMIN", isSuperAdmin: true },
  ])("preserva a permissão anterior de %s", ({ isLocalAdmin = false, isAccountOwner = false, isSuperAdmin = false }) => {
    expect(
      getUpdateAuthorizationDecision(
        {
          ...operationalManager,
          isLocalAdmin,
          isAccountOwner,
          isSuperAdmin,
        },
        {
          ...activeStudentReset,
          targetRole: "TEACHER",
          studentActive: null,
        },
      ),
    ).toEqual({ allowed: true });
  });
});
