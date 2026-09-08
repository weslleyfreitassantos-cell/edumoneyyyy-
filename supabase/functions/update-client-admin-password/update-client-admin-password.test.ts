import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./index.ts", import.meta.url),
  "utf8",
);

describe("update-client-admin-password", () => {
  it("requires an active SUPER_ADMIN", () => {
    expect(source).toContain('"UNAUTHENTICATED"');
    expect(source).toContain('"PROFILE_INACTIVE"');
    expect(source).toContain('"SUPER_ADMIN_REQUIRED"');
    expect(source).toContain('requester.platform_role !== "SUPER_ADMIN"');
  });

  it("resolves the owner only from the account id", () => {
    expect(source).toContain('accountId: z.string().uuid');
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
});
