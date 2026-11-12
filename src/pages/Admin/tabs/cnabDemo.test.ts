import { describe, expect, it } from 'vitest';
import { generateCnabDemo } from './cnabDemo';

describe('CNAB demonstrativo', () => {
  it('gera somente dados fictícios com linhas de 240 posições e CRLF', () => {
    const output = generateCnabDemo();
    const records = output.split('\r\n');
    expect(records.pop()).toBe('');
    expect(records).toHaveLength(4);
    expect(records.every((record) => record.length === 240)).toBe(true);
    expect(output).toContain('NAO ENVIAR AO BANCO');
    expect(output).toContain('ESCOLA FICTICIA');
    expect(output).not.toMatch(/[^\x20-\x7e\r\n]/);
  });
});
