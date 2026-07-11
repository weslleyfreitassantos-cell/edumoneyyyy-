import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type {
  Database as GeneratedDatabase,
} from "../_shared/database.types.ts";

type GeneratedPublicSchema =
  GeneratedDatabase["public"];

type GeneratedTables =
  GeneratedPublicSchema["Tables"];

type GeneratedStudentTable =
  GeneratedTables["students"];

type Database = Omit<
  GeneratedDatabase,
  "public"
> & {
  public: Omit<
    GeneratedPublicSchema,
    "Tables"
  > & {
    Tables: Omit<
      GeneratedTables,
      "students"
    > & {
      students: Omit<
        GeneratedStudentTable,
        "Insert"
      > & {
        Insert: Omit<
          GeneratedStudentTable["Insert"],
          "registration_number"
        > & {
          registration_number?: string;
        };
      };
    };
  };
};

type UserRole =
  Database["public"]["Enums"]["user_role"];

type TargetRole = Extract<
  UserRole,
  "DIRECTOR" | "TEACHER" | "STUDENT" | "GUARDIAN"
>;

interface ExistingProfile {
  id: string;
  role: UserRole;
  full_name: string;
  active: boolean | null;
}

interface ExistingMembership {
  id: string;
  role: UserRole;
  active: boolean | null;
}

interface ExistingGuardianship {
  id: string;
  relationship: string;
  is_primary: boolean | null;
  active: boolean | null;
}

interface RollbackState {
  createdAuthUserId: string | null;
  createdMembershipId: string | null;
  createdStudentId: string | null;
  createdGuardianshipId: string | null;
  reactivatedMembership:
    | ExistingMembership
    | null;
  reactivatedGuardianship:
    | ExistingGuardianship
    | null;
  updatedExistingProfile:
    | {
        id: string;
        full_name: string;
        active: boolean | null;
      }
    | null;
}

const targetRoleSchema = z.enum([
  "DIRECTOR",
  "TEACHER",
  "STUDENT",
  "GUARDIAN",
]);

const optionalCpfSchema = z.preprocess(
  (value) => {
    if (
      typeof value === "string" &&
      value.trim() === ""
    ) {
      return undefined;
    }

    return value;
  },
  z
    .string()
    .trim()
    .regex(
      /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/,
      "CPF deve conter 11 digitos",
    )
    .optional(),
);

const studentPayloadSchema = z
  .object({
    birthDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Data de nascimento invalida",
      ),
    cpf: optionalCpfSchema,
  })
  .strict();

const guardianPayloadSchema = z
  .object({
    studentId: z.guid("Aluno invalido"),
    relationship: z
      .string()
      .trim()
      .min(2, "Relacionamento obrigatorio")
      .max(40, "Relacionamento muito longo"),
  })
  .strict();

const requestSchema = z
  .object({
    institutionId: z.guid(
      "Instituicao invalida",
    ),
    role: targetRoleSchema,
    fullName: z
      .string()
      .trim()
      .transform((value) =>
        value.replace(/\s+/g, " "),
      )
      .pipe(
        z
          .string()
          .min(3, "Nome obrigatorio")
          .max(120, "Nome muito longo"),
      ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("E-mail invalido"),
    student: studentPayloadSchema.optional(),
    guardian: guardianPayloadSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.role === "STUDENT" &&
      !value.student
    ) {
      context.addIssue({
        code: "custom",
        path: ["student", "birthDate"],
        message:
          "Aluno exige data de nascimento",
      });
    }

    if (
      value.role === "GUARDIAN" &&
      !value.guardian
    ) {
      context.addIssue({
        code: "custom",
        path: ["guardian", "studentId"],
        message:
          "Responsavel exige aluno vinculado",
      });
    }

    if (
      value.role !== "STUDENT" &&
      value.student
    ) {
      context.addIssue({
        code: "custom",
        path: ["student"],
        message:
          "Dados de aluno aceitos somente para STUDENT",
      });
    }

    if (
      value.role !== "GUARDIAN" &&
      value.guardian
    ) {
      context.addIssue({
        code: "custom",
        path: ["guardian"],
        message:
          "Dados de responsavel aceitos somente para GUARDIAN",
      });
    }
  });

