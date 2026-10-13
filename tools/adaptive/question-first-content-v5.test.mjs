import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const pack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/math-successive-percent-change.json', import.meta.url), 'utf8'));
const migration = readFileSync(new URL('../../supabase/migrations/20261012000700_bncc_question_first_content_staging_v5.sql', import.meta.url), 'utf8');
const v3Sequences = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v9/knowledge-expansion-batch-v3.json', import.meta.url), 'utf8')).compiledSkillSequences;
const biologyPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/biology-ecosystem-interactions.json', import.meta.url), 'utf8'));
const biologyMigration = readFileSync(new URL('../../supabase/migrations/20261012000800_bncc_biology_ecosystem_question_first_v5.sql', import.meta.url), 'utf8');
const chemistryPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/chemistry-acid-base.json', import.meta.url), 'utf8'));
const chemistryMigration = readFileSync(new URL('../../supabase/migrations/20261012000900_bncc_chemistry_acid_base_question_first_v5.sql', import.meta.url), 'utf8');

describe('question-first V5 staging content', () => {
  it('contains an authored lesson and two distinct questions for each adaptive purpose', () => {
    const result = validateQuestionFirstPack(pack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(10);
    expect(result.contextCount).toBe(10);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 2, TRANSFER: 2, LOCK_IN: 2, REVIEW: 2 });
    expect(result.answerPositionCounts).toEqual(pack.expectedAnswerPositionCounts);
  });

  it('checks stems against the existing V9 bank and uses readable Portuguese copy', () => {
    const v9Pack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v9/journey-expansion-a-v1.json', import.meta.url), 'utf8'));
    const existingSkill = v9Pack.journeys.find((journey) => journey.skill === pack.canonicalSkillCode);
    expect(existingSkill?.questions).toHaveLength(20);
    expect(validateQuestionFirstPack(pack).errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(pack.lesson.title).toContain('variação');
    expect(pack.questions.some((question) => question.statement.includes('mês'))).toBe(true);
  });

  it('keeps the official mapping unclaimed and the content pending and inactive', () => {
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.publicationStatus).toBe('STAGING');
    expect(migration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'publication_status', 'STAGING'");
    expect(migration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(migration).toMatch(/active, metadata\)[\s\S]*?false/);
    expect(migration).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
  });

  it('is generated from the reviewed source pack and is rerunnable without publishing', () => {
    expect(migration).toBe(buildMigration(pack));
    expect(migration).toContain('on conflict (canonical_skill_id, purpose, version) where scope = \'GLOBAL\' do nothing');
    expect(migration).toContain('V5_CONTENT_QUESTION_SET_CONFLICT');
  });

  it('fills the audited Biology purpose gaps with distinct, answer-keyed authored items', () => {
    const result = validateQuestionFirstPack(biologyPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(28);
    expect(result.contextCount).toBe(28);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 8, TRANSFER: 6, LOCK_IN: 4, REVIEW: 8 });
    expect(result.answerPositionCounts).toEqual(biologyPack.expectedAnswerPositionCounts);
    const biologyV3 = v3Sequences.find((sequence) => sequence.skillCode === biologyPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((biologyV3.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(result.errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(biologyPack.questions.every((question) => question.options.includes(question.correctAnswer))).toBe(true);
    expect(biologyPack.lesson.progression.flatMap((stage) => stage.questionIds).every((id) => biologyPack.questions.some((question) => question.id === id))).toBe(true);
  });

  it('compiles Biology into an isolated inactive staging migration with provenance and review gates', () => {
    expect(biologyMigration).toBe(buildMigration(biologyPack));
    expect(biologyMigration).toContain("'BIOLOGY', 'ECOLOGIA', 'interacoes em ecossistemas'");
    expect(biologyMigration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(biologyMigration).toContain("'STAGING'");
    expect(biologyMigration).toContain("'NOT_CLAIMED'");
    expect(biologyMigration).toContain('"review_schedule_status":"SUGGESTED_NOT_AUTOMATED"');
    expect(biologyMigration).toMatch(/active, metadata\)[\s\S]*?false/);
    expect(biologyMigration).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
    expect(biologyMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('fills the Chemistry purpose gaps without repeating V3 stems or overclaiming pH evidence', () => {
    const result = validateQuestionFirstPack(chemistryPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual(chemistryPack.expectedAnswerPositionCounts);
    const chemistryV3 = v3Sequences.find((sequence) => sequence.skillCode === chemistryPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((chemistryV3.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(result.errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(chemistryPack.questions.every((question) => question.options.includes(question.correctAnswer))).toBe(true);
    expect(chemistryPack.lesson.sourceDossier.some((source) => source.publisher === 'U.S. Environmental Protection Agency')).toBe(true);
    expect(chemistryPack.lesson.remediations.length).toBeGreaterThanOrEqual(2);
  });

  it('compiles Chemistry as inactive STAGING content with the scope and provenance preserved', () => {
    expect(chemistryMigration).toBe(buildMigration(chemistryPack));
    expect(chemistryMigration).toContain("'CHEMISTRY', 'SOLUCOES', 'acidez e basicidade'");
    expect(chemistryMigration).toContain('"source_dossier"');
    expect(chemistryMigration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(chemistryMigration).toContain("'STAGING'");
    expect(chemistryMigration).toContain("'NOT_CLAIMED'");
    expect(chemistryMigration).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
    expect(chemistryMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('adds Computing question items and an authentic, privacy-safe performance rubric', () => {
    const computingPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/computing-virtual-communities.json', import.meta.url), 'utf8'));
    const computingMigration = readFileSync(new URL('../../supabase/migrations/20261012001000_bncc_computing_virtual_communities_question_first_v5.sql', import.meta.url), 'utf8');
    const result = validateQuestionFirstPack(computingPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual(computingPack.expectedAnswerPositionCounts);
    const computingV3 = v3Sequences.find((sequence) => sequence.skillCode === computingPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((computingV3.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(computingPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(computingPack.lesson.authenticActivities[0].privacyGuard).toContain('Não recolher');
    expect(computingMigration).toBe(buildMigration(computingPack));
    expect(computingMigration).toContain("'COMPUTING', 'COMUNIDADES_VIRTUAIS'");
    expect(computingMigration).toContain('"authentic_activities"');
    expect(computingMigration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(computingMigration).toContain("'STAGING'");
    expect(computingMigration).toContain("'NOT_CLAIMED'");
    expect(computingMigration).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
    expect(computingMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });
});
