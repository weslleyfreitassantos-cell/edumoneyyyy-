// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LibraryPage from './LibraryPage';

const firstIsbn = '9788535905409';
const openLibraryCover =
  `https://covers.openlibrary.org/b/isbn/${firstIsbn}-M.jpg?default=false`;
const googleCover = 'https://books.google.com/books/content?id=real-cover';
const mockFetch = vi.fn();

function metadataResponse(imageLinks?: Record<string, string>) {
  return {
    ok: true,
    json: async () => ({
      items: imageLinks
        ? [{ volumeInfo: { imageLinks } }]
        : [{ volumeInfo: {} }],
    }),
  };
}

function renderLibrary() {
  return render(
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>,
  );
}

function mockGoogleCovers() {
  mockFetch.mockImplementation(async () =>
    metadataResponse({ thumbnail: googleCover }),
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
  it('usa a capa do Google Books quando a metadata possui imageLinks', async () => {
    mockGoogleCovers();
    renderLibrary();

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(6);
    });

    const firstCover = screen.getAllByRole('img')[0];

    expect(firstCover.getAttribute('src')).toBe(googleCover);
    expect(firstCover.getAttribute('data-cover-source')).toBe('google');
    expect(firstCover.getAttribute('alt')).toBe(
      'Capa de Uma breve história do tempo',
    );
    expect(mockFetch.mock.calls[0][0]).toBe(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${firstIsbn}`,
    );
  });

  it('usa Open Library quando Google Books não possui imageLinks', async () => {
    mockFetch.mockImplementation(async () => metadataResponse());
    renderLibrary();

    await waitFor(() => {
      expect(screen.getAllByRole('img')[0].getAttribute('src')).toBe(
        openLibraryCover,
      );
    });

    expect(
      screen.getAllByRole('img')[0].getAttribute('data-cover-source'),
    ).toBe('open-library');
  });

  it('mostra o fallback local quando a capa da Open Library falha', async () => {
    mockFetch.mockImplementation(async () => metadataResponse());
    renderLibrary();

    const firstCover = (await screen.findAllByRole('img'))[0];
    fireEvent.error(firstCover);

    await waitFor(() => {
      expect(
        screen.queryByAltText('Capa de Uma breve história do tempo'),
      ).toBeNull();
    });
    expect(
      screen.getAllByText('Uma breve história do tempo').length,
    ).toBeGreaterThan(1);
  });

  it('tenta Open Library quando a imagem do Google dispara erro', async () => {
    mockGoogleCovers();
    renderLibrary();

    const firstCover = (await screen.findAllByRole('img'))[0];
    fireEvent.error(firstCover);

    await waitFor(() => {
      expect(screen.getAllByRole('img')[0].getAttribute('src')).toBe(
        openLibraryCover,
      );
    });
  });

  it('preserva filtro, busca nas lojas e modal de pesquisa', async () => {
    mockGoogleCovers();
    renderLibrary();

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(6);
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Literatura' },
    });
    expect(
      screen.getByRole('heading', { name: 'Dom Casmurro' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', {
        name: 'O homem que calculava',
      }),
    ).toBeNull();

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Todos' },
    });

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
