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

describe('AdminOverviewTab setup checklist', () => {
  it('mostra etapas concluidas e pendentes usando dados reais', () => {
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

    const checklist = screen
      .getByText(/configura..o inicial da escola/i)
      .closest('article');

    expect(checklist).toBeTruthy();
    expect(
      within(checklist!).getByText(
        /institui..o selecionada/i,
      ),
    ).toBeTruthy();
    expect(
      within(checklist!).getByText(
        /criar ano letivo/i,
      ),
    ).toBeTruthy();
    expect(
      within(checklist!).getByText(
        /adicionar disciplinas/i,
      ),
    ).toBeTruthy();
    expect(
      within(checklist!).getAllByText(
        /conclu.do/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      within(checklist!).getAllByText(
        /pendente/i,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('abre o modulo correspondente de uma etapa incompleta', () => {
    const onNavigateToModule = vi.fn();

    render(
      <AdminOverviewTab
        availableModuleIds={[
          'subjects',
        ]}
        onNavigateToModule={
          onNavigateToModule
        }
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /adicionar disciplinas/i,
      }),
    );

    expect(onNavigateToModule).toHaveBeenCalledWith(
      'subjects',
    );
  });
});
