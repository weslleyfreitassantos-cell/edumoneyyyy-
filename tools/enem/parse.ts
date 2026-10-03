import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import type { EnemDownloadedArtifact } from './download.ts';

export type EnemLanguage = 'ENGLISH' | 'SPANISH' | null;
export type EnemAnswer = 'A' | 'B' | 'C' | 'D' | 'E' | 'ANNULLED' | 'UNKNOWN';
export type EnemQualityState = 'PARSED' | 'REVIEW_REQUIRED' | 'REJECTED';

export interface PdfTextPage {
  page: number;
  text: string;
}

export interface OfficialAnswer {
  questionNumber: number;
  language: EnemLanguage;
  answer: EnemAnswer;
}

export interface ParsedEnemQuestion {
  questionNumber: number;
  language: EnemLanguage;
  page: number;
  area: 'LINGUAGENS' | 'CIENCIAS_HUMANAS' | 'CIENCIAS_NATUREZA' | 'MATEMATICA' | 'UNKNOWN';
  statement: string;
  supportText: string | null;
  options: string[];
  officialAnswer: EnemAnswer;
  mediaStatus: 'NOT_DETECTED' | 'REVIEW_REQUIRED';
  qualityState: EnemQualityState;
}

export interface ParsedEnemArtifact {
  year: number;
  day: string;
  booklet: string;
  examPath: string;
  answerKeyPath: string;
  answerKey: OfficialAnswer[];
  questions: ParsedEnemQuestion[];
  qualityState: EnemQualityState;
  issues: string[];
}

export interface EnemParseResult {
  schemaVersion: 1;
  parsedAt: string;
  artifacts: ParsedEnemArtifact[];
  issues: string[];
}

function normalizePdfText(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/Q\s+UEST\s+[Ãã]\s+O/gu, 'QUESTÃO')
    .replace(/Q\s+UEST/gu, 'QUEST')
    .replace(/([Ãã])\s+O/gu, 'ÃO')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function answerValue(value: string): EnemAnswer {
  const normalized = value.toUpperCase();
  return normalized === 'ANULADO' || normalized === 'ANNULLED'
    ? 'ANNULLED'
    : /^[A-E]$/.test(normalized) ? normalized as EnemAnswer : 'UNKNOWN';
}

export function parseOfficialAnswerKey(text: string, day: string): OfficialAnswer[] {
  const normalized = normalizePdfText(text).replace(/\s+/g, ' ').toUpperCase();
  const answers: OfficialAnswer[] = [];
  const languageMarkerMatch = normalized.match(/QUESTÃO\s+GABARITO(?:\s+QUESTÃO)?\s+INGLÊS\s+ESPANHOL/);
  const languageMarker = languageMarkerMatch?.index ?? -1;

  const dayNumber = Number(day.replace(/\D/g, ''));
  const firstDayLayout = dayNumber > 0 && dayNumber % 2 === 1;
  if (firstDayLayout) {
    if (languageMarker < 0) throw new Error('ENEM_ANSWER_KEY_LANGUAGE_SECTION_MISSING');
    const humanMatches = normalized.matchAll(/\b(4[6-9]|[5-8]\d|90)\s+(ANULADO|[A-E])\b/g);
    for (const match of humanMatches) {
      answers.push({ questionNumber: Number(match[1]), language: null, answer: answerValue(match[2]) });
    }

    const languagePairs = normalized.matchAll(/\b([1-5])\s+(ANULADO|[A-E])\s+(ANULADO|[A-E])\b/g);
    for (const match of languagePairs) {
      const questionNumber = Number(match[1]);
      answers.push({ questionNumber, language: 'ENGLISH', answer: answerValue(match[2]) });
      answers.push({ questionNumber, language: 'SPANISH', answer: answerValue(match[3]) });
    }
    const languageSingles = normalized.matchAll(/\b(0?[6-9]|[1-3]\d|4[0-5])\s+(ANULADO|[A-E])\b/g);
    for (const match of languageSingles) {
      answers.push({ questionNumber: Number(match[1]), language: null, answer: answerValue(match[2]) });
    }
  } else {
    const matches = normalized.matchAll(/\b(\d{2,3})\s+(ANULADO|[A-E])\b/g);
    for (const match of matches) {
      const questionNumber = Number(match[1]);
      if (questionNumber >= 91 && questionNumber <= 180) {
        answers.push({ questionNumber, language: null, answer: answerValue(match[2]) });
      }
    }
  }

  const unique = new Set(answers.map((item) => `${item.questionNumber}:${item.language ?? ''}`));
  if (unique.size !== answers.length) throw new Error(`ENEM_ANSWER_KEY_DUPLICATE:${day}`);
  return answers.sort((left, right) => left.questionNumber - right.questionNumber || (left.language ?? '').localeCompare(right.language ?? ''));
}

