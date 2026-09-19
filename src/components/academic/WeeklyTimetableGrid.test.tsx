// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AcademicDateStatus } from '../../lib/academicCalendarStatus';
import type { TimetableEntryRow } from '../../services/timetableService';
import WeeklyTimetableGrid from './WeeklyTimetableGrid';

const entry: TimetableEntryRow = {
  id: 'entry-1',
  institution_id: 'institution-1',
  subject_offering_id: 'offering-1',
  class_id: 'class-1',
  academic_year_id: 'year-1',
  term_id: 'term-1',
  subject_id: 'subject-1',
  teacher_profile_id: 'teacher-1',
  room_id: 'room-1',
  room_name: 'Sala 01',
  day_of_week: 1,
  day_label: 'Segunda',
  start_time: '07:00',
  end_time: '07:50',
  active: true,
  class_name: '1º A',
  subject_name: 'Matemática',
  teacher_name: 'Prof. Teste',
};

const openStatus: AcademicDateStatus = {
  date: '2026-09-07',
  state: 'OPEN',
  blocked: false,
  blockers: [],
};

describe('WeeklyTimetableGrid', () => {
  it('conta somente as aulas projetadas na semana atual', () => {
    render(
      <WeeklyTimetableGrid
        entries={[entry, { ...entry, id: 'entry-2', day_of_week: 5 }]}
        occurrences={[{
          date: '2026-09-07',
          entry,
          state: 'SCHEDULED',
          calendarStatus: openStatus,
        }]}
        weekStartDate="2026-09-07"
        scheduleBreaks={[]}
        audience="teacher"
      />,
    );

    expect(screen.getByTestId('timetable-total-lessons').textContent).toBe('1 aula');
  });
});
