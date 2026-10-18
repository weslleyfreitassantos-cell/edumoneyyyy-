import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const packagePath = 'content/bncc/authoring/early-childhood-experiential-v2.json';

describe('Early Childhood EI02CG01 experiential evidence package', () => {
  it('keeps EI02CG01 culturally responsive, observational and unpublished', () => {
    const pack = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    expect(pack.officialCode).toBe('EI02CG01');
    expect(pack.descriptor).toBe('Apropriar-se de gestos e movimentos de sua cultura no cuidado de si e nos jogos e brincadeiras.');
    expect(pack.officialSource.page).toBe(49);
    expect(pack.evidenceMode).toBe('EDUCATOR_MEDIATED_OBSERVATION');
    expect(pack.contentStatus.studentQuiz).toBe('NOT_CREATED');
    expect(pack.contentStatus.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.contentStatus.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.learningDesign.observationCriteria.length).toBeGreaterThanOrEqual(4);
    expect(pack.learningDesign.evidenceRecord.privacy).toContain('não expor');
  });
});
