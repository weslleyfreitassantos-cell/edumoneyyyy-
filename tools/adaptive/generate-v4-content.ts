import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dirname, fileURLToPath } from 'node:url';

type Readiness = 'GRAPH_ONLY' | 'CONTENT_READY' | 'ADAPTIVE_READY';
type AuthoringStatus = 'SCAFFOLD' | 'AUTHORED' | 'TECH_VALIDATED' | 'PEDAGOGICAL_REVIEWED';

interface Leaf {
  code: string;
  title: string;
  objective: string;
  description: string;
  masteryCapability: string;
  readiness: Readiness;
  content_authoring_status: AuthoringStatus;
}

interface SubjectPack {
  code: string;
  name: string;
  anchors: Array<{ code: string; title: string }>;
  leaves: Leaf[];
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACK = join(ROOT, 'content', 'adaptive', 'tec-escola-core-v4');
const SUBJECTS = join(PACK, 'subjects');
const SUBJECT_COUNT = 15;
const BLACKLIST = [
  /na atividade\b/i,
  /na etapa\b/i,
  /trilha de\b/i,
  /trilha [A-Z_]+/i,
  /aplicar .* usando as evidencias/i,
  /ignorar o contexto/i,
  /trocar .* por outro conceito/i,
  /concluir antes de observar/i,
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function normalized(value: string): string {
  return value.toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hasBlacklistedPhrase(value: string): boolean {
  return BLACKLIST.some((pattern) => pattern.test(value));
}

export function validateSourcePacks() {
  const errors: string[] = [];
  const subjectDirs = readdirSync(SUBJECTS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  const packs = subjectDirs.map((entry) => ({
    dir: entry.name,
    skills: readJson<SubjectPack>(join(SUBJECTS, entry.name, 'skills.json')),
    lessons: readJson<Array<Record<string, unknown>>>(join(SUBJECTS, entry.name, 'lessons.json')),
    questions: readJson<Array<Record<string, unknown>>>(join(SUBJECTS, entry.name, 'questions.json')),
  }));

  if (packs.length !== SUBJECT_COUNT) errors.push(`SUBJECT_COUNT:${packs.length}`);
  const semanticSkills = new Map<string, string>();
  for (const pack of packs) {
    for (const leaf of pack.skills.leaves) {
      if (!leaf.objective?.trim() || !leaf.description?.trim() || !leaf.masteryCapability?.trim()) {
        errors.push(`LEAF_WITHOUT_EXPLICIT_OUTCOME:${leaf.code}`);
      }
      if (!leaf.content_authoring_status) errors.push(`LEAF_WITHOUT_AUTHORING_STATUS:${leaf.code}`);
      if (leaf.readiness === 'ADAPTIVE_READY' && leaf.content_authoring_status === 'SCAFFOLD') {
        errors.push(`READY_SCAFFOLD:${leaf.code}`);
      }
      if (/_\d{2}$/.test(leaf.code)) errors.push(`NUMERIC_LEAF_CODE:${leaf.code}`);
      const semantic = normalized(`${leaf.title} ${leaf.objective}`);
      const previous = semanticSkills.get(semantic);
      if (previous) errors.push(`DUPLICATE_SEMANTIC_SKILL:${previous}:${leaf.code}`);
      semanticSkills.set(semantic, leaf.code);
    }
    for (const item of [...pack.lessons, ...pack.questions]) {
      if (hasBlacklistedPhrase(JSON.stringify(item))) errors.push(`TEMPLATE_PHRASE:${pack.skills.code}`);
    }
  }
  return { valid: errors.length === 0, subjectCount: packs.length, errors };
}

const result = validateSourcePacks();
if (!result.valid) throw new Error(`V4_SOURCE_VALIDATION_FAILED\n${result.errors.join('\n')}`);
console.log(JSON.stringify({ ...result, writes: 0, mode: 'VALIDATE_ONLY' }, null, 2));
