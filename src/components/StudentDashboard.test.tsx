// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useSchoolScheduleBreaks } from '../hooks/useAcademicTermClosing';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import {
  useStudentTimetable,
  useTimetableCalendarStatuses,
} from '../hooks/useTimetable';
import { getLocalDateInputValue } from '../lib/academicTermDates';
import {
  getDateForWeekDay,
  getWeekStartDateKey,
} from '../lib/academic/timetableOccurrences';

import StudentDashboard from './StudentDashboard';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../hooks/useAcademicTermClosing', () => ({
  useSchoolScheduleBreaks: vi.fn(),
}));

vi.mock('../hooks/useStudentDashboard', () => ({
  useStudentDashboard: vi.fn(),
}));

vi.mock('../hooks/useTimetable', () => ({
  useStudentTimetable: vi.fn(),
  useTimetableCalendarStatuses: vi.fn(),
}));

vi.mock('../hooks/useAnnouncements', () => ({
  useAudienceAnnouncements: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
  })),
}));

vi.mock('../hooks/useRegistrationCompletion', () => ({
  useStudentRegistrationCompletion: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
  })),
}));

vi.mock('./attendance/StudentAttendanceSummaryPanel', () => ({
  default: () => null,
}));

vi.mock('./grades/StudentGradesPanel', () => ({
  default: () => null,
}));

vi.mock('./academic/StudentReportCard', () => ({
  default: () => null,
}));

vi.mock('./UpcomingAcademicEvents', () => ({
  default: () => null,
}));

const institutionId = '11111111-1111-1111-1111-111111111111';
const classId = '22222222-2222-2222-2222-222222222222';

const dashboard = {
  student: {
    id: 'student-1',
    profile_id: 'profile-1',
    institution_id: institutionId,
    registration_number: 'TV-001',
    birth_date: '2010-01-01',
    active: true,
    profile: {
      full_name: 'Aluno Teste',
      email: 'aluno@example.com',
      avatar_url: null,
    },
  },
  activeEnrollment: {
    id: 'enrollment-1',
    class_id: classId,
    academic_year_id: 'year-1',
    status: 'ACTIVE',
    enrolled_at: '2026-01-10',
    class_name: '1ª série A',
    grade_level: '1ª série',
    shift: 'Matutino',
    academic_year_name: '2026',
  },
  offerings: [],
};

const timetableEntry = {
  id: 'entry-1',
  institution_id: institutionId,
  subject_offering_id: 'offering-1',
  class_id: classId,
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
  class_name: '1ª série A',
  subject_name: 'Matemática',
  teacher_name: 'Prof. João',
};

const currentOffering = {
  id: 'offering-1',
  subject_id: 'subject-1',
  subject_name: 'Matemática',
  subject_code: 'MAT',
  workload: 5,
  teacher_profile_id: 'teacher-1',
  teacher_name: 'Prof. João',
  teacher_email: 'joao@example.com',
  term_id: 'term-1',
  term_name: '1º Bimestre',
  term_start_date: '2026-02-01',
  term_end_date: '2026-04-30',
};

const currentWeekStartDate = getWeekStartDateKey(getLocalDateInputValue());
const currentWeekEndDate = getDateForWeekDay(currentWeekStartDate, 4);
const currentWeekOffering = {
  ...currentOffering,
  term_id: 'term-current-week',
  term_start_date: currentWeekStartDate,
  term_end_date: currentWeekEndDate,
};

const fridayTimetableEntry = {
  ...timetableEntry,
  id: 'entry-friday',
  day_of_week: 5,
  day_label: 'Sexta',
  subject_id: 'subject-2',
  subject_name: 'História',
  subject_offering_id: 'offering-2',
};

