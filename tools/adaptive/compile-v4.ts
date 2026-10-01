import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Readiness = 'GRAPH_ONLY' | 'CONTENT_READY' | 'ADAPTIVE_READY';
type Purpose = 'PROBE' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW';
type SkillKind = 'ANCHOR' | 'LEAF';

interface RegistryLeaf { code: string; title: string; domain: string; parent: string; readiness: Readiness }
interface RegistrySubject { code: string; name: string; anchors: string[]; leaves: RegistryLeaf[] }
interface Registry { packVersion: string; subjects: RegistrySubject[] }
interface Lesson { skill: string; title: string; objective: string; summary: string; explanation: string; workedExample: string; commonMistake: string; tips: string[]; estimatedMinutes: number }
interface Question {
  id: string; subject: string; domain: string; topic: string; primarySkill: string; supportingSkills: string[];
  prerequisiteSkills: string[]; transferSkills: string[]; purpose: Purpose; difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  cognitiveProcess: string; contextFamily: string; statement: string; options: string[]; correctAnswer: string;
  explanation: string; misconceptions: Record<string, string[]>; provenance: string;
}
interface Relationship { from: string; to: string; type: 'RELATED' | 'TRANSFER' | 'PREREQUISITE'; source: string; confidence: number; rationale: string }

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACK = join(ROOT, 'content', 'adaptive', 'tec-escola-core-v4');
const MIGRATION = join(ROOT, 'supabase', 'migrations', '20261001000100_adaptive_learning_pedagogical_depth_v4.sql');
const PURPOSES: readonly Purpose[] = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];

function readJson<T>(path: string): T { return JSON.parse(readFileSync(path, 'utf8')) as T; }
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}
function stableJson(value: unknown): string { return JSON.stringify(stable(value)); }
function sql(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}
function jsonSql(value: unknown): string { return `${sql(JSON.stringify(value))}::jsonb`; }
function sqlArray(values: readonly string[]): string { return `array[${values.map(sql).join(', ')}]::text[]`; }

export function loadV4Pack() {
  const manifest = readJson<Record<string, unknown>>(join(PACK, 'manifest.json'));
  const registry = readJson<Registry>(join(PACK, 'registry.json'));
  const relationships = readJson<{ hierarchy: string[][]; prerequisites: string[][]; relationships: Relationship[] }>(join(PACK, 'relationships.json'));
  const misconceptions = readJson<Record<string, string[]>>(join(PACK, 'misconceptions.json'));
  const questions = readJson<Question[]>(join(PACK, 'questions.json'));
  const lessons = readdirSync(join(PACK, 'subjects'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readJson<Lesson[]>(join(PACK, 'subjects', entry.name, 'lessons.json')));
  const anchors = registry.subjects.flatMap((subject) => subject.anchors.map((code) => ({
    code, title: code.replaceAll('_', ' ').toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('pt-BR')),
    subject: subject.code,
  })));
  const leaves = registry.subjects.flatMap((subject) => subject.leaves.map((leaf) => ({ ...leaf, subject: subject.code })));
  return { manifest, registry, relationships, misconceptions, questions, lessons, anchors, leaves };
}

export interface V4ValidationResult {
  valid: boolean;
  canonicalHash: string;
  subjectCount: number;
  skillCount: number;
  anchorCount: number;
  leafCount: number;
  adaptiveReadyCount: number;
  lessonCount: number;
  questionCount: number;
  relationshipCount: number;
  errors: string[];
}

