import { describe, expect, it } from 'vitest';

import { selectCurrentInclusiveProgressStudentIds } from './inclusiveEducationRoster';

describe('inclusive education progress roster', () => {
  it('includes only active PEI/AEE plans from current years and legacy plans with a current enrollment', () => {
    const studentIds = selectCurrentInclusiveProgressStudentIds(
      ['year-current'],
      [
        { student_id: 'student-current', academic_year_id: 'year-current', class_academic_year_id: 'year-current' },
        { student_id: 'student-legacy', academic_year_id: 'year-current', class_academic_year_id: 'year-current' },
        { student_id: 'student-mismatched-class', academic_year_id: 'year-current', class_academic_year_id: 'year-previous' },
      ],
      [
        { student_id: 'student-current', academic_year_id: 'year-current', status: 'ACTIVE' },
        { student_id: 'student-old', academic_year_id: 'year-previous', status: 'ACTIVE' },
        { student_id: 'student-legacy', academic_year_id: null, status: 'DRAFT' },
        { student_id: 'student-mismatched-class', academic_year_id: null, status: 'ACTIVE' },
        { student_id: 'student-unlinked', academic_year_id: null, status: 'ACTIVE' },
        { student_id: 'student-archived', academic_year_id: 'year-current', status: 'ARCHIVED' },
      ],
    );

    expect(studentIds).toEqual(['student-current', 'student-legacy']);
  });

  it('deduplicates students who have both a PEI and an AEE/PAEE plan', () => {
    const studentIds = selectCurrentInclusiveProgressStudentIds(
      ['year-current'],
      [],
      [
        { student_id: 'student-1', academic_year_id: 'year-current', status: 'ACTIVE' },
        { student_id: 'student-1', academic_year_id: 'year-current', status: 'DRAFT' },
      ],
    );

    expect(studentIds).toEqual(['student-1']);
  });
});
