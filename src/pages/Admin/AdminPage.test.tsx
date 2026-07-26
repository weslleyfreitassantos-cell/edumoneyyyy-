// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
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

import AdminPage from './AdminPage';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
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
  default: () => (
    <div data-testid="school-users-tab">
      Aba usuarios
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

vi.mock('./tabs/EnrollmentsTab', () => ({
  default: () => (
    <div data-testid="enrollments-tab">
      Aba matriculas
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

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCurrentInstitution = vi.mocked(
  useCurrentInstitution,
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

function renderAdminPage(route = '/admin') {
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/admin"
          element={<AdminPage />}
        />
        <Route
          path="/dashboard"
          element={<div>Dashboard destino</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function expectTabVisible(label: RegExp) {
  expect(
    screen.getByRole('button', {
      name: label,
    }),
  ).toBeTruthy();
}

function expectTabMissing(label: RegExp) {
  expect(
    screen.queryByRole('button', {
      name: label,
    }),
  ).toBeNull();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminState();
});

afterEach(() => {
  cleanup();
});

describe('AdminPage permissions', () => {
  it('agrupa modulos administrativos na navegacao interna', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage();

    const navigation = screen.getByRole(
      'navigation',
      {
        name: /m.dulos administrativos/i,
      },
    );

    expect(
      within(navigation).getByText(/in.cio/i),
    ).toBeTruthy();
    expect(
      within(navigation).getByText(/pessoas/i),
    ).toBeTruthy();
    expect(
      within(navigation).getByText(
        /estrutura escolar/i,
      ),
    ).toBeTruthy();
    expect(
      within(navigation).getByText(
        /opera..o acad.mica/i,
      ),
    ).toBeTruthy();

    expect(
      within(navigation).getByRole(
        'button',
        {
          name: /disciplinas/i,
        },
      ),
    ).toBeTruthy();
  });

  it('renderiza o conjunto atual de abas para ADMIN efetivo', () => {
    renderAdminPage();

    expectTabVisible(/vis/i);
    expectTabVisible(/frequ/i);
    expectTabVisible(/notas/i);
    expectTabVisible(/fechamento/i);
    expectTabVisible(/usu/i);

    expectTabMissing(/alunos/i);
    expectTabMissing(/professores/i);
    expectTabMissing(/respons/i);
    expectTabMissing(/ano letivo/i);
    expectTabMissing(/turmas/i);
    expectTabMissing(/disciplinas/i);
    expectTabMissing(/pol/i);
    expectTabMissing(/matr/i);
    expectTabMissing(/atribui/i);
  });

  it('renderiza operacao academica completa para DIRECTOR', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage();

    [
      /vis/i,
      /frequ/i,
      /notas/i,
      /fechamento/i,
      /usu/i,
      /alunos/i,
      /professores/i,
      /respons/i,
      /ano letivo/i,
      /turmas/i,
      /disciplinas/i,
      /pol/i,
      /matr/i,
      /atribui/i,
    ].forEach(expectTabVisible);

    fireEvent.click(
      screen.getByRole('button', {
        name: /alunos/i,
      }),
    );

    expect(
      screen.getByTestId('students-tab'),
    ).toBeTruthy();

    expect(
      screen.getByRole('button', {
        name: /alunos/i,
        current: 'page',
      }),
    ).toBeTruthy();
  });

  it('permite alterar modulo pelo seletor mobile', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage();

    fireEvent.change(
      screen.getByLabelText(
        /m.dulo administrativo/i,
      ),
      {
        target: {
          value: 'subjects',
        },
      },
    );

    expect(
      screen.getByTestId('subjects-tab'),
    ).toBeTruthy();
  });

  it('abre o modulo correspondente a partir do checklist', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
    });

    renderAdminPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir modulo pelo checklist/i,
      }),
    );

    expect(
      screen.getByTestId('subjects-tab'),
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

    renderAdminPage();

    [
      /vis/i,
      /frequ/i,
      /notas/i,
      /fechamento/i,
      /usu/i,
      /alunos/i,
      /professores/i,
      /respons/i,
      /ano letivo/i,
      /turmas/i,
      /disciplinas/i,
      /pol/i,
      /matr/i,
      /atribui/i,
    ].forEach(expectTabVisible);
  });

  it('limita SECRETARY a operacao escolar sem estrutura e atribuicoes', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'SECRETARY',
      },
      currentRole: 'SECRETARY',
    });

    renderAdminPage();

    [
      /vis/i,
      /frequ/i,
      /notas/i,
      /fechamento/i,
      /usu/i,
      /alunos/i,
      /professores/i,
      /respons/i,
      /matr/i,
    ].forEach(expectTabVisible);

    expectTabMissing(/ano letivo/i);
    expectTabMissing(/turmas/i);
    expectTabMissing(/disciplinas/i);
    expectTabMissing(/pol/i);
    expectTabMissing(/atribui/i);
  });

  it('redireciona para dashboard quando nao ha perfil', () => {
    mockAdminState({
      profile: null,
      currentRole: null,
      institutionId: null,
    });

    renderAdminPage();

    expect(
      screen.getByText('Dashboard destino'),
    ).toBeTruthy();
  });

  it('redireciona quando o papel efetivo nao tem permissoes administrativas', () => {
    mockAdminState({
      profile: {
        ...baseProfile,
        role: 'TEACHER',
      },
      currentRole: 'TEACHER',
    });

    renderAdminPage();

    expect(
      screen.getByText('Dashboard destino'),
    ).toBeTruthy();
  });
});
