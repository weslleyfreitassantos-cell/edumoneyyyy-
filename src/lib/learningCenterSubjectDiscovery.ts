import type { GuidedDisciplineJourneyV9, LearningActivity, LearningProgress, LearningSubject } from '../services/learningCenterService';

const standardBnccSubjectsByCode = new Map<string, string>([
  ['ART', 'Arte'],
  ['ARTES', 'Arte'],
  ['BIO', 'Biologia'],
  ['BIOLOGY', 'Biologia'],
  ['CIE', 'Ciências'],
  ['CIENCIAS', 'Ciências'],
  ['SCI', 'Ciências'],
  ['SCIENCE', 'Ciências'],
  ['EDF', 'Educação Física'],
  ['PHYSICAL_EDUCATION', 'Educação Física'],
  ['FIL', 'Filosofia'],
  ['PHILOSOPHY', 'Filosofia'],
  ['ER', 'Ensino Religioso'],
  ['RELIGIOUS_EDUCATION', 'Ensino Religioso'],
  ['FIS', 'Física'],
  ['PHYSICS', 'Física'],
  ['GEO', 'Geografia'],
  ['GEOGRAPHY', 'Geografia'],
  ['HIS', 'História'],
  ['HISTORY', 'História'],
  ['ING', 'Língua Inglesa'],
  ['ENGLISH', 'Língua Inglesa'],
  ['LP', 'Língua Portuguesa'],
  ['PORT', 'Língua Portuguesa'],
  ['PORTUGUESE', 'Língua Portuguesa'],
  ['MAT', 'Matemática'],
  ['MATHEMATICS', 'Matemática'],
  ['QUI', 'Química'],
  ['CHEMISTRY', 'Química'],
  ['SOC', 'Sociologia'],
  ['SOCIOLOGY', 'Sociologia'],
]);

const standardBnccSubjectsByName = new Map<string, string>([
  ['arte', 'Arte'],
  ['artes', 'Arte'],
  ['biologia', 'Biologia'],
  ['ciencias da natureza', 'Ciências'],
  ['ciencias da natureza e suas tecnologias', 'Ciências'],
  ['ciencias', 'Ciências'],
  ['ciencias naturais', 'Ciências'],
  ['educacao fisica', 'Educação Física'],
  ['ed fisica', 'Educação Física'],
  ['filosofia', 'Filosofia'],
  ['ensino religioso', 'Ensino Religioso'],
  ['fisica', 'Física'],
  ['geografia', 'Geografia'],
  ['historia', 'História'],
  ['ingles', 'Língua Inglesa'],
  ['lingua inglesa', 'Língua Inglesa'],
  ['portugues', 'Língua Portuguesa'],
  ['lingua portuguesa', 'Língua Portuguesa'],
  ['matematica', 'Matemática'],
  ['quimica', 'Química'],
  ['sociologia', 'Sociologia'],
]);

function normalizeSubjectKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function standardSubjectName(name: string, code?: string | null): string | null {
  const normalizedCode = code?.trim().toUpperCase();
  return (normalizedCode ? standardBnccSubjectsByCode.get(normalizedCode) : undefined)
    ?? standardBnccSubjectsByName.get(normalizeSubjectKey(name))
    ?? null;
}

