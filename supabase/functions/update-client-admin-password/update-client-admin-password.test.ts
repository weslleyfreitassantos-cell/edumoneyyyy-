import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parsePasswordUpdateRequest } from "./request-validation";

const source = readFileSync(
  new URL("./index.ts", import.meta.url),
  "utf8",
);
const validationSource = readFileSync(
  new URL("./request-validation.ts", import.meta.url),
  "utf8",
);

const AURORA_ACCOUNT_ID = "37282104-6ccf-3a9b-d719-7f9fc1a4d40e";
const STANDARD_ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("update-client-admin-password", () => {
  it("requires an active SUPER_ADMIN", () => {
    expect(source).toContain('"UNAUTHENTICATED"');
    expect(source).toContain('"PROFILE_INACTIVE"');
    expect(source).toContain('"SUPER_ADMIN_REQUIRED"');
    expect(source).toContain('requester.platform_role !== "SUPER_ADMIN"');
  });

  it("resolves the owner only from the account id", () => {
    expect(source).toContain("parsePasswordUpdateRequest(await request.json())");
    expect(validationSource).toContain("accountIdRequestSchema.extend");
    expect(source).toContain('.eq("id", accountId)');
    expect(source).toContain('select("id, owner_profile_id, status")');
    expect(source).toContain('target.ownerProfileId');
    expect(source).toContain('owner.role !== "ADMIN"');
    expect(source).toContain('owner.platform_role === "SUPER_ADMIN"');
  });

  it("updates Auth with the resolved owner and never sends email", () => {
    expect(source).toContain("auth.admin.updateUserById");
    expect(source).toContain("password: input.password");
    expect(source).toContain("email_confirm: true");
    expect(source).toContain('"PASSWORD_UPDATE_FAILED"');
    expect(source).not.toContain("send-school-email");
    expect(source).not.toContain("client_admin_invitations");
  });

  it("keeps passwords out of logs and records only the audit identity", () => {
    expect(source).toContain("platform_security_events");
    expect(source).toContain('event_type: "CLIENT_ADMIN_PASSWORD_CHANGED"');
    expect(source).not.toContain("console.error(input.password");
    expect(source).not.toContain("console.log(input.password");
    expect(source).toContain('"NOT_SUPPORTED"');
  });

  it("accepts the Aurora and conventional UUIDs with valid passwords", () => {
    expect(
      parsePasswordUpdateRequest({
        accountId: AURORA_ACCOUNT_ID,
        password: "12345678",
      }),
    ).toEqual({
      success: true,
      data: { accountId: AURORA_ACCOUNT_ID, password: "12345678" },
    });
    expect(
      parsePasswordUpdateRequest({
        accountId: STANDARD_ACCOUNT_ID,
        password: "12345678",
      }).success,
    ).toBe(true);
  });

  it("classifies malformed account ids separately from password errors", () => {
    expect(parsePasswordUpdateRequest({
      accountId: "not-a-uuid",
      password: "12345678",
    })).toMatchObject({
      success: false,
      code: "INVALID_ACCOUNT_ID",
      message: "Conta invalida.",
    });

    expect(
      parsePasswordUpdateRequest({
        accountId: AURORA_ACCOUNT_ID,
        password: "1234567",
      }),
    ).toMatchObject({
      success: false,
      code: "INVALID_PASSWORD",
      message: "Informe uma senha entre 8 e 72 caracteres.",
    });
    expect(
      parsePasswordUpdateRequest({
        accountId: AURORA_ACCOUNT_ID,
        password: "x".repeat(73),
      }),
    ).toMatchObject({ success: false, code: "INVALID_PASSWORD" });
  });

  it("accepts password boundaries and rejects unexpected payload fields", () => {
    expect(
      parsePasswordUpdateRequest({
        accountId: AURORA_ACCOUNT_ID,
        password: "x".repeat(8),
      }).success,
    ).toBe(true);
    expect(
      parsePasswordUpdateRequest({
        accountId: AURORA_ACCOUNT_ID,
        password: "x".repeat(72),
      }).success,
    ).toBe(true);
    expect(
      parsePasswordUpdateRequest({
        accountId: AURORA_ACCOUNT_ID,
        password: "12345678",
        unexpected: true,
      }),
    ).toMatchObject({ success: false, code: "INVALID_PAYLOAD" });
  });
});
