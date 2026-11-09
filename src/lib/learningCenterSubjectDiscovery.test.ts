import { describe, expect, it } from 'vitest';

import {
  getInstitutionalStudentSubjects,
  getPublishedLearningProgress,
  buildStudentSubjectLearningSummary,
  getStudentJourneyAvailabilityLabel,
  getStudentSubjectAvailabilityLabel,
  getStudentSubjectAreaScopes,
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

  it('maps the 12 BNCC disciplines to their V13 areas without assigning the area as an exact subject', () => {
    const disciplines = [
      ['MAT', 'Matemática', 'MATEMATICA'],
      ['LP', 'Língua Portuguesa', 'LINGUAGENS'], ['ING', 'Língua Inglesa', 'LINGUAGENS'],
      ['ART', 'Arte', 'LINGUAGENS'], ['EDF', 'Educação Física', 'LINGUAGENS'],
      ['BIO', 'Biologia', 'CIENCIAS_DA_NATUREZA'], ['QUI', 'Química', 'CIENCIAS_DA_NATUREZA'],
      ['FIS', 'Física', 'CIENCIAS_DA_NATUREZA'],
      ['HIS', 'História', 'CIENCIAS_HUMANAS'], ['GEO', 'Geografia', 'CIENCIAS_HUMANAS'],
      ['FIL', 'Filosofia', 'CIENCIAS_HUMANAS'], ['SOC', 'Sociologia', 'CIENCIAS_HUMANAS'],
    ] as const;

    for (const [code, name, expectedArea] of disciplines) {
      expect(getStudentSubjectAreaScopes({ id: code, code, name }, []))
        .toEqual([expect.objectContaining({ code: expectedArea, source: 'V13_COMPATIBILITY' })]);
    }
  });

  it.each([
    ['MAT', 'Matemática', 'MATEMATICA'],
    ['LP', 'Língua Portuguesa', 'LINGUAGENS'], ['ING', 'Língua Inglesa', 'LINGUAGENS'],
    ['ART', 'Arte', 'LINGUAGENS'], ['EDF', 'Educação Física', 'LINGUAGENS'],
    ['BIO', 'Biologia', 'CIENCIAS_DA_NATUREZA'], ['QUI', 'Química', 'CIENCIAS_DA_NATUREZA'],
    ['FIS', 'Física', 'CIENCIAS_DA_NATUREZA'],
    ['HIS', 'História', 'CIENCIAS_HUMANAS'], ['GEO', 'Geografia', 'CIENCIAS_HUMANAS'],
    ['FIL', 'Filosofia', 'CIENCIAS_HUMANAS'], ['SOC', 'Sociologia', 'CIENCIAS_HUMANAS'],
  ])('%s apresenta habilidades disponíveis, em andamento, consolidadas e ausência confirmada', (code, name, area) => {
    const subject = { id: code, code, name };
    const target = (id: string, availability = 'READY', progress = 0) => ({
      target_canonical_skill_id: id, subject_id: null, catalog_id: 'bncc', catalog_code: 'BNCC_2018',
      official_code: id, title: id, subject_area: area, stage: 'ENSINO_MEDIO', grade_level: 1,
      availability_status: availability, progress, has_lesson: true, question_count: 1,
      active_session_id: null, active_session_status: null, reason: '',
    });
    const common = {
      subject,
      curriculumLinks: [{ subject_id: code, subject_area: area }],
      canonicalProgress: [
        { canonical_skill_id: `${code}-started`, skill_title: 'Em andamento', state: 'LEARNING' as const, mastery_estimate: 45, evidence_count: 1, confidence: 0.8, updated_at: '2026-11-09T00:00:00Z' },
        { canonical_skill_id: `${code}-mastered`, skill_title: 'Consolidada', state: 'MASTERED' as const, mastery_estimate: 100, evidence_count: 3, confidence: 1, updated_at: '2026-11-09T00:00:00Z' },
      ],
      activities: [], activityProgress: [], journeys: [],
    };
    const populated = buildStudentSubjectLearningSummary({
      ...common,
      guidedTargets: [target(`${code}-available`), target(`${code}-started`, 'NO_ACTIVE_SESSION', 45), target(`${code}-mastered`, 'READY', 100)],
    });
    expect(populated.areaStats).toMatchObject({ availableCount: 3, inProgressCount: 1, masteredCount: 1, masteryPercent: 48, evidenceCount: 4 });

    const empty = buildStudentSubjectLearningSummary({ ...common, guidedTargets: [] });
    expect(empty.areaScopes).toHaveLength(1);
    expect(empty.areaSkills).toEqual([]);
    expect(empty.areaStats.masteryPercent).toBeNull();
  });

  it('shows published area skills and real states while keeping exact activities and journeys scoped to their subject', () => {
    const subject = { id: 'history', code: 'HIS', name: 'História' };
    const target = (code: string, title: string, status: string, progress = 0, hasLesson = true) => ({
      target_canonical_skill_id: code, subject_id: null, catalog_id: 'bncc', catalog_code: 'BNCC_2018',
      official_code: code, title, subject_area: 'CIENCIAS_HUMANAS', stage: 'ENSINO_MEDIO', grade_level: 1,
      availability_status: status, progress, has_lesson: hasLesson, question_count: 4,
      active_session_id: null, active_session_status: null, reason: '',
    });
    const journey = (subjectId: string, id: string) => ({
      journey_id: id, journey_code: id, subject_id: subjectId, subject_code: 'HIS', subject_name: 'História',
      canonical_subject_code: 'HISTORY', unit_code: 'U1', unit_title: 'História', title: id,
      execution_skill_id: id, official_codes: [], official_areas: ['CIENCIAS_HUMANAS'], mapping_status: 'MAPPED',
      publication_status: 'PUBLISHED', mapping_reason: '', learning_role: 'CORE', availability_status: 'AVAILABLE',
      question_count: 4, missing_purposes: [], progress: 25, active_session_id: null, active_session_status: null,
      pedagogical_review_status: 'PEDAGOGICAL_REVIEWED', reason: '', source: 'V9' as const,
    });
    const summary = buildStudentSubjectLearningSummary({
      subject,
      curriculumLinks: [{ subject_id: 'history', subject_area: 'CIENCIAS_HUMANAS' }],
      guidedTargets: [
        target('skill-mastered', 'Habilidade publicada consolidada', 'READY'),
        target('skill-started', 'Habilidade publicada em andamento', 'NO_ACTIVE_SESSION', 40),
        target('skill-new', 'Habilidade publicada disponível', 'READY'),
        target('skill-hidden', 'Conteúdo sem lição', 'NO_LESSON', 0, false),
      ],
      canonicalProgress: [
        { canonical_skill_id: 'skill-mastered', skill_title: 'Habilidade publicada consolidada', state: 'MASTERED', mastery_estimate: 100, evidence_count: 3, confidence: 1, updated_at: '2026-11-09T00:00:00Z' },
        { canonical_skill_id: 'skill-started', skill_title: 'Habilidade publicada em andamento', state: 'LEARNING', mastery_estimate: 40, evidence_count: 2, confidence: 0.8, updated_at: '2026-11-09T00:00:00Z' },
      ],
      activities: [
        { id: 'history-activity', subject_id: 'history', unit_id: null, skill_id: 'activity-skill', teacher_id: 'teacher', title: 'Fonte histórica', description: null, activity_type: 'QUIZ', status: 'PUBLISHED' },
        { id: 'geography-activity', subject_id: 'geography', unit_id: null, skill_id: 'geo-skill', teacher_id: 'teacher', title: 'Cartografia', description: null, activity_type: 'QUIZ', status: 'PUBLISHED' },
      ],
      activityProgress: [{ skill_id: 'activity-skill', mastery_percent: 75, status: 'IN_PROGRESS', last_activity_at: null }],
      journeys: [journey('history', 'História específica'), journey('geography', 'Jornada indevida de Geografia')],
    });

    expect(summary.areaSkills.map((skill) => skill.target_canonical_skill_id)).toEqual(['skill-mastered', 'skill-new', 'skill-started']);
    expect(summary.areaSkills.find((skill) => skill.target_canonical_skill_id === 'skill-mastered')?.evidenceCount).toBe(3);
    expect(summary.areaStats).toMatchObject({ availableCount: 3, inProgressCount: 1, masteredCount: 1, masteryPercent: 47, evidenceCount: 5 });
    expect(summary.publishedActivities.map((activity) => activity.id)).toEqual(['history-activity']);
    expect(summary.activityProgress?.masteryPercent).toBe(75);
    expect(summary.releasedJourneys.map((item) => item.title)).toEqual(['História específica']);
  });
});
