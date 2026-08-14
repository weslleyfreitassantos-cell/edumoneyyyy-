import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";
import {
  buildInstitutionLoginUrl,
  generateSecurePassword,
  sendSchoolAccessEmail,
  type SchoolAccessRole,
} from "../_shared/school-access.ts";
import {
  getUpdateAuthorizationDecision,
  type UpdateAuthorizationContext,
} from "./authorization.ts";

type UserRole = Database["public"]["Enums"]["user_role"];
type MembershipLookupInput = {
  institutionId: string;
  membershipId: string;
};
type SupabaseFunctionContext = {
  supabase: {
    auth: {
      getUser: () => Promise<{
        data: { user: { id: string } | null };
        error: unknown;
      }>;
    };
  };
  supabaseAdmin: SupabaseClient;
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
  "ADMIN",
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
  z.object({
    action: z.literal("link_guardian"),
    institutionId: z.guid(),
    guardianProfileId: z.guid(),
    studentId: z.guid(),
    relationship: z.string().trim().min(2).max(40),
    isPrimary: z.boolean().default(false),
  }).strict(),
  z.object({
    action: z.literal("generate_access"),
    institutionId: z.guid(),
    membershipId: z.guid(),
    confirmation: z.literal("GERAR NOVA SENHA"),
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
  if (code === "23505") {
    return new ManageSchoolUserError({
      status: 409,
      code: "GUARDIANSHIP_ALREADY_EXISTS",
      message: "Este responsavel ja esta vinculado a este aluno.",
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
  options: { allowOperationalManager?: boolean } = {},
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

  const isOperationalManager = (memberships ?? []).some(
    (membership) =>
      membership.active === true &&
      (membership.role === "DIRECTOR" || membership.role === "SECRETARY"),
  );

  if (
    !isSuperAdmin &&
    !isAccountOwner &&
    !isLocalAdmin &&
    !(options.allowOperationalManager && isOperationalManager)
  ) {
    throw new ManageSchoolUserError({
      status: 403,
      code: "ADMIN_REQUIRED",
      message: "Apenas administradores podem gerenciar usuarios da escola.",
    });
  }

  return {
    isSuperAdmin,
    isAccountOwner,
    isLocalAdmin,
    isOperationalManager,
  };
}

async function getTargetMembership(
  ctx: SupabaseFunctionContext,
  input: MembershipLookupInput,
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
  authorization: UpdateAuthorizationContext,
) {
  const membership = await getTargetMembership(ctx, input);
  await assertTargetCanBeManaged(ctx, requesterId, membership.profile_id);

  const operationalManagerOnly =
    authorization.isOperationalManager &&
    !authorization.isSuperAdmin &&
    !authorization.isAccountOwner &&
    !authorization.isLocalAdmin;
  let studentActive: boolean | null | undefined;

  if (
    operationalManagerOnly &&
    input.password !== undefined &&
    membership.role === "STUDENT"
  ) {
    const { data: student, error: studentError } = await ctx.supabaseAdmin
      .from("students")
      .select("id, active")
      .eq("profile_id", membership.profile_id)
      .eq("institution_id", input.institutionId)
      .maybeSingle();

    if (studentError) throw studentError;
    studentActive = student?.active ?? null;
  }

  const authorizationDecision = getUpdateAuthorizationDecision(
    authorization,
    {
      targetRole: membership.role,
      targetMembershipActive: membership.active,
      studentActive,
      hasPassword: input.password !== undefined,
      hasFullName: input.fullName !== undefined,
      hasRole: input.role !== undefined,
    },
  );

  if (!authorizationDecision.allowed) {
    const errorByCode: Record<NonNullable<typeof authorizationDecision.code>, ManageSchoolUserError> = {
      DIRECTOR_PASSWORD_ONLY: new ManageSchoolUserError({
        status: 403,
        code: "DIRECTOR_PASSWORD_ONLY",
        message: "Este papel pode redefinir somente a senha do aluno.",
      }),
      TARGET_MEMBERSHIP_INACTIVE: new ManageSchoolUserError({
        status: 403,
        code: "TARGET_MEMBERSHIP_INACTIVE",
        message: "Nao e possivel gerenciar uma membership inativa.",
      }),
      TARGET_ROLE_NOT_ALLOWED: new ManageSchoolUserError({
        status: 403,
        code: "TARGET_ROLE_NOT_ALLOWED",
        message: "Somente alunos podem ter a senha redefinida por esta tela.",
      }),
      STUDENT_INACTIVE: new ManageSchoolUserError({
        status: 403,
        code: "STUDENT_INACTIVE",
        message: "Nao e possivel redefinir a senha de um aluno inativo.",
      }),
    };
    throw errorByCode[authorizationDecision.code!];
  }

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
      {
        password: input.password,
        email_confirm: true,
      },
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

async function handleLinkGuardian(
  ctx: SupabaseFunctionContext,
  input: Extract<RequestData, { action: "link_guardian" }>,
) {
  const { data: guardianMembership, error: guardianMembershipError } =
    await ctx.supabaseAdmin
      .from("memberships")
      .select("id, profile_id, role, active")
      .eq("profile_id", input.guardianProfileId)
      .eq("institution_id", input.institutionId)
      .eq("role", "GUARDIAN")
      .eq("active", true)
      .maybeSingle();

  if (guardianMembershipError) throw guardianMembershipError;
  if (!guardianMembership) {
    throw new ManageSchoolUserError({
      status: 404,
      code: "GUARDIAN_NOT_FOUND",
      message: "Responsavel ativo nao encontrado nesta instituicao.",
    });
  }

  const { data: guardianProfile, error: guardianProfileError } =
    await ctx.supabaseAdmin
      .from("profiles")
      .select("id, active")
      .eq("id", input.guardianProfileId)
      .maybeSingle();

  if (guardianProfileError) throw guardianProfileError;
  if (!guardianProfile || guardianProfile.active !== true) {
    throw new ManageSchoolUserError({
      status: 404,
      code: "GUARDIAN_NOT_FOUND",
      message: "Responsavel ativo nao encontrado nesta instituicao.",
    });
  }

  const { data: student, error: studentError } =
    await ctx.supabaseAdmin
      .from("students")
      .select("id, institution_id, active")
      .eq("id", input.studentId)
      .maybeSingle();

  if (studentError) throw studentError;
  if (!student || student.institution_id !== input.institutionId) {
    throw new ManageSchoolUserError({
      status: 404,
      code: "STUDENT_OUTSIDE_INSTITUTION",
      message: "Aluno nao pertence a instituicao selecionada.",
    });
  }
  if (student.active !== true) {
    throw new ManageSchoolUserError({
      status: 409,
      code: "STUDENT_INACTIVE",
      message: "Nao e possivel vincular responsavel a um aluno inativo.",
    });
  }

  const { data: existingLinks, error: existingLinksError } =
    await ctx.supabaseAdmin
      .from("guardianships")
      .select("id, active")
      .eq("guardian_profile_id", input.guardianProfileId)
      .eq("student_id", input.studentId)
      .limit(10);

  if (existingLinksError) throw existingLinksError;

  const links = (existingLinks ?? []) as Array<{
    id: string;
    active: boolean | null;
  }>;
  const activeLink = links.find((link) => link.active === true);
  if (activeLink) {
    throw new ManageSchoolUserError({
      status: 409,
      code: "GUARDIANSHIP_ALREADY_EXISTS",
      message: "Este responsavel ja esta vinculado a este aluno.",
    });
  }
  if (links.length > 1) {
    throw new ManageSchoolUserError({
      status: 409,
      code: "GUARDIANSHIP_DATA_CONFLICT",
      message: "Nao foi possivel corrigir automaticamente os vinculos duplicados.",
    });
  }

  if (input.isPrimary) {
    const { error: clearPrimaryError } = await ctx.supabaseAdmin
      .from("guardianships")
      .update({ is_primary: false })
      .eq("student_id", input.studentId)
      .eq("active", true);

    if (clearPrimaryError) throw clearPrimaryError;
  }

  let guardianshipId: string;
  const existingInactiveLink = links[0];

  if (existingInactiveLink) {
    const { data: restoredLink, error: restoreError } = await ctx.supabaseAdmin
      .from("guardianships")
      .update({
        relationship: input.relationship,
        is_primary: input.isPrimary,
        active: true,
      })
      .eq("id", existingInactiveLink.id)
      .select("id")
      .single();

    if (restoreError || !restoredLink) throw restoreError ?? new Error("Nao foi possivel reativar o vinculo.");
    guardianshipId = restoredLink.id;
  } else {
    const { data: createdLink, error: createError } = await ctx.supabaseAdmin
      .from("guardianships")
      .insert({
        guardian_profile_id: input.guardianProfileId,
        student_id: input.studentId,
        relationship: input.relationship,
        is_primary: input.isPrimary,
        active: true,
      })
      .select("id")
      .single();

    if (createError || !createdLink) throw createError ?? new Error("Nao foi possivel criar o vinculo.");
    guardianshipId = createdLink.id;
  }

  return jsonSuccess({
    success: true,
    action: "link_guardian",
    membershipId: guardianMembership.id,
    profileId: input.guardianProfileId,
    guardianshipId,
    message: "Responsavel vinculado ao aluno com sucesso.",
  });
}

async function handleGenerateAccess(
  ctx: SupabaseFunctionContext,
  requesterId: string,
  input: Extract<RequestData, { action: "generate_access" }>,
) {
  const membership = await getTargetMembership(ctx, input);
  await assertTargetCanBeManaged(ctx, requesterId, membership.profile_id);

  const { data: targetProfile, error: targetProfileError } = await ctx.supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, active")
    .eq("id", membership.profile_id)
    .maybeSingle();

  if (targetProfileError) throw targetProfileError;
  if (!targetProfile || targetProfile.active !== true) {
    throw new ManageSchoolUserError({
      status: 409,
      code: "TARGET_PROFILE_INACTIVE",
      message: "O perfil selecionado esta desativado.",
    });
  }

  const { data: institution, error: institutionError } = await ctx.supabaseAdmin
    .from("institutions")
    .select("id, name, active, account_id, subdomain, logo_url, login_display_name, primary_color, secondary_color")
    .eq("id", input.institutionId)
    .maybeSingle();

  if (institutionError) throw institutionError;
  if (!institution || institution.active !== true) {
    throw new ManageSchoolUserError({
      status: 404,
      code: "INSTITUTION_NOT_FOUND",
      message: "Instituicao ativa nao encontrada.",
    });
  }

  if (institution.account_id) {
    const { data: account, error: accountError } = await ctx.supabaseAdmin
      .from("accounts")
      .select("status")
      .eq("id", institution.account_id)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account || account.status !== "ACTIVE") {
      throw new ManageSchoolUserError({
        status: 409,
        code: "ACCOUNT_NOT_ACTIVE",
        message: "Conta suspensa ou cancelada nao permite gerar acessos.",
      });
    }
  }

  const loginUrl = buildInstitutionLoginUrl(institution.subdomain);
  const password = generateSecurePassword();
  const { error: passwordError } = await ctx.supabaseAdmin.auth.admin.updateUserById(
    membership.profile_id,
    {
      password,
      email_confirm: true,
    },
  );

  if (passwordError) {
    throw new ManageSchoolUserError({
      status: 422,
      code: "PASSWORD_UPDATE_FAILED",
      message: "Nao foi possivel gerar uma nova senha de acesso.",
    });
  }

  try {
    await sendSchoolAccessEmail({
      recipientName: targetProfile.full_name,
      recipientEmail: targetProfile.email,
      institutionName: institution.name,
      displayName: institution.login_display_name,
      logoUrl: institution.logo_url,
      primaryColor: institution.primary_color,
      secondaryColor: institution.secondary_color,
      role: membership.role as SchoolAccessRole,
      loginUrl,
      password,
    });
  } catch {
    throw new ManageSchoolUserError({
      status: 502,
      code: "ACCESS_PASSWORD_UPDATED_EMAIL_FAILED",
      message: "A senha foi atualizada, mas nao foi possivel enviar o novo e-mail de acesso.",
    });
  }

  return jsonSuccess({
    success: true,
    action: "generate_access",
    membershipId: membership.id,
    profileId: membership.profile_id,
    message: "Nova senha de acesso gerada e enviada por e-mail.",
  });
}

const authenticatedFetch = withSupabase<Database>(
  { auth: "user" },
  async (request, ctx) => {
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

        const authorization = await getAuthorizedContext(
          ctx,
          user.id,
          input.institutionId,
          {
            allowOperationalManager:
              input.action === "link_guardian" ||
              (input.action === "update" && input.password !== undefined),
          },
        );

        if (input.action === "update") {
          return await handleUpdate(ctx, user.id, input, authorization);
        }
        if (input.action === "delete") {
          return await handleDelete(ctx, user.id, input);
        }
        if (input.action === "generate_access") {
          return await handleGenerateAccess(ctx, user.id, input);
        }
        return await handleLinkGuardian(ctx, input);
      } catch (error) {
        console.error("Erro ao gerenciar usuario escolar:", {
          code: error instanceof ManageSchoolUserError ? error.code : "INTERNAL_ERROR",
        });
        return jsonError(toPublicError(error));
      }
    },
);

export default {
  fetch: (
    request: Request,
    ...args: Parameters<typeof authenticatedFetch> extends [
      Request,
      ...infer Rest,
    ]
      ? Rest
      : never
  ) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: corsHeaders,
      });
    }

    return authenticatedFetch(request, ...args);
  },
};
