// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { TimetableEntryRow } from '../../services/timetableService';
import type { TimetableOccurrence } from '../../lib/academic/timetableOccurrences';
import WeeklyTimetableGrid from './WeeklyTimetableGrid';

const firstLesson = {
  id: 'lesson-1',
  institution_id: 'institution-1',
  subject_offering_id: 'offering-1',
  class_id: 'class-1',
  academic_year_id: 'year-1',
  term_id: 'term-1',
  subject_id: 'subject-1',
  teacher_profile_id: 'teacher-1',
  room_id: null,
  room_name: null,
  day_of_week: 1,
  day_label: 'Segunda',
  start_time: '07:00:00',
  end_time: '07:50:00',
  active: true,
  class_name: '1º A',
  subject_name: 'Matemática',
  teacher_name: 'Prof. Ana',
} satisfies TimetableEntryRow;

const secondLesson: TimetableEntryRow = {
  ...firstLesson,
  id: 'lesson-2',
  subject_offering_id: 'offering-2',
  subject_name: 'Ciências',
  start_time: '07:50:00',
  end_time: '08:40:00',
};

afterEach(() => cleanup());

describe('WeeklyTimetableGrid', () => {
  it('conta somente as aulas projetadas na semana, sem somar pausas', () => {
    const occurrence = {
      date: '2026-09-14',
      entry: firstLesson,
      state: 'SCHEDULED',
      calendarStatus: {},
    } as TimetableOccurrence;

    render(
      <WeeklyTimetableGrid
        entries={[firstLesson, secondLesson]}
        occurrences={[occurrence]}
        scheduleBreaks={[
          {
            id: 'break-1',
            name: 'Intervalo',
            day_of_week: 1,
            start_time: '10:30:00',
            end_time: '10:50:00',
          },
        ]}
        audience="student"
        weekStartDate="2026-09-14"
      />,
    );

    expect(screen.getAllByText('1 aula')).toHaveLength(2);
    expect(screen.getByText('Intervalo')).toBeTruthy();
    expect(screen.queryByText('Ciências')).toBeNull();
  });

  it('mantém horário fixo e dias dentro de uma área rolável acessível', () => {
    render(
      <WeeklyTimetableGrid
        entries={[firstLesson]}
        scheduleBreaks={[]}
        audience="student"
      />,
    );

    const scrollRegion = screen.getByRole('region', { name: /Grade semanal de horários/ });
    const timeColumn = screen.getByRole('rowheader');

    expect(scrollRegion.className).toContain('overflow-x-auto');
    expect(scrollRegion.getAttribute('tabindex')).toBe('0');
    expect(timeColumn.className).toContain('sticky');
    expect(timeColumn.className).toContain('left-0');
    expect(timeColumn.className).toContain('bg-[#fbfcfe]');
  });
});
