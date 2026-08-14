import { describe, expect, it } from "vitest";

import {
  getDeleteAuthorizationDecision,
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

const directorAuthorization: UpdateAuthorizationContext = {
  isSuperAdmin: false,
  isAccountOwner: false,
  isLocalAdmin: false,
  isOperationalManager: true,
  isDirector: true,
};

const ordinaryDeleteTarget = {
  targetFoundInInstitution: true,
  requesterId: "requester",
  targetProfileId: "target",
  targetPlatformRole: null,
  targetIsAccountOwner: false,
};

describe("manage-school-user delete authorization", () => {
  it("A: permite DIRECTOR remover usuario da propria instituicao", () => {
    expect(
      getDeleteAuthorizationDecision(directorAuthorization, ordinaryDeleteTarget),
    ).toEqual({ allowed: true });
  });

  it("B: bloqueia DIRECTOR quando o alvo nao pertence a instituicao", () => {
    expect(
      getDeleteAuthorizationDecision(directorAuthorization, {
        ...ordinaryDeleteTarget,
        targetFoundInInstitution: false,
      }),
    ).toEqual({ allowed: false, code: "TARGET_OUTSIDE_INSTITUTION" });
  });

  it("C: bloqueia a remocao de SUPER_ADMIN", () => {
    expect(
      getDeleteAuthorizationDecision(directorAuthorization, {
        ...ordinaryDeleteTarget,
        targetPlatformRole: "SUPER_ADMIN",
      }),
    ).toEqual({ allowed: false, code: "SUPER_ADMIN_PROTECTED" });
  });

  it("D: bloqueia a remocao do dono da conta", () => {
    expect(
      getDeleteAuthorizationDecision(directorAuthorization, {
        ...ordinaryDeleteTarget,
        targetIsAccountOwner: true,
      }),
    ).toEqual({ allowed: false, code: "ACCOUNT_OWNER_PROTECTED" });
  });

  it("E: bloqueia a propria remocao", () => {
    expect(
      getDeleteAuthorizationDecision(directorAuthorization, {
        ...ordinaryDeleteTarget,
        targetProfileId: "requester",
      }),
    ).toEqual({ allowed: false, code: "SELF_MANAGEMENT_BLOCKED" });
  });

  it("F: permite remover somente o vinculo alvo quando o usuario tem outros acessos", () => {
    expect(
      getDeleteAuthorizationDecision(directorAuthorization, ordinaryDeleteTarget),
    ).toEqual({ allowed: true });
  });

  it.each([
    { name: "ADMIN local", isLocalAdmin: true },
    { name: "dono da conta", isAccountOwner: true },
    { name: "SUPER_ADMIN", isSuperAdmin: true },
  ])("G: preserva o acesso anterior de %s", (overrides) => {
    expect(
      getDeleteAuthorizationDecision(
        { ...directorAuthorization, isDirector: false, ...overrides },
        ordinaryDeleteTarget,
      ),
    ).toEqual({ allowed: true });
  });

  it("H: bloqueia contexto sem identidade autorizada", () => {
    expect(
      getDeleteAuthorizationDecision(
        {
          isSuperAdmin: false,
          isAccountOwner: false,
          isLocalAdmin: false,
          isOperationalManager: false,
          isDirector: false,
        },
        ordinaryDeleteTarget,
      ),
    ).toEqual({ allowed: false, code: "DIRECTOR_REQUIRED" });
  });

  it("I: bloqueia institution_id forjado sem membership do alvo", () => {
    expect(
      getDeleteAuthorizationDecision(directorAuthorization, {
        ...ordinaryDeleteTarget,
        targetFoundInInstitution: false,
      }),
    ).toEqual({ allowed: false, code: "TARGET_OUTSIDE_INSTITUTION" });
  });

  it("J: bloqueia usuario sem membership DIRECTOR ativa", () => {
    expect(
      getDeleteAuthorizationDecision(
        { ...directorAuthorization, isDirector: false },
        ordinaryDeleteTarget,
      ),
    ).toEqual({ allowed: false, code: "DIRECTOR_REQUIRED" });
  });
});
