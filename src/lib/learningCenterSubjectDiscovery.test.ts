import { describe, expect, it } from 'vitest';

import {
  getInstitutionalStudentSubjects,
  getPublishedLearningProgress,
  getStudentJourneyAvailabilityLabel,
  getStudentSubjectAvailabilityLabel,
  isStudentGuidedJourneyPreview,
  isStudentGuidedStudyReleased,
  mergeStudentSubjectsWithGuidedJourneys,
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

  it('excludes components outside the BNCC subject catalog', () => {
    expect(getInstitutionalStudentSubjects([
      { id: 'math', name: 'Matemática' },
      { id: 'life-project', name: 'Projeto de Vida' },
      { id: 'research', name: 'Iniciação Científica' },
      { id: 'digital-culture', name: 'Cultura Digital' },
      { id: 'elective', name: 'Eletiva Interdisciplinar' },
      { id: 'writing', name: 'Redação' },
    ])).toEqual([{ id: 'math', name: 'Matemática' }]);
  });

  it('normalizes an institutional Portuguese subject alias without adding catalog subjects', () => {
    expect(getInstitutionalStudentSubjects([
      { id: 'portuguese', name: 'Componente de linguagem', code: 'PORT' },
    ])).toEqual([
      { id: 'portuguese', name: 'Língua Portuguesa', code: 'PORT' },
    ]);
  });

  it('does not allow a published extra-curricular component to bypass BNCC filtering', () => {
    expect(getInstitutionalStudentSubjects([
      { id: 'custom', name: 'Oficina de Projetos', has_published_activities: true },
    ])).toEqual([]);
  });

  it('does not duplicate repeated subject offerings', () => {
    expect(getInstitutionalStudentSubjects([
      { id: 'math', name: 'Matemática' },
      { id: 'math', name: 'MAT' },
    ])).toEqual([{ id: 'math', name: 'Matemática' }]);
  });

  it('merges server-returned BNCC journeys without adding extra subjects', () => {
    expect(mergeStudentSubjectsWithGuidedJourneys(
      [{ id: 'math', name: 'Matemática' }, { id: 'extra', name: 'Projeto de Vida' }],
      [
        { journey_id: 'english', journey_code: 'EN-1', subject_id: 'english', subject_code: 'ING', subject_name: 'Inglês', canonical_subject_code: 'ENGLISH', unit_code: 'U1', unit_title: 'Unit 1', title: 'Hello', execution_skill_id: 'skill-1', official_codes: [], official_areas: [], mapping_status: 'MAPPING_PENDING', mapping_reason: '', learning_role: 'CORE', availability_status: 'DEMO_PREVIEW', question_count: 20, missing_purposes: [], progress: 0, active_session_id: null, active_session_status: null, pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', reason: '', source: 'V9' },
        { journey_id: 'extra-journey', journey_code: 'EX-1', subject_id: 'extra', subject_code: '', subject_name: 'Projeto de Vida', canonical_subject_code: '', unit_code: 'U1', unit_title: 'Projeto', title: 'Planejar', execution_skill_id: 'skill-2', official_codes: [], official_areas: [], mapping_status: 'MAPPING_PENDING', mapping_reason: '', learning_role: 'CORE', availability_status: 'DEMO_PREVIEW', question_count: 20, missing_purposes: [], progress: 0, active_session_id: null, active_session_status: null, pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', reason: '', source: 'V9' },
      ],
    )).toEqual([
      { id: 'english', name: 'Língua Inglesa' },
      { id: 'math', name: 'Matemática' },
    ]);
  });

  it('shows complete V9 content only as a clearly labeled demonstration preview', () => {
    const preview = {
      journey_id: 'journey-math', journey_code: 'MATH-1', subject_id: 'math', subject_code: 'MAT', subject_name: 'Matemática', canonical_subject_code: 'MATHEMATICS', unit_code: 'U1', unit_title: 'Números', title: 'Resolver situações-problema', execution_skill_id: 'skill-1', official_codes: [], official_areas: [], mapping_status: 'MAPPING_PENDING', mapping_reason: '', learning_role: 'CORE', availability_status: 'DEMO_PREVIEW', question_count: 20, missing_purposes: [], progress: 0, active_session_id: null, active_session_status: null, pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', reason: '', source: 'V9' as const,
    };
    expect(isStudentGuidedJourneyPreview(preview)).toBe(true);
    expect(getStudentJourneyAvailabilityLabel([preview])).toBe('1 aula em prévia demonstrativa');
    expect(isStudentGuidedJourneyPreview({ ...preview, pedagogical_review_status: 'PEDAGOGICAL_REVIEWED' })).toBe(true);
    expect(isStudentGuidedJourneyPreview({ ...preview, question_count: 5 })).toBe(false);
    expect(isStudentGuidedJourneyPreview({ ...preview, missing_purposes: ['REVIEW'] })).toBe(false);
    expect(isStudentGuidedJourneyPreview({ ...preview, source: 'CENTRAL_STUDIES_V2' })).toBe(false);
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

  it('does not release unmapped or demonstration journeys to students', () => {
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

  it('requires publication, exact mapping and availability, not a human review flag', () => {
    expect(isStudentGuidedStudyReleased({
      state: 'READY',
      journey_id: 'journey-technical',
      publication_status: 'PUBLISHED',
      mapping_status: 'MAPPED',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
      availability_status: 'AVAILABLE',
    })).toBe(true);
    expect(isStudentGuidedStudyReleased({
      state: 'READY', journey_id: 'journey-no-review-field', publication_status: 'PUBLISHED',
      mapping_status: 'MAPPED', availability_status: 'AVAILABLE',
    })).toBe(true);
  });

  it('keeps continuation available for a legacy active session without a V9 journey', () => {
    expect(isStudentGuidedStudyReleased({ state: 'ACTIVE' })).toBe(true);
    expect(isStudentGuidedStudyReleased({ state: 'READY' })).toBe(false);
  });
});
