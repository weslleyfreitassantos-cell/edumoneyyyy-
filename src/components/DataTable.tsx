import type { ReactNode } from 'react';

import { useEffect, useState } from 'react';

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
}: DataTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);

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
      <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-gray-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="min-w-0 font-bold text-[#181c20]">
          {title}
        </h3>

        {(extraHeaderActions || onAdd) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {extraHeaderActions}

            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a73e8]"
              >
                + {addLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {!isMobile && <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={
                    column.id ??
                    String(column.key)
                  }
                  className="px-4 py-3 text-left font-medium text-gray-700"
                >
                  {column.label}
                </th>
              ))}

              {hasActions && (
                <th className="px-4 py-3 text-left font-medium text-gray-700">
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
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="border-t transition-colors hover:bg-gray-50"
                >
                  {columns.map((column) => (
                    <td
                      key={
                        column.id ??
                        String(column.key)
                      }
                      className="px-4 py-3"
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
                    <td className="px-4 py-3">
                      {renderActions ? (
                        renderActions(row)
                      ) : (
                        <div className="flex items-center gap-3">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                onEdit(row)
                              }
                              className="font-medium text-blue-600 hover:text-blue-800"
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
                              className="font-medium text-red-600 hover:text-red-800"
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>}

      {isMobile && <div className="divide-y divide-[#dfe3e8]">
        {data.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {emptyMessage}
          </div>
        ) : (
          data.map((row) => (
            <article key={row.id} className="min-w-0 space-y-4 p-4">
              <dl className="grid min-w-0 gap-3">
                {columns.map((column) => (
                  <div key={column.id ?? String(column.key)} className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {column.label}
                    </dt>
                    <dd className="mt-1 break-words text-sm text-[#181c20]">
                      {column.render
                        ? column.render(row[column.key], row)
                        : String(row[column.key] ?? '')}
                    </dd>
                  </div>
                ))}
              </dl>

              {hasActions && (
                <div className="border-t border-[#dfe3e8] pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Ações
                  </p>
                  {renderActions ? (
                    renderActions(row)
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          Editar
                        </button>
                      )}

                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          className="font-medium text-red-600 hover:text-red-800"
                        >
                          Excluir
                        </button>
                      )}
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
