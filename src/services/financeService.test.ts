import { describe, expect, it } from 'vitest';

function dueDate(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function splitCents(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) => base + (index < total % count ? 1 : 0));
}

describe('nucleo financeiro em centavos', () => {
  it('divide 12 parcelas sem perder centavos', () => {
    const installments = splitCents(108000, 12);
    expect(installments).toHaveLength(12);
    expect(installments.reduce((sum, value) => sum + value, 0)).toBe(108000);
  });

  it('limita vencimento no ultimo dia do mes', () => {
    expect(dueDate(2028, 1, 31)).toBe('2028-02-29');
    expect(dueDate(2027, 1, 31)).toBe('2027-02-28');
  });

  it('calcula bolsa percentual sem float', () => {
    const base = 100000;
    const scholarship = Math.round(base * 20 / 100);
    expect(base - scholarship).toBe(80000);
  });
});
