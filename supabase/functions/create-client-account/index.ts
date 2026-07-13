import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

interface RollbackState {
  createdAuthUserId: string | null;
  updatedExistingProfile: {
    id: string;
    full_name: string;
    role: Database["public"]["Enums"]["user_role"];
    platform_role: Database["public"]["Enums"]["platform_role"];
    active: boolean | null;
  } | null;
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

function getAppUrl(): string {
  const appUrl = Deno.env.get("APP_URL")?.replace(/\/+$/, "");

  if (!appUrl) {
    throw new AccountError({
      status: 500,
      code: "MISSING_APP_URL",
      message: "A URL da aplicacao nao foi configurada.",
    });
  }

  return appUrl;
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

  if (
    !profile ||
    profile.active !== true ||
    profile.platform_role !== "SUPER_ADMIN"
  ) {
    throw new AccountError({
      status: 403,
      code: "SUPER_ADMIN_REQUIRED",
      message: "Apenas SUPER_ADMIN pode criar contas.",
    });
  }

  return user.id;
}

async function findReusableProfile(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  email: string,
): Promise<{
  id: string;
  full_name: string;
  role: Database["public"]["Enums"]["user_role"];
  active: boolean | null;
  platform_role: Database["public"]["Enums"]["platform_role"];
} | null> {
  const { data, error } = await ctx.supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, active, platform_role")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function ensureNotAccountOwner(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  profileId: string,
): Promise<void> {
  const { data, error } = await ctx.supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("owner_profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    throw new AccountError({
      status: 409,
      code: "OWNER_ALREADY_HAS_ACCOUNT",
      message: "Este ADMIN ja e proprietario de outra conta.",
      fieldErrors: {
        adminEmail: "E-mail ja possui uma conta.",
      },
    });
  }
}

async function createOrReuseOwnerProfile(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  input: RequestData,
  rollback: RollbackState,
): Promise<{
  profileId: string;
  invitationSent: boolean;
  reusedExistingUser: boolean;
}> {
  const existingProfile = await findReusableProfile(
    ctx,
    input.adminEmail,
  );

  if (existingProfile?.platform_role === "SUPER_ADMIN") {
    throw new AccountError({
      status: 409,
      code: "OWNER_CANNOT_BE_SUPER_ADMIN",
      message: "SUPER_ADMIN nao pode ser proprietario de conta cliente.",
      fieldErrors: {
        adminEmail: "Escolha um usuario cliente.",
      },
    });
  }

  if (existingProfile) {
    await ensureNotAccountOwner(ctx, existingProfile.id);
    rollback.updatedExistingProfile = {
      id: existingProfile.id,
      full_name: existingProfile.full_name,
      role: existingProfile.role,
      platform_role: existingProfile.platform_role,
      active: existingProfile.active,
    };

    const { error: updateError } = await ctx.supabaseAdmin
      .from("profiles")
      .update({
        full_name: input.adminFullName,
        role: "ADMIN",
        platform_role: "USER",
        active: true,
      })
      .eq("id", existingProfile.id);

    if (updateError) {
      throw updateError;
    }

    return {
      profileId: existingProfile.id,
      invitationSent: false,
      reusedExistingUser: true,
    };
  }

  const inviteRedirectUrl = `${getAppUrl()}/auth/confirm`;

  const { data: invitationData, error: invitationError } =
    await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(
      input.adminEmail,
      {
        data: {
          full_name: input.adminFullName,
          role: "ADMIN",
        },
        redirectTo: inviteRedirectUrl,
      },
    );

  if (invitationError || !invitationData.user) {
    if (isDuplicateAuthError(invitationError?.message)) {
      throw new AccountError({
        status: 409,
        code: "AUTH_USER_ALREADY_EXISTS",
        message:
          "Ja existe usuario Auth com este e-mail, mas sem profile reutilizavel.",
        fieldErrors: {
          adminEmail: "E-mail ja existe no Auth.",
        },
      });
    }

    throw new Error(
      invitationError?.message ??
        "Nao foi possivel convidar o ADMIN.",
    );
  }

  const profileId = invitationData.user.id;
  rollback.createdAuthUserId = profileId;

  const { error: profileError } = await ctx.supabaseAdmin
    .from("profiles")
    .insert({
      id: profileId,
      full_name: input.adminFullName,
      email: input.adminEmail,
      role: "ADMIN",
      platform_role: "USER",
      avatar_url: null,
      active: true,
    });

  if (profileError) {
    throw profileError;
  }

  return {
    profileId,
    invitationSent: true,
    reusedExistingUser: false,
  };
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
        updatedExistingProfile: null,
      };

      try {
        await assertSuperAdmin(ctx);

        const owner = await createOrReuseOwnerProfile(
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

        return Response.json(
          {
            success: true,
            accountId: account.id,
            ownerProfileId: owner.profileId,
            ownerEmail: validation.data.adminEmail,
            institutionLimit: account.institution_limit,
            invitationSent: owner.invitationSent,
            reusedExistingUser: owner.reusedExistingUser,
          },
          { status: 201 },
        );
      } catch (error) {
        console.error("Erro ao criar conta:", error);

        if (rollback.updatedExistingProfile) {
          try {
            await ctx.supabaseAdmin
              .from("profiles")
              .update({
                full_name:
                  rollback.updatedExistingProfile.full_name,
                role: rollback.updatedExistingProfile.role,
                platform_role:
                  rollback.updatedExistingProfile.platform_role,
                active: rollback.updatedExistingProfile.active,
              })
              .eq("id", rollback.updatedExistingProfile.id);
          } catch (cleanupError) {
            console.error(
              "Erro no rollback do profile da conta:",
              cleanupError,
            );
          }
        }

        if (rollback.createdAuthUserId) {
          try {
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
            message: "Nao foi possivel criar a conta.",
          }),
        );
      }
    },
  ),
};
