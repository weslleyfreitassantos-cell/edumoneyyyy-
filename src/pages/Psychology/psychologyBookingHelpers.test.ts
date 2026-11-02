// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  appointmentPastDueMessage,
  bookingAuthorizationMessage,
  getStudentBookingTarget,
} from './psychologyBookingHelpers';

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

  it('offers removal without rescheduling for an expired appointment that is still waiting', () => {
    expect(appointmentPastDueMessage({
      status: 'SCHEDULED',
      session_status: 'WAITING',
      ends_at: '2026-10-30T12:00:00.000Z',
    }, new Date('2026-10-30T13:00:00.000Z')))
      .toContain('excluir este agendamento');
    expect(appointmentPastDueMessage({
      status: 'SCHEDULED',
      session_status: 'WAITING',
      ends_at: '2026-10-30T12:00:00.000Z',
    }, new Date('2026-10-30T13:00:00.000Z')))
      .not.toContain('remarcar');
  });

  it('does not offer expired removal after a session has started or while it is upcoming', () => {
    expect(appointmentPastDueMessage({
      status: 'SCHEDULED',
      session_status: 'IN_PROGRESS',
      ends_at: '2026-10-30T12:00:00.000Z',
    }, new Date('2026-10-30T13:00:00.000Z'))).toBeNull();
    expect(appointmentPastDueMessage({
      status: 'SCHEDULED',
      session_status: 'WAITING',
      ends_at: '2026-10-30T14:00:00.000Z',
    }, new Date('2026-10-30T13:00:00.000Z'))).toBeNull();
  });
});
