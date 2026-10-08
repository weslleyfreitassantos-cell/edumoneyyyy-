// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import WritingModulePage from './WritingModulePage';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('WritingModulePage', () => {
  it('oferece editor, contagem de palavras e checklist', () => {
    render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Planeje, escreva e revise' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Editor de redação' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Checklist de revisão' })).toBeTruthy();
    expect(screen.getByText('0 palavras')).toBeTruthy();

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
    expect(screen.getByRole('status').textContent).toContain('Rascunho salvo neste dispositivo.');
    unmount();

    render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );

    expect((screen.getByRole('textbox', { name: 'Texto da redação' }) as HTMLTextAreaElement).value).toBe('Meu rascunho de redação.');
  });
});