function areaFor(day: string, questionNumber: number) {
  const dayNumber = Number(day.replace(/\D/g, ''));
  if (dayNumber > 0 && dayNumber % 2 === 1) return questionNumber <= 45 ? 'LINGUAGENS' : 'CIENCIAS_HUMANAS';
  if (dayNumber > 0 && dayNumber % 2 === 0) return questionNumber <= 135 ? 'CIENCIAS_NATUREZA' : 'MATEMATICA';
  return 'UNKNOWN';
}

function languageFor(textBefore: string, day: string, questionNumber: number): EnemLanguage {
  const dayNumber = Number(day.replace(/\D/g, ''));
  if (dayNumber <= 0 || dayNumber % 2 === 0 || questionNumber > 5) return null;
  const context = textBefore.toLowerCase();
  const english = context.lastIndexOf('opção inglês');
  const spanish = context.lastIndexOf('opção espanhol');
  if (english > spanish) return 'ENGLISH';
  if (spanish > english) return 'SPANISH';
  return null;
}

export function extractQuestionSegments(pages: PdfTextPage[], day: string) {
  const source = pages
    .map((page) => `[PAGE:${page.page}]\n${normalizePdfText(page.text)}`)
    .join('\n');
  const markers = [...source.matchAll(/\bQUEST(?:ÃO|AO)\s+(\d{1,3})\b/giu)];
  return markers.map((marker, index) => {
    const questionNumber = Number(marker[1]);
    const contentStart = marker.index! + marker[0].length;
    const contentEnd = markers[index + 1]?.index ?? source.length;
    const before = source.slice(0, marker.index!);
    const pageMatch = [...before.matchAll(/\[PAGE:(\d+)\]/g)].pop();
    const raw = source.slice(contentStart, contentEnd).replace(/\[PAGE:\d+\]/g, '\n');
    let language = languageFor(before, day, questionNumber);
    if (questionNumber <= 5 && Number(day.replace(/\D/g, '')) % 2 === 1) {
      // Only headings near the segment start describe this question. A later
      // page header can appear before the next question marker in the stream.
      const lowerRaw = raw.slice(0, 250).toLowerCase();
      const english = lowerRaw.indexOf('opção inglês');
      const spanish = lowerRaw.indexOf('opção espanhol');
      if (english > spanish && english >= 0) language = 'ENGLISH';
      if (spanish > english && spanish >= 0) language = 'SPANISH';
    }
    return {
      questionNumber,
      language,
      page: Number(pageMatch?.[1] ?? 0),
      area: areaFor(day, questionNumber),
      raw,
    };
  });
}

function extractOptions(raw: string) {
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const inline = line.match(/(?:^|[?؟])\s*(A\s+.+?\s+B\s+.+?\s+C\s+.+?\s+D\s+.+?\s+E\s+.+)$/i);
    if (inline) {
      const optionStart = line.lastIndexOf(inline[1]);
      return {
        before: [...lines.slice(0, lines.indexOf(line)), line.slice(0, optionStart)].join(' ').trim(),
        options: inline[1].match(/^A\s+(.+?)\s+B\s+(.+?)\s+C\s+(.+?)\s+D\s+(.+?)\s+E\s+(.+)$/i)?.slice(1).map((item) => item.trim()) ?? [],
      };
    }
  }
  for (let start = 0; start < lines.length; start += 1) {
    const first = lines[start].match(/^A\s+(.+)$/i);
    if (!first) continue;
    const options = [first[1].trim()];
    let expected = 'B';
    let index = start + 1;
    for (; index < lines.length && options.length < 5; index += 1) {
      const label = lines[index].match(/^([A-E])\s+(.+)$/i);
      if (label?.[1].toUpperCase() === expected) {
        options.push(label[2].trim());
        expected = String.fromCharCode(expected.charCodeAt(0) + 1);
      } else if (!label) {
        options[options.length - 1] += ` ${lines[index]}`;
      } else {
        break;
      }
    }
    if (options.length === 5) {
      return { before: lines.slice(0, start).join(' '), options };
    }
  }
  return { before: lines.join(' '), options: [] };
}

export function parseQuestionSegments(segments: ReturnType<typeof extractQuestionSegments>, answers: OfficialAnswer[]) {
  const answerByKey = new Map(answers.map((answer) => [`${answer.questionNumber}:${answer.language ?? ''}`, answer.answer]));
  return segments.map<ParsedEnemQuestion>((segment) => {
    const extracted = extractOptions(segment.raw);
    const statement = extracted.before.replace(/\s+/g, ' ').trim();
    const officialAnswer = answerByKey.get(`${segment.questionNumber}:${segment.language ?? ''}`) ?? 'UNKNOWN';
    const mediaStatus = /\b(figura|gráfico|tabela|mapa|foto|imagem|charge|tirinha)\b/i.test(segment.raw)
      ? 'REVIEW_REQUIRED'
      : 'NOT_DETECTED';
    const textStatus = statement.length >= 20 && !/QUESTÕES|OPÇÃO INGLÊS|OPÇÃO ESPANHOL|CADERNO|GABARITO/i.test(statement)
      ? 'VALID'
      : 'REVIEW_REQUIRED';
    const qualityState: EnemQualityState = extracted.options.length === 5 && officialAnswer !== 'UNKNOWN' && mediaStatus === 'NOT_DETECTED' && textStatus === 'VALID'
      ? 'PARSED'
      : 'REVIEW_REQUIRED';
    return {
      questionNumber: segment.questionNumber,
      language: segment.language,
      page: segment.page,
      area: segment.area,
      statement,
      supportText: null,
      options: extracted.options,
      officialAnswer,
      mediaStatus,
      qualityState,
    };
  });
}

