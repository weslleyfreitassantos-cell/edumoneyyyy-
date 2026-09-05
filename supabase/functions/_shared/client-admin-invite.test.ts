import { describe, expect, it } from "vitest";

describe("client admin access email", () => {
  it("contains the temporary credentials and normal login URL", async () => {
    const { buildClientAdminAccessEmail } = await import("./client-admin-invite");
    const email = buildClientAdminAccessEmail({
      accountName: "Escola <Teste>",
      recipientName: "Admin",
      recipientEmail: "admin@example.test",
      temporaryPassword: "A1!<temporary>",
      loginUrl: "https://example.test/login",
    });

    expect(email.html).toContain("https://example.test/login");
    expect(email.html).toContain("admin@example.test");
    expect(email.html).toContain("A1!&lt;temporary&gt;");
    expect(email.html).toContain("Escola &lt;Teste&gt;");
    expect(email.html).toContain("Acessar plataforma");
    expect(email.html).not.toContain("/auth/confirm");
    expect(email.html).not.toContain("/reset-password");
    expect(email.subject).toContain("Escola <Teste>");
  });
});
