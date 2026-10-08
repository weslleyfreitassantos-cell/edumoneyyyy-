import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnemDiscoveryResult } from './discover.ts';
import type { EnemDownloadedArtifact } from './download.ts';
import type { EnemCanonicalizationResult } from './canonicalize.ts';
import type { EnemParseResult, EnemReviewReason } from './parse.ts';

export interface EnemReviewBreakdown {
  schemaVersion: 1;
  reviewTotal: number;
  reviewQuestionCount: number;
  reasonCounts: Record<EnemReviewReason, number>;
  crossBookletMismatches: number;
  missingAnswerKeys: number;
  otherQuarantineIssues: number;
  quarantined: number;
  d6Cd11: {
    officialExamFound: boolean;
    officialAnswerKeyFound: boolean;
    discoveryPairPresent: boolean;
    rootCause: string | null;
  };
}

const REASONS: EnemReviewReason[] = [
  'MISSING_OPTIONS',
  'MEDIA_REQUIRED',
  'UNKNOWN_OFFICIAL_ANSWER',
  'FORMULA_REVIEW',
  'TEXT_EXTRACTION_LOW_CONFIDENCE',
  'DUPLICATE_IDENTITY',
  'LANGUAGE_AMBIGUOUS',
  'MISSING_ANSWER_KEY',
  'STATEMENT_TOO_SHORT',
  'HEADER_CONTAMINATION',
  'PAGE_BOUNDARY_ERROR',
  'CONTROL_CHARACTERS',
  'CROSS_COLUMN_CONTAMINATION',
  'HEADER_ONLY_CROP',
  'OPTION_INTEGRITY',
  'STATEMENT_INTEGRITY',
  'OTHER',
];

function emptyReasonCounts(): Record<EnemReviewReason, number> {
  return Object.fromEntries(REASONS.map((reason) => [reason, 0])) as Record<EnemReviewReason, number>;
}

function isMissingAnswerKeyIssue(issue: string) {
  return /(?:UNPAIRED_ARTIFACT|:GB:|GB_impresso|ANSWER_KEY)/i.test(issue);
}

export function buildEnemReviewBreakdown(
  discovery: EnemDiscoveryResult,
  downloads: { artifacts: EnemDownloadedArtifact[]; issues: string[] },
  parsed: EnemParseResult,
  canonical: EnemCanonicalizationResult,
): EnemReviewBreakdown {
  const reasonCounts = emptyReasonCounts();
  let reviewQuestionCount = 0;
  for (const artifact of parsed.artifacts) {
    for (const question of artifact.questions) {
      if (question.qualityState !== 'REVIEW_REQUIRED') continue;
      reviewQuestionCount += 1;
      const reasons = question.reviewReasons?.length ? question.reviewReasons : ['OTHER' as const];
      for (const reason of reasons) reasonCounts[reason] += 1;
    }
  }

  const crossBookletMismatches = canonical.crossBookletMismatches.length;
  const missingAnswerKeys = downloads.issues.filter(isMissingAnswerKeyIssue).length;
  const otherQuarantineIssues = downloads.issues.filter((issue) => !isMissingAnswerKeyIssue(issue)).length;
  const quarantined = reviewQuestionCount + crossBookletMismatches + new Set(downloads.issues).size;
  const d6Cd11Discovery = discovery.artifacts.find((artifact) => artifact.day === 'D6' && artifact.booklet === 'CD11');
  const d6Cd11Download = downloads.artifacts.find((artifact) => artifact.day === 'D6' && artifact.booklet === 'CD11');
  const d6Cd11Issue = downloads.issues.find((issue) => issue.includes('2025_D6_CD11')) ?? null;

  return {
    schemaVersion: 1,
    reviewTotal: quarantined,
    reviewQuestionCount,
    reasonCounts,
    crossBookletMismatches,
    missingAnswerKeys,
    otherQuarantineIssues,
    quarantined,
    d6Cd11: {
      officialExamFound: Boolean(d6Cd11Discovery?.examUrl),
      officialAnswerKeyFound: Boolean(d6Cd11Download?.answerKeyPath),
      discoveryPairPresent: Boolean(d6Cd11Discovery?.examUrl && d6Cd11Discovery.answerKeyUrl),
      rootCause: d6Cd11Issue
        ? 'CATALOG_PAIR_PRESENT_BUT_OFFICIAL_DOWNLOAD_FAILED'
        : null,
    },
  };
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli() {
  const args = process.argv.slice(2);
  const discoveryPath = argument('--discovery', args) ?? '.runtime/enem-discovery-2025.json';
  const downloadsPath = argument('--downloads', args) ?? '.runtime/enem-download-2025.json';
  const parsedPath = argument('--parsed', args) ?? '.runtime/enem-parsed-2025.json';
  const canonicalPath = argument('--canonical', args) ?? '.runtime/enem-canonical-2025.json';
  const outputPath = argument('--out', args) ?? '.runtime/enem-review-report-2025.json';
  const discovery = JSON.parse(readFileSync(resolve(discoveryPath), 'utf8')) as EnemDiscoveryResult;
  const downloads = JSON.parse(readFileSync(resolve(downloadsPath), 'utf8')) as { artifacts: EnemDownloadedArtifact[]; issues: string[] };
  const parsed = JSON.parse(readFileSync(resolve(parsedPath), 'utf8')) as EnemParseResult;
  const canonical = JSON.parse(readFileSync(resolve(canonicalPath), 'utf8')) as EnemCanonicalizationResult;
  const result = buildEnemReviewBreakdown(discovery, downloads, parsed, canonical);
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(
    `ENEM_REVIEW_BREAKDOWN_OK total=${result.reviewTotal} questions=${result.reviewQuestionCount} missingOptions=${result.reasonCounts.MISSING_OPTIONS} media=${result.reasonCounts.MEDIA_REQUIRED} text=${result.reasonCounts.TEXT_EXTRACTION_LOW_CONFIDENCE + result.reasonCounts.STATEMENT_TOO_SHORT + result.reasonCounts.HEADER_CONTAMINATION} mismatches=${result.crossBookletMismatches} missingKeys=${result.missingAnswerKeys} output=${resolvedOutput}`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
