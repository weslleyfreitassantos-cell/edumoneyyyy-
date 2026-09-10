import { describe, expect, it } from 'vitest';

import {
  getAcademicTermForDate,
  getLocalDateInputValue,
  isAcademicTermDateWithinRange,
} from './academicTermDates';
import {
  getDateForAttendancePeriod,
  isAttendanceDateWithinPeriod,
} from '../components/attendance/attendanceDisplay';

const terms = [
  {
    id: 'term-1',
    startDate: '2026-01-10',
    endDate: '2026-04-02',
    active: true,
  },
  {
    id: 'term-2',
    startDate: '2026-04-03',
    endDate: '2026-06-25',
    active: true,
  },
  {
    id: 'term-3',
    startDate: '2026-06-26',
    endDate: '2026-09-17',
    active: true,
  },
  {
    id: 'term-4',
    startDate: '2026-09-18',
    endDate: '2026-12-10',
    active: true,
  },
];

describe('academicTermDates', () => {
  it('seleciona o período vigente pelas datas civis inclusivas', () => {
    expect(getAcademicTermForDate(terms, '2026-06-25')?.id).toBe('term-2');
    expect(getAcademicTermForDate(terms, '2026-06-26')?.id).toBe('term-3');
    expect(getAcademicTermForDate(terms, '2026-09-09')?.id).toBe('term-3');
    expect(getAcademicTermForDate(terms, '2026-09-17')?.id).toBe('term-3');
    expect(getAcademicTermForDate(terms, '2026-09-18')?.id).toBe('term-4');
  });

  it('mantém a data civil local sem converter para UTC', () => {
    const localDate = new Date(2026, 8, 9, 23, 30);

    expect(getLocalDateInputValue(localDate)).toBe('2026-09-09');
  });

  it('não exibe o aviso de fora do período quando hoje está no bimestre', () => {
    expect(
      isAttendanceDateWithinPeriod(
        '2026-09-09',
        '2026-06-26',
        '2026-09-17',
      ),
    ).toBe(true);
    expect(
      getDateForAttendancePeriod(
        '2026-09-09',
        '2026-06-26',
        '2026-09-17',
      ),
    ).toBe('2026-09-09');
  });

  it('não considera datas fora dos limites do período', () => {
    expect(
      isAcademicTermDateWithinRange(
        '2026-06-25',
        '2026-06-26',
        '2026-09-17',
      ),
    ).toBe(false);
    expect(
      isAcademicTermDateWithinRange(
        '2026-09-18',
        '2026-06-26',
        '2026-09-17',
      ),
    ).toBe(false);
  });
});
