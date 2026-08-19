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

    expect(TERMINALS_URL).toBe(
      'https://tvescola.grupotec.dev.br/neonews/logon.jsp?sys=NEC&msgKey=',
    );
    expect(iframe.getAttribute('src')).toBe(TERMINALS_URL);
    expect(iframe.getAttribute('referrerpolicy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(screen.queryByText('Instituição')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Terminais' })).toBeNull();
    expect(
      screen.queryByText(
        'Acesse o sistema de terminais diretamente pelo ambiente da instituição.',
      ),
    ).toBeNull();
    expect(iframe.className).toContain('h-full');
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
    const fallbackLink = screen.getByRole('link', {
      name: /abrir terminais em nova aba/i,
    });

    expect(fallbackLink.getAttribute('href')).toBe(TERMINALS_URL);
    expect(fallbackLink.getAttribute('target')).toBe('_blank');
    expect(fallbackLink.getAttribute('rel')).toBe('noopener noreferrer');
    expect(document.querySelector('iframe[src*="admin.in9midia.com"]')).toBeNull();
  });
});
