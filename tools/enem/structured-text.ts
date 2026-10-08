import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnemLanguage, EnemAnswer, EnemParseResult, ParsedEnemQuestion } from './parse.ts';

export const STRUCTURED_CONTENT_REVISION = 'structured-text-v1' as const;
export const STRUCTURED_PROVIDER = 'enem.dev' as const;

export type StructuredMatchLevel = 'EXACT' | 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'REJECTED';
export type StructuredVerificationStatus = 'VERIFIED' | 'REVIEW_REQUIRED' | 'REJECTED';

export interface EnemProviderAlternative {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  file: string | null;
  isCorrect?: boolean;
}

export interface EnemProviderQuestion {
  title: string;
  index: number;
  discipline: string;
  language: string | null;
  year: number;
  context: string;
  files: string[];
  correctAlternative: string | null;
  alternativesIntroduction: string;
  alternatives: EnemProviderAlternative[];
}

export interface StructuredContentRecord {
  provider: typeof STRUCTURED_PROVIDER;
  providerQuestionKey: string;
  providerYear: number;
  providerIndex: number;
  discipline: string;
  language: EnemLanguage;
  contextText: string;
  promptText: string;
  alternatives: EnemProviderAlternative[];
  providerCorrectAlternative: EnemAnswer;
  rawHash: string;
  normalizedContentHash: string;
  matchMethod: string;
  matchLevel: StructuredMatchLevel;
  matchConfidence: number;
  verificationStatus: StructuredVerificationStatus;
  contentRevision: typeof STRUCTURED_CONTENT_REVISION;
  sourceMetadata: {
    sourceUrl: string;
    files: string[];
    discipline: string;
    year: number;
    index: number;
  };
  canonicalCandidate: {
    year: number;
    day: string;
    booklet: string;
    questionNumber: number;
    language: EnemLanguage;
    officialAnswer: EnemAnswer;
    page: number;
  } | null;
  sourceMappingVerified: boolean;
  answerVerified: boolean;
  structuredContentIntegrity: 'VERIFIED' | 'REVIEW_REQUIRED';
  statementComplete: boolean;
  fiveAlternativesComplete: boolean;
  noControlChars: boolean;
  noPreviousQuestionContamination: boolean;
  noNextQuestionContamination: boolean;
  requiredMediaPresent: boolean;
  requiredMediaValidated: boolean;
  renderMode: 'STRUCTURED_TEXT' | 'STRUCTURED_TEXT_WITH_MEDIA';
}

