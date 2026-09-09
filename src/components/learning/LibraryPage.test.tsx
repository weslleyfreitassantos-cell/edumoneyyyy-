// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LibraryPage from './LibraryPage';

const mockFetch = vi.fn();

function renderLibrary() {
  return render(
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

describe('LibraryPage', () => {
  it('renderiza a capa Open Library configurada sem consultar metadata', () => {
    renderLibrary();

    const cover = screen.getByAltText('Capa de O povo brasileiro');

    expect(cover.getAttribute('src')).toBe(
      'https://covers.openlibrary.org/b/id/3842030-L.jpg',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('mostra o fallback local quando a imagem da capa falha', () => {
    renderLibrary();

    fireEvent.error(screen.getByAltText('Capa de O povo brasileiro'));

    expect(screen.queryByAltText('Capa de O povo brasileiro')).toBeNull();
    expect(screen.getAllByText('O povo brasileiro').length).toBeGreaterThan(1);
  });

  it('mostra o fallback local quando a recomendação não possui coverUrl', () => {
    renderLibrary();

    expect(screen.queryByAltText('Capa de Gramática em textos')).toBeNull();
    expect(screen.queryByAltText('Capa de Uma breve história do tempo')).toBeNull();
    expect(screen.queryByAltText('Capa de O mundo assombrado pelos demônios')).toBeNull();
    expect(screen.getAllByText('Gramática em textos').length).toBeGreaterThan(1);
  });

  it('mantém o filtro por assunto, incluindo Hawking em Ciências', () => {
    renderLibrary();

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Ciências' },
    });

    expect(
      screen.getByRole('heading', { name: 'Uma breve história do tempo' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Dom Casmurro' }),
    ).toBeNull();
  });

  it('abre Amazon e Mercado Livre por links diretos em nova aba', () => {
    renderLibrary();

    const search = screen.getByRole('textbox', {
      name: 'Buscar livro, autor ou tema',
    });
    fireEvent.change(search, { target: { value: 'Dom Casmurro' } });

    const amazonSearch = screen.getByRole('link', {
      name: /Pesquisar no Amazon/i,
    });
    const mercadoSearch = screen.getByRole('link', {
      name: /Pesquisar no Mercado Livre/i,
    });

    expect(amazonSearch.getAttribute('target')).toBe('_blank');
    expect(amazonSearch.getAttribute('rel')).toContain('noopener');
    expect(amazonSearch.getAttribute('href')).toContain(
      'amazon.com.br/s?k=Dom%20Casmurro',
    );
    expect(mercadoSearch.getAttribute('target')).toBe('_blank');
    expect(mercadoSearch.getAttribute('rel')).toContain('noopener');
    expect(mercadoSearch.getAttribute('href')).toContain(
      'mercadolivre.com.br/Dom-Casmurro',
    );

    const amazonCard = screen.getAllByRole('link', { name: 'Amazon' })[0];
    const mercadoCard = screen.getAllByRole('link', {
      name: 'Mercado Livre',
    })[0];

    expect(amazonCard.getAttribute('target')).toBe('_blank');
    expect(mercadoCard.getAttribute('target')).toBe('_blank');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTitle(/Resultados da pesquisa/)).toBeNull();
  });
});
