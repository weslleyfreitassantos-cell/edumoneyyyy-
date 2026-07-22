import { describe, expect, it } from 'vitest';

import {
  getAccountStatusLabel,
  getEnrollmentStatusLabel,
} from './statusLabels';

describe('statusLabels', () => {
  it('traduz status de conta', () => {
    expect(getAccountStatusLabel('ACTIVE')).toBe('Ativa');
    expect(getAccountStatusLabel('SUSPENDED')).toBe('Suspensa');
    expect(getAccountStatusLabel('CANCELED')).toBe('Cancelada');
  });

  it('traduz status de matricula sem depender de caixa', () => {
    expect(getEnrollmentStatusLabel('active')).toBe('Ativa');
    expect(getEnrollmentStatusLabel('TRANSFERRED')).toBe('Transferida');
  });
});
