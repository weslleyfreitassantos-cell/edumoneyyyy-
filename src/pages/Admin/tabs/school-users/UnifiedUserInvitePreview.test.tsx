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
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import UnifiedUserInvitePreview from './UnifiedUserInvitePreview';

const currentDirectory = dirname(
  fileURLToPath(import.meta.url),
);

const defaultProps = {
  currentRole: 'ADMIN',
  profileRole: null,
  currentInstitutionName: 'Escola Centro',
  hasActiveInstitution: true,
};

afterEach(() => {
  cleanup();
});

describe('UnifiedUserInvitePreview', () => {
  it('renderiza titulo e aviso de previa visual', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    expect(
      screen.getByText(
        'Cadastro unificado de usuários',
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(
        /Nenhum usuário será criado/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('mantem o envio de convite desabilitado', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    const submitButton = screen.getByRole(
      'button',
      {
        name: /Enviar convite/,
      },
    );

    expect(
      submitButton.hasAttribute('disabled'),
    ).toBe(true);
  });

  it('troca tipo de usuario e mostra campos de responsavel', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Responsável/,
      }),
    );

    expect(
      screen.getByLabelText(
        /Nome do aluno vinculado/,
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(
        /guardianships/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('mostra aviso de bloqueio sem permissao efetiva', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
        currentRole="TEACHER"
        profileRole="ADMIN"
      />,
    );

    expect(
      screen.getByText(
        'Seu papel na escola ativa não permite gerenciar usuários.',
      ),
    ).toBeTruthy();
  });

  it('mostra planejados como ainda nao ativos no banco', () => {
    render(
      <UnifiedUserInvitePreview
        {...defaultProps}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Administração escolar/,
      }),
    );

    expect(
      screen.getByText(
        /SCHOOL_ADMIN ainda não existe no banco/,
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(
        /Ainda não ativo no banco/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('nao importa services nem chamadas Supabase', () => {
    const source = readFileSync(
      join(
        currentDirectory,
        'UnifiedUserInvitePreview.tsx',
      ),
      'utf8',
    );

    expect(source).not.toContain(
      '/services/',
    );
    expect(source).not.toContain('supabase');
    expect(source).not.toContain(
      'functions.invoke',
    );
  });
});