async function extractPdfPages(path: string): Promise<PdfTextPage[]> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(readFileSync(path)),
    disableWorker: true,
  }).promise;
  const pages: PdfTextPage[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: { y: number; x: number; text: string }[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const transform = 'transform' in item ? item.transform : [1, 0, 0, 1, 0, 0];
      const x = Number(transform[4]);
      const y = Number(transform[5]);
      const line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2);
      if (line) line.text += ` ${item.str.trim()}`;
      else lines.push({ y, x, text: item.str.trim() });
    }
    lines.sort((left, right) => right.y - left.y || left.x - right.x);
    pages.push({ page: pageNumber, text: lines.map((line) => line.text).join('\n') });
  }
  return pages;
}

async function parseArtifact(artifact: EnemDownloadedArtifact): Promise<ParsedEnemArtifact> {
  const examPages = await extractPdfPages(artifact.examPath);
  const answerPages = await extractPdfPages(artifact.answerKeyPath);
  const answerKey = parseOfficialAnswerKey(answerPages.map((page) => page.text).join('\n'), artifact.day);
  const segments = extractQuestionSegments(examPages, artifact.day);
  const parsedQuestions = parseQuestionSegments(segments, answerKey);
  const identityCounts = new Map<string, number>();
  for (const question of parsedQuestions) {
    const key = `${question.questionNumber}:${question.language ?? ''}`;
    identityCounts.set(key, (identityCounts.get(key) ?? 0) + 1);
  }
  const questions = parsedQuestions.map((question) => {
    const key = `${question.questionNumber}:${question.language ?? ''}`;
    return (identityCounts.get(key) ?? 0) > 1
      ? { ...question, qualityState: 'REVIEW_REQUIRED' as const }
      : question;
  });
  const issues: string[] = [];
  if (answerKey.some((answer) => answer.answer === 'UNKNOWN')) issues.push('UNKNOWN_OFFICIAL_ANSWER');
  if (questions.length === 0) issues.push('NO_QUESTIONS_PARSED');
  if (questions.some((question, index) => identityCounts.get(`${question.questionNumber}:${question.language ?? ''}`)! > 1)) {
    issues.push('DUPLICATE_QUESTION_IDENTITY_REVIEW_REQUIRED');
  }
  if (questions.some((question) => question.qualityState === 'REVIEW_REQUIRED')) issues.push('QUESTION_REVIEW_REQUIRED');
  return {
    year: artifact.year,
    day: artifact.day,
    booklet: artifact.booklet,
    examPath: artifact.examPath,
    answerKeyPath: artifact.answerKeyPath,
    answerKey,
    questions,
    qualityState: issues.length ? 'REVIEW_REQUIRED' : 'PARSED',
    issues,
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const downloadsPath = args.includes('--downloads') ? args[args.indexOf('--downloads') + 1] : '.runtime/enem-download-2025.json';
  const outputPath = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.runtime/enem-parsed-2025.json';
  const download = JSON.parse(readFileSync(resolve(downloadsPath), 'utf8')) as { artifacts: EnemDownloadedArtifact[]; issues: string[] };
  const parsedArtifacts: ParsedEnemArtifact[] = [];
  const issues = [...download.issues];
  for (const artifact of download.artifacts) {
    try {
      const parsed = await parseArtifact(artifact);
      parsedArtifacts.push(parsed);
      issues.push(...parsed.issues.map((issue) => `${artifact.year}:${artifact.day}:${artifact.booklet}:${issue}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      issues.push(`ENEM_PARSE_REJECTED:${artifact.year}:${artifact.day}:${artifact.booklet}:${message}`);
    }
  }
  const result: EnemParseResult = {
    schemaVersion: 1,
    parsedAt: new Date().toISOString(),
    artifacts: parsedArtifacts,
    issues,
  };
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const questionCount = parsedArtifacts.reduce((total, artifact) => total + artifact.questions.length, 0);
  const reviewCount = parsedArtifacts.reduce(
    (total, artifact) => total + artifact.questions.filter((question) => question.qualityState === 'REVIEW_REQUIRED').length,
    0,
  );
  console.log(`ENEM_PARSE_OK artifacts=${parsedArtifacts.length} questions=${questionCount} review=${reviewCount} issues=${issues.length} output=${resolvedOutput}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
