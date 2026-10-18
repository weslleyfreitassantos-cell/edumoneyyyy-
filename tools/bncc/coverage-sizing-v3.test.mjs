import { describe, expect, it } from 'vitest';
import { buildCoverageSizingReportV3, scoreNode } from './build-coverage-sizing-report-v3.mjs';

describe('BNCC coverage sizing v3', () => {
  it('uses evidence dimensions instead of one uniform question count', () => {
    const report = buildCoverageSizingReportV3();
    const history = report.nodeSizing.find((node) => node.officialCode === 'EF06HI01');
    const earlyChildhood = report.nodeSizing.find((node) => node.officialCode === 'EI01CG01');
    expect(report.auditedFacts.officialNodes).toBe(1723);
    expect(report.auditedFacts.mappingStatuses).toEqual({ CANONICAL_GAP: 1496, HIERARCHY_ONLY: 104, HUMAN_REVIEW_BLOCKED: 121, MAPPED: 2 });
    expect(history.pedagogicalMinimumQuestions).toBeGreaterThan(history.technicalMinimumQuestions);
    expect(history.recommendedLibraryQuestions).toBeGreaterThan(history.pedagogicalMinimumQuestions);
    expect(earlyChildhood.technicalMinimumQuestions).toBe(0);
    expect(earlyChildhood.observationalExperiences).toBeGreaterThan(0);
  });

  it('keeps a simpler descriptor below a descriptor with more operations', () => {
    const simple = scoreNode({ kind: 'SKILL', gradeOrRange: '01', officialTextExcerpt: 'Identificar uma forma e reconhecer uma sequência.' });
    const complex = scoreNode({ kind: 'SKILL', gradeOrRange: '09', officialTextExcerpt: 'Investigar, comparar, analisar e explicar processos, condições, fontes e evidências em diferentes contextos.' });
    expect(complex.pedagogicalMinimumQuestions).toBeGreaterThan(simple.pedagogicalMinimumQuestions);
  });
});
