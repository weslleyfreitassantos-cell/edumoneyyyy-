// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
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
    activeStudents: 842,
    inactiveStudents: 21,
    activeTeachers: 47,
    activeGuardians: 523,
    activeClasses: 28,
    activeSubjects: 14,
    activeEnrollments: 830,
    activeAssignments: 64,
    activeCurriculumItems: 92,
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
    expect(screen.getAllByText(/prontidão da escola/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/nenhuma turma cadastrada/i)).toBeNull();
    expect(screen.queryByText(/professor sem atribuição/i)).toBeNull();
    expect(screen.queryByText(/aluno sem matrícula/i)).toBeNull();
  });

  it('organiza os indicadores em principais e operacionais sem perder valores', () => {
    render(
      <MemoryRouter>
        <AdminOverviewTab />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Resumo da escola' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Resumo operacional' })).toBeTruthy();
    expect(screen.getByText('842')).toBeTruthy();
    expect(screen.getByText('47')).toBeTruthy();
    expect(screen.getByText('28')).toBeTruthy();
    expect(screen.getByText('523')).toBeTruthy();
    expect(screen.getByText('830')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.getByText('64')).toBeTruthy();
    expect(screen.getByText('92')).toBeTruthy();
    expect(screen.getByText('21')).toBeTruthy();
  });

  it('transforma somente módulos disponíveis em atalhos navegáveis', () => {
    const navigate = vi.fn();

    render(
      <MemoryRouter>
        <AdminOverviewTab
          availableModuleIds={[
            'students',
            'teachers',
            'classes',
            'enrollments',
          ]}
          onNavigateToModule={navigate}
        />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Alunos ativos: 842\. Ver módulo/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Professores ativos: 47\. Ver módulo/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Turmas ativas: 28\. Ver módulo/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Matrículas ativas: 830\. Ver módulo/i }),
    );

    expect(navigate.mock.calls).toEqual([
      ['students'],
      ['teachers'],
      ['classes'],
      ['enrollments'],
    ]);
    expect(screen.getByText('Responsáveis ativos')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Responsáveis ativos/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Disciplinas ativas/i })).toBeNull();
  });

  it('mantém indicadores estáticos quando o módulo não está disponível, inclusive para ADMIN', () => {
    const navigate = vi.fn();
    mockOverviewState({ profileRole: 'ADMIN', currentRole: 'ADMIN' });

    render(
      <MemoryRouter>
        <AdminOverviewTab onNavigateToModule={navigate} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Alunos ativos')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Alunos ativos/i })).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('exibe um skeleton com a estrutura da visão geral durante o carregamento', () => {
    mockedUseAdminOverview.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useAdminOverview>);

    render(
      <MemoryRouter>
        <AdminOverviewTab />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('admin-overview-loading')).toBeTruthy();
    expect(screen.queryByText('Carregando visão geral...')).toBeNull();
  });

  it('exibe somente o acesso de configuração para ADMIN', () => {
    mockOverviewState({
      profileRole: 'ADMIN',
      currentRole: 'ADMIN',
    });

    render(
      <MemoryRouter>
        <AdminOverviewTab />
      </MemoryRouter>,
    );

    expect(screen.getByText(/^acesso de configuração$/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /^base acadêmica$/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^equipe$/i })).toBeNull();
    expect(screen.queryByText(/gerenciar acesso/i)).toBeNull();
    expect(screen.getByText(/alunos ativos/i)).toBeTruthy();
  });
});
