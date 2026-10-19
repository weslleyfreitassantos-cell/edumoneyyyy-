import { describe, expect, it } from 'vitest';

import {
  buildAvailableClassBatchNames,
  buildClassBatchNames,
  getClassDisplayName,
} from './classNaming';

describe('class naming', () => {
  it('identifica a primeira turma como A mesmo quando o lote tem uma turma', () => {
    expect(buildClassBatchNames('1º ano', 1)).toEqual(['1º ano A']);
  });

  it('distingue a primeira turma pelo turno', () => {
    expect(buildClassBatchNames('1º ano', 1, 'MATUTINO')).toEqual(['1º ano A M']);
    expect(buildClassBatchNames('1º ano', 1, 'VESPERTINO')).toEqual(['1º ano A V']);
    expect(buildClassBatchNames('1º ano', 1, 'NOTURNO')).toEqual(['1º ano A N']);
  });

  it('continua a sequência no mesmo turno e permite reiniciar em outro turno', () => {
    expect(buildAvailableClassBatchNames('1º ano', 1, ['1º ano A'])).toEqual([
      '1º ano B',
    ]);
    expect(buildAvailableClassBatchNames('1º ano', 1, [])).toEqual(['1º ano A']);
  });

  it('considera o nome antigo sem letra como a seção A', () => {
    expect(buildAvailableClassBatchNames('1º ano', 2, ['1º ano'])).toEqual([
      '1º ano B',
      '1º ano C',
    ]);
  });

  it('preenche letras disponíveis antes de avançar', () => {
    expect(buildAvailableClassBatchNames('1º ano - {letra}', 2, [
      '1º ano - A',
      '1º ano - C',
    ])).toEqual(['1º ano - B', '1º ano - D']);
  });

  it('mantém a sequência independente em cada turno e reconhece nomes antigos', () => {
    expect(buildAvailableClassBatchNames('1º ano', 1, [], 'MATUTINO')).toEqual([
      '1º ano A M',
    ]);
    expect(buildAvailableClassBatchNames('1º ano', 1, ['1º ano A'], 'MATUTINO')).toEqual([
      '1º ano B M',
    ]);
    expect(buildAvailableClassBatchNames('1º ano', 1, [], 'VESPERTINO')).toEqual([
      '1º ano A V',
    ]);
  });

  it('exibe o turno em registros legados sem alterar nomes já completos', () => {
    expect(getClassDisplayName('1º ano A', 'MATUTINO')).toBe('1º ano A M');
    expect(getClassDisplayName('1º ano A V', 'VESPERTINO')).toBe('1º ano A V');
  });
});
