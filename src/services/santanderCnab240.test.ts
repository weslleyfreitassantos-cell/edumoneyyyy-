import { describe, expect, it } from 'vitest';
import { validateSantanderCnab240 } from './santanderCnab240';

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
});