type RequestData = z.infer<
  typeof requestSchema
>;

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
  fieldErrors,
}: {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}): Response {
  return Response.json(
    {
      success: false,
      code,
      message,
      ...(fieldErrors
        ? { fieldErrors }
        : {}),
    },
    {
      status,
    },
  );
}

function toFieldName(
  issuePath: PropertyKey[],
): string {
  const path = issuePath.join(".");

  if (path === "institutionId") {
    return "institutionId";
  }

  if (path === "fullName") {
    return "fullName";
  }

  if (path === "email") {
    return "email";
  }

  if (path === "role") {
    return "target";
  }

  if (path.startsWith("student.birthDate")) {
    return "birthDate";
  }

  if (path.startsWith("student.cpf")) {
    return "cpf";
  }

  if (path.startsWith("guardian.studentId")) {
    return "guardianStudentId";
  }

  if (path.startsWith("guardian.relationship")) {
    return "relationship";
  }

  return path || "form";
}

function getFieldErrors(
  error: z.ZodError,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const fieldName = toFieldName(
      issue.path,
    );

    fieldErrors[fieldName] ??=
      issue.message;
  }

  return fieldErrors;
}

function getAppUrl(): string {
  const appUrl = Deno.env
    .get("APP_URL")
    ?.replace(/\/+$/, "");

  if (!appUrl) {
    throw new InviteError({
      status: 500,
      code: "MISSING_APP_URL",
      message:
        "A URL da aplicacao nao foi configurada.",
    });
  }

  return appUrl;
}

function isDuplicateAuthError(
  message: string | undefined,
): boolean {
  const normalized =
    message?.toLowerCase() ?? "";

  return (
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("exists") ||
    normalized.includes("duplicate")
  );
}

function toPublicError(
  error: unknown,
): InviteError {
  if (error instanceof InviteError) {
    return error;
  }

  return new InviteError({
    status: 500,
    code: "INTERNAL_ERROR",
    message:
      "Nao foi possivel concluir o convite.",
  });
}

