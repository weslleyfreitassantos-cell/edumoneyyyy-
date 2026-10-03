import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnemAnswer, EnemLanguage, EnemQualityState, ParsedEnemQuestion } from './parse.ts';

export interface EnemQuestionOccurrence {
  year: number;
  day: string;
  booklet: string;
  questionNumber: number;
  language: EnemLanguage;
  officialAnswer: EnemAnswer;
}

export interface CanonicalEnemQuestion {
  canonicalId: string;
  year: number;
  day: string;
  language: EnemLanguage;
  area: ParsedEnemQuestion['area'];
  statement: string;
  options: string[];
  officialAnswer: EnemAnswer;
  qualityState: EnemQualityState;
  occurrences: EnemQuestionOccurrence[];
}

export interface EnemCanonicalizationResult {
  schemaVersion: 1;
  canonicalQuestions: CanonicalEnemQuestion[];
  reviewRequired: number;
  duplicatesCollapsed: number;
  crossBookletMismatches: Array<{
    group: string;
    occurrences: EnemQuestionOccurrence[];
  }>;
}

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function contentHash(question: ParsedEnemQuestion) {
  return createHash('sha256')
    .update(normalized(`${question.statement}\n${question.options.join('\n')}`))
    .digest('hex');
}

function statementKey(year: number, day: string, question: ParsedEnemQuestion) {
  const statement = normalized(question.statement);
  return `${year}:${day}:${question.language ?? ''}:${question.area}:${statement || contentHash(question)}`;
}

function correctOptionText(question: ParsedEnemQuestion) {
  if (!/^[A-E]$/.test(question.officialAnswer) || question.options.length !== 5) return null;
  return normalized(question.options[question.officialAnswer.charCodeAt(0) - 'A'.charCodeAt(0)]);
}

export function canonicalizeEnemArtifacts(
  artifacts: Array<{
    year: number;
    day: string;
    booklet: string;
    questions: ParsedEnemQuestion[];
  }>,
): EnemCanonicalizationResult {
  const reviewRequired = artifacts.reduce(
    (total, artifact) => total + artifact.questions.filter((question) => question.qualityState !== 'PARSED').length,
    0,
  );
  const importable = artifacts.flatMap((artifact) => artifact.questions
    .filter((question) => question.qualityState === 'PARSED')
    .map((question) => ({ artifact, question })));
  const grouped = new Map<string, Array<{ artifact: typeof artifacts[number]; question: ParsedEnemQuestion; occurrence: EnemQuestionOccurrence }>>();

  for (const { artifact, question } of importable) {
    const occurrence: EnemQuestionOccurrence = {
      year: artifact.year,
      day: artifact.day,
      booklet: artifact.booklet,
      questionNumber: question.questionNumber,
      language: question.language,
      officialAnswer: question.officialAnswer,
    };
    const key = statementKey(artifact.year, artifact.day, question);
    const list = grouped.get(key) ?? [];
    list.push({ artifact, question, occurrence });
    grouped.set(key, list);
  }

  const mismatchGroups = new Set<string>();
  const crossBookletMismatches: EnemCanonicalizationResult['crossBookletMismatches'] = [];
  for (const [group, items] of grouped) {
    const answerTexts = new Set(items.map((item) => correctOptionText(item.question)).filter(Boolean));
    const hasUnknownAnswerText = items.some((item) => correctOptionText(item.question) === null);
    const answerLetters = new Set(items.map((item) => item.question.officialAnswer));
    const hasConflict = hasUnknownAnswerText
      ? answerLetters.size > 1
      : answerTexts.size > 1;
    if (hasConflict) {
      mismatchGroups.add(group);
      crossBookletMismatches.push({
        group,
        occurrences: items.map((item) => item.occurrence),
      });
    }
  }

  const canonical = new Map<string, CanonicalEnemQuestion>();
  for (const { artifact, question } of importable) {
    const id = createHash('sha256').update(statementKey(artifact.year, artifact.day, question)).digest('hex');
    const existing = canonical.get(id);
    const occurrence: EnemQuestionOccurrence = {
      year: artifact.year,
      day: artifact.day,
      booklet: artifact.booklet,
      questionNumber: question.questionNumber,
      language: question.language,
      officialAnswer: question.officialAnswer,
    };
    if (existing) {
      existing.occurrences.push(occurrence);
      if (existing.officialAnswer !== question.officialAnswer && !correctOptionText(question)) {
        existing.qualityState = 'REVIEW_REQUIRED';
      }
      continue;
    }
    canonical.set(id, {
      canonicalId: id,
      year: artifact.year,
      day: artifact.day,
      language: question.language,
      area: question.area,
      statement: question.statement,
      options: question.options,
      officialAnswer: question.officialAnswer,
      qualityState: mismatchGroups.has(statementKey(artifact.year, artifact.day, question))
        ? 'REVIEW_REQUIRED'
        : 'PARSED',
      occurrences: [occurrence],
    });
  }

  const canonicalQuestions = [...canonical.values()];
  return {
    schemaVersion: 1,
    canonicalQuestions,
    reviewRequired,
    duplicatesCollapsed: importable.length - canonicalQuestions.length,
    crossBookletMismatches,
  };
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli() {
  const args = process.argv.slice(2);
  const parsedPath = argument('--parsed', args) ?? '.runtime/enem-parsed-2025.json';
  const outputPath = argument('--out', args) ?? '.runtime/enem-canonical-2025.json';
  const parsed = JSON.parse(readFileSync(resolve(parsedPath), 'utf8')) as { artifacts: Parameters<typeof canonicalizeEnemArtifacts>[0] };
  const result = canonicalizeEnemArtifacts(parsed.artifacts);
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`ENEM_CANONICALIZE_OK canonical=${result.canonicalQuestions.length} collapsed=${result.duplicatesCollapsed} mismatches=${result.crossBookletMismatches.length} review=${result.reviewRequired} output=${resolvedOutput}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
