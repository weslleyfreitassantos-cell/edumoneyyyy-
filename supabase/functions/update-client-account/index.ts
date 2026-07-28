import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

class UpdateAccountError extends Error {
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
    this.name = "UpdateAccountError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const requestSchema = z
  .object({
    accountId: z.guid(),
    institutionLimit: z.number().int().min(1).max(500).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "CANCELED"]).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.institutionLimit !== undefined ||
      value.status !== undefined,
    {
      message: "Informe limite ou status para atualizar.",
      path: ["form"],
    },
  );

function jsonError(error: UpdateAccountError): Response {
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

function isInstitutionLimitBelowActiveError(
  error: unknown,
): boolean {
  return getUnknownErrorMessage(error)
    .toLowerCase()
    .includes(
      "account institution limit cannot be below active institutions",
    );
}

function getBusinessErrorCode(error: unknown): string | null {
  const message = getUnknownErrorMessage(error);

  if (message.includes("ACCOUNT_NOT_FOUND")) {
    return "ACCOUNT_NOT_FOUND";
  }

  if (message.includes("ACCOUNT_ALREADY_CANCELED")) {
    return "ACCOUNT_ALREADY_CANCELED";
  }

  if (message.includes("ACCOUNT_STATUS_TRANSITION_INVALID")) {
    return "ACCOUNT_STATUS_TRANSITION_INVALID";
  }

  if (message.includes("ACCOUNT_STATUS_REASON_REQUIRED")) {
    return "ACCOUNT_STATUS_REASON_REQUIRED";
  }

  return null;
}

function accountStatusErrorFromCode(
  code: string,
): UpdateAccountError {
  if (code === "ACCOUNT_NOT_FOUND") {
    return new UpdateAccountError({
      status: 404,
      code,
      message: "Conta nao encontrada.",
      fieldErrors: {
        accountId: "Conta nao encontrada.",
      },
    });
  }

  if (code === "ACCOUNT_ALREADY_CANCELED") {
    return new UpdateAccountError({
      status: 409,
      code,
      message:
        "Conta encerrada nao pode ser reativada ou suspensa.",
    });
  }

  if (code === "ACCOUNT_STATUS_REASON_REQUIRED") {
    return new UpdateAccountError({
      status: 400,
      code,
      message:
        "Informe um motivo entre 10 e 500 caracteres.",
      fieldErrors: {
        reason: "Informe um motivo entre 10 e 500 caracteres.",
      },
    });
  }

  return new UpdateAccountError({
    status: 409,
    code: "ACCOUNT_STATUS_TRANSITION_INVALID",
    message: "Transicao de status da conta invalida.",
  });
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return jsonError(
          new UpdateAccountError({
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
          new UpdateAccountError({
            status: 400,
            code: "INVALID_JSON",
            message: "Corpo da requisicao invalido.",
          }),
        );
      }

      const validation = requestSchema.safeParse(body);

      if (!validation.success) {
        return jsonError(
          new UpdateAccountError({
            status: 400,
            code: "INVALID_PAYLOAD",
            message:
              validation.error.issues[0]?.message ??
              "Dados invalidos.",
            fieldErrors: toFieldErrors(validation.error),
          }),
        );
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await ctx.supabase.auth.getUser();

        if (userError || !user) {
          throw new UpdateAccountError({
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
          throw new UpdateAccountError({
            status: 403,
            code: "PROFILE_INACTIVE",
            message:
              "Perfil desativado nao pode alterar contas.",
          });
        }

        if (profile.platform_role !== "SUPER_ADMIN") {
          throw new UpdateAccountError({
            status: 403,
            code: "SUPER_ADMIN_REQUIRED",
            message:
              "Apenas SUPER_ADMIN pode alterar contas.",
          });
        }

        const { data: existingAccount, error: accountError } =
          await ctx.supabaseAdmin
            .from("accounts")
            .select("id, institution_limit, status")
            .eq("id", validation.data.accountId)
            .maybeSingle();

        if (accountError) {
          throw accountError;
        }

        if (!existingAccount) {
          throw new UpdateAccountError({
            status: 404,
            code: "ACCOUNT_NOT_FOUND",
            message: "Conta nao encontrada.",
            fieldErrors: {
              accountId: "Conta nao encontrada.",
            },
          });
        }

        if (validation.data.institutionLimit !== undefined) {
          const { count, error: countError } =
            await ctx.supabaseAdmin
              .from("institutions")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq("account_id", existingAccount.id)
              .eq("active", true);

          if (countError) {
            throw countError;
          }

          const activeInstitutionCount = count ?? 0;

          if (
            validation.data.institutionLimit <
            activeInstitutionCount
          ) {
            throw new UpdateAccountError({
              status: 409,
              code:
                "INSTITUTION_LIMIT_BELOW_ACTIVE_INSTITUTIONS",
              message:
                "O limite nao pode ficar abaixo da quantidade de instituicoes ativas.",
              fieldErrors: {
                institutionLimit:
                  `Limite minimo: ${activeInstitutionCount}.`,
              },
            });
          }
        }

        if (
          validation.data.institutionLimit !== undefined &&
          (existingAccount.status === "CANCELED" ||
            validation.data.status === "CANCELED")
        ) {
          throw new UpdateAccountError({
            status: 409,
            code: "ACCOUNT_ALREADY_CANCELED",
            message:
              "Conta encerrada nao permite alterar limite.",
          });
        }

        let currentStatus = existingAccount.status;
        let previousStatus = existingAccount.status;
        let auditEventId: string | null = null;
        let statusChanged = false;

        if (validation.data.status !== undefined) {
          type ChangeAccountStatusRow = {
            account_id: string;
            previous_status: string;
            new_status: string;
            institution_limit: number;
            audit_event_id: string | null;
            status_changed: boolean;
          };
          type RpcClient = {
            rpc: (
              functionName: "change_account_status",
              args: {
                target_account_id: string;
                target_status: string;
                actor_profile_id: string;
                change_reason?: string | null;
                change_metadata?: Record<string, unknown>;
              },
            ) => Promise<{
              data: ChangeAccountStatusRow[] | null;
              error: Error | null;
            }>;
          };

          const { data: statusRows, error: statusError } =
            await (ctx.supabaseAdmin as unknown as RpcClient).rpc(
              "change_account_status",
              {
                target_account_id: existingAccount.id,
                target_status: validation.data.status,
                actor_profile_id: user.id,
                change_reason: validation.data.reason ?? null,
                change_metadata: {
                  source: "update-client-account",
                },
              },
            );

          if (statusError) {
            const businessCode =
              getBusinessErrorCode(statusError);

            if (businessCode) {
              throw accountStatusErrorFromCode(businessCode);
            }

            throw statusError;
          }

          const statusResult = statusRows?.[0];

          if (!statusResult) {
            throw new UpdateAccountError({
              status: 500,
              code: "INVALID_STATUS_RESPONSE",
              message:
                "Nao foi possivel confirmar a alteracao de status.",
            });
          }

          previousStatus = statusResult.previous_status;
          currentStatus = statusResult.new_status;
          auditEventId = statusResult.audit_event_id;
          statusChanged = statusResult.status_changed;
        }

        let currentLimit = existingAccount.institution_limit;

        if (validation.data.institutionLimit !== undefined) {
          const { data: account, error: updateError } =
            await ctx.supabaseAdmin
              .from("accounts")
              .update({
                institution_limit:
                  validation.data.institutionLimit,
              })
              .eq("id", existingAccount.id)
              .select("institution_limit")
              .single();

          if (updateError) {
            throw updateError;
          }

          currentLimit = account.institution_limit;
        }

        return Response.json({
          success: true,
          accountId: existingAccount.id,
          previousStatus,
          status: currentStatus,
          institutionLimit: currentLimit,
          auditEventId,
          statusChanged,
        });
      } catch (error) {
        console.error(
          "Erro ao atualizar conta:",
          error,
        );

        if (error instanceof UpdateAccountError) {
          return jsonError(error);
        }

        if (isInstitutionLimitBelowActiveError(error)) {
          return jsonError(
            new UpdateAccountError({
              status: 409,
              code:
                "INSTITUTION_LIMIT_BELOW_ACTIVE_INSTITUTIONS",
              message:
                "O limite nao pode ficar abaixo da quantidade de instituicoes ativas.",
              fieldErrors: {
                institutionLimit:
                  "Limite abaixo da quantidade de instituicoes ativas.",
              },
            }),
          );
        }

        return jsonError(
          new UpdateAccountError({
            status: 500,
            code: "INTERNAL_ERROR",
            message: "Nao foi possivel atualizar a conta.",
          }),
        );
      }
    },
  ),
};
