export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

function protectFormulaInjection(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'string'
    ? protectFormulaInjection(value)
    : String(value);

  return /[;"\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function buildCsv<T>(
  columns: readonly CsvColumn<T>[],
  rows: readonly T[],
): string {
  const header = columns.map((column) => escapeCsvValue(column.header));
  const body = rows.map((row) => columns
    .map((column) => escapeCsvValue(column.value(row)))
    .join(';'));

  return `\uFEFF${[header.join(';'), ...body].join('\r\n')}\r\n`;
}

export function sanitizeDownloadFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function downloadCsv(
  fileName: string,
  content: string,
): void {
  const blob = new Blob([content], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
