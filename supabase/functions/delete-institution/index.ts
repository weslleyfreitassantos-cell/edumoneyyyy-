import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

class DeleteInstitutionError extends Error {
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
    this.name = "DeleteInstitutionError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const requestSchema = z
  .object({
    accountId: z.guid(),
    institutionId: z.guid(),
  })
  .strict();

function jsonError(error: DeleteInstitutionError): Response {
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

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    fields[field] ??= issue.message;
  }

  return fields;
}

function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "";
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return jsonError(
          new DeleteInstitutionError({
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
          new DeleteInstitutionError({
            status: 400,
            code: "INVALID_JSON",
            message: "Corpo da requisicao invalido.",
          }),
        );
      }

      const validation = requestSchema.safeParse(body);

      if (!validation.success) {
        return jsonError(
          new DeleteInstitutionError({
            status: 400,
            code: "INVALID_PAYLOAD",
            message:
              validation.error.issues[0]?.message ??
              "Dados invalidos.",
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
          throw new DeleteInstitutionError({
            status: 401,
            code: "UNAUTHENTICATED",
            message: "Sessao invalida ou expirada.",
          });
        }

        const { data: requester, error: requesterError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .select("id, platform_role, active")
            .eq("id", user.id)
            .maybeSingle();

        if (requesterError) {
          throw requesterError;
        }

        if (!requester || requester.active !== true) {
          throw new DeleteInstitutionError({
            status: 403,
            code: "PROFILE_INACTIVE",
            message:
              "Perfil desativado nao pode excluir instituicoes.",
          });
        }

        const {
          data: institution,
          error: institutionError,
        } = await ctx.supabaseAdmin
          .from("institutions")
          .select("id, name, account_id")
          .eq("id", input.institutionId)
          .eq("account_id", input.accountId)
          .maybeSingle();

        if (institutionError) {
          throw institutionError;
        }

        if (!institution || institution.account_id !== input.accountId) {
          throw new DeleteInstitutionError({
            status: 404,
            code: "INSTITUTION_NOT_FOUND",
            message: "Instituicao nao encontrada.",
            fieldErrors: {
              institutionId: "Instituicao nao encontrada.",
            },
          });
        }

        const { data: account, error: accountError } =
          await ctx.supabaseAdmin
            .from("accounts")
            .select("id, owner_profile_id, institution_limit")
            .eq("id", institution.account_id)
            .maybeSingle();

        if (accountError) {
          throw accountError;
        }

        if (!account) {
          throw new DeleteInstitutionError({
            status: 404,
            code: "ACCOUNT_NOT_FOUND",
            message: "Conta da instituicao nao encontrada.",
          });
        }

        const isSuperAdmin =
          requester.platform_role === "SUPER_ADMIN";
        const isAccountOwner =
          account.owner_profile_id === requester.id;

        if (!isSuperAdmin && !isAccountOwner) {
          throw new DeleteInstitutionError({
            status: 403,
            code: "INSTITUTION_ADMIN_REQUIRED",
            message:
              "Apenas o dono da conta ou SUPER_ADMIN pode excluir instituicoes.",
          });
        }

        const { data: deletionResult, error: deleteError } =
          await ctx.supabaseAdmin.rpc("delete_institution_data_atomic_v1", {
            p_account_id: account.id,
            p_institution_id: institution.id,
          });

        if (deleteError) {
          const message = getUnknownErrorMessage(deleteError);
          if (deleteError.code === "23503") {
            throw new DeleteInstitutionError({
              status: 409,
              code: "INSTITUTION_HAS_UNSUPPORTED_DEPENDENCIES",
              message:
                "A instituicao possui dados relacionados que ainda nao podem ser removidos com seguranca. Nenhum dado foi excluido.",
            });
          }
          if (message.includes("INSTITUTION_NOT_FOUND")) {
            throw new DeleteInstitutionError({
              status: 404,
              code: "INSTITUTION_NOT_FOUND",
              message: "Instituicao nao encontrada.",
            });
          }
          throw deleteError;
        }

        const result = deletionResult as {
          institutionDeleted?: boolean;
          summary?: Record<string, number>;
        } | null;
        if (result?.institutionDeleted !== true) {
          throw new Error("INSTITUTION_DELETE_RESULT_INVALID");
        }
        const summary = result.summary ?? {};

        const { count, error: countError } =
          await ctx.supabaseAdmin
            .from("institutions")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("account_id", account.id);

        if (countError) {
          throw countError;
        }

        const currentInstitutionCount = count ?? 0;

        return Response.json({
          success: true,
          institutionId: institution.id,
          accountId: account.id,
          currentInstitutionCount,
          institutionLimit: account.institution_limit,
          remainingSlots:
            account.institution_limit - currentInstitutionCount,
          summary,
        });
      } catch (error) {
        console.error("Erro ao excluir instituicao:", error);

        if (error instanceof DeleteInstitutionError) {
          return jsonError(error);
        }

        return jsonError(
          new DeleteInstitutionError({
            status: 500,
            code: "INTERNAL_ERROR",
            message:
              "Nao foi possivel excluir a instituicao.",
          }),
        );
      }
    },
  ),
};
