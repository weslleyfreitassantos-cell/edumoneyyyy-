import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const packagePath = 'content/bncc/authoring/early-childhood-experiential-v4.json';

describe('Early Childhood EI01CG02 experiential evidence package', () => {
  it('keeps EI01CG02 source-linked, observational and unpublished', () => {
    const pack = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    expect(pack.officialCode).toBe('EI01CG02');
    expect(pack.descriptor).toBe('Experimentar as possibilidades corporais nas brincadeiras e interações em ambientes acolhedores e desafiantes.');
    expect(pack.officialSource.page).toBe(49);
    expect(pack.sourceStatus).toBe('OFFICIAL_SOURCE_VERIFIED_EXACT');
    expect(pack.evidenceMode).toBe('EDUCATOR_MEDIATED_OBSERVATION');
    expect(pack.contentStatus.studentQuiz).toBe('NOT_CREATED');
    expect(pack.contentStatus.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.contentStatus.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.contentStatus.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.learningDesign.observationCriteria.length).toBeGreaterThanOrEqual(5);
    expect(pack.learningDesign.adaptations.join(' ')).toContain('comunicação');
    expect(pack.learningDesign.evidenceRecord.privacy).toContain('não expor');
  });
});
