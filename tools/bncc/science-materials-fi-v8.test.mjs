import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(fs.readFileSync('content/adaptive/tec-escola-core-v5/science-materials-conscious-use-fi-v8.json', 'utf8'));

describe('Science materials FI V8 package', () => {
  it('keeps the authored learning journey inactive and fully answerable', () => {
    expect(pack.contentId).toBe('v8-science-materials-conscious-use-fi');
    expect(pack.sourceContext.officialCode).toBe('EF01CI01');
    expect(pack.sourceContext.relation).toBe('AUTHORING_CONTEXT_ONLY');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.questions).toHaveLength(40);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(40);
    expect(pack.questions.every((question) => question.options.length === 4 && question.options.includes(question.correctAnswer))).toBe(true);
    expect(pack.questions.every((question) => question.hint && question.errorFocus && question.explanation)).toBe(true);
    expect(pack.lesson.progressiveExplanation.length).toBeGreaterThanOrEqual(3);
    expect(pack.lesson.remediations.length).toBeGreaterThanOrEqual(2);
    expect(pack.lesson.progression.flatMap((stage) => stage.questionIds)).toEqual(pack.questions.map((question) => question.id));
  });
});
