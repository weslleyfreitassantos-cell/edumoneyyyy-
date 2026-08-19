// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import TerminalsPage, { TERMINALS_URL, TerminalsFallback } from './TerminalsPage';

afterEach(() => {
  cleanup();
});

describe('TerminalsPage', () => {
  it('renderiza o sistema externo no iframe correto', () => {
    render(<TerminalsPage />);

    const iframe = screen.getByTitle('Terminais');

    expect(iframe.getAttribute('src')).toBe(TERMINALS_URL);
    expect(iframe.getAttribute('referrerpolicy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(screen.getByRole('status').textContent).toContain(
      'Carregando Terminais...',
    );

    fireEvent.load(iframe);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('oferece nova aba no fallback de carregamento bloqueado', () => {
    render(<TerminalsFallback />);

    expect(
      screen.getByText(
        'Não foi possível carregar o sistema Terminais dentro desta página.',
      ),
    ).toBeDefined();
    expect(
      screen.getByRole('link', {
        name: /abrir terminais em nova aba/i,
      }).getAttribute('target'),
    ).toBe('_blank');
    expect(
      screen.getByRole('link', {
        name: /abrir terminais em nova aba/i,
      }).getAttribute('rel'),
    ).toBe('noopener noreferrer');
  });
});
