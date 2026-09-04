export const RESEND_FAILURE_CODES = {
  NOT_CONFIGURED: "RESEND_NOT_CONFIGURED",
  AUTH_ERROR: "RESEND_AUTH_ERROR",
  FORBIDDEN: "RESEND_FORBIDDEN",
  DOMAIN_NOT_VERIFIED: "RESEND_DOMAIN_NOT_VERIFIED",
  SENDER_NOT_ALLOWED: "RESEND_SENDER_NOT_ALLOWED",
  QUOTA_EXCEEDED: "RESEND_QUOTA_EXCEEDED",
  RATE_LIMITED: "RESEND_RATE_LIMITED",
  PROVIDER_ERROR: "RESEND_PROVIDER_ERROR",
  NETWORK_ERROR: "RESEND_NETWORK_ERROR",
} as const;

export type ResendFailureCode =
  (typeof RESEND_FAILURE_CODES)[keyof typeof RESEND_FAILURE_CODES];

export interface ResendFailure {
  code: ResendFailureCode;
  status: number | null;
  statusText: string | null;
  providerCode: string | null;
  message: string;
  publicMessage: string;
}

export interface ResendEmailInput {
  to: string;
  from: string;
  subject: string;
  html: string;
}

export interface ResendEmailResult {
  ok: boolean;
  failure: ResendFailure | null;
}

