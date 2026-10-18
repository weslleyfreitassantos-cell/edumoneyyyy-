import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const packagePath = 'content/bncc/authoring/early-childhood-experiential-v1.json';

describe('Early Childhood experiential evidence package', () => {
  it('keeps EI01CG01 observational and unpublished', () => {
    const pack = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    expect(pack.officialCode).toBe('EI01CG01');
    expect(pack.evidenceMode).toBe('EDUCATOR_MEDIATED_OBSERVATION');
    expect(pack.contentStatus.studentQuiz).toBe('NOT_CREATED');
    expect(pack.contentStatus.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.contentStatus.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.learningDesign.observationCriteria.length).toBeGreaterThanOrEqual(3);
  });
});
