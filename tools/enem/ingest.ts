import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import {
  buildEnemIngestionOutput,
  enemManifestKey,
  type EnemManifestEntry,
  type EnemQuestionInput,
} from '../../src/services/enemIngestion.ts';

type ManifestFileEntry = EnemManifestEntry & {
  artifactPath?: string;
  questionsPath?: string;
  questions?: EnemQuestionInput[];
};

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function resolveRelative(baseDir: string, path: string) {
  return isAbsolute(path) ? path : resolve(baseDir, path);
}

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function usage(): never {
  throw new Error('Uso: npm run enem:ingest -- --manifest <manifest.json> --out <normalized.json>');
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const args = process.argv.slice(2);
const manifestPath = argument('--manifest', args);
const outputPath = argument('--out', args);
if (!manifestPath || !outputPath) usage();

const resolvedManifestPath = resolve(manifestPath);
const manifestFile = readJson(resolvedManifestPath) as { entries?: ManifestFileEntry[] };
const entries = manifestFile.entries ?? [];
const manifestDir = dirname(resolvedManifestPath);
const normalizedEntries: EnemManifestEntry[] = [];
const questionsByKey = new Map<string, EnemQuestionInput[]>();

for (const entry of entries) {
  const artifactHash = entry.artifactPath
    ? sha256(resolveRelative(manifestDir, entry.artifactPath))
    : entry.artifactHash ?? null;
  if (entry.artifactHash && artifactHash !== entry.artifactHash) {
    throw new Error(`ENEM_ARTIFACT_HASH_MISMATCH:${enemManifestKey(entry)}`);
  }

  const questions = entry.questionsPath
    ? readJson(resolveRelative(manifestDir, entry.questionsPath))
    : entry.questions ?? [];
  if (!Array.isArray(questions)) {
    throw new Error(`ENEM_QUESTIONS_INVALID:${enemManifestKey(entry)}`);
  }

  const {
    artifactPath: _artifactPath,
    questionsPath: _questionsPath,
    questions: _questions,
    ...manifestEntry
  } = entry;
  normalizedEntries.push({ ...manifestEntry, artifactHash });
  questionsByKey.set(enemManifestKey(entry), questions);
}

const output = buildEnemIngestionOutput(normalizedEntries, questionsByKey);
writeFileSync(resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`ENEM_INGESTION_OK entries=${output.entries.length} questions=${output.questions.length} output=${resolve(outputPath)}`);
