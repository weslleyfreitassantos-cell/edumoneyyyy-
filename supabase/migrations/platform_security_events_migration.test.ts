import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./20260904000400_platform_security_events.sql", import.meta.url),
  "utf8",
);

describe("platform security events migration", () => {
  it("creates a narrow password-change audit table", () => {
    expect(source).toContain("create table if not exists public.platform_security_events");
    expect(source).toContain("CLIENT_ADMIN_PASSWORD_CHANGED");
    expect(source).toContain("requester_profile_id");
    expect(source).toContain("target_profile_id");
    expect(source).toContain("alter table public.platform_security_events enable row level security");
    expect(source).not.toContain("password text");
    expect(source).not.toContain("secret");
  });
});
