import { describe, expect, it } from 'vitest';
import { buildWave4LibraryExpansionPacks } from './build-wave4-library-expansion-v7.mjs';
import { validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

describe('Wave 4 V7 library expansion', () => {
  it('adds two 100-question authorial batches without changing publication gates', () => {
    const packs = buildWave4LibraryExpansionPacks();
    for (const pack of Object.values(packs)) {
      const result = validateQuestionFirstPack(pack);
      expect(result.valid).toBe(true);
      expect(pack.questions).toHaveLength(140);
      expect(new Set(pack.questions.map((question) => question.id)).size).toBe(140);
      expect(new Set(pack.questions.map((question) => question.contextFamily)).size).toBe(140);
      expect(pack.sourceReconciliation.newQuestions).toBe(100);
      expect(pack.publicationStatus).toBe('STAGING');
      expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
      expect(result.counts.PROBE).toBeGreaterThanOrEqual(10);
      expect(result.counts.PRACTICE).toBeGreaterThanOrEqual(40);
      expect(result.counts.TRANSFER).toBeGreaterThanOrEqual(24);
    }
  });
});
