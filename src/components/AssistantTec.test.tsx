// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import AssistantTec from './AssistantTec';

afterEach(() => {
  cleanup();
});

function renderAssistant(role: 'student' | 'teacher') {
  render(
    <MemoryRouter>
      <AssistantTec role={role} institutionId={null} />
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
  });

  it('exibe chamadas e avaliações apenas para o professor', () => {
    renderAssistant('teacher');
    const input = screen.getByRole('textbox', {
      name: 'Pergunte ao Assistente TEC',
    });

    fireEvent.change(input, { target: { value: 'chamada' } });
    expect(
      screen.getByRole('button', { name: /^Chamadas/ }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'notas' } });
    expect(
      screen.getByRole('button', { name: /Avaliações e notas/i }),
    ).toBeTruthy();
  });
});
