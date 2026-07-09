import React from 'react';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onAdd?: () => void;
  isLoading?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onEdit,
  onDelete,
  onAdd,
  isLoading,
}: DataTableProps<T>) {
  if (isLoading) {
    return <div className="p-4 text-gray-500">Carregando...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow border border-[#dfe3e8] overflow-hidden">
      <div className="p-4 flex justify-between items-center border-b">
        <h3 className="font-bold">Listagem</h3>
        {onAdd && (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-[#005bbf] text-white rounded-lg text-sm hover:bg-[#1a73e8]"
          >
            + Adicionar
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} className="px-4 py-2 text-left font-medium text-gray-700">
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-4 py-2 text-left font-medium text-gray-700">Ações</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="border-t hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-2">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-2 space-x-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Editar
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
