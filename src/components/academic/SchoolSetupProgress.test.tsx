// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSchoolSetupReadiness } from '../../hooks/useSchoolSetupReadiness';
import type { SchoolSetupReadiness } from '../../services/schoolSetupService';

import SchoolSetupProgress from './SchoolSetupProgress';

vi.mock('../../hooks/useSchoolSetupReadiness', () => ({
  useSchoolSetupReadiness: vi.fn(),
}));

const mockedUseSchoolSetupReadiness = vi.mocked(useSchoolSetupReadiness);

function readinessFixture(overrides: Partial<SchoolSetupReadiness> = {}): SchoolSetupReadiness {
  return {
    institutionId: 'institution-1',
    steps: [
      {
        id: 'timetable',
        label: 'Grade horária',
        complete: false,
        href: '/admin?module=timetable&view=automation',
      },
    ],
    completedCount: 7,
    totalCount: 8,
    progress: 88,
    configured: false,
    academicSetupConfigured: false,
    academicSetupStatus: 'IN_PROGRESS',
    status: 'IN_PROGRESS',
    nextStepId: 'timetable',
    review: {
      academicYearName: '2026',
      termCount: 4,
      subjectCount: 8,
      classCount: 3,
      curriculumClassCount: 3,
      timetableClassCount: 0,
    },
    publishedVersionId: null,
    operationalReadiness: {
      blockers: [
        {
          id: 'published-timetable',
          label: 'Grade publicada',
          complete: false,
          description: 'Publique uma grade válida para as turmas ativas.',
          href: '/admin?module=timetable&view=automation',
        },
      ],
      completedCount: 0,
      totalCount: 1,
      progress: 0,
      ready: false,
    },
    optionalSetup: { brandingConfigured: false },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SchoolSetupProgress', () => {
  it('separa branding opcional da configuração acadêmica e exige grade publicada', () => {
    mockedUseSchoolSetupReadiness.mockReturnValue({
      data: readinessFixture(),
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useSchoolSetupReadiness>);

    render(
      <MemoryRouter>
        <SchoolSetupProgress institutionId="institution-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/2 de 15 etapas concluídas/i)).toBeTruthy();
    expect(screen.getByText('Grade horária')).toBeTruthy();
    expect(screen.getAllByText('Personalização').length).toBeGreaterThan(0);
    expect(screen.getByText(/personalizar o login é opcional/i)).toBeTruthy();
    expect(screen.getAllByText(/prontidão operacional/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Publique uma grade válida/i)).toBeTruthy();
  });

  it('não expõe erro técnico cru e orienta ADMIN para a configuração responsável', () => {
    mockedUseSchoolSetupReadiness.mockReturnValue({
      data: readinessFixture(),
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useSchoolSetupReadiness>);

    const { rerender } = render(
      <MemoryRouter>
        <SchoolSetupProgress institutionId="institution-1" canEditAcademic={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /gerenciar diretor ou secretaria/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /resolver pendência/i })).toBeNull();

    mockedUseSchoolSetupReadiness.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('canceling statement due to statement timeout'),
    } as ReturnType<typeof useSchoolSetupReadiness>);

    rerender(
      <MemoryRouter>
        <SchoolSetupProgress institutionId="institution-1" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert').textContent).toMatch(/operação demorou mais que o esperado/i);
    expect(screen.queryByText(/statement timeout/i)).toBeNull();
  });
});
