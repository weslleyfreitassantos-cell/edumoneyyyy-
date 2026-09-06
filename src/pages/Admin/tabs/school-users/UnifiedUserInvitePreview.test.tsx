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
import { SchoolUserInviteServiceError } from '../../../../services/schoolUserInviteService';

const currentDirectory = dirname(
  fileURLToPath(import.meta.url),
);

const mutateAsync = vi.fn();
const saveAcademicMutateAsync = vi.fn();

vi.mock(
  '../../../../hooks/useSchoolUserInvites',
  () => ({
    useInviteSchoolUser: () => ({
      isPending: false,
      mutateAsync,
    }),
  }),
);

vi.mock('../../../../hooks/useAcademicAutomation', () => ({
  useSaveTeacherAcademicSettings: () => ({
    isPending: false,
    mutateAsync: saveAcademicMutateAsync,
  }),
  useSchoolTimeSlots: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../../../hooks/useSubjects', () => ({
  useSubjects: () => ({
    data: [
      { id: 'subject-math', name: 'Matemática', active: true },
      { id: 'subject-portuguese', name: 'Português', active: true },
    ],
    isLoading: false,
    isError: false,
  }),
}));

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
  saveAcademicMutateAsync.mockReset();
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
  saveAcademicMutateAsync.mockResolvedValue(undefined);
});

describe('UnifiedUserInvitePreview', () => {
  it('renderiza formulario real de acesso', () => {
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
  });

  it('renderiza somente o cadastro especifico quando recebe um unico destino', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
        allowedTargets={['DIRECTOR']}
        heading="Cadastro de diretor"
      />,
    );

    expect(
      screen.getByText('Cadastro de diretor'),
    ).toBeTruthy();
    expect(screen.getByText('Diretor')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /^Aluno$/i }),
    ).toBeNull();
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
          name: /Criar e enviar acesso/,
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
    fireEvent.click(screen.getByLabelText('Matemática'));
    fireEvent.click(
      screen.getByRole('button', {
        name: /Adicionar janela/,
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Criar e enviar acesso/,
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
      expect(saveAcademicMutateAsync).toHaveBeenCalledWith({
        institution_id:
          defaultProps.institutionId,
        teacher_profile_id:
          '11111111-1111-4111-8111-111111111111',
        subject_ids: ['subject-math'],
        primary_subject_id: undefined,
        availability: [{
          day_of_week: 1,
          start_time: '07:00',
          end_time: '12:00',
        }],
      });
    });
  });

  it('exige disciplina e disponibilidade antes de criar professor', async () => {
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
      { target: { value: 'Professor Sem Configuração' } },
    );
    fireEvent.change(
      screen.getByLabelText(/E-mail/),
      { target: { value: 'sem-config@escola.com' } },
    );

    expect(
      screen.getByText(/Selecione pelo menos uma disciplina/i),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Criar e enviar acesso/ }).hasAttribute('disabled'),
    ).toBe(true);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('mostra erro especifico de e-mail ja cadastrado sem limpar formulario', async () => {
    mutateAsync.mockRejectedValueOnce(
      new SchoolUserInviteServiceError(
        'Já existe um usuário cadastrado com este e-mail.',
        'EMAIL_ALREADY_REGISTERED',
        {
          email: 'Este e-mail já está cadastrado.',
        },
      ),
    );

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
          value: 'professor@escola.com',
        },
      },
    );
    fireEvent.click(screen.getByLabelText('Matemática'));
    fireEvent.click(
      screen.getByRole('button', {
        name: /Adicionar janela/,
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Criar e enviar acesso/,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Este e-mail já está cadastrado.',
        ),
      ).toBeTruthy();
      expect(
        screen.getByDisplayValue(
          'professor@escola.com',
        ),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: /Criar e enviar acesso/,
        }).hasAttribute('disabled'),
      ).toBe(false);
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
        name: /Criar e enviar acesso/,
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

  it('habilita diretor como role real para ADMIN', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    expect(
      screen
        .getByRole('button', {
          name: /^Diretor/,
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
        name: /Professor/,
      }),
    ).toBeTruthy();
  });

  it('permite secretaria convidar professor, aluno e responsavel', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
        currentRole="SECRETARY"
      />,
    );

    expect(
      screen.getByRole('button', {
        name: /Professor/,
      }),
    ).toBeTruthy();
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
