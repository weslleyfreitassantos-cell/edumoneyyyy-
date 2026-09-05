import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";
import {
  buildInstitutionLoginUrl,
  generateSecurePassword,
  SchoolAccessConfigurationError,
  SchoolAccessEmailError,
  sendSchoolAccessEmail,
  type SchoolAccessRole,
} from "../_shared/school-access.ts";

type UserRole = Database["public"]["Enums"]["user_role"];
type TargetRole = Extract<
  UserRole,
  "DIRECTOR" | "TEACHER" | "STUDENT" | "GUARDIAN"
>;
type RequesterInviteRole = "ADMIN" | "DIRECTOR" | "SECRETARY";

interface ExistingProfile {
  id: string;
  email: string;
  role: UserRole;
  active: boolean | null;
  platform_role: Database["public"]["Enums"]["platform_role"];
}

interface ExistingAuthUser {
  id: string;
  email?: string | null;
}

interface InstitutionRecord {
  id: string;
  name: string;
  active: boolean | null;
  account_id: string | null;
  subdomain?: string | null;
  logo_url?: string | null;
  login_display_name?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

interface AccountRecord {
  id: string;
  owner_profile_id: string;
  status: string;
}

interface RollbackState {
  createdAuthUserId: string | null;
  createdProfileId: string | null;
  createdMembershipId: string | null;
  createdStudentId: string | null;
  createdGuardianshipId: string | null;
}

const targetRoleSchema = z.enum([
  "DIRECTOR",
  "TEACHER",
  "STUDENT",
  "GUARDIAN",
]);

const optionalCpfSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") return undefined;
    return value;
  },
  z
    .string()
    .trim()
    .regex(/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/, "CPF deve conter 11 digitos")
    .optional(),
);

const studentPayloadSchema = z
  .object({
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento invalida"),
    cpf: optionalCpfSchema,
  })
  .strict();

const guardianPayloadSchema = z
  .object({
    studentId: z.guid("Aluno invalido"),
    relationship: z.string().trim().min(2, "Relacionamento obrigatorio").max(40, "Relacionamento muito longo"),
  })
  .strict();

const requestSchema = z
  .object({
    institutionId: z.guid("Instituicao invalida"),
    role: targetRoleSchema,
    fullName: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, " "))
      .pipe(z.string().min(3, "Nome obrigatorio").max(120, "Nome muito longo")),
    email: z.string().trim().toLowerCase().email("E-mail invalido"),
    phone: z.string().trim().max(40, "Telefone muito longo").optional(),
    // Compatibilidade legada: a falha exclusiva do e-mail sempre retorna 201.
    continueOnEmailFailure: z.boolean().optional(),
    student: studentPayloadSchema.optional(),
    guardian: guardianPayloadSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.role === "STUDENT" && !value.student) {
      context.addIssue({
        code: "custom",
        path: ["student", "birthDate"],
        message: "Aluno exige data de nascimento",
      });
    }
    if (value.role === "GUARDIAN" && !value.guardian) {
      context.addIssue({
        code: "custom",
        path: ["guardian", "studentId"],
        message: "Responsavel exige aluno vinculado",
      });
    }
    if (value.role !== "STUDENT" && value.student) {
      context.addIssue({
        code: "custom",
        path: ["student"],
        message: "Dados de aluno aceitos somente para STUDENT",
      });
    }
    if (value.role !== "GUARDIAN" && value.guardian) {
      context.addIssue({
        code: "custom",
        path: ["guardian"],
        message: "Dados de responsavel aceitos somente para GUARDIAN",
      });
    }
  });

type RequestData = z.infer<typeof requestSchema>;

const INVITE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const INVITE_RATE_LIMIT_MAX_ATTEMPTS = 20;
const inviteRateLimit = new Map<string, { startedAt: number; count: number }>();

function assertInviteRateLimit(requesterId: string): void {
  const now = Date.now();
  const previous = inviteRateLimit.get(requesterId);

  if (!previous || now - previous.startedAt >= INVITE_RATE_LIMIT_WINDOW_MS) {
    inviteRateLimit.set(requesterId, { startedAt: now, count: 1 });
    return;
  }

  if (previous.count >= INVITE_RATE_LIMIT_MAX_ATTEMPTS) {
    throw new InviteError({
      status: 429,
      code: "ACCESS_RATE_LIMITED",
      message: "Muitas tentativas de criacao de acesso. Tente novamente mais tarde.",
    });
  }

  previous.count += 1;
}

