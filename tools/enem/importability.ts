import type { CanonicalEnemQuestion } from './canonicalize.ts';

export function isEnemImportableQuestion(
  question: Pick<CanonicalEnemQuestion, 'qualityState' | 'officialAnswer' | 'options' | 'sourceIntegrity' | 'statementIntegrity' | 'optionsIntegrity' | 'controlCharCount'>,
) {
  return question.qualityState === 'PARSED'
    && /^[A-E]$/.test(question.officialAnswer)
    && question.options.length === 5
    && question.sourceIntegrity === 'VERIFIED'
    && question.statementIntegrity === 'VERIFIED'
    && question.optionsIntegrity === 'VERIFIED'
    && (question.controlCharCount ?? 0) === 0;
}
