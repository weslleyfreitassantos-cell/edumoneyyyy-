// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseState = vi.hoisted(() => ({
  rows: [] as Array<Record<string, string>>,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'profile-1', full_name: 'Ana Estudante' } }),
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: supabaseState.rows, error: null }),
        })),
      })),
      upsert: vi.fn((payload: Record<string, string> | Array<Record<string, string>>) => ({
        select: vi.fn().mockImplementation(async () => {
          const values = Array.isArray(payload) ? payload : [payload];
          const data = values.map((value, index) => {
            const existing = supabaseState.rows.find((row) => row.client_id === value.client_id);
            const row = {
              id: existing?.id ?? `remote-${supabaseState.rows.length + index + 1}`,
              client_id: value.client_id,
              name: value.name,
              theme: value.theme,
              text: value.text,
              created_at: existing?.created_at ?? '2026-10-09T12:00:00.000Z',
              updated_at: '2026-10-09T12:00:00.000Z',
            };
            if (!existing) supabaseState.rows.push(row);
            return row;
          });
          return { data, error: null };
        }),
      })),
    })),
  },
}));

import WritingModulePage from './WritingModulePage';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  supabaseState.rows = [];
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

  it('salva e restaura o rascunho pela conta do aluno', async () => {
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
    await vi.waitFor(() => expect(screen.getByRole('status').textContent).toContain('Minha primeira redação'));
    expect(screen.getByRole('status').textContent).toContain('qualquer dispositivo');
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

  it('ordena os rascunhos mais recentes primeiro', async () => {
    render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );

    const saveNamedDraft = async (name: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
      const dialog = screen.getByRole('dialog', { name: 'Nomeie seu rascunho' });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome do rascunho' }), {
        target: { value: name },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar rascunho' }));
      await vi.waitFor(() => expect(screen.getByRole('status').textContent).toContain(name));
    };

    await saveNamedDraft('Primeira redação');
    await saveNamedDraft('Segunda redação');

    const draftsPanel = screen.getByRole('complementary', { name: 'Rascunhos salvos' });
    const draftButtons = within(draftsPanel).getAllByRole('button', { name: /Abrir rascunho/ });
    expect(draftButtons[0].getAttribute('aria-label')).toBe('Abrir rascunho Segunda redação');
    expect(draftButtons[1].getAttribute('aria-label')).toBe('Abrir rascunho Primeira redação');
  });
});
