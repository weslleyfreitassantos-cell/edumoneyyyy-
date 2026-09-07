// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import {
  useAuth,
} from '../../../contexts/AuthContext';
import {
  useAdminOverview,
} from '../../../hooks/useAdminOverview';
import {
  useCurrentInstitution,
} from '../../../hooks/useCurrentInstitution';
import { useSchoolSetupReadiness } from '../../../hooks/useSchoolSetupReadiness';
import type { DatabaseRole } from '../../../lib/roles';

import AdminOverviewTab from './AdminOverviewTab';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../../../hooks/useAdminOverview', () => ({
  useAdminOverview: vi.fn(),
}));

vi.mock('../../../hooks/useSchoolSetupReadiness', () => ({
  useSchoolSetupReadiness: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCurrentInstitution = vi.mocked(
  useCurrentInstitution,
);
const mockedUseAdminOverview = vi.mocked(
  useAdminOverview,
);
const mockedUseSchoolSetupReadiness = vi.mocked(
  useSchoolSetupReadiness,
);

const overviewData = {
  metrics: {
    activeStudents: 0,
    inactiveStudents: 0,
    activeTeachers: 1,
    activeGuardians: 0,
    activeClasses: 0,
    activeSubjects: 0,
    activeEnrollments: 0,
    activeAssignments: 0,
  },
  currentAcademicYear: {
    id: 'year-1',
    name: '2026',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    active: true,
  },
  currentTerm: null,
  warnings: [],
};

function mockOverviewState({
  profileRole = 'DIRECTOR',
  currentRole = profileRole,
}: {
  profileRole?: DatabaseRole;
  currentRole?: DatabaseRole | null;
} = {}) {
  mockedUseAuth.mockReturnValue({
    user: null,
    profile: {
      id: 'profile-1',
      full_name: 'Ana Admin',
      email: 'ana@example.com',
      role: profileRole,
      platform_role: 'USER',
      avatar_url: null,
    },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

  mockedUseCurrentInstitution.mockReturnValue({
    data: 'institution-1',
    institution: {
      id: 'institution-1',
      name: 'Escola Centro',
      active: true,
      account_id: 'account-1',
    },
    membership: null,
    currentInstitution: {
      id: 'institution-1',
      name: 'Escola Centro',
      active: true,
      account_id: 'account-1',
    },
    currentMembership: null,
    currentInstitutionId: 'institution-1',
    currentRole,
    isLoading: false,
    isError: false,
    error: null,
    message: null,
    refetch: vi.fn(),
  });

  mockedUseAdminOverview.mockReturnValue({
    data: overviewData,
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useAdminOverview>);

  mockedUseSchoolSetupReadiness.mockReturnValue({
    data: {
      institutionId: 'institution-1',
      steps: [],
      completedCount: 7,
      totalCount: 7,
      progress: 100,
      configured: true,
      academicSetupConfigured: true,
      academicSetupStatus: 'CONFIGURED',
      status: 'CONFIGURED',
      nextStepId: null,
      review: {
        academicYearName: '2026',
        termCount: 4,
        subjectCount: 8,
        classCount: 3,
        curriculumClassCount: 3,
        timetableClassCount: 3,
      },
      publishedVersionId: 'version-1',
      operationalReadiness: {
        blockers: [],
        completedCount: 0,
        totalCount: 0,
        progress: 0,
        ready: false,
      },
      optionalSetup: { brandingConfigured: false },
    },
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useSchoolSetupReadiness>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOverviewState();
});

afterEach(() => {
  cleanup();
});

describe('AdminOverviewTab', () => {
  it('renderiza os cards de métricas e a revisão quando a escola está configurada', () => {
    render(
      <MemoryRouter>
        <AdminOverviewTab
          availableModuleIds={[
            'academic-years',
            'subjects',
            'classes',
            'teachers',
            'assignments',
            'enrollments',
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/alunos ativos/i)).toBeTruthy();
    expect(screen.getByText(/professores ativos/i)).toBeTruthy();
    expect(screen.getAllByText(/turmas ativas/i).length).toBeGreaterThan(0);

    expect(screen.getByText(/^configuração da escola$/i)).toBeTruthy();
    expect(screen.queryByText(/^fundação$/i)).toBeNull();
    expect(screen.getAllByText(/prontidão operacional/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/nenhuma turma cadastrada/i)).toBeNull();
    expect(screen.queryByText(/professor sem atribuição/i)).toBeNull();
    expect(screen.queryByText(/aluno sem matrícula/i)).toBeNull();
  });

  it('exibe a configuração acadêmica para ADMIN sem oferecer edição indevida', () => {
    mockOverviewState({
      profileRole: 'ADMIN',
      currentRole: 'ADMIN',
    });

    render(
      <MemoryRouter>
        <AdminOverviewTab />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/configuração acadêmica/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^fundação$/i)).toBeTruthy();
    expect(screen.queryByText(/gerenciar diretor ou secretaria/i)).toBeNull();
    expect(screen.getByText(/alunos ativos/i)).toBeTruthy();
  });
});
