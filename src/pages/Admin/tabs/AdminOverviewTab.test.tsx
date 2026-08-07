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

import {
  useAuth,
} from '../../../contexts/AuthContext';
import {
  useAdminOverview,
} from '../../../hooks/useAdminOverview';
import {
  useCurrentInstitution,
} from '../../../hooks/useCurrentInstitution';

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

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCurrentInstitution = vi.mocked(
  useCurrentInstitution,
);
const mockedUseAdminOverview = vi.mocked(
  useAdminOverview,
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

function mockOverviewState() {
  mockedUseAuth.mockReturnValue({
    user: null,
    profile: {
      id: 'profile-1',
      full_name: 'Ana Admin',
      email: 'ana@example.com',
      role: 'DIRECTOR',
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
    currentRole: 'DIRECTOR',
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
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOverviewState();
});

afterEach(() => {
  cleanup();
});

describe('AdminOverviewTab', () => {
  it('renderiza apenas os cards de métricas e não exibe o resumo acadêmico', () => {
    render(
      <AdminOverviewTab
        availableModuleIds={[
          'academic-years',
          'subjects',
          'classes',
          'teachers',
          'assignments',
          'enrollments',
        ]}
      />,
    );

    expect(screen.getByText(/alunos ativos/i)).toBeTruthy();
    expect(screen.getByText(/professores ativos/i)).toBeTruthy();
    expect(screen.getByText(/turmas ativas/i)).toBeTruthy();

    expect(screen.queryByText(/ano letivo atual/i)).toBeNull();
    expect(screen.queryByText(/período atual/i)).toBeNull();
    expect(screen.queryByText(/pendências acadêmicas/i)).toBeNull();
    expect(screen.queryByText(/nenhuma turma cadastrada/i)).toBeNull();
    expect(screen.queryByText(/professor sem atribuição/i)).toBeNull();
    expect(screen.queryByText(/aluno sem matrícula/i)).toBeNull();
  });
});
