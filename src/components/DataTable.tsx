import type { ReactNode } from 'react';

import { useEffect, useState } from 'react';

import { ActionGroup } from './ActionGroup';

export interface Column<T> {
  id?: string;
  key: keyof T;
  label: string;
  render?: (value: unknown, row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  renderActions?: (row: T) => ReactNode;
  onAdd?: () => void;
  isLoading?: boolean;
  title?: string;
  addLabel?: string;
  extraHeaderActions?: ReactNode;
  emptyMessage?: string;
  actionCellClassName?: string;
  actionGroupClassName?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onEdit,
  onDelete,
  renderActions,
  onAdd,
  isLoading = false,
  title = 'Listagem',
  addLabel = 'Adicionar',
  extraHeaderActions,
  emptyMessage = 'Nenhum registro encontrado.',
  actionCellClassName = '',
  actionGroupClassName = '',
}: DataTableProps<T>) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsMobile(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener?.('change', syncViewport);

    return () => {
      mediaQuery.removeEventListener?.('change', syncViewport);
    };
  }, []);

  const hasActions = Boolean(
    onEdit ||
    onDelete ||
    renderActions,
  );

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Carregando..."
        aria-busy="true"
        className="space-y-4 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
      >
        <span className="sr-only">Carregando...</span>
        <div className="flex items-center justify-between gap-4">
          <div className="h-5 w-36 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
          <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
        </div>
        <div className="overflow-hidden rounded-lg border border-[#e4e8f1] dark:border-slate-800">
          <div className="h-10 animate-pulse bg-slate-100 motion-reduce:animate-none dark:bg-slate-950/70" />
          <div className="divide-y divide-[#eef1f5] dark:divide-slate-800">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-14 animate-pulse bg-white motion-reduce:animate-none dark:bg-slate-900" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex min-w-0 flex-col gap-3 border-b border-[#dfe3e8] p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="min-w-0 text-base font-bold text-[#181c20] dark:text-white">
          {title}
        </h3>

        {(extraHeaderActions || onAdd) && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
            {extraHeaderActions}

            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1a73e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
              >
                + {addLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {!isMobile && <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f9fc] dark:bg-slate-950/70">
            <tr>
              {columns.map((column) => (
                <th
                  key={
                    column.id ??
                    String(column.key)
                  }
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-[#475467] dark:text-slate-300"
                >
                  {column.label}
                </th>
              ))}

              {hasActions && (
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-[#475467] dark:text-slate-300">
                  Ações
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.length +
                    (hasActions ? 1 : 0)
                  }
                  className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[#dfe3e8] transition-colors hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  {columns.map((column) => (
                    <td
                      key={
                        column.id ??
                        String(column.key)
                      }
                      className="min-w-0 break-words px-4 py-3 align-middle text-[#344054] dark:text-slate-200"
                    >
                      {column.render
                        ? column.render(
                          row[column.key],
                          row,
                        )
                        : String(
                          row[column.key] ?? '',
                        )}
                    </td>
                  ))}

                  {hasActions && (
                    <td className={`px-4 py-3 text-right align-middle ${actionCellClassName}`}>
                      {renderActions ? (
                        <ActionGroup className={actionGroupClassName}>
                          {renderActions(row)}
                        </ActionGroup>
                      ) : (
                        <ActionGroup>
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                onEdit(row)
                              }
                              className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:text-blue-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                            >
                              Editar
                            </button>
                          )}

                          {onDelete && (
                            <button
                              type="button"
                              onClick={() =>
                                onDelete(row)
                              }
                              className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200"
                            >
                              Excluir
                            </button>
                          )}
                        </ActionGroup>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>}

      {isMobile && <div className="divide-y divide-[#dfe3e8] bg-white dark:divide-slate-700 dark:bg-slate-900">
        {data.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#667085] dark:text-slate-400">
            {emptyMessage}
          </div>
        ) : (
          data.map((row) => (
            <article key={row.id} className="min-w-0 space-y-4 p-4">
              <dl className="grid min-w-0 gap-3">
                {columns.map((column) => (
                  <div key={column.id ?? String(column.key)} className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#667085] dark:text-slate-400">
                      {column.label}
                    </dt>
                    <dd className="mt-1 min-w-0 break-words text-sm text-[#344054] dark:text-slate-200">
                      {column.render
                        ? column.render(row[column.key], row)
                        : String(row[column.key] ?? '')}
                    </dd>
                  </div>
                ))}
              </dl>

              {hasActions && (
                <div className="border-t border-[#dfe3e8] pt-3 dark:border-slate-700">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085] dark:text-slate-400">
                    Ações
                  </p>
                  {renderActions ? (
                    <div className="flex justify-end">
                      <ActionGroup className={actionGroupClassName}>
                        {renderActions(row)}
                      </ActionGroup>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <ActionGroup>
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:text-blue-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                          >
                            Editar
                          </button>
                        )}

                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200"
                          >
                            Excluir
                          </button>
                        )}
                      </ActionGroup>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>}
    </div>
  );
}
