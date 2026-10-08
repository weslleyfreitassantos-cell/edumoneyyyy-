import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildProviderTextV4ImportSql,
  buildProviderTextV4Report,
  PROVIDER_TEXT_V4_REVISION,
  type ProviderTextV4Record,
} from './provider-text-v4.ts';
import { deduplicateProviderQuestions, type EnemProviderQuestion } from './structured-text.ts';
import {
  assessSemanticCompleteness,
  recoverCompleteStructuredQuestion,
  type SemanticCompletenessState,
  type SemanticRejectionReason,
  type StructuredRecoverySource,
} from './semantic-completeness-v5.ts';
import { normalizeProviderLanguage } from './provider-text-v2.ts';

export const PROVIDER_TEXT_V5_REVISION = 'structured-text-only-v5' as const;

export interface ProviderTextV5Record extends ProviderTextV4Record {
  v4Accepted: boolean;
  semanticState: SemanticCompletenessState;
  requiredContextAvailable: boolean;
  noUnresolvedReferences: boolean;
  textIntegrity: 'COMPLETE' | 'INCOMPLETE';
  semanticRejectionReasons: SemanticRejectionReason[];
  recoveredFromOtherProvider: string | null;
}

export interface ProviderTextV5Report {
  schemaVersion: 5;
  contentRevision: typeof PROVIDER_TEXT_V5_REVISION;
  previousContentRevision: typeof PROVIDER_TEXT_V4_REVISION;
  provider: 'enem.dev';
  providerQuestionsRaw: number;
  duplicateProviderQuestions: number;
  providerQuestions: number;
  v4AcceptedReaudited: number;
  complete: number;
  incomplete: number;
  uncertain: number;
  accepted: number;
  rejected: number;
  missingContext: number;
  missingNumericData: number;
  missingVisualInformation: number;
  truncatedStatement: number;
  unresolvedReferences: number;
  duplicateContent: number;
  unknownCompleteness: number;
  sourceConflicts: number;
  recovered: number;
  stillIncomplete: number;
  auditSampleSize: number;
  auditSamplePass: boolean;
  auditSamples: string[];
  areaCounts: Record<string, number>;
  languageCounts: Record<string, number>;
  knownCanaries: {
    financing: ProviderTextV5Canary;
    wardrobe: ProviderTextV5Canary;
  };
  records: ProviderTextV5Record[];
}

export interface ProviderTextV5Canary {
  providerQuestionKey: string;
  found: boolean;
  contextPresent: boolean;
  semanticState: SemanticCompletenessState | null;
  accepted: boolean;
  reasons: SemanticRejectionReason[];
  status: 'READY' | 'NOT_READY' | 'NOT_FOUND';
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function providerKey(question: Pick<EnemProviderQuestion, 'year' | 'index' | 'discipline' | 'language'>) {
  return `${question.year}:${question.index}:${question.discipline}:${normalizeProviderLanguage(question.language) ?? 'COMMON'}`;
}

function loadCachedQuestions(cacheDir: string) {
  return readdirSync(cacheDir)
    .filter((file) => /^\d{4}\.json$/u.test(file))
    .sort()
    .flatMap((file) => {
      const payload = JSON.parse(readFileSync(resolve(cacheDir, file), 'utf8')) as { questions?: EnemProviderQuestion[] };
      return payload.questions ?? [];
    });
}

function loadStructuredSources(path: string | undefined): StructuredRecoverySource[] {
  if (!path || !existsSync(path)) return [];
  const payload = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const questions = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && 'questions' in payload && Array.isArray(payload.questions)
      ? payload.questions
      : [];
  return questions.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || !('question' in entry)) return [];
    const value = entry as { provider?: string; sourceUrl?: string; question?: EnemProviderQuestion };
    return value.question && value.provider && value.sourceUrl
      ? [{ provider: value.provider, sourceUrl: value.sourceUrl, question: value.question }]
      : [];
  });
}

function sampleKeys(records: ProviderTextV5Record[]) {
  const accepted = records.filter((record) => record.accepted);
  const areas = new Map<string, ProviderTextV5Record[]>();
  for (const record of accepted) {
    const area = record.discipline.trim().toLocaleLowerCase('pt-BR');
    const bucket = areas.get(area) ?? [];
    bucket.push(record);
    areas.set(area, bucket);
  }
  const selected: ProviderTextV5Record[] = [];
  const buckets = [...areas.values()];
  while (selected.length < Math.min(100, accepted.length) && buckets.some((bucket) => bucket.length)) {
    for (const bucket of buckets) {
      if (bucket.length && selected.length < Math.min(100, accepted.length)) selected.push(bucket.shift()!);
    }
  }
  return selected.map((record) => record.providerQuestionKey);
}

