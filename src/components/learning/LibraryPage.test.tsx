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
  it('renderiza as capas estáticas e não consulta Google Books', () => {
    renderLibrary();

    const covers = screen.getAllByRole('img');

    expect(covers).toHaveLength(5);
    expect(covers[0].getAttribute('src')).toBe(
      'https://covers.openlibrary.org/b/id/10432365-L.jpg',
    );
    expect(covers[0].getAttribute('alt')).toBe(
      'Capa de Uma breve história do tempo',
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getAllByText('Ciências').length).toBeGreaterThan(1);
  });

  it('mostra o fallback local quando a imagem da capa falha', () => {
    renderLibrary();

    fireEvent.error(
      screen.getByAltText('Capa de Uma breve história do tempo'),
    );

    expect(
      screen.queryByAltText('Capa de Uma breve história do tempo'),
    ).toBeNull();
    expect(
      screen.getAllByText('Uma breve história do tempo').length,
    ).toBeGreaterThan(1);
  });

  it('mostra o fallback local quando a recomendação não possui coverUrl', () => {
    renderLibrary();

    expect(screen.queryByAltText('Capa de Gramática em textos')).toBeNull();
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

  it('preserva busca livre, Amazon, Mercado Livre e modal de pesquisa', () => {
    renderLibrary();

    const search = screen.getByRole('textbox', {
      name: 'Buscar livro, autor ou tema',
    });
    fireEvent.change(search, { target: { value: 'ciência' } });

    expect(
      screen.getByRole('button', { name: /Pesquisar no Amazon/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: /Pesquisar no Mercado Livre/i,
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Pesquisar no Mercado Livre/i,
      }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Pesquisa na Mercado Livre' }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Fechar pesquisa' }),
    );

    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Amazon' })[0]);
    expect(
      screen.getByRole('dialog', { name: 'Pesquisa na Amazon' }),
    ).toBeTruthy();
    expect(
      screen.getByTitle('Resultados da pesquisa na Amazon'),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Fechar pesquisa' }),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Pesquisa na Amazon' }),
    ).toBeNull();
  });
});
