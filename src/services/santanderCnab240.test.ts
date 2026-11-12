import { describe, expect, it } from 'vitest';
import { createSantanderRemittanceFile, createSantanderTestHeader, createSantanderTestPayer, createSantanderTestTitle, createSantanderTestTrailers, parseSantanderReturnFile, validateSantanderCnab240 } from './santanderCnab240';

const record = (type: string, segment = ' ') => `0330001${type}00001${segment}`.padEnd(240, ' ');

function returnRecord(type: string, sequence: number): { line: string; put: (start: number, value: string) => void } {
  const line = Array.from({ length: 240 }, () => ' ');
  const put = (start: number, value: string) => value.split('').forEach((character, offset) => { line[start - 1 + offset] = character; });
  put(1, '033'); put(4, '0001'); put(8, '3'); put(9, String(sequence).padStart(5, '0')); put(14, type);
  return { get line() { return line.join(''); }, put };
}

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
  it('gera segmento P de teste com valor em centavos nas posições corretas', () => {
    const row = createSantanderTestTitle({ sequence: 1, agency: '1234', agencyDigit: '0', account: '123456', accountDigit: '0', ourNumber: '1', documentNumber: 'A1', dueDate: '10012027', issueDate: '01122026', amountCents: 45000, reference: 'FATURA1' });
    expect(row).toHaveLength(240);
    expect(row.slice(13, 14)).toBe('P');
    expect(row.slice(77, 85)).toBe('10012027');
    expect(row.slice(85, 100)).toBe('000000000045000');
    expect(row.slice(195, 220).trim()).toBe('FATURA1');
  });
  it('monta um lote CNAB 240 completo com P, Q e trailers', () => {
    const content = createSantanderRemittanceFile({
      companyDocument: '12345678000199', companyName: 'Escola Exemplo', transmissionCode: '123',
      agency: '1234', agencyDigit: '0', account: '123456', accountDigit: '0', wallet: '17',
      sequence: 7, generatedAt: '2027-01-10', items: [{
        ourNumber: '0000000000001', amountCents: 45000, dueDate: '2027-01-20', documentNumber: 'FATURA1',
        payerName: 'Maria Exemplo', payerDocument: '12345678901', payerAddress: 'Rua Exemplo 10',
        payerDistrict: 'Centro', payerZip: '40000000', payerCity: 'Salvador', payerState: 'BA',
      }],
    });
    const parsed = validateSantanderCnab240(content);
    expect(parsed.records).toBe(6);
    expect(parsed.segments).toEqual(['P', 'Q']);
    const lines = content.split('\r\n');
    expect(lines[0]).toHaveLength(240);
    expect(lines[1].slice(7, 11)).toBe('1R01');
    expect(lines[2].slice(8, 13)).toBe('00001');
    expect(lines[2].slice(13, 14)).toBe('P');
    expect(lines[2].slice(17, 21)).toBe('1234');
    expect(lines[2].slice(77, 85)).toBe('20012027');
    expect(lines[2].slice(85, 100)).toBe('000000000045000');
    expect(lines[3].slice(8, 13)).toBe('00002');
    expect(lines[3].slice(13, 14)).toBe('Q');
    expect(lines[3].slice(33, 73).trim()).toBe('MARIA EXEMPLO');
  });

  it('interpreta uma liquidação T/U com valor e data de crédito', () => {
    const t = returnRecord('T', 3);
    const u = returnRecord('U', 4);
    t.put(16, '06'); t.put(41, '0000000000001');
    u.put(78, '000000000045000'); u.put(138, '10012027'); u.put(154, '61');
    const content = [record('0'), t.line, u.line, record('9')].join('\r\n') + '\r\n';

    expect(parseSantanderReturnFile(content)).toMatchObject([{
      our_number: '0000000000001', occurrence_code: '61', event_type: 'SETTLED',
      status: 'SETTLED', amount_cents: 45000, paid_at: '2027-01-10T12:00:00.000Z',
    }]);
  });
});
