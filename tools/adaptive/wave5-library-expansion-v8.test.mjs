import { describe, expect, it } from 'vitest';
import { buildWave5LibraryExpansionPacks } from './build-wave5-library-expansion-v8.mjs';
import { validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

describe('Wave 5 V8 library expansion', () => {
  it('adds two 100-question authorial batches without changing publication gates', () => {
    const packs = buildWave5LibraryExpansionPacks();
    for (const pack of Object.values(packs)) {
      const result = validateQuestionFirstPack(pack);
      expect(result.valid).toBe(true);
      expect(pack.questions.length).toBeGreaterThanOrEqual(100);
      expect(new Set(pack.questions.map((question) => question.id)).size).toBe(pack.questions.length);
      expect(new Set(pack.questions.map((question) => question.contextFamily)).size).toBe(pack.questions.length);
      expect(pack.sourceReconciliation.newQuestions).toBe(100);
      expect(pack.sourceReconciliation.reusedQuestionsCountedAsNew).toBe(false);
      expect(pack.contentVersion).toBe(8);
      expect(pack.publicationStatus).toBe('STAGING');
      expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
      expect(result.counts.PROBE).toBeGreaterThanOrEqual(10);
      expect(result.counts.PRACTICE).toBeGreaterThanOrEqual(40);
      expect(result.counts.TRANSFER).toBeGreaterThanOrEqual(24);
    }
  });
});
