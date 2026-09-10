import { describe, expect, it } from 'vitest';

import { formatSubjectOfferingLabel } from './subjectOfferingLabels';

describe('formatSubjectOfferingLabel', () => {
  it('mantém disciplina, turma e período distinguíveis', () => {
    expect(
      formatSubjectOfferingLabel({
        subjectName: 'Sociologia',
        className: '2',
        termName: '3º bimestre',
      }),
    ).toBe('Sociologia · Turma 2 · 3º bimestre');
  });

  it('não duplica o prefixo quando a turma já o possui', () => {
    expect(
      formatSubjectOfferingLabel({
        subjectName: 'Matemática',
        className: 'Turma 1',
        termName: null,
      }),
    ).toBe('Matemática · Turma 1');
  });
});
