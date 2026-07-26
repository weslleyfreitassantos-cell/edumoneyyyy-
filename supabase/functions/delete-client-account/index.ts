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

async function assertActiveSuperAdmin(
  ctx: Parameters<
    Parameters<typeof withSupabase<Database>>[1]
  >[1],
): Promise<void> {
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
      message: "Perfil desativado nao pode excluir contas.",
    });
  }

  if (profile.platform_role !== "SUPER_ADMIN") {
    throw new DeleteAccountError({
      status: 403,
      code: "SUPER_ADMIN_REQUIRED",
      message: "Apenas SUPER_ADMIN pode excluir contas.",
    });
  }
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
        await assertActiveSuperAdmin(ctx);

        return jsonError(
          new DeleteAccountError({
            status: 410,
            code: "HARD_DELETE_DISABLED",
            message:
              "A exclusao fisica de contas foi desativada. Utilize o encerramento seguro da conta.",
          }),
        );
      } catch (error) {
        console.error(
          "Exclusao fisica de conta bloqueada:",
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
              "Nao foi possivel validar a requisicao de exclusao.",
          }),
        );
      }
    },
  ),
};
