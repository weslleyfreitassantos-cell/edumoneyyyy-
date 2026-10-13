import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACK_PATH = join(ROOT, 'content', 'adaptive', 'tec-escola-core-v5', 'math-successive-percent-change.json');
const EXISTING_QUESTIONS_PATH = join(ROOT, 'content', 'adaptive', 'tec-escola-core-v4', 'subjects', 'mathematics', 'questions.json');
const EXISTING_V9_QUESTIONS_PATH = join(ROOT, 'content', 'adaptive', 'tec-escola-core-v9', 'journey-expansion-a-v1.json');
const MIGRATION_PATH = join(ROOT, 'supabase', 'migrations', '20261012000700_bncc_question_first_content_staging_v5.sql');
const PACK_ID = 'TECESCOLA_CORE_V5_QUESTION_FIRST';
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const jsonSql = (value) => `${sql(JSON.stringify(value))}::jsonb`;
const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
const readExistingQuestionSources = () => {
  const v4Questions = readJson(EXISTING_QUESTIONS_PATH);
  const v9Pack = readJson(EXISTING_V9_QUESTIONS_PATH);
  const v9Questions = (v9Pack.journeys ?? []).flatMap((journey) => journey.questions ?? []);
  return [...v4Questions, ...v9Questions];
};

