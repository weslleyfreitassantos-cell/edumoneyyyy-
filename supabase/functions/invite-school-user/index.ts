import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import {
  buildIdentityConflict,
  getExistingProfileIdentityConflict,
  normalizeIdentityEmail,
  type IdentityConflict,
} from "../_shared/identity-protection.ts";
import type { Database as GeneratedDatabase } from "../_shared/database.types.ts";

type GeneratedPublicSchema = GeneratedDatabase["public"];
type GeneratedTables = GeneratedPublicSchema["Tables"];
type GeneratedStudentTable = GeneratedTables["students"];

type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedPublicSchema, "Tables"> & {
    Tables: Omit<GeneratedTables, "students"> & {
      students: Omit<GeneratedStudentTable, "Insert"> & {
        Insert: Omit<GeneratedStudentTable["Insert"], "registration_number"> & {
          registration_number?: string;
        };
      };
    };
  };
};

type UserRole = Database["public"]["Enums"]["user_role"];
type TargetRole = Extract<UserRole, "DIRECTOR" | "SECRETARY" | "TEACHER" | "STUDENT" | "GUARDIAN">;
type RequesterInviteRole = "ADMIN" | "DIRECTOR" | "SECRETARY";

interface ExistingProfile {
  id: string;
  email: string;
  role: UserRole;
  active: boolean | null;
  platform_role: Database["public"]["Enums"]["platform_role"];
}

interface InstitutionRecord {
  id: string;
  active: boolean | null;
  account_id: string | null;
}

interface AccountRecord {
  id: string;
  owner_profile_id: string;
  status: string;
}

interface RollbackState {
  createdAuthUserId: string | null;
  createdMembershipId: string | null;
  createdStudentId: string | null;
  createdGuardianshipId: string | null;
}

const targetRoleSchema = z.enum(["DIRECTOR", "SECRETARY", "TEACHER", "STUDENT", "GUARDIAN"]);

const optionalCpfSchema = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.string().trim().regex(/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/, "CPF deve conter 11 digitos").optional());

const studentPayloadSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento invalida"),
  cpf: optionalCpfSchema,
}).strict();

const guardianPayloadSchema = z.object({
  studentId: z.guid("Aluno invalido"),
  relationship: z.string().trim().min(2, "Relacionamento obrigatorio").max(40, "Relacionamento muito longo"),
}).strict();

const requestSchema = z.object({
  institutionId: z.guid("Instituicao invalida"),
  role: targetRoleSchema,
  fullName: z.string().trim().transform((value) => value.replace(/\s+/g, " ")).pipe(z.string().min(3, "Nome obrigatorio").max(120, "Nome muito longo")),
  email: z.string().trim().toLowerCase().email("E-mail invalido"),
  student: studentPayloadSchema.optional(),
  guardian: guardianPayloadSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.role === "STUDENT" && !value.student) {
    context.addIssue({ code: "custom", path: ["student", "birthDate"], message: "Aluno exige data de nascimento" });
  }
  if (value.role === "GUARDIAN" && !value.guardian) {
    context.addIssue({ code: "custom", path: ["guardian", "studentId"], message: "Responsavel exige aluno vinculado" });
  }
  if (value.role !== "STUDENT" && value.student) {
    context.addIssue({ code: "custom", path: ["student"], message: "Dados de aluno aceitos somente para STUDENT" });
  }
  if (value.role !== "GUARDIAN" && value.guardian) {
    context.addIssue({ code: "custom", path: ["guardian"], message: "Dados de responsavel aceitos somente para GUARDIAN" });
  }
});

type RequestData = z.infer<typeof requestSchema>;

class InviteError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string>;

  constructor({ status, code, message, fieldErrors }: { status: number; code: string; message: string; fieldErrors?: Record<string, string> }) {
    super(message);
    this.name = "InviteError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function jsonError({ status, code, message, requestId, fieldErrors }: { status: number; code: string; message: string; requestId?: string; fieldErrors?: Record<string, string> }): Response {
  return Response.json({ success: false, code, message, ...(requestId ? { requestId } : {}), ...(fieldErrors ? { fieldErrors } : {}) }, { status });
}

function inviteErrorFromIdentityConflict(conflict: IdentityConflict): InviteError {
  return new InviteError({
    status: conflict.status,
    code: conflict.code,
    message: conflict.message,
    fieldErrors: conflict.fieldErrors,
  });
}

function toFieldName(issuePath: PropertyKey[]): string {
  const path = issuePath.join(".");
  if (path === "institutionId") return "institutionId";
  if (path === "fullName") return "fullName";
  if (path === "email") return "email";
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

function isLocalhostUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
}

