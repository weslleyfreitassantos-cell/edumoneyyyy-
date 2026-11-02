import { describe, expect, it } from 'vitest';

import { auditSubject, buildAuditReport } from './audit-v4-content.mjs';

describe('adaptive V4 content audit', () => {
  it('reports structural defects without converting them into human approval', () => {
    const report = auditSubject('MATHEMATICS', [{ code: 'SKILL_1' }], [
      { id: 'lesson-1', skill: 'SKILL_1', objective: 'Objective', explanation: 'Explanation', workedExample: 'Example' },
    ], [
      { id: 'q-1', primarySkill: 'MISSING_SKILL', statement: 'Question?', options: ['A', 'A'], correctAnswer: 'B', purpose: 'PRACTICE' },
      { id: 'q-2', primarySkill: 'SKILL_1', statement: 'Question?', options: ['A', 'B'], correctAnswer: 'B', explanation: 'Reason', purpose: 'PRACTICE' },
    ]);

    expect(report.technicalStatus).toBe('ISSUES_FOUND');
    expect(report.pedagogicalReview).toBe('PENDING_HUMAN_REVIEW');
    expect(report.duplicateStems).toHaveLength(1);
    expect(report.questionIssues.map((issue) => issue.issue)).toEqual(expect.arrayContaining([
      'UNKNOWN_PRIMARY_SKILL', 'MISSING_EXPLANATION', 'DUPLICATE_OPTIONS', 'ANSWER_NOT_IN_OPTIONS',
    ]));
  });

  it('summarizes each subject and explicitly does not claim BNCC approval', async () => {
    const report = await buildAuditReport();
    expect(report.subjects).toHaveLength(15);
    expect(report.totals.skills).toBeGreaterThan(0);
    expect(report.totals.lessons).toBeGreaterThan(0);
    expect(report.totals.questions).toBeGreaterThan(0);
    expect(report.bnccMapping).toBe('NOT_CLAIMED_BY_SOURCE_PACK');
    expect(report.humanPedagogicalReview).toBe('PENDING');
  });
});
