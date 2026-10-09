import { readFileSync, writeFileSync } from 'node:fs';

interface ArchiveRecord {
  provider: string;
  contentRevision: string;
  providerQuestionKey: string;
  application: string;
  year: number;
  questionNumber: number;
  language: string | null;
  contextText: string;
  promptText: string;
  blocks: Array<Record<string, unknown>>;
  alternatives: Array<{ letter: string; text: string; blocks: Array<Record<string, unknown>>; media: Array<Record<string, unknown>> }>;
  normalizedContentHash: string;
}

interface ArchiveReport {
  records: ArchiveRecord[];
}

function identity(record: ArchiveRecord) {
  return `${record.application}:${record.year}:${record.questionNumber}:${record.language ?? 'COMMON'}`;
}

function sql(value: string | number | null) {
  if (value === null) return 'null';
  const text = String(value);
  return `convert_from(decode('${Buffer.from(text, 'utf8').toString('hex')}', 'hex'), 'UTF8')`;
}

function json(value: unknown) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function runtimeMedia(media: Record<string, unknown>) {
  return {
    media_type: 'IMAGE',
    storage_path: media.canonicalPath ?? null,
    public_url: null,
    metadata: { source: media.source ?? null, archive_path: media.archivePath ?? null },
  };
}

function runtimeBlocks(record: ArchiveRecord) {
  return record.blocks.map((block) => ({
    ...block,
    media: Array.isArray(block.media) ? block.media.map((media) => runtimeMedia(media as Record<string, unknown>)) : [],
  }));
}

function runtimeOptions(record: ArchiveRecord) {
  return record.alternatives.map((alternative) => ({
    letter: alternative.letter,
    text: alternative.text || null,
    assets: alternative.media.map((media) => runtimeMedia(media)),
  }));
}

function changed(previous: ArchiveRecord, current: ArchiveRecord) {
  return JSON.stringify(previous.blocks) !== JSON.stringify(current.blocks)
    || JSON.stringify(previous.alternatives) !== JSON.stringify(current.alternatives)
    || previous.contextText !== current.contextText
    || previous.promptText !== current.promptText;
}

function buildBackfillSql(previousReport: ArchiveReport, currentReport: ArchiveReport) {
  const previousByIdentity = new Map(previousReport.records.map((record) => [identity(record), record]));
  const records = currentReport.records.filter((record) => {
    if (record.year < 2009 || record.year > 2025 || record.questionNumber < 1) return false;
    const previous = previousByIdentity.get(identity(record));
    return previous ? changed(previous, record) : false;
  });
  const lines = ['begin;', 'do $$', 'declare', '  v_found integer;', 'begin'];

  for (const record of records) {
    const previous = previousByIdentity.get(identity(record));
    if (!previous) continue;
    const options = runtimeOptions(record);
    const blocks = runtimeBlocks(record);
    const statement = [record.contextText, record.promptText].filter(Boolean).join('\n\n');

    lines.push(
      `  update public.learning_enem_structured_content set provider_question_key = ${sql(record.providerQuestionKey)}, context_text = ${sql(record.contextText)}, prompt_text = ${sql(record.promptText)}, alternatives_json = ${json(options)}, content_blocks_json = ${json(blocks)}, normalized_content_hash = ${sql(record.normalizedContentHash)}, source_metadata = jsonb_set(jsonb_set(source_metadata, '{provider_question_key}', ${json(record.providerQuestionKey)}, true), '{content_blocks}', ${json(blocks)}, true), updated_at = now() where provider = ${sql(record.provider)} and provider_question_key = ${sql(previous.providerQuestionKey)} and content_revision = ${sql(record.contentRevision)};`,
    );
    lines.push('  get diagnostics v_found = row_count;');
    lines.push(`  if v_found <> 1 then raise exception 'ENEM_FORMATTING_BACKFILL_STRUCTURED_MISMATCH: ${identity(record)}'; end if;`);
    lines.push(
      `  update public.learning_question_bank question_bank set statement = ${sql(statement)}, options = ${json(options)}, metadata = jsonb_set(jsonb_set(question_bank.metadata, '{provider_question_key}', ${json(record.providerQuestionKey)}, true), '{content_blocks}', ${json(blocks)}, true), updated_at = now() from public.learning_enem_structured_content structured where structured.question_bank_id = question_bank.id and structured.provider = ${sql(record.provider)} and structured.provider_question_key = ${sql(record.providerQuestionKey)} and structured.content_revision = ${sql(record.contentRevision)};`,
    );
    lines.push('  get diagnostics v_found = row_count;');
    lines.push(`  if v_found <> 1 then raise exception 'ENEM_FORMATTING_BACKFILL_BANK_MISMATCH: ${identity(record)}'; end if;`);
  }

  lines.push('end $$;', "notify pgrst, 'reload schema';", 'commit;', '');
  return { sql: lines.join('\n'), records: records.length };
}

const [previousPath, currentPath, outputPath] = process.argv.slice(2);
if (!previousPath || !currentPath || !outputPath) {
  throw new Error('Usage: node --experimental-strip-types tools/enem/build-xequemat-formatting-backfill.ts <previous-report> <current-report> <output-sql>');
}

const result = buildBackfillSql(
  JSON.parse(readFileSync(previousPath, 'utf8')) as ArchiveReport,
  JSON.parse(readFileSync(currentPath, 'utf8')) as ArchiveReport,
);
writeFileSync(outputPath, result.sql);
console.log(JSON.stringify({ outputPath, records: result.records, bytes: Buffer.byteLength(result.sql, 'utf8') }, null, 2));
