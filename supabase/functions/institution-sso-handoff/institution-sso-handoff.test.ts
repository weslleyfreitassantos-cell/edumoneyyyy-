import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "supabase", "functions", "institution-sso-handoff", "index.ts"),
  "utf8",
);

describe("institution-sso-handoff", () => {
  it("exige sessão autenticada e valida o ADMIN proprietário da conta", () => {
    expect(source).toContain('withSupabase<Database>');
    expect(source).toContain('auth: "user"');
    expect(source).toContain('ctx.supabase.auth.getUser()');
    expect(source).toContain('profile.role !== "ADMIN"');
    expect(source).toContain('account.owner_profile_id !== user.id');
    expect(source).toContain('account.status !== "ACTIVE"');
  });

  it("retorna ao callback oficial e preserva a instituição selecionada", () => {
    expect(source).toContain('.from("institutions")');
    expect(source).toContain('select("id, account_id, active")');
    expect(source).toContain('callback.searchParams.set("institutionId", institutionId)');
    expect(source).toContain('PLATFORM_ORIGIN');
    expect(source).toContain('callback.searchParams.set("returnTo", "/admin")');
  });

  it("usa link magiclink de uso único e não devolve tokens de sessão", () => {
    expect(source).toContain('auth.admin.generateLink');
    expect(source).toContain('type: "magiclink"');
    expect(source).toContain('generatedLink.properties.action_link');
    expect(source).not.toContain('access_token');
    expect(source).not.toContain('refresh_token');
    expect(source).not.toContain('service_role');
  });

  it("rejeita fallback para um Site URL legado ou callback não permitido", () => {
    expect(source).toContain('getActionLinkRedirect(generatedLink.properties.action_link)');
    expect(source).toContain('SSO_REDIRECT_NOT_ALLOWED');
    expect(source).toContain('expectedOrigin: PLATFORM_ORIGIN');
  });

  it("responde sem cache e suporta preflight", () => {
    expect(source).toContain('"cache-control": "no-store"');
    expect(source).toContain('request.method === "OPTIONS"');
    expect(source).toContain('access-control-allow-origin');
  });
});
