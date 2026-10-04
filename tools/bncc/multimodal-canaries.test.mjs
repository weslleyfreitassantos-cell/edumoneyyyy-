import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const canaries = JSON.parse(readFileSync('content/bncc/canaries/multimodal-v1.json', 'utf8'));

describe('BNCC multimodal canary gate', () => {
  it('covers objective, constructed, observational, practical and computational modes', () => {
    const modes = new Set(canaries.canaries.map((canary) => canary.mode));
    expect(modes).toEqual(new Set([
      'OBJECTIVE',
      'CONSTRUCTED',
      'OBSERVATIONAL',
      'PRACTICAL_OBSERVATIONAL_CONSTRUCTED',
      'OBJECTIVE_COMPUTATIONAL',
    ]));
  });

  it('keeps pedagogical review pending and blocks scale-out', () => {
    expect(canaries.technicalReviewStatus).toBe('TECH_VALIDATED');
    expect(canaries.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(canaries.gate.massAuthoringAllowed).toBe(false);
  });

  it('does not turn early-childhood observation into a child quiz', () => {
    const canary = canaries.canaries.find((item) => item.mode === 'OBSERVATIONAL');
    expect(canary.content.childQuiz).toBe(false);
    expect(canary.content.observationCriteria.length).toBeGreaterThanOrEqual(3);
  });
});
