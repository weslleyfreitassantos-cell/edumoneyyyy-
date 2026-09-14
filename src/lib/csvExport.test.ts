// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import {
  buildCsv,
  downloadCsv,
  escapeCsvValue,
  sanitizeDownloadFileName,
} from './csvExport';

describe('csvExport', () => {
  it('gera BOM, delimitador Excel e escaping de textos', () => {
    const csv = buildCsv(
      [{ header: 'Nome', value: (row: { name: string }) => row.name }],
      [{ name: 'Maria; "Bia"\nSilva' }],
    );

    expect(csv.startsWith('\uFEFFNome\r\n')).toBe(true);
    expect(csv).toContain('"Maria; ""Bia""\nSilva"');
  });

  it('protege texto controlado pelo usuário contra fórmula de planilha', () => {
    expect(escapeCsvValue('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsvValue('+command')).toBe("'+command");
    expect(escapeCsvValue(-74)).toBe('-74');
  });

  it('sanitiza nomes de arquivo sem expor UUIDs ou acentos', () => {
    expect(sanitizeDownloadFileName('Resultados 2º A — 2º Bimestre 2026')).toBe('resultados-2-a-2-bimestre-2026');
  });

  it('cria download local sem persistência externa', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadCsv('relatorio.csv', '\uFEFFNome\r\nAna\r\n');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    click.mockRestore();
  });
});
