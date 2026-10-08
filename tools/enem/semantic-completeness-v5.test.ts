import { describe, expect, it } from 'vitest';

import {
  assessSemanticCompleteness,
  recoverCompleteStructuredQuestion,
} from './semantic-completeness-v5';
import { buildProviderTextV5Report } from './provider-text-v5';
import type { EnemProviderQuestion } from './structured-text';

const alternatives = [
  { letter: 'A' as const, text: 'Alternativa A', file: null },
  { letter: 'B' as const, text: 'Alternativa B', file: null },
  { letter: 'C' as const, text: 'Alternativa C', file: null },
  { letter: 'D' as const, text: 'Alternativa D', file: null },
  { letter: 'E' as const, text: 'Alternativa E', file: null },
];

function question(overrides: Partial<EnemProviderQuestion> = {}): EnemProviderQuestion {
  return {
    title: 'Questão 1 - ENEM 2024',
    index: 1,
    discipline: 'matematica',
    language: null,
    year: 2024,
    context: 'Uma situação completa apresenta todos os dados necessários para responder.',
    files: [],
    correctAlternative: 'C',
    alternativesIntroduction: 'Qual alternativa responde corretamente à situação apresentada?',
    alternatives,
    ...overrides,
  };
}

describe('ENEM semantic completeness v5', () => {
  it('rejects the financing canary without inventing its missing context', () => {
    const result = assessSemanticCompleteness(question({
      year: 2015,
      index: 156,
      context: null as unknown as string,
      alternativesIntroduction: 'Efetuando o pagamento dessa forma, o valor, em reais, a ser pago ao banco na décima prestação é de',
    }));
    expect(result.state).toBe('INCOMPLETE');
    expect(result.reasons).toEqual(expect.arrayContaining(['MISSING_CONTEXT', 'UNRESOLVED_REFERENCE']));
  });

  it('rejects the wardrobe volume canary when dimensions are absent', () => {
    const result = assessSemanticCompleteness(question({
      year: 2014,
      index: 156,
      context: null as unknown as string,
      alternativesIntroduction: 'O volume real do armário, em centímetros cúbicos, será',
      correctAlternative: 'E',
      alternatives: [
        { letter: 'A', text: '6.', file: null },
        { letter: 'B', text: '600.', file: null },
        { letter: 'C', text: '6 000.', file: null },
        { letter: 'D', text: '60 000.', file: null },
        { letter: 'E', text: '6 000 000.', file: null },
      ],
    }));
    expect(result.state).toBe('INCOMPLETE');
    expect(result.reasons).toContain('MISSING_NUMERIC_DATA');
  });

  it('keeps a short self-contained calculation complete', () => {
    const result = assessSemanticCompleteness(question({
      context: null as unknown as string,
      alternativesIntroduction: 'Quanto é 25% de 200?',
    }));
    expect(result.state).toBe('COMPLETE');
  });

  it('keeps an ambiguous short statement explicitly uncertain', () => {
    const result = assessSemanticCompleteness(question({
      context: 'Contexto',
      alternativesIntroduction: 'abc',
    }));
    expect(result.state).toBe('UNCERTAIN');
    expect(result.reasons).toContain('UNKNOWN_COMPLETENESS');
  });

  it('rejects visual references when no required media is available', () => {
    const result = assessSemanticCompleteness(question({
      context: 'Observe a figura abaixo para responder à questão.',
      alternativesIntroduction: 'Qual é a medida solicitada?',
    }));
    expect(result.reasons).toContain('MISSING_VISUAL_INFORMATION');
    expect(result.state).toBe('INCOMPLETE');
  });

  it('accepts an anaphoric prompt when the antecedent is present', () => {
    const result = assessSemanticCompleteness(question({
      context: 'Uma loja vende um produto por R$ 200 e oferece duas formas de pagamento.',
      alternativesIntroduction: 'Nessas condições, qual é a melhor opção para o cliente?',
    }));
    expect(result.state).toBe('COMPLETE');
    expect(result.reasons).not.toContain('UNRESOLVED_REFERENCE');
  });

  it('recovers only a strongly matching complete record from a second structured source', () => {
    const incomplete = question({ context: null as unknown as string, alternativesIntroduction: 'O volume real será' });
    const source = {
      provider: 'secondary-json',
      sourceUrl: 'https://example.test/questions/2024/1',
      question: { ...incomplete, context: 'As dimensões informadas para o armário são 2 cm, 3 cm e 4 cm.', alternativesIntroduction: 'O volume real será?' },
    };
    const recovery = recoverCompleteStructuredQuestion(incomplete, [source]);
    expect(recovery.reason).toBe('RECOVERED');
    expect(recovery.question?.context).toContain('dimensões');
    expect(recovery.source?.provider).toBe('secondary-json');
  });

  it('does not merge a conflicting provider answer', () => {
    const incomplete = question({ context: null as unknown as string, alternativesIntroduction: 'O volume real será' });
    const source = {
      provider: 'secondary-json',
      sourceUrl: 'https://example.test/questions/2024/1',
      question: { ...incomplete, context: 'As dimensões são 2 cm, 3 cm e 4 cm.', correctAlternative: 'D' as const, alternativesIntroduction: 'O volume real será?' },
    };
    expect(recoverCompleteStructuredQuestion(incomplete, [source]).reason).toBe('SOURCE_CONFLICT');
  });

  it('keeps complete records and excludes the two known canaries from the v5 pool', () => {
    const report = buildProviderTextV5Report([
      question(),
      question({ year: 2015, index: 156, context: null as unknown as string, alternativesIntroduction: 'Efetuando o pagamento dessa forma, o valor a ser pago ao banco na décima prestação é de' }),
      question({ year: 2014, index: 156, context: null as unknown as string, alternativesIntroduction: 'O volume real do armário, em centímetros cúbicos, será', correctAlternative: 'E' }),
    ]);
    expect(report.v4AcceptedReaudited).toBe(2);
    expect(report.accepted).toBe(1);
    expect(report.knownCanaries.financing.status).toBe('NOT_READY');
    expect(report.knownCanaries.wardrobe.status).toBe('NOT_READY');
  });
});
