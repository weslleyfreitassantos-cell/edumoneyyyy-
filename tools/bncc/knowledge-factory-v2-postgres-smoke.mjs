import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pgliteModule = process.env.PGLITE_MODULE;
if (!pgliteModule) throw new Error('Set PGLITE_MODULE to the installed PGlite module path.');
const { PGlite } = await import(pathToFileURL(path.resolve(pgliteModule)).href);
const database = new PGlite();

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
insert into public.learning_curriculum_catalogs(code,version) values ('TECESCOLA_CORE','1.0');
`;

async function rows(sql) {
  return (await database.query(sql)).rows;
}

try {
  await database.exec(fixture);
  const batch = JSON.parse(fs.readFileSync('content/adaptive/tec-escola-core-v9/knowledge-expansion-batch-v2.json', 'utf8'));
  const parents = new Map(batch.skills.map((skill) => [skill.parentSkillCode, skill]));
  for (const [code, child] of parents) {
    await database.query(`insert into public.learning_curriculum_skills(catalog_id,code,stage,grade_level,subject_area,domain,title,description,active,node_kind,content_readiness,mastery_targetable) select id,$1,$2,$3,$4,$5,$6,$7,true,'LEAF','GRAPH_ONLY',false from public.learning_curriculum_catalogs where code='TECESCOLA_CORE' and version='1.0'`, [code, child.stage, child.gradeFrom, child.subjectCode, child.domain, code, code]);
  }

  const generated = fs.readFileSync('content/bncc/authoring/knowledge-factory-v2-staging.sql', 'utf8');
  await database.exec(generated);
  const countSql = `select
    (select count(*)::int from public.learning_curriculum_skills where code in ('SCIENCE_COMPARE_MATERIAL_CHOICES_FI','HISTORY_REGISTER_LOCAL_CHANGE_FI','BIOLOGY_EVALUATE_BIODIVERSITY_CONSERVATION_HS')) as skills,
    (select count(*)::int from public.learning_curriculum_skills where code in ('SCIENCE_COMPARE_MATERIAL_CHOICES_FI','HISTORY_REGISTER_LOCAL_CHANGE_FI','BIOLOGY_EVALUATE_BIODIVERSITY_CONSERVATION_HS') and not active and not mastery_targetable and pedagogical_review_status='PEDAGOGICAL_REVIEW_PENDING') as staging_skills,
    (select count(*)::int from public.learning_skill_lessons) as lessons,
    (select count(*)::int from public.learning_question_bank where source_type='TECESCOLA_KNOWLEDGE_FACTORY_V2' and not active) as questions,
    (select count(*)::int from public.learning_question_sets where version=2 and not active) as question_sets,
    (select count(*)::int from public.learning_question_set_items) as set_items,
    (select count(*)::int from public.learning_curriculum_grade_targets where not active) as inactive_grade_targets,
    (select count(*)::int from public.learning_adaptive_content_packs where pack_version='tec-escola-knowledge-expansion-v2' and not active) as inactive_packs`;
  const first = await rows(countSql);
  const answerRows = await rows(`select options, correct_answer from public.learning_question_bank where source_type='TECESCOLA_KNOWLEDGE_FACTORY_V2' order by metadata->>'content_id'`);
  const correctPositions = [0, 0, 0, 0];
  for (const question of answerRows) correctPositions[question.options.indexOf(question.correct_answer)] += 1;
  await database.exec(generated);
  const second = await rows(countSql);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error(`IDEMPOTENCE_MISMATCH:${JSON.stringify({ first, second })}`);
  const result = { engine: 'PGlite PostgreSQL WASM', firstRun: first[0], secondRun: second[0], correctAnswerPositions: correctPositions, idempotent: true };
  if (JSON.stringify(first[0]) !== JSON.stringify({ skills: 3, staging_skills: 3, lessons: 3, questions: 36, question_sets: 15, set_items: 36, inactive_grade_targets: 5, inactive_packs: 1 })) throw new Error(`COUNTS_OR_STAGING_INVALID:${JSON.stringify(result)}`);
  if (JSON.stringify(correctPositions) !== JSON.stringify([9, 9, 9, 9])) throw new Error(`ANSWER_POSITION_DISTRIBUTION_INVALID:${JSON.stringify(result)}`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ name: error.name, message: error.message, code: error.code, position: error.position, detail: error.detail }, null, 2));
  process.exitCode = 1;
} finally {
  await database.close();
}
