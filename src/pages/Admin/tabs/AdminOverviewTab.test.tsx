// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

vi.mock('../../../components/dashboard/DirectorAcademicPanorama', () => ({
  default: () => <div data-testid="director-academic-panorama" />,
}));

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
  profileName = 'Ana Admin',
  avatarUrl = null,
  setupReady = false,
}: {
  profileRole?: DatabaseRole;
  currentRole?: DatabaseRole | null;
  profileName?: string;
  avatarUrl?: string | null;
  setupReady?: boolean;
} = {}) {
  mockedUseAuth.mockReturnValue({
    user: null,
    profile: {
      id: 'profile-1',
      full_name: profileName,
      email: 'ana@example.com',
      role: profileRole,
      platform_role: 'USER',
      avatar_url: avatarUrl,
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
        ready: setupReady,
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
  it('exibe a saudação e a foto do diretor na faixa de boas-vindas', () => {
    mockOverviewState({
      profileName: 'Ana Lúcia',
      avatarUrl: 'https://storage.example/director.webp',
    });

    render(
      <MemoryRouter>
        <AdminOverviewTab />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Olá, Ana!' })).toBeTruthy();
    expect(screen.getByText('Área da direção')).toBeTruthy();
    expect(screen.getByAltText('Foto de Ana Lúcia')).toBeTruthy();
  });

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

    expect(screen.getByText(/estudantes ativos/i)).toBeTruthy();
    expect(screen.getByText(/docentes ativos/i)).toBeTruthy();
    expect(screen.getAllByText(/turmas ativas/i).length).toBeGreaterThan(0);

    expect(screen.getByRole('button', { name: /configuração da escola/i })).toBeTruthy();
    expect(screen.queryByText(/^fundação$/i)).toBeNull();
    expect(screen.getAllByText(/prontidão, etapas e próximos passos da instituição/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/nenhuma turma cadastrada/i)).toBeNull();
    expect(screen.queryByText(/professor sem atribuição/i)).toBeNull();
    expect(screen.queryByText(/aluno sem matrícula/i)).toBeNull();
  });

  it('inicia a configuração recolhida quando a escola está pronta e respeita a escolha manual', () => {
    mockOverviewState({ setupReady: true });

    render(
      <MemoryRouter>
        <AdminOverviewTab />
      </MemoryRouter>,
    );

    const setupToggle = screen.getByRole('button', { name: /Configuração da escola/i });
    const setupContent = document.getElementById('admin-overview-setup-content');

    expect(setupToggle.getAttribute('aria-expanded')).toBe('false');
    expect(setupContent?.hasAttribute('hidden')).toBe(true);

    fireEvent.click(setupToggle);
    expect(setupToggle.getAttribute('aria-expanded')).toBe('true');
    expect(setupContent?.hasAttribute('hidden')).toBe(false);
  });

  it('organiza os indicadores em principais e operacionais sem perder valores', () => {
    render(
      <MemoryRouter>
        <AdminOverviewTab />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('director-academic-panorama')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Resumo da escola' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Resumo operacional/i }));
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

  it('mantém os blocos independentes, com operação fechada e panorama aberto inicialmente', () => {
    render(
      <MemoryRouter>
        <AdminOverviewTab />
      </MemoryRouter>,
    );

    const operationalToggle = screen.getByRole('button', { name: /Resumo operacional/i });
    const panoramaToggle = screen.getByRole('button', { name: /Panorama acadêmico/i });
    const operationalContent = document.getElementById('admin-overview-operational-content');
    const panoramaContent = document.getElementById('admin-overview-panorama-content');

    expect(operationalToggle.getAttribute('aria-expanded')).toBe('false');
    expect(panoramaToggle.getAttribute('aria-expanded')).toBe('true');
    expect(operationalContent?.hasAttribute('hidden')).toBe(true);
    expect(panoramaContent?.hasAttribute('hidden')).toBe(false);

    fireEvent.click(operationalToggle);
    expect(operationalToggle.getAttribute('aria-expanded')).toBe('true');
    expect(operationalContent?.hasAttribute('hidden')).toBe(false);
    expect(screen.getByText('Estudantes ativos')).toBeTruthy();
    expect(screen.getByText('Docentes ativos')).toBeTruthy();
    expect(screen.getByText('Turmas ativas')).toBeTruthy();

    fireEvent.click(panoramaToggle);
    expect(panoramaToggle.getAttribute('aria-expanded')).toBe('false');
    expect(panoramaContent?.hasAttribute('hidden')).toBe(true);
    expect(operationalContent?.hasAttribute('hidden')).toBe(false);
  });

  it('inicia os três módulos recolhidos para o diretor no mobile', async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    try {
      render(
        <MemoryRouter>
          <AdminOverviewTab />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen
            .getByRole('button', { name: /Configuração da escola/i })
            .getAttribute('aria-expanded'),
        ).toBe('false');
        expect(
          screen
            .getByRole('button', { name: /Resumo operacional/i })
            .getAttribute('aria-expanded'),
        ).toBe('false');
        expect(
          screen
            .getByRole('button', { name: /Panorama acadêmico/i })
            .getAttribute('aria-expanded'),
        ).toBe('false');
      });
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    }
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

    fireEvent.click(screen.getByRole('button', { name: /Resumo operacional/i }));

    fireEvent.click(
      screen.getByRole('button', { name: /Estudantes ativos: 842\. Ver módulo/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Docentes ativos: 47\. Ver módulo/i }),
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

    expect(screen.getByText('Estudantes ativos')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Estudantes ativos/i })).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('exibe a estrutura do painel e inicia o panorama enquanto as métricas carregam', () => {
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

    expect(screen.getByRole('heading', { name: 'Olá, Ana!' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Configuração da escola/i })).toBeTruthy();
    expect(screen.getByTestId('director-academic-panorama')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Resumo operacional/i })).toBeTruthy();
    expect(screen.queryByText('Carregando visão geral...')).toBeNull();
    expect(screen.queryByText('842')).toBeNull();
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
    expect(screen.getByText(/estudantes ativos/i)).toBeTruthy();
  });
});
