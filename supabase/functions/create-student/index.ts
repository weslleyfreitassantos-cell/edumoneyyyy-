import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

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
      "CPF deve conter 11 dígitos",
    )
    .optional(),
);

const requestSchema = z
  .object({
    institution_id: z
      .string()
      .uuid("Instituição inválida"),

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

    birth_date: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Data de nascimento inválida",
      ),

    cpf: optionalCpfSchema,
  })
  .strict();

function getErrorMessage(error: unknown): string {
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

  return "Não foi possível cadastrar o aluno.";
}

function getErrorStatus(message: string): number {
  const normalizedMessage =
    message.toLowerCase();

  if (
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("registered") ||
    normalizedMessage.includes("exists") ||
    normalizedMessage.includes("duplicate")
  ) {
    return 409;
  }

  return 500;
}

export default {
  fetch: withSupabase(
    { auth: "user" },
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
                ?.message ?? "Dados inválidos.",
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

      const {
        data: requesterMembership,
        error: membershipError,
      } = await ctx.supabaseAdmin
        .from("memberships")
        .select("id")
        .eq("profile_id", user.id)
        .eq(
          "institution_id",
          input.institution_id,
        )
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
              "Você não possui permissão para cadastrar alunos nesta instituição.",
          },
          {
            status: 403,
          },
        );
      }

      let createdUserId: string | null =
        null;

      try {
        const {
          data: invitationData,
          error: invitationError,
        } =
          await ctx.supabaseAdmin.auth.admin
            .inviteUserByEmail(input.email, {
              data: {
                full_name: input.full_name,
                role: "STUDENT",
              },
            });

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

        const { error: profileError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .upsert(
              {
                id: createdUserId,
                full_name: input.full_name,
                email: input.email,
                role: "STUDENT",
                avatar_url: null,
                active: true,
              },
              {
                onConflict: "id",
              },
            );

        if (profileError) {
          throw profileError;
        }

        const {
          error: membershipInsertError,
        } = await ctx.supabaseAdmin
          .from("memberships")
          .insert({
            profile_id: createdUserId,
            institution_id:
              input.institution_id,
            role: "STUDENT",
            active: true,
          });

        if (membershipInsertError) {
          throw membershipInsertError;
        }

        const {
          data: createdStudent,
          error: studentError,
        } = await ctx.supabaseAdmin
          .from("students")
          .insert({
            profile_id: createdUserId,
            institution_id:
              input.institution_id,
            birth_date: input.birth_date,
            cpf: input.cpf ?? null,
            active: true,
          })
          .select(
            "id, registration_number",
          )
          .single();

        if (
          studentError ||
          !createdStudent
        ) {
          throw new Error(
            studentError?.message ??
              "Não foi possível criar o registro acadêmico.",
          );
        }

        return Response.json(
          {
            student: {
              id: createdStudent.id,
              profile_id: createdUserId,
              registration_number:
                createdStudent.registration_number,
              full_name: input.full_name,
              email: input.email,
            },
            invitation_sent: true,
          },
          {
            status: 201,
          },
        );
      } catch (error) {
        console.error(
          "Erro ao cadastrar aluno:",
          error,
        );

        if (createdUserId) {
          await ctx.supabaseAdmin
            .from("students")
            .delete()
            .eq("profile_id", createdUserId)
            .eq(
              "institution_id",
              input.institution_id,
            );

          await ctx.supabaseAdmin
            .from("memberships")
            .delete()
            .eq("profile_id", createdUserId)
            .eq(
              "institution_id",
              input.institution_id,
            );

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