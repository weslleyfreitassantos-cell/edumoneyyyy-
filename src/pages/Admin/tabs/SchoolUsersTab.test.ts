// @vitest-environment jsdom

import { createElement } from 'react';
import {
  cleanup,
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

  it('habilita novo usuario para ADMIN ativo', () => {
    render(createElement(SchoolUsersTab));

    expect(
      screen
        .getByRole('button', {
          name: /Novo/,
        })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('desabilita novo usuario sem permissao efetiva', () => {
    mockTabState({
      currentRole: 'TEACHER',
    });

    render(createElement(SchoolUsersTab));

    expect(
      screen
        .getByRole('button', {
          name: /Novo/,
        })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});
