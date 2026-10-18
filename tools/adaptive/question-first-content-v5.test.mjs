import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';
import { buildComputingPhishingPack } from './build-computing-phishing-v5.mjs';
import { buildScienceHumanDiversityPack } from './build-science-human-diversity-v5.mjs';
import { buildHistoryCompareCausesPack } from './build-history-causes-v5.mjs';
import { buildHistoryChangeContinuityPack } from './build-history-change-continuity-v5.mjs';
import { buildHistoryComparePerspectivesPack } from './build-history-compare-perspectives-v5.mjs';
import { buildHistoryMemoryEvidencePack } from './build-history-memory-evidence-v5.mjs';
import { buildMathPercentBasePack } from './build-math-percent-base-v5.mjs';
import { buildMathPercentIncreasePack } from './build-math-percent-increase-v5.mjs';
import { buildMathRatioUnitRatePack } from './build-math-ratio-rate-v5.mjs';
import { buildPhysicalEducationAuthenticPacks } from './build-physical-education-authentic-v5.mjs';
import { buildPortugueseConnectIdeasPack } from './build-portuguese-connect-ideas-v5.mjs';
import { buildPortugueseInferFromCluesPack } from './build-portuguese-infer-clues-v5.mjs';
import { buildReligiousMediateDialoguePack } from './build-religious-mediate-dialogue-v5.mjs';
import { buildScienceEvidenceConclusionPack } from './build-science-evidence-conclusion-v5.mjs';
import { buildBiologyCellFunctionPack } from './build-biology-cell-function-v5.mjs';
import { buildBiologyInheritancePack } from './build-biology-inheritance-v5.mjs';
import { buildBiologyPopulationDataPack } from './build-biology-population-data-v5.mjs';
import { buildChemistryAtomicStructurePack } from './build-chemistry-atomic-structure-v5.mjs';
import { buildChemistryReactionEvidencePack } from './build-chemistry-reaction-evidence-v5.mjs';
import { buildChemistryStoichiometryPack } from './build-chemistry-stoichiometry-v5.mjs';
import { buildPhilosophyEthicalPrinciplePack } from './build-philosophy-ethical-principle-v5.mjs';
import { buildPhilosophyEvaluateArgumentPack } from './build-philosophy-evaluate-argument-v5.mjs';
import { buildPhilosophyDistinguishConceptPack } from './build-philosophy-distinguish-concept-v5.mjs';
import { buildMathSuccessivePercentChangePack } from './build-math-successive-percent-change-v6.mjs';
import { buildPhysicsAverageSpeedPack } from './build-physics-average-speed-v5.mjs';
import { buildPhysicsMotionGraphPack } from './build-physics-motion-graph-v5.mjs';
import { buildEnglishInferencePack } from './build-english-inference-v5.mjs';
import { buildPhysicsUnitConversionPack } from './build-physics-unit-conversion-v5.mjs';
import { buildPhysicsMotionPacks } from './build-physics-motion-v5.mjs';
import { buildSociologyInequalityDataPack } from './build-sociology-inequality-data-v5.mjs';
import { buildSociologyNormValuePack } from './build-sociology-norm-value-v5.mjs';
import { buildSociologyInstitutionsPack } from './build-sociology-institutions-v5.mjs';
import { buildArtCompareCompositionsPack } from './build-art-compare-compositions-v5.mjs';
import { buildArtInterpretWorkPack } from './build-art-interpret-work-v5.mjs';
import { buildArtRelateWorkContextPack } from './build-art-relate-work-context-v5.mjs';
import { buildComputingReadTableDataPack } from './build-computing-read-table-data-v5.mjs';
import { buildComputingTraceAlgorithmPack } from './build-computing-trace-algorithm-v5.mjs';
import { buildEnglishRelateLanguageCulturePack } from './build-english-relate-language-culture-v5.mjs';
import { buildEnglishContextVocabularyPack } from './build-english-context-vocabulary-v5.mjs';
import { buildGeographyClimateDataPack } from './build-geography-climate-data-v5.mjs';
import { buildGeographyInterpretTerritoryPack } from './build-geography-interpret-territory-v5.mjs';
import { buildGeographyMapScalePack } from './build-geography-map-scale-v5.mjs';
import { buildLanguagesCollaborationPack } from './build-languages-collaboration-v5.mjs';
import { buildMathRiskPack } from './build-math-risk-v5.mjs';
import { buildMathPositionPack } from './build-math-position-v5.mjs';
import { buildPortugueseSignsPack } from './build-portuguese-signs-v5.mjs';
import { buildPortugueseCompareSourcesPack } from './build-portuguese-compare-sources-v5.mjs';
import { buildPortugueseReasonEvidencePack } from './build-portuguese-reason-evidence-v5.mjs';
import { buildPortugueseCounterargumentPack } from './build-portuguese-counterargument-v5.mjs';
import { buildPortugueseSummarizeArgumentPack } from './build-portuguese-summarize-argument-v5.mjs';
import { buildReligiousInclusionPack } from './build-religious-inclusion-v5.mjs';
import { buildWave2ContentGapPacks } from './build-wave2-content-gaps-v5.mjs';
import { buildRemainingWave2ContentGapPacks, remainingWave2TargetDefinitions } from './build-wave2-remaining-content-gaps-v5.mjs';

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
const computingPhishingPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/computing-recognize-phishing.json', import.meta.url), 'utf8'));
const computingPhishingMigration = readFileSync(new URL('../../supabase/migrations/20261013001200_bncc_computing_phishing_question_first_v5.sql', import.meta.url), 'utf8');
const scienceHumanDiversityPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/science-human-diversity.json', import.meta.url), 'utf8'));
const scienceHumanDiversityMigration = readFileSync(new URL('../../supabase/migrations/20261013001300_bncc_science_human_diversity_question_first_v5.sql', import.meta.url), 'utf8');
const historyCausesPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/history-compare-causes.json', import.meta.url), 'utf8'));
const historyCausesMigration = readFileSync(new URL('../../supabase/migrations/20261013001400_bncc_history_compare_causes_question_first_v5.sql', import.meta.url), 'utf8');
const historyChangePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/history-change-continuity.json', import.meta.url), 'utf8'));
const historyChangeMigration = readFileSync(new URL('../../supabase/migrations/20261015001200_bncc_history_change_continuity_question_first_v5.sql', import.meta.url), 'utf8');
const historyChangeLegacyQuestions = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v4/subjects/history/questions.json', import.meta.url), 'utf8'))
  .filter((question) => question.primarySkill === 'HISTORY_ANALYZE_CHANGE_CONTINUITY');
const historyPerspectivesPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/history-compare-perspectives.json', import.meta.url), 'utf8'));
const historyPerspectivesMigration = readFileSync(new URL('../../supabase/migrations/20261015001300_bncc_history_compare_perspectives_question_first_v5.sql', import.meta.url), 'utf8');
const historyPerspectivesLegacyQuestions = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v4/subjects/history/questions.json', import.meta.url), 'utf8'))
  .filter((question) => question.primarySkill === 'HISTORY_COMPARE_PERSPECTIVES');
const historyMemoryPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/history-memory-evidence.json', import.meta.url), 'utf8'));
const historyMemoryMigration = readFileSync(new URL('../../supabase/migrations/20261015001400_bncc_history_memory_evidence_question_first_v5.sql', import.meta.url), 'utf8');
const historyMemoryLegacyQuestions = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v4/subjects/history/questions.json', import.meta.url), 'utf8'))
  .filter((question) => question.primarySkill === 'HISTORY_DISTINGUISH_MEMORY_HISTORY');
const mathPercentBasePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/math-percent-base.json', import.meta.url), 'utf8'));
const mathPercentBaseMigration = readFileSync(new URL('../../supabase/migrations/20261015001500_bncc_math_percent_base_question_first_v5.sql', import.meta.url), 'utf8');
const mathPercentBaseLegacyQuestions = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v4/subjects/mathematics/questions.json', import.meta.url), 'utf8'))
  .filter((question) => question.primarySkill === 'MATH_IDENTIFY_PERCENT_BASE');
const mathPercentIncreasePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/math-percent-increase.json', import.meta.url), 'utf8'));
const mathPercentIncreaseMigration = readFileSync(new URL('../../supabase/migrations/20261015001600_bncc_math_percent_increase_question_first_v5.sql', import.meta.url), 'utf8');
const mathPercentIncreaseLegacyQuestions = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v4/subjects/mathematics/questions.json', import.meta.url), 'utf8'))
  .filter((question) => question.primarySkill === 'MATH_PERCENT_INCREASE');
const portugueseCompareSourcesPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/portuguese-compare-sources.json', import.meta.url), 'utf8'));
const portugueseCompareSourcesMigration = readFileSync(new URL('../../supabase/migrations/20261015002000_bncc_portuguese_compare_sources_question_first_v5.sql', import.meta.url), 'utf8');
const portugueseReasonEvidencePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/portuguese-reason-evidence.json', import.meta.url), 'utf8'));
const portugueseReasonEvidenceMigration = readFileSync(new URL('../../supabase/migrations/20261015002100_bncc_portuguese_reason_evidence_question_first_v5.sql', import.meta.url), 'utf8');
const portugueseCounterargumentPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/portuguese-counterargument.json', import.meta.url), 'utf8'));
const portugueseCounterargumentMigration = readFileSync(new URL('../../supabase/migrations/20261015002200_bncc_portuguese_counterargument_question_first_v5.sql', import.meta.url), 'utf8');
const portugueseSummarizeArgumentPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/portuguese-summarize-argument.json', import.meta.url), 'utf8'));
const portugueseSummarizeArgumentMigration = readFileSync(new URL('../../supabase/migrations/20261015002300_bncc_portuguese_summarize_argument_question_first_v5.sql', import.meta.url), 'utf8');
const mathRatioRatePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/math-ratio-unit-rate.json', import.meta.url), 'utf8'));
const mathRatioRateMigration = readFileSync(new URL('../../supabase/migrations/20261013001500_bncc_math_ratio_unit_rate_question_first_v5.sql', import.meta.url), 'utf8');
const physicalEducationPacks = buildPhysicalEducationAuthenticPacks();
const peDistinguishPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/physical-activity-exercise.json', import.meta.url), 'utf8'));
const peDistinguishMigration = readFileSync(new URL('../../supabase/migrations/20261013001600_bncc_pe_activity_exercise_authentic_v5.sql', import.meta.url), 'utf8');
const peSafePlanPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/physical-safe-activity.json', import.meta.url), 'utf8'));
const peSafePlanMigration = readFileSync(new URL('../../supabase/migrations/20261013001700_bncc_pe_safe_activity_authentic_v5.sql', import.meta.url), 'utf8');
const portugueseConnectIdeasPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/portuguese-connect-ideas.json', import.meta.url), 'utf8'));
const portugueseConnectIdeasMigration = readFileSync(new URL('../../supabase/migrations/20261013001800_bncc_portuguese_connect_ideas_question_first_v5.sql', import.meta.url), 'utf8');
const portugueseInferPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/portuguese-infer-from-clues.json', import.meta.url), 'utf8'));
const portugueseInferMigration = readFileSync(new URL('../../supabase/migrations/20261013001900_bncc_portuguese_infer_from_clues_question_first_v5.sql', import.meta.url), 'utf8');
const religiousDialoguePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/religious-mediate-dialogue.json', import.meta.url), 'utf8'));
const religiousDialogueMigration = readFileSync(new URL('../../supabase/migrations/20261013002000_bncc_religious_mediate_dialogue_question_first_v5.sql', import.meta.url), 'utf8');
const scienceEvidencePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/science-evidence-conclusion.json', import.meta.url), 'utf8'));
const scienceEvidenceMigration = readFileSync(new URL('../../supabase/migrations/20261013002100_bncc_science_evidence_conclusion_question_first_v5.sql', import.meta.url), 'utf8');
const biologyCellFunctionPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/biology-cell-function.json', import.meta.url), 'utf8'));
const biologyCellFunctionMigration = readFileSync(new URL('../../supabase/migrations/20261013002200_bncc_biology_cell_function_question_first_v5.sql', import.meta.url), 'utf8');
const biologyInheritancePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/biology-inheritance.json', import.meta.url), 'utf8'));
const biologyInheritanceMigration = readFileSync(new URL('../../supabase/migrations/20261013002300_bncc_biology_inheritance_question_first_v5.sql', import.meta.url), 'utf8');
const biologyPopulationPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/biology-population-data.json', import.meta.url), 'utf8'));
const biologyPopulationMigration = readFileSync(new URL('../../supabase/migrations/20261013002400_bncc_biology_population_data_question_first_v5.sql', import.meta.url), 'utf8');
const chemistryAtomicPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/chemistry-atomic-structure.json', import.meta.url), 'utf8'));
const chemistryAtomicMigration = readFileSync(new URL('../../supabase/migrations/20261013002500_bncc_chemistry_atomic_structure_question_first_v5.sql', import.meta.url), 'utf8');
const chemistryReactionEvidencePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/chemistry-reaction-evidence.json', import.meta.url), 'utf8'));
const chemistryReactionEvidenceMigration = readFileSync(new URL('../../supabase/migrations/20261013002600_bncc_chemistry_reaction_evidence_question_first_v5.sql', import.meta.url), 'utf8');
const chemistryStoichiometryPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/chemistry-stoichiometry.json', import.meta.url), 'utf8'));
const chemistryStoichiometryMigration = readFileSync(new URL('../../supabase/migrations/20261013002700_bncc_chemistry_stoichiometry_question_first_v5.sql', import.meta.url), 'utf8');
const philosophyEthicsPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/philosophy-ethical-principle.json', import.meta.url), 'utf8'));
const philosophyEthicsMigration = readFileSync(new URL('../../supabase/migrations/20261013002800_bncc_philosophy_ethical_principle_question_first_v5.sql', import.meta.url), 'utf8');
const philosophyArgumentPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/philosophy-evaluate-argument.json', import.meta.url), 'utf8'));
const philosophyArgumentMigration = readFileSync(new URL('../../supabase/migrations/20261013002900_bncc_philosophy_evaluate_argument_question_first_v5.sql', import.meta.url), 'utf8');
const philosophyConceptPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/philosophy-distinguish-concept.json', import.meta.url), 'utf8'));
const philosophyConceptMigration = readFileSync(new URL('../../supabase/migrations/20261013003300_bncc_philosophy_distinguish_concept_question_first_v5.sql', import.meta.url), 'utf8');
const philosophyConceptCorrectionMigration = readFileSync(new URL('../../supabase/migrations/20261013003400_bncc_philosophy_concept_semantic_reconciliation_v1.sql', import.meta.url), 'utf8');
const mathSuccessiveV6Pack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/math-successive-percent-change-v6.json', import.meta.url), 'utf8'));
const mathSuccessiveV6Migration = readFileSync(new URL('../../supabase/migrations/20261013003500_bncc_math_successive_percent_change_question_first_v6.sql', import.meta.url), 'utf8');
const physicsAverageSpeedPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/physics-average-speed.json', import.meta.url), 'utf8'));
const physicsAverageSpeedMigration = readFileSync(new URL('../../supabase/migrations/20261013003000_bncc_physics_average_speed_question_first_v5.sql', import.meta.url), 'utf8');
const physicsMotionGraphPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/physics-motion-graph.json', import.meta.url), 'utf8'));
const physicsMotionGraphMigration = readFileSync(new URL('../../supabase/migrations/20261013003100_bncc_physics_motion_graph_question_first_v5.sql', import.meta.url), 'utf8');
const physicsUnitConversionPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/physics-unit-conversion.json', import.meta.url), 'utf8'));
const physicsUnitConversionMigration = readFileSync(new URL('../../supabase/migrations/20261013003600_bncc_physics_unit_conversion_question_first_v5.sql', import.meta.url), 'utf8');
const englishInferencePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/english-infer-from-text.json', import.meta.url), 'utf8'));
const englishInferenceMigration = readFileSync(new URL('../../supabase/migrations/20261013003200_bncc_english_infer_text_question_first_v5.sql', import.meta.url), 'utf8');
const sociologyInequalityPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/sociology-inequality-data.json', import.meta.url), 'utf8'));
const sociologyInequalityMigration = readFileSync(new URL('../../supabase/migrations/20261013003700_bncc_sociology_inequality_data_question_first_v5.sql', import.meta.url), 'utf8');
const sociologyNormValuePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/sociology-norm-value.json', import.meta.url), 'utf8'));
const sociologyNormValueMigration = readFileSync(new URL('../../supabase/migrations/20261013003800_bncc_sociology_norm_value_question_first_v5.sql', import.meta.url), 'utf8');
const sociologyInstitutionsPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/sociology-institutions.json', import.meta.url), 'utf8'));
const sociologyInstitutionsMigration = readFileSync(new URL('../../supabase/migrations/20261014000150_bncc_sociology_institutions_question_first_v5.sql', import.meta.url), 'utf8');
const artCompositionPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/art-compare-compositions.json', import.meta.url), 'utf8'));
const artCompositionMigration = readFileSync(new URL('../../supabase/migrations/20261014000200_bncc_art_compare_compositions_question_first_v5.sql', import.meta.url), 'utf8');
const artEditorialAudit = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/art-editorial-audit-v1.json', import.meta.url), 'utf8'));
const artInterpretPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/art-interpret-work.json', import.meta.url), 'utf8'));
const artInterpretMigration = readFileSync(new URL('../../supabase/migrations/20261015000200_bncc_art_interpret_work_question_first_v5.sql', import.meta.url), 'utf8');
const artUnsupportedQuestionMigration = readFileSync(new URL('../../supabase/migrations/20261015000100_bncc_art_exclude_unsubstantiated_poster_question.sql', import.meta.url), 'utf8');
const guidedRuntimeSelectionMigration = readFileSync(new URL('../../supabase/migrations/20261010001200_bncc_deep_learning_v8_runtime_gate_fix.sql', import.meta.url), 'utf8');
const artContextPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/art-relate-work-context.json', import.meta.url), 'utf8'));
const artContextMigration = readFileSync(new URL('../../supabase/migrations/20261015000300_bncc_art_relate_work_context_question_first_v5.sql', import.meta.url), 'utf8');
const computingTablePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/computing-read-table-data.json', import.meta.url), 'utf8'));
const computingTableMigration = readFileSync(new URL('../../supabase/migrations/20261015000500_bncc_computing_read_table_data_question_first_v5.sql', import.meta.url), 'utf8');
const computingMisclassifiedQuestionMigration = readFileSync(new URL('../../supabase/migrations/20261015000400_bncc_exclude_misclassified_computing_table_question.sql', import.meta.url), 'utf8');
const computingTracePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/computing-trace-algorithm.json', import.meta.url), 'utf8'));
const computingTraceMigration = readFileSync(new URL('../../supabase/migrations/20261015000600_bncc_computing_trace_algorithm_question_first_v5.sql', import.meta.url), 'utf8');
const englishCulturePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/english-relate-language-culture.json', import.meta.url), 'utf8'));
const englishCultureMigration = readFileSync(new URL('../../supabase/migrations/20261015000700_bncc_english_relate_language_culture_question_first_v5.sql', import.meta.url), 'utf8');
const englishContextVocabularyPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/english-context-vocabulary.json', import.meta.url), 'utf8'));
const englishContextVocabularyMigration = readFileSync(new URL('../../supabase/migrations/20261015000800_bncc_english_context_vocabulary_question_first_v5.sql', import.meta.url), 'utf8');
const geographyClimateDataPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/geography-climate-data.json', import.meta.url), 'utf8'));
const geographyClimateDataMigration = readFileSync(new URL('../../supabase/migrations/20261015000900_bncc_geography_climate_data_question_first_v5.sql', import.meta.url), 'utf8');
const geographyInterpretTerritoryPack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/geography-interpret-territory.json', import.meta.url), 'utf8'));
const geographyInterpretTerritoryMigration = readFileSync(new URL('../../supabase/migrations/20261015001000_bncc_geography_interpret_territory_question_first_v5.sql', import.meta.url), 'utf8');
const geographyMapScalePack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/geography-map-scale.json', import.meta.url), 'utf8'));
const geographyMapScaleMigration = readFileSync(new URL('../../supabase/migrations/20261015001100_bncc_geography_map_scale_question_first_v5.sql', import.meta.url), 'utf8');
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
const internalCandidateMigrations = [
  portugueseVariationMigration,
  computingSearchMigration,
  computingCommunitiesMigration,
  humanitiesProductionMigration,
  languagesSemioticMigration,
  languagesCollaborationMigration,
  mathRiskMigration,
  artCharacterMigration,
  mathPositionMigration,
  portugueseSignsMigration,
  religiousInclusionMigration,
];

