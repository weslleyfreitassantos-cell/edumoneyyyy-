import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

describe('Wave 6 V12 successive percentage expansion', () => {
  it('adds a staged calculation batch with updated-base progression', () => {
    const pack = JSON.parse(fs.readFileSync('content/adaptive/tec-escola-core-v5/v12-math-successive-percent-change-expansion-v12.json', 'utf8'));
    const result = validateQuestionFirstPack(pack);
    expect(result.valid).toBe(true);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(pack.sourceReconciliation.reusedQuestionsCountedAsNew).toBe(false);
    expect(pack.contentVersion).toBe(12);
    expect(pack.questions.filter((question) => question.id.startsWith('v12-')).length).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(pack.questions.length);
    expect(new Set(pack.questions.map((question) => question.contextFamily)).size).toBe(pack.questions.length);
    expect(pack.lesson.explanation).toContain('fator multiplicativo');
    expect(pack.questions.some((question) => question.statement.includes('recuperação'))).toBe(true);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });
});
