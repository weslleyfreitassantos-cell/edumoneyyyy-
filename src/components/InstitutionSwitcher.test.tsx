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

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import type { UserInstitution } from '../services/institutionService';
import InstitutionSwitcher from './InstitutionSwitcher';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../contexts/InstitutionContext', () => ({
  useInstitution: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
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
    setCurrentInstitutionId: vi.fn(
      async (institutionId: string) => ({
        success: true as const,
        institutionId,
      }),
    ),
    clearCurrentInstitutionSelection: vi.fn(),
    refresh: vi.fn(async () => undefined),
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    user: { id: 'user-1' } as never,
    profile: {
      id: 'user-1',
      full_name: 'Ana Silva',
      email: 'ana@example.com',
      avatar_url: null,
      role: 'ADMIN',
      platform_role: 'USER',
    },
    loading: false,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  });
  mockedUseInstitution.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('InstitutionSwitcher', () => {
  it('mostra loading acessivel', () => {
    mockedUseInstitution.mockReturnValue(
      mockInstitutionContext({
        isLoading: true,
      }),
    );

    render(<InstitutionSwitcher />);

    expect(
      screen.getByRole('status').textContent,
    ).toMatch(/Carregando escola/i);
  });

  it('mostra erro preservando mensagem global', () => {
    mockedUseInstitution.mockReturnValue(
      mockInstitutionContext({
        error: new Error('Falha'),
      }),
    );

    render(<InstitutionSwitcher />);

    expect(
      screen.getByRole('status').textContent,
    ).toMatch(/carregar escolas/i);
  });

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
    ) as HTMLSelectElement;

    expect(select).toBeTruthy();
    expect(select.value).toBe('institution-1');
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
    const setCurrentInstitutionId = vi.fn(
      async (institutionId: string) => ({
        success: true as const,
        institutionId,
      }),
    );

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

  it('gera ids diferentes para duas instancias no mesmo DOM', () => {
    mockedUseInstitution.mockReturnValue(
      mockInstitutionContext({
        institutions: [
          firstInstitution,
          secondInstitution,
        ],
        hasMultipleInstitutions: true,
      }),
    );

    render(
      <>
        <InstitutionSwitcher />
        <InstitutionSwitcher />
      </>,
    );

    const selects =
      screen.getAllByLabelText(
        'Selecionar escola atual',
      ) as HTMLSelectElement[];
    const ids = selects.map((select) => select.id);

    expect(selects.length).toBe(2);
    expect(new Set(ids).size).toBe(2);

    selects.forEach((select) => {
      const label = document.querySelector(
        `label[for="${select.id}"]`,
      );
      const descriptionId =
        select.getAttribute('aria-describedby');

      expect(label).toBeTruthy();
      expect(descriptionId).toBeTruthy();
      expect(
        descriptionId
          ? document.getElementById(descriptionId)
          : null,
      ).toBeTruthy();
    });
  });
});
