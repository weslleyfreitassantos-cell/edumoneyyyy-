import { describe, expect, it } from 'vitest';

import {
  getTimetableNowOffsetPercent,
  getTimetableNowSnapshot,
  isTimetableTimeWithinRange,
} from './timetableNow';

describe('timetable now', () => {
  it('maps local date and Monday-based day without timezone conversion', () => {
    const snapshot = getTimetableNowSnapshot(new Date(2026, 8, 14, 7, 25));

    expect(snapshot).toEqual({
      date: '2026-09-14',
      dayOfWeek: 1,
      minutes: 445,
      timeLabel: '07:25',
    });
  });

  it('uses an inclusive start and exclusive end for lessons and breaks', () => {
    expect(isTimetableTimeWithinRange(420, '07:00', '07:50')).toBe(true);
    expect(isTimetableTimeWithinRange(470, '07:00', '07:50')).toBe(false);
    expect(isTimetableTimeWithinRange(630, '10:30', '10:50')).toBe(true);
    expect(isTimetableTimeWithinRange(650, '10:30', '10:50')).toBe(false);
  });

  it('returns a visual position only while the current block is active', () => {
    expect(getTimetableNowOffsetPercent(420, '07:00', '07:50')).toBe(0);
    expect(getTimetableNowOffsetPercent(445, '07:00', '07:50')).toBe(50);
    expect(getTimetableNowOffsetPercent(419, '07:00', '07:50')).toBeNull();
    expect(getTimetableNowOffsetPercent(470, '07:00', '07:50')).toBeNull();
    expect(getTimetableNowOffsetPercent(900, '07:00', '07:50')).toBeNull();
  });

  it('keeps the civil date aligned when the displayed week changes', () => {
    expect(getTimetableNowSnapshot(new Date(2026, 8, 15, 7, 25)).date).toBe('2026-09-15');
  });
});
