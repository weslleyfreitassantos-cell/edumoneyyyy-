import { describe, expect, it } from "vitest";

import {
  buildInstitutionMessageEmail,
  renderInstitutionMessage,
} from "./institution-email";

describe("institution email template", () => {
  it("renders the supported tokens and escapes content", () => {
    const message = renderInstitutionMessage(
      "Olá {{nome}}, <script>alert(1)</script> {{escola}} {{nao-suportado}}",
      "Ana <teste>",
      "Escola Azul & Cia",
    );

    expect(message).toContain("Ana &lt;teste&gt;");
    expect(message).toContain("Escola Azul &amp; Cia");
    expect(message).toContain("&lt;script&gt;");
    expect(message).toContain("{{nao-suportado}}");
    expect(message).not.toContain("<script>");
  });

  it("applies institution branding with safe fallbacks and overrides", () => {
    const email = buildInstitutionMessageEmail({
      recipientName: "Ana",
      institutionName: "Escola Azul",
      displayName: "Azul Educação",
      logoUrl: "javascript:alert(1)",
      primaryColor: "#123456",
      secondaryColor: "#abcdef",
      subject: "Aviso",
      title: "Reunião",
      message: "{{escola}}",
    });

    expect(email.subject).toBe("Aviso");
    expect(email.html).toContain("background:#123456");
    expect(email.html).toContain("background:#abcdef");
    expect(email.html).toContain("Azul Educação");
    expect(email.html).not.toContain("javascript:");
  });
});
