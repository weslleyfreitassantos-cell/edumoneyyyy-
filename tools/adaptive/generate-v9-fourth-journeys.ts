import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadV4Pack, validateV4Pack } from './compile-v4.ts';
import { readV9JourneyExpansionPack } from './generate-v9-journey-expansion-a.ts';

type Purpose = 'PROBE' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface Question {
  id: string;
  purpose: Purpose;
  difficulty: Difficulty;
  cognitiveProcess: string;
  contextFamily: string;
  statement: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface Remediation {
  id: string;
  difficulty: string;
  explanation: string;
  workedExample: string;
  selfCheck: string;
}

interface Lesson {
  title: string;
  objective: string;
  priorKnowledge: string[];
  keyConcepts: string[];
  progressiveExplanation: string[];
  workedExample: string;
  everydayApplication: string;
  commonErrors: string[];
  summary: string;
  practiceGuidance: string;
  estimatedMinutes: number;
  remediations: Remediation[];
}

interface Journey {
  subject: string;
  skill: string;
  skillTitle: string;
  skillDescription: string;
  domain: string;
  parent: string;
  journeyCode: string;
  title: string;
  unitCode: string;
  unitTitle: string;
  questionIdPrefix: string;
  lesson: Lesson;
  questions: Question[];
}

type CompactQuestion = [string, Difficulty, string, string, string[], number, string];
type RawJourney = Omit<Journey, 'questions'> & { questionRows: CompactQuestion[] };

interface Pack {
  contentVersion: string;
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING';
  mappingStatus: 'MAPPING_PENDING';
  publicationStatus: 'DEMO_PREVIEW';
  journeys: Journey[];
}

const ROOT = resolve(import.meta.dirname, '../..');
const PACK_PATH = resolve(ROOT, 'content/adaptive/tec-escola-core-v9/journey-expansion-d-v1.json');
const OUTPUT_PATH = resolve(ROOT, 'supabase/migrations/20261011000700_bncc_v9_4_fourth_journey_expansion_v1.sql');
const PURPOSES: Purpose[] = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const PURPOSE_COUNTS: Record<Purpose, number> = { PROBE: 2, PRACTICE: 8, TRANSFER: 4, LOCK_IN: 3, REVIEW: 3 };
const SUBJECTS = [
  'PORTUGUESE', 'MATHEMATICS', 'ENGLISH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY',
  'HISTORY', 'GEOGRAPHY', 'PHILOSOPHY', 'SOCIOLOGY', 'ART', 'PHYSICAL_EDUCATION',
] as const;
const EXPECTED_SKILLS: Record<(typeof SUBJECTS)[number], string> = {
  PORTUGUESE: 'PORTUGUESE_NARRATIVE_VOICE_V94',
  MATHEMATICS: 'MATHEMATICS_EQUATION_MODELING_V94',
  ENGLISH: 'ENGLISH_DIGITAL_COMMUNICATION_V94',
  PHYSICS: 'PHYSICS_WAVES_SOUND_V94',
  CHEMISTRY: 'CHEMISTRY_SOLUTION_CONCENTRATION_V94',
  BIOLOGY: 'BIOLOGY_ECOSYSTEM_INTERACTIONS_V94',
  HISTORY: 'HISTORY_SOCIAL_TRANSFORMATIONS_V94',
  GEOGRAPHY: 'GEOGRAPHY_CLIMATE_RISK_V94',
  PHILOSOPHY: 'PHILOSOPHY_LOGICAL_ARGUMENTS_V94',
  SOCIOLOGY: 'SOCIOLOGY_MEDIA_RELATIONS_V94',
  ART: 'ART_AUDIOVISUAL_LANGUAGE_V94',
  PHYSICAL_EDUCATION: 'PE_BODY_MEDIA_CULTURE_V94',
};
const PURPOSE_BY_POSITION: Purpose[] = [
  'PROBE', 'PROBE',
  ...Array<Purpose>(8).fill('PRACTICE'),
  ...Array<Purpose>(4).fill('TRANSFER'),
  ...Array<Purpose>(3).fill('LOCK_IN'),
  ...Array<Purpose>(3).fill('REVIEW'),
];

function readRawPack(): Omit<Pack, 'journeys'> & { journeys: RawJourney[] } {
  return JSON.parse(readFileSync(PACK_PATH, 'utf8')) as Omit<Pack, 'journeys'> & { journeys: RawJourney[] };
}

export function readV94FourthJourneyPack(): Pack {
  const raw = readRawPack();
  if (raw.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING'
      || raw.mappingStatus !== 'MAPPING_PENDING'
      || raw.publicationStatus !== 'DEMO_PREVIEW') {
    throw new Error('V94_CONTENT_REVIEW_AND_PREVIEW_STATES_MUST_REMAIN_PENDING');
  }
  const journeys = raw.journeys.map((journey) => {
    if (journey.questionRows.length !== 20 || !journey.questionIdPrefix) {
      throw new Error(`V94_COMPACT_QUESTION_ROWS_INVALID:${journey.skill}`);
    }
    return {
      ...journey,
      questions: journey.questionRows.map(([contextFamily, difficulty, cognitiveProcess, statement, options, correctIndex, explanation], index) => {
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
          throw new Error(`V94_ANSWER_INDEX_INVALID:${journey.skill}:${index + 1}`);
        }
        return {
          id: `${journey.questionIdPrefix}-${String(index + 1).padStart(2, '0')}`,
          purpose: PURPOSE_BY_POSITION[index],
          difficulty,
          cognitiveProcess,
          contextFamily,
          statement,
          options,
          correctAnswer: options[correctIndex],
          explanation,
        };
      }),
    };
  });
  return { ...raw, journeys };
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}\p{S}+\-]+/gu, ' ').trim();
}

