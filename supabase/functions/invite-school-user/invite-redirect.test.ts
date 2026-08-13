import { describe, expect, it } from "vitest";

import { buildInviteRedirectUrl } from "./invite-redirect";

describe("invite redirect URL", () => {
  it("resolves SESI to its institution host", () => {
    expect(
      buildInviteRedirectUrl(
        "https://tecescola.grupotec.dev.br",
        "sesi",
      ),
    ).toBe("https://sesi.grupotec.dev.br/auth/confirm");
  });

  it("does not inherit a legacy app host when a subdomain exists", () => {
    expect(
      buildInviteRedirectUrl(
        "https://legacy.example.com",
        "escola-luz",
      ),
    ).toBe("https://escola-luz.grupotec.dev.br/auth/confirm");
  });

  it("uses the configured app origin for an institution without subdomain", () => {
    expect(
      buildInviteRedirectUrl(
        "https://tecescola.grupotec.dev.br/old-path",
      ),
    ).toBe("https://tecescola.grupotec.dev.br/auth/confirm");
  });

  it("rejects an invalid subdomain instead of creating an unsafe URL", () => {
    expect(() =>
      buildInviteRedirectUrl(
        "https://tecescola.grupotec.dev.br",
        "sesi.example.com",
      )
    ).toThrow("Institution subdomain is invalid.");
  });
});
