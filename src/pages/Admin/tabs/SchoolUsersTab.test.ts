// @vitest-environment jsdom

import { createElement } from 'react';
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

import type { SchoolUserRow } from '../../../services/schoolUserService';
import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useManageSchoolUser } from '../../../hooks/useSchoolUserManagement';
import { useSchoolUsers } from '../../../hooks/useSchoolUsers';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../../../hooks/useSchoolUsers', () => ({
  useSchoolUsers: vi.fn(),
}));

vi.mock('../../../hooks/useSchoolUserManagement', () => ({
  useManageSchoolUser: vi.fn(),
}));

vi.mock(
  './school-users/UnifiedUserInvitePreview',
  () => ({
    default: vi.fn(() => null),
  }),
);

import UnifiedUserInvitePreview from './school-users/UnifiedUserInvitePreview';
import {
  default as SchoolUsersTab,
  filterSchoolUsers,
  getSchoolUserAccessStatus,
  getSchoolUserSummary,
} from './SchoolUsersTab';

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCurrentInstitution = vi.mocked(
  useCurrentInstitution,
);
const mockedUseSchoolUsers = vi.mocked(
  useSchoolUsers,
);
const mockedUseManageSchoolUser = vi.mocked(
  useManageSchoolUser,
);
const mockedUnifiedUserInvitePreview =
  vi.mocked(UnifiedUserInvitePreview);

const users: SchoolUserRow[] = [
  {
    id: 'membership-1',
    profile_id: 'profile-1',
    institution_id: 'institution-1',
    role: 'ADMIN',
    active: true,
    joined_at: '2026-01-10',
    profile: {
      full_name: 'Ana Admin',
      email: 'ana@escola.com',
      active: true,
    },
  },
  {
    id: 'membership-2',
    profile_id: 'profile-2',
    institution_id: 'institution-1',
    role: 'DIRECTOR',
    active: false,
    joined_at: '2026-01-11',
    profile: {
      full_name: 'Diego Diretor',
      email: 'direcao@escola.com',
      active: true,
    },
  },
  {
    id: 'membership-3',
    profile_id: 'profile-3',
    institution_id: 'institution-1',
    role: 'TEACHER',
    active: true,
    joined_at: '2026-01-12',
    profile: {
      full_name: 'Patricia Professora',
      email: 'patricia@escola.com',
      active: true,
    },
  },
];

function createRoleFixture(
  role: SchoolUserRow['role'],
  count: number,
  namePrefix: string,
): SchoolUserRow[] {
  return Array.from({ length: count }, (_, index) => ({
    ...users[0],
    id: `${role.toLowerCase()}-${index + 1}`,
    profile_id: `${role.toLowerCase()}-profile-${index + 1}`,
    role,
    profile: {
      ...users[0].profile!,
      full_name: `${namePrefix} ${index + 1}`,
      email: `${role.toLowerCase()}${index + 1}@escola.com`,
    },
  }));
}

const directorPanelUsers: SchoolUserRow[] = [
  {
    ...users[1],
    id: 'director-1',
    profile_id: 'director-profile-1',
    active: true,
    profile: {
      ...users[1].profile!,
      full_name: 'Diretor Principal',
      email: 'diretor@escola.com',
      active: true,
    },
  },
  ...createRoleFixture('TEACHER', 25, 'Professor'),
  ...createRoleFixture('STUDENT', 29, 'Aluno'),
  ...createRoleFixture('GUARDIAN', 27, 'Responsável'),
];

const secretaryPanelUsers: SchoolUserRow[] = [
  {
    ...users[0],
    id: 'secretary-1',
    profile_id: 'secretary-profile-1',
    role: 'SECRETARY',
    active: true,
    profile: {
      ...users[0].profile!,
      full_name: 'Secretária Ativa',
      email: 'secretaria.ativa@escola.com',
    },
  },
  {
    ...users[0],
    id: 'secretary-2',
    profile_id: 'secretary-profile-2',
    role: 'SECRETARY',
    active: false,
    profile: {
      ...users[0].profile!,
      full_name: 'Secretária Inativa',
      email: 'secretaria.inativa@escola.com',
    },
  },
  ...createRoleFixture('TEACHER', 1, 'Professor'),
];

