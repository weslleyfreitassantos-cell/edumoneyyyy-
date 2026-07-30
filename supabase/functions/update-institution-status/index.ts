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
  return getUnknownErrorMessage(error)
    .toLowerCase()
    .includes("institution limit reached");
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
          .select("id, name, active, account_id")
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
            .select(
              "id, owner_profile_id, institution_limit, status",
            )
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
        const isOwner =
          account.owner_profile_id === user.id;

        if (!isSuperAdmin && !isOwner) {
          throw new InstitutionStatusError({
            status: 403,
            code: "PERMISSION_DENIED",
            message:
              "Apenas SUPER_ADMIN ou o ADMIN da conta pode alterar o status da instituicao.",
          });
        }

        if (!isSuperAdmin && account.status !== "ACTIVE") {
          throw new InstitutionStatusError({
            status: 409,
            code: "ACCOUNT_NOT_ACTIVE",
            message:
              "Conta suspensa ou cancelada nao pode alterar instituicoes.",
          });
        }

        const { count, error: countError } =
          await ctx.supabaseAdmin
            .from("institutions")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("account_id", account.id)
            .eq("active", true);

        if (countError) {
          throw countError;
        }

        const activeInstitutionCount = count ?? 0;
        const isCurrentlyActive =
          institution.active !== false;

        if (
          input.active &&
          !isCurrentlyActive &&
          activeInstitutionCount >= account.institution_limit
        ) {
          throw new InstitutionStatusError({
            status: 409,
            code: "INSTITUTION_LIMIT_REACHED",
            message:
              "A conta atingiu o limite de instituicoes ativas.",
          });
        }

        const { data: updatedInstitution, error: updateError } =
          await ctx.supabaseAdmin
            .from("institutions")
            .update({
              active: input.active,
            })
            .eq("id", institution.id)
            .select("id, active")
            .single();

        if (updateError) {
          throw updateError;
        }

        const nextActiveCount =
          input.active && !isCurrentlyActive
            ? activeInstitutionCount + 1
            : !input.active && isCurrentlyActive
              ? activeInstitutionCount - 1
              : activeInstitutionCount;

        return Response.json({
          success: true,
          institutionId: updatedInstitution.id,
          active: updatedInstitution.active === true,
          currentInstitutionCount: nextActiveCount,
          institutionLimit: account.institution_limit,
          remainingSlots:
            account.institution_limit - nextActiveCount,
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
                "A conta atingiu o limite de instituicoes ativas.",
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
