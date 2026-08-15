import { describe, expect, it } from "vitest";

import {
  buildInstitutionLoginUrl,
  buildSchoolAccessEmail,
  generateSecurePassword,
  getSchoolAccessRoleLabel,
} from "./school-access";

describe("school access helpers", () => {
  it("generates a strong password with distinct values", () => {
    const first = generateSecurePassword();
    const second = generateSecurePassword();

    expect(first).toHaveLength(20);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/[0-9]/);
    expect(first).toMatch(/[!@#$%&*+\-=\?]/);
    expect(second).not.toBe(first);
  });

  it("builds only the institution login URL", () => {
    expect(buildInstitutionLoginUrl(" Escola-Luz ")).toBe(
      "https://escola-luz.grupotec.dev.br/login",
    );
    expect(() => buildInstitutionLoginUrl("tecescola")).toThrow();
    expect(() => buildInstitutionLoginUrl(null)).toThrow();
  });

  it("escapes email data and renders institution branding", () => {
    const email = buildSchoolAccessEmail({
      recipientName: "<Maria>",
      recipientEmail: "maria@example.com",
      institutionName: "Escola <Luz>",
      logoUrl: "https://cdn.example.com/logo.png",
      primaryColor: "#123456",
      secondaryColor: "#abcdef",
      role: "GUARDIAN",
      loginUrl: "https://escola-luz.grupotec.dev.br/login",
      password: "A1!strong-password",
    });

    expect(email.subject).toBe("Seu acesso está pronto | Escola <Luz>");
    expect(email.html).toContain("&lt;Maria&gt;");
    expect(email.html).toContain("A1!strong-password");
    expect(email.html).toContain("https://escola-luz.grupotec.dev.br/login");
    expect(email.html).toContain("Seja bem-vindo(a)!");
    expect(email.html).toContain("Senha de acesso");
    expect(email.html).toContain("Acessar meu ambiente");
    expect(email.html).toContain(">Escola &lt;Luz&gt;</p>");
    expect(email.html).not.toContain("generated_password");
  });

  it("uses the existing-password wording without a password", () => {
    const email = buildSchoolAccessEmail({
      recipientName: "Maria",
      recipientEmail: "maria@example.com",
      institutionName: "Escola Luz",
      role: "TEACHER",
      loginUrl: "https://escola-luz.grupotec.dev.br/login",
    });

    expect(email.subject).toBe("Novo acesso disponível | Escola Luz");
    expect(email.html).toContain("Seja bem-vindo(a)!");
    expect(email.html).toContain("senha atual");
    expect(email.html).not.toContain("Senha de acesso");
    expect(email.html).not.toContain("A1!strong-password");
    expect(getSchoolAccessRoleLabel("TEACHER")).toBe("Professor(a)");
  });

  it.each([
    "SESI",
    "Escola Luz",
    "Colégio São José",
    "Objetivo",
  ])("keeps the institution name isolated for %s", (institutionName) => {
    const email = buildSchoolAccessEmail({
      recipientName: "Samuel",
      recipientEmail: "samuel@example.com",
      institutionName,
      role: "TEACHER",
      loginUrl: "https://sesi.grupotec.dev.br/login",
      password: "A1!strong-password",
    });

    const buttonIndex = email.html.indexOf("Acessar meu ambiente");
    const institutionIndex = email.html.indexOf(`>${institutionName}</p>`);

    expect(email.html).toContain("Seja bem-vindo(a)!");
    expect(email.html).toContain(institutionName);
    expect(buttonIndex).toBeGreaterThanOrEqual(0);
    expect(institutionIndex).toBeGreaterThan(buttonIndex);
    expect(email.html).not.toContain(`Acessar ${institutionName}`);
    expect(email.html).not.toContain(`Seu acesso à ${institutionName}`);
    expect(email.html).not.toContain(`Seu acesso ao ${institutionName}`);
    expect(email.html).not.toContain(`Seu acesso a ${institutionName}`);
  });

  it.each([
    ["DIRECTOR", "Diretor(a)"],
    ["SECRETARY", "Secretaria"],
    ["TEACHER", "Professor(a)"],
    ["STUDENT", "Aluno(a)"],
    ["GUARDIAN", "Responsável"],
  ] as const)("maps %s to its school-facing label", (role, label) => {
    expect(getSchoolAccessRoleLabel(role)).toBe(label);
  });
});
