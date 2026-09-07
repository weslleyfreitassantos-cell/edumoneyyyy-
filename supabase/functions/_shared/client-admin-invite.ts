const DEFAULT_PRIMARY_COLOR = "#005CA9";
const DEFAULT_SECONDARY_COLOR = "#E30613";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeColor(value: string | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "")
    ? value!
    : DEFAULT_PRIMARY_COLOR;
}

function getEnvironmentValue(name: string): string | undefined {
  return typeof Deno === "undefined" ? undefined : Deno.env.get(name) ?? undefined;
}

export interface ClientAdminAccessEmailInput {
  accountName: string;
  recipientName: string;
  recipientEmail: string;
  temporaryPassword: string;
  loginUrl: string;
}

export function buildClientAdminAccessEmail({
  accountName,
  recipientName,
  recipientEmail,
  temporaryPassword,
  loginUrl,
}: ClientAdminAccessEmailInput): {
  subject: string;
  html: string;
} {
  const safeAccountName = escapeHtml(accountName);
  const safeRecipientName = escapeHtml(recipientName);
  const safeRecipientEmail = escapeHtml(recipientEmail);
  const safeTemporaryPassword = escapeHtml(temporaryPassword);
  const safeLoginUrl = escapeHtml(loginUrl);
  const primaryColor = safeColor(getEnvironmentValue("EMAIL_PRIMARY_COLOR"));
  const configuredSecondaryColor = getEnvironmentValue("EMAIL_SECONDARY_COLOR");
  const secondaryColor = /^#[0-9a-f]{6}$/i.test(
    configuredSecondaryColor ?? "",
  )
    ? configuredSecondaryColor!
    : DEFAULT_SECONDARY_COLOR;

  return {
    subject: `Seu acesso administrativo - ${accountName}`,
    html: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 28px;background:${primaryColor};color:#ffffff;">
            <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Acesso administrativo</p>
            <h1 style="margin:10px 0 0;font-size:24px;line-height:32px;">${safeAccountName}</h1>
          </td></tr>
          <tr><td style="padding:32px 28px;">
            <p style="margin:0 0 12px;font-size:16px;line-height:24px;">Olá, ${safeRecipientName}.</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#475569;">Sua conta de administrador foi criada. Use os dados abaixo para acessar a plataforma.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
              <tr><td style="padding:0 0 4px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">E-mail</td></tr>
              <tr><td style="padding:0 0 12px;color:#0f172a;font-size:16px;font-weight:700;">${safeRecipientEmail}</td></tr>
              <tr><td style="padding:0 0 4px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Senha temporária</td></tr>
              <tr><td style="padding:0;color:#0f172a;font-size:18px;font-weight:700;letter-spacing:1px;">${safeTemporaryPassword}</td></tr>
            </table>
            <p style="margin:24px 0 12px;text-align:center;"><a href="${safeLoginUrl}" style="display:inline-block;padding:13px 22px;background:${secondaryColor};color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Acessar plataforma</a></p>
            <p style="margin:0 0 10px;font-size:13px;line-height:20px;color:#64748b;word-break:break-all;">${safeLoginUrl}</p>
            <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">Por segurança, altere sua senha após o primeiro acesso e não compartilhe estes dados.</p>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;">Tecnologia fornecida por GrupoTec.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
