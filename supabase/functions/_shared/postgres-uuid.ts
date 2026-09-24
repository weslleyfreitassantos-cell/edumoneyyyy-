import { z } from "zod";

const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const postgresUuidSchema = z.string()
  .regex(POSTGRES_UUID_PATTERN, "Conta invalida.")
  .refine((value) => value.length === 36, "Conta invalida.");

export const accountIdRequestSchema = z.object({
  accountId: postgresUuidSchema,
}).strict();