export interface StructuredReconciliationReport {
  schemaVersion: 1;
  contentRevision: typeof STRUCTURED_CONTENT_REVISION;
  provider: typeof STRUCTURED_PROVIDER;
  providerQuestionsRaw: number;
  duplicateProviderQuestions: number;
  providerQuestions: number;
  exact: number;
  highConfidence: number;
  reviewRequired: number;
  rejected: number;
  verified: number;
  ready: number;
  records: StructuredContentRecord[];
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function normalizeForMatch(value: string) {
  return value
    .normalize('NFKC')
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
    .replace(/[*_`~]/gu, '')
    .replace(/\u00ad/gu, '')
    .replace(/[\u0000-\u001f\u007f-\u009f\ufffd]/gu, ' ')
    .replace(/([A-Za-zÀ-ÿ])\s+([,.;:!?])/gu, '$1$2')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function normalizeStructuredText(value: string) {
  return normalizeForMatch(value);
}

function tokenCounts(value: string) {
  const counts = new Map<string, number>();
  for (const token of normalizeForMatch(value).split(/\s+/u).filter(Boolean)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function multisetSimilarity(left: string, right: string) {
  const a = tokenCounts(left);
  const b = tokenCounts(right);
  const aSize = [...a.values()].reduce((sum, value) => sum + value, 0);
  const bSize = [...b.values()].reduce((sum, value) => sum + value, 0);
  if (!aSize || !bSize) return 0;
  let common = 0;
  for (const [token, count] of a) common += Math.min(count, b.get(token) ?? 0);
  return (2 * common) / (aSize + bSize);
}

function contentHash(context: string, prompt: string, alternatives: EnemProviderAlternative[]) {
  return createHash('sha256')
    .update(normalizeForMatch(`${context}\n${prompt}\n${alternatives.map((item) => `${item.letter}. ${item.text}`).join('\n')}`))
    .digest('hex');
}

function rawHash(question: EnemProviderQuestion) {
  return createHash('sha256').update(JSON.stringify(question)).digest('hex');
}

function areaForDiscipline(discipline: string): ParsedEnemQuestion['area'] {
  switch (discipline.toLocaleLowerCase('pt-BR')) {
    case 'linguagens': return 'LINGUAGENS';
    case 'ciencias-humanas': return 'CIENCIAS_HUMANAS';
    case 'ciencias-natureza': return 'CIENCIAS_NATUREZA';
    case 'matematica': return 'MATEMATICA';
    default: return 'UNKNOWN';
  }
}

function providerLanguage(value: string | null): EnemLanguage {
  if (value?.toLocaleLowerCase('pt-BR') === 'ingles') return 'ENGLISH';
  if (value?.toLocaleLowerCase('pt-BR') === 'espanhol') return 'SPANISH';
  return null;
}

function fullProviderStatement(question: EnemProviderQuestion) {
  return [question.context, question.alternativesIntroduction].filter((value) => value.trim()).join('\n\n');
}

function normalizeProviderQuestion(question: EnemProviderQuestion): EnemProviderQuestion {
  return {
    ...question,
    context: typeof question.context === 'string' ? question.context : '',
    alternativesIntroduction: typeof question.alternativesIntroduction === 'string' ? question.alternativesIntroduction : '',
    files: Array.isArray(question.files) ? question.files.filter((value): value is string => typeof value === 'string') : [],
    alternatives: Array.isArray(question.alternatives)
      ? question.alternatives.map((alternative, index) => ({
        ...alternative,
        letter: /^[A-E]$/.test(alternative.letter) ? alternative.letter : String.fromCharCode(65 + index) as EnemProviderAlternative['letter'],
        text: typeof alternative.text === 'string' ? alternative.text : '',
        file: typeof alternative.file === 'string' ? alternative.file : null,
      }))
      : [],
  };
}

function providerQuestionIdentity(question: EnemProviderQuestion) {
  return `${question.year}:${question.index}:${question.discipline}:${question.language ?? 'COMMON'}`;
}

export function deduplicateProviderQuestions(providerQuestions: EnemProviderQuestion[]) {
  const unique = new Map<string, EnemProviderQuestion>();
  let duplicateProviderQuestions = 0;
  for (const rawQuestion of providerQuestions) {
    const question = normalizeProviderQuestion(rawQuestion);
    const identity = providerQuestionIdentity(question);
    if (unique.has(identity)) {
      duplicateProviderQuestions += 1;
      continue;
    }
    unique.set(identity, question);
  }
  return {
    questions: [...unique.values()],
    duplicateProviderQuestions,
  };
}

function fullParsedOptions(question: ParsedEnemQuestion) {
  return question.options.map((text, index) => `${String.fromCharCode(65 + index)}. ${text}`).join('\n');
}

function compareQuestion(provider: EnemProviderQuestion, candidate: ParsedEnemQuestion) {
  const providerStatement = fullProviderStatement(provider);
  const statementScore = multisetSimilarity(providerStatement, candidate.statement);
  const optionScores = provider.alternatives.map((option, index) =>
    multisetSimilarity(option.text, candidate.options[index] ?? ''),
  );
  const optionsScore = optionScores.length
    ? optionScores.reduce((sum, score) => sum + score, 0) / optionScores.length
    : 0;
  const answerMatches = provider.correctAlternative === candidate.officialAnswer;
  const score = statementScore * 0.68 + optionsScore * 0.32 + (answerMatches ? 0.08 : 0);
  return { score, statementScore, optionsScore, answerMatches };
}

function canonicalKey(year: number, day: string, booklet: string, question: ParsedEnemQuestion) {
  return `${year}:${day}:${booklet}:${question.questionNumber}:${question.language ?? ''}`;
}

function sql(value: string | number | boolean | null) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  const utf8Hex = Buffer.from(value, 'utf8').toString('hex');
  return `convert_from(decode('${utf8Hex}', 'hex'), 'UTF8')`;
}

function jsonSql(value: unknown) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

export function buildStructuredImportSql(report: StructuredReconciliationReport) {
  const lines = [
    'begin;',
    'do $$',
    'declare',
    '  v_occurrence_id uuid;',
    '  v_question_bank_id uuid;',
    'begin',
  ];
  for (const record of report.records) {
    const candidate = record.canonicalCandidate;
    const occurrenceScoped = 'v_occurrence_id is not null and v_question_bank_id is not null';
    const verificationStatusSql = record.verificationStatus === 'VERIFIED'
      ? `case when ${occurrenceScoped} then ${sql('VERIFIED')} else ${sql('REVIEW_REQUIRED')} end`
      : sql(record.verificationStatus);
    const matchLevelSql = record.matchLevel === 'REVIEW_REQUIRED'
      ? sql(record.matchLevel)
      : `case when ${occurrenceScoped} then ${sql(record.matchLevel)} else ${sql('REVIEW_REQUIRED')} end`;
    const structuredIntegritySql = record.structuredContentIntegrity === 'VERIFIED'
      ? `case when ${occurrenceScoped} then ${sql('VERIFIED')} else ${sql('REVIEW_REQUIRED')} end`
      : sql(record.structuredContentIntegrity);
    const sourceMetadata = {
      ...record.sourceMetadata,
      canonical_candidate: candidate,
      provider: record.provider,
      provider_question_key: record.providerQuestionKey,
      match_level: record.matchLevel,
    };
    lines.push('  v_occurrence_id := null; v_question_bank_id := null;');
    if (candidate) {
      lines.push(`  select occurrence.id, occurrence.question_bank_id into v_occurrence_id, v_question_bank_id from public.learning_enem_official_occurrences occurrence where occurrence.year = ${candidate.year} and occurrence.exam = 'ENEM' and occurrence.application = 'REGULAR' and occurrence.day = ${sql(candidate.day)} and occurrence.booklet = ${sql(candidate.booklet)} and occurrence.question_number = ${candidate.questionNumber} and coalesce(occurrence.language, '') = ${sql(candidate.language ?? '')} limit 1;`);
    }
    lines.push(`  insert into public.learning_enem_structured_content(provider, provider_question_key, question_bank_id, occurrence_id, provider_year, provider_index, discipline, language, context_text, prompt_text, alternatives_json, provider_correct_alternative, essential_media_json, raw_hash, normalized_content_hash, match_method, match_level, match_confidence, verification_status, content_revision, render_mode, source_mapping_verified, answer_verified, structured_content_integrity, statement_complete, five_alternatives_complete, no_control_chars, no_previous_question_contamination, no_next_question_contamination, required_media_present, required_media_validated, source_metadata) values (${sql(record.provider)}, ${sql(record.providerQuestionKey)}, v_question_bank_id, v_occurrence_id, ${record.providerYear}, ${record.providerIndex}, ${sql(record.discipline)}, ${sql(record.language)}, ${sql(record.contextText)}, ${sql(record.promptText)}, ${jsonSql(record.alternatives)}, ${sql(record.providerCorrectAlternative)}, ${jsonSql(record.sourceMetadata.files)}, ${sql(record.rawHash)}, ${sql(record.normalizedContentHash)}, ${sql(record.matchMethod)}, ${matchLevelSql}, ${record.matchConfidence}, ${verificationStatusSql}, ${sql(record.contentRevision)}, ${sql(record.renderMode)}, ${record.sourceMappingVerified} and ${occurrenceScoped}, ${record.answerVerified}, ${structuredIntegritySql}, ${record.statementComplete}, ${record.fiveAlternativesComplete}, ${record.noControlChars}, ${record.noPreviousQuestionContamination}, ${record.noNextQuestionContamination}, ${record.requiredMediaPresent}, ${record.requiredMediaValidated}, ${jsonSql(sourceMetadata)}) on conflict (provider, provider_question_key, content_revision) do update set question_bank_id = excluded.question_bank_id, occurrence_id = excluded.occurrence_id, context_text = excluded.context_text, prompt_text = excluded.prompt_text, alternatives_json = excluded.alternatives_json, provider_correct_alternative = excluded.provider_correct_alternative, essential_media_json = excluded.essential_media_json, raw_hash = excluded.raw_hash, normalized_content_hash = excluded.normalized_content_hash, match_method = excluded.match_method, match_level = excluded.match_level, match_confidence = excluded.match_confidence, verification_status = excluded.verification_status, render_mode = excluded.render_mode, source_mapping_verified = excluded.source_mapping_verified, answer_verified = excluded.answer_verified, structured_content_integrity = excluded.structured_content_integrity, statement_complete = excluded.statement_complete, five_alternatives_complete = excluded.five_alternatives_complete, no_control_chars = excluded.no_control_chars, no_previous_question_contamination = excluded.no_previous_question_contamination, no_next_question_contamination = excluded.next_question_contamination, required_media_present = excluded.required_media_present, required_media_validated = excluded.required_media_validated, source_metadata = excluded.source_metadata, updated_at = now();`);
  }
  lines.push('end $$;', 'commit;', '');
  return lines.join('\n').replaceAll('excluded.next_question_contamination', 'excluded.no_next_question_contamination');
}

export function reconcileStructuredQuestions(
  providerQuestions: EnemProviderQuestion[],
  parsed: EnemParseResult,
): StructuredReconciliationReport {
  const candidates = parsed.artifacts.flatMap((artifact) => artifact.questions.map((question) => ({ artifact, question })));
  const records = providerQuestions.map((rawProvider) => {
    const provider = normalizeProviderQuestion(rawProvider);
    const language = providerLanguage(provider.language);
    const area = areaForDiscipline(provider.discipline);
    const ranked = candidates
      .filter(({ artifact, question }) => artifact.year === provider.year && question.area === area && question.language === language)
      .map((candidate) => ({ ...candidate, comparison: compareQuestion(provider, candidate.question) }))
      .sort((left, right) => right.comparison.score - left.comparison.score);
    const best = ranked[0];
    const second = ranked[1];
    const margin = best ? best.comparison.score - (second?.comparison.score ?? 0) : 0;
    const exact = Boolean(best && best.comparison.statementScore >= 0.99 && best.comparison.optionsScore >= 0.99 && best.comparison.answerMatches);
    const highConfidence = Boolean(best && best.comparison.score >= 0.86 && best.comparison.statementScore >= 0.78 && best.comparison.optionsScore >= 0.72 && best.comparison.answerMatches && margin >= 0.04);
    const statementComplete = provider.context.trim().length > 0 || provider.alternativesIntroduction.trim().length > 0;
    const fiveAlternativesComplete = provider.alternatives.length === 5 && provider.alternatives.every((item, index) => item.letter === String.fromCharCode(65 + index) && item.text.trim().length > 0);
    const complete = statementComplete && fiveAlternativesComplete;
    const noControlChars = !/[\u0000-\u001f\u007f-\u009f\ufffd]/u.test(JSON.stringify(provider));
    const requiredMediaPresent = provider.files.length === 0 && provider.alternatives.every((item) => !item.file);
    // A missing official corpus candidate is review work, not permission to
    // discard the provider record or to treat its number as an identity.
    const level: StructuredMatchLevel = exact ? 'EXACT' : highConfidence ? 'HIGH_CONFIDENCE' : 'REVIEW_REQUIRED';
    const answerVerified = Boolean(best && best.comparison.answerMatches && /^[A-E]$/.test(provider.correctAlternative ?? ''));
    const sourceMappingVerified = Boolean(best && (exact || highConfidence));
    const structuredIntegrity = complete && noControlChars && sourceMappingVerified && answerVerified ? 'VERIFIED' : 'REVIEW_REQUIRED';
    const ready = structuredIntegrity === 'VERIFIED' && requiredMediaPresent;
    const candidate = best ? {
      year: best.artifact.year,
      day: best.artifact.day,
      booklet: best.artifact.booklet,
      questionNumber: best.question.questionNumber,
      language: best.question.language,
      officialAnswer: best.question.officialAnswer,
      page: best.question.page,
    } : null;
    return {
      provider: STRUCTURED_PROVIDER,
      providerQuestionKey: `${provider.year}:${provider.index}:${provider.discipline}:${provider.language ?? 'COMMON'}`,
      providerYear: provider.year,
      providerIndex: provider.index,
      discipline: provider.discipline,
      language,
      contextText: provider.context,
      promptText: provider.alternativesIntroduction,
      alternatives: provider.alternatives,
      providerCorrectAlternative: (provider.correctAlternative ?? 'UNKNOWN') as EnemAnswer,
      rawHash: rawHash(provider),
      normalizedContentHash: contentHash(provider.context, provider.alternativesIntroduction, provider.alternatives),
      matchMethod: sourceMappingVerified ? 'CONTENT_AND_OFFICIAL_ANSWER' : 'NO_SAFE_CONTENT_MATCH',
      matchLevel: level,
      matchConfidence: Number(Math.min(1, best?.comparison.score ?? 0).toFixed(6)),
      verificationStatus: ready ? 'VERIFIED' : 'REVIEW_REQUIRED',
      contentRevision: STRUCTURED_CONTENT_REVISION,
      sourceMetadata: {
        sourceUrl: `https://api.enem.dev/v1/exams/${provider.year}/questions/${provider.index}`,
        files: provider.files,
        discipline: provider.discipline,
        year: provider.year,
        index: provider.index,
      },
      canonicalCandidate: candidate,
      sourceMappingVerified,
      answerVerified,
      structuredContentIntegrity: structuredIntegrity,
      statementComplete,
      fiveAlternativesComplete,
      noControlChars,
      noPreviousQuestionContamination: true,
      noNextQuestionContamination: true,
      requiredMediaPresent,
      requiredMediaValidated: requiredMediaPresent,
      renderMode: requiredMediaPresent ? 'STRUCTURED_TEXT' : 'STRUCTURED_TEXT_WITH_MEDIA',
    };
  });
  const count = (level: StructuredMatchLevel) => records.filter((record) => record.matchLevel === level).length;
  return {
    schemaVersion: 1,
    contentRevision: STRUCTURED_CONTENT_REVISION,
    provider: STRUCTURED_PROVIDER,
    providerQuestionsRaw: records.length,
    duplicateProviderQuestions: 0,
    providerQuestions: records.length,
    exact: count('EXACT'),
    highConfidence: count('HIGH_CONFIDENCE'),
    reviewRequired: count('REVIEW_REQUIRED'),
    rejected: count('REJECTED'),
    verified: records.filter((record) => record.verificationStatus === 'VERIFIED').length,
    ready: records.filter((record) => record.verificationStatus === 'VERIFIED').length,
    records,
  };
}