/** Normalizes institution-scoped subjects and excludes non-BNCC components. */
export function getInstitutionalStudentSubjects(
  institutionalSubjects: readonly LearningSubject[],
): LearningSubject[] {
  const subjectsById = new Map<string, LearningSubject>();
  for (const subject of institutionalSubjects) {
    const name = standardSubjectName(subject.name, subject.code);
    if (!name) continue;
    if (!subjectsById.has(subject.id)) {
      subjectsById.set(subject.id, {
        ...subject,
        name,
      });
    }
  }

  return [...subjectsById.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

export function mergeStudentSubjectsWithGuidedJourneys(
  institutionalSubjects: readonly LearningSubject[],
  journeys: readonly GuidedDisciplineJourneyV9[],
): LearningSubject[] {
  const subjectsById = new Map(
    getInstitutionalStudentSubjects(institutionalSubjects).map((subject) => [subject.id, subject]),
  );

  for (const journey of journeys) {
    if (!isStudentGuidedJourneyPreview(journey) && !isStudentGuidedJourneyReleased(journey)) continue;
    const name = standardSubjectName(journey.subject_name, journey.canonical_subject_code);
    if (!name || subjectsById.has(journey.subject_id)) continue;
    subjectsById.set(journey.subject_id, { id: journey.subject_id, name });
  }

  return [...subjectsById.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

export function isStudentGuidedJourneyPreview(journey: GuidedDisciplineJourneyV9): boolean {
  return journey.source === 'V9'
    && journey.availability_status === 'DEMO_PREVIEW'
    && journey.mapping_status === 'MAPPING_PENDING'
    && journey.question_count >= 12
    && journey.missing_purposes.length === 0;
}

export function isStudentGuidedJourneyReleased(journey: GuidedDisciplineJourneyV9): boolean {
  return journey.publication_status === 'PUBLISHED'
    && journey.availability_status === 'AVAILABLE'
    && journey.mapping_status === 'MAPPED';
}

export function getStudentJourneyAvailabilityLabel(journeys: readonly GuidedDisciplineJourneyV9[]): string | null {
  const releasedCount = journeys.filter(isStudentGuidedJourneyReleased).length;
  if (releasedCount > 0) {
    return `${releasedCount} ${releasedCount === 1 ? 'aula disponível' : 'aulas disponíveis'}`;
  }

  const previewCount = journeys.filter(isStudentGuidedJourneyPreview).length;
  return previewCount > 0
    ? `${previewCount} ${previewCount === 1 ? 'aula em prévia demonstrativa' : 'aulas em prévia demonstrativa'}`
    : null;
}

export function getStudentSubjectAvailabilityLabel(publishedActivityCount: number): string {
  if (publishedActivityCount > 0) {
    return `${publishedActivityCount} ${publishedActivityCount === 1 ? 'atividade publicada' : 'atividades publicadas'}`;
  }

  return 'Novas atividades desta matéria estão sendo preparadas.';
}

export function getPublishedLearningProgress(
  publishedActivities: readonly Pick<LearningActivity, 'skill_id'>[],
  progressRows: readonly LearningProgress[],
): { skillCount: number; masteredCount: number; masteryPercent: number; lastActivityAt: string | null } | null {
  const publishedSkillIds = new Set(
    publishedActivities.flatMap((activity) => activity.skill_id ? [activity.skill_id] : []),
  );
  if (publishedSkillIds.size === 0) return null;

  const progressBySkill = new Map(progressRows.map((row) => [row.skill_id, row]));
  const masteryTotal = [...publishedSkillIds].reduce(
    (total, skillId) => total + Math.max(0, Math.min(100, progressBySkill.get(skillId)?.mastery_percent ?? 0)),
    0,
  );
  const masteredCount = [...publishedSkillIds].filter(
    (skillId) => progressBySkill.get(skillId)?.status === 'MASTERED',
  ).length;
  const lastActivityAt = [...publishedSkillIds]
    .flatMap((skillId) => {
      const value = progressBySkill.get(skillId)?.last_activity_at;
      return value && Number.isFinite(Date.parse(value)) ? [value] : [];
    })
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

  return {
    skillCount: publishedSkillIds.size,
    masteredCount,
    masteryPercent: Math.round(masteryTotal / publishedSkillIds.size),
    lastActivityAt,
  };
}

export function isStudentGuidedStudyReleased(recommendation: {
  state: string;
  journey_id?: string | null;
  demonstration_only?: boolean | null;
  publication_status?: string | null;
  mapping_status?: string | null;
  pedagogical_review_status?: string | null;
  availability_status?: string | null;
}): boolean {
  if (recommendation.demonstration_only) return false;

  if (recommendation.journey_id) {
    return ['ACTIVE', 'READY', 'REVIEW'].includes(recommendation.state)
      && recommendation.publication_status === 'PUBLISHED'
      && recommendation.mapping_status === 'MAPPED'
      && recommendation.availability_status === 'AVAILABLE';
  }

  // Preserve continuation for legacy sessions that have no V9 demo journey.
  return recommendation.state === 'ACTIVE';
}
