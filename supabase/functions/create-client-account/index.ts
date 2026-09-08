import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import {
  buildIdentityConflict,
  getExistingProfileIdentityConflict,
  normalizeIdentityEmail,
  type ExistingIdentityProfile,
  type IdentityConflict,
} from "../_shared/identity-protection.ts";
import { buildClientAdminAccessEmail } from "../_shared/client-admin-invite.ts";
import type { Database } from "../_shared/database.types.ts";
import { sendResendEmail } from "../_shared/resend.ts";
import { generateSecurePassword } from "../_shared/school-access.ts";

interface RollbackState {
  createdAuthUserId: string | null;
  createdAccountId: string | null;
}

class AccountError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string>;

  constructor({
    status,
    code,
    message,
    fieldErrors,
  }: {
    status: number;
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
  }) {
    super(message);
    this.name = "AccountError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const requestSchema = z
  .object({
    accountName: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, " "))
      .pipe(z.string().min(3).max(120)),
    adminFullName: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, " "))
      .pipe(z.string().min(3).max(120)),
    adminEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email(),
    institutionLimit: z.number().int().min(1).max(500),
  })
  .strict();

type RequestData = z.infer<typeof requestSchema>;

function jsonError(error: AccountError): Response {
  return Response.json(
    {
      success: false,
      code: error.code,
      message: error.message,
      ...(error.fieldErrors
        ? { fieldErrors: error.fieldErrors }
        : {}),
    },
    { status: error.status },
  );
}

function accountErrorFromIdentityConflict(
  conflict: IdentityConflict,
): AccountError {
  return new AccountError({
    status: conflict.status,
    code: conflict.code,
    message: conflict.message,
    fieldErrors: conflict.fieldErrors,
  });
}

function isLocalhostUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
}

function getAppUrl(requestUrl: string): string {
  const appUrl = Deno.env.get("APP_URL")?.replace(/\/+$/, "");

  const resolvedUrl = appUrl || new URL(requestUrl).origin;

  if (isLocalhostUrl(resolvedUrl)) {
    throw new AccountError({
      status: 500,
      code: "LOCALHOST_APP_URL",
      message: "A URL da aplicacao nao pode ser localhost em ambiente de producao.",
    });
  }

  return resolvedUrl;
}

function isDuplicateAuthError(message: string | undefined): boolean {
  const normalized = message?.toLowerCase() ?? "";

  return (
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("exists") ||
    normalized.includes("duplicate")
  );
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    fields[field] ??= issue.message;
  }

  return fields;
}

async function assertSuperAdmin(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await ctx.supabase.auth.getUser();

  if (userError || !user) {
    throw new AccountError({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Sessao invalida ou expirada.",
    });
  }

  const { data: profile, error: profileError } =
    await ctx.supabaseAdmin
      .from("profiles")
      .select("id, platform_role, active")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile || profile.active !== true) {
    throw new AccountError({
      status: 403,
      code: "PROFILE_INACTIVE",
      message: "Perfil desativado nao pode criar contas.",
    });
  }

  if (profile.platform_role !== "SUPER_ADMIN") {
    throw new AccountError({
      status: 403,
      code: "SUPER_ADMIN_REQUIRED",
      message: "Apenas SUPER_ADMIN pode criar contas.",
    });
  }

  return user.id;
}

async function findExistingProfileByEmail(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  email: string,
): Promise<ExistingIdentityProfile | null> {
  const { data, error } = await ctx.supabaseAdmin
    .from("profiles")
    .select("id, email, role, active, platform_role")
    .ilike("email", email)
    .limit(10);

  if (error) {
    throw error;
  }

  return (
    (data ?? []).find(
      (profile) =>
        normalizeIdentityEmail(profile.email) === email,
    ) ?? null
  );
}

async function profileOwnsAccount(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  profileId: string,
): Promise<boolean> {
  const { data, error } = await ctx.supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("owner_profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function createOwnerProfile(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  input: RequestData,
  rollback: RollbackState,
): Promise<{
  profileId: string;
  email: string;
  temporaryPassword: string;
  reusedExistingUser: boolean;
}> {
  const normalizedEmail = normalizeIdentityEmail(input.adminEmail);
  const existingProfile = await findExistingProfileByEmail(
    ctx,
    normalizedEmail,
  );

  const ownsAccount = existingProfile
    ? await profileOwnsAccount(ctx, existingProfile.id)
    : false;

  if (existingProfile) {
    const conflict = getExistingProfileIdentityConflict(
      existingProfile,
      ownsAccount,
      "adminEmail",
    );

    if (conflict) {
      throw accountErrorFromIdentityConflict(conflict);
    }
  }

  const temporaryPassword = generateSecurePassword();

  const { data: userData, error: userError } =
    await ctx.supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: input.adminFullName,
        role: "ADMIN",
      },
    });

  if (userError || !userData.user) {
    if (isDuplicateAuthError(userError?.message)) {
      throw accountErrorFromIdentityConflict(
        buildIdentityConflict(
          "AUTH_USER_ALREADY_EXISTS",
          "adminEmail",
        ),
      );
    }

    throw new Error(
      userError?.message ??
        "Nao foi possivel criar o ADMIN.",
    );
  }

  const profileId = userData.user.id;
  rollback.createdAuthUserId = profileId;

  const { error: profileError } = await ctx.supabaseAdmin
    .from("profiles")
    .upsert({
      id: profileId,
      full_name: input.adminFullName,
      email: normalizedEmail,
      role: "ADMIN",
      platform_role: "USER",
      avatar_url: null,
      active: true,
    }, { onConflict: "id" });

  if (profileError) {
    throw profileError;
  }

  return {
    profileId,
    email: normalizedEmail,
    temporaryPassword,
    reusedExistingUser: false,
  };
}