class InviteError extends Error {
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
    this.name = "InviteError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function jsonError({
  status,
  code,
  message,
  requestId,
  fieldErrors,
  extra,
}: {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  fieldErrors?: Record<string, string>;
  extra?: Record<string, unknown>;
}): Response {
  return Response.json(
    {
      success: false,
      code,
      message,
      ...(requestId ? { requestId } : {}),
      ...(fieldErrors ? { fieldErrors } : {}),
      ...extra,
    },
    { status },
  );
}

function toFieldName(issuePath: PropertyKey[]): string {
  const path = issuePath.join(".");
  if (path === "institutionId") return "institutionId";
  if (path === "fullName") return "fullName";
  if (path === "email") return "email";
  if (path === "phone") return "phone";
  if (path === "role") return "target";
  if (path.startsWith("student.birthDate")) return "birthDate";
  if (path.startsWith("student.cpf")) return "cpf";
  if (path.startsWith("guardian.studentId")) return "guardianStudentId";
  if (path.startsWith("guardian.relationship")) return "relationship";
  return path || "form";
}

function getFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const fieldName = toFieldName(issue.path);
    fieldErrors[fieldName] ??= issue.message;
  }
  return fieldErrors;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isDuplicateAuthError(message: string | undefined): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return (
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("exists") ||
    normalized.includes("duplicate")
  );
}

