// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DashboardAnnouncements from './DashboardAnnouncements';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DashboardAnnouncements', () => {
  it('mostra a pendência do aluno e permite abrir o cadastro pessoal', () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');

    render(
      <DashboardAnnouncements
        announcements={[]}
        registration={{
          role: 'STUDENT',
          pendingItems: [{
            id: 'personal-data',
            label: 'Dados pessoais',
            description: 'Complete seus dados pessoais e de endereço no cadastro.',
          }],
        }}
        role="student"
      />,
    );

    expect(screen.getByText('Cadastro com pendências')).toBeTruthy();
    expect(screen.getByText('Dados pessoais:')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar meu cadastro' }));

    expect(dispatchEvent).toHaveBeenCalledWith(expect.any(Event));
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe('open-self-registration');
  });
});
