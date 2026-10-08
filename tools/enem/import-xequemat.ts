import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { XequematArchiveQuestion, XequematArchiveReport } from './xequemat-archive.ts';

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function sql(value: string | number | boolean | null) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  const hex = Buffer.from(value, 'utf8').toString('hex');
  return `convert_from(decode('${hex}', 'hex'), 'UTF8')`;
}

function jsonSql(value: unknown) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function statement(record: XequematArchiveQuestion) {
  return [record.contextText, record.promptText].filter(Boolean).join('\n\n');
}

function runtimeMedia(media: XequematArchiveQuestion['media'][number]) {
  return {
    media_type: 'IMAGE',
    storage_path: media.canonicalPath,
    public_url: null,
    metadata: { source: media.source, archive_path: media.archivePath },
  };
}

function runtimeBlocks(record: XequematArchiveQuestion) {
  return record.blocks.map((block) => ({
    ...block,
    media: (block.media ?? []).map(runtimeMedia),
  }));
}

function metadata(record: XequematArchiveQuestion, active: boolean) {
  return {
    provider: record.provider,
    provider_question_key: record.providerQuestionKey,
    content_revision: record.contentRevision,
    source_exam: 'ENEM',
    source_application: record.application,
    source_question_number: record.questionNumber,
    source_day: record.day,
    source_url: record.sourceUrl,
    source_provider: record.provider,
    source_area: record.area,
    source_subject: record.subject,
    rights_status: record.rightsStatus,
    rejection_reasons: record.rejectionReasons,
    render_mode: record.media.length > 0 ? 'STRUCTURED_TEXT_WITH_MEDIA' : 'STRUCTURED_TEXT',
    catalog_status: active ? 'READY' : 'STAGING',
    source_identity_label: `ENEM ${record.year} · ${record.application === 'PPL' ? 'PPL' : 'Regular'} · Questão ${record.questionNumber}`,
    content_blocks: runtimeBlocks(record),
  };
}

function isStructurallyComplete(record: XequematArchiveQuestion) {
  return record.completeStatement
    && record.completeAlternatives
    && record.answerPresent
    && record.rejectionReasons.every((reason) => reason === 'RIGHTS_UNRESOLVED' || reason === 'MISSING_ESSENTIAL_MEDIA');
}

