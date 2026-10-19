import { describe, expect, it } from 'vitest';

import { mergeStudentSubjectsWithGuidedJourneys } from './learningCenterSubjectDiscovery';
import type { GuidedDisciplineJourneyV9 } from '../services/learningCenterService';

function journey(subjectId: string, subjectName: string, canonicalSubjectCode = subjectId): GuidedDisciplineJourneyV9 {
  return {
    journey_id: `journey-${subjectId}`,
    journey_code: `CODE-${subjectId}`,
    subject_id: subjectId,
    subject_code: subjectId,
    subject_name: subjectName,
    canonical_subject_code: canonicalSubjectCode,
    unit_code: 'UNIT',
    unit_title: 'Unidade',
    title: 'Jornada',
    execution_skill_id: `skill-${subjectId}`,
    official_codes: [],
    official_areas: [],
    mapping_status: 'MAPPING_PENDING',
    mapping_reason: 'Pendente de validação.',
    learning_role: 'INTRODUCTORY_CONTENT',
    availability_status: 'DEMO_PREVIEW',
    question_count: 8,
    missing_purposes: [],
    progress: 0,
    active_session_id: null,
    active_session_status: null,
    pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
    reason: 'Prévia demonstrativa.',
  };
}

describe('student subject discovery', () => {
  it('adds curriculum subjects without an institutional offering, without duplicating existing cards', () => {
    const subjects = mergeStudentSubjectsWithGuidedJourneys(
      [{ id: 'math', name: 'Matemática' }, { id: 'robotics-id', name: 'Robótica' }],
      [journey('math', 'Matemática canônica', 'MATHEMATICS'), journey('physics-id', 'Física', 'PHYSICS')],
    );

    expect(subjects).toEqual([
      { id: 'physics-id', name: 'Física' },
      { id: 'math', name: 'Matemática' },
    ]);
  });

  it('excludes institutional custom subjects when there is no BNCC journey', () => {
    expect(mergeStudentSubjectsWithGuidedJourneys([{ id: 'custom', name: 'Oficina de Projetos' }], [])).toEqual([
    ]);
  });

  it('shows only the twelve standard high-school BNCC components, including recognized codes and aliases', () => {
    const subjects = mergeStudentSubjectsWithGuidedJourneys(
      [
        { id: 'art', name: 'Artes' },
        { id: 'biology', name: 'Biologia' },
        { id: 'pe', name: 'Ed. Física' },
        { id: 'philosophy', name: 'Filosofia' },
        { id: 'physics', name: 'Física' },
        { id: 'geography', name: 'Geografia' },
        { id: 'history', name: 'História' },
        { id: 'english', name: 'Inglês' },
        { id: 'portuguese', name: 'Português' },
        { id: 'math', name: 'Componente MAT', code: 'MAT' },
        { id: 'chemistry', name: 'Química' },
        { id: 'sociology', name: 'Sociologia' },
        { id: 'research', name: 'Iniciação Científica' },
        { id: 'life-project', name: 'Projeto de Vida' },
        { id: 'writing', name: 'Redação' },
        { id: 'digital-culture', name: 'Cultura Digital' },
        { id: 'elective', name: 'Eletiva Interdisciplinar' },
      ],
      [
        journey('math', 'Jornada matemática', 'MATHEMATICS'),
        journey('journey-digital', 'Cultura Digital', 'COMPUTING'),
      ],
    );

    expect(subjects.map((subject) => subject.name)).toEqual([
      'Arte',
      'Biologia',
      'Educação Física',
      'Filosofia',
      'Física',
      'Geografia',
      'História',
      'Língua Inglesa',
      'Língua Portuguesa',
      'Matemática',
      'Química',
      'Sociologia',
    ]);
    expect(subjects.some((subject) => subject.id === 'math')).toBe(true);
    expect(subjects.some((subject) => subject.id === 'journey-digital')).toBe(false);
  });
});
