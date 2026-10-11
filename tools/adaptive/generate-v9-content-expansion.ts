import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadV4Pack, validateV4Pack } from './compile-v4.ts';

type Purpose = 'PROBE' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type CognitiveProcess = 'IDENTIFY' | 'RECOGNIZE' | 'APPLY' | 'COMPARE' | 'INTERPRET' | 'ANALYZE' | 'EVALUATE' | 'EXPLAIN' | 'INFER' | 'ARGUE';

interface AuthoredQuestion {
  id: string;
  skill: string;
  purpose: Purpose;
  difficulty: Difficulty;
  cognitiveProcess: CognitiveProcess;
  contextFamily: string;
  statement: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  errorFocus: string;
  remediationHint: string;
}

interface AuthoredPack {
  contentVersion: string;
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING';
  questions: AuthoredQuestion[];
}

interface AuthoredRemediation {
  id: string;
  difficulty: string;
  explanation: string;
  workedExample: string;
  selfCheck: string;
}

interface AuthoredLesson {
  skill: string;
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
  remediations: AuthoredRemediation[];
}

interface LessonPack {
  contentVersion: string;
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING';
  lessons: AuthoredLesson[];
}

const ROOT = resolve(import.meta.dirname, '../..');
const PACK_PATH = resolve(ROOT, 'content/adaptive/tec-escola-core-v9/question-expansion-v1.json');
const QUESTION_EXPANSION_PATHS = [
  PACK_PATH,
  resolve(ROOT, 'content/adaptive/tec-escola-core-v9/question-expansion-v2.json'),
  resolve(ROOT, 'content/adaptive/tec-escola-core-v9/question-expansion-v3.json'),
];
const LESSON_PACK_PATH = resolve(ROOT, 'content/adaptive/tec-escola-core-v9/lesson-expansion-v1.json');
const LESSON_EXPANSION_PATH = resolve(ROOT, 'content/adaptive/tec-escola-core-v9/lesson-expansion-v2.json');
const OUTPUT_PATH = resolve(ROOT, 'supabase/migrations/20261011000500_bncc_v9_content_expansion_v1.sql');
const PURPOSES: Purpose[] = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const EXPECTED_SKILLS = [
  'ART_COMPARE_COMPOSITIONS',
  'BIOLOGY_CELL_FUNCTION',
  'CHEMISTRY_STOICHIOMETRY',
  'ENGLISH_INFER_FROM_TEXT',
  'GEOGRAPHY_INTERPRET_TERRITORY',
  'HISTORY_INTERPRET_EVIDENCE',
  'MATH_PERCENT_OF_QUANTITY',
  'PHILOSOPHY_EVALUATE_ARGUMENT',
  'PE_ANALYZE_MOVEMENT',
  'PHYSICS_AVERAGE_SPEED',
  'PORTUGUESE_ARGUMENT_EVIDENCE',
  'SOCIOLOGY_EXPLAIN_INSTITUTIONS',
];
const THIRTEEN_QUESTION_SKILLS = new Set([
  'ART_COMPARE_COMPOSITIONS',
  'BIOLOGY_CELL_FUNCTION',
  'CHEMISTRY_STOICHIOMETRY',
  'GEOGRAPHY_INTERPRET_TERRITORY',
  'HISTORY_INTERPRET_EVIDENCE',
  'PHILOSOPHY_EVALUATE_ARGUMENT',
  'PE_ANALYZE_MOVEMENT',
  'SOCIOLOGY_EXPLAIN_INSTITUTIONS',
]);

