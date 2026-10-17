import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

describe('Wave 6 V11 art composition expansion', () => {
  it('adds a staged visual-evidence batch without exposing unsupported conclusions', () => {
    const pack = JSON.parse(fs.readFileSync('content/adaptive/tec-escola-core-v5/v11-art-compare-compositions-expansion-v11.json', 'utf8'));
    const result = validateQuestionFirstPack(pack);
    expect(result.valid).toBe(true);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(pack.sourceReconciliation.reusedQuestionsCountedAsNew).toBe(false);
    expect(pack.contentVersion).toBe(11);
    expect(pack.questions.filter((question) => question.id.startsWith('v11-')).length).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(pack.questions.length);
    expect(new Set(pack.questions.map((question) => question.contextFamily)).size).toBe(pack.questions.length);
    const visualQuestions = pack.questions.filter((question) => question.visualStimulus);
    expect(visualQuestions.length).toBeGreaterThanOrEqual(10);
    expect(visualQuestions.every((question) => question.visualStimulus.items.every((item) => item.src && item.alt))).toBe(true);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });
});
