// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { bookingAuthorizationMessage, getStudentBookingTarget } from './psychologyBookingHelpers';

function target(studentId: string, authorizationStatus: 'ACTIVE' | 'REVOKED' | 'NONE', isMinor = false) {
  return {
    student_id: studentId,
    student_name: studentId,
    is_minor: isMinor,
    authorization_status: authorizationStatus,
    is_signatory: true,
  } as const;
}

describe('psychology booking helpers', () => {
  it('prefers the actively authorized student when the response contains older registrations first', () => {
    const revoked = target('older-registration', 'REVOKED');
    const active = target('current-registration', 'ACTIVE');

    expect(getStudentBookingTarget([revoked, active])).toBe(active);
  });

  it('keeps a self-authorizing adult target available when there is no active consent', () => {
    const adult = target('adult-registration', 'NONE');
    expect(getStudentBookingTarget([adult])).toBe(adult);
  });

  it('explains that the school must link an eligible professional when the server denies booking access', () => {
    expect(bookingAuthorizationMessage({ code: 'NOT_AUTHORIZED' }, () => 'fallback'))
      .toContain('vincular uma profissional habilitada');
  });

  it('preserves other safe server error messages', () => {
    expect(bookingAuthorizationMessage({ code: 'SLOT_UNAVAILABLE' }, () => 'horário ocupado'))
      .toBe('horário ocupado');
  });
});
