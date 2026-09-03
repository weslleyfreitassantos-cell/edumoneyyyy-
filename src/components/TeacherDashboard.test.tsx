// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useSchoolScheduleBreaks } from '../hooks/useAcademicTermClosing';
import { useTeacherDashboard } from '../hooks/useTeacherDashboard';
import { useTeacherTimetable } from '../hooks/useTimetable';

import TeacherDashboard from './TeacherDashboard';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../hooks/useAcademicTermClosing', () => ({
  useSchoolScheduleBreaks: vi.fn(),
}));

vi.mock('../hooks/useTeacherDashboard', () => ({
  useTeacherDashboard: vi.fn(),
}));

vi.mock('../hooks/useTimetable', () => ({
  useTeacherTimetable: vi.fn(),
}));

vi.mock('./attendance/TeacherAttendancePanel', () => ({
  default: () => null,
}));

vi.mock('./grades/TeacherAssessmentsPanel', () => ({
  default: () => null,
}));

vi.mock('./academic/TeacherTermClosingPanel', () => ({
  default: () => null,
}));

const institutionId = '11111111-1111-1111-1111-111111111111';
const teacherProfileId = '22222222-2222-2222-2222-222222222222';

const timetableEntry = {
  id: 'entry-1',
  institution_id: institutionId,
  subject_offering_id: 'offering-1',
  class_id: 'class-1',
  academic_year_id: 'year-1',
  term_id: 'term-1',
  subject_id: 'subject-1',
  teacher_profile_id: teacherProfileId,
  room_id: 'room-1',
  room_name: 'Sala 01',
  day_of_week: 1,
  day_label: 'Segunda',
  start_time: '07:00:00',
  end_time: '07:50:00',
  active: true,
  class_name: '1ª série A',
  subject_name: 'Matemática',
  teacher_name: 'Professor Teste',
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useAuth).mockReturnValue({
    profile: {
      id: teacherProfileId,
      full_name: 'Professor Teste',
      email: 'professor@example.com',
      avatar_url: null,
      role: 'TEACHER',
      platform_role: 'USER',
    },
  } as never);

  vi.mocked(useCurrentInstitution).mockReturnValue({
    data: institutionId,
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useTeacherDashboard).mockReturnValue({
    data: {
      offerings: [{
        id: 'offering-1',
        classId: 'class-1',
        subjectId: 'subject-1',
        termId: 'term-1',
        className: '1ª série A',
        gradeLevel: '1ª série',
        shift: 'Integral',
        capacity: 30,
        subjectName: 'Matemática',
        subjectCode: 'MAT',
        workload: 80,
        studentCount: 20,
      }],
      totals: {
        offerings: 1,
        classes: 1,
        subjects: 1,
        students: 20,
      },
      enrollmentAccessAvailable: true,
    },
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useTeacherTimetable).mockReturnValue({
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
});

afterEach(() => {
  cleanup();
});

describe('TeacherDashboard', () => {
  it('exibe a grade publicada do professor em uma rota própria', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/timetable']}>
        <TeacherDashboard />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Minha grade de aulas' }),
    ).toBeTruthy();
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByText('1ª série A')).toBeTruthy();
    expect(screen.getByText('07:00')).toBeTruthy();
    expect(useTeacherTimetable).toHaveBeenCalledWith(
      institutionId,
      teacherProfileId,
      'term-1',
    );
  });

  it('informa quando não há aula publicada para o professor', () => {
    vi.mocked(useTeacherTimetable).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/dashboard/timetable']}>
        <TeacherDashboard />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        'Nenhuma aula publicada foi encontrada para suas atribuições.',
      ),
    ).toBeTruthy();
  });
});
