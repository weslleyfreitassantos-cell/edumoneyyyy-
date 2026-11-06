export type ReenrollmentAcademicDecision =
  | 'PENDING'
  | 'APPROVED'
  | 'RECOVERY'
  | 'RETAINED'
  | 'TRANSFERRED'
  | 'INELIGIBLE';

export interface ReenrollmentDecisionInput {
  finalResult: 'APPROVED' | 'FAILED' | 'PENDING' | 'TRANSFERRED' | 'INELIGIBLE';
  recoveryPending?: boolean;
  councilDecision?: 'PROMOTE' | 'RETAIN' | 'TRANSFER' | null;
}

export function resolveReenrollmentAcademicDecision(
  input: ReenrollmentDecisionInput,
): ReenrollmentAcademicDecision {
  if (input.finalResult === 'PENDING') return 'PENDING';
  if (input.finalResult === 'TRANSFERRED') return 'TRANSFERRED';
  if (input.finalResult === 'INELIGIBLE') return 'INELIGIBLE';
  if (input.councilDecision === 'TRANSFER') return 'TRANSFERRED';
  if (input.councilDecision === 'RETAIN') return 'RETAINED';
  if (input.recoveryPending || input.councilDecision === null && input.finalResult === 'FAILED') return 'RECOVERY';
  if (input.finalResult === 'FAILED') return 'RETAINED';
  return 'APPROVED';
}

export function isReenrollmentGradeEligible(
  sourceGradeLevel: string | null | undefined,
  eligibleGradeLevels: readonly string[],
): boolean {
  if (eligibleGradeLevels.length === 0) return true;
  const source = sourceGradeLevel?.trim().toLocaleLowerCase('pt-BR');
  return Boolean(source && eligibleGradeLevels.some(
    (grade) => grade.trim().toLocaleLowerCase('pt-BR') === source,
  ));
}
