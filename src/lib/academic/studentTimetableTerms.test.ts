import { describe, expect, it } from 'vitest';

import { resolveStudentTimetableTerm } from './studentTimetableTerms';

const oldTerm = {
  id: 'term-old',
  startDate: '2026-01-01',
  endDate: '2026-06-30',
  active: true,
};

const currentTerm = {
  id: 'term-current',
  startDate: '2026-07-01',
  endDate: '2026-12-18',
  active: true,
};

describe('resolveStudentTimetableTerm', () => {
  it('seleciona o período da semana, não o primeiro período da lista', () => {
    expect(
      resolveStudentTimetableTerm(
        [oldTerm, currentTerm],
        '2026-09-07',
        '2026-09-10',
      )?.id,
    ).toBe('term-current');
  });

  it('preserva a parte válida de uma semana que cruza o fim do período', () => {
    const nextTerm = {
      ...currentTerm,
      id: 'term-next',
      startDate: '2026-09-11',
      endDate: '2026-12-18',
    };

    expect(
      resolveStudentTimetableTerm(
        [currentTerm, nextTerm],
        '2026-09-07',
        '2026-09-10',
      )?.id,
    ).toBe('term-current');
  });

  it('retorna nulo quando a semana não pertence a nenhum período', () => {
    expect(
      resolveStudentTimetableTerm(
        [oldTerm, currentTerm],
        '2027-01-04',
        '2027-01-05',
      ),
    ).toBeNull();
  });

  it('ignora períodos inativos', () => {
    expect(
      resolveStudentTimetableTerm(
        [{ ...currentTerm, active: false }],
        '2026-09-07',
        '2026-09-10',
      ),
    ).toBeNull();
  });
});
