import { ACADEMIC_LEVEL_VALUES, normalizeAcademicLevel } from './academic/academicLevels';

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

export type ReenrollmentDestinationState =
  | 'READY'
  | 'GRADUATING'
  | 'PENDING_RESULT'
  | 'DESTINATION_GRADE_UNAVAILABLE'
  | 'GRADE_LEVEL_UNRECOGNIZED';

export interface ReenrollmentDestinationInput {
  resultStatus: 'APPROVED' | 'FAILED' | 'RETAINED' | 'RECOVERY' | 'INCOMPLETE' | 'PENDING' | 'GRADUATING';
  sourceGradeLevel: string | null | undefined;
  availableDestinationGrades: readonly string[];
  override?: {
    promotionPolicy: 'PROMOTE' | 'RETAIN' | 'GRADUATE' | 'MANUAL';
    destinationGradeLevel?: string | null;
  } | null;
}

export interface ReenrollmentDestination {
  state: ReenrollmentDestinationState;
  destinationGradeLevel: string | null;
  reason: string | null;
}

export interface ReenrollmentDestinationClass {
  id: string;
  gradeLevel: string | null;
  active: boolean;
  capacity: number;
  activeEnrollments: number;
}

export type ReenrollmentClassSelection =
  | { state: 'SELECTED'; classId: string }
  | { state: 'NO_AVAILABLE_CLASS' | 'AMBIGUOUS'; classId: null };

export function resolveReenrollmentAcademicDecision(
  input: ReenrollmentDecisionInput,
): ReenrollmentAcademicDecision {
  if (input.finalResult === 'PENDING') return 'PENDING';
  if (input.finalResult === 'TRANSFERRED') return 'TRANSFERRED';
  if (input.finalResult === 'INELIGIBLE') return 'INELIGIBLE';
  if (input.councilDecision === 'TRANSFER') return 'TRANSFERRED';
  if (input.councilDecision === 'RETAIN') return 'RETAINED';
  if (input.recoveryPending) return 'RECOVERY';
  if (input.finalResult === 'FAILED') return 'RETAINED';
  return 'APPROVED';
}

export function resolveReenrollmentDestination(
  input: ReenrollmentDestinationInput,
): ReenrollmentDestination {
  if (['RECOVERY', 'INCOMPLETE', 'PENDING'].includes(input.resultStatus)) {
    return { state: 'PENDING_RESULT', destinationGradeLevel: null, reason: input.resultStatus };
  }

  const sourceLevel = normalizeAcademicLevel(input.sourceGradeLevel);
  if (!sourceLevel) {
    return { state: 'GRADE_LEVEL_UNRECOGNIZED', destinationGradeLevel: null, reason: 'Série de origem sem correspondência na estrutura acadêmica.' };
  }

  const policy = input.override?.promotionPolicy;
  if (policy === 'GRADUATE' || (input.resultStatus === 'APPROVED' && sourceLevel === '3 EM')) {
    return { state: 'GRADUATING', destinationGradeLevel: null, reason: null };
  }

  if (policy === 'MANUAL') {
    return { state: 'DESTINATION_GRADE_UNAVAILABLE', destinationGradeLevel: null, reason: 'A exceção exige definição autorizada da série de destino.' };
  }

  const expectedLevel = input.resultStatus === 'FAILED' || input.resultStatus === 'RETAINED' || policy === 'RETAIN'
    ? sourceLevel
    : ACADEMIC_LEVEL_VALUES[ACADEMIC_LEVEL_VALUES.indexOf(sourceLevel) + 1];
  if (!expectedLevel) {
    return { state: 'GRADE_LEVEL_UNRECOGNIZED', destinationGradeLevel: null, reason: 'A estrutura acadêmica não define uma próxima série.' };
  }

  const overrideGrade = policy === 'PROMOTE' ? input.override?.destinationGradeLevel : null;
  const candidates = overrideGrade
    ? [overrideGrade]
    : input.availableDestinationGrades;
  const destinationGradeLevel = candidates.find(
    (grade) => normalizeAcademicLevel(grade) === expectedLevel,
  ) ?? null;

  if (!destinationGradeLevel) {
    return { state: 'DESTINATION_GRADE_UNAVAILABLE', destinationGradeLevel: null, reason: `A série ${expectedLevel} não foi encontrada no ano letivo de destino.` };
  }

  return { state: 'READY', destinationGradeLevel, reason: null };
}

