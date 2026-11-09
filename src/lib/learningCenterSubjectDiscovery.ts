import type {
  GuidedDisciplineJourneyV9,
  GuidedLearningTarget,
  LearningActivity,
  LearningCanonicalProgress,
  LearningCurriculumSubjectLink,
  LearningProgress,
  LearningSubject,
} from '../services/learningCenterService';

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

const v13FallbackAreaBySubjectCode = new Map<string, string>([
  ['MAT', 'MATEMATICA'],
  ['LP', 'LINGUAGENS'], ['ING', 'LINGUAGENS'], ['ART', 'LINGUAGENS'], ['EDF', 'LINGUAGENS'],
  ['BIO', 'CIENCIAS_DA_NATUREZA'], ['QUI', 'CIENCIAS_DA_NATUREZA'], ['FIS', 'CIENCIAS_DA_NATUREZA'],
  ['HIS', 'CIENCIAS_HUMANAS'], ['GEO', 'CIENCIAS_HUMANAS'], ['FIL', 'CIENCIAS_HUMANAS'], ['SOC', 'CIENCIAS_HUMANAS'],
]);

const bnccAreaLabels = new Map<string, string>([
  ['MATEMATICA', 'Matemática'],
  ['LINGUAGENS', 'Linguagens'],
  ['CIENCIAS_DA_NATUREZA', 'Ciências da Natureza'],
  ['CIENCIAS_HUMANAS', 'Ciências Humanas'],
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

export interface StudentSubjectAreaScope {
  code: string;
  label: string;
  source: 'INSTITUTION' | 'V13_COMPATIBILITY';
}

export interface StudentSubjectAreaSkill extends GuidedLearningTarget {
  progressState: LearningCanonicalProgress['state'] | null;
  masteryEstimate: number;
  evidenceCount: number;
}

export interface StudentSubjectLearningSummary {
  areaScopes: StudentSubjectAreaScope[];
  areaSkills: StudentSubjectAreaSkill[];
  areaStats: {
    availableCount: number;
    inProgressCount: number;
    masteredCount: number;
    masteryPercent: number | null;
    evidenceCount: number;
  };
  publishedActivities: LearningActivity[];
  activityProgress: ReturnType<typeof getPublishedLearningProgress>;
  releasedJourneys: GuidedDisciplineJourneyV9[];
}

function areaLabel(code: string): string {
  return bnccAreaLabels.get(code) ?? code.replace(/_/g, ' ').toLocaleLowerCase('pt-BR');
}

/** Mirrors the V13 institutional subject-area link plus its explicit code fallback. */
export function getStudentSubjectAreaScopes(
  subject: LearningSubject,
  links: readonly LearningCurriculumSubjectLink[],
): StudentSubjectAreaScope[] {
  const areas = new Map<string, StudentSubjectAreaScope>();
  for (const link of links) {
    if (link.subject_id !== subject.id || !link.subject_area) continue;
    areas.set(link.subject_area, { code: link.subject_area, label: areaLabel(link.subject_area), source: 'INSTITUTION' });
  }

  const fallback = subject.code ? v13FallbackAreaBySubjectCode.get(subject.code.trim().toUpperCase()) : undefined;
  if (fallback && !areas.has(fallback)) {
    areas.set(fallback, { code: fallback, label: areaLabel(fallback), source: 'V13_COMPATIBILITY' });
  }

  return [...areas.values()];
}

function clampMastery(value: number): number {
  return Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
}

export function buildStudentSubjectLearningSummary(input: {
  subject: LearningSubject;
  curriculumLinks: readonly LearningCurriculumSubjectLink[];
  guidedTargets: readonly GuidedLearningTarget[];
  canonicalProgress: readonly LearningCanonicalProgress[];
  activities: readonly LearningActivity[];
  activityProgress: readonly LearningProgress[];
  journeys: readonly GuidedDisciplineJourneyV9[];
}): StudentSubjectLearningSummary {
  const areaScopes = getStudentSubjectAreaScopes(input.subject, input.curriculumLinks);
  const areaCodes = new Set(areaScopes.map(({ code }) => code));
  const progressBySkill = new Map(input.canonicalProgress.map((row) => [row.canonical_skill_id, row]));
  const eligibleTargets = new Map<string, GuidedLearningTarget>();

  for (const target of input.guidedTargets) {
    if (!areaCodes.has(target.subject_area)) continue;
    if (!['READY', 'NO_ACTIVE_SESSION'].includes(target.availability_status)) continue;
    if (!target.has_lesson || target.question_count <= 0) continue;
    eligibleTargets.set(target.target_canonical_skill_id, target);
  }

  const areaSkills = [...eligibleTargets.values()].map((target): StudentSubjectAreaSkill => {
    const progress = progressBySkill.get(target.target_canonical_skill_id);
    return {
      ...target,
      progressState: progress?.state ?? null,
      masteryEstimate: clampMastery(progress?.mastery_estimate ?? target.progress),
      evidenceCount: Math.max(0, progress?.evidence_count ?? 0),
    };
  }).sort((left, right) => left.title.localeCompare(right.title, 'pt-BR'));

  const masteredCount = areaSkills.filter((skill) => skill.progressState === 'MASTERED').length;
  const inProgressCount = areaSkills.filter((skill) => skill.progressState !== 'MASTERED' && (
    ['INTRODUCED', 'LEARNING', 'PRACTICING', 'NEEDS_REVIEW'].includes(skill.progressState ?? '')
    || skill.evidenceCount > 0
    || skill.masteryEstimate > 0
  )).length;
  const evidenceCount = areaSkills.reduce((total, skill) => total + skill.evidenceCount, 0);

  const publishedActivities = input.activities.filter((activity) =>
    activity.subject_id === input.subject.id && activity.status === 'PUBLISHED',
  );
  const releasedJourneys = input.journeys.filter((journey) =>
    journey.subject_id === input.subject.id && isStudentGuidedJourneyReleased(journey),
  );

  return {
    areaScopes,
    areaSkills,
    areaStats: {
      availableCount: areaSkills.length,
      inProgressCount,
      masteredCount,
      masteryPercent: areaSkills.length
        ? Math.round(areaSkills.reduce((total, skill) => total + skill.masteryEstimate, 0) / areaSkills.length)
        : null,
      evidenceCount,
    },
    publishedActivities,
    activityProgress: getPublishedLearningProgress(publishedActivities, input.activityProgress),
    releasedJourneys,
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