function canary(records: ProviderTextV5Record[], questions: EnemProviderQuestion[], key: string): ProviderTextV5Canary {
  const record = records.find((item) => item.providerQuestionKey === key);
  const question = questions.find((item) => providerKey(item) === key);
  if (!record || !question) return { providerQuestionKey: key, found: false, contextPresent: false, semanticState: null, accepted: false, reasons: [], status: 'NOT_FOUND' };
  return {
    providerQuestionKey: key,
    found: true,
    contextPresent: typeof question.context === 'string' && question.context.trim().length > 0,
    semanticState: record.semanticState,
    accepted: record.accepted,
    reasons: record.semanticRejectionReasons,
    status: record.accepted ? 'READY' : 'NOT_READY',
  };
}

export function buildProviderTextV5Report(
  providerQuestions: EnemProviderQuestion[],
  options: {
    providerQuestionsRaw?: number;
    duplicateProviderQuestions?: number;
    additionalSources?: StructuredRecoverySource[];
  } = {},
): ProviderTextV5Report {
  const originalV4 = buildProviderTextV4Report(providerQuestions, options);
  const originalByKey = new Map(providerQuestions.map((question) => [providerKey(question), question]));
  const recoveredByKey = new Map<string, { question: EnemProviderQuestion; source: StructuredRecoverySource }>();
  for (const question of providerQuestions) {
    const recovery = recoverCompleteStructuredQuestion(question, options.additionalSources ?? []);
    if (recovery.reason === 'RECOVERED' && recovery.question && recovery.source) {
      recoveredByKey.set(providerKey(question), { question: recovery.question, source: recovery.source });
    }
  }
  const effectiveQuestions = providerQuestions.map((question) => recoveredByKey.get(providerKey(question))?.question ?? question);
  const effectiveV4 = buildProviderTextV4Report(effectiveQuestions, options);
  const effectiveByKey = new Map(effectiveQuestions.map((question) => [providerKey(question), question]));
  const records = effectiveV4.records.map((record): ProviderTextV5Record => {
    const question = effectiveByKey.get(record.providerQuestionKey);
    const original = originalByKey.get(record.providerQuestionKey);
    const semantic = question ? assessSemanticCompleteness(question) : {
      state: 'INCOMPLETE' as const,
      statement: '',
      statementComplete: false,
      requiredContextAvailable: false,
      noUnresolvedReferences: false,
      noRequiredMedia: false,
      textIntegrity: 'INCOMPLETE' as const,
      reasons: ['MISSING_CONTEXT' as const],
    };
    const recovered = recoveredByKey.get(record.providerQuestionKey);
    const semanticRejectionReasons = [...semantic.reasons];
    if (recovered && recovered.source.question.correctAlternative !== original?.correctAlternative) semanticRejectionReasons.push('SOURCE_CONFLICT');
    return {
      ...record,
      statementText: semantic.statement || record.statementText,
      accepted: record.accepted && semantic.state === 'COMPLETE' && semanticRejectionReasons.length === 0,
      rejectionReasons: [...new Set([...record.rejectionReasons, ...semanticRejectionReasons])],
      v4Accepted: Boolean(originalV4.records.find((item) => item.providerQuestionKey === record.providerQuestionKey)?.accepted),
      semanticState: semanticRejectionReasons.includes('SOURCE_CONFLICT') ? 'INCOMPLETE' : semantic.state,
      requiredContextAvailable: semantic.requiredContextAvailable,
      noUnresolvedReferences: semantic.noUnresolvedReferences,
      textIntegrity: semantic.textIntegrity,
      semanticRejectionReasons: [...new Set(semanticRejectionReasons)],
      recoveredFromOtherProvider: recovered?.source.provider ?? null,
    };
  });
  const audited = records.filter((record) => record.v4Accepted);
  const samples = sampleKeys(records);
  const byKey = new Map(records.map((record) => [record.providerQuestionKey, record]));
  const auditSamplePass = samples.every((key) => {
    const record = byKey.get(key);
    return Boolean(record && record.accepted && record.semanticState === 'COMPLETE' && record.semanticRejectionReasons.length === 0);
  });
  const countReason = (reason: SemanticRejectionReason) => audited.filter((record) => record.semanticRejectionReasons.includes(reason)).length;
  const areaCounts = records.filter((record) => record.accepted).reduce<Record<string, number>>((counts, record) => {
    counts[record.discipline] = (counts[record.discipline] ?? 0) + 1;
    return counts;
  }, {});
  const languageCounts = records.filter((record) => record.accepted).reduce<Record<string, number>>((counts, record) => {
    const key = record.language ?? 'COMMON';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  return {
    schemaVersion: 5,
    contentRevision: PROVIDER_TEXT_V5_REVISION,
    previousContentRevision: PROVIDER_TEXT_V4_REVISION,
    provider: 'enem.dev',
    providerQuestionsRaw: options.providerQuestionsRaw ?? providerQuestions.length,
    duplicateProviderQuestions: options.duplicateProviderQuestions ?? 0,
    providerQuestions: records.length,
    v4AcceptedReaudited: audited.length,
    complete: audited.filter((record) => record.semanticState === 'COMPLETE' && record.semanticRejectionReasons.length === 0).length,
    incomplete: audited.filter((record) => record.semanticState === 'INCOMPLETE').length,
    uncertain: audited.filter((record) => record.semanticState === 'UNCERTAIN').length,
    accepted: records.filter((record) => record.accepted).length,
    rejected: records.filter((record) => !record.accepted).length,
    missingContext: countReason('MISSING_CONTEXT'),
    missingNumericData: countReason('MISSING_NUMERIC_DATA'),
    missingVisualInformation: countReason('MISSING_VISUAL_INFORMATION'),
    truncatedStatement: countReason('TRUNCATED_STATEMENT'),
    unresolvedReferences: countReason('UNRESOLVED_REFERENCE'),
    duplicateContent: countReason('DUPLICATE_CONTENT'),
    unknownCompleteness: countReason('UNKNOWN_COMPLETENESS'),
    sourceConflicts: countReason('SOURCE_CONFLICT'),
    recovered: records.filter((record) => record.recoveredFromOtherProvider !== null && record.accepted).length,
    stillIncomplete: records.filter((record) => record.v4Accepted && !record.accepted).length,
    auditSampleSize: samples.length,
    auditSamplePass,
    auditSamples: samples,
    areaCounts,
    languageCounts,
    knownCanaries: {
      financing: canary(records, effectiveQuestions, '2015:156:matematica:COMMON'),
      wardrobe: canary(records, effectiveQuestions, '2014:156:matematica:COMMON'),
    },
    records,
  };
}

export function buildProviderTextV5ImportSql(report: Pick<ProviderTextV5Report, 'records'>) {
  const v4Sql = buildProviderTextV4ImportSql({ records: report.records.filter((record) => record.accepted) });
  const v4Hex = Buffer.from(PROVIDER_TEXT_V4_REVISION, 'utf8').toString('hex');
  const v5Hex = Buffer.from(PROVIDER_TEXT_V5_REVISION, 'utf8').toString('hex');
  return v4Sql.replaceAll(v4Hex, v5Hex);
}

async function runCli() {
  const args = process.argv.slice(2);
  const cacheDir = resolve(argument('--cache', args) ?? '.runtime/enem-structured-text-v1/raw');
  const outputPath = resolve(argument('--out', args) ?? '.runtime/enem-structured-text-v5/provider-text-report.json');
  const sqlPath = argument('--sql', args) ? resolve(argument('--sql', args)!) : null;
  const sourcePath = argument('--sources', args);
  const rawQuestions = loadCachedQuestions(cacheDir);
  const deduplicated = deduplicateProviderQuestions(rawQuestions);
  const report = buildProviderTextV5Report(deduplicated.questions, {
    providerQuestionsRaw: rawQuestions.length,
    duplicateProviderQuestions: deduplicated.duplicateProviderQuestions,
    additionalSources: loadStructuredSources(sourcePath),
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (sqlPath) {
    mkdirSync(dirname(sqlPath), { recursive: true });
    writeFileSync(sqlPath, buildProviderTextV5ImportSql(report), 'utf8');
  }
  console.log(`ENEM_PROVIDER_TEXT_V5_OK raw=${report.providerQuestionsRaw} duplicates=${report.duplicateProviderQuestions} unique=${report.providerQuestions} v4_accepted_reaudited=${report.v4AcceptedReaudited} complete=${report.complete} incomplete=${report.incomplete} uncertain=${report.uncertain} accepted=${report.accepted} rejected=${report.rejected} recovered=${report.recovered} output=${outputPath}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
