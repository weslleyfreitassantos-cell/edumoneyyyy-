import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildKnowledgeFactoryV3, loadKnowledgeFactoryV3Inputs } from './knowledge-factory-v3.mjs';

const pgliteModule = process.env.PGLITE_MODULE;
if (!pgliteModule) throw new Error('Set PGLITE_MODULE to the installed PGlite module path.');
const { PGlite } = await import(pathToFileURL(path.resolve(pgliteModule)).href);
const database = new PGlite();
const loaded = loadKnowledgeFactoryV3Inputs();
const compiled = buildKnowledgeFactoryV3(loaded);
if (compiled.errors.length) throw new Error(`V3_INPUT_INVALID:${compiled.errors.join(',')}`);

const fixture = `
create schema extensions;
create function extensions.uuid_generate_v4() returns uuid language sql volatile as $$ select gen_random_uuid() $$;
create table public.learning_curriculum_catalogs (id uuid primary key default extensions.uuid_generate_v4(), code text not null, version text not null, unique(code,version));
create table public.learning_curriculum_skills (id uuid primary key default extensions.uuid_generate_v4(), catalog_id uuid not null references public.learning_curriculum_catalogs(id), code text not null, stage text not null, grade_level smallint, subject_area text not null, domain text not null, title text not null, description text, active boolean not null default true, metadata jsonb not null default '{}'::jsonb, node_kind text not null default 'LEAF' check(node_kind in ('ANCHOR','LEAF')), content_readiness text not null default 'GRAPH_ONLY' check(content_readiness in ('GRAPH_ONLY','CONTENT_READY','ADAPTIVE_READY')), mastery_targetable boolean not null default false, parent_canonical_skill_id uuid references public.learning_curriculum_skills(id), pedagogical_review_status text not null default 'TECH_VALIDATED', bncc_alignment_status text not null default 'CANDIDATE', updated_at timestamptz not null default now(), unique(catalog_id,code));
create table public.learning_skill_hierarchy (id uuid primary key default extensions.uuid_generate_v4(), parent_skill_id uuid not null references public.learning_curriculum_skills(id), child_skill_id uuid not null references public.learning_curriculum_skills(id), unique(parent_skill_id,child_skill_id), check(parent_skill_id<>child_skill_id));
create table public.learning_adaptive_content_packs (id uuid primary key default extensions.uuid_generate_v4(), pack_version text not null unique, canonical_hash text not null, manifest jsonb not null, pedagogical_review_status text not null default 'PEDAGOGICAL_REVIEW_PENDING', active boolean not null default true, updated_at timestamptz not null default now());
create table public.learning_curriculum_grade_targets (id uuid primary key default extensions.uuid_generate_v4(), catalog_id uuid not null references public.learning_curriculum_catalogs(id), stage text not null, grade_level smallint not null, subject_area text not null, canonical_skill_id uuid not null references public.learning_curriculum_skills(id), priority integer not null default 0, sort_order integer not null default 0, active boolean not null default true, updated_at timestamptz not null default now(), unique(catalog_id,stage,grade_level,subject_area,canonical_skill_id));
create table public.learning_skill_lessons (id uuid primary key default extensions.uuid_generate_v4(), canonical_skill_id uuid not null references public.learning_curriculum_skills(id), version integer not null, title text not null, summary text not null, content_markdown text not null, worked_example text, tips text[] not null default '{}', estimated_minutes integer not null default 5, metadata jsonb not null default '{}'::jsonb, active boolean not null default true, updated_at timestamptz not null default now(), unique(canonical_skill_id,version));
create table public.learning_packages (id uuid primary key default extensions.uuid_generate_v4(), institution_id uuid, package_type text not null check(package_type in ('TECESCOLA','INSTITUTION','TEACHER')), visibility text not null default 'GLOBAL' check(visibility in ('GLOBAL','INSTITUTION','PRIVATE')), title text not null, description text, subject_area text, active boolean not null default true, version integer not null default 1, metadata jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), check((visibility='GLOBAL' and institution_id is null) or (visibility in ('INSTITUTION','PRIVATE') and institution_id is not null)));
create table public.learning_package_steps (id uuid primary key default extensions.uuid_generate_v4(), package_id uuid not null references public.learning_packages(id), position integer not null check(position>=0), step_type text not null check(step_type in ('LESSON','ACTIVITY','QUESTION_SET','DIAGNOSTIC','PRACTICE','REVIEW','SIMULATION','RESOURCE')), lesson_id uuid references public.learning_skill_lessons(id), title text not null, metadata jsonb not null default '{}'::jsonb, unique(package_id,position));
create table public.learning_question_sets (id uuid primary key default extensions.uuid_generate_v4(), institution_id uuid, teacher_profile_id uuid, canonical_skill_id uuid not null references public.learning_curriculum_skills(id), scope text not null check(scope in ('GLOBAL','INSTITUTION','TEACHER')), purpose text not null check(purpose in ('PROBE','PRACTICE','TRANSFER','LOCK_IN','REVIEW')), version integer not null, active boolean not null default true, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check((scope='GLOBAL' and institution_id is null and teacher_profile_id is null) or (scope='INSTITUTION' and institution_id is not null and teacher_profile_id is null) or (scope='TEACHER' and institution_id is not null and teacher_profile_id is not null)));
create unique index learning_question_sets_global_unique_idx on public.learning_question_sets(canonical_skill_id,purpose,version) where scope='GLOBAL';
create table public.learning_question_bank (id uuid primary key default extensions.uuid_generate_v4(), package_type text not null check(package_type in ('TECESCOLA','ENEM','INSTITUTION','TEACHER')), source_type text not null, source_name text, subject_area text not null, domain text, topic text, statement text not null, options jsonb not null default '[]'::jsonb, correct_answer jsonb, explanation text, difficulty text check(difficulty is null or difficulty in ('EASY','MEDIUM','HARD')), estimated_minutes integer, provenance text, metadata jsonb not null default '{}'::jsonb, active boolean not null default true);
create table public.learning_question_bank_skill_links (id uuid primary key default extensions.uuid_generate_v4(), question_bank_id uuid not null references public.learning_question_bank(id), canonical_skill_id uuid not null references public.learning_curriculum_skills(id), skill_role text not null check(skill_role in ('PRIMARY','SUPPORTING')), unique(question_bank_id,canonical_skill_id));
create table public.learning_question_set_items (id uuid primary key default extensions.uuid_generate_v4(), question_set_id uuid not null references public.learning_question_sets(id), question_bank_id uuid not null references public.learning_question_bank(id), position integer not null check(position>=0), unique(question_set_id,position), unique(question_set_id,question_bank_id));
create table public.learning_skill_prerequisites (id uuid primary key default extensions.uuid_generate_v4(), skill_id uuid not null references public.learning_curriculum_skills(id), prerequisite_skill_id uuid not null references public.learning_curriculum_skills(id), unique(skill_id,prerequisite_skill_id), check(skill_id<>prerequisite_skill_id));
create table public.learning_skill_relationships (id uuid primary key default extensions.uuid_generate_v4(), from_canonical_skill_id uuid not null references public.learning_curriculum_skills(id), to_canonical_skill_id uuid not null references public.learning_curriculum_skills(id), relation_type text not null check(relation_type in ('PREREQUISITE','RELATED','TRANSFER')), relation_source text not null, confidence numeric(4,3) not null check(confidence between 0 and 1), metadata jsonb not null default '{}'::jsonb, check(from_canonical_skill_id<>to_canonical_skill_id), unique(from_canonical_skill_id,to_canonical_skill_id,relation_type));
create table public.learning_student_skill_state (id uuid primary key default extensions.uuid_generate_v4(), marker text not null);
create table public.learning_guided_sessions (id uuid primary key default extensions.uuid_generate_v4(), marker text not null);
insert into public.learning_curriculum_catalogs(code,version) values ('TECESCOLA_CORE','1.0');
insert into public.learning_student_skill_state(marker) values ('history-sentinel');
insert into public.learning_guided_sessions(marker) values ('session-sentinel');
`;

