import { normalizeAcademicLevel } from '../lib/academic/academicLevels';

export interface CurriculumGradeTarget {
  canonicalSkillId: string;
  stage: string;
  gradeLevel: number;
  subjectArea: string;
  priority: number;
  sortOrder: number;
}

export interface AdaptiveCurriculumCandidate {
  classId: string;
  gradeLevel: string | null;
  institutionSkillId: string;
  canonicalSkillId: string;
  subjectArea: string;
  target: CurriculumGradeTarget;
}

export interface AdaptiveCurriculumTarget extends AdaptiveCurriculumCandidate {}

function gradeContext(gradeLevel: string | null): { stage: string; gradeLevel: number } | null {
  const normalized = normalizeAcademicLevel(gradeLevel);
  if (!normalized) return null;

  return normalized.endsWith(' EM')
    ? { stage: 'ENSINO_MEDIO', gradeLevel: Number(normalized.split(' ')[0]) }
    : { stage: 'ENSINO_FUNDAMENTAL', gradeLevel: Number(normalized) };
}

export function resolveAdaptiveCurriculumTarget(
  candidates: readonly AdaptiveCurriculumCandidate[],
): AdaptiveCurriculumTarget | null {
  const eligible = candidates.filter((candidate) => {
    const context = gradeContext(candidate.gradeLevel);
    if (!context) return false;

    return candidate.target.canonicalSkillId === candidate.canonicalSkillId
      && candidate.target.stage === context.stage
      && candidate.target.gradeLevel === context.gradeLevel
      && candidate.target.subjectArea === candidate.subjectArea;
  });

  return [...eligible].sort((left, right) => (
    left.target.priority - right.target.priority
    || left.target.sortOrder - right.target.sortOrder
    || left.classId.localeCompare(right.classId)
    || left.institutionSkillId.localeCompare(right.institutionSkillId)
    || left.canonicalSkillId.localeCompare(right.canonicalSkillId)
  ))[0] ?? null;
}
