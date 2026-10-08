// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useStudentAcademicContext } from '../hooks/useStudentAcademicContext';

import StudentAcademicResultsPage from './StudentAcademicResultsPage';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../hooks/useStudentAcademicContext', () => ({
  useStudentAcademicContext: vi.fn(),
}));

vi.mock('./attendance/StudentAttendanceSummaryPanel', () => ({
  default: ({ title }: { title?: string }) => <div>{title}</div>,
}));

vi.mock('./grades/StudentGradesPanel', () => ({
  default: ({ title }: { title?: string }) => <div>{title}</div>,
}));

vi.mock('./academic/StudentReportCard', () => ({
  default: () => <div>Boletim escolar</div>,
}));

const institutionId = '11111111-1111-1111-1111-111111111111';

const context = {
  student: {
    id: 'student-1',
    profile_id: 'profile-1',
    institution_id: institutionId,
    registration_number: 'RA-001',
    birth_date: null,
    active: true,
    profile: {
      full_name: 'Aluno Teste',
      email: 'aluno@example.com',
      avatar_url: null,
    },
  },
  activeEnrollment: {
    id: 'enrollment-1',
    class_id: 'class-1',
    academic_year_id: 'year-1',
    status: 'ACTIVE',
    enrolled_at: '2026-01-10',
    class_name: '1ª série A',
    grade_level: '1ª série',
    shift: 'Matutino',
    academic_year_name: '2026',
  },
};

beforeEach(() => {
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
    refetch: vi.fn(),
  } as never);
  vi.mocked(useStudentAcademicContext).mockReturnValue({
    data: context,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('StudentAcademicResultsPage', () => {
  it('carrega a rota acadêmica sem buscar o dashboard completo', () => {
    render(
      <MemoryRouter initialEntries={['/student/attendance']}>
        <StudentAcademicResultsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Resumo de frequência')).toBeTruthy();
    expect(screen.getByText('Aluno Teste')).toBeTruthy();
    expect(screen.getByText(/RA-001/)).toBeTruthy();
  });

  it('preserva o estado de carregamento enquanto o contexto mínimo chega', () => {
    vi.mocked(useStudentAcademicContext).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/student/grades']}>
        <StudentAcademicResultsPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Avaliações publicadas')).toBeNull();
  });
});
