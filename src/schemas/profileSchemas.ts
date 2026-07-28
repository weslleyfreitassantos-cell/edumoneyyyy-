import { z } from 'zod';

export const PROFILE_NAME_MAX_LENGTH = 120;
export const PROFILE_PASSWORD_MIN_LENGTH = 8;

export const accountSettingsSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(
        PROFILE_NAME_MAX_LENGTH,
        `O nome deve ter no máximo ${PROFILE_NAME_MAX_LENGTH} caracteres.`,
      ),
    newPassword: z.string(),
    passwordConfirmation: z.string(),
  })
  .superRefine((data, context) => {
    if (
      data.newPassword.length > 0 &&
      data.newPassword.length < PROFILE_PASSWORD_MIN_LENGTH
    ) {
      context.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: `A nova senha deve ter pelo menos ${PROFILE_PASSWORD_MIN_LENGTH} caracteres.`,
      });
    }

    if (data.newPassword !== data.passwordConfirmation) {
      context.addIssue({
        code: 'custom',
        path: ['passwordConfirmation'],
        message: 'As senhas não coincidem.',
      });
    }
  });

export type AccountSettingsValues = z.infer<
  typeof accountSettingsSchema
>;
