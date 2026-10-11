import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadV4Pack, validateV4Pack } from './compile-v4.ts';

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
  errorFocus?: string;
  remediationHint?: string;
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
  skill: string;
  journeyCode: string;
  title: string;
  unitCode: string;
  unitTitle: string;
  lesson: Lesson;
  questions: Question[];
}

interface Pack {
  contentVersion: string;
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING';
  journeys: Journey[];
}

type CompactQuestion = [string, Difficulty, string, string, string[], number, string];
type PackJourney = Omit<Journey, 'questions'> & {
  questions?: Question[];
  questionRows?: CompactQuestion[];
  questionIdPrefix?: string;
};

const ROOT = resolve(import.meta.dirname, '../..');
const PACK_PATHS = ['a', 'b', 'c'].map((batch) => resolve(ROOT, `content/adaptive/tec-escola-core-v9/journey-expansion-${batch}-v1.json`));
const OUTPUT_PATH = resolve(ROOT, 'supabase/migrations/20261011000600_bncc_v9_journey_expansion_v1.sql');
const PURPOSES: Purpose[] = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const EXPECTED_SKILLS = [
  'PORTUGUESE_IDENTIFY_GENRE_PURPOSE',
  'PORTUGUESE_DISTINGUISH_FACT_OPINION',
  'MATH_INTERPRET_DATA_TABLE',
  'MATH_SUCCESSIVE_PERCENT_CHANGE',
  'ENGLISH_USE_CONTEXT_VOCABULARY',
  'ENGLISH_RELATE_LANGUAGE_CULTURE',
  'PHYSICS_INTERPRET_MOTION_GRAPH',
  'PHYSICS_UNIT_CONVERSION',
  'CHEMISTRY_ATOMIC_STRUCTURE',
  'CHEMISTRY_REACTION_EVIDENCE',
  'BIOLOGY_EXPLAIN_INHERITANCE',
  'BIOLOGY_INTERPRET_POPULATION_DATA',
  'HISTORY_INTERPRET_PERIODIZATION',
  'HISTORY_COMPARE_PERSPECTIVES',
  'GEOGRAPHY_MAP_SCALE',
  'GEOGRAPHY_ANALYZE_CLIMATE_DATA',
  'PHILOSOPHY_APPLY_ETHICAL_PRINCIPLE',
  'PHILOSOPHY_DISTINGUISH_CONCEPT',
  'SOCIOLOGY_ANALYZE_INEQUALITY_DATA',
  'SOCIOLOGY_DISTINGUISH_NORM_VALUE',
  'ART_INTERPRET_WORK',
  'ART_RELATE_WORK_CONTEXT',
  'PE_EXPLAIN_SPORT_PRINCIPLES',
  'PE_PLAN_SAFE_ACTIVITY',
];
const CANONICAL_SUBJECT: Record<string, string> = {
  PORTUGUESE: 'PORTUGUESE',
  MATHEMATICS: 'MATHEMATICS',
  ENGLISH: 'ENGLISH',
  PHYSICS: 'PHYSICS',
  CHEMISTRY: 'CHEMISTRY',
  BIOLOGY: 'BIOLOGY',
  HISTORY: 'HISTORY',
  GEOGRAPHY: 'GEOGRAPHY',
  PHILOSOPHY: 'PHILOSOPHY',
  SOCIOLOGY: 'SOCIOLOGY',
  ART: 'ART',
  PHYSICAL_EDUCATION: 'PHYSICAL_EDUCATION',
};
const PURPOSE_COUNTS: Record<Purpose, number> = { PROBE: 2, PRACTICE: 8, TRANSFER: 4, LOCK_IN: 3, REVIEW: 3 };

