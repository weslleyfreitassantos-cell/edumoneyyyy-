import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface ListSearchProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export function ListSearch({
  id,
  label,
  placeholder,
  value,
  onChange,
}: ListSearchProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[#414754]"
      >
        {label}
      </label>

      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />

        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[#dfe3e8] bg-white py-2 pl-9 pr-3 text-sm text-[#181c20] outline-none transition-colors placeholder:text-gray-400 focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
        />
      </div>
    </div>
  );
}

interface ListPaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function ListPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: ListPaginationProps) {
  if (totalItems <= pageSize) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageStart = (page - 1) * pageSize;
  const firstItem = pageStart + 1;
  const lastItem = Math.min(pageStart + pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-gray-600">
      <span>
        Mostrando {firstItem}–{lastItem} de {totalItems}
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Página anterior"
          title="Página anterior"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dfe3e8] px-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft
            className="h-4 w-4"
            aria-hidden="true"
          />
          Anterior
        </button>

        <span className="whitespace-nowrap font-medium text-gray-700">
          Página {page} de {totalPages}
        </span>

        <button
          type="button"
          aria-label="Próxima página"
          title="Próxima página"
          disabled={page === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dfe3e8] px-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Próxima
          <ChevronRight
            className="h-4 w-4"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}

export function normalizeListSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}
