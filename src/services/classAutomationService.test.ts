import { describe, expect, it } from 'vitest';

import { buildClassBatchNames } from './classAutomationService';

describe('buildClassBatchNames', () => {
  it('gera sufixos alfabeticos para um lote de turmas', () => {
    expect(buildClassBatchNames('1º ano', 3)).toEqual([
      '1º ano A',
      '1º ano B',
      '1º ano C',
    ]);
  });

  it('permite controlar o padrao de nome com o marcador de letra', () => {
    expect(buildClassBatchNames('1º ano - {letra}', 2)).toEqual([
      '1º ano - A',
      '1º ano - B',
    ]);
  });

  it('mantem o nome-base quando apenas uma turma e criada', () => {
    expect(buildClassBatchNames('Turma unica', 1)).toEqual(['Turma unica']);
  });

  it('rejeita uma quantidade fora do limite operacional', () => {
    expect(() => buildClassBatchNames('1º ano', 0)).toThrow(
      'A quantidade de turmas deve estar entre 1 e 26.',
    );
    expect(() => buildClassBatchNames('1º ano', 27)).toThrow(
      'A quantidade de turmas deve estar entre 1 e 26.',
    );
  });
});
