import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";
import {
  buildInstitutionMessageEmail,
  type InstitutionMessageEmail,
} from "../_shared/institution-email.ts";

type Audience =
  | "STUDENTS"
  | "GUARDIANS"
  | "STUDENTS_AND_GUARDIANS"
  | "SELECTED";
type RecipientKind = "STUDENT" | "GUARDIAN";

interface InstitutionRecord {
  id: string;
  name: string;
  active: boolean | null;
  account_id: string | null;
  logo_url: string | null;
  login_display_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accounts?: { status?: string | null } | { status?: string | null }[] | null;
}

interface Recipient {
  id: string;
  kind: RecipientKind;
  name: string;
  email: string | null;
}

interface StudentQueryRow {
  profile_id: string;
  active: boolean | null;
  profiles:
    | { full_name: string; email: string | null; active: boolean | null }
    | { full_name: string; email: string | null; active: boolean | null }[]
    | null;
}

interface GuardianQueryRow {
  guardian_profile_id: string;
  active: boolean | null;
  profiles:
    | { full_name: string; email: string | null; active: boolean | null }
    | { full_name: string; email: string | null; active: boolean | null }[]
    | null;
  students:
    | { institution_id: string; active: boolean | null }
    | { institution_id: string; active: boolean | null }[]
    | null;
}

interface AuthorizedContext {
  requesterId: string;
  institution: InstitutionRecord;
}

const audienceSchema = z.enum([
  "STUDENTS",
  "GUARDIANS",
  "STUDENTS_AND_GUARDIANS",
  "SELECTED",
]);

const contentSchema = z.object({
  institutionId: z.guid("Instituicao invalida"),
  audience: audienceSchema,
  selectedRecipientIds: z.array(z.string().min(3).max(100)).max(500).optional(),
  subject: z
    .string()
    .trim()
    .min(3, "Informe o assunto do e-mail.")
    .max(160, "O assunto deve ter no maximo 160 caracteres.")
    .refine((value) => !/[\r\n]/.test(value), "O assunto contem caracteres invalidos."),
  title: z.string().trim().max(120, "O titulo deve ter no maximo 120 caracteres.").optional(),
  message: z.string().trim().min(1, "Informe a mensagem.").max(12000, "A mensagem e muito longa."),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Cor primaria invalida.").optional(),
  secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Cor secundaria invalida.").optional(),
});

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list_recipients"), institutionId: z.guid("Instituicao invalida") }),
  z.object({ action: z.literal("preview"), ...contentSchema.shape }),
  z.object({ action: z.literal("send"), ...contentSchema.shape }),
]);

type RequestData = z.infer<typeof requestSchema>;
type ContentData = z.infer<typeof contentSchema>;

class EmailFunctionError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "EmailFunctionError";
    this.status = status;
    this.code = code;
  }
}

function jsonError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  fieldErrors?: Record<string, string>,
): Response {
  return Response.json(
    {
      success: false,
      code,
      message,
      requestId,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
    { status },
  );
}

function normalizeRelation<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return email.length > 0 ? email : null;
}

function recipientId(kind: RecipientKind, profileId: string): string {
  return `${kind}:${profileId}`;
}

function getAccountStatus(
  relation: InstitutionRecord["accounts"],
): string | null {
  return normalizeRelation(relation)?.status ?? null;
}

