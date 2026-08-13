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
});

describe('SchoolUsersTab integration', () => {
  it('passa a instituicao ativa para o cadastro unificado', () => {
    render(createElement(SchoolUsersTab));

    expect(
      mockedUnifiedUserInvitePreview.mock
        .calls[0]?.[0],
    ).toEqual(
      expect.objectContaining({
        institutionId: 'institution-1',
        currentRole: 'ADMIN',
        hasActiveInstitution: true,
      }),
    );
  });

  it('mostra acoes de editar e excluir usuarios', () => {
    render(createElement(SchoolUsersTab));

    expect(
      screen.getByRole('button', {
        name: /Editar Ana Admin/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: /Excluir Ana Admin/i,
      }),
    ).toBeTruthy();
  });

  it('envia a nova senha no payload da funcao depois da confirmacao na UI', () => {
    const mutate = vi.fn();
    mockedUseManageSchoolUser.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useManageSchoolUser>);

    render(createElement(SchoolUsersTab));

    fireEvent.click(
      screen.getByRole('button', { name: /Editar Ana Admin/i }),
    );
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'NovaSenha123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        institutionId: 'institution-1',
        membershipId: 'membership-1',
        password: 'NovaSenha123',
      }),
      expect.any(Object),
    );
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
