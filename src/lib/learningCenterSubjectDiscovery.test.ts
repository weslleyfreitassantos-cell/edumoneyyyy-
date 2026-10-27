import { describe, expect, it } from 'vitest';

import {
  getInstitutionalStudentSubjects,
  getPublishedLearningProgress,
  getStudentSubjectAvailabilityLabel,
  isStudentGuidedStudyReleased,
} from './learningCenterSubjectDiscovery';

describe('student subject discovery', () => {
  it('uses only subjects from the active institutional enrollment', () => {
    expect(getInstitutionalStudentSubjects([
      { id: 'math', name: 'Matemática' },
      { id: 'science', name: 'Ciências Naturais', code: 'SCI' },
    ])).toEqual([
      { id: 'science', name: 'Ciências', code: 'SCI' },
      { id: 'math', name: 'Matemática' },
    ]);
  });

  it('preserves custom institutional components even when they are absent from the BNCC alias list', () => {
    expect(getInstitutionalStudentSubjects([
      { id: 'custom', name: 'Oficina de Projetos' },
      { id: 'life-project', name: 'Projeto de Vida' },
    ])).toEqual([
      { id: 'custom', name: 'Oficina de Projetos' },
      { id: 'life-project', name: 'Projeto de Vida' },
    ]);
  });

  it('normalizes an institutional Portuguese subject alias without adding catalog subjects', () => {
    expect(getInstitutionalStudentSubjects([
      { id: 'portuguese', name: 'Componente de linguagem', code: 'PORT' },
    ])).toEqual([
      { id: 'portuguese', name: 'Língua Portuguesa', code: 'PORT' },
    ]);
  });

  it('does not duplicate repeated subject offerings', () => {
    expect(getInstitutionalStudentSubjects([
      { id: 'math', name: 'Matemática' },
      { id: 'math', name: 'MAT' },
    ])).toEqual([{ id: 'math', name: 'Matemática' }]);
  });

  it('uses published institutional activities for the card summary and a natural empty state', () => {
    expect(getStudentSubjectAvailabilityLabel(1)).toBe('1 atividade publicada');
    expect(getStudentSubjectAvailabilityLabel(4)).toBe('4 atividades publicadas');
    expect(getStudentSubjectAvailabilityLabel(0)).toBe('Novas atividades desta matéria estão sendo preparadas.');
  });

  it('calculates progress only for skills attached to published activities', () => {
    expect(getPublishedLearningProgress(
      [{ skill_id: 'published-skill' }, { skill_id: 'published-skill' }, { skill_id: null }],
      [
        { skill_id: 'published-skill', mastery_percent: 80, status: 'IN_PROGRESS', last_activity_at: '2026-10-24T10:00:00.000Z' },
        { skill_id: 'unpublished-skill', mastery_percent: 100, status: 'MASTERED', last_activity_at: '2026-10-25T10:00:00.000Z' },
      ],
    )).toEqual({ skillCount: 1, masteredCount: 0, masteryPercent: 80, lastActivityAt: '2026-10-24T10:00:00.000Z' });
    expect(getPublishedLearningProgress([{ skill_id: null }], [])).toBeNull();
  });

  it('does not release pending, unmapped or demonstration journeys to students', () => {
    expect(isStudentGuidedStudyReleased({
      state: 'ACTIVE',
      journey_id: 'journey-pending',
      demonstration_only: true,
      mapping_status: 'MAPPING_PENDING',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
    })).toBe(false);

    expect(isStudentGuidedStudyReleased({
      state: 'READY',
      journey_id: 'journey-unreviewed',
      publication_status: 'STAGING',
      mapping_status: 'MAPPING_PENDING',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
      availability_status: 'DEMO_PREVIEW',
    })).toBe(false);

    expect(isStudentGuidedStudyReleased({
      state: 'ACTIVE',
      journey_id: 'journey-staging',
      publication_status: 'STAGING',
      mapping_status: 'MAPPED',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEWED',
      availability_status: 'AVAILABLE',
    })).toBe(false);
  });

  it('requires a published, mapped and human-reviewed version before starting a V9 journey', () => {
    expect(isStudentGuidedStudyReleased({
      state: 'READY',
      journey_id: 'journey-approved',
      publication_status: 'PUBLISHED',
      mapping_status: 'MAPPED',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEWED',
      availability_status: 'AVAILABLE',
    })).toBe(true);
  });

  it('keeps continuation available for a legacy active session without a V9 journey', () => {
    expect(isStudentGuidedStudyReleased({ state: 'ACTIVE' })).toBe(true);
    expect(isStudentGuidedStudyReleased({ state: 'READY' })).toBe(false);
  });
});
