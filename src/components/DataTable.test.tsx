// @vitest-environment jsdom

import type { ReactNode } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTable, type Column } from './DataTable';

interface DemoRow {
  id: string;
  name: string;
  email: string;
  status: string;
}

const rows: DemoRow[] = [
  {
    id: '1',
    name: 'Alice Silva',
    email: 'alice@example.com',
    status: 'Ativo',
  },
];

const columns: Column<DemoRow>[] = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'E-mail' },
  { key: 'status', label: 'Status' },
];

const originalMatchMedia = window.matchMedia;

function setViewport(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isMobile && query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderDemoTable(
  overrides: Partial<{
    data: DemoRow[];
    columns: Column<DemoRow>[];
    onEdit: (row: DemoRow) => void;
    onDelete: (row: DemoRow) => void;
    renderActions: (row: DemoRow) => ReactNode;
    onAdd: () => void;
    isLoading: boolean;
    title: string;
    addLabel: string;
    extraHeaderActions: ReactNode;
    emptyMessage: string;
  }> = {},
) {
  return render(
    <DataTable<DemoRow>
      data={rows}
      columns={columns}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  });
  vi.restoreAllMocks();
});

describe('DataTable', () => {
  it('renderiza título, colunas, linhas e cabeçalho de ações no desktop', () => {
    setViewport(false);
    renderDemoTable({
      title: 'Usuários',
      onEdit: vi.fn(),
    });

    expect(screen.getByRole('heading', { name: 'Usuários' })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Ações' })).toBeTruthy();
    expect(screen.getByText('Alice Silva')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
  });

  it('exibe empty state sem inventar uma ação adicional', () => {
    setViewport(false);
    renderDemoTable({
      data: [],
      emptyMessage: 'Nenhum usuário encontrado.',
    });

    expect(screen.getByText('Nenhum usuário encontrado.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /adicionar/i })).toBeNull();
  });

  it('exibe loading acessível com skeleton', () => {
    setViewport(false);
    renderDemoTable({ isLoading: true });

    expect(screen.getByRole('status', { name: 'Carregando...' })).toBeTruthy();
    expect(screen.getByText('Carregando...')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('chama onAdd pelo botão do cabeçalho', () => {
    setViewport(false);
    const onAdd = vi.fn();
    renderDemoTable({ onAdd, addLabel: 'Novo usuário' });

    fireEvent.click(screen.getByRole('button', { name: '+ Novo usuário' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('chama onEdit e onDelete com a linha correta', () => {
    setViewport(false);
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderDemoTable({ onEdit, onDelete });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onEdit).toHaveBeenCalledWith(rows[0]);
    expect(onDelete).toHaveBeenCalledWith(rows[0]);
  });

  it('preserva ações customizadas e ações extras do cabeçalho', () => {
    setViewport(false);
    const onCustomAction = vi.fn();
    const onHeaderAction = vi.fn();
    renderDemoTable({
      renderActions: (row) => (
        <button type="button" onClick={() => onCustomAction(row.id)}>
          Abrir
        </button>
      ),
      extraHeaderActions: (
        <button type="button" onClick={onHeaderAction}>
          Filtrar
        </button>
      ),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(onCustomAction).toHaveBeenCalledWith('1');
    expect(onHeaderAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('usa artigos acessíveis no mobile sem tabela horizontal', () => {
    setViewport(true);
    const onEdit = vi.fn();
    renderDemoTable({ onEdit });

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Nome')).toBeTruthy();
    expect(screen.getByText('E-mail')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Alice Silva')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledWith(rows[0]);
  });

  it('renderiza o formato mobile já na primeira pintura', () => {
    setViewport(true);

    const markup = renderToString(
      <DataTable<DemoRow> data={rows} columns={columns} />,
    );

    expect(markup).toContain('<article');
    expect(markup).not.toContain('<table');
  });
});
