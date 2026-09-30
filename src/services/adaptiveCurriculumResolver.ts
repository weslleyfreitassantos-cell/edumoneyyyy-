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

export function resolveAdaptiveCurriculumTargets(
  candidates: readonly AdaptiveCurriculumCandidate[],
): AdaptiveCurriculumTarget[] {
  const grouped = new Map<string, AdaptiveCurriculumCandidate[]>();
  for (const candidate of candidates) {
    const context = gradeContext(candidate.gradeLevel);
    if (!context) continue;
    if (
      candidate.target.canonicalSkillId !== candidate.canonicalSkillId
      || candidate.target.stage !== context.stage
      || candidate.target.gradeLevel !== context.gradeLevel
      || candidate.target.subjectArea !== candidate.subjectArea
    ) continue;
    const key = `${candidate.classId}:${candidate.subjectArea}`;
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }

  return [...grouped.values()]
    .map((group) => [...group].sort((left, right) => (
      left.target.priority - right.target.priority
      || left.target.sortOrder - right.target.sortOrder
      || left.classId.localeCompare(right.classId)
      || left.institutionSkillId.localeCompare(right.institutionSkillId)
      || left.canonicalSkillId.localeCompare(right.canonicalSkillId)
    ))[0])
    .filter((candidate): candidate is AdaptiveCurriculumTarget => Boolean(candidate))
    .sort((left, right) => (
      left.subjectArea.localeCompare(right.subjectArea)
      || left.classId.localeCompare(right.classId)
      || left.canonicalSkillId.localeCompare(right.canonicalSkillId)
    ));
}

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
  return resolveAdaptiveCurriculumTargets(candidates)[0] ?? null;
}
