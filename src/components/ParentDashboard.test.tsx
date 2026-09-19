// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useGuardianDashboard } from '../hooks/useGuardianDashboard';
import { useAudienceAnnouncements } from '../hooks/useAnnouncements';
import { useGuardianRegistrationCompletion } from '../hooks/useRegistrationCompletion';

import ParentDashboard from './ParentDashboard';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../hooks/useGuardianDashboard', () => ({
  useGuardianDashboard: vi.fn(),
}));

vi.mock('../hooks/useAnnouncements', () => ({
  useAudienceAnnouncements: vi.fn(),
}));

vi.mock('../hooks/useRegistrationCompletion', () => ({
  useGuardianRegistrationCompletion: vi.fn(),
}));

vi.mock('./attendance/StudentAttendanceSummaryPanel', () => ({
  default: ({ studentId, title }: { studentId: string; title?: string }) => (
    <div data-testid="attendance-panel">{title} {studentId}</div>
  ),
}));

vi.mock('./grades/StudentGradesPanel', () => ({
  default: ({ studentId, title }: { studentId: string; title?: string }) => (
    <div data-testid="grades-panel">{title} {studentId}</div>
  ),
}));

vi.mock('./academic/GuardianReportCard', () => ({
  default: ({ selectedStudentId }: { selectedStudentId: string }) => (
    <div data-testid="report-card-panel">Boletim {selectedStudentId}</div>
  ),
}));

vi.mock('./DashboardAnnouncements', () => ({
  default: () => null,
}));

vi.mock('./UpcomingAcademicEvents', () => ({
  default: () => null,
}));

const institutionId = 'institution-1';

function studentDashboard(id: string, name: string) {
  return {
    student: {
      id,
      profile_id: `profile-${id}`,
      institution_id: institutionId,
      registration_number: `RA-${id}`,
      birth_date: '2010-01-01',
      active: true,
      profile: {
        full_name: name,
        email: `${id}@example.com`,
        avatar_url: null,
      },
    },
    activeEnrollment: {
      id: `enrollment-${id}`,
      class_id: 'class-1',
      academic_year_id: 'year-1',
      status: 'ACTIVE',
      enrolled_at: '2026-01-10',
      class_name: '1A',
      grade_level: '1º ano',
      shift: 'Manhã',
      academic_year_name: '2026',
    },
    offerings: [],
  };
}

const students = [
  {
    guardianship_id: 'guardianship-1',
    relationship: 'Mãe',
    is_primary: true,
    student: studentDashboard('student-1', 'Ana Silva'),
  },
  {
    guardianship_id: 'guardianship-2',
    relationship: 'Mãe',
    is_primary: false,
    student: studentDashboard('student-2', 'Bruno Lima'),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    profile: {
      id: 'guardian-1',
      full_name: 'Responsável Teste',
      email: 'guardian@example.com',
      role: 'GUARDIAN',
      platform_role: 'USER',
    },
  } as never);
  vi.mocked(useCurrentInstitution).mockReturnValue({
    data: institutionId,
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useGuardianDashboard).mockReturnValue({
    data: { students },
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useAudienceAnnouncements).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useGuardianRegistrationCompletion).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  } as never);
});

afterEach(() => {
  cleanup();
});

describe('ParentDashboard', () => {
  it('mostra carregamento acessível enquanto os vínculos chegam', () => {
    vi.mocked(useGuardianDashboard).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/guardian/attendance']}>
        <ParentDashboard />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('status', { name: 'Carregando vínculos familiares' }),
    ).toBeTruthy();
  });

  it('troca o dependente e atualiza o painel acadêmico dedicado', () => {
    render(
      <MemoryRouter initialEntries={['/guardian/grades?student=student-2']}>
        <ParentDashboard />
      </MemoryRouter>,
    );

    const selector = screen.getByLabelText('Dependente');
    expect((selector as HTMLSelectElement).value).toBe('student-2');
    expect(screen.getByTestId('grades-panel').textContent).toContain('Avaliações publicadas student-2');
    expect(screen.getAllByText('Bruno Lima')).toHaveLength(2);
    expect(screen.getByText('RA RA-student-2')).toBeTruthy();
    expect(screen.getByText('1A')).toBeTruthy();
    expect(screen.getByText('2026')).toBeTruthy();
    expect(screen.queryByText('Área da família')).toBeNull();

    fireEvent.change(selector, { target: { value: 'student-1' } });

    expect(screen.getByTestId('grades-panel').textContent).toContain('student-1');
  });

  it('mantém apenas alunos vinculados como opções de consulta', () => {
    render(
      <MemoryRouter initialEntries={['/guardian/report-card']}>
        <ParentDashboard />
      </MemoryRouter>,
    );

    const selector = screen.getByLabelText('Dependente');
    expect(selector.querySelectorAll('option')).toHaveLength(2);
    expect(screen.queryByText('Aluno não vinculado')).toBeNull();
    expect(screen.getByTestId('report-card-panel').textContent).toContain('student-1');
  });

  it('mantém o dependente selecionado como contexto na frequência', () => {
    render(
      <MemoryRouter initialEntries={['/guardian/attendance']}>
        <ParentDashboard />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Ana Silva')).toHaveLength(2);
    expect(screen.getByText('RA RA-student-1')).toBeTruthy();
    expect(screen.getByText('1A')).toBeTruthy();
    expect(screen.getByTestId('attendance-panel').textContent).toContain(
      'Resumo de frequência student-1',
    );
  });

  it('mantém a lista de disciplinas com rolagem interna', () => {
    vi.mocked(useGuardianDashboard).mockReturnValue({
      data: {
        students: [
          {
            ...students[0],
            student: {
              ...students[0].student,
              offerings: [
                {
                  id: 'offering-1',
                  subject_name: 'Matemática',
                  teacher_name: 'Professor Teste',
                  term_name: '1º Bimestre',
                },
              ],
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ParentDashboard />
      </MemoryRouter>,
    );

    const offeringsList = screen.getByLabelText(
      'Lista de disciplinas e professores',
    );

    expect(offeringsList.className).toContain('max-h-[24rem]');
    expect(offeringsList.className).toContain('overflow-y-auto');
    expect(offeringsList.textContent).toContain('Matemática');
  });
});
