import { describe, it, expect } from 'vitest';
import {
  calculateTermGradePercentage,
  calculateTermAttendancePercentage,
  calculateTermResultStatus,
} from './academicCalculations';

describe('academicCalculations', () => {
  const policy = {
    minimumGradePercentage: 60,
    minimumAttendancePercentage: 75,
    decimalPlaces: 2,
  };

  describe('calculateTermGradePercentage', () => {
    it('returns null if there are no grades', () => {
      const records: any[] = [];
      expect(calculateTermGradePercentage(records, 2)).toBeNull();
    });

    it('calculates weighted average properly', () => {
      const records: any[] = [
        { score: 8, maxScore: 10, weight: 2, gradeStatus: 'GRADED', assessmentStatus: 'CLOSED' },
        { score: 6, maxScore: 10, weight: 3, gradeStatus: 'GRADED', assessmentStatus: 'CLOSED' },
      ];

      // 8/10 = 0.8 * 100 * 2 = 160
      // 6/10 = 0.6 * 100 * 3 = 180
      // (160 + 180) / (2+3) = 340 / 5 = 68%
      expect(calculateTermGradePercentage(records, 2)).toBe(68);
    });
  });

  describe('calculateTermAttendancePercentage', () => {
    it('returns null if there are no records', () => {
      const records: any[] = [];
      expect(calculateTermAttendancePercentage(records, 2)).toBeNull();
    });

    it('calculates attendance properly', () => {
      const records: any[] = [
        { status: 'PRESENT' },
        { status: 'LATE' }, // LATE is counted as present
        { status: 'ABSENT' },
        { status: 'EXCUSED' }, // EXCUSED is not counted as present
      ];
      // total = 4
      // present = 2
      // 2 / 4 = 50%
      expect(calculateTermAttendancePercentage(records, 2)).toBe(50);
    });
  });

  describe('calculateTermResultStatus', () => {
    it('returns PENDING if grade or attendance is null', () => {
      expect(calculateTermResultStatus(policy, null, 80)).toBe('PENDING');
      expect(calculateTermResultStatus(policy, 80, null)).toBe('PENDING');
    });

    it('returns APPROVED if both are >= minimum', () => {
      expect(calculateTermResultStatus(policy, 60, 75)).toBe('APPROVED');
      expect(calculateTermResultStatus(policy, 100, 100)).toBe('APPROVED');
    });

    it('returns FAILED_BY_GRADE if grade < minimum and attendance >= minimum', () => {
      expect(calculateTermResultStatus(policy, 59, 75)).toBe('FAILED_BY_GRADE');
    });

    it('returns FAILED_BY_ATTENDANCE if grade >= minimum and attendance < minimum', () => {
      expect(calculateTermResultStatus(policy, 60, 74)).toBe('FAILED_BY_ATTENDANCE');
    });

    it('returns FAILED_BY_GRADE_AND_ATTENDANCE if both are < minimum', () => {
      expect(calculateTermResultStatus(policy, 59, 74)).toBe('FAILED_BY_GRADE_AND_ATTENDANCE');
    });
  });
});
