// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  Profile,
} from '../../contexts/AuthContext';
import {
  useAuth,
} from '../../contexts/AuthContext';
import {
  useCurrentInstitution,
} from '../../hooks/useCurrentInstitution';
import {
  useSchoolSetupReadiness,
} from '../../hooks/useSchoolSetupReadiness';

import AdminPage from './AdminPage';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../../hooks/useSchoolSetupReadiness', () => ({
  useSchoolSetupReadiness: vi.fn(),
}));

vi.mock(
  '../../components/attendance/InstitutionAttendancePanel',
  () => ({
    default: ({
      institutionId,
    }: {
      institutionId: string | null;
    }) => (
      <div data-testid="attendance-panel">
        Frequencia {institutionId}
      </div>
    ),
  }),
);

vi.mock(
  '../../components/grades/InstitutionGradesPanel',
  () => ({
    default: ({
      institutionId,
    }: {
      institutionId: string | null;
    }) => (
      <div data-testid="grades-panel">
        Notas {institutionId}
      </div>
    ),
  }),
);

vi.mock(
  '../../components/academic/InstitutionTermClosingPanel',
  () => ({
    default: ({
      institutionId,
    }: {
      institutionId: string | null;
    }) => (
      <div data-testid="term-closing-panel">
        Fechamento {institutionId}
      </div>
    ),
  }),
);

vi.mock(
  '../../components/academic/AcademicPolicyPanel',
  () => ({
    default: ({
      institutionId,
    }: {
      institutionId: string | null;
    }) => (
      <div data-testid="academic-policy-panel">
        Politica {institutionId}
      </div>
    ),
  }),
);

vi.mock(
  '../../components/academic/PedagogicalMonitoringPanel',
  () => ({
    default: () => (
      <div data-testid="pedagogical-monitoring-panel">
        Acompanhamento pedagogico
      </div>
    ),
  }),
);

vi.mock('./tabs/AdminOverviewTab', () => ({
  default: ({
    onNavigateToModule,
  }: {
    onNavigateToModule?: (
      moduleId: 'subjects',
    ) => void;
  }) => (
    <div data-testid="overview-tab">
      Aba visao geral
      <button
        type="button"
        onClick={() =>
          onNavigateToModule?.('subjects')
        }
      >
        Abrir modulo pelo checklist
      </button>
    </div>
  ),
}));

vi.mock('./tabs/SchoolUsersTab', () => ({
  default: ({
    fixedRole,
    inviteHeading,
  }: {
    fixedRole?: string;
    inviteHeading?: string;
  }) => (
    <div data-testid="school-users-tab">
      Aba usuarios {fixedRole ?? 'ALL'} {inviteHeading ?? ''}
    </div>
  ),
}));

vi.mock('./tabs/EnrollmentsTab', () => ({
  default: () => (
    <div data-testid="enrollments-tab">
      Aba matriculas
    </div>
  ),
}));

vi.mock('./tabs/StudentsTab', () => ({
  default: () => (
    <div data-testid="students-tab">
      Aba alunos
    </div>
  ),
}));

vi.mock('./tabs/TeachersTab', () => ({
  default: () => (
    <div data-testid="teachers-tab">
      Aba professores
    </div>
  ),
}));

vi.mock('./tabs/GuardiansTab', () => ({
  default: () => (
    <div data-testid="guardians-tab">
      Aba responsaveis
    </div>
  ),
}));

vi.mock('./tabs/AcademicYearsTab', () => ({
  default: () => (
    <div data-testid="academic-years-tab">
      Aba ano letivo
    </div>
  ),
}));

vi.mock('./tabs/ClassesTab', () => ({
  default: () => (
    <div data-testid="classes-tab">
      Aba turmas
    </div>
  ),
}));

vi.mock('./tabs/SubjectsTab', () => ({
  default: () => (
    <div data-testid="subjects-tab">
      Aba disciplinas
    </div>
  ),
}));

vi.mock('./tabs/CurriculumTab', () => ({
  default: () => (
    <div data-testid="curriculum-tab">
      Aba matriz curricular
    </div>
  ),
}));

vi.mock('./tabs/AssignmentsTab', () => ({
  default: () => (
    <div data-testid="assignments-tab">
      Aba atribuicoes
    </div>
  ),
}));

vi.mock('./tabs/AnnouncementsTab', () => ({
  default: () => (
    <div data-testid="announcements-tab">
      Aba avisos
    </div>
  ),
}));

