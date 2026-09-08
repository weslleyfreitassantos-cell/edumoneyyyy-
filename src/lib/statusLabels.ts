import type { AccountStatus } from './permissions';

const accountStatusLabels: Record<AccountStatus, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELED: 'Excluída',
};

const enrollmentStatusLabels: Record<string, string> = {
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
  PENDING: 'Pendente',
  FINISHED: 'Concluida',
  COMPLETED: 'Concluida',
  CANCELED: 'Cancelada',
  CANCELLED: 'Cancelada',
  TRANSFERRED: 'Transferida',
};

export function getAccountStatusLabel(
  status: AccountStatus,
): string {
  return accountStatusLabels[status];
}

export function getEnrollmentStatusLabel(
  status: string,
): string {
  const normalized = status.trim().toUpperCase();

  return enrollmentStatusLabels[normalized] ?? status;
}
