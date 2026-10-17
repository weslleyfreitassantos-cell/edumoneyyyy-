import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const packagePath = 'content/bncc/authoring/early-childhood-experiential-v5.json';

describe('Early Childhood EI01CG03 experiential evidence package', () => {
  it('keeps EI01CG03 source-linked, inclusive and unpublished', () => {
    const pack = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    expect(pack.officialCode).toBe('EI01CG03');
    expect(pack.descriptor).toBe('Imitar gestos e movimentos de outras crianças, adultos e animais.');
    expect(pack.officialSource.page).toBe(49);
    expect(pack.sourceStatus).toBe('OFFICIAL_SOURCE_VERIFIED_EXACT');
    expect(pack.evidenceMode).toBe('EDUCATOR_MEDIATED_OBSERVATION');
    expect(pack.contentStatus.studentQuiz).toBe('NOT_CREATED');
    expect(pack.contentStatus.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.contentStatus.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.contentStatus.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.learningDesign.observationCriteria.length).toBeGreaterThanOrEqual(5);
    expect(pack.learningDesign.adaptations.join(' ')).toContain('comunicação alternativa');
    expect(pack.learningDesign.evidenceRecord.privacy).toContain('não expor');
  });
});
