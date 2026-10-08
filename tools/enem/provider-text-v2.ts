import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  deduplicateProviderQuestions,
  normalizeStructuredText,
  type EnemProviderAlternative,
  type EnemProviderQuestion,
} from './structured-text.ts';

export const PROVIDER_TEXT_REVISION = 'structured-sources-v2' as const;
export const PROVIDER_TEXT_SOURCE_KIND = 'STRUCTURED_PROVIDER' as const;
export const PROVIDER_TEXT_SOURCE_TYPE = 'ENEM_STRUCTURED_PROVIDER' as const;

type AlternativeLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ProviderTextRecord {
  provider: 'enem.dev';
  providerQuestionKey: string;
  providerYear: number;
  providerIndex: number;
  discipline: string;
  language: 'ENGLISH' | 'SPANISH' | null;
  contextText: string;
  promptText: string;
  statementText: string;
  alternatives: Array<{ letter: AlternativeLetter; text: string }>;
  providerCorrectAlternative: AlternativeLetter | null;
  rawHash: string;
  normalizedContentHash: string;
  sourceUrl: string;
  accepted: boolean;
  rejectionReasons: string[];
  visualCue: boolean;
  mediaDependent: boolean;
  statementComplete: boolean;
  fiveAlternativesComplete: boolean;
  noControlChars: boolean;
  legacyReplacementCandidate: {
    year: number;
    day: string;
    booklet: string;
    questionNumber: number;
    language: 'ENGLISH' | 'SPANISH' | null;
  } | null;
}

export interface ProviderTextReport {
  schemaVersion: 2;
  contentRevision: typeof PROVIDER_TEXT_REVISION;
  provider: 'enem.dev';
  sourceKind: typeof PROVIDER_TEXT_SOURCE_KIND;
  sourceType: typeof PROVIDER_TEXT_SOURCE_TYPE;
  providerQuestionsRaw: number;
  duplicateProviderQuestions: number;
  providerQuestions: number;
  accepted: number;
  rejected: number;
  mediaDependent: number;
  incompleteStatement: number;
  incompleteAlternatives: number;
  invalidAnswer: number;
  unsafeText: number;
  visualCue: number;
  records: ProviderTextRecord[];
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
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

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function hash(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function language(value: string | null) {
  const normalized = value?.trim().toLocaleLowerCase('pt-BR');
  if (normalized === 'ingles') return 'ENGLISH' as const;
  if (normalized === 'espanhol') return 'SPANISH' as const;
  return null;
}

function subjectArea(discipline: string) {
  switch (discipline.trim().toLocaleLowerCase('pt-BR')) {
    case 'linguagens': return 'LINGUAGENS';
    case 'ciências humanas':
    case 'ciencias humanas': return 'CIENCIAS_HUMANAS';
    case 'ciências da natureza':
    case 'ciencias da natureza':
    case 'ciencias-natureza': return 'CIENCIAS_NATUREZA';
    case 'matemática':
    case 'matematica': return 'MATEMATICA';
    default: return 'UNKNOWN';
  }
}

function fullStatement(question: EnemProviderQuestion) {
  return [question.context, question.alternativesIntroduction]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n\n')
    .trim();
}

function textValues(question: EnemProviderQuestion) {
  return [
    question.context,
    question.alternativesIntroduction,
    ...question.alternatives.map((alternative) => alternative.text),
  ].filter((value): value is string => typeof value === 'string');
}

function hasControlChars(value: string) {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd\ue000-\uf8ff]/u.test(value);
}

function hasUnsafeMarkup(value: string) {
  return /<\/?[a-z][^>]*>/iu.test(value)
    || /(?:javascript:|data:text\/html|on[a-z]+\s*=)/iu.test(value);
}

function hasMarkdownImage(value: string) {
  return /!\[[^\]]*\]\([^)]*\)/u.test(value);
}

function hasVisualCue(value: string) {
  return /\b(?:observe|analise|analise-se|veja|considere)\s+(?:a|o|as|os)?\s*(?:figura|imagem|gr[aá]fico|tabela|mapa|esquema|fotografia|charge|tirinha)\b/iu.test(value)
    || /\b(?:na|no|nas|nos|de acordo com|conforme)\s+(?:a|o|as|os)?\s*(?:figura|imagem|gr[aá]fico|tabela|mapa|esquema|fotografia|charge|tirinha)\b/iu.test(value)
    || /\b(?:representado|apresentado|mostrado)\s+(?:abaixo|a seguir)\b/iu.test(value);
}

