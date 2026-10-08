import { describe, expect, it } from 'vitest';

import {
  assessProviderStatementCompleteness,
  buildCompleteProviderStatement,
  deduplicateProviderQuestions,
  isMetadataOnlyProviderTitle,
  reconcileStructuredQuestions,
  STRUCTURED_CONTENT_REVISION,
  type EnemProviderQuestion,
} from './structured-text';
import type { EnemParseResult } from './parse';

const provider: EnemProviderQuestion = {
  title: 'Questão 97 - ENEM 2017',
  index: 97,
  discipline: 'ciencias-natureza',
  language: null,
  year: 2017,
  context: 'Um fato corriqueiro ao se cozinhar arroz é o derramamento de parte da água de cozimento sobre a chama azul do fogo, mudando-a para uma chama amarela.',
  files: [],
  correctAlternative: 'B',
  alternativesIntroduction: 'Cientificamente, sabe-se que essa mudança de cor da chama ocorre pela',
  alternatives: [
    { letter: 'A', text: 'Reação do gás de cozinha com o sal, volatilizando gás cloro.', file: null },
    { letter: 'B', text: 'Emissão de fótons pelo sódio, excitado por causa da chama.', file: null },
    { letter: 'C', text: 'Produção de derivado amarelo, pela reação com o carboidrato.', file: null },
    { letter: 'D', text: 'Reação do gás de cozinha com a água, formando gás hidrogênio.', file: null },
    { letter: 'E', text: 'Excitação das moléculas de proteínas, com formação de luz amarela.', file: null },
  ],
};

const parsed = {
  schemaVersion: 1,
  parsedAt: '2026-01-01T00:00:00.000Z',
  issues: [],
  artifacts: [{
    year: 2017,
    day: 'D2',
    booklet: 'CD5',
    examPath: 'exam.pdf',
    answerKeyPath: 'key.pdf',
    answerKey: [],
    qualityState: 'PARSED',
    issues: [],
    questions: [{
      questionNumber: 91,
      language: null,
      page: 2,
      area: 'CIENCIAS_NATUREZA',
      statement: `${provider.context} ${provider.alternativesIntroduction}`,
      supportText: null,
      options: provider.alternatives.map((item) => item.text),
      officialAnswer: 'B',
      mediaStatus: 'NOT_DETECTED',
      qualityState: 'PARSED',
      sourceIntegrity: 'VERIFIED',
      statementIntegrity: 'VERIFIED',
      optionsIntegrity: 'VERIFIED',
      controlCharCount: 0,
    }],
  }],
} as unknown as EnemParseResult;

describe('structured ENEM reconciliation', () => {
  it('deduplicates repeated provider pages without changing the provider identity', () => {
    const result = deduplicateProviderQuestions([provider, provider]);
    expect(result.questions).toHaveLength(1);
    expect(result.duplicateProviderQuestions).toBe(1);
  });

  it('matches by content and official answer rather than provider question number', () => {
    const result = reconcileStructuredQuestions([provider], parsed);
    expect(result.contentRevision).toBe(STRUCTURED_CONTENT_REVISION);
    expect(result.exact).toBe(1);
    expect(result.ready).toBe(1);
    expect(result.records[0].canonicalCandidate?.questionNumber).toBe(91);
    expect(result.records[0].matchMethod).toBe('CONTENT_AND_OFFICIAL_ANSWER');
  });

  it('does not promote an answer mismatch', () => {
    const mismatch = { ...provider, correctAlternative: 'A' };
    const result = reconcileStructuredQuestions([mismatch], parsed);
    expect(result.records[0].answerVerified).toBe(false);
    expect(result.records[0].verificationStatus).not.toBe('VERIFIED');
    expect(result.ready).toBe(0);
  });

  it('accepts a prompt-only question when the provider has no separate context', () => {
    const promptOnly = { ...provider, context: '' };
    const promptOnlyParsed = {
      ...parsed,
      artifacts: parsed.artifacts.map((artifact) => ({
        ...artifact,
        questions: artifact.questions.map((question) => ({
          ...question,
          statement: promptOnly.alternativesIntroduction,
        })),
      })),
    } as unknown as EnemParseResult;
    const result = reconcileStructuredQuestions([promptOnly], promptOnlyParsed);
    expect(result.records[0].statementComplete).toBe(true);
    expect(result.records[0].structuredContentIntegrity).toBe('VERIFIED');
    expect(result.ready).toBe(1);
  });

  it('keeps questions with required media out of the text-only ready set', () => {
    const media = { ...provider, files: ['https://enem.dev/2017/questions/97/figure.png'] };
    const result = reconcileStructuredQuestions([media], parsed);
    expect(result.records[0].requiredMediaPresent).toBe(false);
    expect(result.records[0].renderMode).toBe('STRUCTURED_TEXT_WITH_MEDIA');
    expect(result.ready).toBe(0);
  });

  it('discards metadata-only titles and keeps semantic titles', () => {
    expect(isMetadataOnlyProviderTitle('Questão 97 - ENEM 2017')).toBe(true);
    expect(isMetadataOnlyProviderTitle('O efeito estufa e o equilíbrio climático')).toBe(false);
    expect(buildCompleteProviderStatement({
      ...provider,
      title: 'O efeito estufa e o equilíbrio climático',
      context: 'Leia o texto e responda.',
      alternativesIntroduction: 'A consequência apresentada é',
    })).toBe('O efeito estufa e o equilíbrio climático\n\nLeia o texto e responda.\n\nA consequência apresentada é');
  });

  it('removes exact, containment, and partial overlap between statement fields', () => {
    const question = {
      ...provider,
      title: 'Questão 97 - ENEM 2017',
      context: 'O contexto termina com uma informação importante para a questão. A informação importante',
      alternativesIntroduction: 'A informação importante para a questão deve ser considerada.',
    };
    expect(buildCompleteProviderStatement(question)).toBe(
      'O contexto termina com uma informação importante para a questão. A informação importante para a questão deve ser considerada.',
    );
  });

  it('rejects an anaphoric prompt without an antecedent', () => {
    const result = assessProviderStatementCompleteness({
      title: 'Questão 156 - ENEM 2015',
      context: '',
      alternativesIntroduction: 'Efetuando o pagamento dessa forma, o valor a ser pago é de',
    });
    expect(result.complete).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(['INCOMPLETE_STRUCTURED_TEXT', 'QUESTION_ONLY_FRAGMENT']));
  });

  it('accepts a legitimate short self-contained question without context', () => {
    const result = assessProviderStatementCompleteness({
      title: 'Questão 1 - ENEM 2024',
      context: '',
      alternativesIntroduction: 'Quanto é 2 + 2?',
    });
    expect(result.complete).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});