export function selectReenrollmentDestinationClass(
  destinationGradeLevel: string | null | undefined,
  candidates: readonly ReenrollmentDestinationClass[],
): ReenrollmentClassSelection {
  const normalizedDestination = normalizeAcademicLevel(destinationGradeLevel);
  if (!normalizedDestination) return { state: 'NO_AVAILABLE_CLASS', classId: null };

  const available = candidates.filter((candidate) =>
    candidate.active &&
    normalizeAcademicLevel(candidate.gradeLevel) === normalizedDestination &&
    (candidate.capacity <= 0 || candidate.activeEnrollments < candidate.capacity),
  );

  if (available.length === 1) return { state: 'SELECTED', classId: available[0].id };
  return {
    state: available.length === 0 ? 'NO_AVAILABLE_CLASS' : 'AMBIGUOUS',
    classId: null,
  };
}

const PENDING_REASON_LABELS: Record<string, string> = {
  REMATRICULA_NAO_CONFIRMADA: 'Aguardando confirmação da rematrícula.',
  CONTRATO_NAO_ACEITO: 'Aguardando o aceite do contrato de rematrícula.',
  RESULTADO_NAO_HOMOLOGADO: 'Aguardando resultado acadêmico oficial.',
  RESULTADO_ACADEMICO_PENDENTE: 'Aguardando a conclusão do resultado acadêmico oficial.',
  RESULTADO_SEM_FUNDAMENTO: 'Não há resultado acadêmico definitivo para determinar a progressão.',
  RECUPERACAO_PENDENTE: 'Aguardando conclusão da recuperação.',
  RESULTADO_INCOMPLETO: 'Há resultados de períodos ainda não finalizados.',
  TRANSFER_HISTORY_REQUIRES_REVIEW: 'Há uma transferência durante o ano letivo que exige revisão do histórico.',
  RESULTADO_NAO_ELEGIVEL: 'O resultado acadêmico ainda não permite efetivar a matrícula.',
  CONCLUIDOR_TRATAMENTO_PROPRIO: 'A conclusão do Ensino Médio exige o fluxo de certificação.',
  SERIE_DESTINO_NAO_DEFINIDA: 'Aguardando definição segura da série de destino.',
  TURMA_DESTINO_NAO_DEFINIDA: 'Aguardando definição da turma do próximo ano.',
  TURMA_DESTINO_INVALIDA: 'A turma de destino deixou de atender aos critérios; é necessária uma nova escolha.',
  TURMA_SERIE_INCOMPATIVEL: 'A turma selecionada não corresponde à série calculada.',
  SEM_VAGA_NA_TURMA: 'Não há vaga disponível na turma selecionada.',
  VINCULO_FINANCEIRO_AUSENTE: 'Aguardando configuração do vínculo financeiro.',
  FATURA_NAO_GERADA: 'Aguardando geração da cobrança prevista pela instituição.',
  FATURA_PENDENTE: 'Aguardando quitação ou confirmação financeira.',
  LIQUIDACAO_MANUAL_NAO_AUTORIZADA: 'A baixa manual não está autorizada nesta campanha.',
  PAGAMENTO_NAO_LIQUIDADO: 'Aguardando confirmação da quitação financeira.',
  PAGAMENTO_PENDENTE: 'Aguardando confirmação da quitação financeira.',
  CONFIRMACAO_NAO_REALIZADA: 'Aguardando a confirmação da família ou do aluno elegível.',
  MATRICULA_ATIVA_DUPLICADA: 'Já existe uma matrícula ativa no ano de destino; a secretaria deve revisar.',
};

export function formatReenrollmentPendingReason(reason: string | null | undefined): string[] {
  if (!reason?.trim()) return [];
  return [...new Set(reason.split(';').map((item) => item.trim()).filter(Boolean))]
    .map((code) => PENDING_REASON_LABELS[code] ?? 'Há uma pendência que precisa de revisão pela secretaria.');
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
