import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(fs.readFileSync('content/adaptive/tec-escola-core-v5/humanities-evidence-arguments-hs-v8.json', 'utf8'));

describe('Humanities evidence HS V8 package', () => {
  it('keeps source context explicit and the argument journey inactive', () => {
    expect(pack.contentId).toBe('v8-humanities-evidence-arguments-hs');
    expect(pack.sourceContext.officialCode).toBe('EM13CHS103');
    expect(pack.sourceContext.relation).toBe('AUTHORING_CONTEXT_ONLY');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.questions).toHaveLength(40);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(40);
    expect(pack.questions.every((question) => question.options.length === 4 && question.options.includes(question.correctAnswer))).toBe(true);
    expect(pack.lesson.progressiveExplanation.length).toBeGreaterThanOrEqual(3);
    expect(pack.lesson.remediations.length).toBeGreaterThanOrEqual(2);
    expect(pack.lesson.progression.flatMap((stage) => stage.questionIds)).toEqual(pack.questions.map((question) => question.id));
  });
});
