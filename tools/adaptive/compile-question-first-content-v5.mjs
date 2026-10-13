import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACK_PATH = join(ROOT, 'content', 'adaptive', 'tec-escola-core-v5', 'math-successive-percent-change.json');
const EXISTING_SUBJECTS_PATH = join(ROOT, 'content', 'adaptive', 'tec-escola-core-v4', 'subjects');
const EXISTING_V9_QUESTIONS_PATH = join(ROOT, 'content', 'adaptive', 'tec-escola-core-v9', 'journey-expansion-a-v1.json');
const EXISTING_V3_STAGING_PATH = join(ROOT, 'content', 'bncc', 'authoring', 'knowledge-factory-v3-staging.sql');
const DEFAULT_MIGRATION_PATH = join(ROOT, 'supabase', 'migrations', '20261012000700_bncc_question_first_content_staging_v5.sql');
const PACK_ID = 'TECESCOLA_CORE_V5_QUESTION_FIRST';
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const jsonSql = (value) => `${sql(JSON.stringify(value))}::jsonb`;
const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
const readExistingQuestionSources = () => {
  const v4Questions = readdirSync(EXISTING_SUBJECTS_PATH, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(EXISTING_SUBJECTS_PATH, entry.name, 'questions.json'))
    .flatMap((path) => {
      try { return readJson(path); } catch { return []; }
    });
  const v9Pack = readJson(EXISTING_V9_QUESTIONS_PATH);
  const v9Questions = (v9Pack.journeys ?? []).flatMap((journey) => journey.questions ?? []);
  const v3Staging = readFileSync(EXISTING_V3_STAGING_PATH, 'utf8');
  const v3AuthoredQuestions = v3Staging.split(/\r?\n/).flatMap((line) => {
    if (!line.includes('"content_id":')) return [];
    const statement = line.match(/statement = '((?:''|[^'])*)'/)?.[1];
    return statement ? [{ statement: statement.replaceAll("''", "'") }] : [];
  });
  return [...v4Questions, ...v9Questions, ...v3AuthoredQuestions];
};

