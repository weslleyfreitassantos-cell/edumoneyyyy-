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

import {
  useAuth,
} from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import {
  useCreateManyMissingSubjects,
  useCreateSubject,
  useSetSubjectActive,
  useSubjects,
  useUpdateSubject,
} from '../../../hooks/useSubjects';
import type {
  SubjectRow,
} from '../../../services/subjectService';

import SubjectsTab from './SubjectsTab';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../../../hooks/useSubjects', () => ({
  useSubjects: vi.fn(),
  useCreateSubject: vi.fn(),
  useCreateManyMissingSubjects: vi.fn(),
  useUpdateSubject: vi.fn(),
  useSetSubjectActive: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCurrentInstitution = vi.mocked(
  useCurrentInstitution,
);
const mockedUseSubjects = vi.mocked(useSubjects);
const mockedUseCreateSubject = vi.mocked(
  useCreateSubject,
);
const mockedUseCreateManyMissingSubjects =
  vi.mocked(useCreateManyMissingSubjects);
const mockedUseUpdateSubject = vi.mocked(
  useUpdateSubject,
);
const mockedUseSetSubjectActive = vi.mocked(
  useSetSubjectActive,
);

const createManyMutateAsync = vi.fn();

function subject(
  overrides: Partial<SubjectRow>,
): SubjectRow {
  return {
    id: overrides.id ?? 'subject-1',
    institution_id:
      overrides.institution_id ??
      'institution-1',
    name: overrides.name ?? 'Matemática',
    code: overrides.code ?? 'MAT',
    workload: overrides.workload ?? null,
    active: overrides.active ?? true,
    active_offerings_count:
      overrides.active_offerings_count ?? 0,
  };
}

function mockSubjectState({
  subjects = [],
}: {
  subjects?: SubjectRow[];
} = {}) {
  mockedUseAuth.mockReturnValue({
    user: null,
    profile: {
      id: 'profile-1',
      full_name: 'Ana Admin',
      email: 'ana@example.com',
      role: 'DIRECTOR',
      platform_role: 'USER',
      avatar_url: null,
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
    currentRole: 'DIRECTOR',
    isLoading: false,
    isError: false,
    error: null,
    message: null,
    refetch: vi.fn(),
  });

  mockedUseSubjects.mockReturnValue({
    data: subjects,
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useSubjects>);

  mockedUseCreateSubject.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateSubject>);

  mockedUseCreateManyMissingSubjects.mockReturnValue({
    mutateAsync: createManyMutateAsync,
    isPending: false,
  } as unknown as ReturnType<
    typeof useCreateManyMissingSubjects
  >);

  mockedUseUpdateSubject.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateSubject>);

  mockedUseSetSubjectActive.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    variables: null,
  } as unknown as ReturnType<typeof useSetSubjectActive>);
}

function renderSubjectsTab() {
  render(<SubjectsTab />);
}

function openBnccModal() {
  renderSubjectsTab();

  fireEvent.click(
    screen.getByRole('button', {
      name: /adicionar modelo bncc/i,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  createManyMutateAsync.mockResolvedValue({
    created: [],
    skipped: [],
  });
  mockSubjectState();
});

afterEach(() => {
  cleanup();
});

describe('SubjectsTab BNCC templates', () => {
  it('mostra as tres etapas disponiveis', () => {
    openBnccModal();

    expect(
      screen.getByRole('checkbox', {
        name: /ensino fundamental - anos iniciais/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('checkbox', {
        name: /ensino fundamental - anos finais/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('checkbox', {
        name: /ensino m.dio/i,
      }),
    ).toBeTruthy();
  });

  it('anos iniciais nao seleciona Ingles e deixa Ensino Religioso opcional', () => {
    openBnccModal();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /anos iniciais/i,
      }),
    );

    expect(
      screen.queryByDisplayValue(
        /L.ngua Inglesa/i,
      ),
    ).toBeNull();
    expect(
      (
        screen.getByRole('checkbox', {
          name: /selecionar l.ngua portuguesa/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('checkbox', {
          name: /selecionar ensino religioso/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it('anos finais seleciona Ingles por padrao', () => {
    openBnccModal();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /anos finais/i,
      }),
    );

    expect(
      (
        screen.getByRole('checkbox', {
          name: /selecionar l.ngua inglesa/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('Ensino Medio mostra os componentes correspondentes', () => {
    openBnccModal();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /ensino m.dio/i,
      }),
    );

    [
      /Biologia/i,
      /Qu.mica/i,
      /Filosofia/i,
      /Sociologia/i,
    ].forEach((name) => {
      expect(
        screen.getByDisplayValue(name),
      ).toBeTruthy();
    });

    expect(
      screen.getByLabelText(
        /nome da disciplina physics/i,
      ),
    ).toBeTruthy();
  });

  it('permite revisar selecao, editar codigo e pesquisar', () => {
    openBnccModal();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /ensino m.dio/i,
      }),
    );

    const artCheckbox =
      screen.getByRole('checkbox', {
        name: /selecionar arte/i,
      });

    expect(
      (artCheckbox as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(artCheckbox);

    expect(
      (artCheckbox as HTMLInputElement).checked,
    ).toBe(false);

    fireEvent.change(
      screen.getByDisplayValue('ART'),
      {
        target: {
          value: 'ARTES',
        },
      },
    );

    expect(
      screen.getByDisplayValue('ARTES'),
    ).toBeTruthy();

    fireEvent.change(
      screen.getByLabelText(
        /pesquisar disciplinas/i,
      ),
      {
        target: {
          value: 'bio',
        },
      },
    );

    expect(
      screen.getByDisplayValue(/Biologia/i),
    ).toBeTruthy();
    expect(
      screen.queryByDisplayValue(
        /Matem.tica/i,
      ),
    ).toBeNull();
  });

  it('mostra quantas serao criadas e quantas ja existem', () => {
    mockSubjectState({
      subjects: [
        subject({
          id: 'subject-math',
          name: 'matemática',
          code: 'MAT',
        }),
      ],
    });

    openBnccModal();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /anos iniciais/i,
      }),
    );

    expect(
      screen.getByText(
        /6 ser.o criadas . 1 j. existem . 0 conflitos/i,
      ),
    ).toBeTruthy();
  });

  it('nao preenche workload ao criar modelo BNCC', async () => {
    openBnccModal();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /anos finais/i,
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /adicionar disciplinas/i,
      }),
    );

    await waitFor(() => {
      expect(
        createManyMutateAsync,
      ).toHaveBeenCalled();
    });

    const payload =
      createManyMutateAsync.mock.calls[0]?.[0];

    expect(payload.institutionId).toBe(
      'institution-1',
    );
    expect(
      payload.subjects.length,
    ).toBeGreaterThan(0);
    expect(
      payload.subjects.every(
        (item: { workload: null }) =>
          item.workload === null,
      ),
    ).toBe(true);
  });
});