function mockTabState({
  institutionId = 'institution-1',
  currentRole = 'ADMIN',
}: {
  institutionId?: string;
  currentRole?: string | null;
} = {}) {
  mockedUseAuth.mockReturnValue({
    user: null,
    profile: {
      id: 'profile-1',
      full_name: 'Ana Admin',
      email: 'ana@escola.com',
      role: 'ADMIN',
      platform_role: 'USER',
      avatar_url: null,
    },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

  mockedUseCurrentInstitution.mockReturnValue({
    data: institutionId,
    institution: {
      id: institutionId,
      name: 'Escola Centro',
      active: true,
      account_id: 'account-1',
    },
    membership: {
      id: 'membership-current',
      institution_id: institutionId,
      role: currentRole ?? 'TEACHER',
      active: Boolean(currentRole),
    },
    currentInstitution: {
      id: institutionId,
      name: 'Escola Centro',
      active: true,
      account_id: 'account-1',
    },
    currentMembership: {
      id: 'membership-current',
      institution_id: institutionId,
      role: currentRole ?? 'TEACHER',
      active: Boolean(currentRole),
    },
    currentInstitutionId: institutionId,
    currentRole,
    isLoading: false,
    isError: false,
    error: null,
    message: null,
    refetch: vi.fn(),
  });

  mockedUseSchoolUsers.mockReturnValue({
    data: users,
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useSchoolUsers>);

  mockedUseManageSchoolUser.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useManageSchoolUser>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTabState();
});

afterEach(() => {
  cleanup();
});

describe('SchoolUsersTab helpers', () => {
  it('filtra usuarios por nome', () => {
    expect(
      filterSchoolUsers(
        users,
        'ALL',
        'ana',
      ).map((user) => user.id),
    ).toEqual(['membership-1']);
  });

  it('filtra usuarios por e-mail', () => {
    expect(
      filterSchoolUsers(
        users,
        'ALL',
        'direcao@escola.com',
      ).map((user) => user.id),
    ).toEqual(['membership-2']);
  });

  it('filtra usuarios por CPF com ou sem pontuacao', () => {
    const student = {
      ...users[0],
      cpf: '123.456.789-01',
    };

    expect(
      filterSchoolUsers(
        [student],
        'ALL',
        '12345678901',
      ),
    ).toHaveLength(1);

    expect(
      filterSchoolUsers(
        [student],
        'ALL',
        '123.456.789',
      ),
    ).toHaveLength(1);
  });

  it('filtra usuarios por label de papel', () => {
    expect(
      filterSchoolUsers(
        users,
        'ALL',
        'professor',
      ).map((user) => user.id),
    ).toEqual(['membership-3']);
  });

  it('combina busca com filtro por papel', () => {
    expect(
      filterSchoolUsers(
        users,
        'DIRECTOR',
        'admin',
      ),
    ).toHaveLength(0);
  });

  it('resume totais de usuarios por status e papel', () => {
    const summary =
      getSchoolUserSummary(users);

    expect(summary.total).toBe(3);
    expect(summary.active).toBe(2);
    expect(summary.inactive).toBe(1);
    expect(summary.byRole.ADMIN).toBe(1);
    expect(summary.byRole.DIRECTOR).toBe(1);
    expect(summary.byRole.TEACHER).toBe(1);
    expect(summary.byRole.STUDENT).toBe(0);
    expect(summary.byRole.GUARDIAN).toBe(0);
  });

  it('calcula o status efetivo combinando vinculo e perfil', () => {
    expect(getSchoolUserAccessStatus(users[0])).toEqual({
      active: true,
      reason: 'Acesso ativo',
    });

    expect(getSchoolUserAccessStatus(users[1])).toEqual({
      active: false,
      reason: 'Vínculo inativo',
    });

    expect(
      getSchoolUserAccessStatus({
        ...users[0],
        profile: {
          ...users[0].profile!,
          active: false,
        },
      }),
    ).toEqual({
      active: false,
      reason: 'Perfil inativo',
    });
  });
});

describe('SchoolUsersTab integration', () => {
  it('remove o cadastro unificado da lista geral de usuarios', () => {
    render(createElement(SchoolUsersTab));

    expect(mockedUnifiedUserInvitePreview).not.toHaveBeenCalled();
  });

  it('mantem o cadastro especifico quando a lista e restrita a um papel', () => {
    render(
      createElement(SchoolUsersTab, {
        fixedRole: 'SECRETARY',
        inviteTargets: ['SECRETARY'],
        inviteHeading: 'Cadastro de secretaria',
      }),
    );

    expect(
      mockedUnifiedUserInvitePreview.mock.calls[0]?.[0],
    ).toEqual(
      expect.objectContaining({
        institutionId: 'institution-1',
        currentRole: 'ADMIN',
        hasActiveInstitution: true,
        allowedTargets: ['SECRETARY'],
        heading: 'Cadastro de secretaria',
      }),
    );
  });

  it('renderiza o painel de diretores com resumo e controles especializados', () => {
    mockedUseSchoolUsers.mockReturnValue({
      data: directorPanelUsers,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useSchoolUsers>);

    render(createElement(SchoolUsersTab, { fixedRole: 'DIRECTOR' }));

    expect(screen.queryByText(/Exclusão protegida/)).toBeNull();
    expect(screen.queryByText('Total por papel')).toBeNull();
    expect(screen.queryByLabelText('Filtrar usuários por papel')).toBeNull();

    const totalCard = screen.getByText('Diretores cadastrados').closest('article');
    const activeCard = screen.getByText('Diretores ativos').closest('article');
    const inactiveCard = screen.getByText('Diretores inativos').closest('article');

    expect(totalCard?.textContent).toContain('1');
    expect(activeCard?.textContent).toContain('1');
    expect(inactiveCard?.textContent).toContain('0');

    expect(screen.queryByRole('button', { name: 'Todos' })).toBeNull();
    for (const label of ['Administração', 'Direção', 'Secretaria', 'Professores', 'Alunos', 'Responsáveis']) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${label}$`) })).toBeNull();
    }
  });

  it('renderiza o painel de secretaria sem misturar outros papéis no resumo', () => {
    mockedUseSchoolUsers.mockReturnValue({
      data: secretaryPanelUsers,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useSchoolUsers>);

    render(createElement(SchoolUsersTab, { fixedRole: 'SECRETARY' }));

    expect(screen.queryByText(/Exclusão protegida/)).toBeNull();
    expect(screen.queryByText('Total por papel')).toBeNull();
    expect(screen.queryByLabelText('Filtrar usuários por papel')).toBeNull();

    const totalCard = screen.getByText('Secretários cadastrados').closest('article');
    const activeCard = screen.getByText('Secretários ativos').closest('article');
    const inactiveCard = screen.getByText('Secretários inativos').closest('article');

    expect(totalCard?.textContent).toContain('2');
    expect(activeCard?.textContent).toContain('1');
    expect(inactiveCard?.textContent).toContain('1');
  });

  it('preserva a visão global sem fixedRole', () => {
    render(createElement(SchoolUsersTab));

    expect(screen.getByText(/Exclusão protegida/)).toBeTruthy();
    expect(screen.getByText('Total por papel')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar usuários por papel')).toBeTruthy();
    expect(screen.getByText('Usuários vinculados')).toBeTruthy();
    expect(screen.getByText('Vínculos ativos')).toBeTruthy();
    expect(screen.getByText('Vínculos inativos')).toBeTruthy();
  });

  it('mostra acoes de editar e excluir usuarios', () => {
    mockTabState({ currentRole: 'DIRECTOR' });
    render(createElement(SchoolUsersTab));

    expect(
      screen.getByRole('button', {
        name: /Editar Patricia Professora/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: /Excluir Patricia Professora/i,
      }),
    ).toBeTruthy();
  });

  it('remove a geracao de senha aleatoria e mantem a senha manual na edicao', () => {
    mockTabState({ currentRole: 'DIRECTOR' });
    render(createElement(SchoolUsersTab));

    expect(
      screen.queryByRole('button', {
        name: /Gerar nova senha de acesso/i,
      }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Editar Patricia Professora/i,
      }),
    );

    expect(screen.getByLabelText('Nova senha')).toBeTruthy();
  });

  it('limita a lista a dez usuarios por pagina e permite avancar', () => {
    const manyUsers = Array.from(
      { length: 11 },
      (_, index) => ({
        ...users[0],
        id: `membership-${index + 10}`,
        profile_id: `profile-${index + 10}`,
        profile: {
          ...users[0].profile,
          full_name: `Aluno ${String(index + 1).padStart(2, '0')}`,
          email: `aluno${index + 1}@escola.com`,
        },
      }),
    );

    mockedUseSchoolUsers.mockReturnValue({
      data: manyUsers,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useSchoolUsers>);

    render(createElement(SchoolUsersTab));

    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
    expect(screen.getByText('Aluno 01')).toBeTruthy();
    expect(screen.getByText('Aluno 06')).toBeTruthy();
    expect(screen.queryByText('Aluno 07')).toBeNull();
    expect(screen.queryByText('Aluno 11')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Próxima página',
      }),
    );

    expect(screen.getByText('Página 2 de 2')).toBeTruthy();
    expect(screen.getByText('Aluno 11')).toBeTruthy();
  });


  it('mostra carregamento durante sincronizacao da instituicao sem falsa falta de permissao', () => {
    mockTabState({
      institutionId: '',
      currentRole: null,
    });
    mockedUseCurrentInstitution.mockReturnValue({
      data: null,
      institution: null,
      membership: null,
      currentInstitution: null,
      currentMembership: null,
      currentInstitutionId: null,
      currentRole: null,
      isLoading: true,
      isError: false,
      error: null,
      message: null,
      refetch: vi.fn(async () => undefined),
    });

    render(createElement(SchoolUsersTab));

    expect(
      screen.getByText(/Carregando institu/i),
    ).toBeTruthy();
    expect(
      screen.queryByText(/papel efetivo/i),
    ).toBeNull();
  });
});
