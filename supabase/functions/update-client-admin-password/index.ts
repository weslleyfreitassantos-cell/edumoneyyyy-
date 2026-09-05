import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

type SessionRevocation = "NOT_SUPPORTED";

class PasswordUpdateError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PasswordUpdateError";
  }
}

const requestSchema = z.object({
  accountId: z.string().uuid("Conta invalida."),
  password: z.string().min(8, "A senha deve possuir pelo menos 8 caracteres.").max(
    72,
    "A senha deve possuir no maximo 72 caracteres.",
  ),
}).strict();

function jsonError(error: PasswordUpdateError): Response {
  return Response.json(
    {
      success: false,
      code: error.code,
      message: error.message,
    },
    { status: error.status },
  );
}

async function assertSuperAdmin(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
): Promise<{ requesterId: string }> {
  const {
    data: { user },
    error: userError,
  } = await ctx.supabase.auth.getUser();

  if (userError || !user) {
    throw new PasswordUpdateError(
      401,
      "UNAUTHENTICATED",
      "Sessao invalida ou expirada.",
    );
  }

  const { data: requester, error: requesterError } = await ctx.supabaseAdmin
    .from("profiles")
    .select("id, platform_role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (requesterError) throw requesterError;
  if (!requester || requester.active !== true) {
    throw new PasswordUpdateError(
      403,
      "PROFILE_INACTIVE",
      "Perfil desativado nao pode alterar senhas.",
    );
  }

  if (requester.platform_role !== "SUPER_ADMIN") {
    throw new PasswordUpdateError(
      403,
      "SUPER_ADMIN_REQUIRED",
      "Apenas SUPER_ADMIN pode alterar a senha do administrador.",
    );
  }

  return { requesterId: requester.id };
}

async function resolveAccountOwner(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  accountId: string,
): Promise<{
  accountId: string;
  ownerProfileId: string;
}> {
  const { data: account, error: accountError } = await ctx.supabaseAdmin
    .from("accounts")
    .select("id, owner_profile_id, status")
    .eq("id", accountId)
    .maybeSingle();

  if (accountError) throw accountError;
  if (!account) {
    throw new PasswordUpdateError(
      404,
      "ACCOUNT_NOT_FOUND",
      "Conta nao encontrada.",
    );
  }

  if (account.status !== "ACTIVE") {
    throw new PasswordUpdateError(
      409,
      "ACCOUNT_NOT_ACTIVE",
      "A conta precisa estar ativa para alterar a senha.",
    );
  }

  const { data: owner, error: ownerError } = await ctx.supabaseAdmin
    .from("profiles")
    .select("id, role, platform_role, active")
    .eq("id", account.owner_profile_id)
    .maybeSingle();

  if (ownerError) throw ownerError;
  if (!owner || owner.id !== account.owner_profile_id) {
    throw new PasswordUpdateError(
      409,
      "INVALID_ACCOUNT_OWNER",
      "O administrador dono da conta nao esta elegivel.",
    );
  }

  if (owner.active !== true) {
    throw new PasswordUpdateError(
      409,
      "OWNER_PROFILE_INACTIVE",
      "O administrador dono da conta esta inativo.",
    );
  }

  if (owner.role !== "ADMIN") {
    throw new PasswordUpdateError(
      409,
      "OWNER_ROLE_INVALID",
      "O dono da conta precisa ter o papel ADMIN.",
    );
  }

  if (owner.platform_role === "SUPER_ADMIN") {
    throw new PasswordUpdateError(
      403,
      "OWNER_SUPER_ADMIN_PROTECTED",
      "SUPER_ADMIN nao pode ser alterado por esta acao.",
    );
  }

  return {
    accountId: account.id,
    ownerProfileId: account.owner_profile_id,
  };
}

async function writeAuditEvent(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
  input: {
    requesterProfileId: string;
    accountId: string;
    targetProfileId: string;
  },
): Promise<void> {
  const { error } = await ctx.supabaseAdmin
    .from("platform_security_events")
    .insert({
      event_type: "CLIENT_ADMIN_PASSWORD_CHANGED",
      requester_profile_id: input.requesterProfileId,
      account_id: input.accountId,
      target_profile_id: input.targetProfileId,
    });

  if (error) {
    console.error("Falha ao registrar auditoria de senha", {
      code: "PASSWORD_AUDIT_FAILED",
    });
  }
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return jsonError(
          new PasswordUpdateError(
            405,
            "METHOD_NOT_ALLOWED",
            "Metodo nao permitido.",
          ),
        );
      }

      try {
        const input = requestSchema.parse(await request.json());
        const { requesterId } = await assertSuperAdmin(ctx);
        const target = await resolveAccountOwner(ctx, input.accountId);

        const { error: updateError } =
          await ctx.supabaseAdmin.auth.admin.updateUserById(
            target.ownerProfileId,
            {
              password: input.password,
              email_confirm: true,
            },
          );

        if (updateError) {
          console.error("Falha ao alterar senha do administrador", {
            code: "PASSWORD_UPDATE_FAILED",
            status: updateError.status ?? null,
          });
          throw new PasswordUpdateError(
            422,
            "PASSWORD_UPDATE_FAILED",
            "Nao foi possivel alterar a senha do administrador.",
          );
        }

        await writeAuditEvent(ctx, {
          requesterProfileId: requesterId,
          accountId: target.accountId,
          targetProfileId: target.ownerProfileId,
        });

        const sessionRevocation: SessionRevocation = "NOT_SUPPORTED";
        return Response.json({
          success: true,
          accountId: target.accountId,
          sessionRevocation,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return jsonError(
            new PasswordUpdateError(
              400,
              "INVALID_PASSWORD",
              "Informe uma senha entre 8 e 72 caracteres.",
            ),
          );
        }

        if (error instanceof PasswordUpdateError) {
          return jsonError(error);
        }

        console.error("Erro interno ao alterar senha do administrador", {
          code: "INTERNAL_ERROR",
        });
        return jsonError(
          new PasswordUpdateError(
            500,
            "INTERNAL_ERROR",
            "Nao foi possivel alterar a senha do administrador.",
          ),
        );
      }
    },
  ),
};