export default {
  fetch: withSupabase<Database>(
    {
      auth: "user",
    },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return jsonError({
          status: 405,
          code: "METHOD_NOT_ALLOWED",
          message: "Metodo nao permitido.",
        });
      }

      let requestBody: unknown;

      try {
        requestBody = await request.json();
      } catch {
        return jsonError({
          status: 400,
          code: "INVALID_JSON",
          message:
            "Corpo da requisicao invalido.",
        });
      }

      const validation =
        requestSchema.safeParse(requestBody);

      if (!validation.success) {
        return jsonError({
          status: 400,
          code: "INVALID_PAYLOAD",
          message:
            validation.error.issues[0]
              ?.message ?? "Dados invalidos.",
          fieldErrors: getFieldErrors(
            validation.error,
          ),
        });
      }

      const input = validation.data;
      const rollback: RollbackState = {
        createdAuthUserId: null,
        createdMembershipId: null,
        createdStudentId: null,
        createdGuardianshipId: null,
        reactivatedMembership: null,
        reactivatedGuardianship: null,
        updatedExistingProfile: null,
      };

      try {
        const {
          data: { user },
          error: userError,
        } =
          await ctx.supabase.auth.getUser();

        if (userError || !user) {
          throw new InviteError({
            status: 401,
            code: "UNAUTHENTICATED",
            message:
              "Sessao invalida ou expirada.",
          });
        }

        const {
          data: institution,
          error: institutionError,
        } = await ctx.supabaseAdmin
          .from("institutions")
          .select("id, active")
          .eq("id", input.institutionId)
          .maybeSingle();

        if (institutionError) {
          throw institutionError;
        }

        if (
          !institution ||
          institution.active !== true
        ) {
          throw new InviteError({
            status: 404,
            code: "INSTITUTION_NOT_FOUND",
            message:
              "Instituicao ativa nao encontrada.",
            fieldErrors: {
              institutionId:
                "Selecione uma instituicao ativa.",
            },
          });
        }

        const {
          data: requesterMembershipRows,
          error: requesterMembershipError,
        } = await ctx.supabaseAdmin
          .from("memberships")
          .select("id, role, active")
          .eq("profile_id", user.id)
          .eq(
            "institution_id",
            input.institutionId,
          );

        if (requesterMembershipError) {
          throw requesterMembershipError;
        }

        const activeRequesterMembership = (
          requesterMembershipRows ?? []
        ).find(
          (membership) =>
            membership.active === true &&
            (membership.role === "ADMIN" ||
              membership.role ===
                "DIRECTOR"),
        );

        if (!activeRequesterMembership) {
          throw new InviteError({
            status: 403,
            code: "INSUFFICIENT_PERMISSION",
            message:
              "Voce precisa de membership ADMIN ou DIRECTOR ativa nesta escola.",
          });
        }

        if (
          input.role === "DIRECTOR" &&
          activeRequesterMembership.role !==
            "ADMIN"
        ) {
          throw new InviteError({
            status: 403,
            code: "DIRECTOR_INVITE_REQUIRES_ADMIN",
            message:
              "Somente ADMIN ativo pode convidar outro diretor.",
            fieldErrors: {
              target:
                "Somente ADMIN ativo pode convidar diretor.",
            },
          });
        }

        const {
          data: existingProfileData,
          error: profileLookupError,
        } = await ctx.supabaseAdmin
          .from("profiles")
          .select(
            "id, role, full_name, active",
          )
          .eq("email", input.email)
          .maybeSingle();

        if (profileLookupError) {
          throw profileLookupError;
        }

        const existingProfile =
          existingProfileData as
            | ExistingProfile
            | null;

        if (
          existingProfile &&
          existingProfile.role !== input.role
        ) {
          throw new InviteError({
            status: 409,
            code: "PROFILE_ROLE_CONFLICT",
            message:
              "Ja existe usuario com este e-mail em outro papel.",
            fieldErrors: {
              email:
                "E-mail vinculado a outro papel.",
            },
          });
        }

        let profileId: string;
        let invitationSent = false;
        const reusedExistingUser =
          Boolean(existingProfile);

        if (existingProfile) {
          profileId = existingProfile.id;
        } else {
          const appUrl = getAppUrl();
          const {
            data: invitationData,
            error: invitationError,
          } =
            await ctx.supabaseAdmin.auth.admin
              .inviteUserByEmail(
                input.email,
                {
                  data: {
                    full_name:
                      input.fullName,
                    role: input.role,
                  },
                  redirectTo:
                    `${appUrl}/set-password`,
                },
              );

          if (
            invitationError ||
            !invitationData.user
          ) {
            if (
              isDuplicateAuthError(
                invitationError?.message,
              )
            ) {
              throw new InviteError({
                status: 409,
                code: "AUTH_USER_ALREADY_EXISTS",
                message:
                  "Ja existe usuario Auth com este e-mail, mas sem profile reutilizavel.",
                fieldErrors: {
                  email:
                    "E-mail ja existe no Auth.",
                },
              });
            }

            throw new Error(
              invitationError?.message ??
                "Nao foi possivel criar o usuario.",
            );
          }

          profileId = invitationData.user.id;
          rollback.createdAuthUserId =
            profileId;
          invitationSent = true;
        }

        const {
          data: membershipRows,
          error: membershipLookupError,
        } = await ctx.supabaseAdmin
          .from("memberships")
          .select("id, role, active")
          .eq("profile_id", profileId)
          .eq(
            "institution_id",
            input.institutionId,
          );

        if (membershipLookupError) {
          throw membershipLookupError;
        }

        const memberships = (
          membershipRows ?? []
        ) as ExistingMembership[];

        const conflictingMembership =
          memberships.find(
            (membership) =>
              membership.role !== input.role,
          );

        if (conflictingMembership) {
          throw new InviteError({
            status: 409,
            code: "MEMBERSHIP_ROLE_CONFLICT",
            message:
              "Este e-mail ja esta vinculado a esta escola com outro papel.",
            fieldErrors: {
              email:
                "E-mail vinculado com role conflitante.",
            },
          });
        }

        const activeDuplicateMembership =
          memberships.find(
            (membership) =>
              membership.role === input.role &&
              membership.active === true,
          );

        if (activeDuplicateMembership) {
          throw new InviteError({
            status: 409,
            code: "MEMBERSHIP_ALREADY_ACTIVE",
            message:
              "Este e-mail ja possui vinculo ativo equivalente nesta escola.",
            fieldErrors: {
              email:
                "E-mail ja vinculado a instituicao.",
            },
          });
        }

        const inactiveMemberships =
          memberships.filter(
            (membership) =>
              membership.role === input.role &&
              membership.active === false,
          );

        if (inactiveMemberships.length > 1) {
          throw new InviteError({
            status: 409,
            code: "DUPLICATE_INACTIVE_MEMBERSHIP",
            message:
              "Ha mais de um vinculo inativo para este e-mail nesta escola.",
          });
        }

        if (existingProfile) {
          rollback.updatedExistingProfile = {
            id: existingProfile.id,
            full_name:
              existingProfile.full_name,
            active: existingProfile.active,
          };

          const { error: updateProfileError } =
            await ctx.supabaseAdmin
              .from("profiles")
              .update({
                full_name: input.fullName,
                active: true,
              })
              .eq("id", profileId);

          if (updateProfileError) {
            throw updateProfileError;
          }
        } else {
          const { error: profileInsertError } =
            await ctx.supabaseAdmin
              .from("profiles")
              .upsert(
                {
                  id: profileId,
                  full_name:
                    input.fullName,
                  email: input.email,
                  role: input.role,
                  avatar_url: null,
                  active: true,
                },
                {
                  onConflict: "id",
                },
              );

          if (profileInsertError) {
            throw profileInsertError;
          }
        }

        let membershipId: string;

        if (inactiveMemberships[0]) {
          rollback.reactivatedMembership =
            inactiveMemberships[0];
          membershipId =
            inactiveMemberships[0].id;

          const {
            error: membershipUpdateError,
          } = await ctx.supabaseAdmin
            .from("memberships")
            .update({ active: true })
            .eq("id", membershipId);

          if (membershipUpdateError) {
            throw membershipUpdateError;
          }
        } else {
          const {
            data: createdMembership,
            error: membershipInsertError,
          } = await ctx.supabaseAdmin
            .from("memberships")
            .insert({
              profile_id: profileId,
              institution_id:
                input.institutionId,
              role: input.role,
              active: true,
            })
            .select("id")
            .single();

          if (
            membershipInsertError ||
            !createdMembership
          ) {
            throw new Error(
              membershipInsertError?.message ??
                "Nao foi possivel criar o vinculo.",
            );
          }

          membershipId = createdMembership.id;
          rollback.createdMembershipId =
            membershipId;
        }

        if (input.role === "STUDENT") {
          const {
            data: existingStudentRows,
            error: studentLookupError,
          } = await ctx.supabaseAdmin
            .from("students")
            .select("id")
            .eq("profile_id", profileId)
            .eq(
              "institution_id",
              input.institutionId,
            );

          if (studentLookupError) {
            throw studentLookupError;
          }

          if (
            (existingStudentRows ?? [])
              .length > 0
          ) {
            throw new InviteError({
              status: 409,
              code: "STUDENT_ALREADY_EXISTS",
              message:
                "Este estudante ja esta cadastrado nesta escola.",
              fieldErrors: {
                email:
                  "Estudante ja cadastrado.",
              },
            });
          }

          if (input.student?.cpf) {
            const {
              data: existingCpfStudent,
              error: cpfLookupError,
            } = await ctx.supabaseAdmin
              .from("students")
              .select("id")
              .eq("cpf", input.student.cpf)
              .maybeSingle();

            if (cpfLookupError) {
              throw cpfLookupError;
            }

            if (existingCpfStudent) {
              throw new InviteError({
                status: 409,
                code: "STUDENT_CPF_ALREADY_EXISTS",
                message:
                  "Ja existe estudante com este CPF.",
                fieldErrors: {
                  cpf:
                    "CPF ja cadastrado.",
                },
              });
            }
          }

          const {
            data: createdStudent,
            error: studentInsertError,
          } = await ctx.supabaseAdmin
            .from("students")
            .insert({
              profile_id: profileId,
              institution_id:
                input.institutionId,
              birth_date:
                input.student!.birthDate,
              cpf: input.student?.cpf ?? null,
              active: true,
            })
            .select("id, registration_number")
            .single();

          if (
            studentInsertError ||
            !createdStudent
          ) {
            throw new Error(
              studentInsertError?.message ??
                "Nao foi possivel criar o registro de aluno.",
            );
          }

          rollback.createdStudentId =
            createdStudent.id;
        }

        if (input.role === "GUARDIAN") {
          const guardian = input.guardian!;
          const {
            data: linkedStudent,
            error: linkedStudentError,
          } = await ctx.supabaseAdmin
            .from("students")
            .select("id, institution_id")
            .eq("id", guardian.studentId)
            .maybeSingle();

          if (linkedStudentError) {
            throw linkedStudentError;
          }

          if (!linkedStudent) {
            throw new InviteError({
              status: 404,
              code: "STUDENT_NOT_FOUND",
              message:
                "Aluno vinculado nao encontrado.",
              fieldErrors: {
                guardianStudentId:
                  "Aluno nao encontrado.",
              },
            });
          }

          if (
            linkedStudent.institution_id !==
            input.institutionId
          ) {
            throw new InviteError({
              status: 404,
              code: "STUDENT_OUTSIDE_INSTITUTION",
              message:
                "Aluno vinculado pertence a outra instituicao.",
              fieldErrors: {
                guardianStudentId:
                  "Aluno nao pertence a escola ativa.",
              },
            });
          }

          const {
            data: existingGuardianshipRows,
            error: guardianshipLookupError,
          } = await ctx.supabaseAdmin
            .from("guardianships")
            .select(
              "id, relationship, is_primary, active",
            )
            .eq(
              "guardian_profile_id",
              profileId,
            )
            .eq("student_id", guardian.studentId);

          if (guardianshipLookupError) {
            throw guardianshipLookupError;
          }

          const guardianships = (
            existingGuardianshipRows ?? []
          ) as ExistingGuardianship[];

          const activeGuardianship =
            guardianships.find(
              (guardianship) =>
                guardianship.active === true,
            );

          if (activeGuardianship) {
            throw new InviteError({
              status: 409,
              code: "GUARDIANSHIP_ALREADY_EXISTS",
              message:
                "Este responsavel ja possui vinculo ativo com o aluno selecionado.",
              fieldErrors: {
                guardianStudentId:
                  "Vinculo com aluno ja existe.",
              },
            });
          }

          const inactiveGuardianships =
            guardianships.filter(
              (guardianship) =>
                guardianship.active === false,
            );

          if (
            inactiveGuardianships.length > 1
          ) {
            throw new InviteError({
              status: 409,
              code: "DUPLICATE_INACTIVE_GUARDIANSHIP",
              message:
                "Ha mais de um vinculo inativo entre este responsavel e aluno.",
            });
          }

          if (inactiveGuardianships[0]) {
            rollback.reactivatedGuardianship =
              inactiveGuardianships[0];

            const {
              error: guardianshipUpdateError,
            } = await ctx.supabaseAdmin
              .from("guardianships")
              .update({
                relationship:
                  guardian.relationship,
                is_primary: false,
                active: true,
              })
              .eq(
                "id",
                inactiveGuardianships[0].id,
              );

            if (guardianshipUpdateError) {
              throw guardianshipUpdateError;
            }
          } else {
            const {
              data: createdGuardianship,
              error:
                guardianshipInsertError,
            } = await ctx.supabaseAdmin
              .from("guardianships")
              .insert({
                guardian_profile_id:
                  profileId,
                student_id:
                  guardian.studentId,
                relationship:
                  guardian.relationship,
                is_primary: false,
                active: true,
              })
              .select("id")
              .single();

            if (
              guardianshipInsertError ||
              !createdGuardianship
            ) {
              throw new Error(
                guardianshipInsertError
                  ?.message ??
                  "Nao foi possivel criar o vinculo com o aluno.",
              );
            }

            rollback.createdGuardianshipId =
              createdGuardianship.id;
          }
        }

        return Response.json(
          {
            success: true,
            userId: profileId,
            profileId,
            membershipId,
            role: input.role,
            email: input.email,
            invitationSent,
            reusedExistingUser,
            message: invitationSent
              ? "Convite enviado e vinculo criado com sucesso."
              : "Usuario existente vinculado com sucesso.",
          },
          {
            status: 201,
          },
        );
      } catch (error) {
        console.error(
          "Erro ao convidar usuario escolar:",
          error,
        );

        try {
          if (rollback.createdStudentId) {
            await ctx.supabaseAdmin
              .from("students")
              .delete()
              .eq("id", rollback.createdStudentId);
          }

          if (rollback.createdGuardianshipId) {
            await ctx.supabaseAdmin
              .from("guardianships")
              .delete()
              .eq(
                "id",
                rollback.createdGuardianshipId,
              );
          }

          if (rollback.reactivatedGuardianship) {
            await ctx.supabaseAdmin
              .from("guardianships")
              .update({
                relationship:
                  rollback.reactivatedGuardianship
                    .relationship,
                is_primary:
                  rollback.reactivatedGuardianship
                    .is_primary,
                active:
                  rollback.reactivatedGuardianship
                    .active,
              })
              .eq(
                "id",
                rollback.reactivatedGuardianship
                  .id,
              );
          }

          if (rollback.createdMembershipId) {
            await ctx.supabaseAdmin
              .from("memberships")
              .delete()
              .eq(
                "id",
                rollback.createdMembershipId,
              );
          }

          if (rollback.reactivatedMembership) {
            await ctx.supabaseAdmin
              .from("memberships")
              .update({
                active:
                  rollback.reactivatedMembership
                    .active,
              })
              .eq(
                "id",
                rollback.reactivatedMembership
                  .id,
              );
          }

          if (rollback.updatedExistingProfile) {
            await ctx.supabaseAdmin
              .from("profiles")
              .update({
                full_name:
                  rollback.updatedExistingProfile
                    .full_name,
                active:
                  rollback.updatedExistingProfile
                    .active,
              })
              .eq(
                "id",
                rollback.updatedExistingProfile
                  .id,
              );
          }

          if (rollback.createdAuthUserId) {
            await ctx.supabaseAdmin
              .from("profiles")
              .delete()
              .eq(
                "id",
                rollback.createdAuthUserId,
              );

            await ctx.supabaseAdmin.auth.admin
              .deleteUser(
                rollback.createdAuthUserId,
              );
          }
        } catch (cleanupError) {
          console.error(
            "Erro no cleanup do convite escolar:",
            cleanupError,
          );
        }

        const publicError =
          toPublicError(error);

        return jsonError({
          status: publicError.status,
          code: publicError.code,
          message: publicError.message,
          fieldErrors:
            publicError.fieldErrors,
        });
      }
    },
  ),
};