async function getAuthorizedContext(
  supabase: SupabaseClient<Database>,
  supabaseAdmin: SupabaseClient<Database>,
  institutionId: string,
): Promise<AuthorizedContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new EmailFunctionError(401, "UNAUTHENTICATED", "Sessao invalida ou expirada.");
  }

  const { data: requester, error: requesterError } = await supabaseAdmin
    .from("profiles")
    .select("id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (requesterError) throw requesterError;
  if (!requester || requester.active !== true) {
    throw new EmailFunctionError(403, "PROFILE_INACTIVE", "Perfil desativado nao pode enviar e-mails.");
  }

  const { data: institutionData, error: institutionError } = await supabaseAdmin
    .from("institutions")
    .select("id, name, active, account_id, logo_url, login_display_name, primary_color, secondary_color, accounts:account_id(status)")
    .eq("id", institutionId)
    .maybeSingle();

  if (institutionError) throw institutionError;
  const institution = institutionData as InstitutionRecord | null;

  if (!institution || institution.active !== true) {
    throw new EmailFunctionError(404, "INSTITUTION_NOT_FOUND", "Instituicao ativa nao encontrada.");
  }

  if (
    institution.account_id &&
    getAccountStatus(institution.accounts) !== "ACTIVE"
  ) {
    throw new EmailFunctionError(409, "ACCOUNT_NOT_ACTIVE", "A conta da instituicao nao esta ativa.");
  }

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("memberships")
    .select("role, active")
    .eq("profile_id", user.id)
    .eq("institution_id", institutionId);

  if (membershipError) throw membershipError;

  const canSend = (memberships ?? []).some(
    (membership) =>
      membership.active === true &&
      (membership.role === "DIRECTOR" || membership.role === "SECRETARY"),
  );

  if (!canSend) {
    throw new EmailFunctionError(
      403,
      "INSUFFICIENT_PERMISSION",
      "Apenas Diretor(a) e Secretaria podem enviar e-mails institucionais.",
    );
  }

  return { requesterId: user.id, institution };
}

function addRecipient(
  map: Map<string, Recipient>,
  kind: RecipientKind,
  profileId: string,
  profile: { full_name: string; email: string | null; active: boolean | null } | null,
): void {
  if (!profile || profile.active !== true) return;

  const id = recipientId(kind, profileId);
  const email = normalizeEmail(profile.email);
  const current = map.get(id);

  if (!current) {
    map.set(id, {
      id,
      kind,
      name: profile.full_name.trim() || (kind === "STUDENT" ? "Aluno" : "Responsavel"),
      email,
    });
    return;
  }

  if (!current.email && email) current.email = email;
}

async function listRecipients(
  supabase: SupabaseClient<Database>,
  institutionId: string,
): Promise<Recipient[]> {
  const recipients = new Map<string, Recipient>();

  const { data: studentData, error: studentError } = await supabase
    .from("students")
    .select("profile_id, active, profiles:profile_id(full_name, email, active)")
    .eq("institution_id", institutionId)
    .eq("active", true);

  if (studentError) throw studentError;

  for (const row of (studentData ?? []) as unknown as StudentQueryRow[]) {
    addRecipient(
      recipients,
      "STUDENT",
      row.profile_id,
      normalizeRelation(row.profiles),
    );
  }

  const { data: guardianData, error: guardianError } = await supabase
    .from("guardianships")
    .select("guardian_profile_id, active, profiles:guardian_profile_id(full_name, email, active), students:student_id(institution_id, active)")
    .eq("active", true);

  if (guardianError) throw guardianError;

  for (const row of (guardianData ?? []) as unknown as GuardianQueryRow[]) {
    const student = normalizeRelation(row.students);
    if (student?.institution_id !== institutionId || student.active !== true) continue;

    addRecipient(
      recipients,
      "GUARDIAN",
      row.guardian_profile_id,
      normalizeRelation(row.profiles),
    );
  }

  return Array.from(recipients.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR"),
  );
}

