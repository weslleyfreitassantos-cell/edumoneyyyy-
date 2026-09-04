import { describe, expect, it } from "vitest";

describe("client admin invite contract", () => {
  it("keeps the temporary action link only in the generated email", async () => {
    const { buildClientAdminInviteEmail } = await import("./client-admin-invite");
    const email = buildClientAdminInviteEmail({
      accountName: "Escola <Teste>",
      recipientName: "Admin",
      actionLink: "https://example.test/auth/confirm?token=secret",
    });

    expect(email.html).toContain("https://example.test/auth/confirm?token=secret");
    expect(email.html).toContain("Escola &lt;Teste&gt;");
    expect(email.subject).toContain("Escola <Teste>");
  });
});
