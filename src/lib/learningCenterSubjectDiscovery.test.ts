import { describe, expect, it } from 'vitest';

import { mergeStudentSubjectsWithGuidedJourneys } from './learningCenterSubjectDiscovery';
import type { GuidedDisciplineJourneyV9 } from '../services/learningCenterService';

function journey(subjectId: string, subjectName: string): GuidedDisciplineJourneyV9 {
  return {
    journey_id: `journey-${subjectId}`,
    journey_code: `CODE-${subjectId}`,
    subject_id: subjectId,
    subject_code: subjectId,
    subject_name: subjectName,
    canonical_subject_code: subjectId,
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
      [{ id: 'math-id', name: 'Matemática' }, { id: 'robotics-id', name: 'Robótica' }],
      [journey('math-id', 'Matemática canônica'), journey('physics-id', 'Física')],
    );

    expect(subjects).toEqual([
      { id: 'physics-id', name: 'Física' },
      { id: 'math-id', name: 'Matemática' },
      { id: 'robotics-id', name: 'Robótica' },
    ]);
  });

  it('preserves institutional custom subjects when there is no BNCC journey', () => {
    expect(mergeStudentSubjectsWithGuidedJourneys([{ id: 'custom', name: 'Oficina de Projetos' }], [])).toEqual([
      { id: 'custom', name: 'Oficina de Projetos' },
    ]);
  });
});