const MAX_DIAGNOSTIC_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function sanitizeProviderText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(
      /(api[_-]?key|authorization|password|token)\s*[:=]\s*(?!Bearer\b)[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .slice(0, MAX_DIAGNOSTIC_LENGTH);
}

export function parseProviderErrorBody(bodyText: string): {
  providerCode: string | null;
  message: string;
} {
  const fallbackMessage = sanitizeProviderText(bodyText.trim());

  if (!bodyText.trim()) {
    return {
      providerCode: null,
      message: "Resposta vazia do provedor.",
    };
  }

  try {
    const body: unknown = JSON.parse(bodyText);
    const source = isRecord(body) && isRecord(body.error) ? body.error : body;

    if (isRecord(source)) {
      return {
        providerCode:
          getString(source.name) ??
          getString(source.code) ??
          getString(source.type),
        message:
          sanitizeProviderText(
            getString(source.message) ??
              getString(source.error) ??
              fallbackMessage,
          ) || "Resposta inválida do provedor.",
      };
    }
  } catch {
    // O provedor pode responder texto puro; o texto já foi limitado e sanitizado.
  }

  return {
    providerCode: null,
    message: fallbackMessage || "Resposta inválida do provedor.",
  };
}

function getPublicMessage(code: ResendFailureCode): string {
  switch (code) {
    case RESEND_FAILURE_CODES.NOT_CONFIGURED:
      return "O serviço de e-mail ainda não está configurado.";
    case RESEND_FAILURE_CODES.AUTH_ERROR:
      return "O serviço de e-mail recusou as credenciais configuradas.";
    case RESEND_FAILURE_CODES.FORBIDDEN:
      return "O serviço de e-mail recusou esta operação.";
    case RESEND_FAILURE_CODES.DOMAIN_NOT_VERIFIED:
      return "O domínio do remetente não está verificado no serviço de e-mail.";
    case RESEND_FAILURE_CODES.SENDER_NOT_ALLOWED:
      return "O remetente configurado não está autorizado no serviço de e-mail.";
    case RESEND_FAILURE_CODES.QUOTA_EXCEEDED:
      return "O serviço de e-mail atingiu temporariamente o limite configurado.";
    case RESEND_FAILURE_CODES.RATE_LIMITED:
      return "O serviço de e-mail recebeu muitas solicitações. Tente novamente mais tarde.";
    case RESEND_FAILURE_CODES.NETWORK_ERROR:
      return "Não foi possível conectar ao serviço de e-mail.";
    default:
      return "O serviço de e-mail está temporariamente indisponível.";
  }
}

export function classifyResendFailure(input: {
  status: number | null;
  statusText?: string | null;
  providerCode?: string | null;
  message?: string | null;
}): ResendFailureCode {
  const signal = `${input.providerCode ?? ""} ${input.message ?? ""}`.toLowerCase();

  if (
    input.status === null &&
    /network|fetch|timeout|timed out|connection|dns|socket/.test(signal)
  ) {
    return RESEND_FAILURE_CODES.NETWORK_ERROR;
  }

  if (
    input.status === 429 ||
    /rate[ _-]?limit|too many|throttl/.test(signal)
  ) {
    return RESEND_FAILURE_CODES.RATE_LIMITED;
  }

  if (
    input.status === 402 ||
    /quota|daily limit|monthly limit|credit/.test(signal)
  ) {
    return RESEND_FAILURE_CODES.QUOTA_EXCEEDED;
  }

  if (
    /domain.*(verif|valid|authoriz)|(?:not|un)verif.*domain|domain_not_verified/.test(
      signal,
    )
  ) {
    return RESEND_FAILURE_CODES.DOMAIN_NOT_VERIFIED;
  }

  if (
    /sender|from[_ -]?address|from address|sender_not_allowed|invalid[_ -]?from/.test(
      signal,
    )
  ) {
    return RESEND_FAILURE_CODES.SENDER_NOT_ALLOWED;
  }

  if (
    input.status === 401 ||
    /api[_ -]?key|authentication|unauthori[sz]ed|invalid credential/.test(signal)
  ) {
    return RESEND_FAILURE_CODES.AUTH_ERROR;
  }

  if (input.status === 403) {
    return RESEND_FAILURE_CODES.FORBIDDEN;
  }

  return RESEND_FAILURE_CODES.PROVIDER_ERROR;
}

export function createResendFailure(input: {
  status: number | null;
  statusText?: string | null;
  providerCode?: string | null;
  message?: string | null;
}): ResendFailure {
  const statusText = getString(input.statusText) ?? null;
  const providerCode = getString(input.providerCode) ?? null;
  const message = sanitizeProviderText(input.message) || "Resposta inválida do provedor.";
  const code = classifyResendFailure({
    status: input.status,
    statusText,
    providerCode,
    message,
  });

  return {
    code,
    status: input.status,
    statusText,
    providerCode,
    message,
    publicMessage: getPublicMessage(code),
  };
}

export async function readResendFailure(response: Response): Promise<ResendFailure> {
  const body = parseProviderErrorBody(await response.text());
  return createResendFailure({
    status: response.status,
    statusText: response.statusText,
    providerCode: body.providerCode,
    message: body.message,
  });
}

export function createResendNetworkFailure(error: unknown): ResendFailure {
  const message = error instanceof Error ? error.message : "Falha de rede.";
  return createResendFailure({
    status: null,
    statusText: null,
    providerCode: null,
    message,
  });
}

export function getResendApiKey(
  getEnv: (name: string) => string | undefined | null,
): string | null {
  return getEnv("RESEND_API_KEY")?.trim() || getEnv("resendsenha")?.trim() || null;
}

export async function sendResendEmail(
  input: ResendEmailInput,
  getEnv: (name: string) => string | undefined | null = (name) =>
    Deno.env.get(name),
): Promise<ResendEmailResult> {
  const apiKey = getResendApiKey(getEnv);

  if (!apiKey || !input.from.trim()) {
    return {
      ok: false,
      failure: {
        code: RESEND_FAILURE_CODES.NOT_CONFIGURED,
        status: null,
        statusText: null,
        providerCode: null,
        message: "Credenciais ou remetente do provedor ausentes.",
        publicMessage: getPublicMessage(RESEND_FAILURE_CODES.NOT_CONFIGURED),
      },
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!response.ok) {
      return { ok: false, failure: await readResendFailure(response) };
    }

    return { ok: true, failure: null };
  } catch (error) {
    return { ok: false, failure: createResendNetworkFailure(error) };
  }
}
