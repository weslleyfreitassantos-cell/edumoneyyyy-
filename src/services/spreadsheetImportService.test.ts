import { describe, expect, it } from 'vitest';

import {
  normalizeSpreadsheetHeader,
  readSpreadsheetFile,
  spreadsheetCellToString,
} from './spreadsheetImportService';

describe('spreadsheetImportService', () => {
  it('normalizes Portuguese headers and dates without losing Excel values', () => {
    expect(normalizeSpreadsheetHeader('Data de nascimento')).toBe('data_de_nascimento');
    expect(spreadsheetCellToString(new Date(2026, 7, 31))).toBe('2026-08-31');
    expect(spreadsheetCellToString(12)).toBe('12');
  });

  it('reads xlsx and xls extensions from the first populated sheet', async () => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nome completo', 'E-mail'],
      ['Ana Souza', 'ana@example.com'],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alunos');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const xlsx = await readSpreadsheetFile(new File([bytes], 'alunos.xlsx'));
    const xls = await readSpreadsheetFile(new File([bytes], 'alunos.xls'));

    expect(xlsx.sheetName).toBe('Alunos');
    expect(xlsx.headers).toEqual(['nome_completo', 'e_mail']);
    expect(xlsx.rows[0]?.values.nome_completo).toBe('Ana Souza');
    expect(xls.rows).toHaveLength(1);
  });
});