function deduplicateByEmail(recipients: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const key = recipient.email ?? recipient.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectAudience(
  recipients: Recipient[],
  audience: Audience,
  selectedRecipientIds: string[] | undefined,
): Recipient[] {
  if (audience === "SELECTED") {
    const selected = new Set(selectedRecipientIds ?? []);
    return deduplicateByEmail(recipients.filter((recipient) => selected.has(recipient.id)));
  }

  if (audience === "STUDENTS") {
    return recipients.filter((recipient) => recipient.kind === "STUDENT");
  }

  if (audience === "GUARDIANS") {
    return recipients.filter((recipient) => recipient.kind === "GUARDIAN");
  }

  return deduplicateByEmail(recipients);
}

function validateSelectedRecipientIds(
  recipients: Recipient[],
  selectedRecipientIds: string[] | undefined,
): void {
  const allowed = new Set(recipients.map((recipient) => recipient.id));
  if ((selectedRecipientIds ?? []).some((id) => !allowed.has(id))) {
    throw new EmailFunctionError(
      403,
      "RECIPIENT_OUTSIDE_INSTITUTION",
      "Um dos destinatarios selecionados nao pertence a esta instituicao.",
    );
  }
}

function getMessageEmail(
  content: ContentData,
  institution: InstitutionRecord,
  recipient: Recipient,
): InstitutionMessageEmail {
  return buildInstitutionMessageEmail({
    recipientName: recipient.name,
    institutionName: institution.name,
    displayName: institution.login_display_name,
    logoUrl: institution.logo_url,
    primaryColor: content.primaryColor ?? institution.primary_color,
    secondaryColor: content.secondaryColor ?? institution.secondary_color,
    subject: content.subject,
    title: content.title,
    message: content.message,
  });
}

async function sendBatches(
  recipients: Recipient[],
  content: ContentData,
  institution: InstitutionRecord,
): Promise<{ sentCount: number; failedCount: number }> {
  const apiKey = Deno.env.get("resendsenha");
  const from = Deno.env.get("EMAIL_FROM");

  if (!apiKey || !from) {
    throw new EmailFunctionError(
      503,
      "EMAIL_CONFIGURATION_MISSING",
      "O envio de e-mails esta temporariamente indisponivel.",
    );
  }

  let sentCount = 0;
  let failedCount = 0;
  const recipientsWithEmail = recipients.filter((recipient) => recipient.email);

  for (let offset = 0; offset < recipientsWithEmail.length; offset += 100) {
    const batch = recipientsWithEmail.slice(offset, offset + 100).map((recipient) => {
      const email = getMessageEmail(content, institution, recipient);
      return {
        from,
        to: [recipient.email!],
        subject: email.subject,
        html: email.html,
      };
    });

    try {
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        failedCount += batch.length;
      } else {
        sentCount += batch.length;
      }
    } catch {
      failedCount += batch.length;
    }
  }

  return { sentCount, failedCount };
}

function getErrorDetails(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof EmailFunctionError) {
    return { status: error.status, code: error.code, message: error.message };
  }

  if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
    return { status: 422, code: "INVALID_INSTITUTION", message: "Revise a instituicao selecionada." };
  }

  return { status: 500, code: "INTERNAL_ERROR", message: "Nao foi possivel processar o e-mail institucional." };
}

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (request, ctx) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

    if (request.method !== "POST") {
      return jsonError(405, "METHOD_NOT_ALLOWED", "Metodo nao permitido.", requestId);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "INVALID_JSON", "Corpo da requisicao invalido.", requestId);
    }

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return jsonError(
        400,
        "INVALID_PAYLOAD",
        validation.error.issues[0]?.message ?? "Dados invalidos.",
        requestId,
      );
    }

    const input = validation.data as RequestData;

    try {
      const authorized = await getAuthorizedContext(
        ctx.supabase,
        ctx.supabaseAdmin,
        input.institutionId,
      );
      const allRecipients = await listRecipients(ctx.supabaseAdmin, input.institutionId);

      if (input.action === "list_recipients") {
        return Response.json({
          success: true,
          recipients: allRecipients,
        });
      }

      if (input.audience === "SELECTED") {
        validateSelectedRecipientIds(allRecipients, input.selectedRecipientIds);
      }

      const selectedRecipients = selectAudience(
        allRecipients,
        input.audience,
        input.selectedRecipientIds,
      );
      const recipientsWithoutEmail = selectedRecipients.filter((recipient) => !recipient.email).length;
      const firstRecipient = selectedRecipients[0] ?? {
        id: "preview",
        kind: "STUDENT" as const,
        name: "Comunidade escolar",
        email: null,
      };

      if (input.action === "preview") {
        const previewEmail = getMessageEmail(input, authorized.institution, firstRecipient);
        return Response.json({
          success: true,
          recipientCount: selectedRecipients.length,
          recipientsWithoutEmail,
          previewHtml: previewEmail.html,
        });
      }

      const result = await sendBatches(
        selectedRecipients,
        input,
        authorized.institution,
      );

      return Response.json({
        success: true,
        recipientCount: selectedRecipients.length,
        recipientsWithoutEmail,
        ...result,
      });
    } catch (error) {
      const details = getErrorDetails(error);
      console.error("Falha no e-mail institucional", {
        requestId,
        code: details.code,
      });
      return jsonError(details.status, details.code, details.message, requestId);
    }
  }),
};
