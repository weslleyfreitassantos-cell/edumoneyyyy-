import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

class DeleteAccountError extends Error {
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
    this.name = "DeleteAccountError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const requestSchema = z
  .object({
    accountId: z.guid(),
    reason: z.string().trim().min(10).max(500),
    confirmationEmail: z.string().email(),
    confirmationText: z.literal("EXCLUIR DEFINITIVAMENTE"),
    acknowledgement: z.literal(true),
  })
  .strict();

function jsonError(error: DeleteAccountError): Response {
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

  if (message.includes("HARD_DELETE_REASON_REQUIRED")) {
    return "HARD_DELETE_REASON_REQUIRED";
  }

  if (message.includes("ACTOR_NOT_FOUND")) {
    return "ACTOR_NOT_FOUND";
  }

  if (message.includes("CANNOT_DELETE_OWN_ACCOUNT")) {
    return "CANNOT_DELETE_OWN_ACCOUNT";
  }

  if (message.includes("CANNOT_DELETE_SUPERADMIN_ACCOUNT")) {
    return "CANNOT_DELETE_SUPERADMIN_ACCOUNT";
  }

  if (message.includes("CONFIRMATION_EMAIL_MISMATCH")) {
    return "CONFIRMATION_EMAIL_MISMATCH";
  }

  if (message.includes("CONFIRMATION_TEXT_INVALID")) {
    return "CONFIRMATION_TEXT_INVALID";
  }

  if (message.includes("ACKNOWLEDGEMENT_REQUIRED")) {
    return "ACKNOWLEDGEMENT_REQUIRED";
  }

  return null;
}

function hardDeleteErrorFromCode(code: string): DeleteAccountError {
  if (code === "ACCOUNT_NOT_FOUND") {
    return new DeleteAccountError({
      status: 404,
      code,
      message: "Conta nao encontrada.",
      fieldErrors: { accountId: "Conta nao encontrada." },
    });
  }

  if (code === "ACCOUNT_NOT_CANCELED") {
    return new DeleteAccountError({
      status: 409,
      code,
      message: "Apenas contas encerradas podem ser excluidas permanentemente.",
    });
  }

  if (code === "HARD_DELETE_REASON_REQUIRED") {
    return new DeleteAccountError({
      status: 400,
      code,
      message: "Informe um motivo entre 10 e 500 caracteres.",
      fieldErrors: { reason: "Informe um motivo entre 10 e 500 caracteres." },
    });
  }

  if (code === "CANNOT_DELETE_OWN_ACCOUNT") {
    return new DeleteAccountError({
      status: 403,
      code,
      message: "Voce nao pode excluir sua propria conta.",
    });
  }

  if (code === "CANNOT_DELETE_SUPERADMIN_ACCOUNT") {
    return new DeleteAccountError({
      status: 403,
      code,
      message: "A conta superadmin@admin.com nao pode ser excluida.",
    });
  }

  if (code === "CONFIRMATION_EMAIL_MISMATCH") {
    return new DeleteAccountError({
      status: 400,
      code,
      message: "O e-mail informado nao corresponde ao administrador da conta.",
      fieldErrors: { confirmationEmail: "E-mail incorreto." },
    });
  }

  if (code === "CONFIRMATION_TEXT_INVALID") {
    return new DeleteAccountError({
      status: 400,
      code,
      message: "Digite EXCLUIR DEFINITIVAMENTE para confirmar.",
      fieldErrors: { confirmationText: "Texto de confirmacao incorreto." },
    });
  }

  if (code === "ACKNOWLEDGEMENT_REQUIRED") {
    return new DeleteAccountError({
      status: 400,
      code,
      message: "Confirme que entende as consequencias.",
      fieldErrors: { acknowledgement: "Confirmacao obrigatoria." },
    });
  }

  if (code === "ACTOR_NOT_FOUND") {
    return new DeleteAccountError({
      status: 500,
      code,
      message: "Perfil do administrador nao encontrado.",
    });
  }

  return new DeleteAccountError({
    status: 409,
    code: "HARD_DELETE_FAILED",
    message: "Nao foi possivel excluir a conta permanentemente.",
  });
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return jsonError(
          new DeleteAccountError({
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
          new DeleteAccountError({
            status: 400,
            code: "INVALID_JSON",
            message: "Corpo da requisicao invalido.",
          }),
        );
      }

      const validation = requestSchema.safeParse(body);

      if (!validation.success) {
        return jsonError(
          new DeleteAccountError({
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
          throw new DeleteAccountError({
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
          throw new DeleteAccountError({
            status: 403,
            code: "PROFILE_INACTIVE",
            message:
              "Perfil desativado nao pode excluir contas.",
          });
        }

        if (profile.platform_role !== "SUPER_ADMIN") {
          throw new DeleteAccountError({
            status: 403,
            code: "SUPER_ADMIN_REQUIRED",
            message: "Apenas SUPER_ADMIN pode excluir contas.",
          });
        }

        // Call the hard delete RPC (transactional data deletion)
        type HardDeleteRpcResult = {
          accountId: string;
          accountName: string;
          auditId: string;
          summary: Record<string, number>;
          ownerPreserved: boolean;
          exclusiveProfileIds: string[];
          sharedProfileIds: string[];
        };
        type RpcClient = {
          rpc: (
            functionName: "hard_delete_client_account",
            args: {
              target_account_id: string;
              actor_profile_id: string;
              change_reason: string;
              confirmation_email: string;
              confirmation_text: string;
              acknowledgement: boolean;
            },
          ) => Promise<{
            data: unknown;
            error: Error | null;
          }>;
        };

        const { data: rpcResult, error: rpcError } =
          await (ctx.supabaseAdmin as unknown as RpcClient).rpc(
            "hard_delete_client_account",
            {
              target_account_id: validation.data.accountId,
              actor_profile_id: user.id,
              change_reason: validation.data.reason,
              confirmation_email:
                validation.data.confirmationEmail,
              confirmation_text:
                validation.data.confirmationText,
              acknowledgement: validation.data.acknowledgement,
            },
          );

        if (rpcError) {
          const businessCode =
            getBusinessErrorCode(rpcError);

          if (businessCode) {
            throw hardDeleteErrorFromCode(businessCode);
          }

          throw rpcError;
        }

        const result =
          rpcResult as unknown as HardDeleteRpcResult;

        // Delete auth users for exclusive profiles via Admin API
        const exclusiveIds: string[] =
          result.exclusiveProfileIds ?? [];
        let authDeletionFailedCount = 0;

        for (const profileId of exclusiveIds) {
          const { error: deleteError } =
            await ctx.supabaseAdmin.auth.admin.deleteUser(
              profileId,
            );

          if (deleteError) {
            authDeletionFailedCount++;
            console.error(
              `Falha ao deletar auth user ${profileId}:`,
              deleteError,
            );
          }
        }

        // Update audit if some auth deletions failed
        if (authDeletionFailedCount > 0) {
          await ctx.supabaseAdmin
            .from("platform_destructive_actions")
            .update({
              result_status: "PARTIAL_SUCCESS",
              error_message:
                `${authDeletionFailedCount} usuario(s) de autenticacao nao puderam ser removidos.`,
            })
            .eq("id", result.auditId);
        }

        return Response.json({
          success: true,
          accountId: result.accountId,
          accountName: result.accountName,
          auditId: result.auditId,
          summary: result.summary,
          ownerPreserved: result.ownerPreserved,
          exclusiveProfileIds: exclusiveIds,
          sharedProfileIds: result.sharedProfileIds ?? [],
          deletedAuthUsers:
            exclusiveIds.length - authDeletionFailedCount,
          authDeletionFailed: authDeletionFailedCount,
        });
      } catch (error) {
        console.error(
          "Erro ao excluir conta permanentemente:",
          error,
        );

        if (error instanceof DeleteAccountError) {
          return jsonError(error);
        }

        return jsonError(
          new DeleteAccountError({
            status: 500,
            code: "INTERNAL_ERROR",
            message:
              "Nao foi possivel excluir a conta permanentemente.",
          }),
        );
      }
    },
  ),
};
