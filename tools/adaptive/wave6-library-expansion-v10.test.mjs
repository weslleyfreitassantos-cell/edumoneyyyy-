import { describe, expect, it } from 'vitest';
import { buildWave6LibraryExpansionV10Packs } from './build-wave6-library-expansion-v10.mjs';
import { validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

describe('Wave 6 V10 library expansion', () => {
  it('adds two 100-question batches with distinct contexts and staging gates', () => {
    const packs = buildWave6LibraryExpansionV10Packs();
    expect(Object.keys(packs)).toEqual(['PE_DISTINGUISH_ACTIVITY_EXERCISE_FII', 'PE_PLAN_SAFE_ACTIVITY']);
    expect(Object.values(packs)).toHaveLength(2);
    for (const pack of Object.values(packs)) {
      const result = validateQuestionFirstPack(pack);
      expect(result.valid).toBe(true);
      expect(pack.sourceReconciliation.newQuestions).toBe(100);
      expect(pack.sourceReconciliation.reusedQuestionsCountedAsNew).toBe(false);
      expect(pack.contentVersion).toBe(10);
      expect(new Set(pack.questions.map((question) => question.id)).size).toBe(pack.questions.length);
      expect(new Set(pack.questions.map((question) => question.contextFamily)).size).toBe(pack.questions.length);
      expect(pack.publicationStatus).toBe('STAGING');
      expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
      expect(result.counts.PROBE).toBeGreaterThanOrEqual(10);
      expect(result.counts.PRACTICE).toBeGreaterThanOrEqual(40);
      expect(result.counts.TRANSFER).toBeGreaterThanOrEqual(24);
    }
    const questions = Object.values(packs).flatMap((pack) => pack.questions);
    expect(questions.filter((question) => question.id.startsWith('v10-')).length).toBe(200);
  });
});