export function validateV4Pack(pack = loadV4Pack()): V4ValidationResult {
  const errors: string[] = [];
  const skillCodes = new Set<string>();
  const anchors = new Set(pack.anchors.map((skill) => skill.code));
  const lessonsBySkill = new Map(pack.lessons.map((lesson) => [lesson.skill, lesson]));
  const questionsBySkill = new Map<string, Question[]>();
  for (const question of pack.questions) questionsBySkill.set(question.primarySkill, [...(questionsBySkill.get(question.primarySkill) ?? []), question]);
  for (const skill of [...pack.anchors, ...pack.leaves]) {
    if (skillCodes.has(skill.code)) errors.push(`DUPLICATE_SKILL:${skill.code}`);
    skillCodes.add(skill.code);
  }
  for (const leaf of pack.leaves) {
    if (!anchors.has(leaf.parent)) errors.push(`UNKNOWN_PARENT:${leaf.code}:${leaf.parent}`);
    if (leaf.readiness === 'ADAPTIVE_READY') {
      const lesson = lessonsBySkill.get(leaf.code);
      if (!lesson || !lesson.objective || !lesson.explanation || !lesson.workedExample || !lesson.estimatedMinutes) errors.push(`ADAPTIVE_READY_WITHOUT_LESSON:${leaf.code}`);
      const questions = questionsBySkill.get(leaf.code) ?? [];
      const byPurpose = new Map(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
      const minimums: Record<Purpose, number> = { PROBE: 2, PRACTICE: 2, TRANSFER: 1, LOCK_IN: 1, REVIEW: 2 };
      for (const purpose of PURPOSES) if ((byPurpose.get(purpose) ?? 0) < minimums[purpose]) errors.push(`PURPOSE_COVERAGE:${leaf.code}:${purpose}`);
      const contexts = new Set(questions.map((question) => question.contextFamily));
      if (contexts.size < 4) errors.push(`CONTEXT_DIVERSITY:${leaf.code}`);
    }
  }
  const knownSubjects = new Set(pack.registry.subjects.map((subject) => subject.code));
  const knownMisconceptionTags = new Set(Object.values(pack.misconceptions).flat());
  const validateEdgeList = (label: string, edges: string[][]) => {
    for (const edge of edges) {
      if (edge.length !== 2 || !skillCodes.has(edge[0]) || !skillCodes.has(edge[1])) errors.push(`UNKNOWN_${label}:${edge.join(':')}`);
      if (edge[0] === edge[1]) errors.push(`SELF_${label}:${edge[0]}`);
    }
  };
  validateEdgeList('HIERARCHY', pack.relationships.hierarchy);
  validateEdgeList('PREREQUISITE', pack.relationships.prerequisites);
  for (const relationship of pack.relationships.relationships) {
    if (!skillCodes.has(relationship.from) || !skillCodes.has(relationship.to)) errors.push(`UNKNOWN_RELATIONSHIP:${relationship.from}:${relationship.to}`);
    if (relationship.from === relationship.to) errors.push(`SELF_RELATIONSHIP:${relationship.from}`);
  }
  const stems = new Set<string>();
  const questionIds = new Set<string>();
  for (const question of pack.questions) {
    if (!knownSubjects.has(question.subject)) errors.push(`UNKNOWN_SUBJECT:${question.id}`);
    if (!skillCodes.has(question.primarySkill)) errors.push(`UNKNOWN_PRIMARY:${question.id}`);
    if (questionIds.has(question.id)) errors.push(`DUPLICATE_QUESTION:${question.id}`);
    questionIds.add(question.id);
    const stem = question.statement.trim().toLocaleLowerCase('pt-BR');
    if (stems.has(stem)) errors.push(`DUPLICATE_STEM:${question.id}`);
    stems.add(stem);
    if (question.options.length < 2 || new Set(question.options.map((option) => option.trim())).size !== question.options.length) errors.push(`INVALID_OPTIONS:${question.id}`);
    if (!question.options.includes(question.correctAnswer)) errors.push(`INVALID_ANSWER:${question.id}`);
    if (!question.explanation.trim() || !question.provenance.trim() || !question.contextFamily.trim()) errors.push(`INCOMPLETE_QUESTION:${question.id}`);
    for (const [option, tags] of Object.entries(question.misconceptions)) {
      if (!question.options.includes(option) || tags.length === 0) errors.push(`INVALID_MISCONCEPTION:${question.id}`);
      for (const tag of tags) if (!knownMisconceptionTags.has(tag)) errors.push(`UNKNOWN_MISCONCEPTION_TAG:${question.id}:${tag}`);
    }
  }
  const parentMap = new Map(pack.leaves.map((leaf) => [leaf.code, leaf.parent]));
  const hierarchyCycle = (code: string, path = new Set<string>()): boolean => {
    if (path.has(code)) return true;
    const parent = parentMap.get(code);
    return parent ? hierarchyCycle(parent, new Set([...path, code])) : false;
  };
  for (const leaf of pack.leaves) if (hierarchyCycle(leaf.code)) errors.push(`HIERARCHY_CYCLE:${leaf.code}`);
  const leafCount = pack.leaves.length;
  const adaptiveReadyCount = pack.leaves.filter((leaf) => leaf.readiness === 'ADAPTIVE_READY').length;
  const canonicalHash = createHash('sha256').update(stableJson({ manifest: pack.manifest, registry: pack.registry, relationships: pack.relationships, misconceptions: pack.misconceptions, questions: pack.questions, lessons: pack.lessons })).digest('hex');
  return {
    valid: errors.length === 0,
    canonicalHash,
    subjectCount: pack.registry.subjects.length,
    skillCount: pack.anchors.length + leafCount,
    anchorCount: pack.anchors.length,
    leafCount,
    adaptiveReadyCount,
    lessonCount: pack.lessons.length,
    questionCount: pack.questions.length,
    relationshipCount: pack.relationships.relationships.length,
    errors,
  };
}

function buildCoverage(pack: ReturnType<typeof loadV4Pack>, result: V4ValidationResult) {
  return {
    packVersion: pack.registry.packVersion,
    canonicalHash: result.canonicalHash,
    subjects: pack.registry.subjects.map((subject) => {
      const leaves = subject.leaves;
      return {
        code: subject.code,
        skills: subject.anchors.length + leaves.length,
        leafs: leaves.length,
        adaptiveReady: leaves.filter((leaf) => leaf.readiness === 'ADAPTIVE_READY').length,
        graphOnly: leaves.filter((leaf) => leaf.readiness === 'GRAPH_ONLY').length,
        lessons: leaves.filter((leaf) => pack.lessons.some((lesson) => lesson.skill === leaf.code)).length,
        questions: pack.questions.filter((question) => question.subject === subject.code).length,
        crossSubjectLinks: pack.relationships.relationships.filter((relationship) => relationship.from.startsWith(subject.code) || relationship.to.startsWith(subject.code)).length,
      };
    }),
  };
}

function buildMigration(pack: ReturnType<typeof loadV4Pack>, result: V4ValidationResult): string {
  const lines: string[] = [
    'begin;',
    '-- Generated by tools/adaptive/compile-v4.ts. Do not edit by hand.',
    `-- V4_CONTENT_HASH=${result.canonicalHash}`,
    "alter table public.learning_curriculum_skills add column if not exists node_kind text not null default 'LEAF';",
    "alter table public.learning_curriculum_skills add column if not exists content_readiness text not null default 'GRAPH_ONLY';",
    "alter table public.learning_curriculum_skills add column if not exists mastery_targetable boolean not null default false;",
    "alter table public.learning_curriculum_skills add column if not exists parent_canonical_skill_id uuid references public.learning_curriculum_skills(id) on delete restrict;",
    "alter table public.learning_curriculum_skills add column if not exists pedagogical_review_status text not null default 'TECH_VALIDATED';",
    "alter table public.learning_curriculum_skills add column if not exists bncc_alignment_status text not null default 'CANDIDATE';",
    "do $v4$ begin if not exists (select 1 from pg_constraint where conname = 'learning_curriculum_skills_v4_kind_check') then alter table public.learning_curriculum_skills add constraint learning_curriculum_skills_v4_kind_check check (node_kind in ('ANCHOR', 'LEAF')); end if; end $v4$;",
    "do $v4$ begin if not exists (select 1 from pg_constraint where conname = 'learning_curriculum_skills_v4_readiness_check') then alter table public.learning_curriculum_skills add constraint learning_curriculum_skills_v4_readiness_check check (content_readiness in ('GRAPH_ONLY', 'CONTENT_READY', 'ADAPTIVE_READY')); end if; end $v4$;",
    "do $v4$ begin if not exists (select 1 from pg_constraint where conname = 'learning_curriculum_skills_v4_review_check') then alter table public.learning_curriculum_skills add constraint learning_curriculum_skills_v4_review_check check (pedagogical_review_status in ('AUTHORED', 'TECH_VALIDATED', 'PEDAGOGICAL_REVIEW_PENDING', 'PEDAGOGICAL_REVIEWED')); end if; end $v4$;",
    'create index if not exists learning_curriculum_skills_v4_readiness_idx on public.learning_curriculum_skills(catalog_id, active, node_kind, content_readiness, mastery_targetable);',
    'create table if not exists public.learning_skill_hierarchy (id uuid primary key default extensions.uuid_generate_v4(), parent_skill_id uuid not null references public.learning_curriculum_skills(id) on delete cascade, child_skill_id uuid not null references public.learning_curriculum_skills(id) on delete cascade, created_at timestamptz not null default now(), constraint learning_skill_hierarchy_unique unique (parent_skill_id, child_skill_id), constraint learning_skill_hierarchy_no_self check (parent_skill_id <> child_skill_id));',
    'create index if not exists learning_skill_hierarchy_child_idx on public.learning_skill_hierarchy(child_skill_id);',
    'create table if not exists public.learning_adaptive_content_packs (id uuid primary key default extensions.uuid_generate_v4(), pack_version text not null unique, canonical_hash text not null, manifest jsonb not null, pedagogical_review_status text not null default \'PEDAGOGICAL_REVIEW_PENDING\', active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());',
    'alter table public.learning_skill_hierarchy enable row level security;',
    'alter table public.learning_adaptive_content_packs enable row level security;',
    'drop policy if exists learning_skill_hierarchy_select on public.learning_skill_hierarchy;',
    "create policy learning_skill_hierarchy_select on public.learning_skill_hierarchy for select to authenticated using (exists (select 1 from public.learning_curriculum_skills skill where skill.id = parent_skill_id and skill.active));",
    'drop policy if exists learning_adaptive_content_packs_select on public.learning_adaptive_content_packs;',
    "create policy learning_adaptive_content_packs_select on public.learning_adaptive_content_packs for select to authenticated using (active);",
    'grant select on public.learning_skill_hierarchy, public.learning_adaptive_content_packs to authenticated;',
    'revoke all on public.learning_skill_hierarchy, public.learning_adaptive_content_packs from anon;',
    `insert into public.learning_adaptive_content_packs(pack_version, canonical_hash, manifest, pedagogical_review_status) values (${sql(pack.registry.packVersion)}, ${sql(result.canonicalHash)}, ${jsonSql({ ...pack.manifest, ...result })}, 'PEDAGOGICAL_REVIEW_PENDING') on conflict (pack_version) do update set canonical_hash = excluded.canonical_hash, manifest = excluded.manifest, updated_at = now();`,
    'do $v4$ declare v_catalog_id uuid; v_skill_id uuid; v_parent_id uuid; v_question_id uuid; v_set_id uuid; position_index integer; begin',
    "  select id into v_catalog_id from public.learning_curriculum_catalogs where code = 'TECESCOLA_CORE' and version = '1.0' limit 1;",
    "  if v_catalog_id is null then raise exception 'TECESCOLA_CORE_CATALOG_MISSING'; end if;",
  ];
  for (const anchor of pack.anchors) {
    const subject = pack.registry.subjects.find((item) => item.code === anchor.subject)!;
    lines.push(`  insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active, node_kind, content_readiness, mastery_targetable, pedagogical_review_status, bncc_alignment_status, metadata) values (v_catalog_id, ${sql(anchor.code)}, 'ENSINO_FUNDAMENTAL', 1, ${sql(subject.code)}, 'V4_ANCHOR', ${sql(anchor.title)}, ${sql(`Anchor pedagogico de ${anchor.title}.`)}, true, 'ANCHOR', 'GRAPH_ONLY', false, 'TECH_VALIDATED', 'CANDIDATE', jsonb_build_object('content_pack', 'tec-escola-core-v4')) on conflict (catalog_id, code) do update set node_kind = 'ANCHOR', content_readiness = 'GRAPH_ONLY', mastery_targetable = false, active = true, metadata = excluded.metadata;`);
  }
  for (const leaf of pack.leaves) {
    const subject = pack.registry.subjects.find((item) => item.code === leaf.subject)!;
    const review = leaf.readiness === 'ADAPTIVE_READY' ? 'PEDAGOGICAL_REVIEW_PENDING' : 'TECH_VALIDATED';
    lines.push(`  insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active, node_kind, content_readiness, mastery_targetable, pedagogical_review_status, bncc_alignment_status, metadata) values (v_catalog_id, ${sql(leaf.code)}, 'ENSINO_FUNDAMENTAL', 1, ${sql(subject.code)}, ${sql(leaf.domain)}, ${sql(leaf.title)}, ${sql(`Unidade diagnosticavel de ${leaf.title.toLocaleLowerCase('pt-BR')}.`)}, true, 'LEAF', ${sql(leaf.readiness)}, ${leaf.readiness === 'ADAPTIVE_READY'}, ${sql(review)}, 'CANDIDATE', jsonb_build_object('content_pack', 'tec-escola-core-v4')) on conflict (catalog_id, code) do update set title = excluded.title, description = excluded.description, node_kind = 'LEAF', content_readiness = excluded.content_readiness, mastery_targetable = excluded.mastery_targetable, pedagogical_review_status = excluded.pedagogical_review_status, active = true, metadata = excluded.metadata;`);
    lines.push(`  select canonical.id into v_skill_id from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(leaf.code)};`);
    lines.push(`  select canonical.id into v_parent_id from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(leaf.parent)};`);
    lines.push('  if v_parent_id is not null then insert into public.learning_skill_hierarchy(parent_skill_id, child_skill_id) values (v_parent_id, v_skill_id) on conflict do nothing; end if;');
    const lesson = pack.lessons.find((item) => item.skill === leaf.code);
    if (lesson) {
      lines.push(`  insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, metadata) values (v_skill_id, 4, ${sql(lesson.title)}, ${sql(lesson.summary)}, ${sql(`${lesson.explanation}\n\nErro comum: ${lesson.commonMistake}`)}, ${sql(lesson.workedExample)}, ${sqlArray(lesson.tips)}, ${lesson.estimatedMinutes}, jsonb_build_object('content_pack', 'tec-escola-core-v4', 'objective', ${sql(lesson.objective)})) on conflict (canonical_skill_id, version) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes, metadata = excluded.metadata, active = true;`);
    }
    if (leaf.readiness === 'ADAPTIVE_READY') {
      for (const purpose of PURPOSES) {
        lines.push(`  insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, metadata) values ('GLOBAL', v_skill_id, ${sql(purpose)}, 4, jsonb_build_object('content_pack', 'tec-escola-core-v4')) on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL' do nothing;`);
      }
    }
  }
  for (const edge of pack.relationships.prerequisites) {
    lines.push(`  insert into public.learning_skill_prerequisites(skill_id, prerequisite_skill_id) select child.id, parent.id from public.learning_curriculum_skills child, public.learning_curriculum_skills parent where child.catalog_id = v_catalog_id and parent.catalog_id = v_catalog_id and child.code = ${sql(edge[0])} and parent.code = ${sql(edge[1])} on conflict do nothing;`);
  }
  for (const relationship of pack.relationships.relationships) {
    lines.push(`  insert into public.learning_skill_relationships(from_canonical_skill_id, to_canonical_skill_id, relation_type, relation_source, confidence, metadata) select source.id, target.id, ${sql(relationship.type)}, ${sql(relationship.source)}, ${relationship.confidence}, jsonb_build_object('rationale', ${sql(relationship.rationale)}, 'content_pack', 'tec-escola-core-v4') from public.learning_curriculum_skills source, public.learning_curriculum_skills target where source.catalog_id = v_catalog_id and target.catalog_id = v_catalog_id and source.code = ${sql(relationship.from)} and target.code = ${sql(relationship.to)} on conflict (from_canonical_skill_id, to_canonical_skill_id, relation_type) do update set confidence = excluded.confidence, metadata = excluded.metadata;`);
  }
  for (const question of pack.questions) {
    lines.push(`  insert into public.learning_question_bank(package_type, source_type, source_name, subject_area, domain, topic, statement, options, correct_answer, explanation, difficulty, estimated_minutes, provenance, metadata, active) select 'TECESCOLA', 'TECESCOLA_CORE_V4', 'TecEscola Core V4', ${sql(question.subject)}, ${sql(question.domain)}, ${sql(question.topic)}, ${sql(question.statement)}, ${jsonSql(question.options)}, ${jsonSql(question.correctAnswer)}, ${sql(question.explanation)}, ${sql(question.difficulty)}, 4, 'Conteudo autoral versionado do TecEscola; nao e BNCC oficial.', ${jsonSql({ content_id: question.id, purpose: question.purpose, context_family: question.contextFamily, cognitive_process: question.cognitiveProcess, misconceptions: question.misconceptions, pack_version: 'tec-escola-core-v4' })}, true where not exists (select 1 from public.learning_question_bank existing where existing.source_type = 'TECESCOLA_CORE_V4' and existing.metadata->>'content_id' = ${sql(question.id)}) returning id into v_question_id;`);
    lines.push(`  select id into v_question_id from public.learning_question_bank where source_type = 'TECESCOLA_CORE_V4' and metadata->>'content_id' = ${sql(question.id)};`);
    lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) select v_question_id, canonical.id, 'PRIMARY' from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(question.primarySkill)} on conflict (question_bank_id, canonical_skill_id) do nothing;`);
    for (const skill of question.supportingSkills) lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) select v_question_id, canonical.id, 'SUPPORTING' from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(skill)} on conflict (question_bank_id, canonical_skill_id) do nothing;`);
    for (const skill of question.prerequisiteSkills) lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) select v_question_id, canonical.id, 'PREREQUISITE' from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(skill)} on conflict (question_bank_id, canonical_skill_id) do nothing;`);
    for (const skill of question.transferSkills) lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) select v_question_id, canonical.id, 'TRANSFER' from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(skill)} on conflict (question_bank_id, canonical_skill_id) do nothing;`);
    for (const [option, tags] of Object.entries(question.misconceptions)) for (const tag of tags) {
      lines.push(`  insert into public.learning_misconception_tags(code, title, description) values (${sql(tag)}, ${sql(tag.replaceAll('_', ' ').toLocaleLowerCase('pt-BR'))}, 'Sinal diagnostico autoral do TecEscola.') on conflict (code) do update set active = true;`);
      lines.push(`  insert into public.learning_question_option_misconceptions(question_bank_id, option_value, misconception_tag_id, canonical_skill_id, confidence_weight, metadata) select v_question_id, ${sql(option)}, tag.id, skill.id, 0.8, jsonb_build_object('content_pack', 'tec-escola-core-v4') from public.learning_misconception_tags tag, public.learning_curriculum_skills skill where tag.code = ${sql(tag)} and skill.catalog_id = v_catalog_id and skill.code = ${sql(question.primarySkill)} on conflict do nothing;`);
    }
    if (PURPOSES.includes(question.purpose)) lines.push(`  select id into v_set_id from public.learning_question_sets where scope = 'GLOBAL' and canonical_skill_id = (select canonical.id from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(question.primarySkill)}) and purpose = ${sql(question.purpose)} and version = 4; insert into public.learning_question_set_items(question_set_id, question_bank_id, position) values (v_set_id, v_question_id, (select coalesce(max(position), -1) + 1 from public.learning_question_set_items where question_set_id = v_set_id)) on conflict do nothing;`);
  }
  lines.push('end $v4$;', '');
  lines.push('commit;');
  return lines.join('\n');
}

export function compileV4Pack() {
  const pack = loadV4Pack();
  const result = validateV4Pack(pack);
  if (!result.valid) throw new Error(`V4_CONTENT_INVALID\n${result.errors.join('\n')}`);
  writeFileSync(join(PACK, 'coverage.json'), `${JSON.stringify(buildCoverage(pack, result), null, 2)}\n`);
  writeFileSync(MIGRATION, `${buildMigration(pack, result)}\n`);
  return result;
}

const command = process.argv[2] ?? 'validate';
const result = command === 'compile' ? compileV4Pack() : validateV4Pack();
console.log(JSON.stringify(result, null, 2));
