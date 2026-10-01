import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Readiness = 'GRAPH_ONLY' | 'CONTENT_READY' | 'ADAPTIVE_READY';
type Purpose = 'PROBE' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW';
type SkillKind = 'ANCHOR' | 'LEAF';
type AuthoringStatus = 'SCAFFOLD' | 'AUTHORED' | 'TECH_VALIDATED' | 'PEDAGOGICAL_REVIEWED';

interface RegistryLeaf {
  code: string;
  title: string;
  domain: string;
  parent: string;
  objective: string;
  description: string;
  masteryCapability: string;
  readiness: Readiness;
  content_authoring_status: AuthoringStatus;
  recommendedStage: StageReference['stage'];
  recommendedGradeFrom: number;
  recommendedGradeTo: number;
}
interface RegistrySubject { code: string; name: string; anchors: string[]; leaves: RegistryLeaf[] }
interface Registry { packVersion: string; subjects: RegistrySubject[] }
interface StageReference { stage: 'FUNDAMENTAL_I' | 'FUNDAMENTAL_II' | 'ENSINO_MEDIO'; from: number; to: number }
interface Lesson { skill: string; title: string; objective: string; summary: string; explanation: string; workedExample: string; commonMistake: string; tips: string[]; estimatedMinutes: number; content_authoring_status: AuthoringStatus }
interface Question {
  id: string; subject: string; domain: string; topic: string; primarySkill: string; supportingSkills: string[];
  prerequisiteSkills: string[]; transferSkills: string[]; purpose: Purpose; difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  cognitiveProcess: string; contextFamily: string; statement: string; options: string[]; correctAnswer: string;
  explanation: string; misconceptions: Record<string, string[]>; provenance: string; content_authoring_status: AuthoringStatus;
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
  const relationships = readJson<{ hierarchy: string[][]; prerequisites: string[][]; relationships: Relationship[] }>(join(PACK, 'relationships.json'));
  const stageReferences = readJson<Record<string, StageReference[]>>(join(PACK, 'stage-references.json'));
  const misconceptions = readJson<Record<string, string[]>>(join(PACK, 'misconceptions.json'));
  const misconceptionDetails = readJson<Record<string, { title: string; description: string; affectedSkills: string[] }>>(join(PACK, 'misconception-details.json'));
  const subjects = readdirSync(join(PACK, 'subjects'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      skills: readJson<{ code: string; name: string; anchors: Array<{ code: string; title: string }>; leaves: RegistryLeaf[] }>(join(PACK, 'subjects', entry.name, 'skills.json')),
      lessons: readJson<Lesson[]>(join(PACK, 'subjects', entry.name, 'lessons.json')),
      questions: readJson<Question[]>(join(PACK, 'subjects', entry.name, 'questions.json')),
    }));
  const registry: Registry = {
    packVersion: String(manifest.packVersion ?? 'tec-escola-core-v4'),
    subjects: subjects.map(({ skills }) => ({
      code: skills.code,
      name: skills.name,
      anchors: skills.anchors.map((anchor) => anchor.code),
      leaves: skills.leaves,
    })),
  };
  const questions = subjects.flatMap(({ questions: subjectQuestions }) => subjectQuestions);
  const lessons = subjects.flatMap(({ lessons: subjectLessons }) => subjectLessons);
  const anchors = registry.subjects.flatMap((subject) => subject.anchors.map((code) => ({
    code, title: code.replaceAll('_', ' ').toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('pt-BR')),
    subject: subject.code,
  })));
  const leaves = registry.subjects.flatMap((subject) => subject.leaves.map((leaf) => ({ ...leaf, subject: subject.code })));
  return { manifest, registry, relationships, stageReferences, misconceptions, misconceptionDetails, questions, lessons, anchors, leaves };
}

export interface V4ValidationResult {
  valid: boolean;
  canonicalHash: string;
  subjectCount: number;
  skillCount: number;
  anchorCount: number;
  leafCount: number;
  adaptiveReadyCount: number;
  graphOnlyCount: number;
  lessonCount: number;
  questionCount: number;
  relationshipCount: number;
  misconceptionCount: number;
  prerequisiteCount: number;
  crossSubjectRelationshipCount: number;
  contentReadyCount: number;
  realSelectableQuestions: number;
  reusedV2V3Questions: number;
  newRealV4Questions: number;
  genericTemplateQuestions: number;
  genericTemplateLessons: number;
  genericTemplateFamilies: number;
  duplicateSemanticSkills: string[];
  numericSuffixDuplicateConcepts: string[];
  realMisconceptions: number;
  genericMisconceptions: number;
  subjectsWithoutAdaptiveReady: string[];
  unknownSecondarySkills: string[];
  unknownPrerequisites: string[];
  prerequisiteCycles: string[];
  nearDuplicateStems: string[];
  answerPositionBias: boolean;
  errors: string[];
}

const STAGES = new Set(['FUNDAMENTAL_I', 'FUNDAMENTAL_II', 'ENSINO_MEDIO']);
const COGNITIVE_PROCESSES = new Set(['IDENTIFY', 'RECOGNIZE', 'APPLY', 'COMPARE', 'INTERPRET', 'ANALYZE', 'EVALUATE', 'EXPLAIN', 'INFER', 'ARGUE']);
const DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);
const AUTHORING_STATUSES = new Set<AuthoringStatus>(['SCAFFOLD', 'AUTHORED', 'TECH_VALIDATED', 'PEDAGOGICAL_REVIEWED']);
const TEMPLATE_PATTERNS = [
  /na atividade\b/i,
  /na etapa\b/i,
  /trilha de\b/i,
  /trilha [A-Z_]+/i,
  /aplicar .* usando as evidencias/i,
  /ignorar o contexto/i,
  /trocar .* por outro conceito/i,
  /concluir antes de observar/i,
];
function normalizedTokens(value: string): string[] {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}
function normalizedSemantic(value: string): string { return normalizedTokens(value).join(' '); }
function templateLike(value: string): boolean { return TEMPLATE_PATTERNS.some((pattern) => pattern.test(value)); }
function nearDuplicate(left: string, right: string): boolean {
  const a = new Set(normalizedTokens(left));
  const b = new Set(normalizedTokens(right));
  if (!a.size || !b.size) return false;
  const overlap = [...a].filter((token) => b.has(token)).length / Math.max(a.size, b.size);
  const withoutNumbers = (value: string) => normalizedTokens(value).filter((token) => !/^\d+(?:[,.]\d+)?$/.test(token)).join(' ');
  return overlap >= 0.9 || withoutNumbers(left) === withoutNumbers(right);
}
function cycleNodes(edges: string[][]): string[] {
  const adjacency = new Map<string, string[]>();
  for (const [from, to] of edges) adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles = new Set<string>();
  const visit = (node: string, path: string[]) => {
    if (visiting.has(node)) { cycles.add(node); return; }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) visit(next, [...path, node]);
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of new Set(edges.flat())) visit(node, []);
  return [...cycles].sort();
}

