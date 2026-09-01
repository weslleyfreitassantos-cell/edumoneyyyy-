// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useSchoolScheduleBreaks } from '../hooks/useAcademicTermClosing';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import { useStudentTimetable } from '../hooks/useTimetable';

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
});
