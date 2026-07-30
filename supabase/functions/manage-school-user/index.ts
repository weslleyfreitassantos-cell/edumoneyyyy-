import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

type UserRole = Database["public"]["Enums"]["user_role"];
type SupabaseFunctionContext = {
  supabase: {
    auth: {
      getUser: () => Promise<{
        data: { user: { id: string } | null };
        error: unknown;
      }>;
    };
  };
  supabaseAdmin: any;
};

class ManageSchoolUserError extends Error {
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
    this.name = "ManageSchoolUserError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const editableRoleSchema = z.enum([
  "DIRECTOR",
  "SECRETARY",
  "TEACHER",
  "STUDENT",
  "GUARDIAN",
]);

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    institutionId: z.guid(),
    membershipId: z.guid(),
    fullName: z.string().trim().min(3).max(120).optional(),
    role: editableRoleSchema.optional(),
    password: z.string().min(8).max(72).optional(),
  }).strict(),
  z.object({
    action: z.literal("delete"),
    institutionId: z.guid(),
    membershipId: z.guid(),
    confirmation: z.literal("EXCLUIR USUARIO"),
  }).strict(),
]);

type RequestData = z.infer<typeof requestSchema>;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonError(error: ManageSchoolUserError): Response {
  return Response.json(
    {
      success: false,
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    },
    {
      status: error.status,
      headers: corsHeaders,
    },
  );
}

function jsonSuccess(body: Record<string, unknown>): Response {
  return Response.json(body, {
    headers: corsHeaders,
  });
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    fields[field] ??= issue.message;
  }
  return fields;
}

function getErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return null;
}

function toPublicError(error: unknown): ManageSchoolUserError {
  if (error instanceof ManageSchoolUserError) return error;

  const code = getErrorCode(error);
  if (code === "23503") {
    return new ManageSchoolUserError({
      status: 409,
      code: "USER_HAS_RELATED_RECORDS",
      message:
        "Nao foi possivel excluir este usuario porque existem registros academicos vinculados.",
    });
  }
  if (code === "42501") {
    return new ManageSchoolUserError({
      status: 403,
      code: "DATABASE_PERMISSION_DENIED",
      message: "Seu acesso atual nao permite concluir esta acao.",
    });
  }

  return new ManageSchoolUserError({
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Nao foi possivel concluir a acao.",
  });
}

async function getAuthorizedContext(
  ctx: SupabaseFunctionContext,
  requesterId: string,
  institutionId: string,
) {
  const { data: requester, error: requesterError } =
    await ctx.supabaseAdmin
      .from("profiles")
      .select("id, platform_role, active")
      .eq("id", requesterId)
      .maybeSingle();

  if (requesterError) throw requesterError;

  if (!requester || requester.active !== true) {
    throw new ManageSchoolUserError({
      status: 403,
      code: "PROFILE_INACTIVE",
      message: "Perfil desativado nao pode gerenciar usuarios.",
    });
  }

  const { data: institution, error: institutionError } =
    await ctx.supabaseAdmin
      .from("institutions")
      .select("id, active, account_id")
      .eq("id", institutionId)
      .maybeSingle();

  if (institutionError) throw institutionError;
  if (!institution || institution.active !== true) {
    throw new ManageSchoolUserError({
      status: 404,
      code: "INSTITUTION_NOT_FOUND",
      message: "Instituicao ativa nao encontrada.",
    });
  }

  const isSuperAdmin = requester.platform_role === "SUPER_ADMIN";
  let isAccountOwner = false;

  if (institution.account_id) {
    const { data: account, error: accountError } =
      await ctx.supabaseAdmin
        .from("accounts")
        .select("owner_profile_id, status")
        .eq("id", institution.account_id)
        .maybeSingle();

    if (accountError) throw accountError;
    isAccountOwner =
      account?.status === "ACTIVE" &&
      account.owner_profile_id === requester.id;
  }

  const { data: memberships, error: membershipsError } =
    await ctx.supabaseAdmin
      .from("memberships")
      .select("role, active")
      .eq("profile_id", requester.id)
      .eq("institution_id", institutionId);

  if (membershipsError) throw membershipsError;

  const isLocalAdmin = (memberships ?? []).some(
    (membership) =>
      membership.active === true && membership.role === "ADMIN",
  );

  if (!isSuperAdmin && !isAccountOwner && !isLocalAdmin) {
    throw new ManageSchoolUserError({
      status: 403,
      code: "ADMIN_REQUIRED",
      message: "Apenas administradores podem gerenciar usuarios da escola.",
    });
  }
}

async function getTargetMembership(
  ctx: SupabaseFunctionContext,
  input: Pick<RequestData, "institutionId" | "membershipId">,
) {
  const { data: membership, error: membershipError } =
    await ctx.supabaseAdmin
      .from("memberships")
      .select("id, profile_id, institution_id, role, active")
      .eq("id", input.membershipId)
      .eq("institution_id", input.institutionId)
      .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) {
    throw new ManageSchoolUserError({
      status: 404,
      code: "MEMBERSHIP_NOT_FOUND",
      message: "Usuario nao encontrado nesta escola.",
    });
  }
  return membership;
}