vi.mock('./tabs/EmailTab', () => ({
  default: () => (
    <div data-testid="email-tab">
      Aba e-mail
    </div>
  ),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCurrentInstitution = vi.mocked(
  useCurrentInstitution,
);
const mockedUseSchoolSetupReadiness = vi.mocked(
  useSchoolSetupReadiness,
);

const baseProfile: Profile = {
  id: 'profile-1',
  full_name: 'Ana Admin',
  email: 'ana@example.com',
  role: 'ADMIN',
  platform_role: 'USER',
  avatar_url: null,
};

function mockAdminState({
  profile = baseProfile,
  currentRole = 'ADMIN',
  institutionId = 'institution-1',
}: {
  profile?: Profile | null;
  currentRole?: string | null;
  institutionId?: string | null;
} = {}) {
  mockedUseAuth.mockReturnValue({
    user: profile
      ? ({ id: profile.id } as SupabaseUser)
      : null,
    profile,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

  mockedUseCurrentInstitution.mockReturnValue({
    data: institutionId,
    institution: institutionId
      ? {
          id: institutionId,
          name: 'Escola Centro',
          active: true,
          account_id: 'account-1',
        }
      : null,
    membership:
      institutionId && currentRole
        ? {
            id: 'membership-1',
            institution_id: institutionId,
            role: currentRole,
            active: true,
          }
        : null,
    currentInstitution: institutionId
      ? {
          id: institutionId,
          name: 'Escola Centro',
          active: true,
          account_id: 'account-1',
        }
      : null,
    currentMembership:
      institutionId && currentRole
        ? {
            id: 'membership-1',
            institution_id: institutionId,
            role: currentRole,
            active: true,
          }
        : null,
    currentInstitutionId: institutionId,
    currentRole,
    isLoading: false,
    isError: false,
    error: null,
    message: null,
    refetch: vi.fn(),
  });
}

function mockReadiness(nextStepId: string | null) {
  const hrefByStep: Record<string, string> = {
    'academic-year': '/admin?module=academic-years',
    terms: '/admin?module=academic-years',
    subjects: '/admin?module=subjects',
    'teaching-structure': '/admin?module=academic-policies',
    shifts: '/admin?module=academic-policies',
    classes: '/admin?module=classes',
    'class-subjects': '/admin?module=curriculum',
    timetable: '/admin?module=timetable&view=automation',
  };

  const stepIds = Object.keys(hrefByStep);
  const steps = stepIds.map((id) => ({
    id,
    label: id,
    complete: nextStepId === null || id !== nextStepId,
    href: hrefByStep[id],
  }));
  const blockers = [
    'academic-setup',
    'published-timetable',
    'teachers-configured',
    'subject-offerings',
    'teacher-assignments',
    'teacher-qualifications',
    'teacher-availability',
    'active-enrollments',
  ].map((id) => ({
    id,
    label: id,
    complete: true,
    description: '',
    href: '/admin?module=overview',
  }));

  mockedUseSchoolSetupReadiness.mockReturnValue({
    data: {
      institutionId: 'institution-1',
      academicManagerCount: 1,
      nextStepId,
      steps,
      completedCount: steps.filter((step) => step.complete).length,
      totalCount: steps.length,
      progress: 0,
      configured: nextStepId === null,
      academicSetupConfigured: nextStepId === null,
      academicSetupStatus: nextStepId === null ? 'CONFIGURED' : 'IN_PROGRESS',
      status: nextStepId === null ? 'CONFIGURED' : 'IN_PROGRESS',
      review: {
        academicYearName: null,
        termCount: 0,
        subjectCount: 0,
        classCount: 0,
        curriculumClassCount: 0,
        timetableClassCount: 0,
      },
      publishedVersionId: null,
      operationalReadiness: {
        blockers,
        completedCount: blockers.length,
        totalCount: blockers.length,
        progress: 100,
        ready: true,
      },
      optionalSetup: {
        brandingConfigured: false,
      },
    },
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useSchoolSetupReadiness>);
}

function renderAdminPage(route = '/admin') {
  function RouterHarness() {
    const [, setRenderVersion] = useState(0);

    return (
      <>
        <button
          type="button"
          data-testid="force-rerender"
          onClick={() => setRenderVersion((version) => version + 1)}
        />
        <Routes>
          <Route
            path="/admin"
            element={<AdminPage />}
          />
          <Route
            path="/dashboard"
            element={<div>Dashboard destino</div>}
          />
          <Route
            path="/login"
            element={<div>Tela de login</div>}
          />
          <Route
            path="/platform"
            element={<div>Selecao de instituicao</div>}
          />
        </Routes>
      </>
    );
  }

  return render(
    <MemoryRouter initialEntries={[route]}>
      <RouterHarness />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminState();
  mockReadiness('academic-year');
});

afterEach(() => {
  cleanup();
});

describe('AdminPage URL module resolution', () => {
  it('usa Visao geral como fallback quando modulo esta ausente', () => {
    renderAdminPage('/admin');

    expect(
      screen.getByTestId('overview-tab'),
    ).toBeTruthy();
    expect(
      screen.queryByText(/^m.dulos$/i),
    ).toBeNull();
  });

  it('renderiza modulo ativo informado pela URL', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage('/admin?module=subjects');

    expect(
      screen.getByTestId('subjects-tab'),
    ).toBeTruthy();
  });

  it('renderiza o cadastro de diretores para ADMIN e bloqueia a rota para DIRECTOR', () => {
    renderAdminPage('/admin?module=directors');

    expect(
      screen.getByTestId('school-users-tab').textContent,
    ).toContain('DIRECTOR');

    cleanup();
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });
    renderAdminPage('/admin?module=directors');

    expect(
      screen.getByTestId('overview-tab'),
    ).toBeTruthy();
  });

  it('renderiza a tela de avisos para perfis institucionais autorizados', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage('/admin?module=announcements');

    expect(
      screen.getByTestId('announcements-tab'),
    ).toBeTruthy();
  });

  it('limita acompanhamento pedagogico a diretor e secretaria', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage('/admin?module=pedagogical-monitoring');

    expect(
      screen.getByTestId('pedagogical-monitoring-panel'),
    ).toBeTruthy();

    cleanup();
    mockAdminState();
    renderAdminPage('/admin?module=pedagogical-monitoring');

    expect(
      screen.queryByTestId('pedagogical-monitoring-panel'),
    ).toBeNull();
    expect(screen.getByTestId('overview-tab')).toBeTruthy();
  });

  it('renderiza o e-mail para perfis administrativos autorizados', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage('/admin?module=email');

    expect(screen.getByTestId('email-tab')).toBeTruthy();
  });

  it.each(['secretaries', 'announcements', 'email'])(
    'bloqueia ADMIN da rota %s',
    (moduleId) => {
      renderAdminPage(`/admin?module=${moduleId}`);

      expect(screen.getByTestId('overview-tab')).toBeTruthy();
    },
  );

  it('mantem modulo ao recarregar com a mesma URL', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage('/admin?module=classes');

    expect(
      screen.getByTestId('classes-tab'),
    ).toBeTruthy();
  });

  it('avanca para o proximo modulo quando a etapa atual e concluida', async () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    const view = renderAdminPage('/admin?module=academic-years');

    expect(screen.getByTestId('academic-years-tab')).toBeTruthy();

    mockReadiness('subjects');
    fireEvent.click(screen.getByTestId('force-rerender'));

    await waitFor(() => {
      expect(screen.getByTestId('subjects-tab')).toBeTruthy();
    });

    view.unmount();
  });

  it('URL invalida volta para Visao geral', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage('/admin?module=invalido');

    expect(
      screen.getByTestId('overview-tab'),
    ).toBeTruthy();
  });

  it('secretaria pode acessar a estrutura academica', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'SECRETARY',
      },
      currentRole: 'SECRETARY',
    });

    renderAdminPage('/admin?module=subjects');

    expect(
      screen.getByTestId('subjects-tab'),
    ).toBeTruthy();
  });

  it('checklist navega alterando o modulo ativo pela URL', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage('/admin?module=overview');

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir modulo pelo checklist/i,
      }),
    );

    expect(
      screen.getByTestId('subjects-tab'),
    ).toBeTruthy();
  });
});

