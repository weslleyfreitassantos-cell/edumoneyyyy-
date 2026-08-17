export type SchoolAccessRole =
  | "ADMIN"
  | "DIRECTOR"
  | "SECRETARY"
  | "TEACHER"
  | "STUDENT"
  | "GUARDIAN";

const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%&*+-=?";
const ALL_CHARACTERS = `${UPPERCASE}${LOWERCASE}${NUMBERS}${SYMBOLS}`;
const PLATFORM_HOST = "grupotec.dev.br";
const RESERVED_SUBDOMAINS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "dashboard",
  "grupotec",
  "login",
  "mail",
  "platform",
  "portal",
  "resend",
  "send",
  "smtp",
  "static",
  "support",
  "tecescola",
  "www",
]);

export const DEFAULT_PRIMARY_COLOR = "#005bbf";
export const DEFAULT_SECONDARY_COLOR = "#6ffbbe";

export class SchoolAccessConfigurationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SchoolAccessConfigurationError";
    this.code = code;
  }
}

export class SchoolAccessEmailError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SchoolAccessEmailError";
    this.code = code;
  }
}

function secureRandomIndex(maximum: number): number {
  const values = new Uint32Array(1);
  const range = 0x100000000;
  const limit = range - (range % maximum);

  do {
    globalThis.crypto.getRandomValues(values);
  } while (values[0] >= limit);

  return values[0] % maximum;
}

export function generateSecurePassword(length = 20): string {
  if (length < 16) {
    throw new RangeError("A senha deve conter pelo menos 16 caracteres.");
  }

  const requiredCharacters = [
    UPPERCASE,
    LOWERCASE,
    NUMBERS,
    SYMBOLS,
  ].map((characters) => characters[secureRandomIndex(characters.length)]);

  const passwordCharacters = [
    ...requiredCharacters,
    ...Array.from({ length: length - requiredCharacters.length }, () =>
      ALL_CHARACTERS[secureRandomIndex(ALL_CHARACTERS.length)]),
  ];

  for (let index = passwordCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [passwordCharacters[index], passwordCharacters[swapIndex]] = [
      passwordCharacters[swapIndex],
      passwordCharacters[index],
    ];
  }

  return passwordCharacters.join("");
}

export function getSchoolAccessRoleLabel(role: SchoolAccessRole): string {
  const labels: Record<SchoolAccessRole, string> = {
    ADMIN: "Administrador(a)",
    DIRECTOR: "Diretor(a)",
    SECRETARY: "Secretaria",
    TEACHER: "Professor(a)",
    STUDENT: "Aluno(a)",
    GUARDIAN: "Responsável",
  };

  return labels[role];
}

export function buildInstitutionLoginUrl(subdomain: string | null | undefined): string {
  const normalizedSubdomain = subdomain?.trim().toLowerCase() ?? "";

  if (
    normalizedSubdomain.length < 3 ||
    normalizedSubdomain.length > 63 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSubdomain) ||
    RESERVED_SUBDOMAINS.has(normalizedSubdomain)
  ) {
    throw new SchoolAccessConfigurationError(
      "INSTITUTION_SUBDOMAIN_REQUIRED",
      "Configure o subdomínio da instituição antes de criar e enviar o acesso.",
    );
  }

  return `https://${normalizedSubdomain}.${PLATFORM_HOST}/login`;
}

export function sanitizeHexColor(
  value: string | null | undefined,
  fallback: string,
): string {
  return value && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim()
    : fallback;
}

export function getContrastTextColor(backgroundColor: string): string {
  const safeColor = sanitizeHexColor(backgroundColor, DEFAULT_PRIMARY_COLOR);
  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(safeColor.slice(offset + 1, offset + 3), 16) / 255
  );
  const luminance = channels.reduce((total, channel, index) => {
    const linearChannel = channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;

    return total + linearChannel * [0.2126, 0.7152, 0.0722][index];
  }, 0);

  return luminance > 0.179 ? "#0f172a" : "#ffffff";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function safeAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export interface SchoolAccessEmailInput {
  recipientName: string;
  recipientEmail: string;
  institutionName: string;
  displayName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  role: SchoolAccessRole;
  loginUrl: string;
  password?: string;
}

