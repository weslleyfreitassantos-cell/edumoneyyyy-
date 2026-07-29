import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

class RestoreAccountError extends Error {
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
    this.name = "RestoreAccountError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const requestSchema = z
  .object({
    accountId: z.guid(),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

function jsonError(error: RestoreAccountError): Response {
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

function getBusinessErrorCode(error: unknown): string | null {
  const message = getUnknownErrorMessage(error);

  if (message.includes("ACCOUNT_NOT_FOUND")) {
    return "ACCOUNT_NOT_FOUND";
  }

  if (message.includes("ACCOUNT_NOT_CANCELED")) {
    return "ACCOUNT_NOT_CANCELED";
  }

  if (message.includes("ACCOUNT_STATUS_REASON_REQUIRED")) {
    return "ACCOUNT_STATUS_REASON_REQUIRED";
  }

  if (message.includes("ACCOUNT_DOMAIN_CONFLICT")) {
    return "ACCOUNT_DOMAIN_CONFLICT";
  }

  if (message.includes("ACCOUNT_OWNER_INACTIVE")) {
    return "ACCOUNT_OWNER_INACTIVE";
  }

  return null;
}

function accountStatusErrorFromCode(
  code: string,
): RestoreAccountError {
  if (code === "ACCOUNT_NOT_FOUND") {
    return new RestoreAccountError({
      status: 404,
      code,
      message: "Conta nao encontrada.",
      fieldErrors: {
        accountId: "Conta nao encontrada.",
      },
    });
  }

  if (code === "ACCOUNT_NOT_CANCELED") {
    return new RestoreAccountError({
      status: 409,
      code,
      message:
        "Apenas contas encerradas podem ser restauradas.",
    });
  }

  if (code === "ACCOUNT_STATUS_REASON_REQUIRED") {
    return new RestoreAccountError({
      status: 400,
      code,
      message:
        "Informe um motivo entre 10 e 500 caracteres.",
      fieldErrors: {
        reason: "Informe um motivo entre 10 e 500 caracteres.",
      },
    });
  }

  if (code === "ACCOUNT_DOMAIN_CONFLICT") {
    return new RestoreAccountError({
      status: 409,
      code,
      message:
        "Um ou mais dominios da conta estao em uso por outra conta ativa.",
    });
  }

  if (code === "ACCOUNT_OWNER_INACTIVE") {
    return new RestoreAccountError({
      status: 409,
      code,
      message:
        "O administrador da conta esta inativo. Restauracao bloqueada.",
    });
  }

  return new RestoreAccountError({
    status: 409,
    code: "RESTORE_FAILED",
    message: "Nao foi possivel restaurar a conta.",
  });
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return jsonError(
          new RestoreAccountError({
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
          new RestoreAccountError({
            status: 400,
            code: "INVALID_JSON",
            message: "Corpo da requisicao invalido.",
          }),
        );
      }

      const validation = requestSchema.safeParse(body);

      if (!validation.success) {
        return jsonError(
          new RestoreAccountError({
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
          throw new RestoreAccountError({
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
          throw new RestoreAccountError({
            status: 403,
            code: "PROFILE_INACTIVE",
            message:
              "Perfil desativado nao pode restaurar contas.",
          });
        }

        if (profile.platform_role !== "SUPER_ADMIN") {
          throw new RestoreAccountError({
            status: 403,
            code: "SUPER_ADMIN_REQUIRED",
            message:
              "Apenas SUPER_ADMIN pode restaurar contas.",
          });
        }

        type RestoreClientAccountRow = {
          account_id: string;
          previous_status: string;
          new_status: string;
          institution_limit: number;
          audit_event_id: string | null;
          status_changed: boolean;
        };
        type RpcClient = {
          rpc: (
            functionName: "restore_client_account",
            args: {
              target_account_id: string;
              actor_profile_id: string;
              change_reason: string;
            },
          ) => Promise<{
            data: RestoreClientAccountRow[] | null;
            error: Error | null;
          }>;
        };

        const { data: statusRows, error: statusError } =
          await (ctx.supabaseAdmin as unknown as RpcClient).rpc(
            "restore_client_account",
            {
              target_account_id: validation.data.accountId,
              actor_profile_id: user.id,
              change_reason: validation.data.reason,
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
          throw new RestoreAccountError({
            status: 500,
            code: "INVALID_STATUS_RESPONSE",
            message:
              "Nao foi possivel confirmar a restauracao da conta.",
          });
        }

        return Response.json({
          success: true,
          accountId: statusResult.account_id,
          previousStatus: statusResult.previous_status,
          status: statusResult.new_status,
          institutionLimit: statusResult.institution_limit,
          auditEventId: statusResult.audit_event_id,
          statusChanged: statusResult.status_changed,
        });
      } catch (error) {
        console.error(
          "Erro ao restaurar conta:",
          error,
        );

        if (error instanceof RestoreAccountError) {
          return jsonError(error);
        }

        return jsonError(
          new RestoreAccountError({
            status: 500,
            code: "INTERNAL_ERROR",
            message: "Nao foi possivel restaurar a conta.",
          }),
        );
      }
    },
  ),
};
