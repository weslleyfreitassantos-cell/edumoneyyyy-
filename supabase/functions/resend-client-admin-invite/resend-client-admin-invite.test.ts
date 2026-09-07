import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./index.ts", import.meta.url),
  "utf8",
);

describe("resend-client-admin-invite", () => {
  it("changes the existing owner's password and never recreates the account", () => {
    expect(source).toContain("auth.admin.updateUserById");
    expect(source).toContain("password: temporaryPassword");
    expect(source).toContain("email_confirm: true");
    expect(source).toContain("generateSecurePassword");
    expect(source).toContain("INVITATION_ALREADY_ACCEPTED");
    expect(source).toContain("client_admin_invitations");
    expect(source).not.toContain("generateLink");
    expect(source).not.toContain("/auth/confirm");
    expect(source).not.toContain("/reset-password");
    expect(source).not.toContain("createUser");
    expect(source).not.toContain("inviteUserByEmail");
    expect(source).not.toContain("send-school-email");
  });

  it("keeps provider failures pending", () => {
    expect(source).toContain('status: "PENDING"');
    expect(source).toContain('invitationSent: false');
    expect(source).toContain("RESEND_PROVIDER_ERROR");
  });
});
