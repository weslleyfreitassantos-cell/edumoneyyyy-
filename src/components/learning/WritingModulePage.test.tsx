// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseState = vi.hoisted(() => ({
  rows: [] as Array<Record<string, string>>,
  deleteError: false,
  deleteCalls: 0,
  upsertError: false,
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
          if (supabaseState.upsertError) return { data: null, error: { message: 'upsert failed' } };
          const values = Array.isArray(payload) ? payload : [payload];
          const data = values.map((value, index) => {
            const existing = supabaseState.rows.find((row) => row.client_id === value.client_id);
            const row = {
              id: existing?.id ?? `remote-${supabaseState.rows.length + index + 1}`,
              profile_id: 'profile-1',
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
      delete: vi.fn(() => {
        supabaseState.deleteCalls += 1;
        return ({
        eq: vi.fn((field: string, value: string) => ({
          eq: vi.fn(async (secondField: string, secondValue: string) => {
            if (supabaseState.deleteError) return { error: { message: 'delete failed' } };
            if (field === 'id' && secondField === 'profile_id') {
              supabaseState.rows = supabaseState.rows.filter(
                (row) => row.id !== value || row.profile_id !== secondValue,
              );
            }
            return { error: null };
          }),
        })),
        });
      }),
    })),
  },
}));

import WritingModulePage from './WritingModulePage';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  supabaseState.rows = [];
  supabaseState.deleteError = false;
  supabaseState.deleteCalls = 0;
  supabaseState.upsertError = false;
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
    expect(themeOptions).toHaveLength(11);
    expect(themeOptions[0].textContent).toContain('A valorização do Sistema Único de Saúde (SUS) como direito universal');
    expect(themeOptions[0].textContent).toContain('2026');
    expect(themeOptions[1].textContent).toContain('Perspectivas acerca do envelhecimento na sociedade brasileira');
    expect(themeOptions[1].textContent).toContain('2025');
    expect(themeOptions[10].textContent).toContain('Caminhos para combater a intolerância religiosa no Brasil');
    expect(themeOptions[10].textContent).toContain('2016');

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
    expect((screen.getByRole('combobox', { name: 'Tema de prática' }) as HTMLSelectElement).value).toBe(
      'A valorização do Sistema Único de Saúde (SUS) como direito universal',
    );
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

  it('confirma a exclusão e remove o rascunho da conta e da lista', async () => {
    render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );

    await vi.waitFor(() => expect(screen.queryByText('Sincronizando seus rascunhos...')).toBeNull());
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto da redação' }), {
      target: { value: 'Texto que será excluído.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    const namingDialog = screen.getByRole('dialog', { name: 'Nomeie seu rascunho' });
    fireEvent.change(within(namingDialog).getByRole('textbox', { name: 'Nome do rascunho' }), {
      target: { value: 'Redação para excluir' },
    });
    fireEvent.click(within(namingDialog).getByRole('button', { name: 'Salvar rascunho' }));
    await vi.waitFor(() => expect(supabaseState.rows).toHaveLength(1));

    const draftsPanel = screen.getByRole('complementary', { name: 'Rascunhos salvos' });
    await within(draftsPanel).findByRole('button', { name: 'Abrir rascunho Redação para excluir' });
    fireEvent.click(within(draftsPanel).getByRole('button', { name: 'Excluir rascunho Redação para excluir' }));
    expect(supabaseState.rows).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(supabaseState.rows).toHaveLength(1);
    expect(within(draftsPanel).getByRole('button', { name: 'Abrir rascunho Redação para excluir' })).toBeTruthy();

    fireEvent.click(within(draftsPanel).getByRole('button', { name: 'Excluir rascunho Redação para excluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));

    await vi.waitFor(() => expect(screen.getByRole('status').textContent).toContain('foi excluído'));
    expect(supabaseState.rows).toHaveLength(0);
    expect(within(draftsPanel).queryByRole('button', { name: 'Abrir rascunho Redação para excluir' })).toBeNull();
  });

  it('mantém o rascunho quando o servidor recusa a exclusão', async () => {
    render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );

    await vi.waitFor(() => expect(screen.queryByText('Sincronizando seus rascunhos...')).toBeNull());
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto da redação' }), {
      target: { value: 'Conteúdo preservado se falhar.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    const namingDialog = screen.getByRole('dialog', { name: 'Nomeie seu rascunho' });
    fireEvent.change(within(namingDialog).getByRole('textbox', { name: 'Nome do rascunho' }), {
      target: { value: 'Rascunho protegido' },
    });
    fireEvent.click(within(namingDialog).getByRole('button', { name: 'Salvar rascunho' }));
    await vi.waitFor(() => expect(supabaseState.rows).toHaveLength(1));

    supabaseState.deleteError = true;
    const draftsPanel = screen.getByRole('complementary', { name: 'Rascunhos salvos' });
    await within(draftsPanel).findByRole('button', { name: 'Abrir rascunho Rascunho protegido' });
    fireEvent.click(within(draftsPanel).getByRole('button', { name: 'Excluir rascunho Rascunho protegido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));

    expect(await screen.findByText('Não foi possível excluir o rascunho. Ele foi mantido; tente novamente.')).toBeTruthy();
    expect(supabaseState.rows).toHaveLength(1);
    expect(within(draftsPanel).getByRole('button', { name: 'Abrir rascunho Rascunho protegido' })).toBeTruthy();
  });

  it('exclui rascunhos locais sem chamar a exclusão remota', async () => {
    window.localStorage.setItem('student-writing-module-drafts:profile-1', JSON.stringify([
      {
        id: 'offline-draft-1',
        clientId: 'offline-draft-1',
        name: 'Rascunho offline',
        theme: 'A valorização do Sistema Único de Saúde (SUS) como direito universal',
        text: 'Texto guardado neste dispositivo.',
        savedAt: Date.now(),
      },
    ]));
    supabaseState.upsertError = true;

    render(
      <MemoryRouter>
        <WritingModulePage />
      </MemoryRouter>,
    );

    const draftsPanel = screen.getByRole('complementary', { name: 'Rascunhos salvos' });
    await within(draftsPanel).findByRole('button', { name: 'Abrir rascunho Rascunho offline' });
    fireEvent.click(within(draftsPanel).getByRole('button', { name: 'Excluir rascunho Rascunho offline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));

    await vi.waitFor(() => expect(within(draftsPanel).queryByRole('button', { name: 'Abrir rascunho Rascunho offline' })).toBeNull());
    expect(supabaseState.deleteCalls).toBe(0);
    expect(JSON.parse(window.localStorage.getItem('student-writing-module-drafts:profile-1') ?? 'null')).toEqual([]);
  });
});