describe('question-first V5 staging content', () => {
  it('closes successive-percent source feedback and transfer/review coverage in a new inactive version', () => {
    const result = validateQuestionFirstPack(mathSuccessiveV6Pack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(14);
    expect(result.contextCount).toBe(14);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 2, TRANSFER: 3, LOCK_IN: 2, REVIEW: 5 });
    expect(result.answerPositionCounts).toEqual({ A: 4, B: 4, C: 3, D: 3 });
    expect(mathSuccessiveV6Pack.sourceQuestionFeedback).toHaveLength(29);
    expect(new Set(mathSuccessiveV6Pack.sourceQuestionFeedback.map((item) => item.questionId)).size).toBe(29);
    expect(mathSuccessiveV6Pack.lesson.progressiveExplanation).toHaveLength(4);
    expect(mathSuccessiveV6Pack.lesson.remediations).toHaveLength(3);
    expect(mathSuccessiveV6Pack.contentVersion).toBe(6);
    expect(mathSuccessiveV6Pack.lessonVersion).toBe(6);
    expect(mathSuccessiveV6Pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(mathSuccessiveV6Pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(mathSuccessiveV6Pack.publicationStatus).toBe('STAGING');
  });

  it('builds the Math V6 migration deterministically without enabling or editing learner progress', () => {
    expect(mathSuccessiveV6Pack).toEqual(buildMathSuccessivePercentChangePack());
    expect(mathSuccessiveV6Migration).toBe(buildMigration(mathSuccessiveV6Pack));
    expect(mathSuccessiveV6Migration).toContain('v_skill_id, 6,');
    expect(mathSuccessiveV6Migration).toContain("'GLOBAL', v_skill_id, v_question.purpose, 6, false");
    expect(mathSuccessiveV6Migration).toContain('"source_question_feedback"');
    expect(mathSuccessiveV6Migration).toContain("'publication_status', 'STAGING'");
    expect(mathSuccessiveV6Migration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(mathSuccessiveV6Migration).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
    expect(mathSuccessiveV6Migration).not.toMatch(/learning_guided_sessions|learning_guided_steps|learning_guided_step_attempts|learning_student_skill_state/i);
  });

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
    expect(sql).toContain("coalesce(v_internal_parent_snapshot::text, 'MISSING')");
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

  it('writes the real publication column as STAGING for every internal V3 candidate', () => {
    for (const candidateMigration of internalCandidateMigrations) {
      const skillInsert = candidateMigration.slice(candidateMigration.lastIndexOf('insert into public.learning_curriculum_skills as existing('));
      expect(skillInsert).toContain('publication_status, bncc_alignment_status, metadata');
      expect(skillInsert).toContain("'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', 'CANDIDATE'");
      expect(skillInsert).toContain("set publication_status = 'STAGING'");
      expect(skillInsert).toContain("and publication_status = 'STAGING'");
      expect(skillInsert).toContain("metadata->>'publication_status' = 'STAGING'");
    }
  });

  it('deepens phishing recognition with a privacy-safe, distinct 35-question sequence', () => {
    const result = validateQuestionFirstPack(computingPhishingPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === computingPhishingPack.canonicalSkillCode);
    expect(v3).toBeDefined();
    expect(Object.fromEntries(Object.entries(result.counts).map(([purpose, count]) => [purpose, count + (v3.purposeCounts[purpose] ?? 0)]))).toEqual({
      PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10,
    });
    const visibleContent = computingPhishingPack.questions.flatMap((question) => [question.statement, ...question.options]);
    expect(visibleContent.join(' ')).not.toMatch(/https?:\/\/|www\./i);
    expect(computingPhishingPack.lesson.authenticActivities[0].privacyGuard).toContain('sem links ativos');
    expect(computingPhishingPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(computingPhishingPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(computingPhishingPack.publicationStatus).toBe('STAGING');
  });

  it('compiles the phishing increment as inactive, unaligned staging content', () => {
    expect(computingPhishingPack).toEqual(buildComputingPhishingPack());
    expect(computingPhishingMigration).toBe(buildMigration(computingPhishingPack));
    expect(computingPhishingMigration).toContain("'COMPUTING_RECOGNIZE_PHISHING'");
    expect(computingPhishingMigration).toContain("'publication_status', 'STAGING'");
    expect(computingPhishingMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(computingPhishingMigration).toContain('active, metadata)');
    expect(computingPhishingMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens human-diversity observation without exposing real students', () => {
    const result = validateQuestionFirstPack(scienceHumanDiversityPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === scienceHumanDiversityPack.canonicalSkillCode);
    expect(v3).toBeDefined();
    expect(Object.fromEntries(Object.entries(result.counts).map(([purpose, count]) => [purpose, count + (v3.purposeCounts[purpose] ?? 0)]))).toEqual({
      PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10,
    });
    expect(scienceHumanDiversityPack.lesson.authenticActivities[0].privacyGuard).toContain('Não coletar ou registrar');
    expect(scienceHumanDiversityPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(scienceHumanDiversityPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(scienceHumanDiversityPack.publicationStatus).toBe('STAGING');
  });

  it('compiles the human-diversity increment as inactive staging without student records', () => {
    expect(scienceHumanDiversityPack).toEqual(buildScienceHumanDiversityPack());
    expect(scienceHumanDiversityMigration).toBe(buildMigration(scienceHumanDiversityPack));
    expect(scienceHumanDiversityMigration).toContain("'SCIENCE_COMPARE_HUMAN_DIVERSITY_RESPECTFULLY_FI'");
    expect(scienceHumanDiversityMigration).toContain("'publication_status', 'STAGING'");
    expect(scienceHumanDiversityMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(scienceHumanDiversityMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens historical causality with varied evidence and preserves the staged review gates', () => {
    const result = validateQuestionFirstPack(historyCausesPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(34);
    expect(result.contextCount).toBe(34);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 10, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 8, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === historyCausesPack.canonicalSkillCode);
    expect(v3).toBeDefined();
    expect(Object.fromEntries(Object.entries(result.counts).map(([purpose, count]) => [purpose, count + (v3.purposeCounts[purpose] ?? 0)]))).toEqual({
      PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10,
    });
    expect(historyCausesPack.lesson.authenticActivities).toHaveLength(1);
    expect(historyCausesPack.lesson.sourceDossier).toHaveLength(4);
    expect(historyCausesPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(historyCausesPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(historyCausesPack.publicationStatus).toBe('STAGING');
  });

  it('compiles historical causality as inactive staging without student records', () => {
    expect(historyCausesPack).toEqual(buildHistoryCompareCausesPack());
    expect(historyCausesMigration).toBe(buildMigration(historyCausesPack));
    expect(historyCausesMigration).toContain("'HISTORY_COMPARE_CAUSES'");
    expect(historyCausesMigration).toContain("'publication_status', 'STAGING'");
    expect(historyCausesMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(historyCausesMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('stages change-and-continuity questions with source limits and a contextual evidence activity', () => {
    const result = validateQuestionFirstPack(historyChangePack);
    expect(historyChangePack).toEqual(buildHistoryChangeContinuityPack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 40,
      contextCount: 40,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 5, REVIEW: 11 },
      answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    });
    expect(historyChangePack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(historyChangePack.sourceQuestionFeedback).toHaveLength(1);
    expect(historyChangePack.sourceReconciliation).toMatchObject({ sourceQuestionCount: 1, feedbackAdded: 1, sourceReconciliationStatus: 'EXACT', newQuestions: 40, reusedQuestionsCountedAsNew: false });
    expect(historyChangePack.lesson.microExplanations).toHaveLength(6);
    expect(historyChangePack.lesson.remediations).toHaveLength(6);
    expect(historyChangePack.lesson.authenticActivities).toHaveLength(1);
    expect(historyChangePack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(historyChangePack.lesson.authenticActivities[0].context).toContain('hipotéticos');
    expect(historyChangePack.publicationStatus).toBe('STAGING');
    expect(historyChangePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(historyChangePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(historyChangeLegacyQuestions).toHaveLength(1);
    const sourceCounts = Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [
      purpose,
      historyChangeLegacyQuestions.filter((question) => question.purpose === purpose).length,
    ]));
    expect(Object.fromEntries(Object.entries(result.counts).map(([purpose, count]) => [purpose, count + sourceCounts[purpose]]))).toEqual({
      PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 11,
    });
    expect(historyChangeMigration).toBe(buildMigration(historyChangePack));
    expect(historyChangeMigration).toContain("'HISTORY_ANALYZE_CHANGE_CONTINUITY'");
    expect(historyChangeMigration).toContain("'publication_status', 'STAGING'");
    expect(historyChangeMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(historyChangeMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(historyChangeMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('stages a progressive source-perspectives sequence without presenting hypothetical excerpts as historical records', () => {
    const result = validateQuestionFirstPack(historyPerspectivesPack);
    expect(historyPerspectivesPack).toEqual(buildHistoryComparePerspectivesPack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 40,
      contextCount: 40,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 },
      answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    });
    expect(historyPerspectivesPack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(historyPerspectivesPack.sourceQuestionFeedback).toHaveLength(1);
    expect(historyPerspectivesPack.sourceReconciliation).toMatchObject({ sourceQuestionCount: 1, feedbackAdded: 1, sourceReconciliationStatus: 'EXACT', newQuestions: 40, reusedQuestionsCountedAsNew: false });
    expect(historyPerspectivesPack.lesson.microExplanations).toHaveLength(6);
    expect(historyPerspectivesPack.lesson.remediations).toHaveLength(6);
    expect(historyPerspectivesPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(historyPerspectivesPack.lesson.authenticActivities[0].context).toContain('hipotéticos');
    expect(historyPerspectivesPack.lesson.copyrightNote).toContain('não devem ser apresentadas como documentos reais');
    expect(historyPerspectivesPack.publicationStatus).toBe('STAGING');
    expect(historyPerspectivesPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(historyPerspectivesPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(historyPerspectivesLegacyQuestions).toHaveLength(1);
    expect(historyPerspectivesMigration).toBe(buildMigration(historyPerspectivesPack));
    expect(historyPerspectivesMigration).toContain("'HISTORY_COMPARE_PERSPECTIVES'");
    expect(historyPerspectivesMigration).toContain("'publication_status', 'STAGING'");
    expect(historyPerspectivesMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(historyPerspectivesMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(historyPerspectivesMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('stages memory and historical evidence with ethical, non-disclosive activities', () => {
    const result = validateQuestionFirstPack(historyMemoryPack);
    expect(historyMemoryPack).toEqual(buildHistoryMemoryEvidencePack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 40,
      contextCount: 40,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 },
      answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    });
    expect(historyMemoryPack.sourceQuestionFeedback).toHaveLength(1);
    expect(historyMemoryPack.lesson.microExplanations).toHaveLength(6);
    expect(historyMemoryPack.lesson.remediations).toHaveLength(6);
    expect(historyMemoryPack.lesson.authenticActivities[0].privacyGuard).toContain('Não coletar história familiar');
    expect(historyMemoryPack.lesson.authenticActivities[0].safety).toContain('Não obrigar relatos pessoais');
    expect(historyMemoryPack.lesson.copyrightNote).toContain('Nenhum relato hipotético');
    expect(historyMemoryLegacyQuestions).toHaveLength(1);
    expect(historyMemoryPack.publicationStatus).toBe('STAGING');
    expect(historyMemoryPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(historyMemoryPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(historyMemoryMigration).toBe(buildMigration(historyMemoryPack));
    expect(historyMemoryMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('teaches percent bases across initial values, subgroups and successive changes', () => {
    const result = validateQuestionFirstPack(mathPercentBasePack);
    expect(mathPercentBasePack).toEqual(buildMathPercentBasePack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 40,
      contextCount: 40,
      answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    });
    expect(mathPercentBasePack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(mathPercentBasePack.sourceQuestionFeedback).toHaveLength(8);
    expect(mathPercentBasePack.lesson.microExplanations).toHaveLength(6);
    expect(mathPercentBasePack.lesson.remediations).toHaveLength(6);
    expect(mathPercentBasePack.lesson.authenticActivities[0].privacyGuard).toContain('Não inserir nomes');
    expect(mathPercentBasePack.publicationStatus).toBe('STAGING');
    expect(mathPercentBasePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(mathPercentBasePack.officialMappingStatus).toBe('NOT_CLAIMED');
    const combinedCounts = Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [
      purpose,
      [...mathPercentBasePack.questions, ...mathPercentBaseLegacyQuestions].filter((question) => question.purpose === purpose).length,
    ]));
    expect(combinedCounts).toEqual({ PROBE: 6, PRACTICE: 16, TRANSFER: 9, LOCK_IN: 6, REVIEW: 11 });
    expect(mathPercentBaseMigration).toBe(buildMigration(mathPercentBasePack));
    expect(mathPercentBaseMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('stages percent-increase calculations with distinct base, change and final-value reasoning', () => {
    const result = validateQuestionFirstPack(mathPercentIncreasePack);
    expect(mathPercentIncreasePack).toEqual(buildMathPercentIncreasePack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 40,
      contextCount: 40,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 },
      answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    });
    expect(mathPercentIncreasePack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(new Set(mathPercentIncreasePack.questions.filter(({ purpose }) => purpose === 'TRANSFER').map(({ cognitiveProcess }) => cognitiveProcess)).size).toBeGreaterThanOrEqual(3);
    expect(mathPercentIncreasePack.sourceQuestionFeedback).toHaveLength(10);
    expect(mathPercentIncreasePack.lesson.microExplanations).toHaveLength(6);
    expect(mathPercentIncreasePack.lesson.remediations).toHaveLength(6);
    expect(mathPercentIncreasePack.publicationStatus).toBe('STAGING');
    expect(mathPercentIncreasePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(mathPercentIncreasePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(mathPercentIncreaseLegacyQuestions).toHaveLength(10);
    expect(mathPercentIncreaseMigration).toBe(buildMigration(mathPercentIncreasePack));
    expect(mathPercentIncreaseMigration).toContain("'MATH_PERCENT_INCREASE'");
    expect(mathPercentIncreaseMigration).toContain("'publication_status', 'STAGING'");
    expect(mathPercentIncreaseMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(mathPercentIncreaseMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens unit-rate reasoning across conversions, comparisons, and non-proportional cases', () => {
    const result = validateQuestionFirstPack(mathRatioRatePack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(30);
    expect(result.contextCount).toBe(30);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 8, TRANSFER: 7, LOCK_IN: 5, REVIEW: 8 });
    expect(result.answerPositionCounts).toEqual({ A: 8, B: 8, C: 7, D: 7 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === mathRatioRatePack.canonicalSkillCode);
    expect(v3).toBeDefined();
    expect(Object.fromEntries(Object.entries(result.counts).map(([purpose, count]) => [purpose, count + (v3.purposeCounts[purpose] ?? 0)]))).toEqual({
      PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10,
    });
    expect(mathRatioRatePack.lesson.remediations).toHaveLength(5);
    expect(mathRatioRatePack.lesson.authenticActivities).toHaveLength(1);
    expect(mathRatioRatePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(mathRatioRatePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(mathRatioRatePack.publicationStatus).toBe('STAGING');
  });

  it('compiles unit-rate content as inactive staging without student records', () => {
    expect(mathRatioRatePack).toEqual(buildMathRatioUnitRatePack());
    expect(mathRatioRateMigration).toBe(buildMigration(mathRatioRatePack));
    expect(mathRatioRateMigration).toContain("'MATH_RATIO_UNIT_RATE'");
    expect(mathRatioRateMigration).toContain("'publication_status', 'STAGING'");
    expect(mathRatioRateMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(mathRatioRateMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens Portuguese connectors with distinct functions, contexts and evidence-calibrated reasoning', () => {
    const result = validateQuestionFirstPack(portugueseConnectIdeasPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === portugueseConnectIdeasPack.canonicalSkillCode);
    expect(v3).toBeDefined();
    expect(Object.fromEntries(Object.entries(result.counts).map(([purpose, count]) => [purpose, count + (v3.purposeCounts[purpose] ?? 0)]))).toEqual({
      PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10,
    });
    expect(portugueseConnectIdeasPack.questions.some((question) => question.explanation.includes('não prova'))).toBe(true);
    expect(portugueseConnectIdeasPack.lesson.progression.flatMap((stage) => stage.questionIds)).toHaveLength(35);
    expect(portugueseConnectIdeasPack.lesson.microExplanations).toHaveLength(6);
    expect(portugueseConnectIdeasPack.lesson.remediations).toHaveLength(5);
    expect(portugueseConnectIdeasPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(portugueseConnectIdeasPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(portugueseConnectIdeasPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(portugueseConnectIdeasPack.publicationStatus).toBe('STAGING');
  });

  it('compiles Portuguese connector practice as inactive staging without student records', () => {
    expect(portugueseConnectIdeasPack).toEqual(buildPortugueseConnectIdeasPack());
    expect(portugueseConnectIdeasMigration).toBe(buildMigration(portugueseConnectIdeasPack));
    expect(portugueseConnectIdeasMigration).toContain("'PORTUGUESE_CONNECT_IDEAS'");
    expect(portugueseConnectIdeasMigration).toContain("'publication_status', 'STAGING'");
    expect(portugueseConnectIdeasMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(portugueseConnectIdeasMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(portugueseConnectIdeasMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens Portuguese inference with clue-backed conclusions and explicit limits', () => {
    const result = validateQuestionFirstPack(portugueseInferPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === portugueseInferPack.canonicalSkillCode);
    expect(v3).toBeDefined();
    expect(Object.fromEntries(Object.entries(result.counts).map(([purpose, count]) => [purpose, count + (v3.purposeCounts[purpose] ?? 0)]))).toEqual({
      PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10,
    });
    expect(portugueseInferPack.questions.some((question) => question.explanation.includes('não informa'))).toBe(true);
    expect(portugueseInferPack.lesson.progression.flatMap((stage) => stage.questionIds)).toHaveLength(35);
    expect(portugueseInferPack.lesson.microExplanations).toHaveLength(6);
    expect(portugueseInferPack.lesson.remediations).toHaveLength(5);
    expect(portugueseInferPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(portugueseInferPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(portugueseInferPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(portugueseInferPack.publicationStatus).toBe('STAGING');
  });

  it('compiles inference practice as inactive staging without student records', () => {
    expect(portugueseInferPack).toEqual(buildPortugueseInferFromCluesPack());
    expect(portugueseInferMigration).toBe(buildMigration(portugueseInferPack));
    expect(portugueseInferMigration).toContain("'PORTUGUESE_INFER_FROM_CLUES'");
    expect(portugueseInferMigration).toContain("'publication_status', 'STAGING'");
    expect(portugueseInferMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(portugueseInferMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(portugueseInferMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens dialogue mediation with privacy, pluralism and safety boundaries', () => {
    const result = validateQuestionFirstPack(religiousDialoguePack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === religiousDialoguePack.canonicalSkillCode);
    expect(v3).toBeDefined();
    expect(Object.fromEntries(Object.entries(result.counts).map(([purpose, count]) => [purpose, count + (v3.purposeCounts[purpose] ?? 0)]))).toEqual({
      PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10,
    });
    expect(religiousDialoguePack.questions.some((question) => question.statement.includes('ameaçad'))).toBe(true);
    expect(religiousDialoguePack.lesson.remediations).toHaveLength(5);
    expect(religiousDialoguePack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(religiousDialoguePack.lesson.authenticActivities[0].mediation).toContain('não substitui');
    expect(religiousDialoguePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(religiousDialoguePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(religiousDialoguePack.publicationStatus).toBe('STAGING');
  });

  it('compiles dialogue mediation as inactive staging without student records', () => {
    expect(religiousDialoguePack).toEqual(buildReligiousMediateDialoguePack());
    expect(religiousDialogueMigration).toBe(buildMigration(religiousDialoguePack));
    expect(religiousDialogueMigration).toContain("'RELIGIOUS_MEDIATE_DIALOGUE'");
    expect(religiousDialogueMigration).toContain("'publication_status', 'STAGING'");
    expect(religiousDialogueMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(religiousDialogueMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(religiousDialogueMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens scientific conclusions through measured evidence, alternatives and scope limits', () => {
    const result = validateQuestionFirstPack(scienceEvidencePack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(35);
    expect(result.contextCount).toBe(35);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 5, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 9, B: 9, C: 9, D: 8 });
    const v3 = v3Sequences.find((sequence) => sequence.skillCode === scienceEvidencePack.canonicalSkillCode);
    expect(v3).toBeDefined();
    expect(Object.fromEntries(Object.entries(result.counts).map(([purpose, count]) => [purpose, count + (v3.purposeCounts[purpose] ?? 0)]))).toEqual({
      PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10,
    });
    expect(scienceEvidencePack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(scienceEvidencePack.lesson.authenticActivities[0].safety).toContain('Não usar produtos químicos');
    expect(scienceEvidencePack.lesson.remediations).toHaveLength(5);
    expect(scienceEvidencePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(scienceEvidencePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(scienceEvidencePack.publicationStatus).toBe('STAGING');
  });

  it('compiles science evidence practice as inactive staging without student records', () => {
    expect(scienceEvidencePack).toEqual(buildScienceEvidenceConclusionPack());
    expect(scienceEvidenceMigration).toBe(buildMigration(scienceEvidencePack));
    expect(scienceEvidenceMigration).toContain("'SCIENCE_EVIDENCE_CONCLUSION'");
    expect(scienceEvidenceMigration).toContain("'publication_status', 'STAGING'");
    expect(scienceEvidenceMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(scienceEvidenceMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(scienceEvidenceMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('adds distinct cell-function questions with balanced answer positions and teachable feedback', () => {
    const result = validateQuestionFirstPack(biologyCellFunctionPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(23);
    expect(result.contextCount).toBe(23);
    expect(result.counts).toEqual({ PROBE: 0, PRACTICE: 7, TRANSFER: 5, LOCK_IN: 3, REVIEW: 8 });
    expect(result.answerPositionCounts).toEqual({ A: 6, B: 6, C: 6, D: 5 });
    expect(biologyCellFunctionPack.lesson.explanation).toContain('Exemplo resolvido');
    expect(biologyCellFunctionPack.lesson.remediations).toHaveLength(5);
    expect(biologyCellFunctionPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(biologyCellFunctionPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(biologyCellFunctionPack.publicationStatus).toBe('STAGING');
  });

  it('compiles cell-function content as inactive staging without student records', () => {
    expect(biologyCellFunctionPack).toEqual(buildBiologyCellFunctionPack());
    expect(biologyCellFunctionPack.contentVersion).toBe(6);
    expect(biologyCellFunctionMigration).toBe(buildMigration(biologyCellFunctionPack));
    expect(biologyCellFunctionMigration).toContain('version = 6');
    expect(biologyCellFunctionMigration).toContain("'BIOLOGY_CELL_FUNCTION'");
    expect(biologyCellFunctionMigration).toContain("'publication_status', 'STAGING'");
    expect(biologyCellFunctionMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(biologyCellFunctionMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(biologyCellFunctionMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('adds inheritance questions that extend rather than repeat the existing V4 and V9 bank', () => {
    const result = validateQuestionFirstPack(biologyInheritancePack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(21);
    expect(result.contextCount).toBe(21);
    expect(result.counts).toEqual({ PROBE: 0, PRACTICE: 4, TRANSFER: 5, LOCK_IN: 3, REVIEW: 9 });
    expect(result.answerPositionCounts).toEqual({ A: 6, B: 5, C: 5, D: 5 });
    expect(biologyInheritancePack.lesson.progression).toHaveLength(5);
    expect(biologyInheritancePack.lesson.microExplanations).toHaveLength(6);
    expect(biologyInheritancePack.lesson.remediations).toHaveLength(5);
    expect(biologyInheritancePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(biologyInheritancePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(biologyInheritancePack.publicationStatus).toBe('STAGING');
  });

  it('compiles inheritance content as inactive staging without student records', () => {
    expect(biologyInheritancePack).toEqual(buildBiologyInheritancePack());
    expect(biologyInheritanceMigration).toBe(buildMigration(biologyInheritancePack));
    expect(biologyInheritanceMigration).toContain("'BIOLOGY_EXPLAIN_INHERITANCE'");
    expect(biologyInheritanceMigration).toContain("'publication_status', 'STAGING'");
    expect(biologyInheritanceMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(biologyInheritanceMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(biologyInheritanceMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('adds varied population-data questions with sampling and causal-inference feedback', () => {
    const result = validateQuestionFirstPack(biologyPopulationPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(17);
    expect(result.contextCount).toBe(17);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 3, TRANSFER: 3, LOCK_IN: 3, REVIEW: 6 });
    expect(result.answerPositionCounts).toEqual({ A: 5, B: 4, C: 4, D: 4 });
    expect(biologyPopulationPack.lesson.explanation).toContain('captura-recaptura');
    expect(biologyPopulationPack.lesson.microExplanations).toHaveLength(6);
    expect(biologyPopulationPack.lesson.remediations).toHaveLength(5);
    expect(biologyPopulationPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(biologyPopulationPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(biologyPopulationPack.publicationStatus).toBe('STAGING');
  });

  it('compiles population-data content as inactive staging without student records', () => {
    expect(biologyPopulationPack).toEqual(buildBiologyPopulationDataPack());
    expect(biologyPopulationMigration).toBe(buildMigration(biologyPopulationPack));
    expect(biologyPopulationMigration).toContain("'BIOLOGY_INTERPRET_POPULATION_DATA'");
    expect(biologyPopulationMigration).toContain("'publication_status', 'STAGING'");
    expect(biologyPopulationMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(biologyPopulationMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(biologyPopulationMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('extends atomic-structure practice with integrated isotope, ion, and abundance reasoning', () => {
    const result = validateQuestionFirstPack(chemistryAtomicPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(14);
    expect(result.contextCount).toBe(14);
    expect(result.counts).toEqual({ PROBE: 0, PRACTICE: 1, TRANSFER: 4, LOCK_IN: 3, REVIEW: 6 });
    expect(result.answerPositionCounts).toEqual({ A: 4, B: 4, C: 3, D: 3 });
    expect(chemistryAtomicPack.lesson.explanation).toContain('q=P−E');
    expect(chemistryAtomicPack.lesson.microExplanations).toHaveLength(6);
    expect(chemistryAtomicPack.lesson.remediations).toHaveLength(5);
    expect(chemistryAtomicPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(chemistryAtomicPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(chemistryAtomicPack.publicationStatus).toBe('STAGING');
  });

  it('compiles atomic-structure content as inactive staging without student records', () => {
    expect(chemistryAtomicPack).toEqual(buildChemistryAtomicStructurePack());
    expect(chemistryAtomicMigration).toBe(buildMigration(chemistryAtomicPack));
    expect(chemistryAtomicMigration).toContain("'CHEMISTRY_ATOMIC_STRUCTURE'");
    expect(chemistryAtomicMigration).toContain("'publication_status', 'STAGING'");
    expect(chemistryAtomicMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(chemistryAtomicMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(chemistryAtomicMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('teaches evidence limits with controlled comparisons and diverse review contexts', () => {
    const result = validateQuestionFirstPack(chemistryReactionEvidencePack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(16);
    expect(result.contextCount).toBe(16);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 3, TRANSFER: 3, LOCK_IN: 1, REVIEW: 7 });
    expect(result.answerPositionCounts).toEqual({ A: 4, B: 4, C: 4, D: 4 });
    expect(chemistryReactionEvidencePack.lesson.explanation).toContain('Uma pista não é uma prova isolada');
    expect(chemistryReactionEvidencePack.lesson.microExplanations).toHaveLength(6);
    expect(chemistryReactionEvidencePack.lesson.remediations).toHaveLength(5);
    expect(chemistryReactionEvidencePack.lesson.sourceDossier).toHaveLength(4);
    expect(chemistryReactionEvidencePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(chemistryReactionEvidencePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(chemistryReactionEvidencePack.publicationStatus).toBe('STAGING');
  });

  it('compiles reaction-evidence content as inactive staging without student records', () => {
    expect(chemistryReactionEvidencePack).toEqual(buildChemistryReactionEvidencePack());
    expect(chemistryReactionEvidenceMigration).toBe(buildMigration(chemistryReactionEvidencePack));
    expect(chemistryReactionEvidenceMigration).toContain("'CHEMISTRY_REACTION_EVIDENCE'");
    expect(chemistryReactionEvidenceMigration).toContain("'publication_status', 'STAGING'");
    expect(chemistryReactionEvidenceMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(chemistryReactionEvidenceMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(chemistryReactionEvidenceMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('teaches stoichiometry from balanced ratios through limiting reactants and yield', () => {
    const result = validateQuestionFirstPack(chemistryStoichiometryPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(18);
    expect(result.contextCount).toBe(18);
    expect(result.counts).toEqual({ PROBE: 0, PRACTICE: 5, TRANSFER: 5, LOCK_IN: 3, REVIEW: 5 });
    expect(result.answerPositionCounts).toEqual({ A: 5, B: 5, C: 4, D: 4 });
    expect(chemistryStoichiometryPack.lesson.explanation).toContain('Encontre o reagente limitante');
    expect(chemistryStoichiometryPack.lesson.microExplanations).toHaveLength(6);
    expect(chemistryStoichiometryPack.lesson.remediations).toHaveLength(4);
    expect(chemistryStoichiometryPack.lesson.sourceDossier).toHaveLength(3);
    expect(chemistryStoichiometryPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(chemistryStoichiometryPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(chemistryStoichiometryPack.publicationStatus).toBe('STAGING');
  });

  it('compiles stoichiometry content as inactive staging without student records', () => {
    expect(chemistryStoichiometryPack).toEqual(buildChemistryStoichiometryPack());
    expect(chemistryStoichiometryPack.contentVersion).toBe(6);
    expect(chemistryStoichiometryMigration).toBe(buildMigration(chemistryStoichiometryPack));
    expect(chemistryStoichiometryMigration).toContain('version = 6');
    expect(chemistryStoichiometryMigration).toContain("'CHEMISTRY_STOICHIOMETRY'");
    expect(chemistryStoichiometryMigration).toContain("'publication_status', 'STAGING'");
    expect(chemistryStoichiometryMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(chemistryStoichiometryMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(chemistryStoichiometryMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('extends ethical-principle practice with a balanced pool and reconciled source feedback', () => {
    const result = validateQuestionFirstPack(philosophyEthicsPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(19);
    expect(result.contextCount).toBe(19);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 3, TRANSFER: 4, LOCK_IN: 3, REVIEW: 7 });
    expect(result.answerPositionCounts).toEqual({ A: 5, B: 5, C: 5, D: 4 });
    expect(philosophyEthicsPack.sourceQuestionFeedback).toHaveLength(21);
    expect(philosophyEthicsPack.lesson.microExplanations).toHaveLength(6);
    expect(philosophyEthicsPack.lesson.remediations).toHaveLength(4);
    expect(philosophyEthicsPack.lesson.sourceDossier).toHaveLength(3);
    expect(philosophyEthicsPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(philosophyEthicsPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(philosophyEthicsPack.publicationStatus).toBe('STAGING');
    expect(validateQuestionFirstPack({ ...philosophyEthicsPack, sourceQuestionFeedback: [...philosophyEthicsPack.sourceQuestionFeedback, { questionId: 'unknown-source', hint: 'x', errorFocus: 'y' }] }).errors)
      .toContain('SOURCE_QUESTION_FEEDBACK_SOURCE_UNKNOWN:unknown-source');
  });

  it('compiles ethical-principle content and source annotations as inactive staging', () => {
    expect(philosophyEthicsPack).toEqual(buildPhilosophyEthicalPrinciplePack());
    expect(philosophyEthicsMigration).toBe(buildMigration(philosophyEthicsPack));
    expect(philosophyEthicsMigration).toContain("'PHILOSOPHY_APPLY_ETHICAL_PRINCIPLE'");
    expect(philosophyEthicsMigration).toContain('"source_question_feedback"');
    expect(philosophyEthicsMigration).toContain("'publication_status', 'STAGING'");
    expect(philosophyEthicsMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(philosophyEthicsMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(philosophyEthicsMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens argument evaluation with source feedback and balanced original assessment', () => {
    const result = validateQuestionFirstPack(philosophyArgumentPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(20);
    expect(result.contextCount).toBe(20);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 4, TRANSFER: 4, LOCK_IN: 2, REVIEW: 8 });
    expect(result.answerPositionCounts).toEqual({ A: 5, B: 5, C: 5, D: 5 });
    expect(philosophyArgumentPack.sourceQuestionFeedback).toHaveLength(45);
    expect(philosophyArgumentPack.lesson.microExplanations).toHaveLength(6);
    expect(philosophyArgumentPack.lesson.remediations).toHaveLength(4);
    expect(philosophyArgumentPack.lesson.sourceDossier).toHaveLength(3);
    expect(philosophyArgumentPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(philosophyArgumentPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(philosophyArgumentPack.publicationStatus).toBe('STAGING');
  });

  it('compiles argument-evaluation content as inactive staging with its full source-feedback set', () => {
    expect(philosophyArgumentPack).toEqual(buildPhilosophyEvaluateArgumentPack());
    expect(philosophyArgumentPack.contentVersion).toBe(5);
    expect(philosophyArgumentPack.lessonVersion).toBe(6);
    expect(philosophyArgumentMigration).toBe(buildMigration(philosophyArgumentPack));
    expect(philosophyArgumentMigration).toContain("'PHILOSOPHY_EVALUATE_ARGUMENT'");
    expect(philosophyArgumentMigration).toContain('v_skill_id, 6,');
    expect(philosophyArgumentMigration).toContain("'GLOBAL', v_skill_id, v_question.purpose, 5, false");
    expect(philosophyArgumentMigration).toContain('"source_question_feedback"');
    expect(philosophyArgumentMigration).toContain("'publication_status', 'STAGING'");
    expect(philosophyArgumentMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(philosophyArgumentMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(philosophyArgumentMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('builds a distinct concept-versus-opinion sequence without reusing argument questions', () => {
    const result = validateQuestionFirstPack(philosophyConceptPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(40);
    expect(result.contextCount).toBe(40);
    expect(result.counts).toEqual({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 });
    expect(result.answerPositionCounts).toEqual({ A: 10, B: 10, C: 10, D: 10 });
    expect(philosophyConceptPack.questions.every((question) => question.id.startsWith('philosophy-concept-v5-'))).toBe(true);
    expect(philosophyConceptPack.sourceQuestionFeedback).toBeUndefined();
    expect(philosophyConceptPack.lesson.microExplanations).toHaveLength(6);
    expect(philosophyConceptPack.lesson.remediations).toHaveLength(4);
    expect(philosophyConceptPack.lesson.sourceDossier).toHaveLength(4);
    expect(philosophyConceptPack.lesson.explanation).toContain('Uma opinião pode ser apoiada por evidências');
    expect(philosophyConceptPack.lesson.explanation).toContain('nem todo conceito cotidiano ou filosófico tem uma definição clássica simples e consensual');
    expect(philosophyConceptPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(philosophyConceptPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(philosophyConceptPack.publicationStatus).toBe('STAGING');
  });

  it('compiles concept content inactive and reconciles the old V9 mismatch without touching attempts', () => {
    expect(philosophyConceptPack).toEqual(buildPhilosophyDistinguishConceptPack());
    expect(philosophyConceptPack.contentVersion).toBe(5);
    expect(philosophyConceptPack.lessonVersion).toBe(5);
    expect(philosophyConceptMigration).toBe(buildMigration(philosophyConceptPack));
    expect(philosophyConceptMigration).toContain("'PHILOSOPHY_DISTINGUISH_CONCEPT'");
    expect(philosophyConceptMigration).toContain('v_skill_id, 5,');
    expect(philosophyConceptMigration).toContain("'GLOBAL', v_skill_id, v_question.purpose, 5, false");
    expect(philosophyConceptMigration).toContain("'publication_status', 'STAGING'");
    expect(philosophyConceptMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(philosophyConceptMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(philosophyConceptMigration).not.toMatch(/learning_guided_sessions|learning_guided_steps|learning_guided_step_attempts|active\s*=\s*true/i);
    expect(philosophyConceptCorrectionMigration).toContain("journey_code = 'PHILOSOPHY_DISTINGUISH_CONCEPT_V93'");
    expect(philosophyConceptCorrectionMigration).toContain("metadata->>'content_id' like 'v93-phil-argument-%'");
    expect(philosophyConceptCorrectionMigration).toContain("'PHILOSOPHY_EVALUATE_ARGUMENT'");
    expect(philosophyConceptCorrectionMigration).toContain("'MISMATCH_SUPERSEDED'");
    expect(philosophyConceptCorrectionMigration).toContain('active = false');
    expect(philosophyConceptCorrectionMigration).not.toMatch(/(?:update|delete|insert\s+into)\s+public\.learning_guided_(?:sessions|steps|step_attempts)|(?:update|delete|insert\s+into)\s+public\.learning_student_skill_state/i);
  });

  it('deepens average-speed practice from the exact V4 and V9 source set', () => {
    const result = validateQuestionFirstPack(physicsAverageSpeedPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(20);
    expect(result.contextCount).toBe(20);
    expect(result.counts).toEqual({ PROBE: 0, PRACTICE: 6, TRANSFER: 5, LOCK_IN: 3, REVIEW: 6 });
    expect(result.answerPositionCounts).toEqual({ A: 5, B: 5, C: 5, D: 5 });
    expect(physicsAverageSpeedPack.sourceQuestionFeedback).toHaveLength(20);
    expect(physicsAverageSpeedPack.lesson.microExplanations).toHaveLength(6);
    expect(physicsAverageSpeedPack.lesson.remediations).toHaveLength(4);
    expect(physicsAverageSpeedPack.lesson.sourceDossier).toHaveLength(1);
    expect(physicsAverageSpeedPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(physicsAverageSpeedPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(physicsAverageSpeedPack.publicationStatus).toBe('STAGING');
  });

  it('compiles average-speed content as inactive staging without student records', () => {
    expect(physicsAverageSpeedPack).toEqual(buildPhysicsAverageSpeedPack());
    expect(physicsAverageSpeedPack.contentVersion).toBe(5);
    expect(physicsAverageSpeedPack.lessonVersion).toBe(6);
    expect(physicsAverageSpeedMigration).toBe(buildMigration(physicsAverageSpeedPack));
    expect(physicsAverageSpeedMigration).toContain("'PHYSICS_AVERAGE_SPEED'");
    expect(physicsAverageSpeedMigration).toContain('v_skill_id, 6,');
    expect(physicsAverageSpeedMigration).toContain("'GLOBAL', v_skill_id, v_question.purpose, 5, false");
    expect(physicsAverageSpeedMigration).toContain('"source_question_feedback"');
    expect(physicsAverageSpeedMigration).toContain("'publication_status', 'STAGING'");
    expect(physicsAverageSpeedMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(physicsAverageSpeedMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(physicsAverageSpeedMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens motion-graph practice from the exact V4 and V9 source set', () => {
    const result = validateQuestionFirstPack(physicsMotionGraphPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(24);
    expect(result.contextCount).toBe(24);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 7, TRANSFER: 4, LOCK_IN: 3, REVIEW: 7 });
    expect(result.answerPositionCounts).toEqual({ A: 6, B: 6, C: 6, D: 6 });
    expect(physicsMotionGraphPack.sourceQuestionFeedback).toHaveLength(22);
    expect(physicsMotionGraphPack.lesson.microExplanations).toHaveLength(5);
    expect(physicsMotionGraphPack.lesson.remediations).toHaveLength(5);
    expect(physicsMotionGraphPack.lesson.sourceDossier).toHaveLength(1);
    expect(physicsMotionGraphPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(physicsMotionGraphPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(physicsMotionGraphPack.publicationStatus).toBe('STAGING');
  });

  it('compiles motion-graph content as inactive staging without student records', () => {
    expect(physicsMotionGraphPack).toEqual(buildPhysicsMotionGraphPack());
    expect(physicsMotionGraphPack.contentVersion).toBe(5);
    expect(physicsMotionGraphPack.lessonVersion).toBe(6);
    expect(physicsMotionGraphMigration).toBe(buildMigration(physicsMotionGraphPack));
    expect(physicsMotionGraphMigration).toContain("'PHYSICS_INTERPRET_MOTION_GRAPH'");
    expect(physicsMotionGraphMigration).toContain('v_skill_id, 6,');
    expect(physicsMotionGraphMigration).toContain("'GLOBAL', v_skill_id, v_question.purpose, 5, false");
    expect(physicsMotionGraphMigration).toContain('"source_question_feedback"');
    expect(physicsMotionGraphMigration).toContain("'publication_status', 'STAGING'");
    expect(physicsMotionGraphMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(physicsMotionGraphMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(physicsMotionGraphMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens unit conversion with distinct conversion targets and source reconciliation', () => {
    const result = validateQuestionFirstPack(physicsUnitConversionPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(40);
    expect(result.contextCount).toBe(40);
    expect(result.counts).toEqual({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 });
    expect(result.answerPositionCounts).toEqual({ A: 10, B: 10, C: 10, D: 10 });
    expect(physicsUnitConversionPack.sourceQuestionFeedback).toHaveLength(14);
    expect(physicsUnitConversionPack.sourceReconciliation.v9ItemsNotReusedBecauseTheyAssessSpeedOrAccelerationRatherThanUnitConversion).toHaveLength(7);
    expect(physicsUnitConversionPack.lesson.microExplanations).toHaveLength(6);
    expect(physicsUnitConversionPack.lesson.remediations).toHaveLength(5);
    const expectedAnswers = {
      'v5-physics-units-transfer-06': '15 m/s',
      'v5-physics-units-lock-03': '12 m/s é maior; 40 km/h ≈ 11,1 m/s.',
      'v5-physics-units-review-01': '5.400 m',
      'v5-physics-units-review-08': '25 m/s',
    };
    for (const [questionId, answer] of Object.entries(expectedAnswers)) {
      expect(physicsUnitConversionPack.questions.find(({ id }) => id === questionId)?.correctAnswer).toBe(answer);
    }
    expect(physicsUnitConversionPack.lesson.explanation).toContain('18 m/s');
    expect(physicsUnitConversionPack.lesson.explanation).toContain('64,8 km/h');
    expect(physicsUnitConversionPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(physicsUnitConversionPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(physicsUnitConversionPack.publicationStatus).toBe('STAGING');
  });

  it('compiles unit-conversion content as inactive staging without changing student history', () => {
    expect(physicsUnitConversionPack).toEqual(buildPhysicsUnitConversionPack());
    expect(physicsUnitConversionPack.contentVersion).toBe(5);
    expect(physicsUnitConversionPack.lessonVersion).toBe(6);
    expect(physicsUnitConversionMigration).toBe(buildMigration(physicsUnitConversionPack));
    expect(physicsUnitConversionMigration).toContain("'PHYSICS_UNIT_CONVERSION'");
    expect(physicsUnitConversionMigration).toContain("'v5-physics-unit-conversion-wave3'");
    expect(physicsUnitConversionMigration).toContain("'GLOBAL', v_skill_id, v_question.purpose, 5, false");
    expect(physicsUnitConversionMigration).toContain("'publication_status', 'STAGING'");
    expect(physicsUnitConversionMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(physicsUnitConversionMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(physicsUnitConversionMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens sociology inequality-data analysis with reconciled sources and synthetic examples', () => {
    const result = validateQuestionFirstPack(sociologyInequalityPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(40);
    expect(result.contextCount).toBe(40);
    expect(result.counts).toEqual({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 });
    expect(result.answerPositionCounts).toEqual({ A: 10, B: 10, C: 10, D: 10 });
    expect(sociologyInequalityPack.sourceQuestionFeedback).toHaveLength(22);
    expect(sociologyInequalityPack.sourceReconciliation).toMatchObject({ sourceQuestionCount: 22, feedbackAdded: 22, newQuestions: 40, reuseCountedAsNew: false });
    const expectedAnswers = {
      'v5-sociology-inequality-probe-01': 'Os dois grupos tiveram participação de 30%.',
      'v5-sociology-inequality-probe-02': 'A desigualdade medida é menor em Y; isso não informa, por si só, qual território tem maior renda média.',
      'v5-sociology-inequality-practice-04': 'A mediana é R$ 1.100; o valor alto puxa a média, que é R$ 2.000.',
      'v5-sociology-inequality-transfer-01': 'A primeira: 40%, contra 25% na segunda.',
      'v5-sociology-inequality-review-07': 'O segundo: 20%, contra 10% no primeiro.',
    };
    for (const [questionId, answer] of Object.entries(expectedAnswers)) {
      expect(sociologyInequalityPack.questions.find(({ id }) => id === questionId)?.correctAnswer).toBe(answer);
    }
    expect(sociologyInequalityPack.lesson.workedExample).toContain('inteiramente fictício');
    expect(sociologyInequalityPack.lesson.microExplanations).toHaveLength(6);
    expect(sociologyInequalityPack.lesson.remediations).toHaveLength(6);
    expect(sociologyInequalityPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(sociologyInequalityPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(sociologyInequalityPack.publicationStatus).toBe('STAGING');
  });

  it('compiles sociology inequality-data content as inactive staging without student records', () => {
    expect(sociologyInequalityPack).toEqual(buildSociologyInequalityDataPack());
    expect(sociologyInequalityPack.contentVersion).toBe(5);
    expect(sociologyInequalityPack.lessonVersion).toBe(6);
    expect(sociologyInequalityMigration).toBe(buildMigration(sociologyInequalityPack));
    expect(sociologyInequalityMigration).toContain("'SOCIOLOGY_ANALYZE_INEQUALITY_DATA'");
    expect(sociologyInequalityMigration).toContain("'v5-sociology-inequality-data-wave3'");
    expect(sociologyInequalityMigration).toContain("'GLOBAL', v_skill_id, v_question.purpose, 5, false");
    expect(sociologyInequalityMigration).toContain("'publication_status', 'STAGING'");
    expect(sociologyInequalityMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(sociologyInequalityMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(sociologyInequalityMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('starts sociology norm/value learning with simple examples and a balanced, distinct question bank', () => {
    const result = validateQuestionFirstPack(sociologyNormValuePack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(40);
    expect(result.contextCount).toBe(40);
    expect(result.counts).toEqual({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 });
    expect(result.answerPositionCounts).toEqual({ A: 10, B: 10, C: 10, D: 10 });
    expect(sociologyNormValuePack.sourceQuestionFeedback).toHaveLength(20);
    expect(sociologyNormValuePack.sourceReconciliation).toMatchObject({
      existingV9QuestionsRetainedUnchanged: 20,
      newQuestions: 40,
      reusedQuestionsCountedAsNew: false,
      existingAnswerPositionPattern: expect.stringContaining('20_OF_20'),
    });
    expect(sociologyNormValuePack.questions[0].statement).toContain('depois das 22 horas');
    expect(sociologyNormValuePack.questions[0].correctAnswer).toBe('Uma norma social do grupo.');
    expect(sociologyNormValuePack.lesson.progression).toHaveLength(4);
    expect(sociologyNormValuePack.lesson.microExplanations).toHaveLength(6);
    expect(sociologyNormValuePack.lesson.remediations).toHaveLength(6);
    expect(sociologyNormValuePack.lesson.explanation).toContain('descreve frequência; não demonstra');
    expect(sociologyNormValuePack.lesson.sourceDossier[0].license).toContain('CC BY-NC-SA');
    expect(sociologyNormValuePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(sociologyNormValuePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(sociologyNormValuePack.publicationStatus).toBe('STAGING');
  });

  it('compiles sociology norm/value as inactive staging without altering existing questions or student history', () => {
    expect(sociologyNormValuePack).toEqual(buildSociologyNormValuePack());
    expect(sociologyNormValuePack.contentVersion).toBe(5);
    expect(sociologyNormValuePack.lessonVersion).toBe(5);
    expect(sociologyNormValueMigration).toBe(buildMigration(sociologyNormValuePack));
    expect(sociologyNormValueMigration).toContain("'SOCIOLOGY_DISTINGUISH_NORM_VALUE'");
    expect(sociologyNormValueMigration).toContain("'v5-sociology-distinguish-norm-value-wave3'");
    expect(sociologyNormValueMigration).toContain('"source_question_feedback"');
    expect(sociologyNormValueMigration).toContain("'GLOBAL', v_skill_id, v_question.purpose, 5, false");
    expect(sociologyNormValueMigration).toContain("'publication_status', 'STAGING'");
    expect(sociologyNormValueMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(sociologyNormValueMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(sociologyNormValueMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens sociology institutions with a progressive, distinct question set and exact source reconciliation', () => {
    const result = validateQuestionFirstPack(sociologyInstitutionsPack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(40);
    expect(result.contextCount).toBe(40);
    expect(result.counts).toEqual({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 });
    expect(result.answerPositionCounts).toEqual({ A: 10, B: 10, C: 10, D: 10 });
    expect(sociologyInstitutionsPack.questions.slice(0, 8).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(sociologyInstitutionsPack.sourceQuestionFeedback).toHaveLength(24);
    expect(sociologyInstitutionsPack.sourceReconciliation).toMatchObject({
      sourceQuestionCount: 24,
      feedbackAdded: 24,
      existingQuestionsRetainedUnchanged: true,
      sourceReconciliationStatus: 'EXACT',
      newQuestions: 40,
      reusedQuestionsCountedAsNew: false,
    });
    expect(sociologyInstitutionsPack.sourceReconciliation.v4QuestionIds).toHaveLength(11);
    expect(sociologyInstitutionsPack.sourceReconciliation.v9QuestionIds).toHaveLength(13);
    expect(sociologyInstitutionsPack.sourceReconciliation.existingItemsWithAdjacentOrBroadScopeFlaggedForEditorialReview).toHaveLength(7);
    expect(sociologyInstitutionsPack.questions[0].correctAnswer).toBe('Uma instituição social.');
    expect(sociologyInstitutionsPack.questions.find(({ id }) => id.endsWith('lockin-03'))?.correctAnswer)
      .toBe('A escola específica é uma organização; a educação pode ser analisada como instituição social mais ampla.');
    expect(sociologyInstitutionsPack.lesson.progression).toHaveLength(4);
    expect(sociologyInstitutionsPack.lesson.microExplanations).toHaveLength(6);
    expect(sociologyInstitutionsPack.lesson.remediations).toHaveLength(6);
    expect(sociologyInstitutionsPack.lesson.sourceDossier[0].license).toContain('CC BY 4.0');
    expect(sociologyInstitutionsPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(sociologyInstitutionsPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(sociologyInstitutionsPack.publicationStatus).toBe('STAGING');
  });

  it('compiles sociology institutions into inactive staging without changing student history', () => {
    expect(sociologyInstitutionsPack).toEqual(buildSociologyInstitutionsPack());
    expect(sociologyInstitutionsPack.contentVersion).toBe(6);
    expect(sociologyInstitutionsPack.lessonVersion).toBe(6);
    expect(sociologyInstitutionsMigration).toBe(buildMigration(sociologyInstitutionsPack));
    expect(sociologyInstitutionsMigration).toContain('version = 6');
    expect(sociologyInstitutionsMigration).toContain("'SOCIOLOGY_EXPLAIN_INSTITUTIONS'");
    expect(sociologyInstitutionsMigration).toContain("'v5-sociology-explain-institutions-wave3'");
    expect(sociologyInstitutionsMigration).toContain("'publication_status', 'STAGING'");
    expect(sociologyInstitutionsMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(sociologyInstitutionsMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(sociologyInstitutionsMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('records the Art visual-evidence audit without rewriting historical questions', () => {
    expect(artEditorialAudit.items).toHaveLength(21);
    expect(new Set(artEditorialAudit.items.map(({ questionId }) => questionId)).size).toBe(21);
    expect(artEditorialAudit.items.every(({ media }) => media === 'NOT_LINKED')).toBe(true);
    expect(artEditorialAudit.items.filter(({ sufficiency }) => sufficiency === 'TEXTUALLY_SUFFICIENT')).toHaveLength(18);
    expect(artEditorialAudit.items.filter(({ sufficiency }) => sufficiency === 'CONCEPTUAL_META_PROMPT')).toHaveLength(2);
    expect(artEditorialAudit.items.filter(({ sufficiency }) => sufficiency === 'INSUFFICIENT_VISUAL_EVIDENCE').map(({ questionId }) => questionId))
      .toEqual(['v4-authored-art-art_compare_compositions-transfer-05']);
    expect(artEditorialAudit.versionedCorrectionDraft).toMatchObject({
      replacesForFutureUse: 'v4-authored-art-art_compare_compositions-transfer-05',
      studentReady: false,
      oldQuestionAndHistoricalAttempts: 'PRESERVE_UNCHANGED',
    });
    expect(artEditorialAudit.versionedCorrectionDraft.options).toHaveLength(4);
    expect(artEditorialAudit.versionedCorrectionDraft.options).toContain(artEditorialAudit.versionedCorrectionDraft.answerKey);
    expect(artEditorialAudit.versionedCorrectionDraft.explanation).toContain('No cartaz A');
    expect(artEditorialAudit.versionedCorrectionDraft.requiredMedia.textOnlyPublicationAllowed).toBe(false);
    expect(artEditorialAudit.versionedCorrectionDraft.requiredMedia.assets).toHaveLength(2);
  });

  it('stages an evidence-complete Art replacement with original linked visuals and balanced questions', () => {
    const result = validateQuestionFirstPack(artCompositionPack);
    expect(artCompositionPack).toEqual(buildArtCompareCompositionsPack());
    expect(artCompositionPack.contentVersion).toBe(6);
    expect(artCompositionPack.lessonVersion).toBe(6);
    expect(result).toMatchObject({
      valid: true,
      questionCount: 8,
      contextCount: 8,
      counts: { PROBE: 2, PRACTICE: 2, TRANSFER: 2, LOCK_IN: 1, REVIEW: 1 },
      answerPositionCounts: { A: 2, B: 2, C: 2, D: 2 },
    });
    expect(artCompositionPack.sourceQuestionFeedback).toHaveLength(11);
    const replacement = artCompositionPack.questions.find(({ id }) => id.endsWith('transfer-contrast-05-v2'));
    expect(artEditorialAudit.versionedCorrectionDraft.newId).toBe(replacement.id);
    expect(replacement.visualStimulus.items).toHaveLength(2);
    expect(replacement.visualStimulus.items.every(({ alt, src }) => alt && src.startsWith('/learning/art/'))).toBe(true);
    expect(replacement.statement).toContain('diferenças visíveis');
    expect(replacement.explanation).toContain('No cartaz A');
    expect(artCompositionPack.publicationStatus).toBe('STAGING');
    expect(artCompositionPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(artCompositionPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(artCompositionPack.lesson.authenticActivities).toHaveLength(1);
    expect(['/learning/art/poster-contrast-a.svg', '/learning/art/poster-contrast-b.svg'].every((path) =>
      existsSync(new URL(`../../public${path}`, import.meta.url)))) .toBe(true);
    expect(artCompositionMigration).toBe(buildMigration(artCompositionPack));
    expect(artCompositionMigration).toContain('version = 6');
    expect(artCompositionMigration).toContain("'visual_stimulus'");
    expect(artCompositionMigration).toContain('"visualStimulus" jsonb');
    expect(artCompositionMigration).toContain('V5_VISUAL_STEP_PATCH_MISMATCH');
    expect(artCompositionMigration).toContain("'publication_status', 'STAGING'");
    expect(artCompositionMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|active\s*=\s*true/i);
  });

  it('expands Art interpretation from visual observation through evidence-based transfer', () => {
    const result = validateQuestionFirstPack(artInterpretPack);
    expect(artInterpretPack).toEqual(buildArtInterpretWorkPack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 24,
      contextCount: 24,
      counts: { PROBE: 4, PRACTICE: 9, TRANSFER: 5, LOCK_IN: 3, REVIEW: 3 },
      answerPositionCounts: { A: 6, B: 6, C: 6, D: 6 },
    });
    expect(artInterpretPack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(artInterpretPack.questions.filter(({ visualStimulus }) => visualStimulus)).toHaveLength(19);
    expect(artInterpretPack.questions.filter(({ visualStimulus }) => visualStimulus)
      .every(({ visualStimulus }) => visualStimulus.items.every(({ alt, src }) => alt.trim() && src.startsWith('/learning/art/')))).toBe(true);
    expect(artInterpretPack.sourceQuestionFeedback).toHaveLength(26);
    expect(artInterpretPack.sourceQuestionFeedback.some(({ questionId }) => questionId === 'v4-authored-art-art_compare_compositions-transfer-05')).toBe(false);
    expect(artInterpretPack.lesson.progression.map(({ stage }) => stage))
      .toEqual(['DIAGNOSTIC', 'PRACTICE', 'TRANSFER', 'CONSOLIDATION', 'REVIEW']);
    expect(artInterpretPack.lesson.microExplanations).toHaveLength(5);
    expect(artInterpretPack.lesson.remediations).toHaveLength(5);
    expect(artInterpretPack.lesson.remediations.some(({ id }) => id === 'ACCESSIBLE_DESCRIPTION')).toBe(true);
    expect(artInterpretPack.contentVersion).toBe(7);
    expect(artInterpretPack.lesson.authenticActivities).toHaveLength(1);
    expect(artInterpretPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(artInterpretPack.lesson.authenticActivities[0].privacyGuard).toContain('Não inclua rostos');
    expect(artInterpretPack.publicationStatus).toBe('STAGING');
    expect(artInterpretPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(artInterpretPack.officialMappingStatus).toBe('NOT_CLAIMED');
    for (const src of new Set(artInterpretPack.questions.flatMap(({ visualStimulus }) => visualStimulus?.items.map(({ src }) => src) ?? []))) {
      expect(existsSync(new URL(`../../public${src}`, import.meta.url))).toBe(true);
    }
    expect(artInterpretMigration).toBe(buildMigration(artInterpretPack));
    expect(artInterpretMigration).toContain("'ART_INTERPRET_WORK'");
    expect(artInterpretMigration).toContain("'publication_status', 'STAGING'");
    expect(artInterpretMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(artInterpretMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(artInterpretMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('excludes only the unsupported legacy poster question from future selection', () => {
    expect(artUnsupportedQuestionMigration).toContain("metadata->>'content_id' = 'v4-authored-art-art_compare_compositions-transfer-05'");
    expect(artUnsupportedQuestionMigration).toContain('set active = false');
    expect(artUnsupportedQuestionMigration).toContain("'future_selection_excluded', true");
    expect(artUnsupportedQuestionMigration).toContain("'replacement_content_id', 'v5-art-compare-compositions-transfer-contrast-05-v2'");
    expect(artUnsupportedQuestionMigration).toContain('ART_UNSUPPORTED_POSTER_QUESTION_STILL_SELECTABLE');
    expect(artUnsupportedQuestionMigration).not.toMatch(/delete\s+from|learning_guided_sessions|learning_guided_step_attempts|learning_student_skill_state/i);
    expect(guidedRuntimeSelectionMigration).toMatch(/join public\.learning_question_bank bank on bank\.id = item\.question_bank_id and bank\.active/i);
  });

  it('stages Art context questions with source limits, community care, and accessible evidence', () => {
    const result = validateQuestionFirstPack(artContextPack);
    expect(artContextPack).toEqual(buildArtRelateWorkContextPack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 24,
      contextCount: 24,
      counts: { PROBE: 4, PRACTICE: 9, TRANSFER: 5, LOCK_IN: 3, REVIEW: 3 },
      answerPositionCounts: { A: 6, B: 6, C: 6, D: 6 },
    });
    expect(artContextPack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(artContextPack.questions.filter(({ visualStimulus }) => visualStimulus)).toHaveLength(13);
    expect(artContextPack.questions.filter(({ visualStimulus }) => visualStimulus)
      .every(({ visualStimulus }) => visualStimulus.items.every(({ alt, src }) => alt.trim() && src.startsWith('/learning/art/')))).toBe(true);
    expect(artContextPack.sourceQuestionFeedback).toHaveLength(24);
    expect(artContextPack.lesson.microExplanations).toHaveLength(5);
    expect(artContextPack.lesson.remediations).toHaveLength(5);
    expect(artContextPack.contentVersion).toBe(7);
    expect(artContextPack.lesson.authenticActivities).toHaveLength(1);
    expect(artContextPack.lesson.authenticActivities[0].rubric).toHaveLength(3);
    expect(artContextPack.lesson.authenticActivities[0].privacyGuard).toContain('Não publique entrevistas');
    expect(artContextPack.questions.some(({ options, explanation }) => [...options, explanation].some((text) => text.includes('toda a comunidade')))).toBe(true);
    expect(artContextPack.publicationStatus).toBe('STAGING');
    expect(artContextPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(artContextPack.officialMappingStatus).toBe('NOT_CLAIMED');
    for (const src of new Set(artContextPack.questions.flatMap(({ visualStimulus }) => visualStimulus?.items.map(({ src }) => src) ?? []))) {
      expect(existsSync(new URL(`../../public${src}`, import.meta.url))).toBe(true);
    }
    expect(artContextMigration).toBe(buildMigration(artContextPack));
    expect(artContextMigration).toContain("'ART_RELATE_WORK_CONTEXT'");
    expect(artContextMigration).toContain("'publication_status', 'STAGING'");
    expect(artContextMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(artContextMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(artContextMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('expands table reading with safe filtering, comparisons, and bounded conclusions', () => {
    const result = validateQuestionFirstPack(computingTablePack);
    expect(computingTablePack).toEqual(buildComputingReadTableDataPack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 34,
      contextCount: 34,
      counts: { PROBE: 4, PRACTICE: 11, TRANSFER: 7, LOCK_IN: 4, REVIEW: 8 },
      answerPositionCounts: { A: 9, B: 9, C: 8, D: 8 },
    });
    expect(computingTablePack.sourceQuestionFeedback).toHaveLength(8);
    expect(computingTablePack.sourceReconciliation).toMatchObject({
      sourceQuestionCount: 8,
      feedbackAdded: 8,
      sourceReconciliationStatus: 'EXACT',
      newQuestions: 34,
      reusedQuestionsCountedAsNew: false,
    });
    expect(computingTablePack.sourceReconciliation.outOfScopeLegacyQuestionIds).toEqual([
      { id: 'v3-computing-computing_algorithms-10', reason: 'A pergunta aborda viés de recomendação algorítmica, não leitura de dados em tabela.' },
    ]);
    expect(computingTablePack.sourceQuestionFeedback.some(({ questionId }) => questionId === 'v3-computing-computing_algorithms-10')).toBe(false);
    expect(computingTablePack.questions.every(({ visualStimulus }) => !visualStimulus)).toBe(true);
    expect(computingTablePack.lesson.microExplanations).toHaveLength(6);
    expect(computingTablePack.lesson.remediations).toHaveLength(5);
    expect(computingTablePack.publicationStatus).toBe('STAGING');
    expect(computingTablePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(computingTablePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(computingTableMigration).toBe(buildMigration(computingTablePack));
    expect(computingTableMigration).toContain("'COMPUTING_READ_TABLE_DATA'");
    expect(computingTableMigration).toContain("'publication_status', 'STAGING'");
    expect(computingTableMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(computingTableMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(computingTableMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
    expect(computingMisclassifiedQuestionMigration).toContain("metadata->>'content_id' = 'v3-computing-computing_algorithms-10'");
    expect(computingMisclassifiedQuestionMigration).toContain('set active = false');
    expect(computingMisclassifiedQuestionMigration).toContain("'future_selection_exclusion_reason', 'OUT_OF_SCOPE_FOR_TABLE_READING'");
    expect(computingMisclassifiedQuestionMigration).not.toMatch(/delete\s+from|learning_guided_sessions|learning_guided_step_attempts|learning_student_skill_state/i);
  });

  it('deepens algorithm tracing from assignments to branches, loops, debugging, and test limits', () => {
    const result = validateQuestionFirstPack(computingTracePack);
    expect(computingTracePack).toEqual(buildComputingTraceAlgorithmPack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 38,
      contextCount: 38,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 5, REVIEW: 9 },
      answerPositionCounts: { A: 10, B: 10, C: 9, D: 9 },
    });
    expect(computingTracePack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(computingTracePack.sourceQuestionFeedback).toHaveLength(9);
    expect(computingTracePack.sourceReconciliation.adjacentLegacyItemsForEditorialReview).toHaveLength(3);
    expect(computingTracePack.questions.find(({ contextFamily }) => contextFamily === 'TRACE_TABLE')?.correctAnswer).toBe('(1, 1).');
    expect(computingTracePack.lesson.microExplanations).toHaveLength(6);
    expect(computingTracePack.lesson.remediations).toHaveLength(5);
    expect(computingTracePack.publicationStatus).toBe('STAGING');
    expect(computingTracePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(computingTracePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(computingTraceMigration).toBe(buildMigration(computingTracePack));
    expect(computingTraceMigration).toContain("'COMPUTING_TRACE_ALGORITHM'");
    expect(computingTraceMigration).toContain("'publication_status', 'STAGING'");
    expect(computingTraceMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(computingTraceMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(computingTraceMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('adds contextual English practice without ranking varieties or universalizing local usage', () => {
    const result = validateQuestionFirstPack(englishCulturePack);
    expect(englishCulturePack).toEqual(buildEnglishRelateLanguageCulturePack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 33,
      contextCount: 33,
      counts: { PROBE: 4, PRACTICE: 11, TRANSFER: 8, LOCK_IN: 3, REVIEW: 7 },
      answerPositionCounts: { A: 9, B: 8, C: 8, D: 8 },
    });
    expect(englishCulturePack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(englishCulturePack.sourceQuestionFeedback).toHaveLength(20);
    expect(englishCulturePack.sourceReconciliation).toMatchObject({
      sourceQuestionCount: 20,
      feedbackAdded: 20,
      sourceReconciliationStatus: 'EXACT',
      newQuestions: 33,
      reusedQuestionsCountedAsNew: false,
    });
    expect(englishCulturePack.questions.every(({ visualStimulus }) => !visualStimulus)).toBe(true);
    expect(englishCulturePack.lesson.microExplanations).toHaveLength(5);
    expect(englishCulturePack.lesson.remediations).toHaveLength(5);
    expect(englishCulturePack.questions.some(({ options, explanation }) => [...options, explanation].some((text) => /all communities|every English-speaking community/i.test(text)))).toBe(true);
    expect(englishCulturePack.publicationStatus).toBe('STAGING');
    expect(englishCulturePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(englishCulturePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(englishCultureMigration).toBe(buildMigration(englishCulturePack));
    expect(englishCultureMigration).toContain("'ENGLISH_RELATE_LANGUAGE_CULTURE'");
    expect(englishCultureMigration).toContain("'publication_status', 'STAGING'");
    expect(englishCultureMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(englishCultureMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(englishCultureMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('builds a progressive English context-vocabulary sequence with bounded inference', () => {
    const result = validateQuestionFirstPack(englishContextVocabularyPack);
    expect(englishContextVocabularyPack).toEqual(buildEnglishContextVocabularyPack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 29,
      contextCount: 29,
      counts: { PROBE: 4, PRACTICE: 10, TRANSFER: 5, LOCK_IN: 3, REVIEW: 7 },
      answerPositionCounts: { A: 8, B: 7, C: 7, D: 7 },
    });
    expect(englishContextVocabularyPack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(englishContextVocabularyPack.sourceQuestionFeedback).toHaveLength(22);
    expect(englishContextVocabularyPack.sourceReconciliation).toMatchObject({ sourceQuestionCount: 22, feedbackAdded: 22, sourceReconciliationStatus: 'EXACT', newQuestions: 29, reusedQuestionsCountedAsNew: false });
    expect(englishContextVocabularyPack.questions.every(({ visualStimulus }) => !visualStimulus)).toBe(true);
    expect(englishContextVocabularyPack.lesson.microExplanations).toHaveLength(5);
    expect(englishContextVocabularyPack.lesson.remediations).toHaveLength(5);
    expect(englishContextVocabularyPack.questions.some(({ contextFamily }) => contextFamily === 'SANCTION_CONTEXT')).toBe(true);
    expect(englishContextVocabularyPack.publicationStatus).toBe('STAGING');
    expect(englishContextVocabularyPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(englishContextVocabularyPack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(englishContextVocabularyMigration).toBe(buildMigration(englishContextVocabularyPack));
    expect(englishContextVocabularyMigration).toContain("'ENGLISH_USE_CONTEXT_VOCABULARY'");
    expect(englishContextVocabularyMigration).toContain("'publication_status', 'STAGING'");
    expect(englishContextVocabularyMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(englishContextVocabularyMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(englishContextVocabularyMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('stages climate-data interpretation with verified graph assets and accessible equivalents', () => {
    const result = validateQuestionFirstPack(geographyClimateDataPack);
    expect(geographyClimateDataPack).toEqual(buildGeographyClimateDataPack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 29,
      contextCount: 29,
      counts: { PROBE: 4, PRACTICE: 10, TRANSFER: 5, LOCK_IN: 3, REVIEW: 7 },
      answerPositionCounts: { A: 8, B: 7, C: 7, D: 7 },
    });
    expect(geographyClimateDataPack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(geographyClimateDataPack.questions.filter(({ visualStimulus }) => visualStimulus)).toHaveLength(4);
    expect(geographyClimateDataPack.questions.filter(({ visualStimulus }) => visualStimulus)
      .every(({ visualStimulus }) => visualStimulus.items.every(({ alt, src }) => alt.trim() && src.startsWith('/learning/geography/')))).toBe(true);
    expect(geographyClimateDataPack.sourceQuestionFeedback).toHaveLength(21);
    expect(geographyClimateDataPack.sourceReconciliation).toMatchObject({ sourceQuestionCount: 21, feedbackAdded: 21, sourceReconciliationStatus: 'EXACT', newQuestions: 29, reusedQuestionsCountedAsNew: false });
    expect(geographyClimateDataPack.lesson.microExplanations).toHaveLength(5);
    expect(geographyClimateDataPack.lesson.remediations).toHaveLength(5);
    expect(geographyClimateDataPack.questions.some(({ statement }) => /sem dados|ausente|lacuna/i.test(statement))).toBe(true);
    expect(geographyClimateDataPack.questions.some(({ statement }) => /causal|causa/i.test(statement))).toBe(true);
    expect(geographyClimateDataPack.publicationStatus).toBe('STAGING');
    expect(geographyClimateDataPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(geographyClimateDataPack.officialMappingStatus).toBe('NOT_CLAIMED');
    for (const src of new Set(geographyClimateDataPack.questions.flatMap(({ visualStimulus }) => visualStimulus?.items.map(({ src }) => src) ?? []))) {
      expect(existsSync(new URL(`../../public${src}`, import.meta.url))).toBe(true);
    }
    expect(geographyClimateDataMigration).toBe(buildMigration(geographyClimateDataPack));
    expect(geographyClimateDataMigration).toContain("'GEOGRAPHY_ANALYZE_CLIMATE_DATA'");
    expect(geographyClimateDataMigration).toContain("'publication_status', 'STAGING'");
    expect(geographyClimateDataMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(geographyClimateDataMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(geographyClimateDataMigration).toContain('"visualStimulus" jsonb');
    expect(geographyClimateDataMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('stages territory interpretation with a gradual question sequence and accessible original maps', () => {
    const result = validateQuestionFirstPack(geographyInterpretTerritoryPack);
    expect(geographyInterpretTerritoryPack).toEqual(buildGeographyInterpretTerritoryPack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 28,
      contextCount: 28,
      counts: { PROBE: 4, PRACTICE: 10, TRANSFER: 5, LOCK_IN: 3, REVIEW: 6 },
      answerPositionCounts: { A: 7, B: 7, C: 7, D: 7 },
    });
    expect(geographyInterpretTerritoryPack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(geographyInterpretTerritoryPack.questions.filter(({ visualStimulus }) => visualStimulus)).toHaveLength(9);
    expect(geographyInterpretTerritoryPack.questions.filter(({ visualStimulus }) => visualStimulus)
      .every(({ visualStimulus }) => visualStimulus.items.every(({ alt, src }) => alt.trim() && src.startsWith('/learning/geography/')))).toBe(true);
    expect(geographyInterpretTerritoryPack.sourceQuestionFeedback).toHaveLength(10);
    expect(geographyInterpretTerritoryPack.sourceReconciliation).toMatchObject({ sourceQuestionCount: 10, feedbackAdded: 10, sourceReconciliationStatus: 'EXACT', newQuestions: 28, reusedQuestionsCountedAsNew: false });
    expect(geographyInterpretTerritoryPack.lesson.microExplanations).toHaveLength(5);
    expect(geographyInterpretTerritoryPack.lesson.remediations).toHaveLength(5);
    expect(geographyInterpretTerritoryPack.questions.some(({ statement }) => /no recorte|no mapa|legenda/i.test(statement))).toBe(true);
    expect(geographyInterpretTerritoryPack.questions.some(({ statement, explanation }) => /causa|causal/i.test(`${statement} ${explanation}`))).toBe(true);
    expect(geographyInterpretTerritoryPack.publicationStatus).toBe('STAGING');
    expect(geographyInterpretTerritoryPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(geographyInterpretTerritoryPack.officialMappingStatus).toBe('NOT_CLAIMED');
    for (const src of new Set(geographyInterpretTerritoryPack.questions.flatMap(({ visualStimulus }) => visualStimulus?.items.map(({ src }) => src) ?? []))) {
      expect(existsSync(new URL(`../../public${src}`, import.meta.url))).toBe(true);
    }
    expect(geographyInterpretTerritoryMigration).toBe(buildMigration(geographyInterpretTerritoryPack));
    expect(geographyInterpretTerritoryMigration).toContain("'GEOGRAPHY_INTERPRET_TERRITORY'");
    expect(geographyInterpretTerritoryMigration).toContain("'publication_status', 'STAGING'");
    expect(geographyInterpretTerritoryMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(geographyInterpretTerritoryMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(geographyInterpretTerritoryMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('stages map-scale interpretation with exact source feedback and accessible diagrams', () => {
    const result = validateQuestionFirstPack(geographyMapScalePack);
    expect(geographyMapScalePack).toEqual(buildGeographyMapScalePack());
    expect(result).toMatchObject({
      valid: true,
      questionCount: 40,
      contextCount: 40,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 },
      answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    });
    expect(geographyMapScalePack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(geographyMapScalePack.questions.filter(({ visualStimulus }) => visualStimulus)).toHaveLength(12);
    expect(geographyMapScalePack.questions.filter(({ visualStimulus }) => visualStimulus)
      .every(({ visualStimulus }) => visualStimulus.items.every(({ alt, src }) => alt.trim() && src.startsWith('/learning/geography/')))).toBe(true);
    expect(geographyMapScalePack.sourceQuestionFeedback).toHaveLength(2);
    expect(geographyMapScalePack.sourceReconciliation).toMatchObject({ sourceQuestionCount: 2, feedbackAdded: 2, sourceReconciliationStatus: 'EXACT', newQuestions: 40, reusedQuestionsCountedAsNew: false });
    expect(geographyMapScalePack.lesson.microExplanations).toHaveLength(5);
    expect(geographyMapScalePack.lesson.remediations).toHaveLength(5);
    expect(geographyMapScalePack.publicationStatus).toBe('STAGING');
    expect(geographyMapScalePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(geographyMapScalePack.officialMappingStatus).toBe('NOT_CLAIMED');
    for (const src of new Set(geographyMapScalePack.questions.flatMap(({ visualStimulus }) => visualStimulus?.items.map(({ src }) => src) ?? []))) {
      const svg = readFileSync(new URL(`../../public${src}`, import.meta.url), 'utf8');
      expect(svg).toContain('<title');
      expect(svg).toContain('<desc');
    }
    expect(geographyMapScaleMigration).toBe(buildMigration(geographyMapScalePack));
    expect(geographyMapScaleMigration).toContain("'GEOGRAPHY_MAP_SCALE'");
    expect(geographyMapScaleMigration).toContain("'publication_status', 'STAGING'");
    expect(geographyMapScaleMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(geographyMapScaleMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(geographyMapScaleMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('deepens English inference using an exact V4 and V9 source set', () => {
    const result = validateQuestionFirstPack(englishInferencePack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(24);
    expect(result.contextCount).toBe(24);
    expect(result.counts).toEqual({ PROBE: 3, PRACTICE: 7, TRANSFER: 4, LOCK_IN: 3, REVIEW: 7 });
    expect(result.answerPositionCounts).toEqual({ A: 6, B: 6, C: 6, D: 6 });
    expect(englishInferencePack.sourceQuestionFeedback).toHaveLength(22);
    expect(englishInferencePack.lesson.microExplanations).toHaveLength(5);
    expect(englishInferencePack.lesson.remediations).toHaveLength(6);
    expect(englishInferencePack.lesson.sourceDossier[0].publisher).toBe('Ministério da Educação, Brasil');
    expect(englishInferencePack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(englishInferencePack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(englishInferencePack.publicationStatus).toBe('STAGING');
  });

  it('compiles English inference as inactive staging without student records', () => {
    expect(englishInferencePack).toEqual(buildEnglishInferencePack());
    expect(englishInferencePack.contentVersion).toBe(5);
    expect(englishInferencePack.lessonVersion).toBe(6);
    expect(englishInferenceMigration).toBe(buildMigration(englishInferencePack));
    expect(englishInferenceMigration).toContain("'ENGLISH_INFER_FROM_TEXT'");
    expect(englishInferenceMigration).toContain('v_skill_id, 6,');
    expect(englishInferenceMigration).toContain("'GLOBAL', v_skill_id, v_question.purpose, 5, false");
    expect(englishInferenceMigration).toContain('"source_question_feedback"');
    expect(englishInferenceMigration).toContain("'publication_status', 'STAGING'");
    expect(englishInferenceMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(englishInferenceMigration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(englishInferenceMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('requires authentic, accessible evidence for physical-education targets', () => {
    for (const [pack, migration, expectedSkill] of [
      [peDistinguishPack, peDistinguishMigration, 'PE_DISTINGUISH_ACTIVITY_EXERCISE_FII'],
      [peSafePlanPack, peSafePlanMigration, 'PE_PLAN_SAFE_ACTIVITY'],
    ]) {
      const result = validateQuestionFirstPack(pack);
      expect(result.valid).toBe(true);
      expect(result.questionCount).toBe(6);
      expect(result.contextCount).toBe(6);
      expect(result.counts).toEqual({ PROBE: 1, PRACTICE: 2, TRANSFER: 1, LOCK_IN: 1, REVIEW: 1 });
      expect(result.answerPositionCounts).toEqual({ A: 2, B: 2, C: 1, D: 1 });
      expect(pack.lesson.authenticActivities).toHaveLength(1);
      expect(pack.lesson.authenticActivities[0].rubric.length).toBeGreaterThanOrEqual(3);
      expect(pack.lesson.authenticActivities[0].privacyGuard).toContain('Não coletar');
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
      expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
      expect(pack.publicationStatus).toBe('STAGING');
      expect(migration).toBe(buildMigration(pack));
      expect(migration).toContain(`'${expectedSkill}'`);
      expect(migration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
      expect(migration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
    }
    expect(peDistinguishPack).toEqual(physicalEducationPacks.distinguish);
    expect(peSafePlanPack).toEqual(physicalEducationPacks.safePlan);
  });

  it('builds three staged physics sequences with accurate keys and error-sensitive explanations', () => {
    const packs = buildPhysicsMotionPacks();
    const migrations = [
      '20261015001700_bncc_interpret_acceleration_sequence_question_first_v5.sql',
      '20261015001800_bncc_relative_speed_sequence_question_first_v5.sql',
      '20261015001900_bncc_uniform_motion_sequence_question_first_v5.sql',
    ];
    expect(packs.map(({ canonicalSkillCode }) => canonicalSkillCode)).toEqual([
      'PHYSICS_INTERPRET_ACCELERATION', 'PHYSICS_RELATIVE_SPEED', 'PHYSICS_UNIFORM_MOTION',
    ]);
    for (const [index, pack] of packs.entries()) {
      const result = validateQuestionFirstPack(pack);
      const migrationText = readFileSync(new URL(`../../supabase/migrations/${migrations[index]}`, import.meta.url), 'utf8');
      expect(result).toMatchObject({
        valid: true,
        questionCount: 40,
        contextCount: 40,
        counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 },
        answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
      });
      expect(pack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
      expect(new Set(pack.questions.filter(({ purpose }) => purpose === 'TRANSFER').map(({ cognitiveProcess }) => cognitiveProcess)).size).toBeGreaterThanOrEqual(3);
      expect(pack.lesson.progression).toHaveLength(5);
      expect(pack.lesson.microExplanations).toHaveLength(6);
      expect(pack.lesson.remediations).toHaveLength(6);
      expect(pack.lesson.authenticActivities[0].privacyGuard).toBeTruthy();
      expect(pack.publicationStatus).toBe('STAGING');
      expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
      expect(migrationText).toBe(buildMigration(pack));
      expect(migrationText).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
    }
    const [acceleration, relative, uniform] = packs;
    expect(acceleration.questions[0].correctAnswer).toContain('2 m/s²');
    expect(acceleration.questions[3].correctAnswer).toContain('sentido negativo');
    expect(relative.questions[0].correctAnswer).toBe('6 km/h');
    expect(relative.questions[2].correctAnswer).toBe('126 km/h');
    expect(relative.questions[19].correctAnswer).toBe('2 h');
    expect(uniform.questions[0].correctAnswer).toContain('5 m/s');
    expect(uniform.questions[19].correctAnswer).toContain('não sustentam movimento uniforme');
    expect(uniform.questions[21].correctAnswer).toContain('sentido negativo');
    expect(uniform.questions[29].correctAnswer).toContain('Sim:');
    expect(uniform.questions[29].explanation).toContain('0 m/s');
  });

  it('builds a staged Portuguese source-comparison sequence with bounded claims and feedback', () => {
    const pack = buildPortugueseCompareSourcesPack();
    const result = validateQuestionFirstPack(pack);
    expect(pack).toEqual(portugueseCompareSourcesPack);
    expect(result).toMatchObject({
      valid: true,
      questionCount: 40,
      contextCount: 40,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 },
      answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    });
    expect(new Set(pack.questions.filter(({ purpose }) => purpose === 'TRANSFER').map(({ cognitiveProcess }) => cognitiveProcess)).size).toBeGreaterThanOrEqual(3);
    expect(pack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(pack.questions.every(({ statement, explanation, hint }) => statement.trim() && explanation.trim() && hint.trim())).toBe(true);
    expect(pack.questions.some(({ statement }) => /hoje|na terça|em maio|em 2020/i.test(statement))).toBe(true);
    expect(pack.lesson.microExplanations).toHaveLength(6);
    expect(pack.lesson.remediations).toHaveLength(6);
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.publicationStatus).toBe('STAGING');
    expect(portugueseCompareSourcesMigration).toBe(buildMigration(pack));
    expect(portugueseCompareSourcesMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(portugueseCompareSourcesMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('builds a staged Portuguese reasoning sequence that distinguishes claims from evidence', () => {
    const pack = buildPortugueseReasonEvidencePack();
    const result = validateQuestionFirstPack(pack);
    expect(pack).toEqual(portugueseReasonEvidencePack);
    expect(result).toMatchObject({
      valid: true,
      questionCount: 47,
      contextCount: 47,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 17 },
      answerPositionCounts: { A: 12, B: 12, C: 12, D: 11 },
    });
    expect(new Set(pack.questions.filter(({ purpose }) => purpose === 'TRANSFER').map(({ cognitiveProcess }) => cognitiveProcess)).size).toBeGreaterThanOrEqual(3);
    expect(pack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(pack.questions.every(({ statement, explanation, hint }) => statement.trim() && explanation.trim() && hint.trim())).toBe(true);
    expect(pack.lesson.microExplanations).toHaveLength(6);
    expect(pack.lesson.remediations).toHaveLength(6);
    expect(pack.sourceReconciliation).toMatchObject({ sourceQuestionCount: 2, newQuestions: 47, reusedQuestionsCountedAsNew: false });
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.publicationStatus).toBe('STAGING');
    expect(portugueseReasonEvidenceMigration).toBe(buildMigration(pack));
    expect(portugueseReasonEvidenceMigration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(portugueseReasonEvidenceMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('builds a staged counterargument sequence with gradual practice and fair, specific responses', () => {
    const pack = buildPortugueseCounterargumentPack();
    const result = validateQuestionFirstPack(pack);
    expect(pack).toEqual(portugueseCounterargumentPack);
    expect(result).toMatchObject({
      valid: true,
      questionCount: 43,
      contextCount: 43,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 13 },
      answerPositionCounts: { A: 11, B: 11, C: 11, D: 10 },
    });
    expect(new Set(pack.questions.map(({ contextFamily }) => contextFamily)).size).toBe(43);
    expect(new Set(pack.questions.filter(({ purpose }) => purpose === 'TRANSFER').map(({ cognitiveProcess }) => cognitiveProcess)).size).toBeGreaterThanOrEqual(3);
    expect(pack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(pack.questions.every(({ statement, explanation, hint }) => statement.trim() && explanation.trim() && hint.trim())).toBe(true);
    expect(pack.lesson.microExplanations).toHaveLength(6);
    expect(pack.lesson.remediations).toHaveLength(6);
    expect(pack.sourceReconciliation).toMatchObject({ newQuestions: 43, reusedQuestionsCountedAsNew: false });
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.publicationStatus).toBe('STAGING');
    expect(portugueseCounterargumentMigration).toBe(buildMigration(pack));
    expect(portugueseCounterargumentMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('builds a staged argument-summary sequence that preserves evidence scope and pending decisions', () => {
    const pack = buildPortugueseSummarizeArgumentPack();
    const result = validateQuestionFirstPack(pack);
    expect(pack).toEqual(portugueseSummarizeArgumentPack);
    expect(result).toMatchObject({
      valid: true,
      questionCount: 47,
      contextCount: 47,
      counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 17 },
      answerPositionCounts: { A: 12, B: 12, C: 12, D: 11 },
    });
    expect(new Set(pack.questions.map(({ contextFamily }) => contextFamily)).size).toBe(47);
    expect(pack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
    expect(pack.questions.every(({ statement, explanation, hint }) => statement.trim() && explanation.trim() && hint.trim())).toBe(true);
    expect(pack.questions.some(({ errorFocus }) => errorFocus === 'ASSOCIATION_AS_CAUSAL_PROOF')).toBe(true);
    expect(pack.lesson.microExplanations).toHaveLength(6);
    expect(pack.lesson.remediations).toHaveLength(6);
    expect(pack.sourceReconciliation).toMatchObject({ sourceQuestionCount: 1, newQuestions: 47, reusedQuestionsCountedAsNew: false });
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.publicationStatus).toBe('STAGING');
    expect(portugueseSummarizeArgumentMigration).toBe(buildMigration(pack));
    expect(portugueseSummarizeArgumentMigration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
  });

  it('builds the next five wave-two content gaps as balanced staged packs', () => {
    const packs = buildWave2ContentGapPacks();
    expect(Object.keys(packs)).toEqual([
      'HISTORY_INTERPRET_EVIDENCE',
      'HISTORY_INTERPRET_PERIODIZATION',
      'MATH_INTERPRET_DATA_TABLE',
      'MATH_PERCENT_OF_QUANTITY',
      'PE_ANALYZE_MOVEMENT',
    ]);
    for (const pack of Object.values(packs)) {
      const result = validateQuestionFirstPack(pack);
      expect(result).toMatchObject({
        valid: true,
        questionCount: 40,
        contextCount: 40,
        counts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 5, REVIEW: 11 },
        answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
      });
      expect(pack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
      expect(pack.questions.every(({ statement, explanation, hint }) => statement.trim() && explanation.trim() && hint.trim())).toBe(true);
      expect(pack.sourceReconciliation).toMatchObject({ newQuestions: 40, reusedQuestionsCountedAsNew: false });
      expect(pack.lesson.microExplanations.length).toBeGreaterThanOrEqual(4);
      expect(pack.lesson.remediations.length).toBeGreaterThanOrEqual(4);
      expect(pack.publicationStatus).toBe('STAGING');
      expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    }
  });

  it('builds the remaining wave-two gaps as balanced staged packs', () => {
    const packs = buildRemainingWave2ContentGapPacks();
    expect(Object.keys(packs)).toEqual([
      'PE_EXPLAIN_SPORT_PRINCIPLES',
      'PORTUGUESE_ARGUMENT_EVIDENCE',
      'PORTUGUESE_DISTINGUISH_FACT_OPINION',
      'PORTUGUESE_IDENTIFY_GENRE_PURPOSE',
      'RELIGIOUS_COMPARE_TRADITIONS',
      'RELIGIOUS_INTERPRET_SYMBOLS',
      'SCIENCE_EXPLAIN_MATTER_TRANSFORMATION',
      'SCIENCE_IDENTIFY_VARIABLES',
    ]);
    for (const definition of remainingWave2TargetDefinitions) {
      const pack = packs[definition.key];
      const migration = readFileSync(new URL(`../../supabase/migrations/${definition.migration}`, import.meta.url), 'utf8');
      const result = validateQuestionFirstPack(pack);
      const expectedCounts = definition.key === 'SCIENCE_IDENTIFY_VARIABLES'
        ? { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 }
        : { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 5, REVIEW: 11 };
      expect(result).toMatchObject({
        valid: true,
        questionCount: 40,
        contextCount: 40,
        counts: expectedCounts,
        answerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
      });
      expect(pack.questions.slice(0, 4).every(({ difficulty }) => difficulty === 'EASY')).toBe(true);
      expect(new Set(pack.questions.map(({ contextFamily }) => contextFamily)).size).toBe(40);
      expect(pack.questions.every(({ statement, explanation, hint }) => statement.trim() && explanation.trim() && hint.trim())).toBe(true);
      expect(pack.lesson.progression).toHaveLength(5);
      expect(pack.lesson.microExplanations.length).toBeGreaterThanOrEqual(4);
      expect(pack.lesson.remediations.length).toBeGreaterThanOrEqual(4);
      expect(pack.sourceReconciliation.reusedQuestionsCountedAsNew).toBe(false);
      expect(pack.publicationStatus).toBe('STAGING');
      expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
      expect(migration).toBe(buildMigration(pack));
      expect(migration).toContain(`'${definition.key}'`);
      expect(migration).toContain("'publication_status', 'STAGING'");
      expect(migration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
      expect(migration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
      expect(migration).not.toMatch(/learning_guided_sessions|learning_student_skill_state|student_answers|active\s*=\s*true/i);
    }
  });
});
