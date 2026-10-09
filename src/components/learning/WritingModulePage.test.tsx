// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import WritingModulePage from './WritingModulePage';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('WritingModulePage', () => {
  it('oferece editor e contagem de palavras', () => {
    render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Planeje, escreva e revise' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Editor de redação' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Rascunhos salvos' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Checklist de revisão' })).toBeNull();
    expect(screen.getByText('0 palavras')).toBeTruthy();

    const themeOptions = screen.getByRole('combobox', { name: 'Tema de prática' }).querySelectorAll('option');
    expect(themeOptions).toHaveLength(10);
    expect(themeOptions[0].textContent).toContain('Perspectivas acerca do envelhecimento na sociedade brasileira');
    expect(themeOptions[0].textContent).toContain('2025');
    expect(themeOptions[9].textContent).toContain('Caminhos para combater a intolerância religiosa no Brasil');
    expect(themeOptions[9].textContent).toContain('2016');

    fireEvent.change(screen.getByRole('textbox', { name: 'Texto da redação' }), {
      target: { value: 'Uma ideia clara para começar.' },
    });

    expect(screen.getByText('5 palavras')).toBeTruthy();
  });

  it('salva e restaura o rascunho no dispositivo', () => {
    const { unmount } = render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );
    const textarea = screen.getByRole('textbox', { name: 'Texto da redação' });
    fireEvent.change(textarea, { target: { value: 'Meu rascunho de redação.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    const dialog = screen.getByRole('dialog', { name: 'Nomeie seu rascunho' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome do rascunho' }), {
      target: { value: 'Minha primeira redação' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar rascunho' }));
    expect(screen.getByRole('status').textContent).toContain('Minha primeira redação');
    expect(screen.getByRole('complementary', { name: 'Rascunhos salvos' }).textContent).toContain('Minha primeira redação');
    unmount();

    render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );

    expect((screen.getByRole('textbox', { name: 'Texto da redação' }) as HTMLTextAreaElement).value).toBe('Meu rascunho de redação.');
    expect(screen.getByRole('complementary', { name: 'Rascunhos salvos' }).textContent).toContain('Minha primeira redação');
  });

  it('ordena os rascunhos mais recentes primeiro', () => {
    render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );

    const saveNamedDraft = (name: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
      const dialog = screen.getByRole('dialog', { name: 'Nomeie seu rascunho' });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome do rascunho' }), {
        target: { value: name },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar rascunho' }));
    };

    saveNamedDraft('Primeira redação');
    saveNamedDraft('Segunda redação');

    const draftsPanel = screen.getByRole('complementary', { name: 'Rascunhos salvos' });
    const draftButtons = within(draftsPanel).getAllByRole('button', { name: /Abrir rascunho/ });
    expect(draftButtons[0].getAttribute('aria-label')).toBe('Abrir rascunho Segunda redação');
    expect(draftButtons[1].getAttribute('aria-label')).toBe('Abrir rascunho Primeira redação');
  });
});