async function updateInvitation(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  invitationId: string,
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
      attempt_count: 1,
      last_attempt_at: input.attemptedAt,
      sent_at: input.sentAt ?? null,
      last_error_code: input.errorCode ?? null,
      last_error_message: input.errorMessage ?? null,
    })
    .eq("id", invitationId);

  if (error) {
    console.error("Falha ao atualizar estado do acesso do administrador", {
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
          new AccountError({
            status: 405,
            code: "METHOD_NOT_ALLOWED",
            message: "Metodo nao permitido.",
          }),
        );
      }

      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return jsonError(
          new AccountError({
            status: 400,
            code: "INVALID_JSON",
            message: "Corpo da requisicao invalido.",
          }),
        );
      }

      const validation = requestSchema.safeParse(body);

      if (!validation.success) {
        return jsonError(
          new AccountError({
            status: 400,
            code: "INVALID_PAYLOAD",
            message:
              validation.error.issues[0]?.message ??
              "Dados invalidos.",
            fieldErrors: toFieldErrors(validation.error),
          }),
        );
      }

      const rollback: RollbackState = {
        createdAuthUserId: null,
        createdAccountId: null,
      };

      try {
        await assertSuperAdmin(ctx);

        const owner = await createOwnerProfile(
          ctx,
          validation.data,
          rollback,
        );

        const { data: account, error: accountError } =
          await ctx.supabaseAdmin
            .from("accounts")
            .insert({
              name: validation.data.accountName,
              owner_profile_id: owner.profileId,
              institution_limit:
                validation.data.institutionLimit,
              status: "ACTIVE",
            })
            .select("id, institution_limit")
            .single();

        if (accountError || !account) {
          throw new Error(
            accountError?.message ??
              "Nao foi possivel criar a conta.",
          );
        }

        rollback.createdAccountId = account.id;

        const { data: invitation, error: invitationError } =
          await ctx.supabaseAdmin
            .from("client_admin_invitations")
            .insert({
              account_id: account.id,
              profile_id: owner.profileId,
              email: owner.email,
              status: "PENDING",
              attempt_count: 0,
            })
            .select("id")
            .single();

        if (invitationError || !invitation) {
          throw invitationError ?? new Error(
            "Nao foi possivel registrar o acesso do ADMIN.",
          );
        }

        const attemptedAt = new Date().toISOString();
        const emailContent = buildClientAdminAccessEmail({
          accountName: validation.data.accountName,
          recipientName: validation.data.adminFullName,
          recipientEmail: owner.email,
          temporaryPassword: owner.temporaryPassword,
          loginUrl: `${getAppUrl(request.url)}/login`,
        });
        const delivery = await sendResendEmail({
          to: owner.email,
          from: Deno.env.get("EMAIL_FROM")?.trim() ?? "",
          subject: emailContent.subject,
          html: emailContent.html,
        });

        if (!delivery.ok || delivery.failure) {
          const failure = delivery.failure;
          console.error("Acesso do ADMIN criado sem entrega de e-mail", {
            code: failure?.code ?? "RESEND_PROVIDER_ERROR",
            status: failure?.status ?? 502,
            providerCode: failure?.providerCode ?? null,
          });
          await updateInvitation(ctx, invitation.id, {
            status: "PENDING",
            attemptedAt,
            errorCode: failure?.code ?? "RESEND_PROVIDER_ERROR",
            errorMessage: failure?.message ?? "Falha no provedor de e-mail.",
          });

          return Response.json(
            {
              success: true,
              accountId: account.id,
              ownerProfileId: owner.profileId,
              ownerEmail: owner.email,
              institutionLimit: account.institution_limit,
              invitationSent: false,
              invitationStatus: "PENDING",
              reusedExistingUser: owner.reusedExistingUser,
            },
            { status: 201 },
          );
        }

        await updateInvitation(ctx, invitation.id, {
          status: "SENT",
          attemptedAt,
          sentAt: attemptedAt,
        });

        return Response.json(
          {
            success: true,
            accountId: account.id,
            ownerProfileId: owner.profileId,
            ownerEmail: normalizeIdentityEmail(
              validation.data.adminEmail,
            ),
            institutionLimit: account.institution_limit,
            invitationSent: true,
            invitationStatus: "SENT",
            reusedExistingUser: owner.reusedExistingUser,
          },
          { status: 201 },
        );
      } catch (error) {
        console.error("Erro ao criar conta:", error);

        if (rollback.createdAuthUserId) {
          try {
            if (rollback.createdAccountId) {
              await ctx.supabaseAdmin
                .from("accounts")
                .delete()
                .eq("id", rollback.createdAccountId);
            }

            await ctx.supabaseAdmin
              .from("profiles")
              .delete()
              .eq("id", rollback.createdAuthUserId);

            await ctx.supabaseAdmin.auth.admin.deleteUser(
              rollback.createdAuthUserId,
            );
          } catch (cleanupError) {
            console.error(
              "Erro no cleanup da conta:",
              cleanupError,
            );
          }
        }

        if (error instanceof AccountError) {
          return jsonError(error);
        }

        return jsonError(
          new AccountError({
            status: 500,
            code: "INTERNAL_ERROR",
            message:
              error instanceof Error && error.message
                ? `Nao foi possivel criar a conta: ${error.message}`
                : "Nao foi possivel criar a conta.",
          }),
        );
      }
    },
  ),
};