describe('AdminPage permissions', () => {
  it('permite ADMIN acessar diretores e bloqueia a lista generica de usuarios', () => {
    renderAdminPage('/admin?module=directors');

    expect(
      screen.getByTestId('school-users-tab').textContent,
    ).toBeTruthy();

    cleanup();
    mockAdminState();
    renderAdminPage('/admin?module=school-users');

    expect(
      screen.getByTestId('overview-tab'),
    ).toBeTruthy();
  });

  it('renderiza operacao academica completa para DIRECTOR', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage('/admin?module=academic-policies');

    expect(
      screen.getByTestId(
        'academic-policy-panel',
      ),
    ).toBeTruthy();
  });

  it('permite SECRETARY administrar a operacao e a estrutura escolar', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'SECRETARY',
      },
      currentRole: 'SECRETARY',
    });

    renderAdminPage('/admin?module=enrollments');

    expect(
      screen.getByTestId('enrollments-tab'),
    ).toBeTruthy();

    cleanup();
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'SECRETARY',
      },
      currentRole: 'SECRETARY',
    });
    renderAdminPage('/admin?module=assignments');

    expect(
      screen.getByTestId('assignments-tab'),
    ).toBeTruthy();
  });

  it('preserva acesso completo do SUPER_ADMIN dentro da instituicao selecionada', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'ADMIN',
        platform_role: 'SUPER_ADMIN',
      },
      currentRole: null,
    });

    renderAdminPage('/admin?module=subjects');

    expect(
      screen.getByTestId('subjects-tab'),
    ).toBeTruthy();
  });

  it('redireciona para login quando nao ha perfil', () => {
    mockAdminState({
      profile: null,
      currentRole: null,
      institutionId: null,
    });

    renderAdminPage();

    expect(
      screen.getByText('Tela de login'),
    ).toBeTruthy();
  });

  it('redireciona para platform quando o papel efetivo nao tem permissoes administrativas', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'TEACHER',
      },
      currentRole: 'TEACHER',
    });

    renderAdminPage();

    expect(
      screen.getByText('Selecao de instituicao'),
    ).toBeTruthy();
  });
});
