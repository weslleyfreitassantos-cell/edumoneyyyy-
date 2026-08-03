import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

class InstitutionStatusError extends Error {
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
    this.name = "InstitutionStatusError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const requestSchema = z
  .object({
    institutionId: z.guid(),
    active: z.boolean(),
  })
  .strict();

function jsonError(error: InstitutionStatusError): Response {
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

function isInstitutionLimitReachedError(error: unknown): boolean {
  const message = getUnknownErrorMessage(error).toLowerCase();

  return (
    message.includes("institution limit reached") ||
    message.includes("used institutions")
  );
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return jsonError(
          new InstitutionStatusError({
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
          new InstitutionStatusError({
            status: 400,
            code: "INVALID_JSON",
            message: "Corpo da requisicao invalido.",
          }),
        );
      }

      const validation = requestSchema.safeParse(body);

      if (!validation.success) {
        return jsonError(
          new InstitutionStatusError({
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
          throw new InstitutionStatusError({
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
          throw new InstitutionStatusError({
            status: 403,
            code: "PROFILE_INACTIVE",
            message:
              "Perfil desativado nao pode alterar instituicoes.",
          });
        }

        const {
          data: institution,
          error: institutionError,
        } = await ctx.supabaseAdmin
          .from("institutions")
          .select(
            "id, name, active, account_id, suspended_by_profile_id, suspended_by_scope, suspended_at",
          )
          .eq("id", input.institutionId)
          .maybeSingle();

        if (institutionError) {
          throw institutionError;
        }

        if (!institution) {
          throw new InstitutionStatusError({
            status: 404,
            code: "INSTITUTION_NOT_FOUND",
            message: "Instituicao nao encontrada.",
            fieldErrors: {
              institutionId: "Instituicao nao encontrada.",
            },
          });
        }

        if (!institution.account_id) {
          throw new InstitutionStatusError({
            status: 409,
            code: "INSTITUTION_WITHOUT_ACCOUNT",
            message:
              "Instituicao sem conta associada nao pode ser alterada pela Plataforma.",
          });
        }

        const { data: account, error: accountError } =
          await ctx.supabaseAdmin
            .from("accounts")
            .select("id, institution_limit, owner_profile_id")
            .eq("id", institution.account_id)
            .maybeSingle();

        if (accountError) {
          throw accountError;
        }

        if (!account) {
          throw new InstitutionStatusError({
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
          throw new InstitutionStatusError({
            status: 403,
            code: "INSTITUTION_ADMIN_REQUIRED",
            message:
              "Apenas o dono da conta ou SUPER_ADMIN pode alterar instituicoes.",
          });
        }

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

        const usedInstitutionCount = count ?? 0;
        const isCurrentlyActive =
          institution.active !== false;

        if (
          input.active &&
          !isCurrentlyActive &&
          institution.suspended_by_scope === "PLATFORM" &&
          !isSuperAdmin
        ) {
          throw new InstitutionStatusError({
            status: 403,
            code: "INSTITUTION_SUSPENDED_BY_PLATFORM",
            message:
              "Esta instituicao foi suspensa pela plataforma.",
          });
        }

        const suspensionUpdate = input.active
          ? {
              suspended_by_profile_id: null,
              suspended_by_scope: null,
              suspended_at: null,
            }
          : {
              suspended_by_profile_id: requester.id,
              suspended_by_scope: isSuperAdmin
                ? "PLATFORM"
                : "ACCOUNT",
              suspended_at: new Date().toISOString(),
            };

        const { data: updatedInstitution, error: updateError } =
          await ctx.supabaseAdmin
            .from("institutions")
            .update({
              active: input.active,
              ...suspensionUpdate,
            })
            .eq("id", institution.id)
            .select("id, active, suspended_by_scope")
            .single();

        if (updateError) {
          throw updateError;
        }

        return Response.json({
          success: true,
          institutionId: updatedInstitution.id,
          active: updatedInstitution.active === true,
          suspendedByScope:
            updatedInstitution.suspended_by_scope ?? null,
          currentInstitutionCount: usedInstitutionCount,
          institutionLimit: account.institution_limit,
          remainingSlots:
            account.institution_limit - usedInstitutionCount,
        });
      } catch (error) {
        console.error(
          "Erro ao atualizar instituicao:",
          error,
        );

        if (error instanceof InstitutionStatusError) {
          return jsonError(error);
        }

        if (isInstitutionLimitReachedError(error)) {
          return jsonError(
            new InstitutionStatusError({
              status: 409,
              code: "INSTITUTION_LIMIT_REACHED",
              message:
                "A conta atingiu o limite de instituicoes.",
            }),
          );
        }

        return jsonError(
          new InstitutionStatusError({
            status: 500,
            code: "INTERNAL_ERROR",
            message:
              "Nao foi possivel atualizar a instituicao.",
          }),
        );
      }
    },
  ),
};
