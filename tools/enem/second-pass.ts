import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnemReviewReason, EnemParseResult, ParsedEnemArtifact, ParsedEnemQuestion } from './parse.ts';
import { extractPdfGeometryPages, groupGeometryLines, normalizeGeometryMarker, type PdfGeometryLine, type PdfGeometryPage } from './geometry.ts';

export interface GeometryRecoveryAttempt {
  questionNumber: number;
  language: ParsedEnemQuestion['language'];
  page: number;
  recoveredOptions: string[];
  status: 'RECOVERED' | 'NOT_RECOVERED' | 'AMBIGUOUS';
  reason: string;
}

export interface SecondPassArtifact {
  year: number;
  day: string;
  booklet: string;
  attempts: GeometryRecoveryAttempt[];
}

export interface SecondPassResult {
  schemaVersion: 1;
  generatedAt: string;
  before: { missingOptions: number; reviewQuestions: number };
  after: { missingOptions: number; reviewQuestions: number };
  recoveredOptions: number;
  artifacts: SecondPassArtifact[];
  parsed: EnemParseResult['artifacts'];
}

interface OptionCandidate {
  label: string;
  text: string;
  page: number;
  x: number;
  y: number;
}

function markerQuestionNumber(line: PdfGeometryLine): number | null {
  const value = normalizeGeometryMarker(line.items.map((item) => item.text).join(' '));
  const match = value.match(/QUEST(?:AO|AO)(\d{1,3})/);
  return match ? Number(match[1]) : null;
}

function optionFromItem(text: string): { label: string; inlineText: string } | null {
  const match = text.trim().match(/^([A-E])(?:[.)\-:]?)(?:\s+(.*))?$/i);
  if (!match) return null;
  return { label: match[1].toUpperCase(), inlineText: match[2]?.trim() ?? '' };
}

function candidatesForLines(lines: PdfGeometryLine[]): OptionCandidate[] {
  const candidates: OptionCandidate[] = [];
  for (const line of lines) {
    for (let index = 0; index < line.items.length; index += 1) {
      const parsed = optionFromItem(line.items[index].text);
      if (!parsed) continue;
      const labelItem = line.items[index];
      const sameLineText = [parsed.inlineText, ...line.items.slice(index + 1).map((item) => item.text)]
        .filter(Boolean)
        .join(' ')
        .trim();
      candidates.push({
        label: parsed.label,
        text: sameLineText,
        page: line.page,
        x: labelItem.x,
        y: line.y,
      });
      break;
    }
  }
  return candidates;
}

function questionLines(pages: PdfGeometryPage[], questionNumber: number): PdfGeometryLine[] {
  const allLines = pages.flatMap((page) => groupGeometryLines(page));
  const markers = allLines
    .map((line, index) => ({ line, index, questionNumber: markerQuestionNumber(line) }))
    .filter((item): item is { line: PdfGeometryLine; index: number; questionNumber: number } => item.questionNumber !== null);
  const current = markers.find((item) => item.questionNumber === questionNumber);
  if (!current) return [];
  const next = markers.find((item) => item.index > current.index && item.questionNumber !== questionNumber);
  return allLines.slice(current.index + 1, next?.index ?? allLines.length);
}

export function recoverOptionsFromGeometry(pages: PdfGeometryPage[], questionNumber: number): { status: GeometryRecoveryAttempt['status']; options: string[]; reason: string } {
  const candidates = candidatesForLines(questionLines(pages, questionNumber))
    .filter((candidate) => candidate.text.length > 0);
  const byLabel = new Map<string, OptionCandidate>();
  for (const candidate of candidates) {
    if (!byLabel.has(candidate.label)) byLabel.set(candidate.label, candidate);
  }
  const labels = ['A', 'B', 'C', 'D', 'E'];
  if (labels.every((label) => byLabel.has(label))) {
    return {
      status: 'RECOVERED',
      options: labels.map((label) => byLabel.get(label)!.text),
      reason: 'GEOMETRIC_A_TO_E_WITH_TEXT',
    };
  }
  const found = [...byLabel.keys()].sort().join('');
  return {
    status: found.length >= 5 ? 'AMBIGUOUS' : 'NOT_RECOVERED',
    options: [],
    reason: found ? `GEOMETRIC_LABELS_${found}` : 'NO_GEOMETRIC_OPTION_SET',
  };
}

