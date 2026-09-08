// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import LibraryPage from './LibraryPage';

afterEach(() => {
  cleanup();
});

function renderLibrary() {
  return render(
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>,
  );
}

describe('LibraryPage', () => {
  it('exibe capas reais pelo ISBN para todas as recomendações', () => {
    renderLibrary();

    const covers = screen.getAllByRole('img');

    expect(covers).toHaveLength(6);
    expect(covers[0].getAttribute('src')).toContain(
      'books.google.com/books/content?vid=ISBN:9788535905409',
    );
    expect(covers[0].getAttribute('alt')).toBe(
      'Capa de Uma breve história do tempo',
    );
  });

  it('preserva filtro, busca nas lojas e modal de pesquisa', () => {
    renderLibrary();

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
    fireEvent.change(
      search,
      { target: { value: 'ciência' } },
    );
    expect(
      screen.getByRole('button', { name: /Pesquisar no Amazon/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: /Pesquisar no Mercado Livre/i,
      }),
    ).toBeTruthy();

    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Amazon' })[0],
    );
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
