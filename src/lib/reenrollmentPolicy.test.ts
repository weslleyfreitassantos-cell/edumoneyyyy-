import { describe, expect, it } from 'vitest';

import {
  isReenrollmentGradeEligible,
  resolveReenrollmentAcademicDecision,
} from './reenrollmentPolicy';

describe('reenrollmentPolicy', () => {
  it('keeps a pending annual result pending', () => {
    expect(resolveReenrollmentAcademicDecision({ finalResult: 'PENDING' })).toBe('PENDING');
  });

  it('does not promote a student while recovery is pending', () => {
    expect(resolveReenrollmentAcademicDecision({ finalResult: 'FAILED', recoveryPending: true })).toBe('RECOVERY');
  });

  it('honors a class council decision over the calculated result', () => {
    expect(resolveReenrollmentAcademicDecision({ finalResult: 'APPROVED', councilDecision: 'RETAIN' })).toBe('RETAINED');
    expect(resolveReenrollmentAcademicDecision({ finalResult: 'FAILED', councilDecision: 'TRANSFER' })).toBe('TRANSFERRED');
  });

  it('matches grade eligibility without depending on casing', () => {
    expect(isReenrollmentGradeEligible('  8º ano ', ['8º ANO'])).toBe(true);
    expect(isReenrollmentGradeEligible('9º ano', ['8º ano'])).toBe(false);
    expect(isReenrollmentGradeEligible('9º ano', [])).toBe(true);
  });
});
