import { describe, expect, it } from 'vitest';

import { attendanceKeys } from './useAttendance';

describe('attendance query keys', () => {
  it('distingue slots diferentes da mesma offering e data', () => {
    const morningSlot = attendanceKeys.rollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
      {
        startTime: '07:00:00',
        endTime: '07:50:00',
      },
    );
    const secondSlot = attendanceKeys.rollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
      {
        startTime: '08:00:00',
        endTime: '08:50:00',
      },
    );

    expect(morningSlot).not.toEqual(secondSlot);
  });
});
