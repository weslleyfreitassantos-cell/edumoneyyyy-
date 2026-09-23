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
        '/dashboard/class-diary',
        '/dashboard/grades',
        '/dashboard/term-closing',
      ]),
    );
    expect(features.map((feature) => feature.route)).not.toContain(
      '/dashboard/subjects',
    );
    expect(features.map((feature) => feature.label)).toEqual(
      expect.arrayContaining([
        'Aulas do dia',
        'Contribuições pedagógicas',
      ]),
    );
  });

  it('filtra recursos administrativos pela permissão efetiva', () => {
    const directorFeatures = getAssistantFeatures('director', {
      platformRole: 'USER',
      membershipRole: 'DIRECTOR',
      profileRole: 'DIRECTOR',
    }, [
      { id: 'email', label: 'E-mail', path: '/email' },
      { id: 'announcements', label: 'Avisos', path: '/admin?module=announcements' },
      { id: 'finance', label: 'Financeiro', path: '/admin?module=finance' },
    ]);
    const unavailableFeatures = getAssistantFeatures('director', {
      platformRole: 'USER',
      membershipRole: 'TEACHER',
      profileRole: 'TEACHER',
    });

    expect(directorFeatures.map((feature) => feature.route)).toEqual(
      expect.arrayContaining([
        '/email',
        '/admin?module=announcements',
        '/admin?module=finance',
      ]),
    );
    expect(unavailableFeatures.map((feature) => feature.route)).not.toEqual(
      expect.arrayContaining([
        '/email',
        '/admin?module=announcements',
        '/admin?module=finance',
      ]),
    );
  });

  it('descobre automaticamente um novo item do menu', () => {
    const features = getAssistantFeatures('student', {}, [
      {
        id: 'new-learning-area',
        label: 'Biblioteca digital',
        path: '/dashboard/digital-library',
      },
    ]);

    expect(features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Biblioteca digital',
          route: '/dashboard/digital-library',
        }),
      ]),
    );
  });
});