export function buildSchoolAccessEmail({
  recipientName,
  recipientEmail,
  institutionName,
  displayName,
  logoUrl,
  primaryColor,
  secondaryColor,
  role,
  loginUrl,
  password,
}: SchoolAccessEmailInput): { subject: string; html: string } {
  const safeDisplayName = (displayName?.trim() || institutionName.trim());
  const safePrimaryColor = sanitizeHexColor(primaryColor, DEFAULT_PRIMARY_COLOR);
  const safeSecondaryColor = sanitizeHexColor(secondaryColor, DEFAULT_SECONDARY_COLOR);
  const primaryContrastText = getContrastTextColor(safePrimaryColor);
  const secondaryContrastText = getContrastTextColor(safeSecondaryColor);
  const safeLogoUrl = safeAssetUrl(logoUrl);
  const safeLoginUrl = escapeHtml(loginUrl);
  const hasPassword = typeof password === "string" && password.length > 0;
  const subject = hasPassword
    ? `Seu acesso está pronto | ${safeDisplayName}`
    : `Novo acesso disponível | ${safeDisplayName}`;
  const credentialBlock = hasPassword
    ? `
      <tr>
        <td style="padding:12px 0 4px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Senha de acesso</td>
      </tr>
      <tr>
        <td style="padding:0 0 12px;color:#0f172a;font-size:18px;font-weight:700;letter-spacing:1px;">${escapeHtml(password)}</td>
      </tr>`
    : `
      <tr>
        <td style="padding:12px 0;color:#334155;font-size:14px;line-height:22px;">Um novo acesso foi adicionado à sua conta. Acesse usando seu e-mail e sua senha atual.</td>
      </tr>`;
  const logoBlock = safeLogoUrl
    ? `<img src="${escapeHtml(safeLogoUrl)}" alt="Logo de ${escapeHtml(safeDisplayName)}" width="180" style="display:block;max-width:180px;height:auto;margin:0 auto;border:0;">`
    : `<div style="font-size:22px;font-weight:700;color:${primaryContrastText};">${escapeHtml(safeDisplayName)}</div>`;
  const passwordRecommendation = hasPassword
    ? "Por segurança, recomendamos que você altere sua senha após o primeiro acesso."
    : "Se você não reconhece este acesso, entre em contato com a instituição.";

  return {
    subject,
    html: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td align="center" style="padding:24px;background:${safePrimaryColor};color:${primaryContrastText};">${logoBlock}</td></tr>
          <tr><td style="padding:32px 28px;">
            <p style="margin:0 0 12px;font-size:16px;line-height:24px;">Olá, ${escapeHtml(recipientName)}.</p>
            <h1 style="margin:0 0 12px;font-size:24px;line-height:32px;color:${safePrimaryColor};">Seja bem-vindo(a)!</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#475569;">Seu acesso ao ambiente digital está pronto.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
              <tr><td style="padding:0 0 4px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Usuário</td></tr>
              <tr><td style="padding:0 0 12px;color:#0f172a;font-size:16px;font-weight:700;">${escapeHtml(recipientEmail)}</td></tr>
              ${credentialBlock}
            </table>
            <p style="margin:24px 0 12px;text-align:center;"><a href="${safeLoginUrl}" style="display:inline-block;padding:13px 22px;background:${safeSecondaryColor};color:${secondaryContrastText};text-decoration:none;font-weight:700;border-radius:8px;">Acessar meu ambiente</a></p>
            <p style="margin:0 0 24px;text-align:center;font-size:17px;line-height:1.5;font-weight:700;color:${safePrimaryColor};">${escapeHtml(safeDisplayName)}</p>
            <p style="margin:0 0 12px;font-size:13px;line-height:20px;color:#475569;word-break:break-all;">${safeLoginUrl}</p>
            <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">${passwordRecommendation}</p>
            <p style="margin:10px 0 0;font-size:13px;line-height:20px;color:#64748b;">Não compartilhe sua senha com outras pessoas.</p>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;">Tecnologia fornecida por GrupoTec.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}

export async function sendSchoolAccessEmail(
  input: SchoolAccessEmailInput,
): Promise<void> {
  const apiKey = Deno.env.get("resendsenha")?.trim();
  const from = Deno.env.get("EMAIL_FROM")?.trim();

  if (!apiKey || !from) {
    throw new SchoolAccessEmailError(
      "EMAIL_PROVIDER_NOT_CONFIGURED",
      "O provedor de e-mail não está configurado.",
    );
  }

  const { subject, html } = buildSchoolAccessEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.recipientEmail],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new SchoolAccessEmailError(
      "EMAIL_DELIVERY_FAILED",
      "Não foi possível enviar o e-mail de acesso.",
    );
  }
}
