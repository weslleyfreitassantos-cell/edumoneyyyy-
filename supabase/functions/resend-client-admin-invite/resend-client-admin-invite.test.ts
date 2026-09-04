import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./index.ts", import.meta.url),
  "utf8",
);

describe("resend-client-admin-invite", () => {
  it("uses recovery links for an existing owner and never recreates the account", () => {
    expect(source).toContain('type: "recovery"');
    expect(source).toContain("INVITATION_ALREADY_ACCEPTED");
    expect(source).toContain("client_admin_invitations");
    expect(source).not.toContain("inviteUserByEmail");
    expect(source).not.toContain("send-school-email");
  });

  it("keeps provider failures pending", () => {
    expect(source).toContain('status: "PENDING"');
    expect(source).toContain('invitationSent: false');
    expect(source).toContain("RESEND_PROVIDER_ERROR");
  });
});
