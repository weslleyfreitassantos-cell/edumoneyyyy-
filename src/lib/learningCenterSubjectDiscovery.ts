import type { GuidedDisciplineJourneyV9, LearningSubject } from '../services/learningCenterService';

const standardBnccSubjectsByCode = new Map<string, string>([
  ['ART', 'Arte'],
  ['BIO', 'Biologia'],
  ['BIOLOGY', 'Biologia'],
  ['CIENCIAS', 'Ciências'],
  ['SCIENCE', 'Ciências'],
  ['SCI', 'Ciências'],
  ['EDF', 'Educação Física'],
  ['PHYSICAL_EDUCATION', 'Educação Física'],
  ['FIL', 'Filosofia'],
  ['PHILOSOPHY', 'Filosofia'],
  ['ENSINO_RELIGIOSO', 'Ensino Religioso'],
  ['RELIGIOUS_EDUCATION', 'Ensino Religioso'],
  ['ER', 'Ensino Religioso'],
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

export function mergeStudentSubjectsWithGuidedJourneys(
  institutionalSubjects: readonly LearningSubject[],
  journeys: readonly GuidedDisciplineJourneyV9[],
): LearningSubject[] {
  const subjectsById = new Map<string, LearningSubject>();
  for (const subject of institutionalSubjects) {
    const canonicalName = standardSubjectName(subject.name, subject.code);
    if (canonicalName) subjectsById.set(subject.id, { ...subject, name: canonicalName });
  }

  for (const journey of journeys) {
    const canonicalName = standardSubjectName(journey.subject_name, journey.canonical_subject_code);
    if (!canonicalName || subjectsById.has(journey.subject_id)) continue;
    subjectsById.set(journey.subject_id, { id: journey.subject_id, name: canonicalName });
  }
  return [...subjectsById.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

export function getSubjectJourneyAvailabilityLabel(journeys: readonly GuidedDisciplineJourneyV9[]): string {
  const reviewedAndAvailable = journeys.filter((journey) =>
    journey.availability_status === 'AVAILABLE'
      && journey.mapping_status === 'MAPPED'
      && journey.pedagogical_review_status === 'PEDAGOGICAL_REVIEWED',
  ).length;

  if (reviewedAndAvailable > 0) {
    return `${reviewedAndAvailable} ${reviewedAndAvailable === 1 ? 'jornada disponível' : 'jornadas disponíveis'}`;
  }

  if (journeys.length > 0) {
    return `${journeys.length} ${journeys.length === 1 ? 'jornada em revisão pedagógica' : 'jornadas em revisão pedagógica'}`;
  }

  return 'Abrir matéria';
}
