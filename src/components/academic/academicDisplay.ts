import type {
  TermClosureStatus,
  TermResultStatus,
} from '../../services/academicCalculations';

export function formatPercent(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return 'Pendente';
  }

  return `${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 4,
  })}%`;
}

export function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Nao informado';
  }

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Nao foi possivel concluir a operacao.';
}

export function getClosureStatusLabel(
  status: TermClosureStatus | null | undefined,
): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Em revisao';
    case 'CLOSED':
      return 'Fechado';
    case 'REOPENED':
      return 'Reaberto';
    case 'OPEN':
    default:
      return 'Aberto';
  }
}

export function getResultStatusLabel(
  status: TermResultStatus,
): string {
  switch (status) {
    case 'APPROVED':
      return 'Aprovado';
    case 'FAILED_BY_GRADE':
      return 'Reprovado por nota';
    case 'FAILED_BY_ATTENDANCE':
      return 'Reprovado por frequencia';
    case 'FAILED_BY_GRADE_AND_ATTENDANCE':
      return 'Reprovado por nota e frequencia';
    case 'PENDING':
    default:
      return 'Pendente';
  }
}

export function getClosureBadgeClass(
  status: TermClosureStatus | null | undefined,
): string {
  switch (status) {
    case 'SUBMITTED':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'CLOSED':
      return 'border-green-200 bg-green-50 text-green-700';
    case 'REOPENED':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'OPEN':
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700';
  }
}

export function getResultBadgeClass(
  status: TermResultStatus,
): string {
  switch (status) {
    case 'APPROVED':
      return 'border-green-200 bg-green-50 text-green-700';
    case 'FAILED_BY_GRADE':
    case 'FAILED_BY_ATTENDANCE':
    case 'FAILED_BY_GRADE_AND_ATTENDANCE':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'PENDING':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}
