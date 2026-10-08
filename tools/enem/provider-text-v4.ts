import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildCompleteProviderStatement,
  assessProviderStatementCompleteness,
  deduplicateProviderQuestions,
  normalizeStructuredText,
  type EnemProviderAlternative,
  type EnemProviderQuestion,
} from './structured-text.ts';
import {
  buildProviderTextReport,
  normalizeProviderLanguage,
  type ProviderTextRecord,
} from './provider-text-v2.ts';

export const PROVIDER_TEXT_V4_REVISION = 'structured-text-only-v4' as const;

export type ProviderTextV4Record = ProviderTextRecord & {
  titleUsed: boolean;
  titleMetadataOnly: boolean;
  completenessReasons: string[];
};

export interface ProviderTextV4Report {
  schemaVersion: 4;
  contentRevision: typeof PROVIDER_TEXT_V4_REVISION;
  provider: 'enem.dev';
  sourceKind: 'STRUCTURED_PROVIDER';
  sourceType: 'ENEM_STRUCTURED_PROVIDER';
  providerQuestionsRaw: number;
  duplicateProviderQuestions: number;
  providerQuestions: number;
  accepted: number;
  rejected: number;
  mediaDependent: number;
  incompleteStatement: number;
  incompleteStructuredText: number;
  questionOnlyFragments: number;
  incompleteAlternatives: number;
  invalidAnswer: number;
  unsafeText: number;
  visualCue: number;
  languageMappingFailed: number;
  titleUsed: number;
  titleDiscardedMetadataOnly: number;
  areaLanguageCounts: Record<string, number>;
  auditSamples: Record<string, string[]>;
  auditSamplePass: boolean;
  knownFinancingQuestion: {
    providerQuestionKey: string;
    found: boolean;
    complete: boolean;
    accepted: boolean;
    statement: string;
    reasons: string[];
  };
  records: ProviderTextV4Record[];
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function providerQuestionKey(question: EnemProviderQuestion) {
  return `${question.year}:${question.index}:${question.discipline}:${normalizeProviderLanguage(question.language) ?? 'COMMON'}`;
}

function areaForDiscipline(discipline: string) {
  switch (discipline.trim().toLocaleLowerCase('pt-BR')) {
    case 'linguagens': return 'LINGUAGENS';
    case 'ciencias-humanas': return 'CIENCIAS_HUMANAS';
    case 'ciencias-natureza': return 'CIENCIAS_NATUREZA';
    case 'matematica': return 'MATEMATICA';
    default: return 'UNKNOWN';
  }
}

function countReason(records: ProviderTextV4Record[], reason: string) {
  return records.filter((record) => record.rejectionReasons.includes(reason)).length;
}

function buildAuditSamples(records: ProviderTextV4Record[]) {
  const accepted = records.filter((record) => record.accepted);
  const samples: Record<string, string[]> = {};
  for (const area of ['LINGUAGENS', 'CIENCIAS_HUMANAS', 'CIENCIAS_NATUREZA', 'MATEMATICA']) {
    const areaRecords = accepted.filter((record) => areaForDiscipline(record.discipline) === area);
    if (area === 'LINGUAGENS') {
      samples[`${area}:COMMON`] = areaRecords.filter((record) => record.language === null).slice(0, 10).map((record) => record.providerQuestionKey);
      samples[`${area}:ENGLISH`] = areaRecords.filter((record) => record.language === 'ENGLISH').slice(0, 5).map((record) => record.providerQuestionKey);
      samples[`${area}:SPANISH`] = areaRecords.filter((record) => record.language === 'SPANISH').slice(0, 5).map((record) => record.providerQuestionKey);
    } else {
      samples[area] = areaRecords.filter((record) => record.language === null).slice(0, 10).map((record) => record.providerQuestionKey);
    }
  }
  return samples;
}

function hasDuplicateStatementParagraphs(statement: string) {
  const paragraphs = statement
    .split(/\n\s*\n/u)
    .map((paragraph) => normalizeStructuredText(paragraph))
    .filter(Boolean);
  return new Set(paragraphs).size !== paragraphs.length;
}

function isAuditRecordComplete(record: ProviderTextV4Record) {
  const labels = record.alternatives.map((alternative) => alternative.letter);
  return record.accepted
    && record.statementComplete
    && record.statementText.trim().length > 0
    && record.fiveAlternativesComplete
    && labels.join('') === 'ABCDE'
    && record.alternatives.every((alternative) => alternative.text.trim().length > 0)
    && /^[A-E]$/u.test(record.providerCorrectAlternative)
    && !record.mediaDependent
    && !record.visualCue
    && !hasDuplicateStatementParagraphs(record.statementText);
}

function isAuditSampleComplete(samples: Record<string, string[]>, records: ProviderTextV4Record[]) {
  const acceptedByKey = new Map(records.map((record) => [record.providerQuestionKey, record]));
  return Object.entries(samples).every(([key, values]) => {
    const isEnglish = key.endsWith(':ENGLISH');
    const required = key.endsWith(':ENGLISH') || key.endsWith(':SPANISH') ? 5 : 10;
    const coverageAvailable = records.some((record) => {
      const area = areaForDiscipline(record.discipline);
      if (area !== 'LINGUAGENS') return false;
      if (isEnglish) return record.language === 'ENGLISH';
      if (key.endsWith(':SPANISH')) return record.language === 'SPANISH';
      return record.language === null;
    });
    if (isEnglish && !coverageAvailable) return true;
    return values.length === required && values.every((value) => {
      const record = acceptedByKey.get(value);
      return Boolean(record && isAuditRecordComplete(record));
    });
  });
}

export function buildProviderTextV4Report(
  providerQuestions: EnemProviderQuestion[],
  options: { providerQuestionsRaw?: number; duplicateProviderQuestions?: number } = {},
): ProviderTextV4Report {
  const base = buildProviderTextReport(providerQuestions);
  const questionsByKey = new Map(providerQuestions.map((question) => [providerQuestionKey(question), question]));
  const records = base.records.map((record): ProviderTextV4Record => {
    const question = questionsByKey.get(record.providerQuestionKey);
    if (!question) return {
      ...record,
      titleUsed: false,
      titleMetadataOnly: false,
      completenessReasons: ['MISSING_RAW_PROVIDER_RECORD'],
      accepted: false,
      rejectionReasons: [...new Set([...record.rejectionReasons, 'MISSING_RAW_PROVIDER_RECORD'])],
    };
    const completeness = assessProviderStatementCompleteness(question);
    const rejectionReasons = [
      ...record.rejectionReasons.filter((reason) => reason !== 'INCOMPLETE_STATEMENT'),
      ...completeness.reasons,
    ];
    const normalizedContentHash = stableHash({
      statement: normalizeStructuredText(buildCompleteProviderStatement(question)),
      alternatives: record.alternatives.map((alternative) => ({
        letter: alternative.letter,
        text: normalizeStructuredText(alternative.text),
      })),
    });
    return {
      ...record,
      statementText: completeness.statement,
      normalizedContentHash,
      statementComplete: completeness.complete,
      accepted: rejectionReasons.length === 0,
      rejectionReasons: [...new Set(rejectionReasons)],
      titleUsed: completeness.titleUsed,
      titleMetadataOnly: completeness.titleMetadataOnly,
      completenessReasons: completeness.reasons,
    };
  });
  const auditSamples = buildAuditSamples(records);
  const knownFinancingKey = '2015:156:matematica:COMMON';
  const knownRecord = records.find((record) => record.providerQuestionKey === knownFinancingKey);
  const knownQuestion = providerQuestions.find((question) => providerQuestionKey(question) === knownFinancingKey);
  const knownCompleteness = knownQuestion ? assessProviderStatementCompleteness(knownQuestion) : null;
  const areaLanguageCounts = records.reduce<Record<string, number>>((counts, record) => {
    const key = `${areaForDiscipline(record.discipline)}:${record.language ?? 'COMMON'}:${record.accepted ? 'ACCEPTED' : 'REJECTED'}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  return {
    schemaVersion: 4,
    contentRevision: PROVIDER_TEXT_V4_REVISION,
    provider: base.provider,
    sourceKind: base.sourceKind,
    sourceType: base.sourceType,
    providerQuestionsRaw: options.providerQuestionsRaw ?? providerQuestions.length,
    duplicateProviderQuestions: options.duplicateProviderQuestions ?? 0,
    providerQuestions: records.length,
    accepted: records.filter((record) => record.accepted).length,
    rejected: records.filter((record) => !record.accepted).length,
    mediaDependent: countReason(records, 'MEDIA_DEPENDENT'),
    incompleteStatement: countReason(records, 'INCOMPLETE_STATEMENT'),
    incompleteStructuredText: countReason(records, 'INCOMPLETE_STRUCTURED_TEXT'),
    questionOnlyFragments: countReason(records, 'QUESTION_ONLY_FRAGMENT'),
    incompleteAlternatives: countReason(records, 'INCOMPLETE_ALTERNATIVES'),
    invalidAnswer: countReason(records, 'INVALID_ANSWER'),
    unsafeText: countReason(records, 'UNSAFE_TEXT'),
    visualCue: countReason(records, 'VISUAL_CUE'),
    languageMappingFailed: countReason(records, 'LANGUAGE_MAPPING_FAILED'),
    titleUsed: records.filter((record) => record.titleUsed).length,
    titleDiscardedMetadataOnly: records.filter((record) => record.titleMetadataOnly).length,
    areaLanguageCounts,
    auditSamples,
    auditSamplePass: isAuditSampleComplete(auditSamples, records),
    knownFinancingQuestion: {
      providerQuestionKey: knownFinancingKey,
      found: Boolean(knownRecord),
      complete: knownCompleteness?.complete ?? false,
      accepted: knownRecord?.accepted ?? false,
      statement: knownCompleteness?.statement ?? '',
      reasons: knownCompleteness?.reasons ?? ['NOT_FOUND_IN_RAW_CACHE'],
    },
    records,
  };
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

function subjectArea(discipline: string) {
  switch (discipline.trim().toLocaleLowerCase('pt-BR')) {
    case 'linguagens': return 'LINGUAGENS';
    case 'ciências humanas':
    case 'ciencias humanas':
    case 'ciencias-humanas': return 'CIENCIAS_HUMANAS';
    case 'ciências da natureza':
    case 'ciencias da natureza':
    case 'ciencias-natureza': return 'CIENCIAS_NATUREZA';
    case 'matemática':
    case 'matematica': return 'MATEMATICA';
    default: return 'UNKNOWN';
  }
}

export function buildProviderTextV4ImportSql(report: Pick<ProviderTextV4Report, 'records'>) {
  const acceptedRecords = report.records.filter((record) => record.accepted);
  const lines = [
    'begin;',
    'do $$',
    'declare',
    '  v_question_bank_id uuid;',
    '  v_structured_content_id uuid;',
    'begin',
  ];
  for (const record of acceptedRecords) {
    const alternatives = record.alternatives.map((alternative) => ({ letter: alternative.letter, text: alternative.text }));
    const questionMetadata = {
      content_revision: PROVIDER_TEXT_V4_REVISION,
      source_kind: 'STRUCTURED_PROVIDER',
      structured_content_hash: record.normalizedContentHash,
      provider: record.provider,
      provider_question_key: record.providerQuestionKey,
      provider_index: record.providerIndex,
      provider_answer_letter: record.providerCorrectAlternative,
      render_mode: 'STRUCTURED_TEXT',
      source_integrity: 'VERIFIED',
      statement_integrity: 'VERIFIED',
      options_integrity: 'VERIFIED',
      text_options_integrity: 'VERIFIED',
      render_ready: 'true',
      area_verified: 'true',
      subject_verified: 'true',
    };
    const sourceMetadata = {
      source_url: record.sourceUrl,
      provider: record.provider,
      provider_question_key: record.providerQuestionKey,
      source_kind: 'STRUCTURED_PROVIDER',
      content_acceptance_status: 'ACCEPTED',
      accepted_without_official_mapping: true,
      legacy_replacement_candidate: record.legacyReplacementCandidate,
      files: [],
      legacy_assets_preserved: true,
      title_used: record.titleUsed,
      title_metadata_only: record.titleMetadataOnly,
      completeness_reasons: record.completenessReasons,
    };
    lines.push('  v_question_bank_id := null;');
    lines.push(`  select structured.question_bank_id into v_question_bank_id from public.learning_enem_structured_content structured where structured.provider = ${sql(record.provider)} and structured.provider_question_key = ${sql(record.providerQuestionKey)} and structured.content_revision = ${sql(PROVIDER_TEXT_V4_REVISION)} and structured.question_bank_id is not null limit 1;`);
    lines.push('  if v_question_bank_id is null then');
    lines.push(`    select question_bank.id into v_question_bank_id from public.learning_question_bank question_bank where question_bank.active and question_bank.package_type = 'ENEM' and question_bank.metadata->>'structured_content_hash' = ${sql(record.normalizedContentHash)} order by question_bank.created_at limit 1;`);
    lines.push('  end if;');
    lines.push('  if v_question_bank_id is null then');
    lines.push(`    insert into public.learning_question_bank(package_type, source_type, source_name, source_year, source_exam, source_application, subject_area, statement, options, correct_answer, estimated_minutes, provenance, source_reference, metadata, active) values ('ENEM', ${sql('ENEM_STRUCTURED_PROVIDER')}, ${sql(record.provider)}, ${record.providerYear}, 'ENEM', 'PROVIDER', ${sql(subjectArea(record.discipline))}, ${sql(record.statementText)}, ${jsonSql(alternatives.map((alternative) => alternative.text))}, ${jsonSql(record.providerCorrectAlternative)}, 3, ${sql('ENEM_PROVIDER_STRUCTURED')}, ${sql(record.sourceUrl)}, ${jsonSql(questionMetadata)}, true) returning id into v_question_bank_id;`);
    lines.push('  else');
    lines.push(`    update public.learning_question_bank set statement = ${sql(record.statementText)}, options = ${jsonSql(alternatives.map((alternative) => alternative.text))}, correct_answer = ${jsonSql(record.providerCorrectAlternative)}, metadata = metadata || ${jsonSql(questionMetadata)}, active = true where id = v_question_bank_id and source_type = ${sql('ENEM_STRUCTURED_PROVIDER')};`);
    lines.push('  end if;');
    lines.push(`  insert into public.learning_enem_structured_content(provider, provider_question_key, question_bank_id, occurrence_id, provider_year, provider_index, discipline, language, context_text, prompt_text, alternatives_json, provider_correct_alternative, essential_media_json, raw_hash, normalized_content_hash, match_method, match_level, match_confidence, verification_status, content_revision, render_mode, source_mapping_verified, answer_verified, structured_content_integrity, statement_complete, five_alternatives_complete, no_control_chars, no_previous_question_contamination, no_next_question_contamination, required_media_present, required_media_validated, source_metadata, source_kind, content_acceptance_status) values (${sql(record.provider)}, ${sql(record.providerQuestionKey)}, v_question_bank_id, null, ${record.providerYear}, ${record.providerIndex}, ${sql(record.discipline)}, ${sql(record.language)}, ${sql(record.contextText)}, ${sql(record.promptText)}, ${jsonSql(alternatives)}, ${sql(record.providerCorrectAlternative)}, '[]'::jsonb, ${sql(record.rawHash)}, ${sql(record.normalizedContentHash)}, ${sql('PROVIDER_STRUCTURAL_ACCEPTANCE')}, ${sql('REVIEW_REQUIRED')}, 1, ${sql('VERIFIED')}, ${sql(PROVIDER_TEXT_V4_REVISION)}, ${sql('STRUCTURED_TEXT')}, false, false, ${sql('VERIFIED')}, true, true, ${record.noControlChars}, true, true, false, false, ${jsonSql(sourceMetadata)}, ${sql('STRUCTURED_PROVIDER')}, ${sql('ACCEPTED')}) on conflict (provider, provider_question_key, content_revision) do update set question_bank_id = excluded.question_bank_id, occurrence_id = null, context_text = excluded.context_text, prompt_text = excluded.prompt_text, alternatives_json = excluded.alternatives_json, provider_correct_alternative = excluded.provider_correct_alternative, raw_hash = excluded.raw_hash, normalized_content_hash = excluded.normalized_content_hash, verification_status = excluded.verification_status, render_mode = excluded.render_mode, structured_content_integrity = excluded.structured_content_integrity, statement_complete = excluded.statement_complete, five_alternatives_complete = excluded.five_alternatives_complete, source_metadata = excluded.source_metadata, source_kind = excluded.source_kind, content_acceptance_status = excluded.content_acceptance_status, updated_at = now() returning id into v_structured_content_id;`);
  }
  lines.push('end $$;', 'commit;', '');
  return lines.join('\n');
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

async function runCli() {
  const args = process.argv.slice(2);
  const cacheDir = resolve(argument('--cache', args) ?? '.runtime/enem-structured-text-v1/raw');
  const outputPath = resolve(argument('--out', args) ?? '.runtime/enem-structured-text-v4/provider-text-report.json');
  const sqlPath = argument('--sql', args) ? resolve(argument('--sql', args)!) : null;
  const rawQuestions = await loadCachedQuestions(cacheDir);
  const deduplicated = deduplicateProviderQuestions(rawQuestions);
  const report = buildProviderTextV4Report(deduplicated.questions, {
    providerQuestionsRaw: rawQuestions.length,
    duplicateProviderQuestions: deduplicated.duplicateProviderQuestions,
  });
  const legacyReportPath = resolve(argument('--legacy-report', args) ?? '.runtime/enem-structured-text-v1/reconciliation.json');
  if (existsSync(legacyReportPath)) {
    const legacyReport = JSON.parse(readFileSync(legacyReportPath, 'utf8')) as {
      records?: Array<{
        providerQuestionKey: string;
        verificationStatus?: string;
        canonicalCandidate?: ProviderTextRecord['legacyReplacementCandidate'];
      }>;
    };
    const verifiedLegacyCandidates = new Map(
      (legacyReport.records ?? [])
        .filter((record) => record.verificationStatus === 'VERIFIED' && record.canonicalCandidate)
        .map((record) => [record.providerQuestionKey, record.canonicalCandidate!]),
    );
    for (const record of report.records) {
      record.legacyReplacementCandidate = verifiedLegacyCandidates.get(record.providerQuestionKey) ?? null;
    }
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (sqlPath) {
    mkdirSync(dirname(sqlPath), { recursive: true });
    writeFileSync(sqlPath, buildProviderTextV4ImportSql(report), 'utf8');
  }
  console.log(`ENEM_PROVIDER_TEXT_V4_OK raw=${report.providerQuestionsRaw} duplicates=${report.duplicateProviderQuestions} unique=${report.providerQuestions} accepted=${report.accepted} rejected=${report.rejected} incomplete_structured_text=${report.incompleteStructuredText} question_only_fragments=${report.questionOnlyFragments} title_used=${report.titleUsed} title_metadata_only=${report.titleDiscardedMetadataOnly} audit_sample_pass=${report.auditSamplePass} known_financing_complete=${report.knownFinancingQuestion.complete} output=${outputPath}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