function mockDefaultState() {
  vi.mocked(useAuth).mockReturnValue({
    profile: {
      id: 'profile-1',
      full_name: 'Aluno Teste',
      email: 'aluno@example.com',
      avatar_url: null,
      role: 'STUDENT',
      platform_role: 'USER',
    },
  } as never);

  vi.mocked(useCurrentInstitution).mockReturnValue({
    data: institutionId,
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useStudentDashboard).mockReturnValue({
    data: dashboard,
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useStudentTimetable).mockReturnValue({
    data: [timetableEntry],
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useTimetableCalendarStatuses).mockReturnValue({
    data: {},
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
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDefaultState();
});

afterEach(() => {
  cleanup();
});

describe('StudentDashboard', () => {
  it('exibe a grade publicada da turma do aluno em uma rota propria', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/timetable']}>
        <StudentDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '1ª série A' })).toBeTruthy();
    expect(screen.getByText('Grade de horário')).toBeTruthy();
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByText('07:00')).toBeTruthy();
    expect(screen.getByText('Prof. João')).toBeTruthy();
    expect(useStudentTimetable).toHaveBeenCalledWith(institutionId, classId, undefined);
  });

  it('passa ao timetable o intervalo do mesmo offering usado como período atual', () => {
    vi.mocked(useStudentDashboard).mockReturnValue({
      data: { ...dashboard, offerings: [currentWeekOffering] },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/dashboard/timetable']}>
        <StudentDashboard />
      </MemoryRouter>,
    );

    expect(useStudentTimetable).toHaveBeenCalledWith(
      institutionId,
      classId,
      currentWeekOffering.term_id,
    );
    expect(useTimetableCalendarStatuses).toHaveBeenCalledWith(
      institutionId,
      [timetableEntry],
      currentWeekStartDate,
      currentWeekOffering.term_start_date,
      currentWeekOffering.term_end_date,
    );
  });

  it('mantém a aula dentro do período e não projeta a aula posterior ao seu fim', () => {
    vi.mocked(useStudentDashboard).mockReturnValue({
      data: { ...dashboard, offerings: [currentWeekOffering] },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useStudentTimetable).mockReturnValue({
      data: [timetableEntry, fridayTimetableEntry],
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/dashboard/timetable']}>
        <StudentDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.queryByText('História')).toBeNull();
  });

  it('não projeta uma aula anterior ao início do período', () => {
    vi.mocked(useStudentDashboard).mockReturnValue({
      data: {
        ...dashboard,
        offerings: [{
          ...currentWeekOffering,
          term_start_date: getDateForWeekDay(currentWeekStartDate, 2),
        }],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/dashboard/timetable']}>
        <StudentDashboard />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Matemática')).toBeNull();
  });

  it('informa quando a turma ainda não tem grade publicada', () => {
    vi.mocked(useStudentTimetable).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/dashboard/timetable']}>
        <StudentDashboard />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        'A grade de horário da sua turma ainda não foi publicada.',
      ),
    ).toBeTruthy();
  });

  it('exibe o intervalo entre as aulas do aluno', () => {
    vi.mocked(useSchoolScheduleBreaks).mockReturnValue({
      data: [{ id: 'break-1', institution_id: institutionId, shift: 'MATUTINO', day_of_week: 1, name: 'Intervalo', start_time: '10:30', end_time: '10:50', active: true }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/dashboard/timetable']}>
        <StudentDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('timetable-break')).toBeTruthy();
    expect(screen.getByText('Pausa escolar')).toBeTruthy();
  });

  it('move disciplinas e professores para a tela própria do menu do aluno', () => {
    vi.mocked(useStudentDashboard).mockReturnValue({
      data: { ...dashboard, offerings: [currentOffering] },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/dashboard/subjects']}>
        <StudentDashboard />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Disciplinas e professores' }),
    ).toBeTruthy();
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByText('Prof. João')).toBeTruthy();
    expect(screen.queryByText('Área do aluno')).toBeNull();
  });

  it('remove disciplinas e professores do dashboard principal', () => {
    vi.mocked(useStudentDashboard).mockReturnValue({
      data: { ...dashboard, offerings: [currentOffering] },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <StudentDashboard />
      </MemoryRouter>,
    );

    expect(
      screen.queryByText('Disciplinas e professores do período atual'),
    ).toBeNull();
    expect(screen.queryByText('Disciplinas do período atual')).toBeNull();
  });
});
