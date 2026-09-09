import { describe, expect, it } from 'vitest';

import {
  calendarDateKey,
  calendarEventDateKeys,
  formatCalendarEventDate,
  isCalendarEventUpcoming,
} from './academicCalendarDates';

describe('academicCalendarDates', () => {
  it('preserva uma data all-day como data civil independente do timezone', () => {
    expect(calendarDateKey('2026-09-15T00:00:00.000Z', true)).toBe('2026-09-15');
    expect(formatCalendarEventDate({
      startsAt: '2026-09-15T00:00:00.000Z',
      endsAt: null,
      allDay: true,
    })).toBe('15/09/2026 • Dia inteiro');
  });

  it('expande um evento all-day de forma inclusiva no calendário', () => {
    expect(calendarEventDateKeys({
      startsAt: '2026-07-10T00:00:00.000Z',
      endsAt: '2026-07-20T00:00:00.000Z',
      allDay: true,
    })).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
      '2026-07-20',
    ]);
  });

  it('formata ranges all-day e eventos com horário', () => {
    expect(formatCalendarEventDate({
      startsAt: '2026-07-10T00:00:00.000Z',
      endsAt: '2026-07-20T00:00:00.000Z',
      allDay: true,
    })).toBe('10/07/2026–20/07/2026 • Dia inteiro');
    expect(formatCalendarEventDate({
      startsAt: '2026-09-15T08:00:00.000Z',
      endsAt: '2026-09-15T10:00:00.000Z',
      allDay: false,
    })).toContain('–');
    expect(formatCalendarEventDate({
      startsAt: '2026-09-15T18:00:00.000Z',
      endsAt: '2026-09-16T08:00:00.000Z',
      allDay: false,
    })).toContain('→');
  });

  it('mantém evento em andamento e exclui evento encerrado do upcoming', () => {
    const now = new Date('2026-09-09T10:00:00.000Z').getTime();

    expect(isCalendarEventUpcoming({
      startsAt: '2026-09-08T08:00:00.000Z',
      endsAt: '2026-09-09T18:00:00.000Z',
      allDay: false,
    }, now)).toBe(true);
    expect(isCalendarEventUpcoming({
      startsAt: '2026-09-08T08:00:00.000Z',
      endsAt: '2026-09-09T09:00:00.000Z',
      allDay: false,
    }, now)).toBe(false);
  });

  it('mantém all-day de hoje durante todo o dia civil, inclusive sem fim', () => {
    const now = new Date('2026-09-15T10:00:00.000Z').getTime();

    expect(isCalendarEventUpcoming({
      startsAt: '2026-09-15T00:00:00.000Z',
      endsAt: null,
      allDay: true,
    }, now)).toBe(true);
    expect(isCalendarEventUpcoming({
      startsAt: '2026-09-14T00:00:00.000Z',
      endsAt: null,
      allDay: true,
    }, now)).toBe(false);
    expect(isCalendarEventUpcoming({
      startsAt: '2026-09-16T00:00:00.000Z',
      endsAt: null,
      allDay: true,
    }, now)).toBe(true);
    expect(isCalendarEventUpcoming({
      startsAt: '2026-09-10T00:00:00.000Z',
      endsAt: '2026-09-15T00:00:00.000Z',
      allDay: true,
    }, now)).toBe(true);
    expect(isCalendarEventUpcoming({
      startsAt: '2026-09-10T00:00:00.000Z',
      endsAt: '2026-09-14T00:00:00.000Z',
      allDay: true,
    }, now)).toBe(false);
  });
});