function getAppUrl(): string {
  const appUrl = Deno.env.get("APP_URL")?.replace(/\/+$/, "");
  if (!appUrl) {
    throw new InviteError({ status: 500, code: "MISSING_APP_URL", message: "A URL da aplicacao nao foi configurada." });
  }
  if (isLocalhostUrl(appUrl)) {
    throw new InviteError({ status: 500, code: "LOCALHOST_APP_URL", message: "A URL da aplicacao nao pode ser localhost em ambiente de producao." });
  }
  return appUrl;
}

function isDuplicateAuthError(message: string | undefined): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists") || normalized.includes("duplicate");
}

function isEmailDeliveryError(message: string | undefined): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("smtp") ||
    normalized.includes("email") ||
    normalized.includes("mail") ||
    normalized.includes("invite") ||
    normalized.includes("rate limit") ||
    normalized.includes("send");
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

  const postgresCode = toPostgresCode(error);
  if (postgresCode === "42501") {
    return new InviteError({
      status: 403,
      code: "DATABASE_PERMISSION_DENIED",
      message: "Seu acesso atual nao permite concluir este convite.",
    });
  }

  if (
    postgresCode === "23503" ||
    postgresCode === "22P02" ||
    postgresCode === "42804"
  ) {
    return new InviteError({
      status: 422,
      code: "INVALID_INVITE_RELATION",
      message: "Revise os dados informados para concluir o convite.",
    });
  }

  if (postgresCode === "23505") {
    return new InviteError({
      status: 409,
      code: "INVITE_CONFLICT",
      message: "Ja existe um cadastro com estes dados.",
    });
  }

  const message = toErrorMessage(error);
  if (isDuplicateAuthError(message)) {
    return new InviteError({
      status: 409,
      code: "AUTH_USER_ALREADY_EXISTS",
      message: "Ja existe um usuario cadastrado com este e-mail.",
      fieldErrors: { email: "E-mail ja cadastrado." },
    });
  }

  if (isEmailDeliveryError(message)) {
    return new InviteError({
      status: 502,
      code: "INVITE_EMAIL_DELIVERY_FAILED",
      message: "Nao foi possivel enviar o convite agora. Tente novamente em instantes.",
    });
  }

  return new InviteError({ status: 500, code: "INTERNAL_ERROR", message: "Nao foi possivel concluir o convite." });
}

function getAllowedInviteRoles(requesterRole: RequesterInviteRole): TargetRole[] {
  if (requesterRole === "ADMIN") return ["DIRECTOR", "SECRETARY", "TEACHER", "STUDENT", "GUARDIAN"];
  if (requesterRole === "DIRECTOR") return ["SECRETARY", "TEACHER", "STUDENT", "GUARDIAN"];
  return ["STUDENT", "GUARDIAN"];
}

