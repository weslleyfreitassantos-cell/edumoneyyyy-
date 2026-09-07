import { describe, expect, it, vi } from 'vitest';

import {
  buildClassBatchNames,
  buildEducationPresetClassDefinitions,
  classAutomationService,
  EDUCATION_PRESET_GRADES,
} from './classAutomationService';

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

  it('prepara todas as series da educacao basica com duas turmas por padrao', () => {
    const definitions = buildEducationPresetClassDefinitions({});

    expect(definitions).toHaveLength(12);
    expect(definitions[0]).toMatchObject({
      count: 2,
      names: ['1º ano A', '1º ano B'],
    });
    expect(definitions[9]).toMatchObject({
      count: 2,
      names: ['1ª série EM A', '1ª série EM B'],
    });
  });

  it('permite zerar uma serie e personalizar outra', () => {
    const definitions = buildEducationPresetClassDefinitions({
      'fundamental-1': 0,
      'medio-3': 1,
    });

    expect(definitions[0].names).toEqual([]);
    expect(definitions[11].names).toEqual(['3ª série EM']);
  });

  it('executa o preset sem depender do contexto this', async () => {
    const classCounts = Object.fromEntries(
      EDUCATION_PRESET_GRADES.map((grade) => [grade.key, 0]),
    );
    classCounts['fundamental-1'] = 1;
    classCounts['medio-1'] = 1;

    const createBatch = vi.spyOn(classAutomationService, 'createBatch').mockResolvedValue({
      createdClassIds: ['class-1'],
      createdClassNames: ['Turma criada'],
      curriculumItemsApplied: 0,
      assignmentsCreated: 0,
      uncoveredSubjects: [],
    });

    try {
      const createPreset = classAutomationService.createEducationPreset;
      const result = await createPreset({
        institutionId: 'institution-1',
        academicYearId: 'year-1',
        classCounts,
        shift: 'INTEGRAL',
        capacity: 30,
        assignTeachers: false,
      });

      expect(createBatch).toHaveBeenCalledTimes(2);
      expect(result.createdClassNames).toEqual(['Turma criada', 'Turma criada']);
    } finally {
      createBatch.mockRestore();
    }
  });
});
