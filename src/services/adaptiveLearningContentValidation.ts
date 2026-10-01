export interface AdaptiveContentQuestion {
  id?: string;
  statement: string;
  options: readonly string[];
  explanation: string | null;
  canonicalSkillId: string | null;
  provenance: string | null;
  purpose?: string | null;
  correctAnswer?: string | null;
}

export interface AdaptiveContentValidationResult {
  duplicateStems: number;
  invalidOptions: number;
  missingExplanations: number;
  invalidSkillLinks: number;
  invalidProvenance: number;
  invalidAnswers: number;
  emptyPurposeSets: number;
  purposeCoverage: Record<string, number>;
  valid: boolean;
}

/** Lightweight deterministic validator used by fixture/content tests. */
export function validateAdaptiveQuestionContent(
  questions: readonly AdaptiveContentQuestion[],
  knownSkillIds: ReadonlySet<string>,
): AdaptiveContentValidationResult {
  const stems = new Map<string, number>();
  for (const question of questions) {
    const key = question.statement.trim().toLocaleLowerCase('pt-BR');
    stems.set(key, (stems.get(key) ?? 0) + 1);
  }
  const duplicateStems = [...stems.values()].filter((count) => count > 1).length;
  const invalidOptions = questions.filter((question) => {
    const normalized = question.options.map((option) => option.trim()).filter(Boolean);
    return normalized.length < 2 || new Set(normalized).size !== normalized.length;
  }).length;
  const missingExplanations = questions.filter((question) => !question.explanation?.trim()).length;
  const invalidSkillLinks = questions.filter((question) => !question.canonicalSkillId || !knownSkillIds.has(question.canonicalSkillId)).length;
  const invalidProvenance = questions.filter((question) => !question.provenance?.trim()).length;
  const invalidAnswers = questions.filter((question) => {
    if (!question.correctAnswer) return false;
    return !question.options.some((option) => option.trim() === question.correctAnswer?.trim());
  }).length;

  return {
    duplicateStems,
    invalidOptions,
    missingExplanations,
    invalidSkillLinks,
    invalidProvenance,
    invalidAnswers,
    emptyPurposeSets: 0,
    purposeCoverage: {},
    valid: duplicateStems === 0
      && invalidOptions === 0
      && missingExplanations === 0
      && invalidSkillLinks === 0
      && invalidProvenance === 0
      && invalidAnswers === 0,
  };
}

export interface AdaptiveContentPackSkill {
  code: string;
  prerequisites?: readonly string[];
  lesson?: { contentMarkdown?: string; workedExample?: string | null; tips?: readonly string[] };
  questions: readonly (AdaptiveContentQuestion & { purpose: string })[];
}

export interface AdaptiveContentPack {
  packVersion: string;
  subjectArea: string;
  provenance: string;
  skills: readonly AdaptiveContentPackSkill[];
}

export interface AdaptiveContentPackValidationResult extends AdaptiveContentValidationResult {
  invalidSkillCodes: number;
  invalidLessons: number;
  invalidPrerequisites: number;
  emptySets: number;
  identicalPurposeSets: number;
}

const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'] as const;

/** Validates versioned authored packs before a seed/migration consumes them. */
export function validateAdaptiveContentPack(
  pack: AdaptiveContentPack,
  knownSkillCodes: ReadonlySet<string>,
): AdaptiveContentPackValidationResult {
  const questions = pack.skills.flatMap((skill) => skill.questions.map((question) => ({
    ...question,
    canonicalSkillId: knownSkillCodes.has(skill.code) ? skill.code : null,
    provenance: question.provenance ?? pack.provenance,
  })));
  const base = validateAdaptiveQuestionContent(questions, knownSkillCodes);
  const purposeCoverage: Record<string, number> = {};
  let emptyPurposeSets = 0;
  let invalidLessons = 0;
  let invalidPrerequisites = 0;
  for (const skill of pack.skills) {
    invalidPrerequisites += (skill.prerequisites ?? []).filter((code) => !knownSkillCodes.has(code)).length;
    if (!skill.lesson?.contentMarkdown?.trim() || !skill.lesson.workedExample?.trim() || !skill.lesson.tips?.length) invalidLessons += 1;
    const purposes = new Map<string, string[]>();
    for (const question of skill.questions) {
      const list = purposes.get(question.purpose) ?? [];
      list.push(question.id ?? question.statement);
      purposes.set(question.purpose, list);
    }
    for (const purpose of PURPOSES) {
      const count = purposes.get(purpose)?.length ?? 0;
      purposeCoverage[`${skill.code}:${purpose}`] = count;
      if (count === 0) emptyPurposeSets += 1;
    }
  }
  const sets = pack.skills.flatMap((skill) => PURPOSES.map((purpose) => (
    skill.questions.filter((question) => question.purpose === purpose).map((question) => question.statement.trim().toLocaleLowerCase('pt-BR'))
  )));
  const setKeys = new Map(sets.map((set, index) => [set.join('|'), index]));
  const identicalPurposeSets = sets.length - setKeys.size;
  const invalidSkillCodes = pack.skills.filter((skill) => !knownSkillCodes.has(skill.code)).length;
  return {
    ...base,
    emptyPurposeSets,
    purposeCoverage,
    invalidSkillCodes,
    invalidLessons,
    invalidPrerequisites,
    identicalPurposeSets,
    emptySets: emptyPurposeSets,
    valid: base.valid && invalidSkillCodes === 0 && invalidLessons === 0 && invalidPrerequisites === 0 && emptyPurposeSets === 0 && identicalPurposeSets === 0,
  };
}
