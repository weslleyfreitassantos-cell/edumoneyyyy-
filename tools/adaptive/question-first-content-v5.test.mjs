import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';
import { buildLanguagesCollaborationPack } from './build-languages-collaboration-v5.mjs';
import { buildMathRiskPack } from './build-math-risk-v5.mjs';
import { buildMathPositionPack } from './build-math-position-v5.mjs';
import { buildPortugueseSignsPack } from './build-portuguese-signs-v5.mjs';
import { buildReligiousInclusionPack } from './build-religious-inclusion-v5.mjs';

const pack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/math-successive-percent-change.json', import.meta.url), 'utf8'));
const migration = readFileSync(new URL('../../supabase/migrations/20261012000700_bncc_question_first_content_staging_v5.sql', import.meta.url), 'utf8');
const v3Sequences = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v9/knowledge-expansion-batch-v3.json', import.meta.url), 'utf8')).compiledSkillSequences;
const biologyPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/biology-ecosystem-interactions.json', import.meta.url), 'utf8'));
const biologyMigration = readFileSync(new URL('../../supabase/migrations/20261012000800_bncc_biology_ecosystem_question_first_v5.sql', import.meta.url), 'utf8');
const chemistryPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/chemistry-acid-base.json', import.meta.url), 'utf8'));
const chemistryMigration = readFileSync(new URL('../../supabase/migrations/20261012000900_bncc_chemistry_acid_base_question_first_v5.sql', import.meta.url), 'utf8');
const sciencePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/science-plan-investigation.json', import.meta.url), 'utf8'));
const scienceMigration = readFileSync(new URL('../../supabase/migrations/20261012001100_bncc_science_investigation_question_first_v5.sql', import.meta.url), 'utf8');
const historyPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/history-chronology.json', import.meta.url), 'utf8'));
const historyMigration = readFileSync(new URL('../../supabase/migrations/20261012001200_bncc_history_chronology_question_first_v5.sql', import.meta.url), 'utf8');
const physicsPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/physics-force-motion.json', import.meta.url), 'utf8'));
const physicsMigration = readFileSync(new URL('../../supabase/migrations/20261012001300_bncc_physics_force_motion_question_first_v5.sql', import.meta.url), 'utf8');
const portugueseVariationPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/portuguese-language-variation.json', import.meta.url), 'utf8'));
const artCharacterPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/art-character-experiment.json', import.meta.url), 'utf8'));
const artCharacterMigration = readFileSync(new URL('../../supabase/migrations/20261013000800_bncc_art_character_experiment_question_first_v5.sql', import.meta.url), 'utf8');
const computingSearchPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/computing-search-safe-browse.json', import.meta.url), 'utf8'));
const humanitiesProductionPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/humanities-production-impacts.json', import.meta.url), 'utf8'));
const languagesSemioticPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/languages-semiotic-function.json', import.meta.url), 'utf8'));
const portugueseVariationMigration = readFileSync(new URL('../../supabase/migrations/20261013000100_bncc_portuguese_variation_question_first_v5.sql', import.meta.url), 'utf8');
const computingSearchMigration = readFileSync(new URL('../../supabase/migrations/20261013000200_bncc_computing_search_browse_question_first_v5.sql', import.meta.url), 'utf8');
const computingCommunitiesMigration = readFileSync(new URL('../../supabase/migrations/20261013000300_bncc_computing_virtual_communities_question_first_v5.sql', import.meta.url), 'utf8');
const humanitiesProductionMigration = readFileSync(new URL('../../supabase/migrations/20261013000400_bncc_humanities_production_impacts_question_first_v5.sql', import.meta.url), 'utf8');
const languagesSemioticMigration = readFileSync(new URL('../../supabase/migrations/20261013000500_bncc_languages_semiotic_function_question_first_v5.sql', import.meta.url), 'utf8');
const languagesCollaborationPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/languages-collaboration.json', import.meta.url), 'utf8'));
const languagesCollaborationMigration = readFileSync(new URL('../../supabase/migrations/20261013000600_bncc_languages_collaboration_question_first_v5.sql', import.meta.url), 'utf8');
const mathRiskPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/math-probabilistic-risk.json', import.meta.url), 'utf8'));
const mathRiskMigration = readFileSync(new URL('../../supabase/migrations/20261013000700_bncc_math_probabilistic_risk_question_first_v5.sql', import.meta.url), 'utf8');
const mathPositionPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/math-spatial-position.json', import.meta.url), 'utf8'));
const mathPositionMigration = readFileSync(new URL('../../supabase/migrations/20261013000900_bncc_math_spatial_position_question_first_v5.sql', import.meta.url), 'utf8');
const portugueseSignsPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/portuguese-letters-signs.json', import.meta.url), 'utf8'));
const portugueseSignsMigration = readFileSync(new URL('../../supabase/migrations/20261013001000_bncc_portuguese_letters_signs_question_first_v5.sql', import.meta.url), 'utf8');
const religiousInclusionPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/religious-self-other-inclusion.json', import.meta.url), 'utf8'));
const religiousInclusionMigration = readFileSync(new URL('../../supabase/migrations/20261013001100_bncc_religious_self_other_inclusion_question_first_v5.sql', import.meta.url), 'utf8');

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

  it('expands Science investigation with unique items that meet the audited purpose deficits', () => {
    const result = validateQuestionFirstPack(sciencePack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(28);
    expect(result.contextCount).toBe(28);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 8, TRANSFER: 6, LOCK_IN: 4, REVIEW: 8 });
    expect(result.answerPositionCounts).toEqual(sciencePack.expectedAnswerPositionCounts);
    const priorSequence = v3Sequences.find((sequence) => sequence.skillCode === sciencePack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((priorSequence.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(result.errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(sciencePack.lesson.sourceDossier[0].publisher).toBe('National Academies of Sciences, Engineering, and Medicine');
    expect(sciencePack.lesson.remediations.length).toBeGreaterThanOrEqual(4);
  });

  it('compiles Science as inactive STAGING content without creating student progress', () => {
    expect(scienceMigration).toBe(buildMigration(sciencePack));
    expect(scienceMigration).toContain("'SCIENCE', 'INVESTIGACAO_CIENTIFICA'");
    expect(scienceMigration).toContain('"source_dossier"');
    expect(scienceMigration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(scienceMigration).toContain("'STAGING'");
    expect(scienceMigration).toContain("'NOT_CLAIMED'");
    expect(scienceMigration).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
    expect(scienceMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('expands History chronology with distinct items that meet the audited purpose deficits', () => {
    const result = validateQuestionFirstPack(historyPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(27);
    expect(result.contextCount).toBe(27);
    expect(result.counts).toEqual({ PROBE: 1, PRACTICE: 8, TRANSFER: 6, LOCK_IN: 4, REVIEW: 8 });
    expect(result.answerPositionCounts).toEqual(historyPack.expectedAnswerPositionCounts);
    const priorSequence = v3Sequences.find((sequence) => sequence.skillCode === historyPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((priorSequence.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(result.errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(historyPack.lesson.sourceDossier).toHaveLength(2);
  });

  it('compiles History as inactive STAGING content without creating student progress', () => {
    expect(historyMigration).toBe(buildMigration(historyPack));
    expect(historyMigration).toContain("'HISTORY', 'CRONOLOGIA'");
    expect(historyMigration).toContain('"source_dossier"');
    expect(historyMigration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(historyMigration).toContain("'STAGING'");
    expect(historyMigration).toContain("'NOT_CLAIMED'");
    expect(historyMigration).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
    expect(historyMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('expands Physics force and motion to the audited purpose minimums', () => {
    const result = validateQuestionFirstPack(physicsPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const priorSequence = v3Sequences.find((sequence) => sequence.skillCode === physicsPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((priorSequence.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(result.errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(physicsPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(physicsPack.lesson.sourceDossier.map((source) => source.publisher)).toContain('OpenStax');
    expect(physicsPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(physicsPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(physicsPack.publicationStatus).toBe('STAGING');
  });

  it('compiles Physics as inactive STAGING content without creating student progress', () => {
    expect(physicsMigration).toBe(buildMigration(physicsPack));
    expect(physicsMigration).toContain("'PHYSICS', 'INTERACOES', 'forca resultante e mudanca de movimento'");
    expect(physicsMigration).toContain('"authentic_activities"');
    expect(physicsMigration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(physicsMigration).toContain("'STAGING'");
    expect(physicsMigration).toContain("'NOT_CLAIMED'");
    expect(physicsMigration).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
    expect(physicsMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('authors Portuguese variation content without inventing its missing canonical mapping', () => {
    const result = validateQuestionFirstPack(portugueseVariationPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const priorSequence = v3Sequences.find((sequence) => sequence.skillCode === portugueseVariationPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((priorSequence.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(result.errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(portugueseVariationPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(portugueseVariationPack.lesson.sourceDossier.some((source) => source.publisher === 'Ministério da Educação')).toBe(true);
    expect(portugueseVariationPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(portugueseVariationPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(portugueseVariationPack.publicationStatus).toBe('STAGING');
  });

  it('compiles a V3-declared Portuguese candidate only as inactive, unaligned staging', () => {
    const sql = buildMigration(portugueseVariationPack);
    expect(sql).toBe(portugueseVariationMigration);
    expect(sql).toContain('V5_INTERNAL_SKILL_STAGING_SCOPE_CONFLICT');
    expect(sql).toContain("'CANDIDATE'");
    expect(sql).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(sql).toContain("'NOT_CLAIMED'");
    expect(sql).toContain('active = false and mastery_targetable = false');
    expect(sql).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
  });

  it('compiles the Art theater performance candidate only as inactive, with authentic evidence and no MCQ pool', () => {
    const result = validateQuestionFirstPack(artCharacterPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(0);
    expect(artCharacterPack.domain).toBe('CRIACAO_TEATRAL');
    expect(artCharacterPack.lesson.authenticActivities[0].rubric).toHaveLength(4);
    expect(artCharacterPack.lesson.authenticActivities[0]).toMatchObject({ objective: expect.any(String), context: expect.any(String), materials: expect.any(Array), evidence: expect.any(String), safety: expect.any(String), mediation: expect.any(String), privacyGuard: expect.any(String) });
    expect(artCharacterPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(artCharacterPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(artCharacterPack.publicationStatus).toBe('STAGING');
    expect(buildMigration(artCharacterPack)).toBe(artCharacterMigration);
    expect(artCharacterMigration).toContain("'ART_CREATE_CHARACTER_EXPERIMENT_FI'");
    expect(artCharacterMigration).toContain('active = false and mastery_targetable = false');
    expect(artCharacterMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('compiles Computing search after its internal domain is reconciled to the V3 declaration', () => {
    const result = validateQuestionFirstPack(computingSearchPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const priorSequence = v3Sequences.find((sequence) => sequence.skillCode === computingSearchPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((priorSequence.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(result.errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(computingSearchPack.lesson.authenticActivities[0].privacyGuard).toContain('Não abrir links');
    expect(computingSearchPack.lesson.sourceDossier.some((source) => source.publisher === 'SaferNet Brasil / rede Insafe')).toBe(true);
    expect(computingSearchPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(computingSearchPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(computingSearchPack.publicationStatus).toBe('STAGING');
    const sql = buildMigration(computingSearchPack);
    expect(sql).toBe(computingSearchMigration);
    expect(sql).toContain('V5_INTERNAL_SKILL_STAGING_SCOPE_CONFLICT');
    expect(sql).toContain("'PESQUISA_DIGITAL'");
    expect(sql).toContain("'NOT_CLAIMED'");
  });

  it('expands Humanities production-chain analysis without claiming an official mapping', () => {
    const result = validateQuestionFirstPack(humanitiesProductionPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const priorSequence = v3Sequences.find((sequence) => sequence.skillCode === humanitiesProductionPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((priorSequence.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(result.errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(humanitiesProductionPack.lesson.authenticActivities[0].rubric).toHaveLength(4);
    expect(humanitiesProductionPack.lesson.sourceDossier.some((source) => source.publisher === 'Instituto Brasileiro de Geografia e Estatística (IBGE)')).toBe(true);
    expect(humanitiesProductionPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(humanitiesProductionPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(humanitiesProductionPack.publicationStatus).toBe('STAGING');
  });

  it('expands Languages semiotic analysis with diverse contexts and V3 purpose gaps reconciled', () => {
    const result = validateQuestionFirstPack(languagesSemioticPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(38);
    expect(result.contextCount).toBe(38);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 14, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 10, B: 10, C: 9, D: 9 });
    const priorSequence = v3Sequences.find((sequence) => sequence.skillCode === languagesSemioticPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((priorSequence.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBeGreaterThanOrEqual(minimum);
    }
    expect(result.errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(languagesSemioticPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(languagesSemioticPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(languagesSemioticPack.lesson.sourceDossier.some((source) => source.publisher === 'Ministério da Educação')).toBe(true);
  });

  it('compiles Languages as an inactive V3 internal candidate without claiming BNCC alignment', () => {
    const sql = buildMigration(languagesSemioticPack);
    expect(sql).toBe(languagesSemioticMigration);
    expect(sql).toContain("'LANGUAGES_AREA', 'ENSINO_MEDIO', 1, 'LANGUAGES', 'V3_INTERNAL_ANCHOR'");
    expect(sql).toContain('V5_INTERNAL_PARENT_ANCHOR_SCOPE_CONFLICT:LANGUAGES_AREA');
    expect(sql).toContain('V5_INTERNAL_SKILL_STAGING_SCOPE_CONFLICT');
    expect(sql).toContain("'LANGUAGES_ANALYZE_SEMIOTIC_FUNCTION_HS'");
    expect(sql).toContain("'CANDIDATE'");
    expect(sql).toContain("'NOT_CLAIMED'");
    expect(sql).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(sql).toContain('active = false and mastery_targetable = false');
    expect(sql).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
    expect(sql).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('authors collaborative production decisions and checks the staging artifact deterministically', () => {
    expect(languagesCollaborationPack).toEqual(buildLanguagesCollaborationPack());
    const result = validateQuestionFirstPack(languagesCollaborationPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.contextCount).toBe(35);
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    expect(languagesCollaborationPack.lesson.authenticActivities[0].rubric).toHaveLength(4);
    expect(languagesCollaborationPack.lesson.authenticActivities[0]).toMatchObject({ objective: expect.any(String), context: expect.any(String), materials: expect.any(Array), evidence: expect.any(String), safety: expect.any(String), mediation: expect.any(String), privacyGuard: expect.any(String) });
    expect(languagesCollaborationPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(languagesCollaborationPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(buildMigration(languagesCollaborationPack)).toBe(languagesCollaborationMigration);
    expect(languagesCollaborationMigration).toContain("'LANGUAGES_CREATE_COLLABORATIVELY_HS'");
    expect(languagesCollaborationMigration).toContain('active = false and mastery_targetable = false');
    expect(languagesCollaborationMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('authors probabilistic-risk practice with correct rates and preserves the health-advice boundary', () => {
    expect(mathRiskPack).toEqual(buildMathRiskPack());
    const result = validateQuestionFirstPack(mathRiskPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.contextCount).toBe(35);
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    expect(mathRiskPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(mathRiskPack.lesson.authenticActivities[0]).toMatchObject({ objective: expect.any(String), context: expect.any(String), materials: expect.any(Array), evidence: expect.any(String), safety: expect.any(String), mediation: expect.any(String), privacyGuard: expect.any(String) });
    expect(mathRiskPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(mathRiskPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(buildMigration(mathRiskPack)).toBe(mathRiskMigration);
    expect(mathRiskMigration).toContain("'MATH_IDENTIFY_PROBABILISTIC_RISK_CHOICES_HS'");
    expect(mathRiskMigration).toContain('active = false and mastery_targetable = false');
    expect(mathRiskMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('expands first-grade spatial language with explicit observers, varied evidence, and an accessible authentic activity', () => {
    expect(mathPositionPack).toEqual(buildMathPositionPack());
    const result = validateQuestionFirstPack(mathPositionPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.contextCount).toBe(35);
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === mathPositionPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((v3.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(mathPositionPack.questions.every((question) => question.options.length === 4 && question.options.includes(question.correctAnswer))).toBe(true);
    expect(mathPositionPack.questions.some((question) => question.errorFocus.includes('referencial'))).toBe(true);
    expect(mathPositionPack.lesson.explanation).toContain('não adivinhe');
    expect(mathPositionPack.lesson.authenticActivities[0].instructions).toContain('sentada');
    expect(mathPositionPack.lesson.authenticActivities[0].safety).toContain('vendas');
    expect(mathPositionPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(mathPositionPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(mathPositionPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(mathPositionPack.publicationStatus).toBe('STAGING');
    expect(mathPositionPack.lesson.progression.flatMap((stage) => stage.questionIds).every((id) => mathPositionPack.questions.some((question) => question.id === id))).toBe(true);
  });

  it('compiles spatial-position content as an inactive candidate and leaves student progress untouched', () => {
    expect(mathPositionMigration).toBe(buildMigration(mathPositionPack));
    expect(mathPositionMigration).toContain('V5_INTERNAL_PARENT_ANCHOR_SCOPE_CONFLICT:MATHEMATICS_SPATIAL');
    expect(mathPositionMigration).toContain("'MATHEMATICS_SPATIAL', 'FUNDAMENTAL_I', 1, 'MATHEMATICS', 'V3_INTERNAL_ANCHOR'");
    expect(mathPositionMigration).toContain("'MATH_DESCRIBE_SPATIAL_POSITION_FI'");
    expect(mathPositionMigration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(mathPositionMigration).toContain("'NOT_CLAIMED'");
    expect(mathPositionMigration).toContain('active = false and mastery_targetable = false');
    expect(mathPositionMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('distinguishes letters, numerals, punctuation, and icons without requiring independent long-form reading', () => {
    expect(portugueseSignsPack).toEqual(buildPortugueseSignsPack());
    const result = validateQuestionFirstPack(portugueseSignsPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.contextCount).toBe(35);
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === portugueseSignsPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((v3.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(portugueseSignsPack.questions.every((question) => question.options.length === 4 && question.options.includes(question.correctAnswer))).toBe(true);
    expect(portugueseSignsPack.lesson.explanation).toContain('não exige que a criança decodifique');
    expect(portugueseSignsPack.lesson.authenticActivities[0].instructions).toContain('Não cronometre');
    expect(portugueseSignsPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(portugueseSignsPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(portugueseSignsPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(portugueseSignsPack.publicationStatus).toBe('STAGING');
    expect(portugueseSignsPack.lesson.progression.flatMap((stage) => stage.questionIds).every((id) => portugueseSignsPack.questions.some((question) => question.id === id))).toBe(true);
  });

  it('compiles the Portuguese internal candidate inactive without claiming an official mapping or writing student data', () => {
    expect(portugueseSignsMigration).toBe(buildMigration(portugueseSignsPack));
    expect(portugueseSignsMigration).toContain("'PORTUGUESE_DISTINGUISH_LETTERS_SIGNS_FI'");
    expect(portugueseSignsMigration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(portugueseSignsMigration).toContain("'NOT_CLAIMED'");
    expect(portugueseSignsMigration).toContain('active = false and mastery_targetable = false');
    expect(portugueseSignsMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('teaches respectful comparison through fictional scenarios without requesting personal religious or family disclosure', () => {
    expect(religiousInclusionPack).toEqual(buildReligiousInclusionPack());
    const result = validateQuestionFirstPack(religiousInclusionPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.contextCount).toBe(35);
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === religiousInclusionPack.canonicalSkillCode);
    for (const [purpose, minimum] of Object.entries({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 })) {
      expect((v3.purposeCounts[purpose] ?? 0) + result.counts[purpose]).toBe(minimum);
    }
    expect(religiousInclusionPack.lesson.authenticActivities[0].instructions).toContain('Não solicitar relatos pessoais');
    expect(religiousInclusionPack.lesson.authenticActivities[0].privacyGuard).toContain('Não registrar ou coletar religião');
    expect(religiousInclusionPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(religiousInclusionPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(religiousInclusionPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(religiousInclusionPack.publicationStatus).toBe('STAGING');
    expect(religiousInclusionPack.lesson.progression.flatMap((stage) => stage.questionIds).every((id) => religiousInclusionPack.questions.some((question) => question.id === id))).toBe(true);
  });

  it('compiles respectful-inclusion content inactive and makes no student-session writes', () => {
    expect(religiousInclusionMigration).toBe(buildMigration(religiousInclusionPack));
    expect(religiousInclusionMigration).toContain("'RELIGIOUS_COMPARE_SELF_OTHER_FI'");
    expect(religiousInclusionMigration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(religiousInclusionMigration).toContain("'NOT_CLAIMED'");
    expect(religiousInclusionMigration).toContain('active = false and mastery_targetable = false');
    expect(religiousInclusionMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers/i);
  });

  it('compiles the Humanities internal candidate without promoting its official mapping', () => {
    const sql = buildMigration(humanitiesProductionPack);
    expect(sql).toBe(humanitiesProductionMigration);
    expect(sql).toContain("'HUMANITIES_AREA', 'ENSINO_MEDIO', 1, 'HUMANITIES', 'V3_INTERNAL_ANCHOR'");
    expect(sql).toContain('V5_INTERNAL_PARENT_ANCHOR_CODE_COLLISION:HUMANITIES_AREA');
    expect(sql).toContain('V5_INTERNAL_PARENT_ANCHOR_SCOPE_CONFLICT:HUMANITIES_AREA');
    expect(sql).toContain("metadata->>'internal_grouping_only' = 'true'");
    expect(sql).toContain("metadata->>'mapping_status' = 'MAPPING_PENDING'");
    expect(sql).toContain("metadata->>'bncc_alignment' = 'NOT_CLAIMED'");
    expect(sql).toContain('V5_INTERNAL_SKILL_STAGING_SCOPE_CONFLICT');
    expect(sql).toContain("'CANDIDATE'");
    expect(sql).toContain("'NOT_CLAIMED'");
    expect(sql).toContain('active = false and mastery_targetable = false');
  });

  it('adds Computing question items and an authentic, privacy-safe performance rubric', () => {
    const computingPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/computing-virtual-communities.json', import.meta.url), 'utf8'));
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
    expect(computingPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(computingPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(computingPack.publicationStatus).toBe('STAGING');
    const sql = buildMigration(computingPack);
    expect(sql).toBe(computingCommunitiesMigration);
    expect(sql).toContain('V5_INTERNAL_SKILL_STAGING_SCOPE_CONFLICT');
    expect(sql).toContain("'CANDIDATE'");
    expect(sql).toContain("'NOT_CLAIMED'");
  });
});