function toPostgresCode(error: unknown): string | null {
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
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

function toPublicError(error: unknown): InviteError {
  if (error instanceof InviteError) return error;

  if (error instanceof SchoolAccessConfigurationError) {
    return new InviteError({
      status: 422,
      code: error.code,
      message: error.message,
      fieldErrors: { institutionId: error.message },
    });
  }

  const postgresCode = toPostgresCode(error);
  if (postgresCode === "42501") {
    return new InviteError({
      status: 403,
      code: "DATABASE_PERMISSION_DENIED",
      message: "Seu acesso atual nao permite concluir este acesso.",
    });
  }

  if (postgresCode === "23503" || postgresCode === "22P02" || postgresCode === "42804") {
    return new InviteError({
      status: 422,
      code: "INVALID_ACCESS_RELATION",
      message: "Revise os dados informados para concluir o acesso.",
    });
  }

  if (postgresCode === "23505") {
    return new InviteError({
      status: 409,
      code: "ACCESS_CONFLICT",
      message: "Ja existe um cadastro com estes dados.",
    });
  }

  if (isDuplicateAuthError(toErrorMessage(error))) {
    return new InviteError({
      status: 409,
      code: "AUTH_USER_ALREADY_EXISTS",
      message: "Ja existe um usuario cadastrado com este e-mail.",
      fieldErrors: { email: "E-mail ja cadastrado." },
    });
  }

  return new InviteError({
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Nao foi possivel concluir o acesso.",
  });
}

function getAllowedInviteRoles(requesterRole: RequesterInviteRole): TargetRole[] {
  if (requesterRole === "ADMIN") {
    return ["DIRECTOR", "TEACHER", "STUDENT", "GUARDIAN"];
  }
  if (requesterRole === "DIRECTOR") {
    return ["TEACHER", "STUDENT", "GUARDIAN"];
  }
  return ["STUDENT", "GUARDIAN"];
}

function canRequesterInviteRole(
  requesterRole: RequesterInviteRole,
  targetRole: TargetRole,
): boolean {
  return getAllowedInviteRoles(requesterRole).includes(targetRole);
}

async function findAuthUserByEmail(
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<ExistingAuthUser | null> {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const matchingUser = (data?.users ?? []).find(
      (user: ExistingAuthUser) => normalizeEmail(user.email ?? "") === email,
    );
    if (matchingUser) return matchingUser;
    if ((data?.users ?? []).length < perPage) return null;

    page += 1;
  }
}

async function getOrCreateMembership(
  supabaseAdmin: SupabaseClient,
  profileId: string,
  institutionId: string,
  role: TargetRole,
  rollback: RollbackState,
): Promise<string> {
  const { data: memberships, error: lookupError } = await supabaseAdmin
    .from("memberships")
    .select("id, active")
    .eq("profile_id", profileId)
    .eq("institution_id", institutionId)
    .eq("role", role)
    .limit(10);

  if (lookupError) throw lookupError;

  const activeMembership = (memberships ?? []).find(
    (membership: { id: string; active: boolean | null }) => membership.active === true,
  );
  if (activeMembership) return activeMembership.id;

  const inactiveMembership = memberships?.[0] as { id: string } | undefined;
  if (inactiveMembership) {
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .update({ active: true })
      .eq("id", inactiveMembership.id)
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Nao foi possivel reativar o acesso.");
    return data.id;
  }

  const { data, error } = await supabaseAdmin
    .from("memberships")
    .insert({ profile_id: profileId, institution_id: institutionId, role, active: true })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Nao foi possivel criar o vinculo.");

  rollback.createdMembershipId = data.id;
  return data.id;
}

async function getOrCreateStudent(
  supabaseAdmin: SupabaseClient,
  profileId: string,
  institutionId: string,
  input: RequestData,
  rollback: RollbackState,
): Promise<{ id: string; registrationNumber: string }> {
  const { data: existingStudent, error: existingStudentError } = await supabaseAdmin
    .from("students")
    .select("id, registration_number")
    .eq("profile_id", profileId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (existingStudentError) throw existingStudentError;
  if (existingStudent) {
    return {
      id: existingStudent.id,
      registrationNumber: existingStudent.registration_number,
    };
  }

  if (input.student?.cpf) {
    const { data: existingCpfStudent, error: cpfLookupError } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("cpf", input.student.cpf)
      .maybeSingle();
    if (cpfLookupError) throw cpfLookupError;
    if (existingCpfStudent) {
      throw new InviteError({
        status: 409,
        code: "STUDENT_CPF_ALREADY_EXISTS",
        message: "Ja existe estudante com este CPF.",
        fieldErrors: { cpf: "CPF ja cadastrado." },
      });
    }
  }

  const { data: createdStudent, error: studentInsertError } = await supabaseAdmin
    .from("students")
    .insert({
      profile_id: profileId,
      institution_id: institutionId,
      birth_date: input.student!.birthDate,
      cpf: input.student?.cpf ?? null,
      active: true,
    })
    .select("id, registration_number")
    .single();

  if (studentInsertError || !createdStudent) {
    throw studentInsertError ?? new Error("Nao foi possivel criar o registro de aluno.");
  }

  rollback.createdStudentId = createdStudent.id;
  return {
    id: createdStudent.id,
    registrationNumber: createdStudent.registration_number,
  };
}

async function getOrCreateGuardianship(
  supabaseAdmin: SupabaseClient,
  profileId: string,
  input: RequestData,
  rollback: RollbackState,
): Promise<{ id: string }> {
  const guardian = input.guardian!;
  const { data: links, error: lookupError } = await supabaseAdmin
    .from("guardianships")
    .select("id, active")
    .eq("guardian_profile_id", profileId)
    .eq("student_id", guardian.studentId)
    .limit(10);

  if (lookupError) throw lookupError;

  const activeLink = (links ?? []).find(
    (link: { id: string; active: boolean | null }) => link.active === true,
  );
  if (activeLink) return { id: activeLink.id };

  const inactiveLink = links?.[0] as { id: string } | undefined;
  if (inactiveLink) {
    const { data, error } = await supabaseAdmin
      .from("guardianships")
      .update({ relationship: guardian.relationship, active: true })
      .eq("id", inactiveLink.id)
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Nao foi possivel reativar o vinculo.");
    return { id: data.id };
  }

  const { data, error } = await supabaseAdmin
    .from("guardianships")
    .insert({
      guardian_profile_id: profileId,
      student_id: guardian.studentId,
      relationship: guardian.relationship,
      is_primary: false,
      active: true,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Nao foi possivel criar o vinculo com o aluno.");

  rollback.createdGuardianshipId = data.id;
  return { id: data.id };
}

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (request, ctx) => {
    const requestId =
      request.headers.get("x-request-id") ??
      request.headers.get("x-supabase-request-id") ??
      crypto.randomUUID();

    if (request.method !== "POST") {
      return jsonError({
        status: 405,
        code: "METHOD_NOT_ALLOWED",
        message: "Metodo nao permitido.",
        requestId,
      });
    }

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return jsonError({
        status: 400,
        code: "INVALID_JSON",
        message: "Corpo da requisicao invalido.",
        requestId,
      });
    }

    const validation = requestSchema.safeParse(requestBody);
    if (!validation.success) {
      return jsonError({
        status: 400,
        code: "INVALID_PAYLOAD",
        message: validation.error.issues[0]?.message ?? "Dados invalidos.",
        requestId,
        fieldErrors: getFieldErrors(validation.error),
      });
    }

    const input = validation.data;
    const rollback: RollbackState = {
      createdAuthUserId: null,
      createdProfileId: null,
      createdMembershipId: null,
      createdStudentId: null,
      createdGuardianshipId: null,
    };

    try {
      const {
        data: { user },
        error: userError,
      } = await ctx.supabase.auth.getUser();

      if (userError || !user) {
        throw new InviteError({
          status: 401,
          code: "UNAUTHENTICATED",
          message: "Sessao invalida ou expirada.",
        });
      }

      assertInviteRateLimit(user.id);

      const { data: requesterProfile, error: requesterProfileError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id, platform_role, active")
        .eq("id", user.id)
        .single();

      if (requesterProfileError) throw requesterProfileError;
      if (requesterProfile?.active !== true) {
        throw new InviteError({
          status: 403,
          code: "PROFILE_INACTIVE",
          message: "Perfil desativado nao pode criar acessos.",
        });
      }

      const isSuperAdmin = requesterProfile.platform_role === "SUPER_ADMIN";
      const { data: institution, error: institutionError } = await ctx.supabaseAdmin
        .from("institutions")
        .select("id, name, active, account_id, subdomain, logo_url, login_display_name, primary_color, secondary_color")
        .eq("id", input.institutionId)
        .maybeSingle();

      if (institutionError) throw institutionError;

      const activeInstitution = institution as InstitutionRecord | null;
      if (!activeInstitution || activeInstitution.active !== true) {
        throw new InviteError({
          status: 404,
          code: "INSTITUTION_NOT_FOUND",
          message: "Instituicao ativa nao encontrada.",
          fieldErrors: { institutionId: "Selecione uma instituicao ativa." },
        });
      }

      let account: AccountRecord | null = null;
      if (activeInstitution.account_id) {
        const { data: accountData, error: accountError } = await ctx.supabaseAdmin
          .from("accounts")
          .select("id, owner_profile_id, status")
          .eq("id", activeInstitution.account_id)
          .maybeSingle();

        if (accountError) throw accountError;
        account = accountData as AccountRecord | null;
        if (!account) {
          throw new InviteError({
            status: 404,
            code: "ACCOUNT_NOT_FOUND",
            message: "Conta da instituicao nao encontrada.",
          });
        }
        if (account.status !== "ACTIVE") {
          throw new InviteError({
            status: 409,
            code: "ACCOUNT_NOT_ACTIVE",
            message: "Conta suspensa ou cancelada nao permite criar acessos.",
          });
        }
      }

      const { data: requesterMembershipRows, error: requesterMembershipError } = await ctx.supabaseAdmin
        .from("memberships")
        .select("id, role, active")
        .eq("profile_id", user.id)
        .eq("institution_id", input.institutionId);

      if (requesterMembershipError) throw requesterMembershipError;

      const activeMemberships = (requesterMembershipRows ?? []).filter(
        (membership: { active: boolean | null }) => membership.active === true,
      );
      const isAccountOwner = account?.owner_profile_id === user.id;
      const adminMembership = activeMemberships.find(
        (membership: { role: string }) => membership.role === "ADMIN",
      );
      const directorMembership = activeMemberships.find(
        (membership: { role: string }) => membership.role === "DIRECTOR",
      );
      const secretaryMembership = activeMemberships.find(
        (membership: { role: string }) => membership.role === "SECRETARY",
      );
      const requesterRole: RequesterInviteRole | null = isSuperAdmin
        ? "ADMIN"
        : isAccountOwner || adminMembership
          ? "ADMIN"
          : directorMembership
            ? "DIRECTOR"
            : secretaryMembership
              ? "SECRETARY"
              : null;

      if (!requesterRole) {
        throw new InviteError({
          status: 403,
          code: "INSUFFICIENT_PERMISSION",
          message: "Seu papel atual nao permite criar acessos nesta escola.",
        });
      }

      if (!canRequesterInviteRole(requesterRole, input.role)) {
        throw new InviteError({
          status: 403,
          code: "TARGET_ROLE_NOT_ALLOWED",
          message: "Seu papel atual nao permite criar este tipo de acesso.",
          fieldErrors: { target: "Escolha um papel permitido para seu acesso." },
        });
      }

      const loginUrl = buildInstitutionLoginUrl(activeInstitution.subdomain);
      const existingAuthUser = await findAuthUserByEmail(ctx.supabaseAdmin, input.email);
      const { data: existingProfileData, error: profileLookupError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id, email, role, active, platform_role")
        .ilike("email", input.email)
        .limit(10);

      if (profileLookupError) throw profileLookupError;

      const existingProfile = ((existingProfileData ?? []) as ExistingProfile[]).find(
        (profile) => normalizeEmail(profile.email) === input.email,
      ) ?? null;

      if (existingProfile?.platform_role === "SUPER_ADMIN") {
        throw new InviteError({
          status: 409,
          code: "SUPER_ADMIN_EMAIL_RESERVED",
          message: "Este e-mail pertence a um Super Administrador e nao pode receber acesso escolar.",
          fieldErrors: { email: "Este e-mail pertence ao Super Administrador." },
        });
      }

      if (existingProfile) {
        const { data: ownedAccount, error: ownedAccountError } = await ctx.supabaseAdmin
          .from("accounts")
          .select("id")
          .eq("owner_profile_id", existingProfile.id)
          .maybeSingle();

        if (ownedAccountError) throw ownedAccountError;
        if (ownedAccount) {
          throw new InviteError({
            status: 409,
            code: "EMAIL_BELONGS_TO_ACCOUNT_OWNER",
            message: "Este e-mail ja pertence ao administrador de uma conta.",
            fieldErrors: { email: "Este usuario ja administra uma conta." },
          });
        }
      }

      if (existingProfile) {
        if (existingProfile.active !== true) {
          throw new InviteError({
            status: 409,
            code: "TARGET_PROFILE_INACTIVE",
            message: "O perfil existente esta desativado e nao pode receber um novo vinculo.",
            fieldErrors: { email: "Este perfil esta desativado." },
          });
        }
      }

      if (existingAuthUser || existingProfile) {
        throw new InviteError({
          status: 409,
          code: "EMAIL_ALREADY_REGISTERED",
          message: "Ja existe um usuario cadastrado com este e-mail.",
          fieldErrors: { email: "Este e-mail ja esta cadastrado." },
        });
      }

      const generatedPassword = generateSecurePassword();
      const { data: createdAuth, error: createAuthError } = await ctx.supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: input.fullName,
          role: input.role,
          institution_id: activeInstitution.id,
          institution_name: activeInstitution.name,
        },
      });

      if (createAuthError || !createdAuth.user) {
        if (isDuplicateAuthError(createAuthError?.message)) {
          throw new InviteError({
            status: 409,
            code: "EMAIL_ALREADY_REGISTERED",
            message: "Ja existe um usuario cadastrado com este e-mail.",
            fieldErrors: { email: "Este e-mail ja esta cadastrado." },
          });
        }
        throw createAuthError ?? new Error("Nao foi possivel criar o usuario de autenticacao.");
      }

      const profileId = createdAuth.user.id;
      rollback.createdAuthUserId = profileId;

      const { error: profileInsertError } = await ctx.supabaseAdmin
        .from("profiles")
        .insert({
          id: profileId,
          full_name: input.fullName,
          email: input.email,
          phone: input.phone ?? null,
          role: input.role,
          platform_role: "USER",
          avatar_url: null,
          active: true,
        });
      if (profileInsertError) throw profileInsertError;
      rollback.createdProfileId = profileId;

      const membershipId = await getOrCreateMembership(
        ctx.supabaseAdmin,
        profileId,
        input.institutionId,
        input.role,
        rollback,
      );

      let studentResult: { id: string; registrationNumber: string } | undefined;
      let guardianshipResult: { id: string } | undefined;

      if (input.role === "STUDENT") {
        const student = await getOrCreateStudent(
          ctx.supabaseAdmin,
          profileId,
          input.institutionId,
          input,
          rollback,
        );
        studentResult = {
          id: student.id,
          registrationNumber: student.registrationNumber,
        };
      }

      if (input.role === "GUARDIAN") {
        const { data: linkedStudent, error: linkedStudentError } = await ctx.supabaseAdmin
          .from("students")
          .select("id, institution_id, active")
          .eq("id", input.guardian!.studentId)
          .maybeSingle();

        if (linkedStudentError) throw linkedStudentError;
        if (!linkedStudent || linkedStudent.institution_id !== input.institutionId) {
          throw new InviteError({
            status: 404,
            code: "STUDENT_OUTSIDE_INSTITUTION",
            message: "Aluno vinculado pertence a outra instituicao.",
            fieldErrors: { guardianStudentId: "Aluno nao pertence a escola ativa." },
          });
        }
        if (linkedStudent.active !== true) {
          throw new InviteError({
            status: 409,
            code: "STUDENT_INACTIVE",
            message: "Nao e possivel criar acesso para um aluno inativo.",
            fieldErrors: { guardianStudentId: "Aluno inativo." },
          });
        }
        guardianshipResult = await getOrCreateGuardianship(
          ctx.supabaseAdmin,
          profileId,
          input,
          rollback,
        );
      }

      try {
        await sendSchoolAccessEmail({
          recipientName: input.fullName,
          recipientEmail: input.email,
          institutionName: activeInstitution.name,
          displayName: activeInstitution.login_display_name,
          logoUrl: activeInstitution.logo_url,
          primaryColor: activeInstitution.primary_color,
          secondaryColor: activeInstitution.secondary_color,
          role: input.role as SchoolAccessRole,
          loginUrl,
          ...(generatedPassword ? { password: generatedPassword } : {}),
        });
      } catch (emailError) {
        console.error("Falha ao enviar e-mail de acesso escolar", {
          requestId,
          code: emailError instanceof SchoolAccessEmailError
            ? emailError.code
            : "EMAIL_DELIVERY_FAILED",
        });
        return Response.json(
          {
            success: true,
            accessCreated: true,
            userId: profileId,
            profileId,
            membershipId,
            role: input.role,
            email: input.email,
            ...(studentResult ? { student: studentResult } : {}),
            ...(guardianshipResult ? { guardianship: guardianshipResult } : {}),
            invitationSent: false,
            emailPending: true,
            reusedExistingUser: false,
            message: "Acesso criado; o e-mail de acesso ficou pendente.",
          },
          { status: 201 },
        );
      }

      return Response.json(
        {
          success: true,
          accessCreated: true,
          userId: profileId,
          profileId,
          membershipId,
          role: input.role,
          email: input.email,
          ...(studentResult ? { student: studentResult } : {}),
          ...(guardianshipResult ? { guardianship: guardianshipResult } : {}),
          invitationSent: true,
          emailPending: false,
          reusedExistingUser: false,
          message: "Acesso criado e credenciais enviadas por e-mail.",
        },
        { status: 201 },
      );
    } catch (error) {
      console.error("Erro ao criar acesso escolar:", {
        requestId,
        code: error instanceof InviteError ? error.code : "INTERNAL_ERROR",
      });

      try {
        if (rollback.createdGuardianshipId) {
          await ctx.supabaseAdmin.from("guardianships").delete().eq("id", rollback.createdGuardianshipId);
        }
        if (rollback.createdStudentId) {
          await ctx.supabaseAdmin.from("students").delete().eq("id", rollback.createdStudentId);
        }
        if (rollback.createdMembershipId) {
          await ctx.supabaseAdmin.from("memberships").delete().eq("id", rollback.createdMembershipId);
        }
        if (rollback.createdProfileId) {
          await ctx.supabaseAdmin.from("profiles").delete().eq("id", rollback.createdProfileId);
        }
        if (rollback.createdAuthUserId) {
          await ctx.supabaseAdmin.auth.admin.deleteUser(rollback.createdAuthUserId);
        }
      } catch (cleanupError) {
        console.error("Erro no cleanup do acesso escolar:", {
          requestId,
          code: toPostgresCode(cleanupError) ?? "CLEANUP_FAILED",
        });
      }

      const publicError = toPublicError(error);
      return jsonError({
        status: publicError.status,
        code: publicError.code,
        message: publicError.message,
        requestId,
        fieldErrors: publicError.fieldErrors,
      });
    }
  }),
};