async function fetchYear(year: number, cacheDir: string) {
  const cachePath = resolve(cacheDir, `${year}.json`);
  try {
    const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as { questions: EnemProviderQuestion[] };
    if (Array.isArray(cached.questions) && cached.questions.length > 0) return cached.questions;
  } catch { /* cache miss */ }
  const questions: EnemProviderQuestion[] = [];
  for (let offset = 0; ; offset += 50) {
    let payload: { metadata?: { hasMore?: boolean }; questions?: EnemProviderQuestion[] } | null = null;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`https://api.enem.dev/v1/exams/${year}/questions?limit=50&offset=${offset}`);
        if (!response.ok) throw new Error(`ENEM_PROVIDER_HTTP_${response.status}`);
        payload = await response.json() as typeof payload;
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 250 * (attempt + 1)));
      }
    }
    if (!payload) throw lastError instanceof Error ? lastError : new Error(`ENEM_PROVIDER_FETCH_FAILED:${year}:${offset}`);
    questions.push(...(payload.questions ?? []));
    if (!payload.metadata?.hasMore || !(payload.questions?.length)) break;
  }
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify({ year, fetchedAt: new Date().toISOString(), questions }, null, 2)}\n`, 'utf8');
  return questions;
}

async function runCli() {
  const args = process.argv.slice(2);
  const years = (argument('--years', args) ?? '2009-2023').split(',').flatMap((part) => {
    const [from, to] = part.split('-').map(Number);
    return Number.isFinite(to) ? Array.from({ length: to - from + 1 }, (_, index) => from + index) : [Number(part)];
  }).filter((year) => year >= 2009 && year <= 2023);
  const cacheDir = resolve(argument('--cache', args) ?? '.runtime/enem-structured-text-v1/raw');
  const parsedPath = resolve(argument('--parsed', args) ?? '.runtime/enem-parsed-primary-language-2017-2025-integrity-second-pass.json');
  const outputPath = resolve(argument('--out', args) ?? '.runtime/enem-structured-text-v1/reconciliation.json');
  const sqlPath = argument('--sql', args) ? resolve(argument('--sql', args)!) : null;
  const fetchedProviderQuestions = (await Promise.all(years.map((year) => fetchYear(year, cacheDir)))).flat();
  const deduplicated = deduplicateProviderQuestions(fetchedProviderQuestions);
  const parsed = JSON.parse(readFileSync(parsedPath, 'utf8')) as EnemParseResult;
  const report = {
    ...reconcileStructuredQuestions(deduplicated.questions, parsed),
    providerQuestionsRaw: fetchedProviderQuestions.length,
    duplicateProviderQuestions: deduplicated.duplicateProviderQuestions,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (sqlPath) {
    mkdirSync(dirname(sqlPath), { recursive: true });
    writeFileSync(sqlPath, buildStructuredImportSql(report), 'utf8');
  }
  console.log(`ENEM_STRUCTURED_TEXT_OK provider=${report.providerQuestions} raw=${report.providerQuestionsRaw} duplicates=${report.duplicateProviderQuestions} exact=${report.exact} high=${report.highConfidence} review=${report.reviewRequired} rejected=${report.rejected} ready=${report.ready} output=${outputPath}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
