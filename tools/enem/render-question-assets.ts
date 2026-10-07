import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import type { ParsedEnemArtifact, ParsedEnemQuestion } from './parse.ts';
import { extractPdfGeometryPages, planStatementCrop, type PdfGeometryPage, type StatementCropPlan } from './geometry.ts';

export interface StatementAssetManifestItem {
  assetRole: 'STATEMENT';
  mediaType: 'STATEMENT_CROP';
  questionNumber: number;
  language: ParsedEnemQuestion['language'];
  page: number;
  storagePath: string;
  sha256: string;
  crop: { left: number; bottom: number; width: number; height: number };
}

export interface RenderedQuestionAssetManifest {
  questionNumber: number;
  language: ParsedEnemQuestion['language'];
  renderReady: boolean;
  sourceIntegrity: 'VERIFIED';
  excludedOptionLabels: string[];
  planReason: string | null;
  statementAssets: StatementAssetManifestItem[];
}

export interface EnemAssetRenderManifest {
  schemaVersion: 1;
  generatedAt: string;
  year: number;
  day: string;
  booklet: string;
  examPath: string;
  artifactKey: string;
  questions: RenderedQuestionAssetManifest[];
}

function artifactKey(artifact: Pick<ParsedEnemArtifact, 'year' | 'day' | 'booklet'>) {
  return `${artifact.year}-${artifact.day}-${artifact.booklet}`.replace(/[^A-Za-z0-9_-]+/g, '_');
}

export function renderQuestionKey(
  artifact: Pick<ParsedEnemArtifact, 'year' | 'day' | 'booklet'>,
  questionNumber: number,
  language: ParsedEnemQuestion['language'],
) {
  return `${artifactKey(artifact)}:${questionNumber}:${language ?? 'COMMON'}`;
}

function sha256(data: Buffer) {
  return createHash('sha256').update(data).digest('hex');
}

async function renderPages(pdfPath: string, pages: PdfGeometryPage[], scale: number) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(readFileSync(pdfPath)),
    disableWorker: true,
  });
  const document = await loadingTask.promise;
  const rendered = new Map<number, ReturnType<typeof createCanvas>>();
  try {
    for (const geometryPage of pages) {
      const page = await document.getPage(geometryPage.page);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      rendered.set(geometryPage.page, canvas);
      page.cleanup();
    }
    return rendered;
  } finally {
    await loadingTask.destroy();
  }
}

function cropPart(
  fullPage: ReturnType<typeof createCanvas>,
  page: PdfGeometryPage,
  plan: StatementCropPlan['parts'][number],
  scale: number,
) {
  const width = Math.max(1, Math.ceil(plan.bounds.width * scale));
  const height = Math.max(1, Math.ceil(plan.bounds.height * scale));
  const crop = createCanvas(width, height);
  const context = crop.getContext('2d');
  const sourceX = plan.bounds.left * scale;
  const sourceY = (page.height - plan.bounds.bottom - plan.bounds.height) * scale;
  context.drawImage(fullPage, sourceX, sourceY, width, height, 0, 0, width, height);
  return crop;
}

export async function renderStatementAssets(
  artifact: ParsedEnemArtifact,
  outputDir: string,
  options: { scale?: number } = {},
): Promise<EnemAssetRenderManifest> {
  const scale = options.scale ?? 1.5;
  const geometryPages = await extractPdfGeometryPages(artifact.examPath);
  const plans = new Map<number, StatementCropPlan>(artifact.questions.map((question) => [
    question.questionNumber,
    planStatementCrop(geometryPages, question.questionNumber),
  ]));
  const pagesToRender = geometryPages.filter((page) => [...plans.values()].some((plan) => plan.parts.some((part) => part.page === page.page)));
  const renderedPages = await renderPages(artifact.examPath, pagesToRender, scale);
  const key = artifactKey(artifact);
  const questions = artifact.questions.map<RenderedQuestionAssetManifest>((question: ParsedEnemQuestion) => {
    const plan = plans.get(question.questionNumber)!;
    const assets: StatementAssetManifestItem[] = [];
    for (const part of plan.parts) {
      const page = geometryPages.find((candidate) => candidate.page === part.page);
      const fullPage = renderedPages.get(part.page);
      if (!page || !fullPage || plan.status !== 'READY') continue;
      const buffer = cropPart(fullPage, page, part, scale).toBuffer('image/png');
      const languageKey = question.language ?? 'COMMON';
      const relativePath = join(key, `question-${question.questionNumber}-${languageKey}`, `statement-page-${part.page}.png`).replaceAll('\\', '/');
      const destination = resolve(outputDir, relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, buffer);
      assets.push({
        assetRole: 'STATEMENT',
        mediaType: 'STATEMENT_CROP',
        questionNumber: question.questionNumber,
        language: question.language,
        page: part.page,
        storagePath: relativePath,
        sha256: sha256(buffer),
        crop: part.bounds,
      });
    }
    return {
      questionNumber: question.questionNumber,
      language: question.language,
      renderReady: plan.status === 'READY' && assets.length > 0 && question.mediaStatus === 'NOT_DETECTED',
      sourceIntegrity: 'VERIFIED',
      excludedOptionLabels: plan.excludedOptionLabels,
      planReason: plan.reason,
      statementAssets: assets,
    };
  });
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year: artifact.year,
    day: artifact.day,
    booklet: artifact.booklet,
    examPath: artifact.examPath,
    artifactKey: key,
    questions,
  };
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Uso: npm run enem:render -- --parsed <parsed.json> --out-dir <assets-dir> --manifest <assets-manifest.json>');
    return;
  }
  const parsedPath = argument('--parsed', args) ?? '.runtime/enem-parsed-2025.json';
  const outputDir = argument('--out-dir', args) ?? '.runtime/enem-question-assets';
  const manifestPath = argument('--manifest', args) ?? '.runtime/enem-question-assets-manifest.json';
  const parsed = JSON.parse(readFileSync(resolve(parsedPath), 'utf8')) as { artifacts: ParsedEnemArtifact[] };
  const manifests: EnemAssetRenderManifest[] = [];
  for (const artifact of parsed.artifacts) manifests.push(await renderStatementAssets(artifact, outputDir));
  const output = resolve(manifestPath);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), artifacts: manifests }, null, 2)}\n`, 'utf8');
  const ready = manifests.flatMap((manifest) => manifest.questions).filter((question) => question.renderReady).length;
  console.log(`ENEM_ASSETS_RENDERED artifacts=${manifests.length} render_ready=${ready} output=${output}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
