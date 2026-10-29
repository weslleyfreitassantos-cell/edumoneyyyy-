import type { PsychologyAuthorizationTarget } from '../../services/psychologyService';

export function getStudentBookingTarget(
  targets: PsychologyAuthorizationTarget[],
): PsychologyAuthorizationTarget | undefined {
  return targets.find((target) => target.authorization_status === 'ACTIVE')
    ?? targets.find((target) => !target.is_minor)
    ?? targets[0];
}

export function bookingAuthorizationMessage(
  error: unknown,
  fallback: (error: unknown) => string,
): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
  if (code === 'NOT_AUTHORIZED') {
    return 'Sua autorização está ativa, mas a escola precisa vincular uma profissional habilitada ao seu cadastro para liberar a agenda. Peça à direção ou à secretaria para fazer esse vínculo em Psicologia.';
  }
  return fallback(error);
}
