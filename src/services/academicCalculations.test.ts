import { describe, it, expect } from 'vitest';
import {
  calculateEffectiveTermResult,
  calculateRecoveryPercentage,
  calculateTermGradePercentage,
  calculateTermAttendancePercentage,
  calculateTermResultStatus,
  isRecoveryEligible,
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

  describe('academic recovery', () => {
    it('calculates recovery as a bounded percentage', () => {
      expect(calculateRecoveryPercentage(75, 100, 1)).toBe(75);
      expect(calculateRecoveryPercentage(7.5, 10, 1)).toBe(75);
      expect(calculateRecoveryPercentage(101, 100)).toBeNull();
      expect(calculateRecoveryPercentage(1, 0)).toBeNull();
    });

    it('only considers grade-related failures eligible', () => {
      expect(isRecoveryEligible('FAILED_BY_GRADE')).toBe(true);
      expect(isRecoveryEligible('FAILED_BY_GRADE_AND_ATTENDANCE')).toBe(true);
      expect(isRecoveryEligible('APPROVED')).toBe(false);
      expect(isRecoveryEligible('FAILED_BY_ATTENDANCE')).toBe(false);
      expect(isRecoveryEligible('PENDING')).toBe(false);
    });

    it('composes a higher recovery without changing attendance', () => {
      const result = calculateEffectiveTermResult(policy, 50, 75, 90);

      expect(result).toMatchObject({
        originalGradePercentage: 50,
        recoveryPercentage: 75,
        finalGradePercentage: 75,
        attendancePercentage: 90,
        originalResultStatus: 'FAILED_BY_GRADE',
        resultStatus: 'APPROVED',
        compositionRule: 'HIGHEST_SCORE_V1',
      });
    });

    it('never lets recovery reduce a grade and preserves attendance failure', () => {
      const lower = calculateEffectiveTermResult(policy, 58, 45, 90);
      const attendanceFailure = calculateEffectiveTermResult(policy, 50, 80, 60);

      expect(lower.finalGradePercentage).toBe(58);
      expect(lower.resultStatus).toBe('FAILED_BY_GRADE');
      expect(attendanceFailure.finalGradePercentage).toBe(80);
      expect(attendanceFailure.resultStatus).toBe('FAILED_BY_ATTENDANCE');
    });

    it('does not apply draft/canceled or ineligible recovery values', () => {
      expect(calculateEffectiveTermResult(policy, 80, 40, 90).recoveryPercentage).toBeNull();
      expect(calculateEffectiveTermResult(policy, 50, null, 90).finalGradePercentage).toBe(50);
    });
  });
});
