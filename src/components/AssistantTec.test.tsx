// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import AssistantTec from './AssistantTec';

afterEach(() => {
  cleanup();
});

function renderAssistant(
  role: 'student' | 'teacher' | 'director',
  availability: {
    platformRole?: string;
    membershipRole?: string;
    profileRole?: string;
  } = {},
  menuItems: { id: string; label: string; path: string }[] = [],
) {
  render(
    <MemoryRouter>
      <AssistantTec
        role={role}
        institutionId={null}
        {...availability}
        menuItems={menuItems}
      />
    </MemoryRouter>,
  );

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Abrir Assistente TEC',
    }),
  );
}

describe('AssistantTec', () => {
  it('encontra grade, materiais e avisos disponíveis para o aluno', () => {
    renderAssistant('student');
    const input = screen.getByRole('textbox', {
      name: 'Pergunte ao Assistente TEC',
    });

    fireEvent.change(input, { target: { value: 'grade de horário' } });
    expect(
      screen.getByRole('button', { name: /Grade de horário/i }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'avisos' } });
    expect(
      screen.getByRole('button', { name: /Materiais e avisos/i }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'livros' } });
    expect(
      screen.getByRole('button', { name: /Indicações de livros/i }),
    ).toBeTruthy();
  });

  it('exibe Diário de Classe e avaliações apenas para o professor', () => {
    renderAssistant('teacher');
    const input = screen.getByRole('textbox', {
      name: 'Pergunte ao Assistente TEC',
    });

    fireEvent.change(input, { target: { value: 'chamada' } });
    expect(
      screen.getByRole('button', { name: /^Diário de Classe/ }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'notas' } });
    expect(
      screen.getByRole('button', { name: /Avaliações e notas/i }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'livros' } });
    expect(
      screen.getByRole('button', { name: /Minhas indicações de livros/i }),
    ).toBeTruthy();
  });

  it('exibe comunicação somente quando a permissão efetiva existe', () => {
    renderAssistant('director', {
      platformRole: 'USER',
      membershipRole: 'DIRECTOR',
      profileRole: 'DIRECTOR',
    }, [
      { id: 'announcements', label: 'Avisos', path: '/admin?module=announcements' },
    ]);
    const input = screen.getByRole('textbox', {
      name: 'Pergunte ao Assistente TEC',
    });

    fireEvent.change(input, { target: { value: 'avisos' } });
    expect(
      screen.getByRole('button', { name: /^Avisos/ }),
    ).toBeTruthy();
  });

  it('não oferece recurso administrativo sem permissão efetiva', () => {
    renderAssistant('director', {
      platformRole: 'USER',
      membershipRole: 'TEACHER',
      profileRole: 'TEACHER',
    });
    const input = screen.getByRole('textbox', {
      name: 'Pergunte ao Assistente TEC',
    });

    fireEvent.change(input, { target: { value: 'financeiro' } });
    expect(
      screen.queryByRole('button', { name: /Financeiro/i }),
    ).toBeNull();
    expect(
      screen.getByText(/Não encontrei um recurso correspondente/i),
    ).toBeTruthy();
  });
});