export function validateV4Pack(pack = loadV4Pack()): V4ValidationResult {
  const errors: string[] = [];
  const skillCodes = new Set<string>();
  const anchors = new Set(pack.anchors.map((skill) => skill.code));
  const lessonsBySkill = new Map(pack.lessons.map((lesson) => [lesson.skill, lesson]));
  const questionsBySkill = new Map<string, Question[]>();
  const semanticSkillCodes = new Map<string, string>();
  const duplicateSemanticSkills: string[] = [];
  const numericSuffixDuplicateConcepts: string[] = [];
  for (const question of pack.questions) questionsBySkill.set(question.primarySkill, [...(questionsBySkill.get(question.primarySkill) ?? []), question]);
  for (const skill of [...pack.anchors, ...pack.leaves]) {
    if (skillCodes.has(skill.code)) errors.push(`DUPLICATE_SKILL:${skill.code}`);
    skillCodes.add(skill.code);
  }
  for (const subject of pack.registry.subjects) {
    const references = pack.stageReferences[subject.code] ?? [];
    if (!references.length) errors.push(`MISSING_STAGE_REFERENCE:${subject.code}`);
    for (const reference of references) {
      if (!STAGES.has(reference.stage) || reference.from < 1 || reference.to < reference.from) errors.push(`INVALID_STAGE_REFERENCE:${subject.code}`);
    }
  }
  for (const leaf of pack.leaves) {
    if (!leaf.title.trim() || !leaf.objective.trim() || !leaf.description.trim() || !leaf.masteryCapability.trim()) errors.push(`LEAF_WITHOUT_EXPLICIT_OUTCOME:${leaf.code}`);
    if (!AUTHORING_STATUSES.has(leaf.content_authoring_status)) errors.push(`INVALID_AUTHORING_STATUS:${leaf.code}`);
    if (leaf.readiness === 'ADAPTIVE_READY' && leaf.content_authoring_status === 'SCAFFOLD') errors.push(`READY_SCAFFOLD:${leaf.code}`);
    if (/_\d{2}$/.test(leaf.code)) numericSuffixDuplicateConcepts.push(leaf.code);
    const semantic = normalizedSemantic(`${leaf.title} ${leaf.objective}`);
    const previousSemantic = semanticSkillCodes.get(semantic);
    if (previousSemantic) duplicateSemanticSkills.push(`${previousSemantic}:${leaf.code}`);
    semanticSkillCodes.set(semantic, leaf.code);
    if (!anchors.has(leaf.parent)) errors.push(`UNKNOWN_PARENT:${leaf.code}:${leaf.parent}`);
    if (leaf.readiness === 'CONTENT_READY' || leaf.readiness === 'ADAPTIVE_READY') {
      const lesson = lessonsBySkill.get(leaf.code);
      const questions = questionsBySkill.get(leaf.code) ?? [];
      if (!lesson || questions.length === 0) errors.push(`CONTENT_READY_WITHOUT_CONTENT:${leaf.code}`);
      if (lesson && !AUTHORING_STATUSES.has(lesson.content_authoring_status)) errors.push(`INVALID_LESSON_AUTHORING_STATUS:${leaf.code}`);
      if (leaf.readiness === 'ADAPTIVE_READY' && (!lesson || !lesson.objective || !lesson.summary || !lesson.explanation || !lesson.workedExample || !lesson.commonMistake || !lesson.tips.length || !lesson.estimatedMinutes)) errors.push(`ADAPTIVE_READY_WITHOUT_LESSON:${leaf.code}`);
      if (leaf.readiness === 'CONTENT_READY') continue;
      const byPurpose = new Map(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
      const minimums: Record<Purpose, number> = { PROBE: 2, PRACTICE: 2, TRANSFER: 1, LOCK_IN: 1, REVIEW: 2 };
      for (const purpose of PURPOSES) if ((byPurpose.get(purpose) ?? 0) < minimums[purpose]) errors.push(`PURPOSE_COVERAGE:${leaf.code}:${purpose}`);
      const contexts = new Set(questions.map((question) => question.contextFamily));
      if (contexts.size < 4) errors.push(`CONTEXT_DIVERSITY:${leaf.code}`);
      if (new Set(questions.map((question) => question.difficulty)).size < 2) errors.push(`DIFFICULTY_DIVERSITY:${leaf.code}`);
      if (new Set(questions.map((question) => question.cognitiveProcess)).size < 2) errors.push(`COGNITIVE_PROCESS_DIVERSITY:${leaf.code}`);
    }
  }
  const knownSubjects = new Set(pack.registry.subjects.map((subject) => subject.code));
  const knownMisconceptionTags = new Set(Object.values(pack.misconceptions).flat());
  const detailTags = new Set(Object.keys(pack.misconceptionDetails));
  for (const [tag, detail] of Object.entries(pack.misconceptionDetails)) {
    if (!detail.title.trim() || !detail.description.trim() || !detail.affectedSkills.length) errors.push(`INCOMPLETE_MISCONCEPTION_DETAIL:${tag}`);
    for (const skill of detail.affectedSkills) if (!skillCodes.has(skill)) errors.push(`UNKNOWN_MISCONCEPTION_SKILL:${tag}:${skill}`);
  }
  for (const tag of knownMisconceptionTags) if (!detailTags.has(tag)) errors.push(`MISSING_MISCONCEPTION_DETAIL:${tag}`);
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
  const stemList: string[] = [];
  const questionIds = new Set<string>();
  const answerPositionCounts = [0, 0, 0, 0];
  let genericTemplateQuestions = 0;
  let genericTemplateLessons = 0;
  const genericTemplateFamilies = new Set<string>();
  for (const lesson of pack.lessons) {
    if (!AUTHORING_STATUSES.has(lesson.content_authoring_status)) errors.push(`INVALID_LESSON_AUTHORING_STATUS:${lesson.skill}`);
    if (templateLike(JSON.stringify(lesson))) {
      genericTemplateLessons += 1;
      genericTemplateFamilies.add(normalizedSemantic(lesson.title).replace(/\b\d+\b/g, '#'));
    }
  }
  for (const question of pack.questions) {
    if (!knownSubjects.has(question.subject)) errors.push(`UNKNOWN_SUBJECT:${question.id}`);
    if (!skillCodes.has(question.primarySkill)) errors.push(`UNKNOWN_PRIMARY:${question.id}`);
    if (questionIds.has(question.id)) errors.push(`DUPLICATE_QUESTION:${question.id}`);
    questionIds.add(question.id);
    const stem = question.statement.trim().toLocaleLowerCase('pt-BR');
    if (stems.has(stem)) errors.push(`DUPLICATE_STEM:${question.id}`);
    stems.add(stem);
    stemList.push(question.statement);
    const answerPosition = question.options.indexOf(question.correctAnswer);
    if (answerPosition >= 0 && answerPositionCounts[answerPosition] !== undefined) answerPositionCounts[answerPosition] += 1;
    if (!DIFFICULTIES.has(question.difficulty) || !COGNITIVE_PROCESSES.has(question.cognitiveProcess) || !PURPOSES.includes(question.purpose)) errors.push(`INVALID_QUESTION_ENUM:${question.id}`);
    if (question.options.length < 2 || new Set(question.options.map((option) => option.trim())).size !== question.options.length) errors.push(`INVALID_OPTIONS:${question.id}`);
    if (!question.options.includes(question.correctAnswer)) errors.push(`INVALID_ANSWER:${question.id}`);
    if (!question.explanation.trim() || !question.provenance.trim() || !question.contextFamily.trim() || !AUTHORING_STATUSES.has(question.content_authoring_status)) errors.push(`INCOMPLETE_QUESTION:${question.id}`);
    if (templateLike(JSON.stringify(question))) {
      genericTemplateQuestions += 1;
      genericTemplateFamilies.add(normalizedSemantic(question.statement).replace(/\b\d+\b/g, '#'));
    }
    for (const reference of [...question.supportingSkills, ...question.prerequisiteSkills, ...question.transferSkills]) {
      if (!skillCodes.has(reference)) errors.push(`UNKNOWN_SECONDARY_SKILL:${question.id}:${reference}`);
    }
    for (const [option, tags] of Object.entries(question.misconceptions)) {
      if (!question.options.includes(option) || tags.length === 0) errors.push(`INVALID_MISCONCEPTION:${question.id}`);
      for (const tag of tags) if (!knownMisconceptionTags.has(tag)) errors.push(`UNKNOWN_MISCONCEPTION_TAG:${question.id}:${tag}`);
    }
  }
  const nearDuplicateStems = stemList.flatMap((stem, index) => stemList.slice(index + 1).filter((candidate) => nearDuplicate(stem, candidate)).map((candidate) => `${stem}::${candidate}`));
  if (nearDuplicateStems.length) errors.push(`NEAR_DUPLICATE_STEMS:${nearDuplicateStems.length}`);
  const parentMap = new Map(pack.leaves.map((leaf) => [leaf.code, leaf.parent]));
  const hierarchyCycle = (code: string, path = new Set<string>()): boolean => {
    if (path.has(code)) return true;
    const parent = parentMap.get(code);
    return parent ? hierarchyCycle(parent, new Set([...path, code])) : false;
  };
  for (const leaf of pack.leaves) if (hierarchyCycle(leaf.code)) errors.push(`HIERARCHY_CYCLE:${leaf.code}`);
  const leafCount = pack.leaves.length;
  const adaptiveReadyCount = pack.leaves.filter((leaf) => leaf.readiness === 'ADAPTIVE_READY').length;
  const graphOnlyCount = pack.leaves.filter((leaf) => leaf.readiness === 'GRAPH_ONLY').length;
  for (const leaf of pack.leaves) {
    if (!STAGES.has(leaf.recommendedStage) || !Number.isInteger(leaf.recommendedGradeFrom) || !Number.isInteger(leaf.recommendedGradeTo) || leaf.recommendedGradeFrom < 1 || leaf.recommendedGradeTo < leaf.recommendedGradeFrom || leaf.recommendedGradeTo > 12) {
      errors.push(`INVALID_LEAF_STAGE_METADATA:${leaf.code}`);
    }
  }
  const canonicalHash = createHash('sha256').update(stableJson({ manifest: pack.manifest, registry: pack.registry, relationships: pack.relationships, misconceptions: pack.misconceptions, misconceptionDetails: pack.misconceptionDetails, questions: pack.questions, lessons: pack.lessons })).digest('hex');
  const unknownPrerequisites = pack.relationships.prerequisites.filter(([from, to]) => !skillCodes.has(from) || !skillCodes.has(to)).map((edge) => edge.join(':')).sort();
  const prerequisiteCycles = cycleNodes(pack.relationships.prerequisites);
  for (const cycle of prerequisiteCycles) errors.push(`PREREQUISITE_CYCLE:${cycle}`);
  const crossSubjectRelationshipCount = pack.relationships.relationships.filter((relationship) => {
    const subjectFor = (code: string) => pack.registry.subjects.find((subject) => subject.anchors.includes(code) || subject.leaves.some((leaf) => leaf.code === code))?.code;
    return subjectFor(relationship.from) !== subjectFor(relationship.to);
  }).length;
  const subjectsWithoutAdaptiveReady = pack.registry.subjects.filter((subject) => !subject.leaves.some((leaf) => leaf.readiness === 'ADAPTIVE_READY')).map((subject) => subject.code);
  const contentReadyCount = pack.leaves.filter((leaf) => leaf.readiness === 'CONTENT_READY').length;
  const readySkills = new Set(pack.leaves.filter((leaf) => leaf.readiness === 'ADAPTIVE_READY').map((leaf) => leaf.code));
  const realSelectableQuestions = pack.questions.filter((question) => readySkills.has(question.primarySkill) && !templateLike(JSON.stringify(question))).length;
  const reusedV2V3Questions = pack.questions.filter((question) => question.provenance === 'TECESCOLA_CORE_V3_REUSED').length;
  const newRealV4Questions = pack.questions.filter((question) => question.provenance === 'TECESCOLA_CORE_V4_AUTHORED').length;
  for (const code of duplicateSemanticSkills) errors.push(`DUPLICATE_SEMANTIC_SKILL:${code}`);
  for (const code of numericSuffixDuplicateConcepts) errors.push(`NUMERIC_SUFFIX_DUPLICATE_CONCEPT:${code}`);
  if (genericTemplateQuestions) errors.push(`GENERIC_TEMPLATE_QUESTIONS:${genericTemplateQuestions}`);
  if (genericTemplateLessons) errors.push(`GENERIC_TEMPLATE_LESSONS:${genericTemplateLessons}`);
  const totalQuestions = answerPositionCounts.reduce((sum, count) => sum + count, 0);
  const answerPositionBias = totalQuestions > 0 && answerPositionCounts.some((count) => count / totalQuestions > 0.4);
  if (answerPositionBias) errors.push(`ANSWER_POSITION_BIAS:${answerPositionCounts.join(',')}`);
  const misconceptionCount = Object.values(pack.misconceptions).reduce((sum, tags) => sum + tags.length, 0);
  const genericMisconceptions = [...knownMisconceptionTags].filter((tag) => /CONTEXT_OMISSION|CONCEPT_SWAP|GENERIC/i.test(tag)).length;
  return {
    valid: errors.length === 0,
    canonicalHash,
    subjectCount: pack.registry.subjects.length,
    skillCount: pack.anchors.length + leafCount,
    anchorCount: pack.anchors.length,
    leafCount,
    adaptiveReadyCount,
    graphOnlyCount,
    lessonCount: pack.lessons.length,
    questionCount: pack.questions.length,
    relationshipCount: pack.relationships.relationships.length,
    misconceptionCount,
    prerequisiteCount: pack.relationships.prerequisites.length,
    crossSubjectRelationshipCount,
    contentReadyCount,
    realSelectableQuestions,
    reusedV2V3Questions,
    newRealV4Questions,
    genericTemplateQuestions,
    genericTemplateLessons,
    genericTemplateFamilies: genericTemplateFamilies.size,
    duplicateSemanticSkills,
    numericSuffixDuplicateConcepts,
    realMisconceptions: Object.keys(pack.misconceptionDetails).length,
    genericMisconceptions,
    subjectsWithoutAdaptiveReady,
    unknownSecondarySkills: errors.filter((error) => error.startsWith('UNKNOWN_SECONDARY_SKILL:')),
    unknownPrerequisites,
    prerequisiteCycles,
    nearDuplicateStems,
    answerPositionBias,
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
        purposes: Object.fromEntries(PURPOSES.map((purpose) => [purpose, pack.questions.filter((question) => question.subject === subject.code && question.purpose === purpose).length])),
        contextFamilies: [...new Set(pack.questions.filter((question) => question.subject === subject.code).map((question) => question.contextFamily))].sort(),
        misconceptions: [...new Set(pack.questions.filter((question) => question.subject === subject.code).flatMap((question) => Object.values(question.misconceptions).flat()))].length,
        hierarchy: subject.leaves.length,
        prerequisites: pack.relationships.prerequisites.filter(([from]) => subject.leaves.some((leaf) => leaf.code === from)).length,
        crossSubjectLinks: pack.relationships.relationships.filter((relationship) => subject.leaves.some((leaf) => leaf.code === relationship.from || leaf.code === relationship.to)).length,
        stageReferences: pack.stageReferences[subject.code] ?? [],
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
    `insert into public.learning_adaptive_content_packs(pack_version, canonical_hash, manifest, pedagogical_review_status) values (${sql(pack.registry.packVersion)}, ${sql(result.canonicalHash)}, ${jsonSql({ ...pack.manifest, ...result, coverage: buildCoverage(pack, result) })}, 'PEDAGOGICAL_REVIEW_PENDING') on conflict (pack_version) do update set canonical_hash = excluded.canonical_hash, manifest = excluded.manifest, updated_at = now();`,
    'do $v4$ declare v_catalog_id uuid; v_skill_id uuid; v_parent_id uuid; v_question_id uuid; v_set_id uuid; position_index integer; begin',
    "  select id into v_catalog_id from public.learning_curriculum_catalogs where code = 'TECESCOLA_CORE' and version = '1.0' limit 1;",
    "  if v_catalog_id is null then raise exception 'TECESCOLA_CORE_CATALOG_MISSING'; end if;",
  ];
  for (const anchor of pack.anchors) {
    const subject = pack.registry.subjects.find((item) => item.code === anchor.subject)!;
    const reference = pack.stageReferences[subject.code][0];
    lines.push(`  insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active, node_kind, content_readiness, mastery_targetable, pedagogical_review_status, bncc_alignment_status, metadata) values (v_catalog_id, ${sql(anchor.code)}, ${sql(reference.stage)}, ${reference.from}, ${sql(subject.code)}, 'V4_ANCHOR', ${sql(anchor.title)}, ${sql(`Anchor pedagogico de ${anchor.title}.`)}, true, 'ANCHOR', 'GRAPH_ONLY', false, 'TECH_VALIDATED', 'CANDIDATE', jsonb_build_object('content_pack', 'tec-escola-core-v4', 'stage_references', ${jsonSql(pack.stageReferences[subject.code])})) on conflict (catalog_id, code) do update set node_kind = 'ANCHOR', content_readiness = 'GRAPH_ONLY', mastery_targetable = false, active = true, metadata = excluded.metadata;`);
  }
  for (const leaf of pack.leaves) {
    const subject = pack.registry.subjects.find((item) => item.code === leaf.subject)!;
    const review = leaf.readiness === 'ADAPTIVE_READY' ? 'PEDAGOGICAL_REVIEW_PENDING' : 'TECH_VALIDATED';
    const leafReference = { stage: leaf.recommendedStage, from: leaf.recommendedGradeFrom, to: leaf.recommendedGradeTo };
    lines.push(`  insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active, node_kind, content_readiness, mastery_targetable, pedagogical_review_status, bncc_alignment_status, metadata) values (v_catalog_id, ${sql(leaf.code)}, ${sql(leafReference.stage)}, ${leafReference.from}, ${sql(subject.code)}, ${sql(leaf.domain)}, ${sql(leaf.title)}, ${sql(leaf.description)}, true, 'LEAF', ${sql(leaf.readiness)}, ${leaf.readiness === 'ADAPTIVE_READY'}, ${sql(review)}, 'CANDIDATE', ${jsonSql({ content_pack: 'tec-escola-core-v4', objective: leaf.objective, mastery_capability: leaf.masteryCapability, content_authoring_status: leaf.content_authoring_status, recommended_stage: leafReference.stage, recommended_grade_from: leafReference.from, recommended_grade_to: leafReference.to, stage_references: pack.stageReferences[subject.code] })}) on conflict (catalog_id, code) do update set title = excluded.title, description = excluded.description, node_kind = 'LEAF', content_readiness = excluded.content_readiness, mastery_targetable = excluded.mastery_targetable, pedagogical_review_status = excluded.pedagogical_review_status, active = true, metadata = excluded.metadata;`);
    lines.push(`  select canonical.id into v_skill_id from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(leaf.code)};`);
    lines.push(`  select canonical.id into v_parent_id from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(leaf.parent)};`);
    lines.push('  if v_parent_id is not null then insert into public.learning_skill_hierarchy(parent_skill_id, child_skill_id) values (v_parent_id, v_skill_id) on conflict do nothing; end if;');
    const lesson = pack.lessons.find((item) => item.skill === leaf.code);
    if (lesson) {
      lines.push(`  insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, metadata) values (v_skill_id, 4, ${sql(lesson.title)}, ${sql(lesson.summary)}, ${sql(`${lesson.explanation}\n\nErro comum: ${lesson.commonMistake}`)}, ${sql(lesson.workedExample)}, ${sqlArray(lesson.tips)}, ${lesson.estimatedMinutes}, ${jsonSql({ content_pack: 'tec-escola-core-v4', objective: lesson.objective, content_authoring_status: lesson.content_authoring_status })}) on conflict (canonical_skill_id, version) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes, metadata = excluded.metadata, active = true;`);
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
    lines.push(`  insert into public.learning_question_bank(package_type, source_type, source_name, subject_area, domain, topic, statement, options, correct_answer, explanation, difficulty, estimated_minutes, provenance, metadata, active) select 'TECESCOLA', 'TECESCOLA_CORE_V4', 'TecEscola Core V4', ${sql(question.subject)}, ${sql(question.domain)}, ${sql(question.topic)}, ${sql(question.statement)}, ${jsonSql(question.options)}, ${jsonSql(question.correctAnswer)}, ${sql(question.explanation)}, ${sql(question.difficulty)}, 4, ${sql(question.provenance)}, ${jsonSql({ content_id: question.id, purpose: question.purpose, context_family: question.contextFamily, cognitive_process: question.cognitiveProcess, misconceptions: question.misconceptions, content_authoring_status: question.content_authoring_status, pack_version: 'tec-escola-core-v4' })}, true where not exists (select 1 from public.learning_question_bank existing where existing.source_type = 'TECESCOLA_CORE_V4' and existing.metadata->>'content_id' = ${sql(question.id)}) returning id into v_question_id;`);
    lines.push(`  select id into v_question_id from public.learning_question_bank where source_type = 'TECESCOLA_CORE_V4' and metadata->>'content_id' = ${sql(question.id)};`);
    lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) select v_question_id, canonical.id, 'PRIMARY' from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(question.primarySkill)} on conflict (question_bank_id, canonical_skill_id) do nothing;`);
    for (const skill of question.supportingSkills) lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) select v_question_id, canonical.id, 'SUPPORTING' from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(skill)} on conflict (question_bank_id, canonical_skill_id) do nothing;`);
    for (const skill of question.prerequisiteSkills) lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) select v_question_id, canonical.id, 'PREREQUISITE' from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(skill)} on conflict (question_bank_id, canonical_skill_id) do nothing;`);
    for (const skill of question.transferSkills) lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) select v_question_id, canonical.id, 'TRANSFER' from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(skill)} on conflict (question_bank_id, canonical_skill_id) do nothing;`);
    for (const [option, tags] of Object.entries(question.misconceptions)) for (const tag of tags) {
      const detail = pack.misconceptionDetails[tag];
      lines.push(`  insert into public.learning_misconception_tags(code, title, description) values (${sql(tag)}, ${sql(detail.title)}, ${sql(detail.description)}) on conflict (code) do update set title = excluded.title, description = excluded.description, active = true;`);
      lines.push(`  insert into public.learning_question_option_misconceptions(question_bank_id, option_value, misconception_tag_id, canonical_skill_id, confidence_weight, metadata) select v_question_id, ${sql(option)}, tag.id, skill.id, 0.8, jsonb_build_object('content_pack', 'tec-escola-core-v4') from public.learning_misconception_tags tag, public.learning_curriculum_skills skill where tag.code = ${sql(tag)} and skill.catalog_id = v_catalog_id and skill.code = ${sql(question.primarySkill)} on conflict do nothing;`);
    }
    if (PURPOSES.includes(question.purpose)) lines.push(`  select id into v_set_id from public.learning_question_sets where scope = 'GLOBAL' and canonical_skill_id = (select canonical.id from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = ${sql(question.primarySkill)}) and purpose = ${sql(question.purpose)} and version = 4; insert into public.learning_question_set_items(question_set_id, question_bank_id, position) values (v_set_id, v_question_id, (select coalesce(max(position), -1) + 1 from public.learning_question_set_items where question_set_id = v_set_id)) on conflict do nothing;`);
  }
  lines.push('end $v4$;', '');
  lines.push(String.raw`
-- V4 keeps the guided-journey contract additive. These RPCs only select
-- ADAPTIVE_READY V4 leaves and never reinterpret a V2/V3 session as V4.
create or replace function private.append_guided_v4_next_step(
  session_row public.learning_guided_sessions,
  completed_step public.learning_guided_steps,
  outcome text,
  event_key text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  next_step uuid;
  next_skill uuid;
  candidate_skill uuid;
  candidate_readiness text;
  next_readiness text;
  bridge_depth integer := coalesce(nullif(session_row.metadata->>'bridge_depth', '')::integer, 0);
begin
  if bridge_depth >= 2 and completed_step.canonical_skill_id <> session_row.original_target_canonical_skill_id then
    update public.learning_guided_sessions
       set status = 'PAUSED', current_step_id = null,
           decision_reason = 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('bridge_depth', bridge_depth, 'runtime_reason', 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'),
           updated_at = now()
     where id = session_row.id;
    insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
    values (session_row.institution_id, session_row.id, session_row.student_id, 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED', completed_step.id, event_key, jsonb_build_object('bridge_depth', bridge_depth, 'runtime_reason', 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'));
    return null;
  end if;

  -- The shared V2 helper chooses the bridge at LOCK_IN. Preflight that
  -- choice so a GRAPH_ONLY node never reaches its question-set lookup.
  if completed_step.step_type = 'LOCK_IN' and outcome = 'SUCCESS' then
    candidate_skill := private.pick_learning_v2_next_skill(session_row.institution_id, session_row.student_id, session_row.target_canonical_skill_id);
    if candidate_skill is not null and candidate_skill <> session_row.target_canonical_skill_id then
      select skill.content_readiness into candidate_readiness from public.learning_curriculum_skills skill where skill.id = candidate_skill and skill.active;
      if coalesce(candidate_readiness, 'GRAPH_ONLY') <> 'ADAPTIVE_READY' then
        update public.learning_guided_sessions
           set status = 'PAUSED', current_step_id = null, decision_reason = 'CONTENT_NOT_READY',
               metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('bridge_depth', bridge_depth, 'runtime_reason', 'CONTENT_NOT_READY', 'skipped_canonical_skill_id', candidate_skill),
               updated_at = now()
         where id = session_row.id;
        insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
        values (session_row.institution_id, session_row.id, session_row.student_id, 'CONTENT_NOT_READY', completed_step.id, event_key, jsonb_build_object('canonical_skill_id', candidate_skill, 'runtime_reason', 'CONTENT_NOT_READY'));
        return null;
      end if;
    end if;
  end if;

  next_step := private.append_guided_v2_next_step(session_row, completed_step, outcome, event_key);
  if next_step is null then return null; end if;
  select step.canonical_skill_id into next_skill from public.learning_guided_steps step where step.id = next_step;
  select skill.content_readiness into next_readiness from public.learning_curriculum_skills skill where skill.id = next_skill and skill.active;
  if coalesce(next_readiness, 'GRAPH_ONLY') <> 'ADAPTIVE_READY' then
    update public.learning_guided_steps
       set status = 'SKIPPED', metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('runtime_reason', 'CONTENT_NOT_READY'), updated_at = now()
     where id = next_step;
    update public.learning_guided_sessions
       set status = 'PAUSED', current_step_id = null, decision_reason = 'CONTENT_NOT_READY',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('bridge_depth', bridge_depth, 'runtime_reason', 'CONTENT_NOT_READY', 'skipped_canonical_skill_id', next_skill),
           updated_at = now()
     where id = session_row.id;
    insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
    values (session_row.institution_id, session_row.id, session_row.student_id, 'CONTENT_NOT_READY', next_step, event_key || ':content-not-ready', jsonb_build_object('canonical_skill_id', next_skill, 'runtime_reason', 'CONTENT_NOT_READY'));
    return null;
  end if;

  update public.learning_guided_sessions
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
       'bridge_depth', case when next_skill = session_row.original_target_canonical_skill_id then 0 else bridge_depth + 1 end,
       'runtime_reason', null
     ), updated_at = now()
   where id = session_row.id;
  return next_step;
end;
$$;

create or replace function public.start_guided_learning_session_v4(
  p_institution_id uuid,
  p_student_id uuid,
  p_target_canonical_skill_id uuid
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  existing public.learning_guided_sessions%rowtype;
  created public.learning_guided_sessions%rowtype;
  target_skill public.learning_curriculum_skills%rowtype;
  first_lesson uuid;
  first_step uuid;
  question_set uuid;
  target_subject_id uuid;
  enrollment_class_id uuid;
  target_institution_skill_id uuid;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  select skill.* into target_skill
    from public.learning_curriculum_skills skill
   where skill.id = p_target_canonical_skill_id
     and skill.active
     and skill.node_kind = 'LEAF'
     and skill.content_readiness = 'ADAPTIVE_READY'
     and skill.mastery_targetable;
  if not found then raise exception 'LEARNING_V4_TARGET_NOT_READY'; end if;

  select session.* into existing
    from public.learning_guided_sessions session
   where session.institution_id = p_institution_id
     and session.student_id = p_student_id
     and session.target_canonical_skill_id = p_target_canonical_skill_id
     and session.status in ('ACTIVE', 'PAUSED')
   order by session.updated_at desc
   limit 1;
  if found and existing.planner_version = 'V4' then
    return jsonb_build_object('session_id', existing.id, 'created', false, 'current_step_id', existing.current_step_id, 'engine_version', 'V4');
  end if;
  if found then
    raise exception 'LEARNING_V4_EXISTING_SESSION_OTHER_ENGINE'
      using detail = 'An active or paused V2/V3 session owns this target; continue it with the V2-compatible service fallback.';
  end if;

  select link.learning_skill_id, unit.subject_id
    into target_institution_skill_id, target_subject_id
    from public.learning_skill_canonical_links link
    join public.learning_skills skill on skill.id = link.learning_skill_id and skill.active
    join public.learning_units unit on unit.id = skill.unit_id and unit.active
   where link.institution_id = p_institution_id
     and link.canonical_skill_id = p_target_canonical_skill_id
     and link.active
   order by link.created_at
   limit 1;
  select enrollment.class_id into enrollment_class_id
    from public.enrollments enrollment
   where enrollment.student_id = p_student_id
     and enrollment.active
     and enrollment.status = 'active'
   order by enrollment.created_at desc
   limit 1;
  select lesson.id into first_lesson
    from public.learning_skill_lessons lesson
   where lesson.canonical_skill_id = p_target_canonical_skill_id
     and lesson.version = 4
     and lesson.active
   order by lesson.id
   limit 1;
  if first_lesson is null then
    select set_row.id into question_set
      from public.learning_question_sets set_row
     where set_row.scope = 'GLOBAL'
       and set_row.institution_id is null
       and set_row.teacher_profile_id is null
       and set_row.canonical_skill_id = p_target_canonical_skill_id
       and set_row.purpose = 'PROBE'
       and set_row.version = 4
       and set_row.active
       and exists (select 1 from public.learning_question_set_items item join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active where item.question_set_id = set_row.id)
     limit 1;
    if question_set is null then raise exception 'LEARNING_V4_QUESTION_SET_EMPTY'; end if;
  end if;

  insert into public.learning_guided_sessions(
    institution_id, student_id, target_canonical_skill_id,
    original_target_canonical_skill_id, current_canonical_skill_id,
    target_institution_skill_id, subject_id, class_id, planner_version,
    decision_reason, metadata
  ) values (
    p_institution_id, p_student_id, p_target_canonical_skill_id,
    p_target_canonical_skill_id, p_target_canonical_skill_id,
    target_institution_skill_id, target_subject_id, enrollment_class_id,
    'V4', 'V4_TARGET_READY', jsonb_build_object('engine_version', 'V4', 'decision_reason', 'V4_TARGET_READY', 'replan_count', 0)
  ) returning * into created;
  insert into public.learning_guided_steps(
    institution_id, session_id, canonical_skill_id, step_type, purpose,
    position, status, lesson_id, question_set_id, started_at
  ) values (
    p_institution_id, created.id, p_target_canonical_skill_id,
    case when first_lesson is null then 'PROBE' else 'LESSON' end,
    case when first_lesson is null then 'PROBE' else null end,
    0, 'ACTIVE', first_lesson, question_set, now()
  ) returning id into first_step;
  update public.learning_guided_sessions set current_step_id = first_step where id = created.id;
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (p_institution_id, created.id, p_student_id, 'SESSION_STARTED', first_step, 'v4-session-start:' || created.id::text, jsonb_build_object('engine_version', 'V4', 'decision_reason', 'V4_TARGET_READY'));
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (p_institution_id, created.id, p_student_id, 'STEP_STARTED', first_step, 'v4-step-start:' || first_step::text, jsonb_build_object('step_type', case when first_lesson is null then 'PROBE' else 'LESSON' end));
  return jsonb_build_object('session_id', created.id, 'created', true, 'current_step_id', first_step, 'engine_version', 'V4');
end;
$$;

create or replace function public.get_guided_learning_session_v4(p_institution_id uuid, p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  select jsonb_build_object(
    'id', session.id,
    'student_id', session.student_id,
    'target_canonical_skill_id', session.target_canonical_skill_id,
    'original_target_canonical_skill_id', session.original_target_canonical_skill_id,
    'current_canonical_skill_id', session.current_canonical_skill_id,
    'current_step_id', session.current_step_id,
    'status', session.status,
    'planner_version', session.planner_version,
    'decision_reason', session.decision_reason,
    'replan_count', session.replan_count,
    'metadata', session.metadata,
    'current_step', (select jsonb_build_object('id', step.id, 'canonical_skill_id', step.canonical_skill_id, 'step_type', step.step_type, 'purpose', step.purpose, 'status', step.status, 'position', step.position, 'lesson_id', step.lesson_id) from public.learning_guided_steps step where step.id = session.current_step_id)
  ) into result
    from public.learning_guided_sessions session
   where session.institution_id = p_institution_id
     and session.student_id = p_student_id
     and session.planner_version = 'V4'
     and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
   order by session.updated_at desc
   limit 1;
  return result;
end;
$$;

create or replace function public.get_guided_learning_step_v4(p_step_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare step_row public.learning_guided_steps%rowtype; session_row public.learning_guided_sessions%rowtype; result jsonb;
begin
  select step.* into step_row
    from public.learning_guided_steps step
    join public.learning_guided_sessions session on session.id = step.session_id
   where step.id = p_step_id and session.planner_version = 'V4';
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  select session.* into session_row from public.learning_guided_sessions session where session.id = step_row.session_id;
  if not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then raise exception 'LEARNING_STEP_SCOPE_DENIED'; end if;
  select jsonb_build_object(
    'id', step_row.id, 'session_id', step_row.session_id, 'canonical_skill_id', step_row.canonical_skill_id,
    'step_type', step_row.step_type, 'purpose', step_row.purpose, 'status', step_row.status,
    'position', step_row.position, 'lesson_id', step_row.lesson_id,
    'lesson', (select jsonb_build_object('id', lesson.id, 'title', lesson.title, 'summary', lesson.summary, 'content_markdown', lesson.content_markdown, 'worked_example', lesson.worked_example, 'tips', lesson.tips, 'estimated_minutes', lesson.estimated_minutes) from public.learning_skill_lessons lesson where lesson.id = step_row.lesson_id),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', question.id, 'statement', question.statement, 'options', question.options, 'difficulty', question.difficulty, 'position', item.position) order by item.position) from public.learning_question_set_items item join public.learning_question_bank question on question.id = item.question_bank_id and question.active where item.question_set_id = step_row.question_set_id and not exists (select 1 from public.learning_guided_step_attempts previous_attempt where previous_attempt.session_id = step_row.session_id and exists (select 1 from jsonb_array_elements(previous_attempt.answers) answer where answer->>'question_bank_id' = question.id::text))), '[]'::jsonb)
  ) into result;
  if step_row.step_type in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW') and jsonb_array_length(result->'questions') = 0 then raise exception 'LEARNING_V4_QUESTION_SET_EMPTY'; end if;
  return result;
end;
$$;

create or replace function public.advance_guided_learning_session_v4(p_session_id uuid, p_step_id uuid, p_action text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare session_row public.learning_guided_sessions%rowtype; step_row public.learning_guided_steps%rowtype; existing_event jsonb; next_step uuid;
begin
  select session.* into session_row from public.learning_guided_sessions session where session.id = p_session_id and session.planner_version = 'V4' for update;
  if not found or not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then raise exception 'LEARNING_SESSION_SCOPE_DENIED'; end if;
  select jsonb_build_object('session_id', p_session_id, 'step_id', p_step_id, 'idempotent', true, 'current_step_id', session_row.current_step_id, 'session_status', session_row.status) into existing_event
    from public.learning_guided_session_events event where event.session_id = p_session_id and event.idempotency_key = p_idempotency_key order by event.created_at desc limit 1;
  if existing_event is not null then return existing_event; end if;
  select step.* into step_row from public.learning_guided_steps step where step.id = p_step_id and step.session_id = p_session_id for update;
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  if p_action not in ('LESSON_COMPLETED', 'TARGET_RETURNED', 'REVIEW_REQUESTED') then raise exception 'LEARNING_GUIDED_ACTION_INVALID'; end if;
  if step_row.status in ('COMPLETED', 'SKIPPED') then return jsonb_build_object('session_id', p_session_id, 'step_id', p_step_id, 'idempotent', true, 'current_step_id', session_row.current_step_id, 'session_status', session_row.status); end if;
  update public.learning_guided_steps set status = 'COMPLETED', completed_at = now(), updated_at = now() where id = p_step_id;
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (session_row.institution_id, p_session_id, session_row.student_id, 'STEP_COMPLETED', p_step_id, p_idempotency_key, jsonb_build_object('action', p_action, 'engine_version', 'V4'));
  next_step := private.append_guided_v4_next_step(session_row, step_row, case when p_action = 'REVIEW_REQUESTED' then 'GAP' else 'SUCCESS' end, p_idempotency_key || ':next');
  return jsonb_build_object('session_id', p_session_id, 'step_id', p_step_id, 'idempotent', false, 'current_step_id', next_step, 'session_status', (select status from public.learning_guided_sessions where id = p_session_id));
end;
$$;

create or replace function public.submit_guided_learning_step_v4(p_step_id uuid, p_answers jsonb, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare step_row public.learning_guided_steps%rowtype; session_row public.learning_guided_sessions%rowtype; item record; answer_item jsonb; expected jsonb; submitted jsonb; correct boolean; total integer := 0; correct_count integer := 0; score numeric(5,2); feedback jsonb := '[]'::jsonb; attempt_id uuid; next_step uuid; outcome text;
begin
  select step.* into step_row from public.learning_guided_steps step where step.id = p_step_id for update;
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  select session.* into session_row from public.learning_guided_sessions session where session.id = step_row.session_id and session.planner_version = 'V4';
  if not found or not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then raise exception 'LEARNING_STEP_SCOPE_DENIED'; end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then raise exception 'LEARNING_GUIDED_ANSWERS_INVALID'; end if;
  select attempt.id into attempt_id from public.learning_guided_step_attempts attempt where attempt.step_id = p_step_id and attempt.idempotency_key = p_idempotency_key;
  if attempt_id is not null then return (select jsonb_build_object('attempt_id', attempt.id, 'idempotent', true, 'score', attempt.score, 'correct_count', attempt.correct_count, 'total_questions', attempt.total_questions, 'feedback', attempt.feedback) from public.learning_guided_step_attempts attempt where attempt.id = attempt_id); end if;
  if step_row.status in ('COMPLETED', 'SKIPPED') then raise exception 'LEARNING_GUIDED_STEP_ALREADY_COMPLETED'; end if;
  for item in select bank.id, bank.correct_answer, bank.explanation, bank.metadata, set_item.position from public.learning_question_set_items set_item join public.learning_question_bank bank on bank.id = set_item.question_bank_id and bank.active where set_item.question_set_id = step_row.question_set_id order by set_item.position loop
    total := total + 1;
    select value into answer_item from jsonb_array_elements(p_answers) value where value->>'question_bank_id' = item.id::text limit 1;
    submitted := coalesce(answer_item->'answer', 'null'::jsonb);
    expected := coalesce(item.correct_answer, 'null'::jsonb);
    correct := submitted = expected;
    if correct then correct_count := correct_count + 1; end if;
    feedback := feedback || jsonb_build_array(jsonb_build_object('question_bank_id', item.id, 'is_correct', correct, 'correct_answer', item.correct_answer, 'explanation', item.explanation, 'misconception_code', case when not correct then item.metadata->>'misconception_code' else null end));
  end loop;
  if total = 0 then raise exception 'LEARNING_V4_QUESTION_SET_EMPTY'; end if;
  score := round((correct_count::numeric / total::numeric) * 100, 2);
  insert into public.learning_guided_step_attempts(institution_id, session_id, step_id, student_id, purpose, answers, feedback, score, correct_count, total_questions, idempotency_key)
  values (session_row.institution_id, session_row.id, step_row.id, session_row.student_id, step_row.purpose, p_answers, feedback, score, correct_count, total, p_idempotency_key) returning id into attempt_id;
  insert into public.learning_skill_evidence(institution_id, student_id, canonical_skill_id, source, correct, score, metadata)
  values (session_row.institution_id, session_row.student_id, step_row.canonical_skill_id, case step_row.purpose when 'PROBE' then 'DIAGNOSTIC' else step_row.purpose end, score >= 80, score, jsonb_build_object('engine_version', 'V4', 'guided_step_id', step_row.id, 'guided_attempt_id', attempt_id, 'purpose', step_row.purpose, 'feedback', feedback));
  perform private.refresh_learning_student_skill_state_v2(session_row.institution_id, session_row.student_id, step_row.canonical_skill_id);
  update public.learning_guided_steps set status = 'COMPLETED', completed_at = now(), evidence_run_id = attempt_id, updated_at = now() where id = step_row.id;
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (session_row.institution_id, session_row.id, session_row.student_id, 'EVIDENCE_RECORDED', step_row.id, p_idempotency_key, jsonb_build_object('score', score, 'purpose', step_row.purpose, 'engine_version', 'V4'));
  outcome := case when score >= 80 then 'SUCCESS' else 'GAP' end;
  next_step := private.append_guided_v4_next_step(session_row, step_row, outcome, p_idempotency_key || ':next');
  return jsonb_build_object('attempt_id', attempt_id, 'idempotent', false, 'score', score, 'correct_count', correct_count, 'total_questions', total, 'feedback', feedback, 'current_step_id', next_step, 'session_status', (select status from public.learning_guided_sessions where id = session_row.id));
end;
$$;

revoke all on function public.start_guided_learning_session_v4(uuid, uuid, uuid), public.get_guided_learning_session_v4(uuid, uuid), public.get_guided_learning_step_v4(uuid), public.advance_guided_learning_session_v4(uuid, uuid, text, text), public.submit_guided_learning_step_v4(uuid, jsonb, text) from public, anon;
grant execute on function public.start_guided_learning_session_v4(uuid, uuid, uuid), public.get_guided_learning_session_v4(uuid, uuid), public.get_guided_learning_step_v4(uuid), public.advance_guided_learning_session_v4(uuid, uuid, text, text), public.submit_guided_learning_step_v4(uuid, jsonb, text) to authenticated;
`);
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

const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  const command = process.argv[2] ?? 'validate';
  const result = command === 'compile' ? compileV4Pack() : validateV4Pack();
  console.log(JSON.stringify(result, null, 2));
}
