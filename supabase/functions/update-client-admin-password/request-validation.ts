import { z } from "zod";

import { accountIdRequestSchema } from "../_shared/postgres-uuid.ts";

const passwordUpdateRequestSchema = accountIdRequestSchema.extend({
  password: z.string().min(
    8,
    "A senha deve possuir pelo menos 8 caracteres.",
  ).max(72, "A senha deve possuir no maximo 72 caracteres."),
}).strict();

export type PasswordUpdateRequest = z.infer<
  typeof passwordUpdateRequestSchema
>;

export type PasswordUpdateRequestValidation =
  | { success: true; data: PasswordUpdateRequest }
  | {
    success: false;
    code: "INVALID_ACCOUNT_ID" | "INVALID_PASSWORD" | "INVALID_PAYLOAD";
    message: string;
  };

export function parsePasswordUpdateRequest(
  value: unknown,
): PasswordUpdateRequestValidation {
  const result = passwordUpdateRequestSchema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }

  if (result.error.issues.some((issue) => issue.path[0] === "accountId")) {
    return {
      success: false,
      code: "INVALID_ACCOUNT_ID",
      message: "Conta invalida.",
    };
  }

  if (result.error.issues.some((issue) => issue.path[0] === "password")) {
    return {
      success: false,
      code: "INVALID_PASSWORD",
      message: "Informe uma senha entre 8 e 72 caracteres.",
    };
  }

  return {
    success: false,
    code: "INVALID_PAYLOAD",
    message: "Dados informados invalidos.",
  };
}
