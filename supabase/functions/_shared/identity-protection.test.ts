import { describe, expect, it } from "vitest";

import {
  buildIdentityConflict,
  getExistingProfileIdentityConflict,
  normalizeIdentityEmail,
  type ExistingIdentityProfile,
} from "./identity-protection";

function profile(
  overrides: Partial<ExistingIdentityProfile> = {},
): ExistingIdentityProfile {
  return {
    id: "profile-1",
    email: "admin@example.com",
    role: "ADMIN",
    platform_role: "USER",
    active: true,
    ...overrides,
  };
}

describe("identity protection helpers", () => {
  it("normaliza e-mail antes de consultas", () => {
    expect(
      normalizeIdentityEmail("  ADMIN@Example.COM  "),
    ).toBe("admin@example.com");
  });

  it("bloqueia SUPER_ADMIN sem alterar identidade", () => {
    const conflict = getExistingProfileIdentityConflict(
      profile({
        platform_role: "SUPER_ADMIN",
      }),
      false,
      "adminEmail",
    );

    expect(conflict).toMatchObject({
      status: 409,
      code: "SUPER_ADMIN_EMAIL_RESERVED",
      fieldErrors: {
        adminEmail:
          "Este e-mail pertence ao Super Administrador.",
      },
    });
  });

  it("bloqueia profile comum ja cadastrado", () => {
    const conflict = getExistingProfileIdentityConflict(
      profile(),
      false,
      "email",
    );

    expect(conflict).toMatchObject({
      status: 409,
      code: "EMAIL_ALREADY_REGISTERED",
      fieldErrors: {
        email: "Este e-mail já está cadastrado.",
      },
    });
  });

  it("bloqueia owner de outra conta antes de criar vinculos", () => {
    const conflict = getExistingProfileIdentityConflict(
      profile(),
      true,
      "email",
    );

    expect(conflict).toMatchObject({
      status: 409,
      code: "EMAIL_BELONGS_TO_ACCOUNT_OWNER",
      fieldErrors: {
        email: "Este usuário já administra outra conta.",
      },
    });
  });

  it("padroniza duplicidade Auth-only", () => {
    expect(
      buildIdentityConflict(
        "AUTH_USER_ALREADY_EXISTS",
        "adminEmail",
      ),
    ).toMatchObject({
      status: 409,
      code: "AUTH_USER_ALREADY_EXISTS",
      fieldErrors: {
        adminEmail: "Este e-mail já está cadastrado.",
      },
    });
  });
});
