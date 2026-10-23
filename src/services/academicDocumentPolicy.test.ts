import { describe, expect, it } from 'vitest';

import type { AcademicDocumentEnrollment } from './academicDocumentService';
import type { ReportCardSubjectResult } from './reportCardService';
import {
  buildCompleteAttendanceDeclaration,
  findPreviousAcademicEnrollment,
} from './academicDocumentPolicy';

const enrollment = (overrides: Partial<AcademicDocumentEnrollment> = {}): AcademicDocumentEnrollment => ({
  id: 'enrollment-current',
  classId: 'class-current',
  className: '3º A',
  gradeLevel: '3º ano',
  shift: 'Matutino',
  academicYearId: 'year-2026',
  academicYearName: '2026',
  status: 'ACTIVE',
  active: true,
  enrolledAt: '2026-02-01',
  ...overrides,
});

const result = (overrides: Partial<ReportCardSubjectResult> = {}): ReportCardSubjectResult => ({
  key: 'offering-1:term-1',
  institutionId: 'institution-1',
  academicYearId: 'year-2026',
  academicYearName: '2026',
  termId: 'term-1',
  termName: '1º bimestre',
  subjectOfferingId: 'offering-1',
  subjectName: 'Português',
  subjectCode: 'LP',
  className: '3º A',
  teacherName: 'Docente',
  teacherEmail: '',
  gradePercentage: 80,
  recoveryPercentage: null,
  finalGradePercentage: 80,
  originalResultStatus: 'APPROVED',
  compositionRule: null,
  attendancePercentage: 95,
  resultStatus: 'APPROVED',
  finalizedAt: '2026-05-01T10:00:00Z',
  isClosed: true,
  assessments: [],
  ...overrides,
});

describe('academic document safeguards', () => {
  it('blocks attendance declarations until every expected subject-term has a finalized percentage', () => {
    const expected = [
      { subjectOfferingId: 'offering-1', termId: 'term-1', subjectName: 'Português', termName: '1º bimestre' },
      { subjectOfferingId: 'offering-2', termId: 'term-1', subjectName: 'Matemática', termName: '1º bimestre' },
    ];

    expect(buildCompleteAttendanceDeclaration(expected, [result()], 'year-2026')).toMatchObject({
      complete: false,
      missingCount: 1,
    });
    expect(buildCompleteAttendanceDeclaration(expected, [
      result(),
      result({
        key: 'offering-2:term-1',
        subjectOfferingId: 'offering-2',
        subjectName: 'Matemática',
      }),
    ], 'year-2026')).toMatchObject({
      complete: true,
      missingCount: 0,
      rows: [
        { subjectName: 'Português', attendancePercentage: 95 },
        { subjectName: 'Matemática', attendancePercentage: 95 },
      ],
    });
  });

  it('ignores open, missing-percentage, and other-year results', () => {
    const expected = [{
      subjectOfferingId: 'offering-1',
      termId: 'term-1',
      subjectName: 'Português',
      termName: '1º bimestre',
    }];
    const variants = [
      result({ isClosed: false }),
      result({ attendancePercentage: null }),
      result({ academicYearId: 'year-2025' }),
    ];
    for (const item of variants) {
      expect(buildCompleteAttendanceDeclaration(expected, [item], 'year-2026').complete).toBe(false);
    }
  });

  it('recognizes persisted re-enrollment only when an earlier academic year is verifiable', () => {
    const current = enrollment();
    expect(findPreviousAcademicEnrollment(current, [
      current,
      enrollment({ id: 'enrollment-2025', academicYearId: 'year-2025', academicYearName: 'Ano letivo 2025' }),
    ])?.id).toBe('enrollment-2025');
    expect(findPreviousAcademicEnrollment(current, [
      current,
      enrollment({ id: 'same-year', academicYearId: 'another-year-2026', academicYearName: '2026' }),
    ])).toBeNull();
    expect(findPreviousAcademicEnrollment(null, [])).toBeNull();
  });
});