function applyRecovery(question: ParsedEnemQuestion, options: string[]): ParsedEnemQuestion {
  const reviewReasons = [...new Set((question.reviewReasons ?? []).filter((reason) => reason !== 'MISSING_OPTIONS'))] as EnemReviewReason[];
  return {
    ...question,
    options,
    reviewReasons,
    qualityState: reviewReasons.length === 0 ? 'PARSED' : 'REVIEW_REQUIRED',
  };
}

export async function runSecondPass(parsed: EnemParseResult): Promise<SecondPassResult> {
  const parsedArtifacts: EnemParseResult['artifacts'] = [];
  const artifactReports: SecondPassArtifact[] = [];
  let beforeMissing = 0;
  let afterMissing = 0;
  let beforeReview = 0;
  let afterReview = 0;
  let recoveredOptions = 0;

  for (const artifact of parsed.artifacts) {
    const targets = artifact.questions.filter((question) => question.reviewReasons?.includes('MISSING_OPTIONS'));
    beforeMissing += targets.length;
    beforeReview += artifact.questions.filter((question) => question.qualityState !== 'PARSED').length;
    if (!targets.length) {
      parsedArtifacts.push(artifact);
      artifactReports.push({ year: artifact.year, day: artifact.day, booklet: artifact.booklet, attempts: [] });
      afterReview += artifact.questions.filter((question) => question.qualityState !== 'PARSED').length;
      continue;
    }

    const pages = await extractPdfGeometryPages(artifact.examPath);
    const attempts: GeometryRecoveryAttempt[] = [];
    const questions = artifact.questions.map((question) => {
      if (!question.reviewReasons?.includes('MISSING_OPTIONS')) return question;
      const geometry = recoverOptionsFromGeometry(pages, question.questionNumber);
      const attempt: GeometryRecoveryAttempt = {
        questionNumber: question.questionNumber,
        language: question.language,
        page: question.page,
        recoveredOptions: geometry.options,
        status: geometry.status,
        reason: geometry.reason,
      };
      attempts.push(attempt);
      if (geometry.status !== 'RECOVERED') return question;
      recoveredOptions += 1;
      return applyRecovery(question, geometry.options);
    });
    const updated = { ...artifact, questions };
    afterMissing += questions.filter((question) => question.reviewReasons?.includes('MISSING_OPTIONS')).length;
    afterReview += questions.filter((question) => question.qualityState !== 'PARSED').length;
    parsedArtifacts.push(updated);
    artifactReports.push({ year: artifact.year, day: artifact.day, booklet: artifact.booklet, attempts });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    before: { missingOptions: beforeMissing, reviewQuestions: beforeReview },
    after: { missingOptions: afterMissing, reviewQuestions: afterReview },
    recoveredOptions,
    artifacts: artifactReports,
    parsed: parsedArtifacts,
  };
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli() {
  const args = process.argv.slice(2);
  const parsedPath = argument('--parsed', args) ?? '.runtime/enem-parsed-2025.json';
  const outputPath = argument('--out', args) ?? '.runtime/enem-second-pass-2025.json';
  const parsedOutputPath = argument('--parsed-out', args) ?? '.runtime/enem-parsed-2025-second-pass.json';
  const parsed = JSON.parse(readFileSync(resolve(parsedPath), 'utf8')) as EnemParseResult;
  const result = await runSecondPass(parsed);
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const resolvedParsedOutput = resolve(parsedOutputPath);
  writeFileSync(resolvedParsedOutput, `${JSON.stringify({ ...parsed, parsedAt: result.generatedAt, artifacts: result.parsed }, null, 2)}\n`, 'utf8');
  console.log(`ENEM_SECOND_PASS_OK missing_before=${result.before.missingOptions} missing_after=${result.after.missingOptions} recovered=${result.recoveredOptions} review_after=${result.after.reviewQuestions} output=${resolvedOutput} parsed_output=${resolvedParsedOutput}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
