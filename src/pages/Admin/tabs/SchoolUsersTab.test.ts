import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { SchoolUserRow } from '../../../services/schoolUserService';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../../../hooks/useSchoolUsers', () => ({
  useSchoolUsers: vi.fn(),
}));

import {
  filterSchoolUsers,
  getSchoolUserSummary,
} from './SchoolUsersTab';

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
