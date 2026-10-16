import { describe, expect, it } from 'vitest';

import { buildCoverageSizingReport } from './build-coverage-sizing-report-v2.mjs';

describe('BNCC coverage sizing V2', () => {
  it('keeps audited facts separate from scenario estimates', () => {
    const report = buildCoverageSizingReport();
    expect(report.campaignId).toBe('TECESCOLA_BNCC_FULL_COVERAGE');
    expect(report.auditedFacts.officialNodes).toBe(1723);
    expect(report.auditedFacts.humanReviewedContent).toBe(0);
    expect(report.auditedFacts.studentAvailableNewContent).toBe(0);
    expect(report.estimates.minimum.questions).toBe(64760);
    expect(report.estimates.recommended.questions).toBe(129520);
    expect(report.estimates.extensive.questions).toBe(194280);
    expect(report.auditedFacts.exactSourceVerificationCodes).toEqual(['EI01CG01']);
  });

  it('uses experiential evidence for Early Childhood objectives', () => {
    const report = buildCoverageSizingReport();
    const infant = report.byStage.EDUCACAO_INFANTIL;
    expect(infant.developmentObjectives).toBe(104);
    expect(infant.minimum.questions).toBe(0);
    expect(infant.minimum.observationalExperiences).toBe(104);
    expect(report.scenarioRubric.developmentObjective.minimum.questions).toBe(0);
  });
});
