import { describe, expect, it } from 'vitest';

import { buildEnemReviewBreakdown } from './review-report';
import type { EnemCanonicalizationResult } from './canonicalize';
import type { EnemDiscoveryResult } from './discover';
import type { EnemParseResult } from './parse';

describe('ENEM review breakdown', () => {
  it('keeps structural quarantine separate from pedagogical enrichment', () => {
    const discovery = {
      schemaVersion: 1,
      catalogReference: 'https://www.gov.br/inep',
      discoveredAt: '2026-10-03T00:00:00.000Z',
      years: [],
      artifacts: [{
        year: 2025, exam: 'ENEM', application: 'REGULAR', day: 'D6', booklet: 'CD11',
        sourceReference: 'https://www.gov.br/inep', examUrl: 'https://download.inep.gov.br/exam.pdf', answerKeyUrl: 'https://download.inep.gov.br/key.pdf',
      }],
      issues: [],
    } as EnemDiscoveryResult;
    const parsed = {
      schemaVersion: 1,
      parsedAt: '2026-10-03T00:00:00.000Z',
      artifacts: [{
        year: 2025, day: 'D2', booklet: 'CD5', examPath: '', answerKeyPath: '', answerKey: [],
        issues: [], qualityState: 'REVIEW_REQUIRED',
        questions: [{
          questionNumber: 91, language: null, page: 1, area: 'CIENCIAS_NATUREZA', statement: 'x', supportText: null,
          options: [], officialAnswer: 'UNKNOWN', mediaStatus: 'NOT_DETECTED', qualityState: 'REVIEW_REQUIRED',
          reviewReasons: ['MISSING_OPTIONS', 'UNKNOWN_OFFICIAL_ANSWER'],
        }],
      }],
      issues: [],
    } as EnemParseResult;
    const canonical = {
      schemaVersion: 1, reviewRequired: 1, duplicatesCollapsed: 0,
      canonicalQuestions: [], crossBookletMismatches: [],
    } as EnemCanonicalizationResult;
    const result = buildEnemReviewBreakdown(discovery, {
      artifacts: [],
      issues: ['ENEM_ARTIFACT_QUARANTINED:2025_D6_CD11:ENEM_ARTIFACT_FETCH_FAILED:2025_D6_CD11:GB:404'],
    }, parsed, canonical);
    expect(result.reasonCounts.MISSING_OPTIONS).toBe(1);
    expect(result.reasonCounts.UNKNOWN_OFFICIAL_ANSWER).toBe(1);
    expect(result.missingAnswerKeys).toBe(1);
    expect(result.d6Cd11.discoveryPairPresent).toBe(true);
    expect(result.d6Cd11.officialAnswerKeyFound).toBe(false);
    expect(result.quarantined).toBe(2);
  });
});
