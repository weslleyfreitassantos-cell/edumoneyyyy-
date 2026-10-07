import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnemDownloadedArtifact } from './download.ts';
import type { EnemCanonicalizationResult } from './canonicalize.ts';
import type { EnemParseResult } from './parse.ts';
import { isEnemImportableQuestion } from './importability.ts';

export interface EnemImportDryRun {
  schemaVersion: 1;
  manifestVersion: string;
  manifestFingerprint: string;
  status: 'PASS' | 'PASS_WITH_QUARANTINE' | 'FAIL';
  years: number[];
  artifactCount: number;
  parsedCanonicalQuestionCount: number;
  importableCanonicalQuestionCount: number;
  parsedOccurrenceCount: number;
  importableOccurrenceCount: number;
  canonicalQuestionCount: number;
  occurrenceCount: number;
  reviewRequired: number;
  quarantined: number;
  duplicateCanonicalIds: number;
  duplicateOccurrences: number;
  sourceHashesVerified: boolean;
  rollbackAvailable: true;
  databaseWrites: 0;
  productionTouched: false;
  issues: string[];
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function buildEnemImportDryRun(
  downloads: { artifacts: EnemDownloadedArtifact[]; issues: string[] },
  parsed: EnemParseResult,
  canonical: EnemCanonicalizationResult,
  options: { manifestVersion?: string } = {},
): EnemImportDryRun {
  const parsedQuestions = canonical.canonicalQuestions.filter((question) => question.qualityState === 'PARSED');
  const importableQuestions = parsedQuestions.filter(isEnemImportableQuestion);
  const importableIds = importableQuestions.map((question) => question.canonicalId);
  const duplicateCanonicalIds = importableIds.length - new Set(importableIds).size;
  const parsedOccurrences = parsedQuestions.flatMap((question) => question.occurrences);
  const importableOccurrences = importableQuestions.flatMap((question) => question.occurrences);
  const occurrenceKeys = importableOccurrences.map((occurrence) => [
    occurrence.year,
    occurrence.day,
    occurrence.booklet,
    occurrence.questionNumber,
    occurrence.language ?? '',
  ].join(':'));
  const duplicateOccurrences = occurrenceKeys.length - new Set(occurrenceKeys).size;
  const sourceHashesVerified = downloads.artifacts.every((artifact) =>
    /^[0-9a-f]{64}$/.test(artifact.examSha256) && /^[0-9a-f]{64}$/.test(artifact.answerKeySha256));
  const issues = [...new Set([
    ...downloads.issues,
    ...parsed.issues,
    ...canonical.crossBookletMismatches.map((item) => `CROSS_BOOKLET_MISMATCH:${item.group}`),
  ])];
  if (!sourceHashesVerified) issues.push('SOURCE_HASH_INVALID');
  if (duplicateCanonicalIds > 0) issues.push('DUPLICATE_CANONICAL_IDS');
  if (duplicateOccurrences > 0) issues.push('DUPLICATE_OCCURRENCES');
  const hardFailure = !sourceHashesVerified || duplicateCanonicalIds > 0 || duplicateOccurrences > 0;
  const quarantined = canonical.reviewRequired + canonical.crossBookletMismatches.length + new Set(downloads.issues).size;
  const fingerprintInput = JSON.stringify({
    artifacts: downloads.artifacts.map((artifact) => ({
      year: artifact.year,
      day: artifact.day,
      booklet: artifact.booklet,
      examSha256: artifact.examSha256,
      answerKeySha256: artifact.answerKeySha256,
    })),
    canonicalIds: importableIds,
  });
  return {
    schemaVersion: 1,
    manifestVersion: options.manifestVersion ?? 'ENEM_OFFICIAL_2025_CANARY_V1',
    manifestFingerprint: sha256(fingerprintInput),
    status: hardFailure ? 'FAIL' : quarantined > 0 ? 'PASS_WITH_QUARANTINE' : 'PASS',
    years: [...new Set(downloads.artifacts.map((artifact) => artifact.year))].sort(),
    artifactCount: downloads.artifacts.length,
    parsedCanonicalQuestionCount: parsedQuestions.length,
    importableCanonicalQuestionCount: importableQuestions.length,
    parsedOccurrenceCount: parsedOccurrences.length,
    importableOccurrenceCount: importableOccurrences.length,
    canonicalQuestionCount: importableQuestions.length,
    occurrenceCount: importableOccurrences.length,
    reviewRequired: canonical.reviewRequired,
    quarantined,
    duplicateCanonicalIds,
    duplicateOccurrences,
    sourceHashesVerified,
    rollbackAvailable: true,
    databaseWrites: 0,
    productionTouched: false,
    issues,
  };
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli() {
  const args = process.argv.slice(2);
  const downloadsPath = argument('--downloads', args) ?? '.runtime/enem-download-2025.json';
  const parsedPath = argument('--parsed', args) ?? '.runtime/enem-parsed-2025.json';
  const canonicalPath = argument('--canonical', args) ?? '.runtime/enem-canonical-2025.json';
  const outputPath = argument('--out', args) ?? '.runtime/enem-import-dry-run-2025.json';
  const manifestVersion = argument('--manifest-version', args);
  const downloads = JSON.parse(readFileSync(resolve(downloadsPath), 'utf8')) as { artifacts: EnemDownloadedArtifact[]; issues: string[] };
  const parsed = JSON.parse(readFileSync(resolve(parsedPath), 'utf8')) as EnemParseResult;
  const canonical = JSON.parse(readFileSync(resolve(canonicalPath), 'utf8')) as EnemCanonicalizationResult;
  const result = buildEnemImportDryRun(downloads, parsed, canonical, { manifestVersion });
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`ENEM_IMPORT_DRY_RUN status=${result.status} parsedCanonical=${result.parsedCanonicalQuestionCount} importableCanonical=${result.importableCanonicalQuestionCount} parsedOccurrences=${result.parsedOccurrenceCount} importableOccurrences=${result.importableOccurrenceCount} quarantined=${result.quarantined} output=${resolvedOutput}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
