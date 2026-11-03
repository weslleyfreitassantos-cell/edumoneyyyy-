import { describe, expect, it } from 'vitest';
import { buildPedagogicalReview } from './review-pedagogical-content-v5.mjs';

describe('question-first V5 pedagogical review', () => {
  it('approves only complete packs and keeps incomplete packs blocked', () => {
    const report = buildPedagogicalReview({ reviewedAt: '2026-11-03T00:00:00.000Z' });

    expect(report.summary).toEqual({
      reviewed: 113,
      pedagogicallyApproved: 105,
      heldForRepair: 8,
      publishableByCurrentStudentGate: 0,
    });
    expect(report.entries.filter((entry) => entry.issues.length === 0)).toHaveLength(105);
    expect(report.entries.filter((entry) => entry.issues.length > 0).map((entry) => entry.contentId)).toEqual([
      'v5-art-character-experiment',
      'v5-biology-cell-function',
      'v5-biology-inheritance',
      'v5-chemistry-atomic-structure',
      'v5-chemistry-stoichiometry',
      'pe-distinguish-activity-exercise',
      'pe-plan-safe-activity',
      'v5-physics-average-speed',
    ]);
  });

  it('does not authorize a content pack just because the rubric passed', () => {
    const report = buildPedagogicalReview({ reviewedAt: '2026-11-03T00:00:00.000Z' });
    const approved = report.entries.find((entry) => entry.issues.length === 0);

    expect(approved.publicationDecision).toBe('HOLD_FOR_OFFICIAL_MAPPING');
    expect(report.publicationPolicy.sourceFilesWereNotMutated).toBe(true);
  });
});
