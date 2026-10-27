import type { LearningActivity, LearningProgress, LearningSubject } from '../services/learningCenterService';

const standardBnccSubjectsByCode = new Map<string, string>([
  ['ART', 'Arte'],
  ['BIO', 'Biologia'],
  ['SCI', 'Ciências'],
  ['EDF', 'Educação Física'],
  ['FIL', 'Filosofia'],
  ['ER', 'Ensino Religioso'],
  ['FIS', 'Física'],
  ['GEO', 'Geografia'],
  ['HIS', 'História'],
  ['ING', 'Língua Inglesa'],
  ['LP', 'Língua Portuguesa'],
  ['PORT', 'Língua Portuguesa'],
  ['MAT', 'Matemática'],
  ['QUI', 'Química'],
  ['SOC', 'Sociologia'],
]);

const standardBnccSubjectsByName = new Map<string, string>([
  ['arte', 'Arte'],
  ['artes', 'Arte'],
  ['biologia', 'Biologia'],
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

/**
 * Keeps the student's active class offerings as the source of truth.
 * The global curriculum catalog may normalize a label, but must never add a
 * subject that is not part of the student's institutional enrollment.
 */
export function getInstitutionalStudentSubjects(
  institutionalSubjects: readonly LearningSubject[],
): LearningSubject[] {
  const subjectsById = new Map<string, LearningSubject>();
  for (const subject of institutionalSubjects) {
    if (!subjectsById.has(subject.id)) {
      subjectsById.set(subject.id, {
        ...subject,
        name: standardSubjectName(subject.name, subject.code) ?? subject.name,
      });
    }
  }

  return [...subjectsById.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
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
      && recommendation.pedagogical_review_status === 'PEDAGOGICAL_REVIEWED'
      && recommendation.availability_status === 'AVAILABLE';
  }

  // Preserve continuation for legacy sessions that have no V9 demo journey.
  return recommendation.state === 'ACTIVE';
}
