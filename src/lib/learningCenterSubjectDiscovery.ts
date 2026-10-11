import type { GuidedDisciplineJourneyV9, LearningSubject } from '../services/learningCenterService';

export function mergeStudentSubjectsWithGuidedJourneys(
  institutionalSubjects: readonly LearningSubject[],
  journeys: readonly GuidedDisciplineJourneyV9[],
): LearningSubject[] {
  const subjectsById = new Map(institutionalSubjects.map((subject) => [subject.id, subject]));
  for (const journey of journeys) {
    if (!subjectsById.has(journey.subject_id)) {
      subjectsById.set(journey.subject_id, { id: journey.subject_id, name: journey.subject_name });
    }
  }
  return [...subjectsById.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}
