import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";
import {
  getOwnerDeletionMode,
  hasBlockingDependencies,
  type DeleteSafetySnapshot,
} from "./validation.ts";

type SupabaseContext = Parameters<
  Parameters<typeof withSupabase<Database>>[1]
>[1];

interface AccountRecord {
  id: string;
  name: string;
  owner_profile_id: string;
  institution_limit: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

interface OwnerProfileRecord {
  id: string;
  full_name: string;
  email: string;
  role: Database["public"]["Enums"]["user_role"];
  platform_role: Database["public"]["Enums"]["platform_role"];
  active: boolean | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
}

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

function accountNotEmptyError(): DeleteAccountError {
  return new DeleteAccountError({
    status: 409,
    code: "ACCOUNT_NOT_EMPTY",
    message:
      "Esta conta possui instituições ou vínculos e não pode ser excluída.",
  });
}

async function assertActiveSuperAdmin(
  ctx: SupabaseContext,
): Promise<string> {
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

  if (
    !profile ||
    profile.active !== true ||
    profile.platform_role !== "SUPER_ADMIN"
  ) {
    throw new DeleteAccountError({
      status: 403,
      code: "SUPER_ADMIN_REQUIRED",
      message: "Apenas SUPER_ADMIN pode excluir contas.",
    });
  }

  return user.id;
}

async function loadAccount(
  ctx: SupabaseContext,
  accountId: string,
): Promise<AccountRecord> {
  const { data, error } = await ctx.supabaseAdmin
    .from("accounts")
    .select(
      "id, name, owner_profile_id, institution_limit, status, created_at, updated_at",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new DeleteAccountError({
      status: 404,
      code: "ACCOUNT_NOT_FOUND",
      message: "Conta nao encontrada.",
      fieldErrors: {
        accountId: "Conta nao encontrada.",
      },
    });
  }

  return data as AccountRecord;
}

async function loadOwnerProfile(
  ctx: SupabaseContext,
  ownerProfileId: string,
): Promise<OwnerProfileRecord> {
  const { data, error } = await ctx.supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, email, role, platform_role, active, avatar_url, phone, created_at, updated_at",
    )
    .eq("id", ownerProfileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new DeleteAccountError({
      status: 409,
      code: "ACCOUNT_OWNER_NOT_FOUND",
      message:
        "O administrador desta conta nao foi encontrado; exclusao bloqueada.",
    });
  }

  return data as OwnerProfileRecord;
}

