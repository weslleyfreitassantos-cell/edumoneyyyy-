// @vitest-environment jsdom

import {
  cleanup,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useInstitution } from '../contexts/InstitutionContext';
import { useCurrentInstitution } from './useCurrentInstitution';

vi.mock('../contexts/InstitutionContext', () => ({
  useInstitution: vi.fn(),
}));

const mockedUseInstitution =
  vi.mocked(useInstitution);

function mockInstitutionContext(
  overrides: Partial<
    ReturnType<typeof useInstitution>
  > = {},
): ReturnType<typeof useInstitution> {
  return {
    institutions: [
      {
        membership: {
          id: 'membership-1',
          institution_id: 'institution-1',
          role: 'ADMIN',
          active: true,
        },
        institution: {
          id: 'institution-1',
          name: 'Escola Centro',
          active: true,
          account_id: null,
        },
        account: null,
        accessSource: 'legacy_admin_membership',
        effectiveRole: 'ADMIN',
      },
      {
        membership: {
          id: 'membership-2',
          institution_id: 'institution-2',
          role: 'DIRECTOR',
          active: true,
        },
        institution: {
          id: 'institution-2',
          name: 'Escola Norte',
          active: true,
          account_id: 'account-1',
        },
        account: null,
        accessSource: 'membership',
        effectiveRole: 'DIRECTOR',
      },
    ],
    currentInstitution: {
      id: 'institution-2',
      name: 'Escola Norte',
      active: true,
      account_id: 'account-1',
    },
    currentMembership: {
      id: 'membership-2',
      institution_id: 'institution-2',
      role: 'DIRECTOR',
      active: true,
    },
    currentInstitutionId: 'institution-2',
    currentRole: 'DIRECTOR',
    isLoading: false,
    error: null,
    hasMultipleInstitutions: true,
    setCurrentInstitutionId: vi.fn(),
    clearCurrentInstitutionSelection: vi.fn(),
    refresh: vi.fn(async () => undefined),
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseInstitution.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('useCurrentInstitution', () => {
  it('retorna a escola selecionada sem falhar com multiplas escolas', () => {
    mockedUseInstitution.mockReturnValue(
      mockInstitutionContext(),
    );

    const { result } = renderHook(() =>
      useCurrentInstitution('profile-1'),
    );

    expect(result.current.data).toBe(
      'institution-2',
    );
    expect(result.current.isError).toBe(false);
    expect(
      result.current.currentInstitution?.name,
    ).toBe('Escola Norte');
  });

  it('retorna null e mensagem amigavel sem escola ativa', () => {
    mockedUseInstitution.mockReturnValue(
      mockInstitutionContext({
        institutions: [],
        currentInstitution: null,
        currentMembership: null,
        currentInstitutionId: null,
        currentRole: null,
        hasMultipleInstitutions: false,
      }),
    );

    const { result } = renderHook(() =>
      useCurrentInstitution('profile-1'),
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
    expect(result.current.message).toBe(
      'Nenhuma escola ativa foi encontrada para este usuário.',
    );
  });
});
