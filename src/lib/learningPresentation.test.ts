import { describe, expect, it } from 'vitest';

import { humanizeDifficulty, humanizePackageSource, humanizePackageTitle, humanizeSkill, humanizeSubjectArea, packagePresentationKey } from './learningPresentation';

describe('learning presentation labels', () => {
  it('translates internal subject and skill identifiers for school users', () => {
    expect(humanizeSubjectArea('MATHEMATICS')).toBe('Matemática');
    expect(humanizeSubjectArea('CIENCIAS_NATUREZA')).toBe('Ciências Naturais');
    expect(humanizeSubjectArea('CIENCIAS_HUMANAS')).toBe('Ciências Humanas');
    expect(humanizeSubjectArea('LINGUAGENS')).toBe('Linguagens');
    expect(humanizeSkill('ART_CONTEXT')).toBe('Contextualização artística');
    expect(humanizeSkill('MATH_PERCENT_OF_QUANTITY')).not.toContain('MATH_');
  });

  it('deduplicates package labels across localized names', () => {
    expect(humanizePackageTitle('Conteúdo padrão — Mathematics', 'MATEMATICA')).toBe('Conteúdo de Matemática');
    expect(packagePresentationKey('Conteúdo padrão — Mathematics', 'MATEMATICA')).toBe(packagePresentationKey('Conteúdo padrão — Matemática', 'MATEMATICA'));
  });

  it('translates activity source and difficulty labels', () => {
    expect(humanizePackageSource('INSTITUTION')).toBe('Escola');
    expect(humanizeDifficulty('MEDIUM')).toBe('Média');
  });
});
