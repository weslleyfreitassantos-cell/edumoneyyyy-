import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const packagePath = 'content/bncc/authoring/early-childhood-experiential-v3.json';

describe('Early Childhood EI03CG01 experiential evidence package', () => {
  it('keeps EI03CG01 source-linked, inclusive, observational and unpublished', () => {
    const pack = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    expect(pack.officialCode).toBe('EI03CG01');
    expect(pack.descriptor).toBe('Criar com o corpo formas diversificadas de expressão de sentimentos, sensações e emoções, tanto nas situações do cotidiano quanto em brincadeiras, dança, teatro, música.');
    expect(pack.officialSource.page).toBe(49);
    expect(pack.evidenceMode).toBe('EDUCATOR_MEDIATED_OBSERVATION');
    expect(pack.contentStatus.studentQuiz).toBe('NOT_CREATED');
    expect(pack.contentStatus.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.contentStatus.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.learningDesign.observationCriteria.length).toBeGreaterThanOrEqual(5);
    expect(pack.learningDesign.adaptations.join(' ')).toContain('comunicação alternativa');
    expect(pack.learningDesign.evidenceRecord.privacy).toContain('não expor');
  });
});
