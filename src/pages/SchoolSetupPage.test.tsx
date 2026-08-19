// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useSchoolSetupReadiness } from '../hooks/useSchoolSetupReadiness';

import SchoolSetupPage from './SchoolSetupPage';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../hooks/useSchoolSetupReadiness', () => ({
  useSchoolSetupReadiness: vi.fn(),
}));

vi.mock('../components/academic/SchoolSetupProgress', () => ({
  default: () => <div>Progresso da escola</div>,
}));

vi.mock('../components/academic/TimetableAutomationPanel', () => ({
  default: () => <div>Gerador da grade</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    profile: {
      id: 'profile-1',
      full_name: 'Diretora',
      email: 'diretora@example.com',
      role: 'DIRECTOR',
      platform_role: 'USER',
      avatar_url: null,
    },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
  vi.mocked(useCurrentInstitution).mockReturnValue({
    data: 'institution-1',
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useSchoolSetupReadiness).mockReturnValue({
    data: {
      institutionId: 'institution-1',
      steps: [],
      completedCount: 6,
      totalCount: 7,
      progress: 86,
      configured: false,
      status: 'IN_PROGRESS',
      nextStepId: 'timetable',
      review: {
        academicYearName: '2026',
        termCount: 4,
        subjectCount: 12,
        classCount: 18,
        curriculumClassCount: 18,
        timetableClassCount: 0,
      },
      publishedVersionId: null,
    },
    isLoading: false,
    isError: false,
    error: null,
  } as never);
});

afterEach(() => {
  cleanup();
});

describe('SchoolSetupPage', () => {
  it('expõe a rota de configuração e abre o gerador quando a grade é o próximo passo', () => {
    render(
      <MemoryRouter initialEntries={['/configurar-escola']}>
        <SchoolSetupPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Configuração guiada da escola')).toBeTruthy();
    expect(screen.getByText('Progresso da escola')).toBeTruthy();
    expect(screen.getByText('Gerador da grade')).toBeTruthy();
  });
});
