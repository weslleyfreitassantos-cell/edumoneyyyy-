import { describe, expect, it } from 'vitest';

import {
  buildProviderTextV6ImportSql,
  buildProviderTextV6Report,
  PADARIA_PROVIDER_KEY,
  PROVIDER_TEXT_V6_REVISION,
} from './provider-text-v6';
import type { EnemProviderQuestion } from './structured-text';

const alternatives = [
  { letter: 'A' as const, text: 'R$ 0,50 ≤ p < R$ 1,50', file: null },
  { letter: 'B' as const, text: 'R$ 1,50 ≤ p < R$ 2,50', file: null },
  { letter: 'C' as const, text: 'R$ 2,50 ≤ p < R$ 3,50', file: null },
  { letter: 'D' as const, text: 'R$ 3,50 ≤ p < R$ 4,50', file: null },
  { letter: 'E' as const, text: 'R$ 4,50 ≤ p < R$ 5,50', file: null },
];

function question(overrides: Partial<EnemProviderQuestion> = {}): EnemProviderQuestion {
  return {
    title: 'Questão 150 - ENEM 2015',
    index: 150,
    discipline: 'matematica',
    language: null,
    year: 2015,
    context: 'q = 400 – 100_p_, na qual q representa a quantidade de pães especiais vendidos diariamente e p, o seu preço em reais. A fim de aumentar o fluxo de clientes, o gerente da padaria decidiu fazer uma promoção.',
    files: [],
    correctAlternative: 'A',
    alternativesIntroduction: 'O preço p, em reais, do pão especial nessa promoção deverá estar no intervalo',
    alternatives,
    ...overrides,
  };
}

describe('ENEM provider text v6', () => {
  it('recovers the missing first paragraph only for the matching padaria canary', () => {
    const report = buildProviderTextV6Report([question()]);
    const record = report.records[0];
    expect(report.contentRevision).toBe(PROVIDER_TEXT_V6_REVISION);
    expect(record.providerQuestionKey).toBe(PADARIA_PROVIDER_KEY);
    expect(record.accepted).toBe(true);
    expect(record.recoveredFromOtherProvider).toBe('tecescola-user-verified-reference');
    expect(record.contextText).toContain('R$ 300,00');
    expect(record.contextText).toContain('100 pães especiais');
  });

  it('does not accept the padaria equation when recovery identity does not match', () => {
    const report = buildProviderTextV6Report([question({ alternatives: alternatives.map((item, index) => ({ ...item, text: `${item.text} ${index}` })) })]);
    expect(report.records[0].accepted).toBe(false);
    expect(report.records[0].semanticRejectionReasons).toContain('MISSING_REQUIRED_CONDITION');
  });

  it('emits a v6 import and never falls back to visual assets', () => {
    const sql = buildProviderTextV6ImportSql(buildProviderTextV6Report([question()]));
    expect(sql).toContain(Buffer.from(PROVIDER_TEXT_V6_REVISION, 'utf8').toString('hex'));
    expect(sql).toContain(Buffer.from('STRUCTURED_TEXT', 'utf8').toString('hex'));
    expect(sql).not.toContain('learning_enem_official_occurrences occurrence where');
  });
});
