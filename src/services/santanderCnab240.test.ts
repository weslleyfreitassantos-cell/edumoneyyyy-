import { describe, expect, it } from 'vitest';
import { createSantanderTestHeader, createSantanderTestPayer, createSantanderTestTrailers, validateSantanderCnab240 } from './santanderCnab240';

const record = (type: string, segment = ' ') => `0330001${type}00001${segment}`.padEnd(240, ' ');

describe('validação estrutural Santander CNAB 240', () => {
  it('identifica segmentos de um arquivo fictício', () => {
    const content = [record('0'), record('1'), record('3', 'T'), record('3', 'U'), record('5'), record('9')].join('\r\n') + '\r\n';
    expect(validateSantanderCnab240(content)).toEqual({ records: 6, segments: ['T', 'U'] });
  });
  it('rejeita tamanho inválido e banco incorreto', () => {
    expect(() => validateSantanderCnab240('invalido')).toThrow();
    expect(() => validateSantanderCnab240([record('0').replace('033', '237'), record('1'), record('5'), record('9')].join('\n'))).toThrow('Santander');
  });
  it('gera cabeçalho de teste com posições do manual', () => {
    const header = createSantanderTestHeader({ document: '12345678000199', transmissionCode: '123', company: 'Escola Exemplo', date: '10012027', sequence: 1 });
    expect(header).toHaveLength(240);
    expect(header.slice(0, 8)).toBe('03300000');
    expect(header.slice(16, 17)).toBe('2');
    expect(header.slice(32, 47)).toBe('000000000000123');
    expect(header.slice(142, 151)).toBe('110012027');
    expect(header.slice(157, 166)).toBe('000001040');
    expect(() => createSantanderTestHeader({ document: '123', transmissionCode: '1', company: 'X', date: '10012027', sequence: 1 })).toThrow();
  });
  it('gera segmento Q com pagador fictício e valida os campos', () => {
    const row = createSantanderTestPayer({ sequence: 2, document: '12345678901', name: 'Maria Exemplo', address: 'Rua Exemplo 10', district: 'Centro', zip: '40000000', city: 'Salvador', state: 'BA' });
    expect(row).toHaveLength(240);
    expect(row.slice(0, 17)).toBe('0330001300002Q 01');
    expect(row.slice(17, 33)).toBe('1000012345678901');
    expect(row.slice(128, 136)).toBe('40000000');
    expect(row.slice(151, 153)).toBe('BA');
  });
  it('calcula contagem dos trailers de lote e arquivo', () => {
    const [batch, file] = createSantanderTestTrailers(4);
    expect(batch).toHaveLength(240);
    expect(file).toHaveLength(240);
    expect(batch.slice(17, 23)).toBe('000006');
    expect(file.slice(17, 29)).toBe('000001000008');
    expect(() => createSantanderTestTrailers(-1)).toThrow();
  });
});
