import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  escapeHtml,
  getContrastTextColor,
  safeAssetUrl,
  sanitizeHexColor,
} from "./school-access.ts";

export interface InstitutionMessageEmailInput {
  recipientName: string;
  institutionName: string;
  displayName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  subject: string;
  title?: string | null;
  message: string;
}

export interface InstitutionMessageEmail {
  subject: string;
  html: string;
}

export function renderInstitutionMessage(
  message: string,
  recipientName: string,
  institutionName: string,
): string {
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br>");
  return safeMessage
    .replace(/\{\{nome\}\}/g, escapeHtml(recipientName))
    .replace(/\{\{escola\}\}/g, escapeHtml(institutionName));
}

export function buildInstitutionMessageEmail({
  recipientName,
  institutionName,
  displayName,
  logoUrl,
  primaryColor,
  secondaryColor,
  subject,
  title,
  message,
}: InstitutionMessageEmailInput): InstitutionMessageEmail {
  const safeInstitutionName = institutionName.trim() || "Instituicao";
  const safeDisplayName = displayName?.trim() || safeInstitutionName;
  const safePrimaryColor = sanitizeHexColor(
    primaryColor,
    DEFAULT_PRIMARY_COLOR,
  );
  const safeSecondaryColor = sanitizeHexColor(
    secondaryColor,
    DEFAULT_SECONDARY_COLOR,
  );
  const primaryContrastText = getContrastTextColor(safePrimaryColor);
  const secondaryContrastText = getContrastTextColor(safeSecondaryColor);
  const safeLogoUrl = safeAssetUrl(logoUrl);
  const safeTitle = title?.trim() || "Comunicado da escola";
  const renderedMessage = renderInstitutionMessage(
    message,
    recipientName,
    safeInstitutionName,
  );
  const logoBlock = safeLogoUrl
    ? `<img src="${escapeHtml(safeLogoUrl)}" alt="Logo de ${escapeHtml(safeDisplayName)}" width="180" style="display:block;max-width:180px;height:auto;margin:0 auto;border:0;">`
    : `<div style="font-size:22px;font-weight:700;color:${primaryContrastText};">${escapeHtml(safeDisplayName)}</div>`;

  return {
    subject: subject.trim(),
    html: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td align="center" style="padding:24px;background:${safePrimaryColor};color:${primaryContrastText};">${logoBlock}</td></tr>
          <tr><td style="padding:32px 28px;">
            <p style="margin:0 0 12px;font-size:16px;line-height:24px;">Olá, ${escapeHtml(recipientName)}.</p>
            <h1 style="margin:0 0 18px;font-size:24px;line-height:32px;color:${safePrimaryColor};">${escapeHtml(safeTitle)}</h1>
            <p style="margin:0;font-size:15px;line-height:25px;color:#334155;">${renderedMessage}</p>
            <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;text-align:center;font-size:14px;line-height:22px;font-weight:700;color:${safePrimaryColor};">${escapeHtml(safeDisplayName)}</p>
            <p style="margin:8px 0 0;text-align:center;font-size:12px;line-height:18px;color:#64748b;">Mensagem enviada pela sua instituição.</p>
          </td></tr>
          <tr><td style="padding:16px 28px;background:${safeSecondaryColor};color:${secondaryContrastText};text-align:center;font-size:12px;line-height:18px;">${escapeHtml(safeInstitutionName)}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