function buildQuestionSql(record: XequematArchiveQuestion) {
  const mediaRequired = record.media.length > 0;
  // This generator never claims media was uploaded to the controlled bucket.
  // Media rows remain staging until the asset upload/validation step completes.
  const active = record.ready && !mediaRequired && record.rightsStatus === 'VERIFIED';
  const verificationStatus = active ? 'VERIFIED' : 'REVIEW_REQUIRED';
  const acceptance = active ? 'ACCEPTED' : (isStructurallyComplete(record) ? 'REVIEW_REQUIRED' : 'REJECTED');
  const renderMode = mediaRequired ? 'STRUCTURED_TEXT_WITH_MEDIA' : 'STRUCTURED_TEXT';
  const options = record.alternatives.map((item) => ({
    letter: item.letter,
    text: item.text || null,
    assets: item.media.map(runtimeMedia),
  }));
  const sourceMetadata = {
    ...metadata(record, active),
    source_file: record.sourceFile,
    source_hash: record.sourceHash,
  };
  const lines: string[] = [];
  lines.push(`  select id into v_question_id from public.learning_question_bank where source_type = 'ENEM_STRUCTURED_PROVIDER' and metadata->>'provider_question_key' = ${sql(record.providerQuestionKey)} limit 1;`);
  lines.push(`  if v_question_id is null then`);
  lines.push(`    insert into public.learning_question_bank(package_type, source_type, source_name, source_year, source_exam, source_application, source_day, source_number, source_question_number, source_url, source_provider, subject_area, statement, options, correct_answer, explanation, estimated_minutes, provenance, source_reference, metadata, active) values ('ENEM', 'ENEM_STRUCTURED_PROVIDER', 'xequemat', ${record.year}, 'ENEM', ${sql(record.application)}, ${sql(record.day === null ? null : String(record.day))}, ${record.questionNumber}, ${record.questionNumber}, ${sql(record.sourceUrl)}, ${sql(record.provider)}, ${sql(record.area)}, ${sql(statement(record))}, ${jsonSql(options)}, ${jsonSql(record.correctAlternative)}, null, 5, 'XEQUEMAT_ARCHIVE_V1', ${sql(record.sourceUrl)}, ${jsonSql(sourceMetadata)}, ${active}) returning id into v_question_id;`);
  lines.push(`  else`);
  lines.push(`    update public.learning_question_bank set package_type = 'ENEM', source_name = 'xequemat', source_year = ${record.year}, source_exam = 'ENEM', source_application = ${sql(record.application)}, source_day = ${sql(record.day === null ? null : String(record.day))}, source_number = ${record.questionNumber}, source_question_number = ${record.questionNumber}, source_url = ${sql(record.sourceUrl)}, source_provider = ${sql(record.provider)}, subject_area = ${sql(record.area)}, statement = ${sql(statement(record))}, options = ${jsonSql(options)}, correct_answer = ${jsonSql(record.correctAlternative)}, provenance = 'XEQUEMAT_ARCHIVE_V1', source_reference = ${sql(record.sourceUrl)}, metadata = ${jsonSql(sourceMetadata)}, active = ${active}, updated_at = now() where id = v_question_id;`);
  lines.push(`  end if;`);
  lines.push(`  insert into public.learning_enem_structured_content(provider, provider_question_key, question_bank_id, occurrence_id, provider_year, provider_index, discipline, language, context_text, prompt_text, alternatives_json, provider_correct_alternative, essential_media_json, content_blocks_json, raw_hash, normalized_content_hash, match_method, match_level, match_confidence, verification_status, content_revision, render_mode, source_mapping_verified, answer_verified, structured_content_integrity, statement_complete, five_alternatives_complete, no_control_chars, no_previous_question_contamination, no_next_question_contamination, required_media_present, required_media_validated, source_metadata, source_kind, content_acceptance_status, source_exam, source_application, source_question_number, source_day, source_url, source_provider, rights_status, rejection_reasons_json) values (${sql(record.provider)}, ${sql(record.providerQuestionKey)}, v_question_id, null, ${record.year}, ${record.questionNumber}, ${sql(record.area)}, ${sql(record.language)}, ${sql(record.contextText)}, ${sql(record.promptText)}, ${jsonSql(options)}, ${sql(record.correctAlternative)}, ${jsonSql(record.media.map(runtimeMedia))}, ${jsonSql(runtimeBlocks(record))}, ${sql(record.sourceHash)}, ${sql(record.normalizedContentHash)}, 'XEQUEMAT_ARCHIVE_IDENTITY', 'REVIEW_REQUIRED', 0.75, ${sql(verificationStatus)}, ${sql(record.contentRevision)}, ${sql(renderMode)}, false, ${record.answerPresent}, ${active ? sql('VERIFIED') : sql('REVIEW_REQUIRED')}, ${record.completeStatement}, ${record.completeAlternatives}, true, true, true, ${mediaRequired}, ${!mediaRequired && active}, ${jsonSql(sourceMetadata)}, 'STRUCTURED_PROVIDER', ${sql(acceptance)}, 'ENEM', ${sql(record.application)}, ${record.questionNumber}, ${sql(record.day === null ? null : String(record.day))}, ${sql(record.sourceUrl)}, ${sql(record.provider)}, ${sql(record.rightsStatus)}, ${jsonSql(record.rejectionReasons)}) on conflict (provider, provider_question_key, content_revision) do update set question_bank_id = excluded.question_bank_id, context_text = excluded.context_text, prompt_text = excluded.prompt_text, alternatives_json = excluded.alternatives_json, provider_correct_alternative = excluded.provider_correct_alternative, essential_media_json = excluded.essential_media_json, content_blocks_json = excluded.content_blocks_json, verification_status = excluded.verification_status, render_mode = excluded.render_mode, answer_verified = excluded.answer_verified, structured_content_integrity = excluded.structured_content_integrity, statement_complete = excluded.statement_complete, five_alternatives_complete = excluded.five_alternatives_complete, required_media_present = excluded.required_media_present, required_media_validated = excluded.required_media_validated, source_metadata = excluded.source_metadata, content_acceptance_status = excluded.content_acceptance_status, source_exam = excluded.source_exam, source_application = excluded.source_application, source_question_number = excluded.source_question_number, source_day = excluded.source_day, source_url = excluded.source_url, source_provider = excluded.source_provider, rights_status = excluded.rights_status, rejection_reasons_json = excluded.rejection_reasons_json, updated_at = now();`);
  return lines;
}

export function buildXequematImportSql(report: XequematArchiveReport) {
  const importableRecords = report.records.filter((record) =>
    record.year >= 2009 && record.year <= 2025 && record.questionNumber > 0,
  );
  const lines = [
    'begin;',
    'do $$',
    'declare',
    '  v_question_id uuid;',
    'begin',
  ];
  for (const record of importableRecords) {
    lines.push('  v_question_id := null;');
    lines.push(...buildQuestionSql(record));
  }
  lines.push('end $$;', 'notify pgrst, \'reload schema\';', 'commit;', '');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const reportPath = resolve(argument('--report', args) ?? '.runtime/enem-xequemat-archive-v1/report.json');
  const outputPath = resolve(argument('--out', args) ?? '.runtime/enem-xequemat-archive-v1/import.sql');
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as XequematArchiveReport;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buildXequematImportSql(report));
  const importableRecords = report.records.filter((record) => record.year >= 2009 && record.year <= 2025 && record.questionNumber > 0);
  const active = importableRecords.filter((record) => record.ready && record.media.length === 0 && record.rightsStatus === 'VERIFIED').length;
  console.log(JSON.stringify({ outputPath, records: importableRecords.length, skippedInvalidSource: report.records.length - importableRecords.length, active, staging: importableRecords.length - active, rightsStatus: report.rightsStatus }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\//u, ''))) main();
