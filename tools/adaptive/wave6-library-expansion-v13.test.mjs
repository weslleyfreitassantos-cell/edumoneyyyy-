import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

describe('Wave 6 V13 population-data expansion', () => {
  it('adds a staged evidence-and-sampling batch without claiming causal proof', () => {
    const pack = JSON.parse(fs.readFileSync('content/adaptive/tec-escola-core-v5/v13-biology-population-data-expansion-v13.json', 'utf8'));
    const result = validateQuestionFirstPack(pack);
    expect(result.valid).toBe(true);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(pack.sourceReconciliation.reusedQuestionsCountedAsNew).toBe(false);
    expect(pack.contentVersion).toBe(13);
    expect(pack.questions.filter((question) => question.id.startsWith('v13-')).length).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(pack.questions.length);
    expect(new Set(pack.questions.map((question) => question.contextFamily)).size).toBe(pack.questions.length);
    expect(pack.questions.some((question) => question.correctAnswer.includes('associação temporal'))).toBe(true);
    expect(pack.lesson.sourceDossier.length).toBeGreaterThan(0);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });
});
