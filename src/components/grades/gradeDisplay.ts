import type {
  AssessmentStatus,
  AssessmentType,
  GradeStatus,
  GradeSummary,
} from '../../services/gradeService';

export const ASSESSMENT_TYPE_LABELS: Record<
  AssessmentType,
  string
> = {
  EXAM: 'Prova',
  ASSIGNMENT: 'Atividade',
  PROJECT: 'Projeto',
  QUIZ: 'Quiz',
  OTHER: 'Outra',
};

export const ASSESSMENT_STATUS_LABELS: Record<
  AssessmentStatus,
  string
> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicada',
  CLOSED: 'Fechada',
  CANCELED: 'Cancelada',
};

export const GRADE_STATUS_LABELS: Record<GradeStatus, string> = {
  PENDING: 'Não lançada',
  GRADED: 'Lançada',
  EXCUSED: 'Dispensada',
};

export function formatAssessmentDate(value: string): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export function getTodayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getMonthStartDateInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(
    2,
    '0',
  );

  return `${year}-${month}-01`;
}

export function formatScore(
  score: number | null,
  maxScore?: number,
): string {
  if (score === null) {
    return 'Não lançada';
  }

  const value = score.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  });

  if (maxScore === undefined) {
    return value;
  }

  return `${value}/${maxScore.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return `${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })}%`;
}

export function formatGradeSummaryAverage(
  summary: GradeSummary,
): string {
  return formatPercent(summary.averagePercent);
}

export function getGradeStatusClassName(status: GradeStatus): string {
  if (status === 'GRADED') {
    return 'bg-green-50 text-green-700 ring-green-200';
  }

  if (status === 'EXCUSED') {
    return 'bg-blue-50 text-[#005bbf] ring-blue-200';
  }

  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

export function getAssessmentStatusClassName(
  status: AssessmentStatus,
): string {
  if (status === 'PUBLISHED') {
    return 'bg-green-50 text-green-700 ring-green-200';
  }

  if (status === 'CLOSED') {
    return 'bg-blue-50 text-[#005bbf] ring-blue-200';
  }

  if (status === 'CANCELED') {
    return 'bg-red-50 text-red-700 ring-red-200';
  }

  return 'bg-amber-50 text-amber-700 ring-amber-200';
}