export function validateQuestionFirstPack(pack = readJson(PACK_PATH), existingQuestions = readExistingQuestionSources()) {
  const errors = [];
  if (pack.packVersion !== 'tec-escola-core-v5-question-first') errors.push('PACK_VERSION_INVALID');
  if (!pack.canonicalSkillCode || !(pack.subject ?? 'MATHEMATICS') || !(pack.domain ?? 'PORCENTAGEM')) errors.push('SKILL_SCOPE_INVALID');
  if (pack.officialMappingStatus !== 'NOT_CLAIMED') errors.push('OFFICIAL_MAPPING_MUST_NOT_BE_CLAIMED');
  if (pack.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push('PEDAGOGICAL_REVIEW_MUST_REMAIN_PENDING');
  if (pack.publicationStatus !== 'STAGING') errors.push('CONTENT_MUST_REMAIN_STAGING');
  if (pack.contentAuthoringStatus !== 'AUTHORED') errors.push('CONTENT_AUTHORING_STATUS_INVALID');

  const lesson = pack.lesson;
  if (!lesson?.title || !lesson.objective || !lesson.summary || !lesson.explanation || !lesson.workedExample || !lesson.commonMistake || !Array.isArray(lesson.tips) || lesson.tips.length < 2) {
    errors.push('LESSON_INCOMPLETE');
  }
  const expectedPurposeCounts = pack.expectedPurposeCounts ?? Object.fromEntries(PURPOSES.map((purpose) => [purpose, 2]));
  const expectedQuestionCount = pack.expectedQuestionCount ?? Object.values(expectedPurposeCounts).reduce((sum, count) => sum + count, 0);
  if (!Array.isArray(pack.questions) || pack.questions.length !== expectedQuestionCount) errors.push(`QUESTION_COUNT_INVALID:${expectedQuestionCount}`);
  if (lesson?.progression) {
    const questionIds = new Set((pack.questions ?? []).map((question) => question.id));
    if (!Array.isArray(lesson.microExplanations) || lesson.microExplanations.length < 2) errors.push('MICROEXPLANATIONS_INCOMPLETE');
    if (!Array.isArray(lesson.remediations) || lesson.remediations.length < 2) errors.push('REMEDIATIONS_INCOMPLETE');
    if (!Array.isArray(lesson.sourceDossier) || lesson.sourceDossier.length < 1) errors.push('SOURCE_DOSSIER_MISSING');
    for (const stage of lesson.progression) {
      if (!Array.isArray(stage.questionIds) || stage.questionIds.some((id) => !questionIds.has(id))) errors.push(`PROGRESSION_QUESTION_REFERENCE_INVALID:${stage.stage}`);
    }
  }
  if (lesson?.authenticActivities !== undefined) {
    if (!Array.isArray(lesson.authenticActivities) || lesson.authenticActivities.length === 0) errors.push('AUTHENTIC_ACTIVITIES_INVALID');
    for (const activity of lesson.authenticActivities ?? []) {
      if (!activity.id || !activity.title || !activity.instructions || !activity.evidence || !activity.privacyGuard || !Array.isArray(activity.rubric) || activity.rubric.length < 2) {
        errors.push(`AUTHENTIC_ACTIVITY_INCOMPLETE:${activity.id ?? 'UNKNOWN'}`);
        continue;
      }
      for (const criterion of activity.rubric) {
        if (!criterion.criterion || !criterion.emerging || !criterion.developing || !criterion.proficient) {
          errors.push(`AUTHENTIC_ACTIVITY_RUBRIC_INCOMPLETE:${activity.id}`);
        }
      }
    }
  }

  const existingStems = new Set(existingQuestions.map((question) => normalize(question.statement)));
  const ids = new Set();
  const stems = new Set();
  const contexts = new Set();
  const counts = new Map(PURPOSES.map((purpose) => [purpose, 0]));
  const answerPositions = [0, 0, 0, 0];
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
    else answerPositions[question.options.indexOf(question.correctAnswer)] += 1;
    if (!Object.keys(question.misconceptions ?? {}).length) errors.push(`MISCONCEPTION_NOT_TAGGED:${question.id}`);
    for (const [distractor, tags] of Object.entries(question.misconceptions ?? {})) {
      if (!question.options.includes(distractor) || distractor === question.correctAnswer || !Array.isArray(tags) || tags.length === 0) errors.push(`MISCONCEPTION_MAPPING_INVALID:${question.id}`);
    }
  }
  for (const purpose of PURPOSES) if (counts.get(purpose) !== expectedPurposeCounts[purpose]) errors.push(`PURPOSE_COUNT_INVALID:${purpose}:${expectedPurposeCounts[purpose]}`);
  const expectedContextCount = pack.expectedContextCount ?? expectedQuestionCount;
  if (contexts.size !== expectedContextCount) errors.push(`CONTEXT_FAMILIES_NOT_DIVERSE:${expectedContextCount}`);
  const positionLabels = ['A', 'B', 'C', 'D'];
  const actualAnswerPositionCounts = Object.fromEntries(positionLabels.map((label, index) => [label, answerPositions[index]]));
  if (!pack.expectedAnswerPositionCounts || positionLabels.some((label) => pack.expectedAnswerPositionCounts[label] !== answerPositions[positionLabels.indexOf(label)])) {
    errors.push('ANSWER_POSITION_DISTRIBUTION_INVALID');
  }
  const largestPositionShare = Math.max(...answerPositions) / Math.max(1, pack.questions?.length ?? 0);
  if (largestPositionShare > 0.35) errors.push('ANSWER_POSITION_BIAS_TOO_HIGH');
  return { valid: errors.length === 0, errors, questionCount: pack.questions?.length ?? 0, contextCount: contexts.size, counts: Object.fromEntries(counts), answerPositionCounts: actualAnswerPositionCounts };
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
  const contentVersion = pack.contentVersion ?? 5;
  const databasePackId = pack.databasePackId ?? PACK_ID;
  const sourceType = `${databasePackId}_STAGING`;
  const subjectArea = pack.subject ?? 'MATHEMATICS';
  const domain = pack.domain ?? 'PORCENTAGEM';
  const topic = pack.topic ?? 'variacoes sucessivas';
  const lessonMetadata = {
    content_pack: databasePackId,
    content_id: pack.contentId,
    content_authoring_status: pack.contentAuthoringStatus,
    pedagogical_review_status: pack.pedagogicalReviewStatus,
    publication_status: pack.publicationStatus,
    bncc_alignment_status: pack.officialMappingStatus,
  };
  for (const [field, key] of [
    ['priorKnowledge', 'prior_knowledge'], ['keyConcepts', 'key_concepts'], ['progression', 'progression'],
    ['microExplanations', 'micro_explanations'], ['remediations', 'remediations'], ['reviewWindowsDays', 'review_windows_days'],
    ['reviewScheduleStatus', 'review_schedule_status'], ['sourceDossier', 'source_dossier'], ['copyrightNote', 'copyright_note'],
    ['authenticActivities', 'authentic_activities'],
  ]) {
    if (lesson[field] !== undefined) lessonMetadata[key] = lesson[field];
  }
  if (lesson.sourceDossier) {
    lessonMetadata.objective = lesson.objective;
    lessonMetadata.common_mistake = lesson.commonMistake;
    lessonMetadata.estimated_minutes = lesson.estimatedMinutes;
  }
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
    v_skill_id, ${contentVersion}, ${sql(lesson.title)}, ${sql(lesson.summary)}, ${sql(lesson.explanation)},
    ${sql(lesson.workedExample)}, ${`array[${lesson.tips.map(sql).join(', ')}]::text[]`}, ${lesson.estimatedMinutes}, false, ${jsonSql(lessonMetadata)}
  ) on conflict (canonical_skill_id, version) do nothing;
  select id into v_lesson_id from public.learning_skill_lessons
   where canonical_skill_id = v_skill_id and version = ${contentVersion}
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
    values ('GLOBAL', v_skill_id, v_question.purpose, ${contentVersion}, false,
      jsonb_build_object('content_pack', ${sql(databasePackId)}, 'content_id', ${sql(pack.contentId)},
        'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING', 'publication_status', 'STAGING',
        'bncc_alignment_status', 'NOT_CLAIMED'))
    on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL' do nothing;
    select id into v_set_id from public.learning_question_sets
     where scope = 'GLOBAL' and canonical_skill_id = v_skill_id
       and purpose = v_question.purpose and version = ${contentVersion}
       and metadata->>'content_id' = ${sql(pack.contentId)} and active = false;
    if v_set_id is null then raise exception 'V5_CONTENT_QUESTION_SET_CONFLICT'; end if;

    select id into v_question_id from public.learning_question_bank
     where source_type = ${sql(sourceType)} and metadata->>'content_id' = v_question.id;
    if v_question_id is null then
      insert into public.learning_question_bank(
        package_type, source_type, source_name, subject_area, domain, topic,
        statement, options, correct_answer, explanation, difficulty,
        estimated_minutes, provenance, metadata, active
      ) values (
        'TECESCOLA', ${sql(sourceType)}, 'TecEscola Question First V5 - Staging',
        ${sql(subjectArea)}, ${sql(domain)}, ${sql(topic)},
        v_question.statement, v_question.options, to_jsonb(v_question."correctAnswer"),
        v_question.explanation, v_question.difficulty, 2,
        'TECESCOLA_CORE_V5_AUTHORED',
        jsonb_build_object('content_pack', ${sql(databasePackId)}, 'content_id', v_question.id,
          'purpose', v_question.purpose, 'context_family', v_question."contextFamily",
          'cognitive_process', v_question."cognitiveProcess", 'error_focus', v_question."errorFocus",
          'remediation_hint', v_question.hint, 'misconceptions', v_question.misconceptions,
          'content_authoring_status', 'AUTHORED', 'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING',
          'publication_status', 'STAGING', 'bncc_alignment_status', 'NOT_CLAIMED'), false
      ) returning id into v_question_id;
    end if;
    if v_question_id is null then raise exception 'V5_CONTENT_QUESTION_INSERT_FAILED'; end if;
    update public.learning_question_bank set active = false
     where id = v_question_id and source_type = ${sql(sourceType)};
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
  const [command = 'validate', ...args] = process.argv.slice(2);
  const options = Object.fromEntries(args.reduce((pairs, arg, index, all) => {
    if (!arg.startsWith('--')) return pairs;
    pairs.push([arg.slice(2), all[index + 1]]);
    return pairs;
  }, []));
  const packPath = options.pack ? resolve(ROOT, options.pack) : PACK_PATH;
  const migrationPath = options.output ? resolve(ROOT, options.output) : DEFAULT_MIGRATION_PATH;
  const pack = readJson(packPath);
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) {
    process.stderr.write(`${JSON.stringify(validation, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  if (command === 'compile') {
    writeFileSync(migrationPath, buildMigration(pack));
    process.stdout.write(`V5 staging content compiled: ${validation.questionCount} questions; ${migrationPath}\n`);
    return;
  }
  if (command !== 'validate') throw new Error(`Unknown command: ${command}`);
  process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
