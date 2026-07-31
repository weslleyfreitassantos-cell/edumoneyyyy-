import { z } from 'zod';

export const authEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Informe um e-mail valido.');

export const authPasswordSchema = z
  .string()
  .min(8, 'A senha deve possuir pelo menos 8 caracteres.');

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  const passwordValidation =
    authPasswordSchema.safeParse(password);

  if (!passwordValidation.success) {
    return (
      passwordValidation.error.issues[0]?.message ??
      'Senha invalida.'
    );
  }

  if (password !== confirmation) {
    return 'As senhas informadas nao sao iguais.';
  }

  return null;
}
