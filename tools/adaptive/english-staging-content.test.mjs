import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const packs = [
  ['english-context-vocabulary.json', '20261015000800_bncc_english_context_vocabulary_question_first_v5.sql'],
  ['english-infer-from-text.json', '20261013003200_bncc_english_infer_text_question_first_v5.sql'],
  ['english-infer-from-text-v6.json', '20261015004100_bncc_english_infer_from_text_library_expansion_v6.sql'],
  ['english-relate-language-culture.json', '20261015000700_bncc_english_relate_language_culture_question_first_v5.sql'],
  ['v8-english-infer-from-text-expansion-v8.json', '20261016000400_bncc_english_inference_library_expansion_v8.sql'],
].map(([packFile, migrationFile]) => ({
  pack: JSON.parse(readFileSync(new URL(`../../content/adaptive/tec-escola-core-v5/${packFile}`, import.meta.url), 'utf8')),
  migration: readFileSync(new URL(`../../supabase/migrations/${migrationFile}`, import.meta.url), 'utf8'),
}));

describe('English adaptive content staging', () => {
  it.each(packs)('keeps $pack.contentId staged and pedagogically reviewable', ({ pack, migration }) => {
    const validation = validateQuestionFirstPack(pack);
    expect(validation.valid, validation.errors.join(', ')).toBe(true);
    expect(validation.questionCount).toBe(pack.expectedQuestionCount);
    expect(pack.subject).toBe('ENGLISH');
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(migration).toMatch(/'publication_status',\s*'STAGING'/);
    expect(migration).toMatch(/'pedagogical_review_status',\s*'PEDAGOGICAL_REVIEW_PENDING'/);
    expect(migration).toMatch(/'bncc_alignment_status',\s*'NOT_CLAIMED'/);
    expect(migration).not.toMatch(/insert\s+into\s+public\.learning_(skill_evidence|guided_step_attempts|guided_session_events)/i);
    expect(buildMigration(pack).replace(/\r\n/g, '\n')).toBe(migration.replace(/\r\n/g, '\n'));
  });

  it('contains 314 authored questions without promoting any to students', () => {
    expect(packs.reduce((total, { pack }) => total + pack.questions.length, 0)).toBe(314);
    expect(packs.every(({ pack }) => pack.questions.every((question) => question.options.includes(question.correctAnswer)))).toBe(true);
  });
});