const queryRows = async (sql, params = []) => (await database.query(sql, params)).rows;
const snapshotSql = `select
  (select count(*)::int from public.learning_curriculum_skills where metadata->>'content_pack'='tec-escola-knowledge-expansion-v3' and node_kind='ANCHOR') as anchors,
  (select count(*)::int from public.learning_curriculum_skills where metadata->>'content_pack'='tec-escola-knowledge-expansion-v3' and node_kind='LEAF') as new_skills,
  (select count(*)::int from public.learning_skill_lessons where metadata->>'content_pack'='tec-escola-knowledge-expansion-v3') as lessons,
  (select count(*)::int from public.learning_question_bank where source_type='TECESCOLA_KNOWLEDGE_FACTORY_V3') as authored_and_v1_questions,
  (select count(*)::int from public.learning_question_sets where version=3) as question_sets,
  (select count(*)::int from public.learning_question_set_items where question_set_id in (select id from public.learning_question_sets where version=3)) as set_items,
  (select count(*)::int from public.learning_packages where metadata->>'content_pack'='tec-escola-knowledge-expansion-v3') as packages,
  (select count(*)::int from public.learning_packages where metadata->>'content_pack'='tec-escola-knowledge-expansion-v3' and not active) as inactive_packages,
  (select count(*)::int from public.learning_question_sets where version=3 and not active and metadata->>'student_available'='false' and metadata->>'pedagogical_review_status'='PEDAGOGICAL_REVIEW_PENDING') as inactive_sets,
  (select count(*)::int from public.learning_question_bank where source_type='TECESCOLA_KNOWLEDGE_FACTORY_V3' and not active and metadata->>'publication_status'='STAGING' and metadata->>'student_available' is null) as inactive_questions,
  (select count(*)::int from public.learning_curriculum_grade_targets where not active and canonical_skill_id in (select id from public.learning_curriculum_skills where metadata->>'content_pack'='tec-escola-knowledge-expansion-v3')) as inactive_grade_targets,
  (select count(*)::int from public.learning_question_bank where source_type='TECESCOLA_CORE_V4' and active) as active_v4_questions,
  (select count(*)::int from public.learning_student_skill_state where marker='history-sentinel') as history_sentinel,
  (select count(*)::int from public.learning_guided_sessions where marker='session-sentinel') as session_sentinel,
  (select count(*)::int from public.learning_adaptive_content_packs where pack_version='tec-escola-knowledge-expansion-v3' and not active and pedagogical_review_status='PEDAGOGICAL_REVIEW_PENDING') as inactive_pack`;