export function readV9JourneyExpansionPack(): Pack {
  const packs = PACK_PATHS.map((path) => JSON.parse(readFileSync(path, 'utf8')) as Omit<Pack, 'journeys'> & { journeys: PackJourney[] });
  if (packs.some((pack) => pack.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING')) {
    throw new Error('V9_JOURNEY_REVIEW_STATUS_MUST_REMAIN_PENDING');
  }
  const purposeByPosition: Purpose[] = [
    'PROBE', 'PROBE',
    ...Array<Purpose>(8).fill('PRACTICE'),
    ...Array<Purpose>(4).fill('TRANSFER'),
    ...Array<Purpose>(3).fill('LOCK_IN'),
    ...Array<Purpose>(3).fill('REVIEW'),
  ];
  const journeys = packs.flatMap((pack) => pack.journeys.map((journey) => {
    if (!journey.questionRows) return journey as Journey;
    if (!journey.questionIdPrefix || journey.questionRows.length !== 20) throw new Error(`INVALID_COMPACT_QUESTION_ROWS:${journey.skill}`);
    return {
      ...journey,
      questions: journey.questionRows.map(([contextFamily, difficulty, cognitiveProcess, statement, options, correctIndex, explanation], index) => ({
        id: `${journey.questionIdPrefix}-${String(index + 1).padStart(2, '0')}`,
        purpose: purposeByPosition[index],
        difficulty,
        cognitiveProcess,
        contextFamily,
        statement,
        options,
        correctAnswer: options[correctIndex],
        explanation,
      })),
    };
  }));
  return {
    contentVersion: 'tec-escola-core-v9.3-journey-expansion-v1',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    journeys,
  };
}

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function jsonSql(value: unknown): string {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function sqlArray(values: string[]): string {
  return `array[${values.map(sql).join(',')}]::text[]`;
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

export function validateV9JourneyExpansion(pack = readV9JourneyExpansionPack()): string[] {
  const errors: string[] = [];
  const v4 = loadV4Pack();
  const v4Validation = validateV4Pack(v4);
  const skills = new Map(v4.leaves.map((leaf) => [leaf.code, leaf]));
  const ids = new Set<string>();
  const stems = new Set<string>();
  const oldPacks = [1, 2, 3].map((version) => JSON.parse(readFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v9/question-expansion-v${version}.json`), 'utf8')) as { questions: Question[] });
  for (const oldQuestion of oldPacks.flatMap((item) => item.questions)) {
    ids.add(oldQuestion.id);
    stems.add(normalize(oldQuestion.statement));
  }
  for (const oldQuestion of v4.questions) {
    ids.add(oldQuestion.id);
    stems.add(normalize(oldQuestion.statement));
  }
  const seenSkills = new Set<string>();

  if (!v4Validation.valid) errors.push('V4_SOURCE_PACKAGE_INVALID');
  if (pack.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push('PEDAGOGICAL_REVIEW_STATUS_MUST_REMAIN_PENDING');
  if (pack.journeys.length !== EXPECTED_SKILLS.length) errors.push(`EXPECTED_${EXPECTED_SKILLS.length}_JOURNEYS:${pack.journeys.length}`);

  for (const journey of pack.journeys) {
    const skill = skills.get(journey.skill);
    if (!skill || !CANONICAL_SUBJECT[skill.subject]) errors.push(`UNKNOWN_OR_UNSUPPORTED_SKILL:${journey.skill}`);
    if (seenSkills.has(journey.skill)) errors.push(`DUPLICATED_JOURNEY_SKILL:${journey.skill}`);
    seenSkills.add(journey.skill);
    if (!/^[A-Z0-9_]+$/.test(journey.journeyCode) || !journey.title.trim() || !journey.unitTitle.trim()) errors.push(`INVALID_JOURNEY_IDENTITY:${journey.skill}`);
    const lesson = journey.lesson;
    if (lesson.priorKnowledge.length < 2 || lesson.keyConcepts.length < 3 || lesson.progressiveExplanation.length < 3 || lesson.commonErrors.length < 3 || lesson.remediations.length !== 2) errors.push(`LESSON_STRUCTURE_INCOMPLETE:${journey.skill}`);
    if (lesson.workedExample.length < 220 || lesson.objective.length < 45 || !lesson.everydayApplication.trim() || !lesson.practiceGuidance.trim() || !lesson.summary.trim()) errors.push(`LESSON_TOO_SHALLOW:${journey.skill}`);
    if (lesson.remediations.some((item) => !item.explanation.trim() || !item.workedExample.trim() || !item.selfCheck.trim())) errors.push(`REMEDIATION_INCOMPLETE:${journey.skill}`);
    if (journey.questions.length !== 20) errors.push(`EXPECTED_20_QUESTIONS:${journey.skill}:${journey.questions.length}`);
    for (const purpose of PURPOSES) {
      const count = journey.questions.filter((question) => question.purpose === purpose).length;
      if (count !== PURPOSE_COUNTS[purpose]) errors.push(`PURPOSE_COVERAGE:${journey.skill}:${purpose}:${count}`);
    }
    if (new Set(journey.questions.map((question) => question.contextFamily)).size < 8) errors.push(`CONTEXT_DIVERSITY:${journey.skill}`);
    for (const question of journey.questions) {
      if (ids.has(question.id)) errors.push(`DUPLICATED_QUESTION_ID:${question.id}`);
      ids.add(question.id);
      if (!question.statement.trim() || !question.explanation.trim() || !(question.errorFocus ?? lesson.commonErrors[0])?.trim() || !(question.remediationHint ?? lesson.practiceGuidance)?.trim()) errors.push(`MISSING_PEDAGOGICAL_FIELD:${question.id}`);
      if (question.options.length !== 4 || new Set(question.options.map(normalizeOption)).size !== 4 || !question.options.includes(question.correctAnswer)) errors.push(`INVALID_OPTIONS_OR_ANSWER:${question.id}`);
      if (stems.has(normalize(question.statement))) errors.push(`DUPLICATED_QUESTION_STEM:${question.id}`);
      stems.add(normalize(question.statement));
    }
    const counts = [0, 0, 0, 0];
    const ordered = balanceOptions(journey.questions);
    for (const question of journey.questions) counts[ordered.get(question.id)!.indexOf(question.correctAnswer)] += 1;
    if (Math.max(...counts) > 6) errors.push(`ANSWER_POSITION_BIAS:${journey.skill}:${counts.join(',')}`);
  }
  for (const skill of EXPECTED_SKILLS) if (!seenSkills.has(skill)) errors.push(`MISSING_PRIORITY_SKILL:${skill}`);
  return errors;
}

export function buildV9JourneyExpansionMigration(pack = readV9JourneyExpansionPack()): string {
  const errors = validateV9JourneyExpansion(pack);
  if (errors.length) throw new Error(`V9_JOURNEY_EXPANSION_INVALID\n${errors.join('\n')}`);
  const v4 = loadV4Pack();
  const skillByCode = new Map(v4.leaves.map((leaf) => [leaf.code, leaf]));
  const lines = [
    'begin;',
    'reset role;',
    `-- CONTENT_VERSION=${pack.contentVersion}`,
    '-- New authored journeys are demo-only; BNCC mapping and pedagogical review remain pending.',
    'do $v9_journey_expansion$',
    'declare v_catalog_id uuid; v_subject_id uuid; v_parent_id uuid; v_skill_id uuid; v_lesson_id uuid; v_journey_id uuid; v_set_id uuid; v_question_id uuid; v_count integer;',
    'begin',
    "  select id into v_catalog_id from public.learning_curriculum_catalogs where code='TECESCOLA_CORE' and version='1.0' and active limit 1;",
    "  if v_catalog_id is null then raise exception 'TECESCOLA_CORE_CATALOG_MISSING'; end if;",
  ];

  for (const journey of pack.journeys) {
    const skill = skillByCode.get(journey.skill)!;
    const canonicalSubject = CANONICAL_SUBJECT[skill.subject];
    const lesson = journey.lesson;
    const lessonText = lessonMarkdown(lesson);
    const optionsByQuestion = balanceOptions(journey.questions);
    const learningRole = skill.recommendedStage === 'ENSINO_MEDIO' && skill.recommendedGradeFrom === 1 ? 'INTRODUCTORY_CONTENT' : 'FOUNDATION_REVIEW';
    lines.push(`  select id into v_subject_id from public.learning_canonical_subjects where code=${sql(canonicalSubject)} and active;`);
    lines.push(`  if v_subject_id is null then raise exception ${sql(`V9_JOURNEY_SUBJECT_MISSING:${canonicalSubject}`)}; end if;`);
    lines.push(`  update public.learning_curriculum_skills set canonical_subject_id=v_subject_id, content_readiness='ADAPTIVE_READY', mastery_targetable=true, publication_status='STAGING', pedagogical_review_status='PEDAGOGICAL_REVIEW_PENDING', metadata=coalesce(metadata,'{}'::jsonb)||${jsonSql({ content_pack: 'tec-escola-core-v4', content_version: pack.contentVersion, content_authoring_status: 'AUTHORED', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', demo_preview_only: true })}, updated_at=now() where catalog_id=v_catalog_id and code=${sql(journey.skill)} and active and node_kind='LEAF' returning id into v_skill_id;`);
    lines.push(`  if v_skill_id is null then raise exception ${sql(`V9_JOURNEY_SKILL_NOT_FOUND:${journey.skill}`)}; end if;`);
    lines.push(`  select id into v_parent_id from public.learning_curriculum_skills where catalog_id=v_catalog_id and code=${sql(skill.parent)} and active;`);
    lines.push(`  if v_parent_id is null then raise exception ${sql(`V9_JOURNEY_PARENT_MISSING:${journey.skill}`)}; end if;`);
    lines.push('  insert into public.learning_skill_hierarchy(parent_skill_id,child_skill_id) values(v_parent_id,v_skill_id) on conflict do nothing;');
    lines.push(`  insert into public.learning_skill_lessons(canonical_skill_id,version,title,summary,content_markdown,worked_example,tips,estimated_minutes,metadata,active) values(v_skill_id,4,${sql(lesson.title)},${sql(lesson.summary)},${sql(lessonText)},${sql(lesson.workedExample)},${sqlArray([lesson.practiceGuidance, ...lesson.remediations.map((item) => item.selfCheck)])},${lesson.estimatedMinutes},${jsonSql({ content_version: pack.contentVersion, lesson_role: 'PRIMARY', objective: lesson.objective, prior_knowledge: lesson.priorKnowledge, key_concepts: lesson.keyConcepts, progressive_explanation: lesson.progressiveExplanation, everyday_application: lesson.everydayApplication, common_errors: lesson.commonErrors, practice_guidance: lesson.practiceGuidance, remediations: lesson.remediations, content_authoring_status: 'AUTHORED', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', demo_preview_only: true })},true) on conflict(canonical_skill_id,version) do update set title=excluded.title,summary=excluded.summary,content_markdown=excluded.content_markdown,worked_example=excluded.worked_example,tips=excluded.tips,estimated_minutes=excluded.estimated_minutes,metadata=excluded.metadata,active=true,updated_at=now() returning id into v_lesson_id;`);
    for (const purpose of PURPOSES) {
      lines.push(`  insert into public.learning_question_sets(scope,canonical_skill_id,purpose,version,metadata) values('GLOBAL',v_skill_id,${sql(purpose)},4,jsonb_build_object('content_pack','tec-escola-core-v4','content_version',${sql(pack.contentVersion)},'selection_policy','SERVER_SELECTED_V1','demo_preview_only',true,'pedagogical_review_status','PEDAGOGICAL_REVIEW_PENDING')) on conflict(canonical_skill_id,purpose,version) where scope='GLOBAL' do update set active=true,metadata=excluded.metadata returning id into v_set_id;`);
    }
    lines.push(`  if exists(select 1 from public.learning_bncc_discipline_journeys where execution_skill_id=v_skill_id and journey_code<>${sql(journey.journeyCode)}) then raise exception ${sql(`V9_JOURNEY_SKILL_ALREADY_ASSIGNED:${journey.skill}`)}; end if;`);
    lines.push(`  insert into public.learning_bncc_discipline_journeys(journey_code,canonical_subject_id,execution_skill_id,unit_code,unit_title,title,suggested_stage,suggested_grade,publication_status,mapping_status,pedagogical_review_status,content_version,metadata) values(${sql(journey.journeyCode)},v_subject_id,v_skill_id,${sql(journey.unitCode)},${sql(journey.unitTitle)},${sql(journey.title)},'ENSINO_MEDIO',1,'DEMO_PREVIEW','MAPPING_PENDING','PEDAGOGICAL_REVIEW_PENDING',${sql(pack.contentVersion)},${jsonSql({ source_pack: pack.contentVersion, skill_code: journey.skill, execution_stage: skill.recommendedStage, execution_grade_from: skill.recommendedGradeFrom, learning_role: learningRole, mapping_status: 'MAPPING_PENDING', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', demonstration_only: true })}) on conflict(journey_code) do update set canonical_subject_id=excluded.canonical_subject_id,execution_skill_id=excluded.execution_skill_id,unit_code=excluded.unit_code,unit_title=excluded.unit_title,title=excluded.title,suggested_stage=excluded.suggested_stage,suggested_grade=excluded.suggested_grade,publication_status='DEMO_PREVIEW',mapping_status='MAPPING_PENDING',pedagogical_review_status='PEDAGOGICAL_REVIEW_PENDING',content_version=excluded.content_version,metadata=excluded.metadata,active=true,updated_at=now() returning id into v_journey_id;`);
    for (const question of journey.questions) {
      const metadata = {
        content_id: question.id,
        content_version: pack.contentVersion,
        primary_skill: journey.skill,
        purpose: question.purpose,
        difficulty: question.difficulty,
        cognitive_process: question.cognitiveProcess,
        context_family: question.contextFamily,
        error_focus: question.errorFocus ?? lesson.commonErrors[0],
        remediation_hint: question.remediationHint ?? lesson.practiceGuidance,
        content_authoring_status: 'AUTHORED',
        pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
        demo_preview_only: true,
      };
      lines.push(`  insert into public.learning_question_bank(package_type,source_type,source_name,subject_area,domain,topic,statement,options,correct_answer,explanation,difficulty,estimated_minutes,provenance,metadata,active) select 'TECESCOLA','TECESCOLA_V9_AUTHORED_V1','TecEscola V9.3 journey expansion',${sql(skill.subject)},${sql(skill.domain)},${sql(question.contextFamily)},${sql(question.statement)},${jsonSql(optionsByQuestion.get(question.id))},${jsonSql(question.correctAnswer)},${sql(question.explanation)},${sql(question.difficulty)},4,'TECESCOLA_V9_AUTHORIAL_V1',${jsonSql(metadata)},true where not exists(select 1 from public.learning_question_bank existing where existing.source_type='TECESCOLA_V9_AUTHORED_V1' and existing.metadata->>'content_id'=${sql(question.id)}) returning id into v_question_id;`);
      lines.push(`  if v_question_id is null then select id into v_question_id from public.learning_question_bank where source_type='TECESCOLA_V9_AUTHORED_V1' and source_name='TecEscola V9.3 journey expansion' and subject_area=${sql(skill.subject)} and domain=${sql(skill.domain)} and topic=${sql(question.contextFamily)} and statement=${sql(question.statement)} and options=${jsonSql(optionsByQuestion.get(question.id))} and correct_answer=${jsonSql(question.correctAnswer)} and explanation=${sql(question.explanation)} and difficulty=${sql(question.difficulty)} and provenance='TECESCOLA_V9_AUTHORIAL_V1' and metadata=${jsonSql(metadata)} and metadata->>'content_id'=${sql(question.id)} and active; end if;`);
      lines.push(`  if v_question_id is null then raise exception ${sql(`V9_JOURNEY_QUESTION_IDEMPOTENCY_MISMATCH:${question.id}`)}; end if;`);
      lines.push("  insert into public.learning_question_bank_skill_links(question_bank_id,canonical_skill_id,skill_role) values(v_question_id,v_skill_id,'PRIMARY') on conflict(question_bank_id,canonical_skill_id) do nothing;");
      lines.push(`  select id into v_set_id from public.learning_question_sets where scope='GLOBAL' and canonical_skill_id=v_skill_id and purpose=${sql(question.purpose)} and version=4 and active;`);
      lines.push('  insert into public.learning_question_set_items(question_set_id,question_bank_id,position) values(v_set_id,v_question_id,(select coalesce(max(position),-1)+1 from public.learning_question_set_items where question_set_id=v_set_id)) on conflict do nothing;');
    }
    lines.push(`  select count(distinct item.question_bank_id) into v_count from public.learning_question_sets set_row join public.learning_question_set_items item on item.question_set_id=set_row.id join public.learning_question_bank bank on bank.id=item.question_bank_id and bank.active where set_row.scope='GLOBAL' and set_row.canonical_skill_id=v_skill_id and set_row.version=4 and set_row.active;`);
    lines.push(`  if v_count<20 then raise exception ${sql(`V9_JOURNEY_POOL_INCOMPLETE:${journey.skill}`)}; end if;`);
    lines.push(`  if not exists(select 1 from public.learning_bncc_discipline_journeys where id=v_journey_id and publication_status='DEMO_PREVIEW' and mapping_status='MAPPING_PENDING' and pedagogical_review_status='PEDAGOGICAL_REVIEW_PENDING') then raise exception ${sql(`V9_JOURNEY_REVIEW_STATE_INVALID:${journey.skill}`)}; end if;`);
  }

  lines.push(
    "  notify pgrst, 'reload schema';",
    'end $v9_journey_expansion$;',
    'set role postgres;',
    'create or replace function private.enforce_bncc_discipline_journey_session_v9() returns trigger language plpgsql security definer set search_path = \'\' as $v9_preview_guard$ declare demo_only boolean; begin',
    "  select coalesce(skill.metadata->>'demo_preview_only' = 'true', false) into demo_only from public.learning_curriculum_skills skill where skill.id = new.target_canonical_skill_id;",
    "  if demo_only and new.discipline_journey_id is null then raise exception 'LEARNING_V9_DEMO_SKILL_REQUIRES_JOURNEY'; end if;",
    '  if new.discipline_journey_id is not null then perform private.assert_bncc_discipline_journey_v9(new.institution_id,new.student_id,new.discipline_journey_id,new.target_canonical_skill_id); end if;',
    '  return new;',
    'end; $v9_preview_guard$;',
    'commit;',
    '',
  );
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('generate-v9-journey-expansion-a.ts')) {
  const mode = process.argv[2] ?? 'compile';
  if (mode === 'validate') {
    const errors = validateV9JourneyExpansion();
    if (errors.length) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ journeys: EXPECTED_SKILLS.length, questions: EXPECTED_SKILLS.length * 20, status: 'PEDAGOGICAL_REVIEW_PENDING' }));
    }
  } else {
    const outputPath = resolve(process.argv[2] === 'compile' ? (process.argv[3] ?? OUTPUT_PATH) : (process.argv[2] ?? OUTPUT_PATH));
    writeFileSync(outputPath, buildV9JourneyExpansionMigration());
    console.log(JSON.stringify({ outputPath, journeys: EXPECTED_SKILLS.length, questions: EXPECTED_SKILLS.length * 20 }));
  }
}
