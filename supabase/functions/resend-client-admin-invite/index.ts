import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import { buildClientAdminInviteEmail } from "../_shared/client-admin-invite.ts";
import type { Database } from "../_shared/database.types.ts";
import { sendResendEmail } from "../_shared/resend.ts";

class ResendInviteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ResendInviteError";
  }
}

const requestSchema = z.object({
  accountId: z.string().uuid("Conta invalida."),
}).strict();

function jsonError(error: ResendInviteError): Response {
  return Response.json(
    { success: false, code: error.code, message: error.message },
    { status: error.status },
  );
}

function isLocalhostUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
}

function getAppUrl(): string {
  const appUrl = Deno.env.get("APP_URL")?.replace(/\/+$/, "");

  if (!appUrl) {
    throw new ResendInviteError(
      500,
      "MISSING_APP_URL",
      "A URL da aplicacao nao foi configurada.",
    );
  }

  if (isLocalhostUrl(appUrl)) {
    throw new ResendInviteError(
      500,
      "LOCALHOST_APP_URL",
      "A URL da aplicacao nao pode ser localhost em ambiente de producao.",
    );
  }

  return appUrl;
}

async function assertSuperAdmin(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await ctx.supabase.auth.getUser();

  if (userError || !user) {
    throw new ResendInviteError(401, "UNAUTHENTICATED", "Sessao invalida ou expirada.");
  }

  const { data: profile, error } = await ctx.supabaseAdmin
    .from("profiles")
    .select("id, platform_role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!profile || profile.active !== true) {
    throw new ResendInviteError(
      403,
      "PROFILE_INACTIVE",
      "Perfil desativado nao pode reenviar convites.",
    );
  }

  if (profile.platform_role !== "SUPER_ADMIN") {
    throw new ResendInviteError(
      403,
      "SUPER_ADMIN_REQUIRED",
      "Apenas SUPER_ADMIN pode reenviar convites.",
    );
  }
}

async function updateInvitation(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  invitationId: string,
  attemptCount: number,
  input: {
    status: "PENDING" | "SENT";
    attemptedAt: string;
    sentAt?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  const { error } = await ctx.supabaseAdmin
    .from("client_admin_invitations")
    .update({
      status: input.status,
      attempt_count: attemptCount,
      last_attempt_at: input.attemptedAt,
      sent_at: input.sentAt ?? null,
      last_error_code: input.errorCode ?? null,
      last_error_message: input.errorMessage ?? null,
    })
    .eq("id", invitationId);

  if (error) {
    console.error("Falha ao atualizar estado do reenvio", {
      code: "INVITATION_STATE_UPDATE_FAILED",
    });
  }
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return jsonError(
          new ResendInviteError(405, "METHOD_NOT_ALLOWED", "Metodo nao permitido."),
        );
      }

      try {
        const input = requestSchema.parse(await request.json());
        await assertSuperAdmin(ctx);

        const { data: invitation, error: invitationError } = await ctx.supabaseAdmin
          .from("client_admin_invitations")
          .select("id, account_id, profile_id, email, status, attempt_count")
          .eq("account_id", input.accountId)
          .maybeSingle();

        if (invitationError) throw invitationError;
        if (!invitation) {
          throw new ResendInviteError(
            404,
            "INVITATION_NOT_FOUND",
            "Nenhum convite de administrador foi encontrado para esta conta.",
          );
        }

        if (invitation.status === "ACCEPTED") {
          throw new ResendInviteError(
            409,
            "INVITATION_ALREADY_ACCEPTED",
            "Este convite ja foi aceito e nao precisa ser reenviado.",
          );
        }

        const { data: account, error: accountError } = await ctx.supabaseAdmin
          .from("accounts")
          .select("id, name, owner_profile_id, status")
          .eq("id", invitation.account_id)
          .maybeSingle();

        if (accountError) throw accountError;
        if (!account || account.status !== "ACTIVE") {
          throw new ResendInviteError(
            409,
            "ACCOUNT_NOT_ACTIVE",
            "A conta precisa estar ativa para reenviar o convite.",
          );
        }

        const { data: owner, error: ownerError } = await ctx.supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, role, platform_role, active")
          .eq("id", invitation.profile_id)
          .maybeSingle();

        if (ownerError) throw ownerError;
        if (
          !owner ||
          owner.id !== account.owner_profile_id ||
          owner.role !== "ADMIN" ||
          owner.platform_role === "SUPER_ADMIN" ||
          owner.active !== true
        ) {
          throw new ResendInviteError(
            409,
            "INVALID_ACCOUNT_OWNER",
            "O administrador proprietário desta conta não está elegível para convite.",
          );
        }

        const email = owner.email.trim().toLowerCase();
        const redirectTo = `${getAppUrl()}/reset-password`;
        const { data: generatedLink, error: linkError } =
          await ctx.supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email,
            options: { redirectTo },
          });

        if (linkError || !generatedLink.properties?.action_link) {
          console.error("Falha ao gerar novo link de administrador", {
            code: "INVITATION_LINK_GENERATION_FAILED",
            status: linkError?.status ?? 502,
          });
          throw new ResendInviteError(
            502,
            "INVITATION_LINK_GENERATION_FAILED",
            "Nao foi possivel preparar um novo convite.",
          );
        }

        const attemptedAt = new Date().toISOString();
        const emailContent = buildClientAdminInviteEmail({
          accountName: account.name,
          recipientName: owner.full_name,
          actionLink: generatedLink.properties.action_link,
        });
        const delivery = await sendResendEmail({
          to: email,
          from: Deno.env.get("EMAIL_FROM")?.trim() ?? "",
          subject: emailContent.subject,
          html: emailContent.html,
        });
        const attemptCount = invitation.attempt_count + 1;

        if (!delivery.ok || delivery.failure) {
          const failure = delivery.failure;
          console.error("Reenvio do convite pendente", {
            code: failure?.code ?? "RESEND_PROVIDER_ERROR",
            status: failure?.status ?? null,
            providerCode: failure?.providerCode ?? null,
            message: failure?.message ?? "Falha no provedor de e-mail.",
          });
          await updateInvitation(ctx, invitation.id, attemptCount, {
            status: "PENDING",
            attemptedAt,
            errorCode: failure?.code ?? "RESEND_PROVIDER_ERROR",
            errorMessage: failure?.message ?? "Falha no provedor de e-mail.",
          });
          return Response.json({
            success: true,
            accountId: account.id,
            ownerProfileId: owner.id,
            ownerEmail: email,
            invitationSent: false,
            invitationStatus: "PENDING",
          });
        }

        await updateInvitation(ctx, invitation.id, attemptCount, {
          status: "SENT",
          attemptedAt,
          sentAt: attemptedAt,
        });
        return Response.json({
          success: true,
          accountId: account.id,
          ownerProfileId: owner.id,
          ownerEmail: email,
          invitationSent: true,
          invitationStatus: "SENT",
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return jsonError(
            new ResendInviteError(400, "INVALID_PAYLOAD", "Conta invalida."),
          );
        }

        if (error instanceof ResendInviteError) {
          return jsonError(error);
        }

        console.error("Erro ao reenviar convite do administrador", {
          code: "INTERNAL_ERROR",
          status: 500,
        });
        return jsonError(
          new ResendInviteError(
            500,
            "INTERNAL_ERROR",
            "Nao foi possivel reenviar o convite.",
          ),
        );
      }
    },
  ),
};
