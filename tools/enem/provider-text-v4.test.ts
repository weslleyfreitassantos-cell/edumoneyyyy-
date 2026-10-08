import { describe, expect, it } from 'vitest';

import {
  buildProviderTextV4ImportSql,
  buildProviderTextV4Report,
  PROVIDER_TEXT_V4_REVISION,
} from './provider-text-v4';
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
    title: 'Questão 1 - ENEM 2023',
    index: 1,
    discipline: 'matematica',
    language: null,
    year: 2023,
    context: 'Uma situação textual completa fornece os dados necessários para resolver a questão.',
    files: [],
    correctAlternative: 'C',
    alternativesIntroduction: 'Qual alternativa responde corretamente ao problema?',
    alternatives,
    ...overrides,
  };
}

describe('ENEM provider text v4', () => {
  it('uses the complete statement rule before accepting a provider record', () => {
    const report = buildProviderTextV4Report([
      question(),
      question({
        year: 2015,
        index: 156,
        context: '',
        alternativesIntroduction: 'Efetuando o pagamento dessa forma, o valor a ser pago ao banco na décima prestação é de',
      }),
    ]);
    expect(report.contentRevision).toBe(PROVIDER_TEXT_V4_REVISION);
    expect(report.accepted).toBe(1);
    expect(report.incompleteStructuredText).toBe(1);
    expect(report.questionOnlyFragments).toBe(1);
    expect(report.knownFinancingQuestion).toMatchObject({
      found: true,
      complete: false,
      accepted: false,
    });
  });

  it('keeps title and metadata decisions explicit in the audit report', () => {
    const report = buildProviderTextV4Report([
      question(),
      question({
        index: 2,
        title: 'A relação entre energia e matéria',
      }),
    ]);
    expect(report.titleUsed).toBe(1);
    expect(report.titleDiscardedMetadataOnly).toBe(1);
    expect(report.records.find((record) => record.providerIndex === 2)?.titleUsed).toBe(true);
  });

  it('separates missing English coverage from the integrity audit', () => {
    const report = buildProviderTextV4Report([
      ...Array.from({ length: 10 }, (_, index) => question({ index: index + 1 })),
      ...Array.from({ length: 10 }, (_, index) => question({ index: index + 1, discipline: 'ciencias-humanas', year: 2024 })),
      ...Array.from({ length: 10 }, (_, index) => question({ index: index + 1, discipline: 'ciencias-natureza', year: 2025 })),
      ...Array.from({ length: 10 }, (_, index) => question({ index: index + 1, discipline: 'linguagens', year: 2026 })),
      ...Array.from({ length: 5 }, (_, index) => question({ index: index + 1, discipline: 'linguagens', language: 'espanhol', year: 2027 })),
    ]);
    expect(report.auditSamples['LINGUAGENS:ENGLISH']).toEqual([]);
    expect(report.auditSamplePass).toBe(true);
  });

  it('generates a v4 import without occurrence or visual fallback', () => {
    const report = buildProviderTextV4Report([question()]);
    const sql = buildProviderTextV4ImportSql(report);
    expect(sql).toContain(Buffer.from(PROVIDER_TEXT_V4_REVISION, 'utf8').toString('hex'));
    expect(sql).toContain(Buffer.from('STRUCTURED_TEXT', 'utf8').toString('hex'));
    expect(sql).not.toContain('learning_enem_official_occurrences occurrence where');
    expect(sql).toContain(Buffer.from('STRUCTURED_PROVIDER', 'utf8').toString('hex'));
  });
});
