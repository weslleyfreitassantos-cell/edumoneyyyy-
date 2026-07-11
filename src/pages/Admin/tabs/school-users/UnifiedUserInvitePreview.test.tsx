// @vitest-environment jsdom

import {
  readFileSync,
} from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';
import {
  fileURLToPath,
} from 'node:url';
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

import UnifiedUserInvitePreview from './UnifiedUserInvitePreview';

const currentDirectory = dirname(
  fileURLToPath(import.meta.url),
);

const mutateAsync = vi.fn();

vi.mock(
  '../../../../hooks/useSchoolUserInvites',
  () => ({
    useInviteSchoolUser: () => ({
      isPending: false,
      mutateAsync,
    }),
  }),
);

vi.mock('../../../../hooks/useStudents', () => ({
  useStudents: () => ({
    data: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        registration_number: 'RA-001',
        active: true,
        profiles: {
          full_name: 'Aluno Teste',
          email: 'aluno@escola.com',
          avatar_url: null,
        },
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

const defaultProps = {
  institutionId:
    '22222222-2222-4222-8222-222222222222',
  currentRole: 'ADMIN',
  profileRole: null,
  currentInstitutionName: 'Escola Centro',
  hasActiveInstitution: true,
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({
    success: true,
    userId:
      '11111111-1111-4111-8111-111111111111',
    profileId:
      '11111111-1111-4111-8111-111111111111',
    membershipId:
      '33333333-3333-4333-8333-333333333333',
    role: 'TEACHER',
    email: 'professor@escola.com',
    invitationSent: true,
    reusedExistingUser: false,
    message:
      'Convite enviado e vinculo criado com sucesso.',
  });
});

describe('UnifiedUserInvitePreview', () => {
  it('renderiza formulario real de convite', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    expect(
      screen.getByText(
        'Cadastro unificado de usuarios',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /invite-school-user/,
      ),
    ).toBeTruthy();
  });

  it('mantem envio desabilitado para formulario invalido', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    expect(
      screen
        .getByRole('button', {
          name: /Enviar convite/,
        })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('envia professor valido para a mutation', async () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Professor/,
      }),
    );
    fireEvent.change(
      screen.getByLabelText(/Nome completo/),
      {
        target: {
          value: 'Professor Teste',
        },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/E-mail/),
      {
        target: {
          value: 'PROFESSOR@ESCOLA.COM',
        },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Enviar convite/,
      }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        institutionId:
          defaultProps.institutionId,
        role: 'TEACHER',
        fullName: 'Professor Teste',
        email: 'professor@escola.com',
      });
    });
  });

  it('envia responsavel com studentId selecionado', async () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Respons/,
      }),
    );
    fireEvent.change(
      screen.getByLabelText(/Nome completo/),
      {
        target: {
          value: 'Responsavel Teste',
        },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/E-mail/),
      {
        target: {
          value: 'resp@escola.com',
        },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/Aluno da instituicao/),
      {
        target: {
          value:
            '44444444-4444-4444-8444-444444444444',
        },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/Relacionamento/),
      {
        target: {
          value: 'Mae',
        },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Enviar convite/,
      }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        institutionId:
          defaultProps.institutionId,
        role: 'GUARDIAN',
        fullName: 'Responsavel Teste',
        email: 'resp@escola.com',
        guardian: {
          studentId:
            '44444444-4444-4444-8444-444444444444',
          relationship: 'Mae',
        },
      });
    });
  });

  it('habilita secretaria como role real para ADMIN', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    expect(
      screen
        .getByRole('button', {
          name: /Secret/,
        })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('oculta DIRECTOR para diretor', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
        currentRole="DIRECTOR"
      />,
    );

    expect(
      screen.queryByRole('button', {
        name: /Diretor/,
      }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: /Secret/,
      }),
    ).toBeTruthy();
  });

  it('limita secretaria a aluno e responsavel', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
        currentRole="SECRETARY"
      />,
    );

    expect(
      screen.queryByRole('button', {
        name: /Professor/,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: /Diretor/,
      }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: /Aluno/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: /Respons/,
      }),
    ).toBeTruthy();
  });

  it('nao chama Supabase direto no componente', () => {
    const source = readFileSync(
      join(
        currentDirectory,
        'UnifiedUserInvitePreview.tsx',
      ),
      'utf8',
    );

    expect(source).not.toContain('supabase');
    expect(source).not.toContain(
      'functions.invoke',
    );
  });
});