function readPack(): AuthoredPack {
  const packs = QUESTION_EXPANSION_PATHS.map((path) => JSON.parse(readFileSync(path, 'utf8')) as AuthoredPack);
  if (packs.some((pack) => pack.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING')) {
    throw new Error('V9_QUESTION_REVIEW_STATUS_MUST_REMAIN_PENDING');
  }
  return {
    contentVersion: 'tec-escola-core-v9-question-expansion-v3',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    questions: packs.flatMap((pack) => pack.questions),
  };
}

function readLessonPack(): LessonPack {
  const packs = [LESSON_PACK_PATH, LESSON_EXPANSION_PATH].map((path) => JSON.parse(readFileSync(path, 'utf8')) as LessonPack);
  if (packs.some((pack) => pack.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING')) {
    throw new Error('V9_LESSON_REVIEW_STATUS_MUST_REMAIN_PENDING');
  }
  return {
    contentVersion: 'tec-escola-core-v9-lesson-expansion-v2',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    lessons: packs.flatMap((pack) => pack.lessons),
  };
}

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function jsonSql(value: unknown): string {
  return `${sql(JSON.stringify(value as string))}::jsonb`;
}

function stablePosition(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 4;
}

function balanceOptions(questions: AuthoredQuestion[]): Map<string, string[]> {
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

function lessonMarkdown(lesson: AuthoredLesson): string {
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

function sqlArray(values: string[]): string {
  return `array[${values.map(sql).join(',')}]::text[]`;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function validateV9Expansion(pack = readPack(), lessonPack = readLessonPack()): string[] {
  const errors: string[] = [];
  const v4 = loadV4Pack();
  const v4Validation = validateV4Pack(v4);
  const skills = new Map(v4.leaves.map((leaf) => [leaf.code, leaf]));
  const ids = new Set<string>();
  const stems = new Set<string>();
  const grouped = new Map<string, AuthoredQuestion[]>();

  if (!v4Validation.valid) errors.push('V4_SOURCE_PACKAGE_INVALID');
  if (pack.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push('PEDAGOGICAL_REVIEW_STATUS_MUST_REMAIN_PENDING');
  if (lessonPack.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push('LESSON_REVIEW_STATUS_MUST_REMAIN_PENDING');

  for (const question of pack.questions) {
    if (ids.has(question.id)) errors.push(`DUPLICATED_QUESTION_ID:${question.id}`);
    ids.add(question.id);
    const skill = skills.get(question.skill);
    if (!skill || skill.readiness !== 'ADAPTIVE_READY') errors.push(`SKILL_NOT_ADAPTIVE_READY:${question.id}:${question.skill}`);
    if (!question.statement.trim() || !question.explanation.trim() || !question.errorFocus.trim() || !question.remediationHint.trim()) errors.push(`MISSING_PEDAGOGICAL_FIELD:${question.id}`);
    if (question.options.length !== 4 || new Set(question.options.map(normalize)).size !== 4 || !question.options.includes(question.correctAnswer)) errors.push(`INVALID_OPTIONS_OR_ANSWER:${question.id}`);
    if (!question.contextFamily.trim()) errors.push(`MISSING_CONTEXT_FAMILY:${question.id}`);
    const stem = normalize(question.statement);
    if (stems.has(stem)) errors.push(`DUPLICATED_QUESTION_STEM:${question.id}`);
    stems.add(stem);
    grouped.set(question.skill, [...(grouped.get(question.skill) ?? []), question]);
  }

  for (const [skill, questions] of grouped) {
    const expectedCount = THIRTEEN_QUESTION_SKILLS.has(skill) ? 13 : 12;
    if (questions.length !== expectedCount) errors.push(`EXPECTED_${expectedCount}_AUTHORED_QUESTIONS:${skill}:${questions.length}`);
    const minimums: Record<Purpose, number> = THIRTEEN_QUESTION_SKILLS.has(skill)
      ? { PROBE: 2, PRACTICE: 5, TRANSFER: 2, LOCK_IN: 2, REVIEW: 2 }
      : { PROBE: 2, PRACTICE: 4, TRANSFER: 2, LOCK_IN: 2, REVIEW: 2 };
    for (const purpose of PURPOSES) {
      const count = questions.filter((question) => question.purpose === purpose).length;
      if (count < minimums[purpose]) errors.push(`PURPOSE_COVERAGE:${skill}:${purpose}:${count}`);
    }
    if (new Set(questions.map((question) => question.contextFamily)).size < 8) errors.push(`CONTEXT_DIVERSITY:${skill}`);
    const positions = balanceOptions(questions);
    const correctCounts = [0, 0, 0, 0];
    for (const question of questions) correctCounts[positions.get(question.id)!.indexOf(question.correctAnswer)] += 1;
    if (Math.max(...correctCounts) > 4) errors.push(`ANSWER_POSITION_BIAS:${skill}:${correctCounts.join(',')}`);
  }

  for (const skill of EXPECTED_SKILLS) if (!grouped.has(skill)) errors.push(`MISSING_PRIORITY_SKILL:${skill}`);

  const lessonsBySkill = new Map<string, AuthoredLesson>();
  for (const lesson of lessonPack.lessons) {
    if (lessonsBySkill.has(lesson.skill)) errors.push(`DUPLICATED_LESSON_SKILL:${lesson.skill}`);
    lessonsBySkill.set(lesson.skill, lesson);
    if (!skills.has(lesson.skill)) errors.push(`UNKNOWN_LESSON_SKILL:${lesson.skill}`);
    if (lesson.priorKnowledge.length < 2 || lesson.keyConcepts.length < 3 || lesson.progressiveExplanation.length < 3 || lesson.commonErrors.length < 3 || lesson.remediations.length !== 2) errors.push(`LESSON_STRUCTURE_INCOMPLETE:${lesson.skill}`);
    if (lesson.workedExample.length < 240 || !lesson.everydayApplication.trim() || !lesson.practiceGuidance.trim() || !lesson.summary.trim()) errors.push(`LESSON_EXPLANATION_TOO_SHALLOW:${lesson.skill}`);
    if (new Set(lesson.remediations.map((item) => item.id)).size !== lesson.remediations.length || lesson.remediations.some((item) => !item.explanation.trim() || !item.workedExample.trim() || !item.selfCheck.trim())) errors.push(`LESSON_REMEDIATION_INCOMPLETE:${lesson.skill}`);
  }
  for (const skill of EXPECTED_SKILLS) if (!lessonsBySkill.has(skill)) errors.push(`MISSING_PRIORITY_LESSON:${skill}`);
  return errors;
}

export function buildV9ContentExpansionMigration(pack = readPack(), lessonPack = readLessonPack()): string {
  const errors = validateV9Expansion(pack, lessonPack);
  if (errors.length) throw new Error(`V9_EXPANSION_INVALID\n${errors.join('\n')}`);

  const v4 = loadV4Pack();
  const skillByCode = new Map(v4.leaves.map((leaf) => [leaf.code, leaf]));
  const lessonBySkill = new Map(lessonPack.lessons.map((lesson) => [lesson.skill, lesson]));
  const sorted = [...pack.questions].sort((a, b) => a.id.localeCompare(b.id));
  const optionsByQuestion = new Map<string, string[]>();
  for (const skill of new Set(sorted.map((question) => question.skill))) {
    for (const [id, options] of balanceOptions(sorted.filter((question) => question.skill === skill))) optionsByQuestion.set(id, options);
  }

  const lines = [
    'begin;',
    'reset role;',
    `-- CONTENT_VERSION=${pack.contentVersion}`,
    '-- Authored questions are demonstration-only; curriculum and pedagogical review remain pending.',
    'do $v9_content_expansion$',
    'declare v_skill_id uuid; v_set_id uuid; v_question_id uuid; v_lesson_id uuid; v_question_count integer; v_journey_count integer;',
    'begin',
  ];

  for (const skillCode of new Set(sorted.map((question) => question.skill))) {
    const skill = skillByCode.get(skillCode);
    if (!skill) throw new Error(`V9_EXPANSION_SKILL_MISSING:${skillCode}`);
    const questions = sorted.filter((question) => question.skill === skillCode);
    lines.push(`  select skill.id into v_skill_id from public.learning_curriculum_skills skill join public.learning_curriculum_catalogs catalog on catalog.id=skill.catalog_id where catalog.code='TECESCOLA_CORE' and catalog.version='1.0' and catalog.active and skill.code=${sql(skillCode)} and skill.active and skill.content_readiness='ADAPTIVE_READY' and skill.mastery_targetable;`);
    lines.push(`  if v_skill_id is null then raise exception ${sql(`V9_EXPANSION_SKILL_UNAVAILABLE:${skillCode}`)}; end if;`);

    const lesson = lessonBySkill.get(skillCode);
    if (!lesson) throw new Error('V9_EXPANSION_LESSON_MISSING:' + skillCode);
    const lessonText = lessonMarkdown(lesson);
    const lessonMetadata = {
      content_version: lessonPack.contentVersion,
      lesson_role: 'PRIMARY',
      objective: lesson.objective,
      prior_knowledge: lesson.priorKnowledge,
      key_concepts: lesson.keyConcepts,
      progressive_explanation: lesson.progressiveExplanation,
      everyday_application: lesson.everydayApplication,
      common_errors: lesson.commonErrors,
      practice_guidance: lesson.practiceGuidance,
      remediations: lesson.remediations,
      content_authoring_status: 'AUTHORED',
      pedagogical_review_status: lessonPack.pedagogicalReviewStatus,
      demo_preview_only: true,
    };
    lines.push('  v_lesson_id := null;');
    lines.push('  insert into public.learning_skill_lessons(canonical_skill_id,version,title,summary,content_markdown,worked_example,tips,estimated_minutes,metadata,active)');
    lines.push('  select v_skill_id,5,' + sql(lesson.title) + ',' + sql(lesson.summary) + ',' + sql(lessonText) + ',' + sql(lesson.workedExample) + ',' + sqlArray([lesson.practiceGuidance, ...lesson.remediations.map((item) => item.selfCheck)]) + ',' + lesson.estimatedMinutes + ',' + jsonSql(lessonMetadata) + ',true');
    lines.push('   where not exists (select 1 from public.learning_skill_lessons existing where existing.canonical_skill_id=v_skill_id and existing.version=5) returning id into v_lesson_id;');
    lines.push('  if v_lesson_id is null then');
    lines.push('    select id into v_lesson_id from public.learning_skill_lessons where canonical_skill_id=v_skill_id and version=5 and active and title=' + sql(lesson.title) + ' and summary=' + sql(lesson.summary) + ' and content_markdown=' + sql(lessonText) + ' and worked_example=' + sql(lesson.workedExample) + ' and tips=' + sqlArray([lesson.practiceGuidance, ...lesson.remediations.map((item) => item.selfCheck)]) + ' and estimated_minutes=' + lesson.estimatedMinutes + ' and metadata=' + jsonSql(lessonMetadata) + ';');
    lines.push('    if v_lesson_id is null then raise exception ' + sql('V9_EXPANSION_LESSON_IDEMPOTENCY_MISMATCH:' + skillCode) + '; end if;');
    lines.push('  end if;');

    for (const question of questions) {
      const metadata = {
        content_id: question.id,
        content_version: pack.contentVersion,
        primary_skill: skillCode,
        purpose: question.purpose,
        difficulty: question.difficulty,
        cognitive_process: question.cognitiveProcess,
        context_family: question.contextFamily,
        error_focus: question.errorFocus,
        remediation_hint: question.remediationHint,
        content_authoring_status: 'AUTHORED',
        pedagogical_review_status: pack.pedagogicalReviewStatus,
        demo_preview_only: true,
      };
      lines.push(`  v_question_id := null;`);
      lines.push(`  insert into public.learning_question_bank(package_type,source_type,source_name,subject_area,domain,topic,statement,options,correct_answer,explanation,difficulty,estimated_minutes,provenance,metadata,active)`);
      lines.push(`  select 'TECESCOLA','TECESCOLA_V9_AUTHORED_V1','TecEscola V9 authored expansion',${sql(skill.subject)},${sql(skill.domain)},${sql(question.contextFamily)},${sql(question.statement)},${jsonSql(optionsByQuestion.get(question.id))},${jsonSql(question.correctAnswer)},${sql(question.explanation)},${sql(question.difficulty)},4,'TECESCOLA_V9_AUTHORIAL_V1',${jsonSql(metadata)},true`);
      lines.push(`   where not exists (select 1 from public.learning_question_bank existing where existing.source_type='TECESCOLA_V9_AUTHORED_V1' and existing.metadata->>'content_id'=${sql(question.id)}) returning id into v_question_id;`);
      lines.push(`  if v_question_id is null then`);
      lines.push(`    select id into v_question_id from public.learning_question_bank where active and source_type='TECESCOLA_V9_AUTHORED_V1' and metadata->>'content_id'=${sql(question.id)} and statement=${sql(question.statement)} and options=${jsonSql(optionsByQuestion.get(question.id))} and correct_answer=${jsonSql(question.correctAnswer)} and explanation=${sql(question.explanation)} and difficulty=${sql(question.difficulty)} and metadata=${jsonSql(metadata)};`);
      lines.push(`    if v_question_id is null then raise exception ${sql(`V9_EXPANSION_IDEMPOTENCY_CONTENT_MISMATCH:${question.id}`)}; end if;`);
      lines.push('  end if;');
      lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id,canonical_skill_id,skill_role) values (v_question_id,v_skill_id,'PRIMARY') on conflict (question_bank_id,canonical_skill_id) do nothing;`);
      lines.push(`  select id into v_set_id from public.learning_question_sets where scope='GLOBAL' and canonical_skill_id=v_skill_id and purpose=${sql(question.purpose)} and version=4 and active;`);
      lines.push(`  if v_set_id is null then raise exception ${sql(`V9_EXPANSION_QUESTION_SET_MISSING:${skillCode}:${question.purpose}`)}; end if;`);
      lines.push('  insert into public.learning_question_set_items(question_set_id,question_bank_id,position)');
      lines.push('  select v_set_id,v_question_id,coalesce(max(position),-1)+1 from public.learning_question_set_items where question_set_id=v_set_id on conflict do nothing;');
    }

    lines.push(`  select count(distinct item.question_bank_id)::integer into v_question_count from public.learning_question_sets s join public.learning_question_set_items item on item.question_set_id=s.id join public.learning_question_bank bank on bank.id=item.question_bank_id and bank.active where s.scope='GLOBAL' and s.canonical_skill_id=v_skill_id and s.version=4 and s.active;`);
    lines.push(`  if v_question_count < 20 then raise exception ${sql(`V9_EXPANSION_QUESTION_COUNT_MISMATCH:${skillCode}`)}; end if;`);
    lines.push(`  update public.learning_bncc_discipline_journeys set content_version=${sql(`${pack.contentVersion}+${lessonPack.contentVersion}+${skillCode}`)}, metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('question_expansion_version',${sql(pack.contentVersion)},'lesson_expansion_version',${sql(lessonPack.contentVersion)},'pedagogical_review_status','PEDAGOGICAL_REVIEW_PENDING') where execution_skill_id=v_skill_id and active;`);
    lines.push(`  get diagnostics v_journey_count = row_count; if v_journey_count <> 1 then raise exception ${sql(`V9_EXPANSION_JOURNEY_COUNT_MISMATCH:${skillCode}`)}; end if;`);
  }

  lines.push(
    'end;',
    '$v9_content_expansion$;',
    "alter table public.learning_guided_session_events drop constraint if exists learning_guided_session_events_event_type_check;",
    "alter table public.learning_guided_session_events add constraint learning_guided_session_events_event_type_check check (event_type = any(array['SESSION_STARTED','STEP_STARTED','STEP_COMPLETED','EVIDENCE_RECORDED','REPLANNED','SKILL_ADVANCED','RETURNED_TO_TARGET','SESSION_COMPLETED','TEACHER_SUPPORT_REQUIRED','CONTENT_EXHAUSTED','CONTENT_POOL_RESTORED']::text[]));",
    'do $patch_v9_fresh_pool$',
    'declare function_definition text; old_count integer; new_count integer;',
    'begin',
    "  select pg_get_functiondef('private.pick_guided_v4_fresh_question_set(public.learning_guided_sessions,uuid,text)'::regprocedure) into function_definition;",
    "  if function_definition is null then raise exception 'V9_FRESH_QUESTION_SET_FUNCTION_MISSING'; end if;",
    "  select (length(function_definition)-length(replace(function_definition, ') = 2', '')))/length(') = 2') into old_count;",
    "  select (length(function_definition)-length(replace(function_definition, ') >= 2', '')))/length(') >= 2') into new_count;",
    '  if old_count = 0 and new_count = 2 then return; end if;',
    "  if old_count <> 2 then raise exception 'V9_FRESH_QUESTION_SET_PATCH_MISMATCH'; end if;",
    "  execute replace(function_definition, ') = 2', ') >= 2');",
    'end;',
    '$patch_v9_fresh_pool$;',
    'do $classify_v9_pool_exhaustion$',
    'declare function_definition text;',
    'begin',
    "  select pg_get_functiondef('private.append_guided_v4_next_step(public.learning_guided_sessions,public.learning_guided_steps,text,text)'::regprocedure) into function_definition;",
    "  if function_definition is null then raise exception 'V9_GUIDED_NEXT_STEP_FUNCTION_MISSING'; end if;",
    "  if position('CONTENT_EXHAUSTED' in function_definition) > 0 and position('REMEDIATION_QUESTION_POOL_EXHAUSTED' in function_definition) = 0 then return; end if;",
    "  if position('REMEDIATION_QUESTION_POOL_EXHAUSTED' in function_definition) = 0 then raise exception 'V9_POOL_EXHAUSTION_PATCH_MISMATCH'; end if;",
    "  function_definition := replace(function_definition, 'REMEDIATION_QUESTION_POOL_EXHAUSTED', 'CONTENT_EXHAUSTED');",
    "  function_definition := replace(function_definition, 'TEACHER_SUPPORT_REQUIRED', 'CONTENT_EXHAUSTED');",
    '  execute function_definition;',
    'end;',
    '$classify_v9_pool_exhaustion$;',
    'do $patch_v9_error_feedback$',
    'declare function_definition text; old_clause text; new_clause text;',
    'begin',
    "  select pg_get_functiondef('public.submit_guided_learning_step_v4(uuid,jsonb,text)'::regprocedure) into function_definition;",
    "  if function_definition is null then raise exception 'V9_SUBMIT_GUIDED_STEP_FUNCTION_MISSING'; end if;",
    "  old_clause := $old$'misconception_code', case when not correct then item.metadata->>'misconception_code' else null end$old$;",
    "  new_clause := $new$'misconception_code', case when not correct then item.metadata->>'misconception_code' else null end, 'error_focus', case when not correct then item.metadata->>'error_focus' else null end, 'remediation_hint', case when not correct then item.metadata->>'remediation_hint' else null end$new$;",
    '  if position(new_clause in function_definition) > 0 then return; end if;',
    "  if position(old_clause in function_definition) = 0 then raise exception 'V9_SUBMIT_FEEDBACK_PATCH_MISMATCH'; end if;",
    '  execute replace(function_definition, old_clause, new_clause);',
    'end;',
    '$patch_v9_error_feedback$;',
    'do $patch_v9_latest_lesson$',
    'declare function_definition text; old_clause text; new_clause text; old_count integer;',
    'begin',
    "  select pg_get_functiondef('public.start_guided_discipline_journey_v9(uuid,uuid,uuid)'::regprocedure) into function_definition;",
    "  if function_definition is null then raise exception 'V9_START_JOURNEY_FUNCTION_MISSING'; end if;",
    "  old_clause := 'and lesson.version = 4';",
    "  new_clause := 'and lesson.version = (select max(latest.version) from public.learning_skill_lessons latest where latest.canonical_skill_id=journey_row.execution_skill_id and latest.active)';",
    '  if position(new_clause in function_definition) > 0 then return; end if;',
    "  select (length(function_definition)-length(replace(function_definition, old_clause, '')))/length(old_clause) into old_count;",
    "  if old_count <> 1 then raise exception 'V9_START_JOURNEY_LESSON_PATCH_MISMATCH'; end if;",
    '  execute replace(function_definition, old_clause, new_clause);',
    'end;',
    '$patch_v9_latest_lesson$;',
    "create or replace function public.resume_content_exhausted_guided_journey_v9(p_institution_id uuid,p_student_id uuid,p_journey_id uuid)",
    "returns jsonb language plpgsql security definer set search_path = '' as $$",
    'declare journey_row public.learning_bncc_discipline_journeys%rowtype; session_row public.learning_guided_sessions%rowtype; question_set_id uuid; new_step_id uuid; next_position integer;',
    'begin',
    '  perform private.assert_bncc_discipline_journey_v9(p_institution_id,p_student_id,p_journey_id);',
    '  select journey.* into journey_row from public.learning_bncc_discipline_journeys journey where journey.id=p_journey_id;',
    '  select session.* into session_row from public.learning_guided_sessions session where session.institution_id=p_institution_id and session.student_id=p_student_id and session.discipline_journey_id=p_journey_id order by session.updated_at desc limit 1 for update;',
    "  if not found then raise exception 'LEARNING_V9_SESSION_NOT_FOUND'; end if;",
    "  if session_row.status='ACTIVE' and session_row.current_step_id is not null then return jsonb_build_object('session_id',session_row.id,'current_step_id',session_row.current_step_id,'resumed',false,'status',session_row.status); end if;",
    "  if session_row.status <> 'NEEDS_TEACHER_SUPPORT' or session_row.decision_reason not in ('CONTENT_EXHAUSTED','REMEDIATION_QUESTION_POOL_EXHAUSTED') then raise exception 'LEARNING_V9_SESSION_NOT_CONTENT_EXHAUSTED'; end if;",
    "  if exists(select 1 from public.learning_guided_sessions other_session where other_session.institution_id=p_institution_id and other_session.student_id=p_student_id and other_session.discipline_journey_id=p_journey_id and other_session.status in ('ACTIVE','PAUSED') and other_session.id<>session_row.id) then raise exception 'LEARNING_V9_ACTIVE_JOURNEY_EXISTS'; end if;",
    "  question_set_id := private.pick_guided_v4_fresh_question_set(session_row,journey_row.execution_skill_id,'PRACTICE');",
    "  if question_set_id is null then raise exception 'LEARNING_V9_CONTENT_STILL_EXHAUSTED'; end if;",
    '  select coalesce(max(position),-1)+1 into next_position from public.learning_guided_steps where session_id=session_row.id;',
    '  insert into public.learning_guided_steps(institution_id,session_id,canonical_skill_id,step_type,purpose,position,status,lesson_id,question_set_id,started_at,metadata)',
    "  values(p_institution_id,session_row.id,journey_row.execution_skill_id,'PRACTICE','PRACTICE',next_position,'ACTIVE',null,question_set_id,now(),jsonb_build_object('journey_id',journey_row.id,'content_exhaustion_resume',true,'selection_integrity_version','SERVER_SELECTED_V1')) returning id into new_step_id;",
    "  update public.learning_guided_sessions set status='ACTIVE',current_step_id=new_step_id,current_canonical_skill_id=journey_row.execution_skill_id,decision_reason='CONTENT_POOL_RESTORED',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('content_exhaustion_original_reason',session_row.decision_reason,'content_pool_restored_at',now()),updated_at=now() where id=session_row.id;",
    "  insert into public.learning_guided_session_events(institution_id,session_id,student_id,event_type,step_id,idempotency_key,payload) values(p_institution_id,session_row.id,p_student_id,'CONTENT_POOL_RESTORED',new_step_id,'v9-content-pool-restored:'||new_step_id::text,jsonb_build_object('journey_id',journey_row.id,'question_set_id',question_set_id,'previous_reason',session_row.decision_reason,'mastery_unproven',true)) on conflict do nothing;",
    "  return jsonb_build_object('session_id',session_row.id,'current_step_id',new_step_id,'resumed',true,'status','ACTIVE');",
    'end;',
    '$$;',
    'revoke all on function public.resume_content_exhausted_guided_journey_v9(uuid,uuid,uuid) from public,anon;',
    'grant execute on function public.resume_content_exhausted_guided_journey_v9(uuid,uuid,uuid) to authenticated;',
    "notify pgrst, 'reload schema';",
    'commit;',
    '',
  );
  return `${lines.join('\n')}`;
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('generate-v9-content-expansion.ts')) {
  const pack = readPack();
  const errors = validateV9Expansion(pack);
  if (process.argv[2] === 'validate') {
    if (errors.length) {
      console.error(JSON.stringify({ valid: false, errors }));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ valid: true, questionCount: pack.questions.length, skills: [...new Set(pack.questions.map((question) => question.skill))] }));
    }
  } else {
    writeFileSync(process.argv[2] ? resolve(process.argv[2]) : OUTPUT_PATH, buildV9ContentExpansionMigration(pack));
    console.log(JSON.stringify({ outputPath: process.argv[2] ? resolve(process.argv[2]) : OUTPUT_PATH, questionCount: pack.questions.length, skills: [...new Set(pack.questions.map((question) => question.skill))] }));
  }
}
