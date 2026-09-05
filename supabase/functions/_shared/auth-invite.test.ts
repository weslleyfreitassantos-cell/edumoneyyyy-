import { describe, expect, it } from "vitest";

import {
  AUTH_INVITE_FAILURE_CODES,
  classifyAuthInviteError,
} from "./auth-invite.ts";

describe("auth invite helpers", () => {
  it("classifica a falha conhecida de envio do Supabase Auth", () => {
    expect(
      classifyAuthInviteError({
        status: 500,
        code: "unexpected_failure",
        message: "Error sending invite email",
      }),
    ).toMatchObject({
      status: 502,
      code: AUTH_INVITE_FAILURE_CODES.SMTP_CONFIGURATION_ERROR,
    });
  });

  it("classifica rate limit e rejeição do provider", () => {
    expect(
      classifyAuthInviteError({ status: 429, message: "too many requests" }).code,
    ).toBe(AUTH_INVITE_FAILURE_CODES.RATE_LIMITED);
    expect(
      classifyAuthInviteError({ status: 403, message: "provider rejected" }).code,
    ).toBe(AUTH_INVITE_FAILURE_CODES.EMAIL_PROVIDER_REJECTED);
  });

  it("mantém falhas desconhecidas sem expor credenciais", () => {
    const failure = classifyAuthInviteError({
      status: 500,
      message: "Authorization: Bearer secret-token",
    });

    expect(failure.code).toBe(AUTH_INVITE_FAILURE_CODES.INVITE_EMAIL_FAILED);
    expect(failure.diagnosticMessage).toContain("Bearer [redacted]");
    expect(failure.diagnosticMessage).not.toContain("secret-token");
  });
});
