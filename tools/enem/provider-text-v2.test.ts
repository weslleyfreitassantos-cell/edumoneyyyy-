import { describe, expect, it } from 'vitest';

import {
  buildProviderTextImportSql,
  buildProviderTextReport,
  PROVIDER_TEXT_REVISION,
  type ProviderTextReport,
} from './provider-text-v2';
import { deduplicateProviderQuestions, type EnemProviderQuestion } from './structured-text';

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
    context: 'Um enunciado textual completo apresenta a situação necessária para resolver a questão.',
    files: [],
    correctAlternative: 'C',
    alternativesIntroduction: 'Qual alternativa responde corretamente ao problema?',
    alternatives,
    ...overrides,
  };
}

describe('ENEM provider text v2', () => {
  it('accepts complete text without requiring official PDF reconciliation', () => {
    const report = buildProviderTextReport([question()]);
    expect(report.contentRevision).toBe(PROVIDER_TEXT_REVISION);
    expect(report.accepted).toBe(1);
    expect(report.records[0]).toMatchObject({
      accepted: true,
      providerCorrectAlternative: 'C',
      mediaDependent: false,
    });
  });

  it.each([
    ['missing statement', { context: '', alternativesIntroduction: '' }, 'INCOMPLETE_STATEMENT'],
    ['missing option', { alternatives: alternatives.slice(0, 4) }, 'INCOMPLETE_ALTERNATIVES'],
    ['media file', { files: ['https://enem.dev/figure.png'] }, 'MEDIA_DEPENDENT'],
    ['option media', { alternatives: alternatives.map((item, index) => index === 0 ? { ...item, file: 'option.png' } : item) }, 'MEDIA_DEPENDENT'],
    ['markdown image', { context: 'Leia ![](figure.png) e responda.' }, 'MEDIA_DEPENDENT'],
    ['visual cue', { context: 'Observe a figura para responder.' }, 'VISUAL_CUE'],
    ['unsafe markup', { context: '<img src="x"> texto' }, 'UNSAFE_TEXT'],
    ['invalid answer', { correctAlternative: null }, 'INVALID_ANSWER'],
  ])('rejects %s from the text-only pool', (_name, overrides, reason) => {
    const report = buildProviderTextReport([question(overrides)]);
    expect(report.accepted).toBe(0);
    expect(report.records[0].rejectionReasons).toContain(reason);
  });

  it('keeps only one provider record for a repeated identity', () => {
    const first = question();
    const second = question({ context: 'A duplicate copy with different text.' });
    const deduplicated = deduplicateProviderQuestions([first, second]);
    expect(deduplicated.questions).toHaveLength(1);
    expect(deduplicated.duplicateProviderQuestions).toBe(1);
  });

  it('generates an idempotent provider import with no occurrence requirement', () => {
    const report = buildProviderTextReport([question()]);
    const sql = buildProviderTextImportSql(report);
    expect(sql).toContain('occurrence_id, provider_year');
    expect(sql).toContain('content_acceptance_status');
    expect(sql).toContain("decode('5245564945575f5245515549524544', 'hex')");
    expect(sql).not.toContain('PROVIDER_ACCEPTED');
    expect(sql).not.toContain('learning_enem_official_occurrences occurrence where');
  });
});

// Keep the report type imported in this test file as an API contract check for
// downstream audit tooling that consumes the generated JSON.
const _reportTypeContract: ProviderTextReport | null = null;
void _reportTypeContract;
