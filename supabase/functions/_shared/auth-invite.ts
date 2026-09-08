export const AUTH_INVITE_FAILURE_CODES = {
  INVITE_EMAIL_FAILED: "AUTH_INVITE_EMAIL_FAILED",
  SMTP_CONFIGURATION_ERROR: "AUTH_SMTP_CONFIGURATION_ERROR",
  EMAIL_PROVIDER_REJECTED: "AUTH_EMAIL_PROVIDER_REJECTED",
  RATE_LIMITED: "AUTH_RATE_LIMITED",
  UNKNOWN: "AUTH_UNKNOWN_INVITE_ERROR",
} as const;

export type AuthInviteFailureCode =
  (typeof AUTH_INVITE_FAILURE_CODES)[keyof typeof AUTH_INVITE_FAILURE_CODES];

export interface AuthInviteFailure {
  status: number;
  code: AuthInviteFailureCode;
  name: string | null;
  providerCode: string | null;
  diagnosticMessage: string;
  publicMessage: string;
}

function getProperty(error: unknown, key: string): unknown {
  if (typeof error !== "object" || error === null || !(key in error)) {
    return null;
  }

  return (error as Record<string, unknown>)[key];
}

function getStringProperty(error: unknown, key: string): string | null {
  const value = getProperty(error, key);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getNumberProperty(error: unknown, key: string): number | null {
  const value = getProperty(error, key);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeDiagnosticMessage(value: string | null): string {
  return (value ?? "Falha desconhecida no convite do Supabase Auth.")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(
      /(api[_-]?key|authorization|password|token)\s*[:=]\s*(?!Bearer\b)[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .slice(0, 500);
}

export function classifyAuthInviteError(error: unknown): AuthInviteFailure {
  const status = getNumberProperty(error, "status");
  const name = getStringProperty(error, "name");
  const providerCode =
    getStringProperty(error, "code") ?? getStringProperty(error, "error_code");
  const diagnosticMessage = sanitizeDiagnosticMessage(
    getStringProperty(error, "message"),
  );
  const signal = `${name ?? ""} ${providerCode ?? ""} ${diagnosticMessage}`.toLowerCase();

  if (
    status === 429 ||
    /rate[ _-]?limit|too many|throttl/.test(signal)
  ) {
    return {
      status: 429,
      code: AUTH_INVITE_FAILURE_CODES.RATE_LIMITED,
      name,
      providerCode,
      diagnosticMessage,
      publicMessage: "O serviço de convites atingiu temporariamente o limite. Tente novamente mais tarde.",
    };
  }

  if (/smtp|mail[_ -]?provider|email[_ -]?provider|send.*email|email.*send/.test(signal)) {
    return {
      status: 502,
      code: AUTH_INVITE_FAILURE_CODES.SMTP_CONFIGURATION_ERROR,
      name,
      providerCode,
      diagnosticMessage,
      publicMessage: "Não foi possível enviar o convite por e-mail. Verifique a configuração de e-mail ou contate o administrador.",
    };
  }

  if (status === 401 || status === 403 || status === 422) {
    return {
      status: 502,
      code: AUTH_INVITE_FAILURE_CODES.EMAIL_PROVIDER_REJECTED,
      name,
      providerCode,
      diagnosticMessage,
      publicMessage: "O serviço de e-mail recusou o convite. Verifique a configuração de e-mail ou contate o administrador.",
    };
  }

  if (status !== null && status >= 500) {
    return {
      status: 502,
      code: AUTH_INVITE_FAILURE_CODES.INVITE_EMAIL_FAILED,
      name,
      providerCode,
      diagnosticMessage,
      publicMessage: "Não foi possível enviar o convite por e-mail. Tente novamente ou contate o administrador.",
    };
  }

  return {
    status: 502,
    code: AUTH_INVITE_FAILURE_CODES.UNKNOWN,
    name,
    providerCode,
    diagnosticMessage,
    publicMessage: "Não foi possível enviar o convite por e-mail. Tente novamente ou contate o administrador.",
  };
}