async function assertTargetCanBeManaged(
  ctx: SupabaseFunctionContext,
  requesterId: string,
  targetProfileId: string,
) {
  if (requesterId === targetProfileId) {
    throw new ManageSchoolUserError({
      status: 409,
      code: "SELF_MANAGEMENT_BLOCKED",
      message: "Use Minha conta para alterar seu proprio acesso.",
    });
  }

  const { data: targetProfile, error: profileError } =
    await ctx.supabaseAdmin
      .from("profiles")
      .select("platform_role")
      .eq("id", targetProfileId)
      .maybeSingle();

  if (profileError) throw profileError;
  if (targetProfile?.platform_role === "SUPER_ADMIN") {
    throw new ManageSchoolUserError({
      status: 403,
      code: "SUPER_ADMIN_PROTECTED",
      message: "SUPER_ADMIN nao pode ser alterado por esta tela.",
    });
  }

  const { data: ownedAccount, error: ownedAccountError } =
    await ctx.supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("owner_profile_id", targetProfileId)
      .maybeSingle();

  if (ownedAccountError) throw ownedAccountError;
  if (ownedAccount) {
    throw new ManageSchoolUserError({
      status: 409,
      code: "ACCOUNT_OWNER_PROTECTED",
      message: "O administrador dono da conta deve ser alterado pela Plataforma.",
    });
  }
}

async function handleUpdate(
  ctx: SupabaseFunctionContext,
  requesterId: string,
  input: Extract<RequestData, { action: "update" }>,
) {
  const membership = await getTargetMembership(ctx, input);
  await assertTargetCanBeManaged(ctx, requesterId, membership.profile_id);

  if (!input.fullName && !input.role && !input.password) {
    throw new ManageSchoolUserError({
      status: 400,
      code: "EMPTY_UPDATE",
      message: "Informe pelo menos um dado para atualizar.",
    });
  }

  if (input.fullName) {
    const { error } = await ctx.supabaseAdmin
      .from("profiles")
      .update({ full_name: input.fullName })
      .eq("id", membership.profile_id);
    if (error) throw error;
  }

  if (input.role) {
    const { error } = await ctx.supabaseAdmin
      .from("memberships")
      .update({ role: input.role as UserRole })
      .eq("id", membership.id);
    if (error) throw error;

    const { error: profileRoleError } = await ctx.supabaseAdmin
      .from("profiles")
      .update({ role: input.role as UserRole })
      .eq("id", membership.profile_id);
    if (profileRoleError) throw profileRoleError;
  }

  if (input.password) {
    const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(
      membership.profile_id,
      { password: input.password },
    );
    if (error) {
      throw new ManageSchoolUserError({
        status: 422,
        code: "PASSWORD_UPDATE_FAILED",
        message: "Nao foi possivel definir a senha informada.",
      });
    }
  }

  return jsonSuccess({
    success: true,
    action: "update",
    membershipId: membership.id,
    profileId: membership.profile_id,
    message: "Usuario atualizado com sucesso.",
  });
}

async function handleDelete(
  ctx: SupabaseFunctionContext,
  requesterId: string,
  input: Extract<RequestData, { action: "delete" }>,
) {
  const membership = await getTargetMembership(ctx, input);
  await assertTargetCanBeManaged(ctx, requesterId, membership.profile_id);

  await ctx.supabaseAdmin
    .from("guardianships")
    .delete()
    .eq("guardian_profile_id", membership.profile_id);

  await ctx.supabaseAdmin
    .from("students")
    .delete()
    .eq("profile_id", membership.profile_id)
    .eq("institution_id", input.institutionId);

  const { error: membershipDeleteError } = await ctx.supabaseAdmin
    .from("memberships")
    .delete()
    .eq("id", membership.id);

  if (membershipDeleteError) throw membershipDeleteError;

  const { count, error: remainingMembershipsError } =
    await ctx.supabaseAdmin
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", membership.profile_id);

  if (remainingMembershipsError) throw remainingMembershipsError;

  let authUserDeleted = false;
  if ((count ?? 0) === 0) {
    const { error: profileDeleteError } = await ctx.supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", membership.profile_id);
    if (profileDeleteError) throw profileDeleteError;

    const { error: authDeleteError } =
      await ctx.supabaseAdmin.auth.admin.deleteUser(
        membership.profile_id,
      );
    if (authDeleteError) throw authDeleteError;
    authUserDeleted = true;
  }

  return jsonSuccess({
    success: true,
    action: "delete",
    membershipId: membership.id,
    profileId: membership.profile_id,
    authUserDeleted,
    message: authUserDeleted
      ? "Usuario removido da escola e do acesso ao sistema."
      : "Vinculo removido da escola. O usuario possui outros acessos.",
  });
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (request, ctx) => {
      if (request.method === "OPTIONS") {
        return new Response("ok", {
          status: 200,
          headers: corsHeaders,
        });
      }

      if (request.method !== "POST") {
        return jsonError(
          new ManageSchoolUserError({
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
          new ManageSchoolUserError({
            status: 400,
            code: "INVALID_JSON",
            message: "Corpo da requisicao invalido.",
          }),
        );
      }

      const validation = requestSchema.safeParse(body);
      if (!validation.success) {
        return jsonError(
          new ManageSchoolUserError({
            status: 400,
            code: "INVALID_PAYLOAD",
            message:
              validation.error.issues[0]?.message ?? "Dados invalidos.",
            fieldErrors: toFieldErrors(validation.error),
          }),
        );
      }

      const input = validation.data;

      try {
        const {
          data: { user },
          error: userError,
        } = await ctx.supabase.auth.getUser();

        if (userError || !user) {
          throw new ManageSchoolUserError({
            status: 401,
            code: "UNAUTHENTICATED",
            message: "Sessao invalida ou expirada.",
          });
        }

        await getAuthorizedContext(ctx, user.id, input.institutionId);

        return input.action === "update"
          ? await handleUpdate(ctx, user.id, input)
          : await handleDelete(ctx, user.id, input);
      } catch (error) {
        console.error("Erro ao gerenciar usuario escolar:", {
          error,
        });
        return jsonError(toPublicError(error));
      }
    },
  ),
};
