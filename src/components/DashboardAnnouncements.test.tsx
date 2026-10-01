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

  it('mantém avisos em faixa horizontal no celular e não exibe sucesso permanente', () => {
    render(
      <DashboardAnnouncements
        announcements={[
          { id: 'notice-1', title: 'Reunião', message: 'Reunião na sexta.', starts_at: '2026-09-20T12:00:00Z' },
          { id: 'notice-2', title: 'Material', message: 'Material disponível.', starts_at: '2026-09-21T12:00:00Z' },
        ] as never}
        registration={{ role: 'STUDENT', pendingItems: [] }}
        role="student"
      />,
    );

    const strip = screen.getByRole('region', { name: /Avisos publicados/ });
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.className).toContain('snap-x');
    expect(strip.getAttribute('tabindex')).toBe('0');
    expect(screen.getByText('Reunião')).toBeTruthy();
    expect(screen.getByText('Material')).toBeTruthy();
    expect(screen.queryByText('Seu cadastro está sem pendências obrigatórias.')).toBeNull();
  });

  it('oferece recuperação acessível quando os avisos falham', () => {
    const onRetry = vi.fn();
    render(
      <DashboardAnnouncements
        announcements={[]}
        isError
        onRetry={onRetry}
        role="guardian"
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('temporariamente indisponíveis');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
