export interface AdaptiveContentQuestion {
  statement: string;
  options: readonly string[];
  explanation: string | null;
  canonicalSkillId: string | null;
  provenance: string | null;
}

export interface AdaptiveContentValidationResult {
  duplicateStems: number;
  invalidOptions: number;
  missingExplanations: number;
  invalidSkillLinks: number;
  invalidProvenance: number;
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

  return {
    duplicateStems,
    invalidOptions,
    missingExplanations,
    invalidSkillLinks,
    invalidProvenance,
    valid: duplicateStems === 0
      && invalidOptions === 0
      && missingExplanations === 0
      && invalidSkillLinks === 0
      && invalidProvenance === 0,
  };
}