async function countTypedRows(
  ctx: SupabaseContext,
  table:
    | "institutions"
    | "memberships"
    | "students"
    | "guardianships"
    | "subject_offerings",
  column: string,
  value: string,
): Promise<number> {
  const { count, error } = await ctx.supabaseAdmin
    .from(table)
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(column, value);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function countOptionalRows(
  ctx: SupabaseContext,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const { count, error } = await (ctx.supabaseAdmin as never as {
    from: (tableName: string) => {
      select: (
        columns: string,
        options: { count: "exact"; head: true },
      ) => {
        eq: (
          columnName: string,
          columnValue: string,
        ) => Promise<{ count: number | null; error: Error | null }>;
      };
    };
  })
    .from(table)
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(column, value);

  if (error) {
    throw accountNotEmptyError();
  }

  return count ?? 0;
}

async function loadSafetySnapshot(
  ctx: SupabaseContext,
  account: AccountRecord,
  owner: OwnerProfileRecord,
): Promise<DeleteSafetySnapshot> {
  const [
    institutionCount,
    ownerMembershipCount,
    ownerStudentCount,
    ownerGuardianshipCount,
    ownerTeachingCount,
    assessmentCount,
    gradeCount,
    attendanceSessionCount,
    attendanceRecordCount,
    submittedClosureCount,
    closedClosureCount,
    reopenedClosureCount,
  ] = await Promise.all([
    countTypedRows(ctx, "institutions", "account_id", account.id),
    countTypedRows(ctx, "memberships", "profile_id", owner.id),
    countTypedRows(ctx, "students", "profile_id", owner.id),
    countTypedRows(
      ctx,
      "guardianships",
      "guardian_profile_id",
      owner.id,
    ),
    countTypedRows(
      ctx,
      "subject_offerings",
      "teacher_profile_id",
      owner.id,
    ),
    countOptionalRows(ctx, "assessments", "created_by", owner.id),
    countOptionalRows(ctx, "grades", "recorded_by", owner.id),
    countOptionalRows(
      ctx,
      "attendance_sessions",
      "created_by",
      owner.id,
    ),
    countOptionalRows(
      ctx,
      "attendance_records",
      "recorded_by",
      owner.id,
    ),
    countOptionalRows(
      ctx,
      "term_closures",
      "submitted_by",
      owner.id,
    ),
    countOptionalRows(ctx, "term_closures", "closed_by", owner.id),
    countOptionalRows(
      ctx,
      "term_closures",
      "reopened_by",
      owner.id,
    ),
  ]);

  return {
    institutionCount,
    ownerMembershipCount,
    ownerStudentCount,
    ownerGuardianshipCount,
    ownerTeachingCount,
    ownerAuditReferenceCount:
      assessmentCount +
      gradeCount +
      attendanceSessionCount +
      attendanceRecordCount +
      submittedClosureCount +
      closedClosureCount +
      reopenedClosureCount,
  };
}

async function deleteAccountRow(
  ctx: SupabaseContext,
  accountId: string,
): Promise<void> {
  const { error } = await ctx.supabaseAdmin
    .from("accounts")
    .delete()
    .eq("id", accountId);

  if (error) {
    throw error;
  }
}

async function deleteProfileRow(
  ctx: SupabaseContext,
  profileId: string,
): Promise<void> {
  const { error } = await ctx.supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", profileId);

  if (error) {
    throw error;
  }
}

async function restoreAccount(
  ctx: SupabaseContext,
  account: AccountRecord,
): Promise<void> {
  const { error } = await ctx.supabaseAdmin
    .from("accounts")
    .insert({
      id: account.id,
      name: account.name,
      owner_profile_id: account.owner_profile_id,
      institution_limit: account.institution_limit,
      status: account.status,
      created_at: account.created_at,
      updated_at: account.updated_at,
    });

  if (error) {
    throw error;
  }
}

async function restoreProfile(
  ctx: SupabaseContext,
  owner: OwnerProfileRecord,
): Promise<void> {
  const { error } = await ctx.supabaseAdmin
    .from("profiles")
    .insert({
      id: owner.id,
      full_name: owner.full_name,
      email: owner.email,
      role: owner.role,
      platform_role: owner.platform_role,
      active: owner.active,
      avatar_url: owner.avatar_url,
      phone: owner.phone,
      created_at: owner.created_at,
      updated_at: owner.updated_at,
    });

  if (error) {
    throw error;
  }
}

async function restoreAccountBestEffort(
  ctx: SupabaseContext,
  account: AccountRecord,
): Promise<void> {
  try {
    await restoreAccount(ctx, account);
  } catch (error) {
    console.error(
      "Falha ao restaurar account apos erro de exclusao:",
      error,
    );
  }
}

async function restoreOwnerAndAccountBestEffort(
  ctx: SupabaseContext,
  account: AccountRecord,
  owner: OwnerProfileRecord,
): Promise<void> {
  try {
    await restoreProfile(ctx, owner);
  } catch (error) {
    console.error(
      "Falha ao restaurar profile apos erro de exclusao:",
      error,
    );
  }

  await restoreAccountBestEffort(ctx, account);
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
        const requesterId = await assertActiveSuperAdmin(ctx);
        const account = await loadAccount(
          ctx,
          validation.data.accountId,
        );
        const owner = await loadOwnerProfile(
          ctx,
          account.owner_profile_id,
        );

        const snapshot = await loadSafetySnapshot(
          ctx,
          account,
          owner,
        );

        if (hasBlockingDependencies(snapshot)) {
          throw accountNotEmptyError();
        }

        const deletionMode = getOwnerDeletionMode(owner);

        if (deletionMode === "unsupported_owner") {
          throw new DeleteAccountError({
            status: 409,
            code: "ACCOUNT_OWNER_NOT_REMOVABLE",
            message:
              "O administrador desta conta nao pode ser excluido com seguranca.",
          });
        }

        if (deletionMode === "preserve_super_admin") {
          await deleteAccountRow(ctx, account.id);

          return Response.json({
            success: true,
            accountId: account.id,
            ownerProfileId: owner.id,
            ownerPreserved: true,
            deletedAuthUser: false,
          });
        }

        if (owner.id === requesterId) {
          throw new DeleteAccountError({
            status: 409,
            code: "SELF_DELETE_BLOCKED",
            message:
              "Voce nao pode excluir o proprio usuario autenticado.",
          });
        }

        await deleteAccountRow(ctx, account.id);

        try {
          await deleteProfileRow(ctx, owner.id);
        } catch (error) {
          await restoreAccountBestEffort(ctx, account);
          throw error;
        }

        const { error: authDeleteError } =
          await ctx.supabaseAdmin.auth.admin.deleteUser(owner.id);

        if (authDeleteError) {
          await restoreOwnerAndAccountBestEffort(
            ctx,
            account,
            owner,
          );
          throw new DeleteAccountError({
            status: 500,
            code: "AUTH_DELETE_FAILED",
            message:
              "Nao foi possivel excluir o usuario de autenticacao.",
          });
        }

        return Response.json({
          success: true,
          accountId: account.id,
          ownerProfileId: owner.id,
          ownerPreserved: false,
          deletedAuthUser: true,
        });
      } catch (error) {
        console.error(
          "Erro ao excluir conta cliente:",
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
              "Nao foi possivel excluir a conta e o administrador.",
          }),
        );
      }
    },
  ),
};