function canRequesterInviteRole(requesterRole: RequesterInviteRole, targetRole: TargetRole): boolean {
  return getAllowedInviteRoles(requesterRole).includes(targetRole);
}

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (request, ctx) => {
    const requestId =
      request.headers.get("x-request-id") ??
      request.headers.get("x-supabase-request-id") ??
      crypto.randomUUID();

    if (request.method !== "POST") {
      return jsonError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Metodo nao permitido.", requestId });
    }

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return jsonError({ status: 400, code: "INVALID_JSON", message: "Corpo da requisicao invalido.", requestId });
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
      createdMembershipId: null,
      createdStudentId: null,
      createdGuardianshipId: null,
    };

    try {
      const { data: { user }, error: userError } = await ctx.supabase.auth.getUser();
      if (userError || !user) {
        throw new InviteError({ status: 401, code: "UNAUTHENTICATED", message: "Sessao invalida ou expirada." });
      }

      const { data: requesterProfile, error: requesterProfileError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("platform_role, active")
        .eq("id", user.id)
        .single();

      if (requesterProfileError) throw requesterProfileError;

      if (requesterProfile?.active !== true) {
        throw new InviteError({
          status: 403,
          code: "PROFILE_INACTIVE",
          message:
            "Perfil desativado nao pode convidar usuarios.",
        });
      }

      const isSuperAdmin = requesterProfile?.platform_role === "SUPER_ADMIN";

      const { data: institution, error: institutionError } = await ctx.supabaseAdmin
        .from("institutions")
        .select("id, active, account_id")
        .eq("id", input.institutionId)
        .maybeSingle();

      if (institutionError) throw institutionError;

      const activeInstitution = institution as InstitutionRecord | null;
      if (!activeInstitution || activeInstitution.active !== true) {
        throw new InviteError({ status: 404, code: "INSTITUTION_NOT_FOUND", message: "Instituicao ativa nao encontrada.", fieldErrors: { institutionId: "Selecione uma instituicao ativa." } });
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
          throw new InviteError({ status: 404, code: "ACCOUNT_NOT_FOUND", message: "Conta da instituicao nao encontrada." });
        }
        if (account.status !== "ACTIVE") {
          throw new InviteError({ status: 409, code: "ACCOUNT_NOT_ACTIVE", message: "Conta suspensa ou cancelada nao permite convites." });
        }
      }

      const { data: requesterMembershipRows, error: requesterMembershipError } = await ctx.supabaseAdmin
        .from("memberships")
        .select("id, role, active")
        .eq("profile_id", user.id)
        .eq("institution_id", input.institutionId);

      if (requesterMembershipError) throw requesterMembershipError;

      const activeMemberships = (requesterMembershipRows ?? []).filter((membership) => membership.active === true);
      const isAccountOwner = account?.owner_profile_id === user.id;

      const legacyAdminMembership = activeInstitution.account_id === null ? activeMemberships.find((membership) => membership.role === "ADMIN") : null;
      const directorMembership = activeMemberships.find((membership) => membership.role === "DIRECTOR");
      const secretaryMembership = activeMemberships.find((membership) => membership.role === "SECRETARY");

      const requesterRole: RequesterInviteRole | null = isSuperAdmin ? "ADMIN" : isAccountOwner || legacyAdminMembership ? "ADMIN" : directorMembership ? "DIRECTOR" : secretaryMembership ? "SECRETARY" : null;

      if (!requesterRole) {
        throw new InviteError({ status: 403, code: "INSUFFICIENT_PERMISSION", message: "Seu papel atual nao permite convidar usuarios nesta escola." });
      }

      if (!canRequesterInviteRole(requesterRole, input.role)) {
        throw new InviteError({ status: 403, code: "TARGET_ROLE_NOT_ALLOWED", message: "Seu papel atual nao permite convidar este tipo de usuario.", fieldErrors: { target: "Escolha um papel permitido para seu acesso." } });
      }

      const { data: existingProfileData, error: profileLookupError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id, email, role, active, platform_role")
        .ilike("email", input.email)
        .limit(10);

      if (profileLookupError) throw profileLookupError;

      const existingProfile = ((existingProfileData ?? []) as ExistingProfile[])
        .find((profile) => normalizeIdentityEmail(profile.email) === input.email) ?? null;

      if (existingProfile) {
        const { data: ownedAccount, error: ownedAccountError } = await ctx.supabaseAdmin
          .from("accounts")
          .select("id")
          .eq("owner_profile_id", existingProfile.id)
          .maybeSingle();

        if (ownedAccountError) throw ownedAccountError;

        const conflict = getExistingProfileIdentityConflict(
          existingProfile,
          Boolean(ownedAccount),
          "email",
        );

        if (conflict) {
          throw inviteErrorFromIdentityConflict(conflict);
        }
      }

      // Independent Validations (No profile required yet)
      if (input.role === "STUDENT" && input.student?.cpf) {
        const { data: existingCpfStudent, error: cpfLookupError } = await ctx.supabaseAdmin
          .from("students")
          .select("id")
          .eq("cpf", input.student.cpf)
          .maybeSingle();

        if (cpfLookupError) throw cpfLookupError;
        if (existingCpfStudent) {
          throw new InviteError({ status: 409, code: "STUDENT_CPF_ALREADY_EXISTS", message: "Ja existe estudante com este CPF.", fieldErrors: { cpf: "CPF ja cadastrado." } });
        }
      }

      if (input.role === "GUARDIAN") {
        const guardian = input.guardian!;
        const { data: linkedStudent, error: linkedStudentError } = await ctx.supabaseAdmin
          .from("students")
          .select("id, institution_id")
          .eq("id", guardian.studentId)
          .maybeSingle();

        if (linkedStudentError) throw linkedStudentError;
        if (!linkedStudent) {
          throw new InviteError({ status: 404, code: "STUDENT_NOT_FOUND", message: "Aluno vinculado nao encontrado.", fieldErrors: { guardianStudentId: "Aluno nao encontrado." } });
        }
        if (linkedStudent.institution_id !== input.institutionId) {
          throw new InviteError({ status: 404, code: "STUDENT_OUTSIDE_INSTITUTION", message: "Aluno vinculado pertence a outra instituicao.", fieldErrors: { guardianStudentId: "Aluno nao pertence a escola ativa." } });
        }
      }

      // EXECUTE AUTH CREATION (IF NEW)
      const invitationSent = true;
      const reusedExistingUser = false;

      const { data: invitationData, error: invitationError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(
        input.email,
        {
          data: { full_name: input.fullName, role: input.role },
          redirectTo: getAppUrl() + '/auth/confirm',
        }
      );

      if (invitationError || !invitationData.user) {
        if (isDuplicateAuthError(invitationError?.message)) {
          throw inviteErrorFromIdentityConflict(
            buildIdentityConflict(
              "AUTH_USER_ALREADY_EXISTS",
              "email",
            ),
          );
        }
        throw new InviteError({
          status: 502,
          code: "INVITE_EMAIL_DELIVERY_FAILED",
          message: "Nao foi possivel enviar o convite agora. Tente novamente em instantes.",
        });
      }

      const profileId = invitationData.user.id;
      rollback.createdAuthUserId = profileId;

      // EXECUTE PUBLIC SCHEMA INSERTS
      const { error: profileInsertError } = await ctx.supabaseAdmin
        .from("profiles")
        .insert({ id: profileId, full_name: input.fullName, email: input.email, role: input.role, platform_role: "USER", avatar_url: null, active: true });
      if (profileInsertError) throw profileInsertError;

      let studentResult: { id: string; registrationNumber: string; } | undefined;
      let guardianshipResult: { id: string; } | undefined;

      const { data: createdMembership, error: membershipInsertError } = await ctx.supabaseAdmin
        .from("memberships")
        .insert({ profile_id: profileId, institution_id: input.institutionId, role: input.role, active: true })
        .select("id").single();
      if (membershipInsertError || !createdMembership) throw new Error(membershipInsertError?.message ?? "Nao foi possivel criar o vinculo.");
      const membershipId = createdMembership.id;
      rollback.createdMembershipId = membershipId;

      if (input.role === "STUDENT") {
        const { data: createdStudent, error: studentInsertError } = await ctx.supabaseAdmin
          .from("students")
          .insert({ profile_id: profileId, institution_id: input.institutionId, birth_date: input.student!.birthDate, cpf: input.student?.cpf ?? null, active: true })
          .select("id, registration_number").single();
        if (studentInsertError || !createdStudent) throw new Error(studentInsertError?.message ?? "Nao foi possivel criar o registro de aluno.");
        rollback.createdStudentId = createdStudent.id;
        studentResult = { id: createdStudent.id, registrationNumber: createdStudent.registration_number };
      }

      if (input.role === "GUARDIAN") {
        const guardian = input.guardian!;
        const { data: createdGuardianship, error: guardianshipInsertError } = await ctx.supabaseAdmin
          .from("guardianships")
          .insert({ guardian_profile_id: profileId, student_id: guardian.studentId, relationship: guardian.relationship, is_primary: false, active: true })
          .select("id").single();
        if (guardianshipInsertError || !createdGuardianship) throw new Error(guardianshipInsertError?.message ?? "Nao foi possivel criar o vinculo com o aluno.");
        rollback.createdGuardianshipId = createdGuardianship.id;
        guardianshipResult = { id: createdGuardianship.id };
      }

      return Response.json(
        {
          success: true,
          userId: profileId,
          profileId,
          membershipId,
          role: input.role,
          email: input.email,
          ...(studentResult ? { student: studentResult } : {}),
          ...(guardianshipResult ? { guardianship: guardianshipResult } : {}),
          invitationSent,
          reusedExistingUser,
          message: "Convite enviado e vinculo criado com sucesso.",
        },
        { status: 201 },
      );
    } catch (error) {
      console.error("Erro ao convidar usuario escolar:", {
        requestId,
        error,
      });
      try {
        if (rollback.createdStudentId) await ctx.supabaseAdmin.from("students").delete().eq("id", rollback.createdStudentId);
        if (rollback.createdGuardianshipId) await ctx.supabaseAdmin.from("guardianships").delete().eq("id", rollback.createdGuardianshipId);
        if (rollback.createdMembershipId) await ctx.supabaseAdmin.from("memberships").delete().eq("id", rollback.createdMembershipId);

        // Remove only the newly created Auth user, leave pre-existing Auth users untouched!
        if (rollback.createdAuthUserId) {
          await ctx.supabaseAdmin.from("profiles").delete().eq("id", rollback.createdAuthUserId);
          await ctx.supabaseAdmin.auth.admin.deleteUser(rollback.createdAuthUserId);
        }
      } catch (cleanupError) {
        console.error("Erro no cleanup do convite escolar:", {
          requestId,
          error: cleanupError,
        });
      }
      const publicError = toPublicError(error);
      return jsonError({ status: publicError.status, code: publicError.code, message: publicError.message, requestId, fieldErrors: publicError.fieldErrors });
    }
  }),
};
