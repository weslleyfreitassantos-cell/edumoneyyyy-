import type { WorkBook, WorkSheet } from 'xlsx';

export interface ParsedSpreadsheetRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedSpreadsheet {
  sheetName: string;
  headers: string[];
  rows: ParsedSpreadsheetRow[];
}

const MAX_IMPORT_ROWS = 1000;

export function normalizeSpreadsheetHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatDateCell(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatNumberCell(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(value).replace(/0+$/, '').replace(/\.$/, '');
}

export function spreadsheetCellToString(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateCell(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatNumberCell(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return typeof value === 'string' ? value.trim() : '';
}

function firstDataSheet(
  workbook: WorkBook,
  utils: { sheet_to_json: (sheet: WorkSheet, options: Record<string, unknown>) => unknown[] },
): { name: string; rows: unknown[][] } {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    }) as unknown[][];
    if (rows.some((row) => row.some((cell) => spreadsheetCellToString(cell)))) {
      return { name, rows };
    }
  }
  throw new Error('O arquivo não possui uma planilha com dados.');
}

export function isSupportedSpreadsheetFile(file: File): boolean {
  return /\.(xlsx|xls)$/i.test(file.name);
}

export async function readSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  if (!isSupportedSpreadsheetFile(file)) {
    throw new Error('Selecione um arquivo Excel .xlsx ou .xls.');
  }

  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  });
  const { name: sheetName, rows } = firstDataSheet(workbook, XLSX.utils);
  const headerIndex = rows.findIndex((row) => row.some((cell) => spreadsheetCellToString(cell)));
  const headerRow = rows[headerIndex] ?? [];
  const headers = headerRow.map((cell) => normalizeSpreadsheetHeader(spreadsheetCellToString(cell)));

  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new Error('A primeira linha com dados precisa conter os nomes das colunas.');
  }
  if (headers.some((header) => !header)) {
    throw new Error('Existem colunas sem nome no cabeçalho.');
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error('Existem nomes de colunas repetidos no cabeçalho.');
  }

  const dataRows = rows.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => spreadsheetCellToString(cell)))
    .map((row, index) => ({
      rowNumber: headerIndex + index + 2,
      values: Object.fromEntries(headers.map((header, columnIndex) => [
        header,
        spreadsheetCellToString(row[columnIndex]),
      ])),
    }));

  if (dataRows.length === 0) {
    throw new Error('O arquivo não possui linhas para importar.');
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`O limite por importação é de ${MAX_IMPORT_ROWS} linhas.`);
  }

  return { sheetName, headers, rows: dataRows };
}

export async function downloadSpreadsheetTemplate(
  fileName: string,
  headers: readonly string[],
  exampleRow: Record<string, string>,
): Promise<void> {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet([exampleRow], { header: [...headers] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Importação');
  XLSX.writeFile(workbook, fileName);
}
