import { describe, expect, it } from 'vitest';

import { buildEnemImportDryRun } from './dry-run';
import type { EnemCanonicalizationResult } from './canonicalize';
import type { EnemParseResult } from './parse';

const parsed = { schemaVersion: 1, parsedAt: '2026-10-03T00:00:00.000Z', artifacts: [], issues: [] } as EnemParseResult;

const canonical = {
  schemaVersion: 1,
  reviewRequired: 1,
  duplicatesCollapsed: 1,
  crossBookletMismatches: [],
  canonicalQuestions: [{
    canonicalId: 'a',
    year: 2025,
    day: 'D2',
    language: null,
    area: 'MATEMATICA',
    statement: 'Questão válida',
    options: ['1', '2', '3', '4', '5'],
    officialAnswer: 'C',
    qualityState: 'PARSED',
    sourceIntegrity: 'VERIFIED',
    statementIntegrity: 'VERIFIED',
    optionsIntegrity: 'VERIFIED',
    controlCharCount: 0,
    occurrences: [{ year: 2025, day: 'D2', booklet: 'CD5', questionNumber: 136, language: null, officialAnswer: 'C' }],
  }],
} as EnemCanonicalizationResult;

describe('ENEM import dry-run', () => {
  it('is non-writing and passes with explicit quarantine', () => {
    const result = buildEnemImportDryRun({
      artifacts: [{
        year: 2025,
        exam: 'ENEM',
        application: 'REGULAR',
        day: 'D2',
        booklet: 'CD5',
        sourceReference: 'https://www.gov.br/inep/enem/provas-e-gabaritos/2025',
        examUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D2_CD5.pdf',
        answerKeyUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_GB_impresso_D2_CD5.pdf',
        examPath: '.runtime/exam.pdf',
        answerKeyPath: '.runtime/key.pdf',
        examSha256: 'a'.repeat(64),
        answerKeySha256: 'b'.repeat(64),
        examBytes: 10,
        answerKeyBytes: 10,
        retrievedAt: '2026-10-03T00:00:00.000Z',
      }],
      issues: ['ONE_QUARANTINED_ITEM'],
    }, parsed, canonical);
    expect(result.status).toBe('PASS_WITH_QUARANTINE');
    expect(result.databaseWrites).toBe(0);
    expect(result.productionTouched).toBe(false);
    expect(result.duplicateOccurrences).toBe(0);
    expect(result.sourceHashesVerified).toBe(true);
    expect(result.parsedCanonicalQuestionCount).toBe(1);
    expect(result.importableCanonicalQuestionCount).toBe(1);
    expect(result.parsedOccurrenceCount).toBe(1);
    expect(result.importableOccurrenceCount).toBe(1);
  });

  it('separates parsed questions from the importable corpus without hiding exclusions', () => {
    const makeQuestion = (canonicalId: string, officialAnswer: 'A' | 'B' | 'C' | 'D' | 'E' | 'ANNULLED' | 'UNKNOWN', options: string[]) => ({
      canonicalId,
      year: 2025,
      day: 'D2' as const,
      language: null,
      area: 'MATEMATICA' as const,
      statement: canonicalId,
      options,
      officialAnswer,
      qualityState: 'PARSED' as const,
      sourceIntegrity: 'VERIFIED' as const,
      statementIntegrity: 'VERIFIED' as const,
      optionsIntegrity: 'VERIFIED' as const,
      controlCharCount: 0,
      occurrences: [{ year: 2025, day: 'D2' as const, booklet: 'CD5', questionNumber: 136, language: null, officialAnswer }],
    });
    const result = buildEnemImportDryRun({ artifacts: [], issues: [] }, parsed, {
      ...canonical,
      canonicalQuestions: [
        makeQuestion('valid', 'A', ['1', '2', '3', '4', '5']),
        makeQuestion('annulled', 'ANNULLED', ['1', '2', '3', '4', '5']),
        makeQuestion('unknown', 'UNKNOWN', ['1', '2', '3', '4', '5']),
        makeQuestion('short', 'B', ['1', '2', '3', '4']),
      ],
    });
    expect(result.parsedCanonicalQuestionCount).toBe(4);
    expect(result.importableCanonicalQuestionCount).toBe(1);
    expect(result.parsedOccurrenceCount).toBe(4);
    expect(result.importableOccurrenceCount).toBe(1);
    expect(result.canonicalQuestionCount).toBe(result.importableCanonicalQuestionCount);
    expect(result.occurrenceCount).toBe(result.importableOccurrenceCount);
  });

  it('allows a full corpus manifest to be named explicitly', () => {
    const result = buildEnemImportDryRun({ artifacts: [], issues: [] }, parsed, canonical, {
      manifestVersion: 'ENEM_OFFICIAL_PRIMARY_LANGUAGE_2017_2025_V1',
    });
    expect(result.manifestVersion).toBe('ENEM_OFFICIAL_PRIMARY_LANGUAGE_2017_2025_V1');
  });
});
