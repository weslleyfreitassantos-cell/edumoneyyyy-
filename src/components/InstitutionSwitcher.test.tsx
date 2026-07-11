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

import { useInstitution } from '../contexts/InstitutionContext';
import type { UserInstitution } from '../services/institutionService';
import InstitutionSwitcher from './InstitutionSwitcher';

vi.mock('../contexts/InstitutionContext', () => ({
  useInstitution: vi.fn(),
}));

const mockedUseInstitution =
  vi.mocked(useInstitution);

const firstInstitution: UserInstitution = {
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
};

const secondInstitution: UserInstitution = {
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
};

function mockInstitutionContext(
  overrides: Partial<
    ReturnType<typeof useInstitution>
  > = {},
): ReturnType<typeof useInstitution> {
  return {
    institutions: [firstInstitution],
    currentInstitution:
      firstInstitution.institution,
    currentMembership:
      firstInstitution.membership,
    currentInstitutionId:
      firstInstitution.institution.id,
    currentRole:
      firstInstitution.membership.role,
    isLoading: false,
    error: null,
    hasMultipleInstitutions: false,
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

describe('InstitutionSwitcher', () => {
  it('mostra o nome da escola unica', () => {
    mockedUseInstitution.mockReturnValue(
      mockInstitutionContext(),
    );

    render(<InstitutionSwitcher />);

    expect(
      screen.getByText('Escola Centro'),
    ).toBeTruthy();
    expect(
      screen.getByText('Administração'),
    ).toBeTruthy();
  });

  it('mostra select quando ha multiplas escolas', () => {
    mockedUseInstitution.mockReturnValue(
      mockInstitutionContext({
        institutions: [
          firstInstitution,
          secondInstitution,
        ],
        hasMultipleInstitutions: true,
      }),
    );

    render(<InstitutionSwitcher />);

    const select = screen.getByLabelText(
      'Selecionar escola atual',
    );

    expect(select).toBeTruthy();
    expect(
      screen.getByText(
        'Escola Norte - Direção',
      ),
    ).toBeTruthy();
  });

  it('mostra estado vazio quando nao ha escola ativa', () => {
    mockedUseInstitution.mockReturnValue(
      mockInstitutionContext({
        institutions: [],
        currentInstitution: null,
        currentMembership: null,
        currentInstitutionId: null,
        currentRole: null,
      }),
    );

    render(<InstitutionSwitcher />);

    expect(
      screen.getByText('Nenhuma escola ativa'),
    ).toBeTruthy();
  });

  it('chama setCurrentInstitutionId ao trocar escola', () => {
    const setCurrentInstitutionId = vi.fn();

    mockedUseInstitution.mockReturnValue(
      mockInstitutionContext({
        institutions: [
          firstInstitution,
          secondInstitution,
        ],
        hasMultipleInstitutions: true,
        setCurrentInstitutionId,
      }),
    );

    render(<InstitutionSwitcher />);

    fireEvent.change(
      screen.getByLabelText(
        'Selecionar escola atual',
      ),
      {
        target: {
          value: 'institution-2',
        },
      },
    );

    expect(setCurrentInstitutionId).toHaveBeenCalledWith(
      'institution-2',
    );
  });
});