try {
  await database.exec(fixture);
  const catalog = await queryRows("select id from public.learning_curriculum_catalogs where code='TECESCOLA_CORE' and version='1.0'");
  const catalogId = catalog[0].id;
  const baseSkills = new Map([...loaded.inputs.graph.nodes, ...loaded.inputs.v4Skills].map((skill) => [skill.code, skill]));
  for (const skill of baseSkills.values()) {
    await queryRows(`insert into public.learning_curriculum_skills(catalog_id,code,stage,grade_level,subject_area,domain,title,description,active,metadata,node_kind,content_readiness,mastery_targetable,pedagogical_review_status,bncc_alignment_status)
      values ($1,$2,$3,$4,$5,$6,$7,$8,true,'{"fixture_sentinel":"preserve"}'::jsonb,'LEAF','GRAPH_ONLY',true,'TECH_VALIDATED','CANDIDATE')`, [catalogId, skill.code, skill.stage ?? skill.recommendedStage ?? 'ENSINO_MEDIO', skill.gradeFrom ?? skill.recommendedGradeFrom ?? skill.gradeLevel ?? 1, skill.subjectCode ?? 'FIXTURE', skill.domain ?? 'FIXTURE', skill.title ?? skill.code, skill.description ?? skill.objective ?? skill.title ?? skill.code]);
  }
  for (const question of compiled.groups.flatMap((group) => group.questions.filter((item) => item.kind === 'V4_REUSED')).map((item) => item.question)) {
    await queryRows(`insert into public.learning_question_bank(package_type,source_type,source_name,subject_area,domain,topic,statement,options,correct_answer,explanation,difficulty,provenance,metadata,active)
      values ('TECESCOLA','TECESCOLA_CORE_V4','V4 fixture',$1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,'FIXTURE',jsonb_build_object('content_id',$9::text,'fixture_sentinel','preserve'),true)`, [question.subject, question.domain, question.primarySkill, question.statement, JSON.stringify(question.options), JSON.stringify(question.correctAnswer), question.explanation, question.difficulty, question.id]);
  }
  for (const lesson of loaded.inputs.v4Lessons.filter((item) => item.skill === 'MATH_RATIO_UNIT_RATE')) {
    const skillRows = await queryRows('select id from public.learning_curriculum_skills where catalog_id=$1 and code=$2', [catalogId, lesson.skill]);
    await queryRows(`insert into public.learning_skill_lessons(canonical_skill_id,version,title,summary,content_markdown,worked_example,tips,estimated_minutes,metadata,active)
      values ($1,4,$2,$3,$4,$5,$6,$7,'{"content_pack":"tec-escola-core-v4","fixture_sentinel":"preserve"}'::jsonb,true)`, [skillRows[0].id, lesson.title, lesson.summary, lesson.explanation, lesson.workedExample, lesson.tips, lesson.estimatedMinutes]);
  }

  const generatedSql = compiled.sql.replace(/\r\n/g, '\n');
  const existingStateBefore = await queryRows("select code,active,metadata,pedagogical_review_status,bncc_alignment_status from public.learning_curriculum_skills where metadata->>'fixture_sentinel'='preserve' order by code");
  const reusedQuestionStateBefore = await queryRows("select metadata->>'content_id' as content_id,active,statement,options,correct_answer,metadata->>'fixture_sentinel' as sentinel from public.learning_question_bank where source_type='TECESCOLA_CORE_V4' order by metadata->>'content_id'");
  const firstRunAnswers = await queryRows("select options,correct_answer from public.learning_question_bank where source_type='TECESCOLA_KNOWLEDGE_FACTORY_V3' order by metadata->>'content_id'");
  await database.exec(generatedSql);
  const first = await queryRows(snapshotSql);
  const answers = await queryRows("select options,correct_answer from public.learning_question_bank where source_type='TECESCOLA_KNOWLEDGE_FACTORY_V3' order by metadata->>'content_id'");
  const correctAnswerPositions = [0, 0, 0, 0];
  for (const item of answers) correctAnswerPositions[item.options.indexOf(item.correct_answer)] += 1;
  await database.exec(generatedSql);
  const second = await queryRows(snapshotSql);
  const existingStateAfter = await queryRows("select code,active,metadata,pedagogical_review_status,bncc_alignment_status from public.learning_curriculum_skills where metadata->>'fixture_sentinel'='preserve' order by code");
  const reusedQuestionStateAfter = await queryRows("select metadata->>'content_id' as content_id,active,statement,options,correct_answer,metadata->>'fixture_sentinel' as sentinel from public.learning_question_bank where source_type='TECESCOLA_CORE_V4' order by metadata->>'content_id'");
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('IDEMPOTENCE_MISMATCH');
  if (JSON.stringify(existingStateBefore) !== JSON.stringify(existingStateAfter)) throw new Error('EXISTING_SKILL_STATE_CHANGED');
  if (JSON.stringify(reusedQuestionStateBefore) !== JSON.stringify(reusedQuestionStateAfter)) throw new Error('REUSED_V4_QUESTION_MUTATED');
  const expected = {
    anchors: 4,
    new_skills: 13,
    lessons: 25,
    authored_and_v1_questions: 146,
    question_sets: 130,
    set_items: 160,
    packages: 26,
    inactive_packages: 26,
    inactive_sets: 130,
    inactive_questions: 146,
    inactive_grade_targets: loaded.sourceBatch.newSkills.reduce((count, skill) => count + skill.gradeTo - skill.gradeFrom + 1, 0),
    active_v4_questions: 14,
    history_sentinel: 1,
    session_sentinel: 1,
    inactive_pack: 1,
  };
  if (JSON.stringify(first[0]) !== JSON.stringify(expected)) throw new Error(`STAGING_OR_COUNTS_INVALID:${JSON.stringify(first[0])}`);
  const answerKeysValid = answers.every((item) => Array.isArray(item.options) && item.options.length === 4 && item.options.includes(item.correct_answer));
  if (!answerKeysValid || firstRunAnswers.length !== 0) throw new Error('ANSWER_KEY_OR_EMPTY_BASELINE_INVALID');
  if (Math.max(...correctAnswerPositions) - Math.min(...correctAnswerPositions) > 12) throw new Error(`ANSWER_POSITION_BIAS:${JSON.stringify(correctAnswerPositions)}`);
  const output = { engine: 'PGlite PostgreSQL WASM isolated fixture', firstRun: first[0], secondRun: second[0], idempotent: true, existingSkillsUnchanged: true, reusedV4QuestionsUnchanged: true, answerKeysValid, correctAnswerPositions };
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(JSON.stringify({ name: error.name, message: error.message, code: error.code, position: error.position, detail: error.detail }, null, 2));
  process.exitCode = 1;
} finally {
  await database.close();
}
