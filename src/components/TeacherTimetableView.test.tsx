// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSchoolScheduleBreaks } from '../hooks/useAcademicTermClosing';
import {
  useTeacherTimetable,
  useTimetableCalendarStatuses,
} from '../hooks/useTimetable';
import { getLocalDateInputValue } from '../lib/academicTermDates';
import {
  getDateForWeekDay,
  getWeekStartDateKey,
  timetableCalendarRequestKey,
} from '../lib/academic/timetableOccurrences';
import TeacherTimetableView from './TeacherTimetableView';

vi.mock('../hooks/useAcademicTermClosing', () => ({
  useSchoolScheduleBreaks: vi.fn(),
}));

vi.mock('../hooks/useTimetable', () => ({
  useTeacherTimetable: vi.fn(),
  useTimetableCalendarStatuses: vi.fn(),
}));

const entry = {
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

const weekStartDate = getWeekStartDateKey(getLocalDateInputValue());
const mondayDate = getDateForWeekDay(weekStartDate, 1);
const statusKey = timetableCalendarRequestKey(
  {
    institutionId: entry.institution_id,
    academicYearId: entry.academic_year_id,
    classId: entry.class_id,
    subjectId: entry.subject_id,
  },
  mondayDate,
);

function mockDefaultState() {
  vi.mocked(useTeacherTimetable).mockReturnValue({
    data: [entry],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useSchoolScheduleBreaks).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useTimetableCalendarStatuses).mockReturnValue({
    data: {
      [statusKey]: {
        date: mondayDate,
        state: 'BLOCKED',
        blocked: true,
        blockers: [{ event_id: 'holiday-1', event_type: 'HOLIDAY' }],
      },
    },
    isLoading: false,
    isError: false,
    error: null,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDefaultState();
});

afterEach(() => {
  cleanup();
});

describe('TeacherTimetableView', () => {
  it('exibe a aula suspensa na data concreta com o motivo do calendário', () => {
    render(
      <TeacherTimetableView
        institutionId="institution-1"
        teacherProfileId="teacher-1"
        termId="term-1"
        termName="1º Bimestre"
        shifts={[]}
      />,
    );

    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByText('Aula suspensa')).toBeTruthy();
    expect(screen.getByText('Feriado')).toBeTruthy();
    expect(screen.getByText('1º A')).toBeTruthy();
  });

  it('mantém a aula visível e informa a falha de calendário', () => {
    vi.mocked(useTimetableCalendarStatuses).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('calendar unavailable'),
    } as never);

    render(
      <TeacherTimetableView
        institutionId="institution-1"
        teacherProfileId="teacher-1"
        shifts={[]}
      />,
    );

    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(
      screen.getByText('Não foi possível verificar o calendário. As aulas continuam visíveis.'),
    ).toBeTruthy();
    expect(screen.queryByText('Aula suspensa')).toBeNull();
  });

  it('não projeta o período atual em uma semana posterior ao seu intervalo', () => {
    render(
      <TeacherTimetableView
        institutionId="institution-1"
        teacherProfileId="teacher-1"
        termId="term-1"
        termStartDate={weekStartDate}
        termEndDate={mondayDate}
        shifts={[]}
      />,
    );

    expect(screen.getByText('Matemática')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }));

    expect(screen.queryByText('Matemática')).toBeNull();
  });
});
