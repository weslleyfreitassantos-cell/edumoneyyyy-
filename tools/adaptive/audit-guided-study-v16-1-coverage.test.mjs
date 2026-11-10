import { describe, expect, it } from 'vitest';

import { buildGuidedStudyV16_1Coverage } from './audit-guided-study-v16-1-coverage.mjs';

describe('guided-study V16.1 coverage audit', () => {
  const report = buildGuidedStudyV16_1Coverage();

  it('covers the twelve traditional high-school disciplines without promoting area-wide bindings', () => {
    expect(report.subjects).toHaveLength(12);
    expect(report.summary.exactV16BoundSubjects).toBe(2);
    expect(report.subjects.filter((subject) => subject.exactV16OfficialBinding).map((subject) => subject.subjectCode).sort())
      .toEqual(['FIS', 'MAT']);
    expect(report.subjects.find((subject) => subject.subjectCode === 'ART')?.exactV16OfficialBinding).toBeNull();
    expect(report.bnccAlignment).toBe('NOT_CLAIMED_BY_CORE_PACK');
  });

  it('distinguishes high-school assets from foundational-only material', () => {
    expect(report.subjects.filter((subject) => subject.v4HighSchoolGradeOneCandidates.length > 0)
      .map((subject) => subject.subjectCode).sort()).toEqual(['BIO', 'FIL', 'FIS', 'QUI', 'SOC']);
    expect(report.subjects.find((subject) => subject.subjectCode === 'ART')?.v4HighSchoolGradeOneCandidates).toEqual([]);
  });

  it('does not call content runtime-eligible without a complete lesson, all adaptive purposes and human review', () => {
    expect(report.humanPedagogicalReview).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(report.summary.coreRuntimeEligibleCandidates).toBe(0);
    expect(report.subjects.flatMap((subject) => subject.v4HighSchoolGradeOneCandidates)
      .every((candidate) => !candidate.lessonComplete)).toBe(true);
  });
});
