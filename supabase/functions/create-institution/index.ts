import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

class InstitutionError extends Error {
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
    this.name = "InstitutionError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const optionalTextSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
  z.string().trim().max(160).optional(),
);

const optionalEmailSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
  z.string().trim().toLowerCase().email().optional(),
);

const optionalCnpjSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
  z
    .string()
    .trim()
    .regex(
      /^(?:\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/,
      "CNPJ deve conter 14 digitos",
    )
    .optional(),
);

const requestSchema = z
  .object({
    accountId: z.guid(),
    name: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, " "))
      .pipe(z.string().min(3).max(120)),
    cnpj: optionalCnpjSchema,
    address: optionalTextSchema,
    phone: optionalTextSchema,
    email: optionalEmailSchema,
    logoUrl: optionalTextSchema,
  })
  .strict();

function jsonError(error: InstitutionError): Response {
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

function normalizeCnpj(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/\D/g, "");
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    fields[field] ??= issue.message;
  }

  return fields;
}

function isLimitError(message: string | undefined): boolean {
  return (
    message?.toLowerCase().includes("institution limit") ??
    false
  );
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return jsonError(
          new InstitutionError({
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
          new InstitutionError({
            status: 400,
            code: "INVALID_JSON",
            message: "Corpo da requisicao invalido.",
          }),
        );
      }

      const validation = requestSchema.safeParse(body);

      if (!validation.success) {
        return jsonError(
          new InstitutionError({
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
          throw new InstitutionError({
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
          throw new InstitutionError({
            status: 403,
            code: "PROFILE_INACTIVE",
            message:
              "Perfil desativado nao pode criar instituicoes.",
          });
        }

        const { data: account, error: accountError } =
          await ctx.supabaseAdmin
            .from("accounts")
            .select(
              "id, owner_profile_id, institution_limit, status",
            )
            .eq("id", input.accountId)
            .maybeSingle();

        if (accountError) {
          throw accountError;
        }

        if (!account) {
          throw new InstitutionError({
            status: 404,
            code: "ACCOUNT_NOT_FOUND",
            message: "Conta nao encontrada.",
            fieldErrors: {
              accountId: "Conta nao encontrada.",
            },
          });
        }

        const isSuperAdmin =
          requester.platform_role === "SUPER_ADMIN";

        const isOwner =
          account.owner_profile_id === user.id;

        if (!isSuperAdmin && !isOwner) {
          throw new InstitutionError({
            status: 403,
            code: "ACCOUNT_OWNER_REQUIRED",
            message:
              "Apenas o ADMIN da conta pode criar instituicoes.",
          });
        }

        if (account.status !== "ACTIVE") {
          throw new InstitutionError({
            status: 409,
            code: "ACCOUNT_NOT_ACTIVE",
            message:
              "Conta suspensa ou cancelada nao pode criar instituicoes.",
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

        const currentCount = count ?? 0;

        if (currentCount >= account.institution_limit) {
          throw new InstitutionError({
            status: 409,
            code: "INSTITUTION_LIMIT_REACHED",
            message:
              "Limite de instituicoes atingido para esta conta.",
          });
        }

        const cnpj = normalizeCnpj(input.cnpj);

        if (cnpj) {
          const { data: existingCnpj, error: cnpjError } =
            await ctx.supabaseAdmin
              .from("institutions")
              .select("id")
              .eq("cnpj", cnpj)
              .maybeSingle();

          if (cnpjError) {
            throw cnpjError;
          }

          if (existingCnpj) {
            throw new InstitutionError({
              status: 409,
              code: "CNPJ_ALREADY_EXISTS",
              message: "Ja existe instituicao com este CNPJ.",
              fieldErrors: {
                cnpj: "CNPJ ja cadastrado.",
              },
            });
          }
        }

        const { data: institution, error: insertError } =
          await ctx.supabaseAdmin
            .from("institutions")
            .insert({
              account_id: account.id,
              name: input.name,
              cnpj,
              address: input.address ?? null,
              phone: input.phone ?? null,
              email: input.email ?? null,
              logo_url: input.logoUrl ?? null,
              active: true,
            })
            .select("id")
            .single();

        if (insertError || !institution) {
          if (isLimitError(insertError?.message)) {
            throw new InstitutionError({
              status: 409,
              code: "INSTITUTION_LIMIT_REACHED",
              message:
                "Limite de instituicoes atingido para esta conta.",
            });
          }

          throw new Error(
            insertError?.message ??
              "Nao foi possivel criar a instituicao.",
          );
        }

        const nextCount = currentCount + 1;

        return Response.json(
          {
            success: true,
            institutionId: institution.id,
            accountId: account.id,
            currentInstitutionCount: nextCount,
            institutionLimit: account.institution_limit,
            remainingSlots:
              account.institution_limit - nextCount,
          },
          { status: 201 },
        );
      } catch (error) {
        console.error(
          "Erro ao criar instituicao:",
          error,
        );

        if (error instanceof InstitutionError) {
          return jsonError(error);
        }

        return jsonError(
          new InstitutionError({
            status: 500,
            code: "INTERNAL_ERROR",
            message:
              "Nao foi possivel criar a instituicao.",
          }),
        );
      }
    },
  ),
};
