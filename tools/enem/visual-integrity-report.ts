import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnemParseResult } from './parse.ts';
import type { EnemAssetRenderManifest, RenderedQuestionAssetManifest } from './render-question-assets.ts';

export type EnemVisualCategory =
  | 'TEXT_ONLY_OPTIONS'
  | 'FORMULA_OPTIONS'
  | 'IMAGE_OPTIONS'
  | 'MIXED_TEXT_IMAGE_OPTIONS'
  | 'MULTIPAGE'
  | 'MULTICOLUMN'
  | 'OTHER_COMPLEX';

export interface EnemVisualIntegrityReport {
  schemaVersion: 1;
  generatedAt: string;
  questionCount: number;
  renderReady: number;
  reviewRequired: number;
  statementContainsOptionsFailures: number;
  optionOverlapFailures: number;
  categories: Record<EnemVisualCategory, number>;
  samples: Partial<Record<EnemVisualCategory, string[]>>;
}

const CATEGORIES: EnemVisualCategory[] = [
  'TEXT_ONLY_OPTIONS',
  'FORMULA_OPTIONS',
  'IMAGE_OPTIONS',
  'MIXED_TEXT_IMAGE_OPTIONS',
  'MULTIPAGE',
  'MULTICOLUMN',
  'OTHER_COMPLEX',
];

function questionKey(manifest: EnemAssetRenderManifest, question: RenderedQuestionAssetManifest) {
  return `${manifest.artifactKey}:${question.questionNumber}:${question.language ?? 'COMMON'}`;
}

function assetCount(question: RenderedQuestionAssetManifest) {
  return Object.values(question.optionAssets ?? {}).flat().length;
}

function hasCompleteOptionAssetSet(question: RenderedQuestionAssetManifest) {
  return (['A', 'B', 'C', 'D', 'E'] as const).every(
    (label) => (question.optionAssets?.[label] ?? []).length > 0,
  );
}

export function buildEnemVisualIntegrityReport(
  parsed: EnemParseResult,
  assets: { artifacts: EnemAssetRenderManifest[] },
): EnemVisualIntegrityReport {
  const parsedByKey = new Map<string, string[]>();
  for (const artifact of parsed.artifacts) {
    for (const question of artifact.questions) {
      parsedByKey.set(`${artifact.year}-${artifact.day}-${artifact.booklet}:${question.questionNumber}:${question.language ?? 'COMMON'}`, question.options);
    }
  }
  const categories = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<EnemVisualCategory, number>;
  const samples: Partial<Record<EnemVisualCategory, string[]>> = {};
  let questionCount = 0;
  let renderReady = 0;
  let reviewRequired = 0;
  let statementContainsOptionsFailures = 0;
  let optionOverlapFailures = 0;
  const add = (category: EnemVisualCategory, key: string) => {
    categories[category] += 1;
    const list = samples[category] ?? [];
    if (list.length < 5) list.push(key);
    samples[category] = list;
  };

  for (const manifest of assets.artifacts) {
    for (const question of manifest.questions) {
      questionCount += 1;
      if (question.renderReady) renderReady += 1;
      else reviewRequired += 1;
      if (question.statementContainsOptions) statementContainsOptionsFailures += 1;
      if (question.planReason === 'OPTION_OVERLAP' || question.planReason === 'STATEMENT_OPTION_OVERLAP') optionOverlapFailures += 1;
      const parsedOptions = parsedByKey.get(`${manifest.artifactKey}:${question.questionNumber}:${question.language ?? 'COMMON'}`);
      const optionAssets = assetCount(question);
      const completeVisualOptions = hasCompleteOptionAssetSet(question);
      const textOptions = (parsedOptions ?? []).filter((option) => option.trim()).length;
      if (completeVisualOptions) {
        if (textOptions === 0) add('IMAGE_OPTIONS', questionKey(manifest, question));
        else add('MIXED_TEXT_IMAGE_OPTIONS', questionKey(manifest, question));
      } else if (question.renderMode === 'TEXT_OPTIONS' && question.optionsIntegrity === 'VERIFIED') {
        add('TEXT_ONLY_OPTIONS', questionKey(manifest, question));
      } else {
        add('OTHER_COMPLEX', questionKey(manifest, question));
      }
      if ((parsedOptions ?? []).some((option) => /(?:\\frac|\\sqrt|[∑∫≤≥≠≈→←])/.test(option))) add('FORMULA_OPTIONS', questionKey(manifest, question));
      const pages = new Set([
        ...question.statementAssets.map((asset) => asset.page),
        ...Object.values(question.optionAssets ?? {}).flat().map((asset) => asset.page),
      ]);
      if (pages.size > 1) add('MULTIPAGE', questionKey(manifest, question));
      if (question.sourceColumn && question.sourceColumn !== 'FULL') add('MULTICOLUMN', questionKey(manifest, question));
      if (!question.renderReady && optionAssets > 0 && !question.planReason) add('OTHER_COMPLEX', questionKey(manifest, question));
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    questionCount,
    renderReady,
    reviewRequired,
    statementContainsOptionsFailures,
    optionOverlapFailures,
    categories,
    samples,
  };
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli() {
  const args = process.argv.slice(2);
  const parsedPath = resolve(argument('--parsed', args) ?? '.runtime/enem-parsed-2025.json');
  const assetsPath = resolve(argument('--assets', args) ?? '.runtime/enem-assets-primary-language-v2.json');
  const outputPath = resolve(argument('--out', args) ?? '.runtime/enem-visual-integrity-report-v2.json');
  const parsed = JSON.parse(readFileSync(parsedPath, 'utf8')) as EnemParseResult;
  const assets = JSON.parse(readFileSync(assetsPath, 'utf8')) as { artifacts: EnemAssetRenderManifest[] };
  const report = buildEnemVisualIntegrityReport(parsed, assets);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`ENEM_VISUAL_INTEGRITY_REPORT questions=${report.questionCount} render_ready=${report.renderReady} review=${report.reviewRequired} statement_options=${report.statementContainsOptionsFailures} overlaps=${report.optionOverlapFailures} output=${outputPath}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
