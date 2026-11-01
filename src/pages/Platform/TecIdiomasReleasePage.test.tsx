// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabaseClient', () => ({ supabase: { rpc } }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a> }));

import TecIdiomasReleasePage from './TecIdiomasReleasePage';

afterEach(() => {
  cleanup();
  rpc.mockReset();
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><TecIdiomasReleasePage /></QueryClientProvider>);
}

describe('Tec Idiomas institutional release selector', () => {
  it('shows only server-returned eligible institutions and counts courses from actual results', async () => {
    rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'get_tec_english_release_targets_v1') {
        return {
          data: [{
            institution_id: 'institution-growth',
            institution_name: 'Colégio Crescimento',
            operational_status: 'ACTIVE',
            enabled: args.p_course_code === 'TEC_ENGLISH_FOUNDATIONS',
          }],
          error: null,
        };
      }
      return { data: { changed: true }, error: null };
    });

    renderPage();
    expect(await screen.findByText('Colégio Crescimento')).toBeTruthy();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article').textContent).not.toMatch(/QA|CANCELED|cancelad/i);
    expect(screen.getByText('8 cursos disponíveis')).toBeTruthy();
    expect(screen.getByText('1 habilitados')).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(8);
  });

  it('invokes the protected release RPC for the selected institution and course', async () => {
    rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'get_tec_english_release_targets_v1') {
        return { data: [{ institution_id: 'institution-growth', institution_name: 'Colégio Crescimento', operational_status: 'ACTIVE', enabled: false }], error: null };
      }
      return { data: { changed: true }, error: null };
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Colégio Crescimento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Habilitar Inglês · Primeiros passos para Colégio Crescimento' }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('set_tec_english_institution_release_v1', {
      p_course_code: 'TEC_ENGLISH_FOUNDATIONS',
      p_content_version: 1,
      p_institution_id: 'institution-growth',
      p_enabled: true,
    }));
    expect(await screen.findByRole('status')).toBeTruthy();
  });
});