export function validateQuestionFirstPack(pack = readJson(PACK_PATH), existingQuestions = readExistingQuestionSources()) {
  const errors = [];
  if (pack.packVersion !== 'tec-escola-core-v5-question-first') errors.push('PACK_VERSION_INVALID');
  if (pack.canonicalSkillCode !== 'MATH_SUCCESSIVE_PERCENT_CHANGE') errors.push('SKILL_SCOPE_INVALID');
  if (pack.officialMappingStatus !== 'NOT_CLAIMED') errors.push('OFFICIAL_MAPPING_MUST_NOT_BE_CLAIMED');
  if (pack.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push('PEDAGOGICAL_REVIEW_MUST_REMAIN_PENDING');
  if (pack.publicationStatus !== 'STAGING') errors.push('CONTENT_MUST_REMAIN_STAGING');
  if (pack.contentAuthoringStatus !== 'AUTHORED') errors.push('CONTENT_AUTHORING_STATUS_INVALID');

  const lesson = pack.lesson;
  if (!lesson?.title || !lesson.objective || !lesson.summary || !lesson.explanation || !lesson.workedExample || !lesson.commonMistake || !Array.isArray(lesson.tips) || lesson.tips.length < 2) {
    errors.push('LESSON_INCOMPLETE');
  }
  if (!Array.isArray(pack.questions) || pack.questions.length !== 10) errors.push('QUESTION_COUNT_MUST_BE_TEN');

  const existingStems = new Set(existingQuestions.map((question) => normalize(question.statement)));
  const ids = new Set();
  const stems = new Set();
  const contexts = new Set();
  const counts = new Map(PURPOSES.map((purpose) => [purpose, 0]));
  for (const question of pack.questions ?? []) {
    if (ids.has(question.id)) errors.push(`DUPLICATE_ID:${question.id}`);
    ids.add(question.id);
    const stem = normalize(question.statement);
    if (stems.has(stem) || existingStems.has(stem)) errors.push(`DUPLICATE_STEM:${question.id}`);
    stems.add(stem);
    contexts.add(question.contextFamily);
    counts.set(question.purpose, (counts.get(question.purpose) ?? 0) + 1);
    if (!PURPOSES.includes(question.purpose)) errors.push(`PURPOSE_INVALID:${question.id}`);
    if (!['EASY', 'MEDIUM', 'HARD'].includes(question.difficulty)) errors.push(`DIFFICULTY_INVALID:${question.id}`);
    if (!question.cognitiveProcess || !question.contextFamily || !question.statement || !question.explanation || !question.hint || !question.errorFocus) errors.push(`QUESTION_FEEDBACK_INCOMPLETE:${question.id}`);
    if (!Array.isArray(question.options) || question.options.length !== 4 || new Set(question.options.map(normalize)).size !== 4) errors.push(`OPTIONS_INVALID:${question.id}`);
    if (!question.options?.includes(question.correctAnswer)) errors.push(`ANSWER_NOT_IN_OPTIONS:${question.id}`);
    if (!Object.keys(question.misconceptions ?? {}).length) errors.push(`MISCONCEPTION_NOT_TAGGED:${question.id}`);
    for (const [distractor, tags] of Object.entries(question.misconceptions ?? {})) {
      if (!question.options.includes(distractor) || !Array.isArray(tags) || tags.length === 0) errors.push(`MISCONCEPTION_MAPPING_INVALID:${question.id}`);
      if (!tags.includes('SUCCESSIVE_PERCENTAGES_CANCELLED')) errors.push(`MISCONCEPTION_TAG_UNEXPECTED:${question.id}`);
    }
  }
  for (const purpose of PURPOSES) if (counts.get(purpose) !== 2) errors.push(`PURPOSE_COUNT_INVALID:${purpose}`);
  if (contexts.size !== 10) errors.push('CONTEXT_FAMILIES_NOT_DIVERSE');
  return { valid: errors.length === 0, errors, questionCount: pack.questions?.length ?? 0, contextCount: contexts.size, counts: Object.fromEntries(counts) };
}

export function buildMigration(pack = readJson(PACK_PATH)) {
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`V5_CONTENT_INVALID:${validation.errors.join(',')}`);
  const purposePositions = new Map(PURPOSES.map((purpose) => [purpose, 0]));
  const questionRows = pack.questions.map((question) => {
    const position = purposePositions.get(question.purpose) + 1;
    purposePositions.set(question.purpose, position);
    return { ...question, position };
  });
  const questionJson = jsonSql(questionRows);
  const lesson = pack.lesson;
  const lessonMetadata = {
    content_pack: PACK_ID,
    content_id: pack.contentId,
    content_authoring_status: pack.contentAuthoringStatus,
    pedagogical_review_status: pack.pedagogicalReviewStatus,
    publication_status: pack.publicationStatus,
    bncc_alignment_status: pack.officialMappingStatus,
  };
  const hash = createHash('sha256').update(JSON.stringify(pack)).digest('hex');

  return `begin;

-- Authorial V5 content is compiled for review but remains inactive and unaligned.
-- No student can receive it until separate pedagogical and publication gates pass.
do $seed_question_first_content_v5$
declare
  v_catalog_id uuid;
  v_skill_id uuid;
  v_lesson_id uuid;
  v_set_id uuid;
  v_question_id uuid;
  v_question record;
begin
  select id into v_catalog_id
    from public.learning_curriculum_catalogs
   where code = 'TECESCOLA_CORE' and version = '1.0'
   limit 1;
  if v_catalog_id is null then raise exception 'V5_CONTENT_CATALOG_MISSING'; end if;
  select id into v_skill_id
    from public.learning_curriculum_skills
   where catalog_id = v_catalog_id and code = ${sql(pack.canonicalSkillCode)};
  if v_skill_id is null then raise exception 'V5_CONTENT_SKILL_MISSING'; end if;

  insert into public.learning_skill_lessons(
    canonical_skill_id, version, title, summary, content_markdown,
    worked_example, tips, estimated_minutes, active, metadata
  ) values (
    v_skill_id, 5, ${sql(lesson.title)}, ${sql(lesson.summary)}, ${sql(lesson.explanation)},
    ${sql(lesson.workedExample)}, ${`array[${lesson.tips.map(sql).join(', ')}]::text[]`}, ${lesson.estimatedMinutes}, false, ${jsonSql(lessonMetadata)}
  ) on conflict (canonical_skill_id, version) do nothing;
  select id into v_lesson_id from public.learning_skill_lessons
   where canonical_skill_id = v_skill_id and version = 5
     and metadata->>'content_id' = ${sql(pack.contentId)} and active = false;
  if v_lesson_id is null then raise exception 'V5_CONTENT_LESSON_CONFLICT'; end if;

  for v_question in
    select * from jsonb_to_recordset(${questionJson}) as item(
      id text, purpose text, difficulty text, "cognitiveProcess" text,
      "contextFamily" text, statement text, options jsonb, "correctAnswer" text,
      explanation text, hint text, "errorFocus" text, misconceptions jsonb, position integer
    )
  loop
    insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, active, metadata)
    values ('GLOBAL', v_skill_id, v_question.purpose, 5, false,
      jsonb_build_object('content_pack', ${sql(PACK_ID)}, 'content_id', ${sql(pack.contentId)},
        'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING', 'publication_status', 'STAGING',
        'bncc_alignment_status', 'NOT_CLAIMED'))
    on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL' do nothing;
    select id into v_set_id from public.learning_question_sets
     where scope = 'GLOBAL' and canonical_skill_id = v_skill_id
       and purpose = v_question.purpose and version = 5
       and metadata->>'content_id' = ${sql(pack.contentId)} and active = false;
    if v_set_id is null then raise exception 'V5_CONTENT_QUESTION_SET_CONFLICT'; end if;

    select id into v_question_id from public.learning_question_bank
     where source_type = ${sql(`${PACK_ID}_STAGING`)} and metadata->>'content_id' = v_question.id;
    if v_question_id is null then
      insert into public.learning_question_bank(
        package_type, source_type, source_name, subject_area, domain, topic,
        statement, options, correct_answer, explanation, difficulty,
        estimated_minutes, provenance, metadata, active
      ) values (
        'TECESCOLA', ${sql(`${PACK_ID}_STAGING`)}, 'TecEscola Question First V5 - Staging',
        'MATHEMATICS', 'PORCENTAGEM', 'variacoes sucessivas',
        v_question.statement, v_question.options, to_jsonb(v_question."correctAnswer"),
        v_question.explanation, v_question.difficulty, 2,
        'TECESCOLA_CORE_V5_AUTHORED',
        jsonb_build_object('content_pack', ${sql(PACK_ID)}, 'content_id', v_question.id,
          'purpose', v_question.purpose, 'context_family', v_question."contextFamily",
          'cognitive_process', v_question."cognitiveProcess", 'error_focus', v_question."errorFocus",
          'remediation_hint', v_question.hint, 'misconceptions', v_question.misconceptions,
          'content_authoring_status', 'AUTHORED', 'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING',
          'publication_status', 'STAGING', 'bncc_alignment_status', 'NOT_CLAIMED'), false
      ) returning id into v_question_id;
    end if;
    if v_question_id is null then raise exception 'V5_CONTENT_QUESTION_INSERT_FAILED'; end if;
    update public.learning_question_bank set active = false
     where id = v_question_id and source_type = ${sql(`${PACK_ID}_STAGING`)};
    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
    values (v_question_id, v_skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;
    insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
    values (v_set_id, v_question_id, v_question.position)
    on conflict (question_set_id, question_bank_id) do nothing;
  end loop;
end;
$seed_question_first_content_v5$;

commit;
-- CONTENT_SHA256=${hash}
`;
}

function main() {
  const command = process.argv[2] ?? 'validate';
  const validation = validateQuestionFirstPack();
  if (!validation.valid) {
    process.stderr.write(`${JSON.stringify(validation, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  if (command === 'compile') {
    writeFileSync(MIGRATION_PATH, buildMigration());
    process.stdout.write(`V5 staging content compiled: ${validation.questionCount} questions; ${MIGRATION_PATH}\n`);
    return;
  }
  if (command !== 'validate') throw new Error(`Unknown command: ${command}`);
  process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
