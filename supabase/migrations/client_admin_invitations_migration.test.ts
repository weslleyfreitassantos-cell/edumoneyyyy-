import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./20260904000100_client_admin_invitations.sql", import.meta.url),
  "utf8",
);

describe("client admin invitations migration", () => {
  it("stores only delivery metadata and supports the required states", () => {
    expect(source).toContain("client_admin_invitations");
    expect(source).toContain("'PENDING', 'SENT', 'ACCEPTED'");
    expect(source).toContain("attempt_count");
    expect(source).toContain("last_error_code");
    expect(source).not.toContain("action_link");
    expect(source).not.toContain("token_hash");
    expect(source).not.toContain("otp");
  });

  it("limits reads to active Super Admins and accepts through a security definer RPC", () => {
    expect(source).toContain("client_admin_invitations_super_admin_select");
    expect(source).toContain("profiles.platform_role = 'SUPER_ADMIN'");
    expect(source).toContain("mark_client_admin_invitation_accepted");
    expect(source).toContain("security definer");
  });
});