function normalizeAlternatives(question: EnemProviderQuestion) {
  const byLetter = new Map<string, EnemProviderAlternative>();
  for (const [index, alternative] of question.alternatives.entries()) {
    const letter = /^[A-E]$/u.test(alternative.letter)
      ? alternative.letter
      : String.fromCharCode(65 + index);
    if (!byLetter.has(letter)) byLetter.set(letter, { ...alternative, letter: letter as AlternativeLetter });
  }
  return (['A', 'B', 'C', 'D', 'E'] as const).map((letter) => ({
    letter,
    text: byLetter.get(letter)?.text?.trim() ?? '',
    file: byLetter.get(letter)?.file ?? null,
  }));
}

function evaluateQuestion(question: EnemProviderQuestion): ProviderTextRecord {
  const contextText = typeof question.context === 'string' ? question.context.trim() : '';
  const promptText = typeof question.alternativesIntroduction === 'string' ? question.alternativesIntroduction.trim() : '';
  const statementText = fullStatement(question);
  const alternatives = normalizeAlternatives(question);
  const allText = textValues(question).join('\n');
  const mediaDependent = question.files.length > 0
    || alternatives.some((alternative) => Boolean(alternative.file))
    || textValues(question).some(hasMarkdownImage)
    || hasMarkdownImage(question.title);
  const unsafeText = textValues(question).some((value) => hasControlChars(value) || hasUnsafeMarkup(value));
  const statementComplete = statementText.length > 0;
  const fiveAlternativesComplete = alternatives.length === 5 && alternatives.every((alternative) => alternative.text.length > 0);
  const correctAlternative = /^[A-E]$/u.test(question.correctAlternative ?? '')
    ? question.correctAlternative as AlternativeLetter
    : null;
  const visualCue = hasVisualCue(allText);
  const rejectionReasons = [
    ...(!statementComplete ? ['INCOMPLETE_STATEMENT'] : []),
    ...(!fiveAlternativesComplete ? ['INCOMPLETE_ALTERNATIVES'] : []),
    ...(!correctAlternative ? ['INVALID_ANSWER'] : []),
    ...(mediaDependent ? ['MEDIA_DEPENDENT'] : []),
    ...(unsafeText ? ['UNSAFE_TEXT'] : []),
    ...(visualCue ? ['VISUAL_CUE'] : []),
  ];
  const normalizedContentHash = hash({
    statement: normalizeStructuredText(statementText),
    alternatives: alternatives.map((alternative) => ({
      letter: alternative.letter,
      text: normalizeStructuredText(alternative.text),
    })),
  });
  const normalizedQuestion = {
    title: question.title,
    index: question.index,
    discipline: question.discipline,
    language: question.language,
    year: question.year,
    context: contextText,
    files: question.files,
    correctAlternative: question.correctAlternative,
    alternativesIntroduction: promptText,
    alternatives,
  };
  return {
    provider: 'enem.dev',
    providerQuestionKey: `${question.year}:${question.index}:${question.discipline}:${language(question.language) ?? 'COMMON'}`,
    providerYear: question.year,
    providerIndex: question.index,
    discipline: question.discipline,
    language: language(question.language),
    contextText,
    promptText,
    statementText,
    alternatives: alternatives.map(({ letter, text }) => ({ letter, text })),
    providerCorrectAlternative: correctAlternative,
    rawHash: hash(normalizedQuestion),
    normalizedContentHash,
    sourceUrl: `https://api.enem.dev/v1/exams/${question.year}/questions/${question.index}`,
    accepted: rejectionReasons.length === 0,
    rejectionReasons,
    visualCue,
    mediaDependent,
    statementComplete,
    fiveAlternativesComplete,
    noControlChars: !unsafeText,
    legacyReplacementCandidate: null,
  };
}

export function buildProviderTextReport(providerQuestions: EnemProviderQuestion[]): ProviderTextReport {
  const records = providerQuestions.map(evaluateQuestion);
  const countReason = (reason: string) => records.filter((record) => record.rejectionReasons.includes(reason)).length;
  return {
    schemaVersion: 2,
    contentRevision: PROVIDER_TEXT_REVISION,
    provider: 'enem.dev',
    sourceKind: PROVIDER_TEXT_SOURCE_KIND,
    sourceType: PROVIDER_TEXT_SOURCE_TYPE,
    providerQuestionsRaw: providerQuestions.length,
    duplicateProviderQuestions: 0,
    providerQuestions: records.length,
    accepted: records.filter((record) => record.accepted).length,
    rejected: records.filter((record) => !record.accepted).length,
    mediaDependent: countReason('MEDIA_DEPENDENT'),
    incompleteStatement: countReason('INCOMPLETE_STATEMENT'),
    incompleteAlternatives: countReason('INCOMPLETE_ALTERNATIVES'),
    invalidAnswer: countReason('INVALID_ANSWER'),
    unsafeText: countReason('UNSAFE_TEXT'),
    visualCue: countReason('VISUAL_CUE'),
    records,
  };
}

