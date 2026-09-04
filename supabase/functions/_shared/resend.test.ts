import { describe, expect, it } from "vitest";

import {
  RESEND_FAILURE_CODES,
  classifyResendFailure,
  createResendFailure,
  getResendApiKey,
  parseProviderErrorBody,
} from "./resend.ts";

describe("resend helpers", () => {
  it("classifica separadamente forbidden, domínio, remetente, rate limit e provider", () => {
    expect(
      classifyResendFailure({ status: 403, message: "forbidden" }),
    ).toBe(RESEND_FAILURE_CODES.FORBIDDEN);
    expect(
      classifyResendFailure({ status: 403, providerCode: "domain_not_verified" }),
    ).toBe(RESEND_FAILURE_CODES.DOMAIN_NOT_VERIFIED);
    expect(
      classifyResendFailure({ status: 400, providerCode: "invalid_from_address" }),
    ).toBe(RESEND_FAILURE_CODES.SENDER_NOT_ALLOWED);
    expect(
      classifyResendFailure({ status: 429, message: "too many requests" }),
    ).toBe(RESEND_FAILURE_CODES.RATE_LIMITED);
    expect(
      classifyResendFailure({ status: 500, message: "upstream failure" }),
    ).toBe(RESEND_FAILURE_CODES.PROVIDER_ERROR);
  });

  it("faz parse seguro do erro do provedor e não mantém credenciais no diagnóstico", () => {
    const parsed = parseProviderErrorBody(
      JSON.stringify({
        name: "invalid_api_key",
        message: "Authorization: Bearer super-secret-value",
      }),
    );

    expect(parsed.providerCode).toBe("invalid_api_key");
    expect(parsed.message).toContain("Bearer [redacted]");
    expect(parsed.message).not.toContain("super-secret-value");
  });

  it("prefere RESEND_API_KEY e mantém fallback para o secret legado", () => {
    expect(
      getResendApiKey((name) =>
        name === "RESEND_API_KEY" ? "preferred" : null,
      ),
    ).toBe("preferred");
    expect(
      getResendApiKey((name) =>
        name === "resendsenha" ? "legacy" : null,
      ),
    ).toBe("legacy");
  });

  it("retorna mensagem pública sem expor a resposta bruta", () => {
    const failure = createResendFailure({
      status: 403,
      providerCode: "forbidden",
      message: "sender rejected",
    });

    expect(failure.code).toBe(RESEND_FAILURE_CODES.SENDER_NOT_ALLOWED);
    expect(failure.publicMessage).not.toContain("sender rejected");
  });
});
