import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type {
  Database,
} from "../_shared/database.types.ts";

const guardianLinkSchema = z
  .object({
    student_id: z.guid("Aluno inválido"),
    relationship: z
      .string()
      .trim()
      .min(2, "Parentesco é obrigatório")
      .max(40, "Parentesco muito longo"),
    is_primary: z.boolean().default(false),
  })
  .strict();

const requestSchema = z
  .object({
    institution_id: z.guid(
      "Instituição inválida",
    ),
    full_name: z
      .string()
      .trim()
      .min(3, "Nome é obrigatório")
      .max(120, "Nome muito longo"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("E-mail inválido"),
    student_links: z
      .array(guardianLinkSchema)
      .min(1, "Selecione pelo menos um aluno"),
  })
  .strict()
  .superRefine((value, context) => {
    const studentIds = new Set<string>();

    value.student_links.forEach(
      (link, index) => {
        if (studentIds.has(link.student_id)) {
          context.addIssue({
            code: "custom",
            path: [
              "student_links",
              index,
              "student_id",
            ],
            message:
              "O mesmo aluno não pode ser vinculado duas vezes.",
          });
        }

        studentIds.add(link.student_id);
      },
    );
  });

type RequestData = z.infer<
  typeof requestSchema
>;

interface ExistingProfile {
  id: string;
  role: Database["public"]["Enums"]["user_role"];
  full_name: string;
  active: boolean | null;
}

interface ExistingMembership {
  id: string;
  active: boolean | null;
}

interface ExistingGuardianship {
  id: string;
  student_id: string;
  relationship: string;
  is_primary: boolean | null;
  active: boolean | null;
}

function getErrorMessage(
  error: unknown,
): string {
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

  return "Não foi possível cadastrar o responsável.";
}

function getErrorStatus(
  message: string,
): number {
  const normalizedMessage =
    message.toLowerCase();

  if (
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("registered") ||
    normalizedMessage.includes("exists") ||
    normalizedMessage.includes("duplicate") ||
    normalizedMessage.includes("já existe") ||
    normalizedMessage.includes("já cadastrado") ||
    normalizedMessage.includes("já possui")
  ) {
    return 409;
  }

  return 500;
}

async function validateRequester(
  ctx: Parameters<
    Parameters<
      typeof withSupabase<Database>
    >[1]
  >[1],
  userId: string,
  institutionId: string,
): Promise<Response | null> {
  const {
    data: requesterMembership,
    error: membershipError,
  } = await ctx.supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("profile_id", userId)
    .eq("institution_id", institutionId)
    .eq("active", true)
    .in("role", ["ADMIN", "DIRECTOR"])
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error(
      "Erro ao verificar permissão:",
      membershipError,
    );

    return Response.json(
      {
        error:
          "Não foi possível verificar sua permissão.",
      },
      {
        status: 500,
      },
    );
  }

  if (!requesterMembership) {
    return Response.json(
      {
        error:
          "Você não possui permissão para cadastrar responsáveis nesta instituição.",
      },
      {
        status: 403,
      },
    );
  }

  return null;
}

async function validateStudents(
  ctx: Parameters<
    Parameters<
      typeof withSupabase<Database>
    >[1]
  >[1],
  input: RequestData,
): Promise<Response | null> {
  const studentIds = input.student_links.map(
    (link) => link.student_id,
  );

  const { data, error } = await ctx.supabaseAdmin
    .from("students")
    .select("id")
    .eq(
      "institution_id",
      input.institution_id,
    )
    .in("id", studentIds);

  if (error) {
    console.error(
      "Erro ao validar alunos:",
      error,
    );

    return Response.json(
      {
        error:
          "Não foi possível validar os alunos vinculados.",
      },
      {
        status: 500,
      },
    );
  }

  if ((data ?? []).length !== studentIds.length) {
    return Response.json(
      {
        error:
          "Todos os alunos vinculados precisam pertencer à instituição selecionada.",
      },
      {
        status: 403,
      },
    );
  }

  return null;
}

