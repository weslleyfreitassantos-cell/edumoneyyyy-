import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const packagePath = 'content/bncc/authoring/early-childhood-experiential-v6.json';

describe('Early Childhood EI01CG04 experiential evidence package', () => {
  it('keeps EI01CG04 source-linked, care-responsive and unpublished', () => {
    const pack = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    expect(pack.officialCode).toBe('EI01CG04');
    expect(pack.descriptor).toBe('Participar do cuidado do seu corpo e da promoção do seu bem-estar.');
    expect(pack.officialSource.page).toBe(49);
    expect(pack.sourceStatus).toBe('OFFICIAL_SOURCE_VERIFIED_EXACT');
    expect(pack.evidenceMode).toBe('EDUCATOR_MEDIATED_OBSERVATION');
    expect(pack.contentStatus.studentQuiz).toBe('NOT_CREATED');
    expect(pack.contentStatus.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.contentStatus.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.contentStatus.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.learningDesign.observationCriteria.length).toBeGreaterThanOrEqual(5);
    expect(pack.learningDesign.evidenceRecord.allowedFormats).not.toContain('secure_photo_reference');
    expect(pack.learningDesign.evidenceRecord.privacy).toContain('não registrar imagens');
  });
});
