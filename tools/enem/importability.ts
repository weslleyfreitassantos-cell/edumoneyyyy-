import type { CanonicalEnemQuestion } from './canonicalize.ts';

export function isEnemImportableQuestion(
  question: Pick<CanonicalEnemQuestion, 'qualityState' | 'officialAnswer' | 'options'>,
) {
  return question.qualityState === 'PARSED'
    && /^[A-E]$/.test(question.officialAnswer)
    && question.options.length === 5;
}