export default {
  fetch: withSupabase<Database>(
    {
      auth: "user",
    },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return Response.json(
          {
            error: "Método não permitido.",
          },
          {
            status: 405,
            headers: {
              Allow: "POST",
            },
          },
        );
      }

      let requestBody: unknown;

      try {
        requestBody = await request.json();
      } catch {
        return Response.json(
          {
            error:
              "Corpo da requisição inválido.",
          },
          {
            status: 400,
          },
        );
      }

      const validation =
        requestSchema.safeParse(requestBody);

      if (!validation.success) {
        return Response.json(
          {
            error:
              validation.error.issues[0]
                ?.message ??
              "Dados inválidos.",
          },
          {
            status: 400,
          },
        );
      }

      const input = validation.data;

      const {
        data: { user },
        error: userError,
      } = await ctx.supabase.auth.getUser();

      if (userError || !user) {
        return Response.json(
          {
            error:
              "Sessão inválida ou expirada.",
          },
          {
            status: 401,
          },
        );
      }

      const requesterError =
        await validateRequester(
          ctx,
          user.id,
          input.institution_id,
        );

      if (requesterError) {
        return requesterError;
      }

      const studentError =
        await validateStudents(ctx, input);

      if (studentError) {
        return studentError;
      }

      const createdGuardianshipIds: string[] = [];
      const clearedPrimaryGuardianshipIds: string[] = [];
      const reactivatedGuardianships:
        ExistingGuardianship[] = [];
      let createdUserId: string | null = null;
      let createdMembershipId: string | null =
        null;
      let reactivatedMembership:
        ExistingMembership
        | null = null;
      let updatedExistingProfile:
        | {
            id: string;
            full_name: string;
            active: boolean | null;
          }
        | null = null;

      try {
        const {
          data: existingProfile,
          error: profileLookupError,
        } = await ctx.supabaseAdmin
          .from("profiles")
          .select("id, role, full_name, active")
          .eq("email", input.email)
          .maybeSingle();

        if (profileLookupError) {
          throw profileLookupError;
        }

        let guardianProfileId: string;
        let invitationSent = false;

        if (existingProfile) {
          const profile =
            existingProfile as ExistingProfile;

          if (profile.role !== "GUARDIAN") {
            return Response.json(
              {
                error:
                  "Já existe usuário com este e-mail em outro papel.",
              },
              {
                status: 409,
              },
            );
          }

          guardianProfileId = profile.id;
          updatedExistingProfile = {
            id: profile.id,
            full_name: profile.full_name,
            active: profile.active,
          };

          const { error: updateProfileError } =
            await ctx.supabaseAdmin
              .from("profiles")
              .update({
                full_name: input.full_name,
                active: true,
              })
              .eq("id", guardianProfileId);

          if (updateProfileError) {
            throw updateProfileError;
          }
        } else {
          const appUrl = Deno.env
            .get("APP_URL")
            ?.replace(/\/+$/, "");

          const invitationOptions = {
            data: {
              full_name: input.full_name,
              role: "GUARDIAN",
            },
            ...(appUrl
              ? {
                  redirectTo:
                    `${appUrl}/set-password`,
                }
              : {}),
          };

          const {
            data: invitationData,
            error: invitationError,
          } =
            await ctx.supabaseAdmin.auth.admin
              .inviteUserByEmail(
                input.email,
                invitationOptions,
              );

          if (
            invitationError ||
            !invitationData.user
          ) {
            throw new Error(
              invitationError?.message ??
                "Não foi possível criar o usuário.",
            );
          }

          createdUserId =
            invitationData.user.id;
          guardianProfileId = createdUserId;
          invitationSent = true;

          const { error: profileInsertError } =
            await ctx.supabaseAdmin
              .from("profiles")
              .upsert(
                {
                  id: guardianProfileId,
                  full_name: input.full_name,
                  email: input.email,
                  role: "GUARDIAN",
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

        const {
          data: existingMembership,
          error: membershipLookupError,
        } = await ctx.supabaseAdmin
          .from("memberships")
          .select("id, active")
          .eq("profile_id", guardianProfileId)
          .eq(
            "institution_id",
            input.institution_id,
          )
          .eq("role", "GUARDIAN")
          .limit(1)
          .maybeSingle();

        if (membershipLookupError) {
          throw membershipLookupError;
        }

        if (existingMembership) {
          const membership =
            existingMembership as ExistingMembership;

          if (membership.active === false) {
            reactivatedMembership = membership;

            const {
              error: membershipUpdateError,
            } = await ctx.supabaseAdmin
              .from("memberships")
              .update({ active: true })
              .eq("id", membership.id);

            if (membershipUpdateError) {
              throw membershipUpdateError;
            }
          }
        } else {
          const {
            data: createdMembership,
            error: membershipInsertError,
          } = await ctx.supabaseAdmin
            .from("memberships")
            .insert({
              profile_id: guardianProfileId,
              institution_id:
                input.institution_id,
              role: "GUARDIAN",
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
                "Não foi possível criar o vínculo institucional do responsável.",
            );
          }

          createdMembershipId =
            createdMembership.id;
        }

        const studentIds = input.student_links.map(
          (link) => link.student_id,
        );

        const {
          data: existingGuardianships,
          error: guardianshipLookupError,
        } = await ctx.supabaseAdmin
          .from("guardianships")
          .select(
            "id, student_id, relationship, is_primary, active",
          )
          .eq(
            "guardian_profile_id",
            guardianProfileId,
          )
          .in("student_id", studentIds);

        if (guardianshipLookupError) {
          throw guardianshipLookupError;
        }

        const existingByStudent = new Map<
          string,
          ExistingGuardianship
        >();

        for (const guardianship of (existingGuardianships ??
          []) as ExistingGuardianship[]) {
          existingByStudent.set(
            guardianship.student_id,
            guardianship,
          );

          if (guardianship.active !== false) {
            throw new Error(
              "Este responsável já possui vínculo ativo com um dos alunos selecionados.",
            );
          }
        }

        for (const link of input.student_links) {
          if (link.is_primary) {
            const {
              data: currentPrimaryRows,
              error: primaryLookupError,
            } = await ctx.supabaseAdmin
              .from("guardianships")
              .select("id")
              .eq("student_id", link.student_id)
              .eq("active", true)
              .eq("is_primary", true)
              .neq(
                "guardian_profile_id",
                guardianProfileId,
              );

            if (primaryLookupError) {
              throw primaryLookupError;
            }

            const primaryIds = (
              currentPrimaryRows ?? []
            ).map((row) => row.id);

            if (primaryIds.length > 0) {
              const { error: clearPrimaryError } =
                await ctx.supabaseAdmin
                  .from("guardianships")
                  .update({ is_primary: false })
                  .in("id", primaryIds);

              if (clearPrimaryError) {
                throw clearPrimaryError;
              }

              clearedPrimaryGuardianshipIds.push(
                ...primaryIds,
              );
            }
          }

          const inactiveGuardianship =
            existingByStudent.get(
              link.student_id,
            );

          if (inactiveGuardianship) {
            reactivatedGuardianships.push(
              inactiveGuardianship,
            );

            const { error: reactivateError } =
              await ctx.supabaseAdmin
                .from("guardianships")
                .update({
                  relationship:
                    link.relationship,
                  is_primary: link.is_primary,
                  active: true,
                })
                .eq(
                  "id",
                  inactiveGuardianship.id,
                );

            if (reactivateError) {
              throw reactivateError;
            }

            continue;
          }

          const {
            data: createdGuardianship,
            error: guardianshipInsertError,
          } = await ctx.supabaseAdmin
            .from("guardianships")
            .insert({
              guardian_profile_id:
                guardianProfileId,
              student_id: link.student_id,
              relationship:
                link.relationship,
              is_primary: link.is_primary,
              active: true,
            })
            .select("id")
            .single();

          if (
            guardianshipInsertError ||
            !createdGuardianship
          ) {
            throw new Error(
              guardianshipInsertError?.message ??
                "Não foi possível criar o vínculo com o aluno.",
            );
          }

          createdGuardianshipIds.push(
            createdGuardianship.id,
          );
        }

        return Response.json(
          {
            guardian: {
              profile_id: guardianProfileId,
              full_name: input.full_name,
              email: input.email,
            },
            guardianships_created:
              createdGuardianshipIds.length,
            invitation_sent: invitationSent,
          },
          {
            status: 201,
          },
        );
      } catch (error) {
        console.error(
          "Erro ao cadastrar responsável:",
          error,
        );

        if (createdGuardianshipIds.length > 0) {
          await ctx.supabaseAdmin
            .from("guardianships")
            .delete()
            .in("id", createdGuardianshipIds);
        }

        for (const guardianship of reactivatedGuardianships) {
          await ctx.supabaseAdmin
            .from("guardianships")
            .update({
              relationship:
                guardianship.relationship,
              is_primary:
                guardianship.is_primary,
              active: guardianship.active,
            })
            .eq("id", guardianship.id);
        }

        if (clearedPrimaryGuardianshipIds.length > 0) {
          await ctx.supabaseAdmin
            .from("guardianships")
            .update({ is_primary: true })
            .in(
              "id",
              clearedPrimaryGuardianshipIds,
            );
        }

        if (createdMembershipId) {
          await ctx.supabaseAdmin
            .from("memberships")
            .delete()
            .eq("id", createdMembershipId);
        }

        if (reactivatedMembership) {
          await ctx.supabaseAdmin
            .from("memberships")
            .update({
              active:
                reactivatedMembership.active,
            })
            .eq(
              "id",
              reactivatedMembership.id,
            );
        }

        if (updatedExistingProfile) {
          await ctx.supabaseAdmin
            .from("profiles")
            .update({
              full_name:
                updatedExistingProfile.full_name,
              active:
                updatedExistingProfile.active,
            })
            .eq("id", updatedExistingProfile.id);
        }

        if (createdUserId) {
          await ctx.supabaseAdmin
            .from("profiles")
            .delete()
            .eq("id", createdUserId);

          await ctx.supabaseAdmin.auth.admin
            .deleteUser(createdUserId);
        }

        const message =
          getErrorMessage(error);

        return Response.json(
          {
            error: message,
          },
          {
            status:
              getErrorStatus(message),
          },
        );
      }
    },
  ),
};