function normalizeOption(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function stablePosition(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 4;
}

function balanceOptions(questions: Question[]): Map<string, string[]> {
  const counts = [0, 0, 0, 0];
  const result = new Map<string, string[]>();
  for (const question of questions) {
    const minimum = Math.min(...counts);
    const tied = counts.flatMap((count, index) => count === minimum ? [index] : []);
    const target = tied[stablePosition(question.id) % tied.length];
    const options = [...question.options];
    const correct = options.splice(options.indexOf(question.correctAnswer), 1)[0];
    options.splice(target, 0, correct);
    counts[target] += 1;
    result.set(question.id, options);
  }
  return result;
}

function lessonMarkdown(lesson: Lesson): string {
  return [
    `## Objetivo\n${lesson.objective}`,
    `## Conhecimentos prévios\n${lesson.priorKnowledge.map((item) => `- ${item}`).join('\n')}`,
    `## Conceitos fundamentais\n${lesson.keyConcepts.map((item) => `- ${item}`).join('\n')}`,
    `## Explicação passo a passo\n${lesson.progressiveExplanation.join('\n\n')}`,
    `## Aplicação\n${lesson.everydayApplication}`,
    `## Erros frequentes\n${lesson.commonErrors.map((item) => `- ${item}`).join('\n')}`,
    `## Resumo\n${lesson.summary}`,
    `## Para praticar\n${lesson.practiceGuidance}`,
    `## Reforços para dificuldades comuns\n${lesson.remediations.map((item) => `### ${item.id.replaceAll('_', ' ')}\n**Dificuldade:** ${item.difficulty}\n\n${item.explanation}\n\n**Exemplo:** ${item.workedExample}\n\n**Confira:** ${item.selfCheck}`).join('\n\n')}`,
  ].join('\n\n');
}

function existingQuestionData(): { ids: Set<string>; stems: Set<string>; skills: Set<string> } {
  const v4 = loadV4Pack();
  const packs = [1, 2, 3].map((version) => JSON.parse(readFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v9/question-expansion-v${version}.json`), 'utf8')) as { questions: Array<{ id: string; skill: string; statement: string }> });
  const originalQuestions = packs.flatMap((pack) => pack.questions);
  const journeyPack = readV9JourneyExpansionPack();
  const allQuestions = [
    ...v4.questions.map((question) => ({ id: question.id, statement: question.statement })),
    ...originalQuestions,
    ...journeyPack.journeys.flatMap((journey) => journey.questions),
  ];
  return {
    ids: new Set(allQuestions.map((question) => question.id)),
    stems: new Set(allQuestions.map((question) => normalize(question.statement))),
    skills: new Set([
      ...v4.anchors.map((skill) => skill.code),
      ...v4.leaves.map((skill) => skill.code),
      ...journeyPack.journeys.map((journey) => journey.skill),
      ...originalQuestions.map((question) => question.skill),
    ]),
  };
}

export function validateV94FourthJourneyPack(pack = readV94FourthJourneyPack()): string[] {
  const errors: string[] = [];
  const v4 = loadV4Pack();
  const v4Validation = validateV4Pack(v4);
  const existing = existingQuestionData();
  const seenSubjects = new Set<string>();
  const seenSkills = new Set<string>();
  const seenCodes = new Set<string>();
  const ids = new Set(existing.ids);
  const stems = new Set(existing.stems);
  const parents = new Set(v4.anchors.map((anchor) => anchor.code));

  if (!v4Validation.valid) errors.push('V4_SOURCE_PACKAGE_INVALID');
  if (pack.contentVersion !== 'tec-escola-core-v9.4-fourth-journey-expansion-v1') errors.push('V94_CONTENT_VERSION_INVALID');
  if (pack.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push('PEDAGOGICAL_REVIEW_STATUS_MUST_REMAIN_PENDING');
  if (pack.mappingStatus !== 'MAPPING_PENDING') errors.push('BNCC_MAPPING_MUST_REMAIN_PENDING');
  if (pack.publicationStatus !== 'DEMO_PREVIEW') errors.push('CONTENT_MUST_REMAIN_DEMO_PREVIEW');
  if (pack.journeys.length !== SUBJECTS.length) errors.push(`EXPECTED_${SUBJECTS.length}_JOURNEYS:${pack.journeys.length}`);

  for (const journey of pack.journeys) {
    if (!SUBJECTS.includes(journey.subject as (typeof SUBJECTS)[number])) errors.push(`UNKNOWN_SUBJECT:${journey.subject}`);
    if (seenSubjects.has(journey.subject)) errors.push(`DUPLICATED_SUBJECT:${journey.subject}`);
    seenSubjects.add(journey.subject);
    if (journey.skill !== EXPECTED_SKILLS[journey.subject as (typeof SUBJECTS)[number]]) errors.push(`UNEXPECTED_SKILL_FOR_SUBJECT:${journey.subject}:${journey.skill}`);
    if (existing.skills.has(journey.skill) || seenSkills.has(journey.skill)) errors.push(`DUPLICATED_OR_EXISTING_SKILL:${journey.skill}`);
    seenSkills.add(journey.skill);
    if (!parents.has(journey.parent)) errors.push(`UNKNOWN_V4_PARENT:${journey.skill}:${journey.parent}`);
    if (seenCodes.has(journey.journeyCode) || seenCodes.has(journey.unitCode)) errors.push(`DUPLICATED_JOURNEY_CODE:${journey.journeyCode}`);
    seenCodes.add(journey.journeyCode);
    seenCodes.add(journey.unitCode);
    if (!/^[a-z0-9-]+$/.test(journey.questionIdPrefix)) errors.push(`INVALID_QUESTION_ID_PREFIX:${journey.skill}`);
    if (!journey.title.trim() || !journey.unitTitle.trim() || journey.skillDescription.trim().length < 40) errors.push(`JOURNEY_IDENTITY_INCOMPLETE:${journey.skill}`);

    const lesson = journey.lesson;
    if (lesson.priorKnowledge.length < 2 || lesson.keyConcepts.length < 3 || lesson.progressiveExplanation.length < 3 || lesson.commonErrors.length < 3 || lesson.remediations.length !== 2) errors.push(`LESSON_STRUCTURE_INCOMPLETE:${journey.skill}`);
    if (lesson.workedExample.length < 220 || lesson.objective.length < 45 || !lesson.everydayApplication.trim() || !lesson.practiceGuidance.trim() || lesson.summary.length < 35) errors.push(`LESSON_TOO_SHALLOW:${journey.skill}`);
    if (lesson.remediations.some((item) => !item.id.trim() || !item.explanation.trim() || item.workedExample.length < 40 || !item.selfCheck.trim())) errors.push(`REMEDIATION_INCOMPLETE:${journey.skill}`);
    if (lesson.estimatedMinutes < 5 || lesson.estimatedMinutes > 120) errors.push(`LESSON_DURATION_INVALID:${journey.skill}`);
    if (journey.questions.length !== 20) errors.push(`EXPECTED_20_QUESTIONS:${journey.skill}:${journey.questions.length}`);

    for (const purpose of PURPOSES) {
      const count = journey.questions.filter((question) => question.purpose === purpose).length;
      if (count !== PURPOSE_COUNTS[purpose]) errors.push(`PURPOSE_COVERAGE:${journey.skill}:${purpose}:${count}`);
    }
    if (new Set(journey.questions.map((question) => question.contextFamily)).size < 8) errors.push(`CONTEXT_DIVERSITY:${journey.skill}`);

    for (const question of journey.questions) {
      if (ids.has(question.id)) errors.push(`DUPLICATED_QUESTION_ID:${question.id}`);
      ids.add(question.id);
      if (!question.statement.trim() || question.statement.length < 38 || question.explanation.length < 25) errors.push(`QUESTION_OR_EXPLANATION_TOO_SHALLOW:${question.id}`);
      if (!question.cognitiveProcess.trim() || !question.contextFamily.trim()) errors.push(`QUESTION_CLASSIFICATION_MISSING:${question.id}`);
      if (question.options.length !== 4 || new Set(question.options.map(normalizeOption)).size !== 4 || !question.options.includes(question.correctAnswer)) errors.push(`INVALID_OPTIONS_OR_ANSWER:${question.id}`);
      const normalizedStem = normalize(question.statement);
      if (stems.has(normalizedStem)) errors.push(`DUPLICATED_QUESTION_STEM:${question.id}`);
      stems.add(normalizedStem);
    }

    const positions = [0, 0, 0, 0];
    const balanced = balanceOptions(journey.questions);
    for (const question of journey.questions) positions[balanced.get(question.id)!.indexOf(question.correctAnswer)] += 1;
    if (Math.max(...positions) > 6) errors.push(`ANSWER_POSITION_BIAS:${journey.skill}:${positions.join(',')}`);
  }
  for (const subject of SUBJECTS) if (!seenSubjects.has(subject)) errors.push(`MISSING_SUBJECT:${subject}`);
  return errors;
}

function purposePosition(journey: Journey, question: Question): number {
  return journey.questions.filter((item) => item.purpose === question.purpose).indexOf(question);
}

function formatPayloadJson(value: unknown, depth = 0, path: string[] = []): string {
  const indent = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
      return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
    }
    const rows = value.map((item) => {
      const formatted = path.at(-1) === 'questions'
        ? JSON.stringify(item)
        : formatPayloadJson(item, depth + 1, path);
      return `${'  '.repeat(depth + 1)}${formatted}`;
    });
    return `[` + `\n${rows.join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const rows = entries.map(([key, item]) => `${'  '.repeat(depth + 1)}${JSON.stringify(key)}: ${formatPayloadJson(item, depth + 1, [...path, key])}`);
    return `{\n${rows.join(',\n')}\n${indent}}`;
  }
  const formatted = JSON.stringify(value);
  if (formatted === undefined) throw new Error('V94_PAYLOAD_VALUE_NOT_SERIALIZABLE');
  return formatted;
}

export function buildV94FourthJourneyMigration(pack = readV94FourthJourneyPack()): string {
  const errors = validateV94FourthJourneyPack(pack);
  if (errors.length) throw new Error(`V94_FOURTH_JOURNEYS_INVALID\n${errors.join('\n')}`);
  const payload = {
    contentVersion: pack.contentVersion,
    purposes: PURPOSES,
    purposeCounts: PURPOSE_COUNTS,
    journeys: pack.journeys.map((journey) => {
      const optionMap = balanceOptions(journey.questions);
      return {
        subject: journey.subject,
        skill: journey.skill,
        skillTitle: journey.skillTitle,
        skillDescription: journey.skillDescription,
        domain: journey.domain,
        parent: journey.parent,
        journeyCode: journey.journeyCode,
        title: journey.title,
        unitCode: journey.unitCode,
        unitTitle: journey.unitTitle,
        skillMetadata: {
          content_pack: 'tec-escola-core-v4',
          content_version: pack.contentVersion,
          content_authoring_status: 'AUTHORED',
          pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
          mapping_status: 'MAPPING_PENDING',
          demo_preview_only: true,
          recommended_stage: 'ENSINO_MEDIO',
          recommended_grade_from: 1,
          recommended_grade_to: 3,
          stage_references: [{ stage: 'ENSINO_MEDIO', from: 1, to: 3 }],
        },
        lesson: {
          ...journey.lesson,
          contentMarkdown: lessonMarkdown(journey.lesson),
          tips: [journey.lesson.practiceGuidance, ...journey.lesson.remediations.map((item) => item.selfCheck)],
          metadata: {
            content_pack: 'tec-escola-core-v4',
            content_version: pack.contentVersion,
            lesson_role: 'PRIMARY',
            objective: journey.lesson.objective,
            prior_knowledge: journey.lesson.priorKnowledge,
            key_concepts: journey.lesson.keyConcepts,
            progressive_explanation: journey.lesson.progressiveExplanation,
            everyday_application: journey.lesson.everydayApplication,
            common_errors: journey.lesson.commonErrors,
            practice_guidance: journey.lesson.practiceGuidance,
            remediations: journey.lesson.remediations,
            content_authoring_status: 'AUTHORED',
            pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
            demo_preview_only: true,
          },
        },
        questions: journey.questions.map((question) => ({
          ...question,
          options: optionMap.get(question.id),
          estimatedMinutes: 4,
          position: purposePosition(journey, question),
          metadata: {
            content_id: question.id,
            content_version: pack.contentVersion,
            primary_skill: journey.skill,
            purpose: question.purpose,
            difficulty: question.difficulty,
            cognitive_process: question.cognitiveProcess,
            context_family: question.contextFamily,
            error_focus: journey.lesson.commonErrors[0],
            remediation_hint: journey.lesson.practiceGuidance,
            content_authoring_status: 'AUTHORED',
            pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
            mapping_status: 'MAPPING_PENDING',
            demo_preview_only: true,
          },
        })),
      };
    }),
  };
  const payloadJson = formatPayloadJson(payload);
  if (payloadJson.includes('$v94_payload$')) throw new Error('V94_PAYLOAD_CONTAINS_SQL_DOLLAR_QUOTE');
  const payloadSql = `$v94_payload$\n${payloadJson}\n$v94_payload$::jsonb`;
  const lines = [
    'begin;',
    'reset role;',
    `-- CONTENT_VERSION=${pack.contentVersion}`,
    '-- Fourth journeys are demonstration-only; BNCC mapping and pedagogical review remain pending.',
    'do $v94_fourth_journeys$',
    `declare v_payload jsonb := ${payloadSql}; v_catalog_id uuid; v_subject_id uuid; v_parent_id uuid; v_skill_id uuid; v_lesson_id uuid; v_journey_id uuid; v_set_id uuid; v_question_id uuid; v_count integer; v_purpose_count integer; v_expected_count integer; v_purpose text; v_journey jsonb; v_lesson jsonb; v_question jsonb;`,
    'begin',
    "  if to_regclass('supabase_migrations.schema_migrations') is null then raise exception 'V94_MIGRATION_LEDGER_MISSING'; end if;",
    "  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261011000500') or not exists(select 1 from supabase_migrations.schema_migrations where version='20261011000600') then raise exception 'V94_REQUIRES_MIGRATIONS_00500_AND_00600'; end if;",
    "  if exists(select 1 from supabase_migrations.schema_migrations where version='20261011000700') then raise exception 'V94_MIGRATION_ALREADY_RECORDED'; end if;",
    "  select id into v_catalog_id from public.learning_curriculum_catalogs where code='TECESCOLA_CORE' and version='1.0' and active limit 1;",
    "  if v_catalog_id is null then raise exception 'TECESCOLA_CORE_CATALOG_MISSING'; end if;",
  ];

  lines.push('  for v_journey in select value from jsonb_array_elements(v_payload->\'journeys\') loop');
  lines.push("    select id into v_subject_id from public.learning_canonical_subjects where code=v_journey->>'subject' and active;");
  lines.push("    if v_subject_id is null then raise exception 'V94_CANONICAL_SUBJECT_MISSING:%',v_journey->>'subject'; end if;");
  lines.push("    select id into v_parent_id from public.learning_curriculum_skills where catalog_id=v_catalog_id and code=v_journey->>'parent' and active and node_kind='ANCHOR';");
  lines.push("    if v_parent_id is null then raise exception 'V94_PARENT_ANCHOR_MISSING:%',v_journey->>'parent'; end if;");
  lines.push("    insert into public.learning_curriculum_skills(catalog_id,code,stage,grade_level,subject_area,domain,title,description,active,node_kind,content_readiness,mastery_targetable,pedagogical_review_status,bncc_alignment_status,publication_status,canonical_subject_id,parent_canonical_skill_id,metadata) values(v_catalog_id,v_journey->>'skill','ENSINO_MEDIO',1,v_journey->>'subject',v_journey->>'domain',v_journey->>'skillTitle',v_journey->>'skillDescription',true,'LEAF','ADAPTIVE_READY',true,'PEDAGOGICAL_REVIEW_PENDING','CANDIDATE','STAGING',v_subject_id,v_parent_id,v_journey->'skillMetadata') on conflict(catalog_id,code) do nothing returning id into v_skill_id;");
  lines.push("    if v_skill_id is null then select id into v_skill_id from public.learning_curriculum_skills where catalog_id=v_catalog_id and code=v_journey->>'skill' and stage='ENSINO_MEDIO' and grade_level=1 and subject_area=v_journey->>'subject' and domain=v_journey->>'domain' and node_kind='LEAF' and content_readiness='ADAPTIVE_READY' and mastery_targetable and pedagogical_review_status='PEDAGOGICAL_REVIEW_PENDING' and bncc_alignment_status='CANDIDATE' and publication_status='STAGING' and canonical_subject_id=v_subject_id and parent_canonical_skill_id=v_parent_id and metadata->>'content_version'=v_payload->>'contentVersion' and metadata->>'demo_preview_only'='true'; end if;");
  lines.push("    if v_skill_id is null then raise exception 'V94_SKILL_IDEMPOTENCY_MISMATCH:%',v_journey->>'skill'; end if;");
  lines.push('    insert into public.learning_skill_hierarchy(parent_skill_id,child_skill_id) values(v_parent_id,v_skill_id) on conflict(parent_skill_id,child_skill_id) do nothing;');
  lines.push("    v_lesson := v_journey->'lesson';");
  lines.push("    insert into public.learning_skill_lessons(canonical_skill_id,version,title,summary,content_markdown,worked_example,tips,estimated_minutes,metadata,active) values(v_skill_id,4,v_lesson->>'title',v_lesson->>'summary',v_lesson->>'contentMarkdown',v_lesson->>'workedExample',array(select jsonb_array_elements_text(v_lesson->'tips')),(v_lesson->>'estimatedMinutes')::integer,v_lesson->'metadata',true) on conflict(canonical_skill_id,version) do nothing returning id into v_lesson_id;");
  lines.push("    if v_lesson_id is null then select id into v_lesson_id from public.learning_skill_lessons where canonical_skill_id=v_skill_id and version=4 and active and title=v_lesson->>'title' and summary=v_lesson->>'summary' and content_markdown=v_lesson->>'contentMarkdown' and worked_example=v_lesson->>'workedExample' and tips=array(select jsonb_array_elements_text(v_lesson->'tips')) and estimated_minutes=(v_lesson->>'estimatedMinutes')::integer and metadata->>'content_version'=v_payload->>'contentVersion' and metadata->>'demo_preview_only'='true'; end if;");
  lines.push("    if v_lesson_id is null then raise exception 'V94_LESSON_IDEMPOTENCY_MISMATCH:%',v_journey->>'skill'; end if;");
  lines.push("    for v_purpose in select jsonb_array_elements_text(v_payload->'purposes') loop");
  lines.push("      insert into public.learning_question_sets(scope,canonical_skill_id,purpose,version,metadata) values('GLOBAL',v_skill_id,v_purpose,4,jsonb_build_object('content_pack','tec-escola-core-v4','content_version',v_payload->>'contentVersion','selection_policy','SERVER_SELECTED_V1','demo_preview_only',true,'pedagogical_review_status','PEDAGOGICAL_REVIEW_PENDING','mapping_status','MAPPING_PENDING')) on conflict(canonical_skill_id,purpose,version) where scope='GLOBAL' do nothing;");
  lines.push("      if not exists(select 1 from public.learning_question_sets where scope='GLOBAL' and canonical_skill_id=v_skill_id and purpose=v_purpose and version=4 and active and metadata->>'content_version'=v_payload->>'contentVersion' and metadata->>'demo_preview_only'='true' and metadata->>'pedagogical_review_status'='PEDAGOGICAL_REVIEW_PENDING') then raise exception 'V94_QUESTION_SET_IDEMPOTENCY_MISMATCH:%:%',v_journey->>'skill',v_purpose; end if;");
  lines.push('    end loop;');
  lines.push("    insert into public.learning_bncc_discipline_journeys(journey_code,canonical_subject_id,execution_skill_id,unit_code,unit_title,title,suggested_stage,suggested_grade,publication_status,mapping_status,pedagogical_review_status,content_version,metadata) values(v_journey->>'journeyCode',v_subject_id,v_skill_id,v_journey->>'unitCode',v_journey->>'unitTitle',v_journey->>'title','ENSINO_MEDIO',1,'DEMO_PREVIEW','MAPPING_PENDING','PEDAGOGICAL_REVIEW_PENDING',v_payload->>'contentVersion',jsonb_build_object('source_pack',v_payload->>'contentVersion','skill_code',v_journey->>'skill','parent_anchor',v_journey->>'parent','learning_role','INTRODUCTORY_CONTENT','mapping_status','MAPPING_PENDING','pedagogical_review_status','PEDAGOGICAL_REVIEW_PENDING','demonstration_only',true)) on conflict(journey_code) do nothing returning id into v_journey_id;");
  lines.push("    if v_journey_id is null then select id into v_journey_id from public.learning_bncc_discipline_journeys where journey_code=v_journey->>'journeyCode' and canonical_subject_id=v_subject_id and execution_skill_id=v_skill_id and unit_code=v_journey->>'unitCode' and title=v_journey->>'title' and suggested_stage='ENSINO_MEDIO' and suggested_grade=1 and publication_status='DEMO_PREVIEW' and mapping_status='MAPPING_PENDING' and pedagogical_review_status='PEDAGOGICAL_REVIEW_PENDING' and content_version=v_payload->>'contentVersion' and active; end if;");
  lines.push("    if v_journey_id is null then raise exception 'V94_JOURNEY_IDEMPOTENCY_MISMATCH:%',v_journey->>'skill'; end if;");
  lines.push("    for v_question in select value from jsonb_array_elements(v_journey->'questions') loop");
  lines.push("      insert into public.learning_question_bank(package_type,source_type,source_name,subject_area,domain,topic,statement,options,correct_answer,explanation,difficulty,estimated_minutes,provenance,metadata,active) select 'TECESCOLA','TECESCOLA_V9_AUTHORED_V1','TecEscola V9.4 fourth journey expansion',v_journey->>'subject',v_journey->>'domain',v_question->>'contextFamily',v_question->>'statement',v_question->'options',v_question->'correctAnswer',v_question->>'explanation',v_question->>'difficulty',(v_question->>'estimatedMinutes')::integer,'TECESCOLA_V9_AUTHORIAL_V1',v_question->'metadata',true where not exists(select 1 from public.learning_question_bank existing where existing.source_type='TECESCOLA_V9_AUTHORED_V1' and existing.metadata->>'content_id'=v_question->>'id') returning id into v_question_id;");
  lines.push("      if v_question_id is null then select id into v_question_id from public.learning_question_bank where source_type='TECESCOLA_V9_AUTHORED_V1' and source_name='TecEscola V9.4 fourth journey expansion' and subject_area=v_journey->>'subject' and domain=v_journey->>'domain' and topic=v_question->>'contextFamily' and statement=v_question->>'statement' and options=v_question->'options' and correct_answer=v_question->'correctAnswer' and explanation=v_question->>'explanation' and difficulty=v_question->>'difficulty' and estimated_minutes=(v_question->>'estimatedMinutes')::integer and provenance='TECESCOLA_V9_AUTHORIAL_V1' and metadata=v_question->'metadata' and metadata->>'content_id'=v_question->>'id' and active; end if;");
  lines.push("      if v_question_id is null then raise exception 'V94_QUESTION_IDEMPOTENCY_MISMATCH:%',v_question->>'id'; end if;");
  lines.push("      insert into public.learning_question_bank_skill_links(question_bank_id,canonical_skill_id,skill_role) values(v_question_id,v_skill_id,'PRIMARY') on conflict(question_bank_id,canonical_skill_id) do nothing;");
  lines.push("      if not exists(select 1 from public.learning_question_bank_skill_links where question_bank_id=v_question_id and canonical_skill_id=v_skill_id and skill_role='PRIMARY') then raise exception 'V94_QUESTION_SKILL_LINK_MISSING:%',v_question->>'id'; end if;");
  lines.push("      select id into v_set_id from public.learning_question_sets where scope='GLOBAL' and canonical_skill_id=v_skill_id and purpose=v_question->>'purpose' and version=4 and active;");
  lines.push("      insert into public.learning_question_set_items(question_set_id,question_bank_id,position) values(v_set_id,v_question_id,(v_question->>'position')::integer) on conflict(question_set_id,question_bank_id) do nothing;");
  lines.push('    end loop;');
  lines.push("    select count(distinct item.question_bank_id)::integer into v_count from public.learning_question_sets set_row join public.learning_question_set_items item on item.question_set_id=set_row.id join public.learning_question_bank bank on bank.id=item.question_bank_id and bank.active where set_row.scope='GLOBAL' and set_row.canonical_skill_id=v_skill_id and set_row.version=4 and set_row.active and bank.metadata->>'content_version'=v_payload->>'contentVersion';");
  lines.push("    if v_count<>20 then raise exception 'V94_QUESTION_POOL_INCOMPLETE:%',v_journey->>'skill'; end if;");
  lines.push("    for v_purpose in select jsonb_array_elements_text(v_payload->'purposes') loop");
  lines.push("      select (v_payload->'purposeCounts'->>v_purpose)::integer into v_expected_count;");
  lines.push("      select count(distinct item.question_bank_id)::integer into v_purpose_count from public.learning_question_sets set_row join public.learning_question_set_items item on item.question_set_id=set_row.id join public.learning_question_bank bank on bank.id=item.question_bank_id and bank.active where set_row.scope='GLOBAL' and set_row.canonical_skill_id=v_skill_id and set_row.version=4 and set_row.active and set_row.purpose=v_purpose and bank.metadata->>'content_version'=v_payload->>'contentVersion';");
  lines.push("      if v_purpose_count<>v_expected_count then raise exception 'V94_PURPOSE_POOL_INCOMPLETE:%:%',v_journey->>'skill',v_purpose; end if;");
  lines.push('    end loop;');
  lines.push("    if not exists(select 1 from public.learning_bncc_discipline_journeys where id=v_journey_id and publication_status='DEMO_PREVIEW' and mapping_status='MAPPING_PENDING' and pedagogical_review_status='PEDAGOGICAL_REVIEW_PENDING') then raise exception 'V94_REVIEW_STATE_INVALID:%',v_journey->>'skill'; end if;");
  lines.push('  end loop;');

  lines.push(
    "  notify pgrst, 'reload schema';",
    'end $v94_fourth_journeys$;',
    'commit;',
    '',
  );
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('generate-v9-fourth-journeys.ts')) {
  const mode = process.argv[2] ?? 'compile';
  if (mode === 'validate') {
    const errors = validateV94FourthJourneyPack();
    if (errors.length) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ journeys: SUBJECTS.length, questions: SUBJECTS.length * 20, publication: 'DEMO_PREVIEW', mapping: 'MAPPING_PENDING', review: 'PEDAGOGICAL_REVIEW_PENDING' }));
    }
  } else {
    const outputPath = resolve(mode === 'compile' ? (process.argv[3] ?? OUTPUT_PATH) : mode);
    writeFileSync(outputPath, buildV94FourthJourneyMigration());
    console.log(JSON.stringify({ outputPath, journeys: SUBJECTS.length, questions: SUBJECTS.length * 20 }));
  }
}
