import { describe, expect, it } from 'vitest';

import { getAssistantFeatures } from './featureRegistry';

describe('featureRegistry', () => {
  it('expõe ao aluno as áreas acadêmicas disponíveis para o perfil', () => {
    const features = getAssistantFeatures('student');

    expect(features.map((feature) => feature.route)).toEqual(
      expect.arrayContaining([
        '/dashboard/timetable',
        '/dashboard/subjects',
        '/dashboard/materials',
      ]),
    );
    expect(features.map((feature) => feature.route)).not.toContain(
      '/admin?module=timetable&view=automation',
    );
  });

  it('mantém as ações docentes separadas das áreas do aluno', () => {
    const features = getAssistantFeatures('teacher');

    expect(features.map((feature) => feature.route)).toEqual(
      expect.arrayContaining([
        '/dashboard/timetable',
        '/dashboard/materials',
        '/dashboard/attendance',
        '/dashboard/grades',
        '/dashboard/term-closing',
      ]),
    );
    expect(features.map((feature) => feature.route)).not.toContain(
      '/dashboard/subjects',
    );
  });
});