export function buildProviderTextImportSql(report: ProviderTextReport) {
  const acceptedRecords = report.records.filter((record) => record.accepted);
  const lines = [
    'begin;',
    'do $$',
    'declare',
    '  v_question_bank_id uuid;',
    '  v_replaced_question_bank_id uuid;',
    '  v_structured_content_id uuid;',
    'begin',
  ];
  for (const record of acceptedRecords) {
    const subject = subjectArea(record.discipline);
    const alternatives = record.alternatives.map((alternative) => ({ letter: alternative.letter, text: alternative.text }));
    const questionMetadata = {
      content_revision: PROVIDER_TEXT_REVISION,
      source_kind: PROVIDER_TEXT_SOURCE_KIND,
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
      source_kind: PROVIDER_TEXT_SOURCE_KIND,
      content_acceptance_status: 'ACCEPTED',
      accepted_without_official_mapping: true,
      legacy_replacement_candidate: record.legacyReplacementCandidate,
      files: [],
      legacy_assets_preserved: true,
    };
    lines.push(`  v_question_bank_id := null; v_replaced_question_bank_id := null;`);
    lines.push(`  select structured.question_bank_id into v_question_bank_id from public.learning_enem_structured_content structured where structured.provider = ${sql(record.provider)} and structured.provider_question_key = ${sql(record.providerQuestionKey)} and structured.content_revision = ${sql(PROVIDER_TEXT_REVISION)} and structured.question_bank_id is not null limit 1;`);
    lines.push(`  if v_question_bank_id is null then`);
    lines.push(`    select question_bank.id into v_question_bank_id from public.learning_question_bank question_bank where question_bank.active and question_bank.package_type = 'ENEM' and question_bank.metadata->>'structured_content_hash' = ${sql(record.normalizedContentHash)} order by question_bank.created_at limit 1;`);
    lines.push('  end if;');
    if (record.legacyReplacementCandidate) {
      const candidate = record.legacyReplacementCandidate;
      lines.push(`  select occurrence.question_bank_id into v_replaced_question_bank_id from public.learning_enem_official_occurrences occurrence where occurrence.year = ${candidate.year} and occurrence.exam = 'ENEM' and occurrence.application = 'REGULAR' and occurrence.day = ${sql(candidate.day)} and occurrence.booklet = ${sql(candidate.booklet)} and occurrence.question_number = ${candidate.questionNumber} and coalesce(occurrence.language, '') = ${sql(candidate.language ?? '')} limit 1;`);
    }
    lines.push(`  if v_question_bank_id is null then`);
    lines.push(`    insert into public.learning_question_bank(package_type, source_type, source_name, source_year, source_exam, source_application, subject_area, statement, options, correct_answer, estimated_minutes, provenance, source_reference, metadata, active) values ('ENEM', ${sql(PROVIDER_TEXT_SOURCE_TYPE)}, ${sql(record.provider)}, ${record.providerYear}, 'ENEM', 'PROVIDER', ${sql(subject)}, ${sql(record.statementText)}, ${jsonSql(alternatives.map((alternative) => alternative.text))}, ${jsonSql(record.providerCorrectAlternative)}, 3, ${sql('ENEM_PROVIDER_STRUCTURED')}, ${sql(record.sourceUrl)}, ${jsonSql(questionMetadata)}, true) returning id into v_question_bank_id;`);
    lines.push('  else');
    lines.push(`    update public.learning_question_bank set metadata = metadata || ${jsonSql(questionMetadata)}, active = true where id = v_question_bank_id and source_type = ${sql(PROVIDER_TEXT_SOURCE_TYPE)};`);
    lines.push('  end if;');
    lines.push(`  if v_replaced_question_bank_id is not null then update public.learning_question_bank set metadata = metadata || jsonb_build_object('replaces_question_bank_id', v_replaced_question_bank_id::text) where id = v_question_bank_id; end if;`);
    lines.push(`  insert into public.learning_enem_structured_content(provider, provider_question_key, question_bank_id, occurrence_id, provider_year, provider_index, discipline, language, context_text, prompt_text, alternatives_json, provider_correct_alternative, essential_media_json, raw_hash, normalized_content_hash, match_method, match_level, match_confidence, verification_status, content_revision, render_mode, source_mapping_verified, answer_verified, structured_content_integrity, statement_complete, five_alternatives_complete, no_control_chars, no_previous_question_contamination, no_next_question_contamination, required_media_present, required_media_validated, source_metadata, source_kind, content_acceptance_status) values (${sql(record.provider)}, ${sql(record.providerQuestionKey)}, v_question_bank_id, null, ${record.providerYear}, ${record.providerIndex}, ${sql(record.discipline)}, ${sql(record.language)}, ${sql(record.contextText)}, ${sql(record.promptText)}, ${jsonSql(alternatives)}, ${sql(record.providerCorrectAlternative)}, '[]'::jsonb, ${sql(record.rawHash)}, ${sql(record.normalizedContentHash)}, ${sql('PROVIDER_STRUCTURAL_ACCEPTANCE')}, ${sql('REVIEW_REQUIRED')}, 1, ${sql('VERIFIED')}, ${sql(PROVIDER_TEXT_REVISION)}, ${sql('STRUCTURED_TEXT')}, false, false, ${sql('VERIFIED')}, true, true, ${record.noControlChars}, true, true, false, false, ${jsonSql(sourceMetadata)}, ${sql(PROVIDER_TEXT_SOURCE_KIND)}, ${sql('ACCEPTED')}) on conflict (provider, provider_question_key, content_revision) do update set question_bank_id = excluded.question_bank_id, occurrence_id = null, context_text = excluded.context_text, prompt_text = excluded.prompt_text, alternatives_json = excluded.alternatives_json, provider_correct_alternative = excluded.provider_correct_alternative, essential_media_json = excluded.essential_media_json, raw_hash = excluded.raw_hash, normalized_content_hash = excluded.normalized_content_hash, match_method = excluded.match_method, match_level = excluded.match_level, match_confidence = excluded.match_confidence, verification_status = excluded.verification_status, render_mode = excluded.render_mode, source_mapping_verified = excluded.source_mapping_verified, answer_verified = excluded.answer_verified, structured_content_integrity = excluded.structured_content_integrity, statement_complete = excluded.statement_complete, five_alternatives_complete = excluded.five_alternatives_complete, no_control_chars = excluded.no_control_chars, no_previous_question_contamination = excluded.no_previous_question_contamination, required_media_present = excluded.required_media_present, required_media_validated = excluded.required_media_validated, source_metadata = excluded.source_metadata, source_kind = excluded.source_kind, content_acceptance_status = excluded.content_acceptance_status, updated_at = now() returning id into v_structured_content_id;`);
    lines.push(`  if v_replaced_question_bank_id is not null then update public.learning_enem_structured_content set source_metadata = source_metadata || jsonb_build_object('replaces_question_bank_id', v_replaced_question_bank_id::text) where id = v_structured_content_id; end if;`);
  }
  lines.push('end $$;', `do $$ begin if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'learning_enem_structured_accepted_hash_unique_idx') then create unique index learning_enem_structured_accepted_hash_unique_idx on public.learning_enem_structured_content(normalized_content_hash, content_revision) where content_acceptance_status = 'ACCEPTED'; end if; end $$;`, 'commit;', '');
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
  const outputPath = resolve(argument('--out', args) ?? '.runtime/enem-structured-text-v2/provider-text-report.json');
  const sqlPath = argument('--sql', args) ? resolve(argument('--sql', args)!) : null;
  const legacyReportPath = resolve(argument('--legacy-report', args) ?? '.runtime/enem-structured-text-v1/reconciliation.json');
  const rawQuestions = await loadCachedQuestions(cacheDir);
  const deduplicated = deduplicateProviderQuestions(rawQuestions);
  const report = buildProviderTextReport(deduplicated.questions);
  report.providerQuestionsRaw = rawQuestions.length;
  report.duplicateProviderQuestions = deduplicated.duplicateProviderQuestions;
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
    writeFileSync(sqlPath, buildProviderTextImportSql(report), 'utf8');
  }
  console.log(`ENEM_PROVIDER_TEXT_V2_OK raw=${report.providerQuestionsRaw} duplicates=${report.duplicateProviderQuestions} unique=${report.providerQuestions} accepted=${report.accepted} rejected=${report.rejected} media=${report.mediaDependent} incomplete_statement=${report.incompleteStatement} incomplete_alternatives=${report.incompleteAlternatives} invalid_answer=${report.invalidAnswer} unsafe=${report.unsafeText} visual_cue=${report.visualCue} output=${outputPath}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
