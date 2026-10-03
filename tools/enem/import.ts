import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnemDownloadedArtifact } from './download.ts';
import type { CanonicalEnemQuestion } from './canonicalize.ts';
import type { EnemParseResult } from './parse.ts';

interface ImportInputs {
  downloads: { artifacts: EnemDownloadedArtifact[] };
  parsed: EnemParseResult;
  canonical: { canonicalQuestions: CanonicalEnemQuestion[] };
  manifest: {
    manifestFingerprint: string;
    manifestVersion: string;
    years: number[];
    artifactCount: number;
    canonicalQuestionCount: number;
    occurrenceCount: number;
  };
}

export interface EnemImportPlan {
  manifestFingerprint: string;
  canonicalQuestions: number;
  occurrences: number;
  playableQuestions: number;
  annulledQuestions: number;
  simulations: number;
  sql: string;
}

export function selectCanaryQuestions(questions: CanonicalEnemQuestion[]) {
  const ready = questions.filter((question) => question.qualityState === 'PARSED' && question.officialAnswer !== 'ANNULLED');
  return [...new Set(ready.map((question) => question.area))].sort().flatMap((area) => {
    const candidates = ready.filter((question) => question.area === area);
    const selected: CanonicalEnemQuestion[] = [];
    for (const language of ['ENGLISH', 'SPANISH', null] as const) {
      const candidate = candidates.find((question) => question.language === language && !selected.includes(question));
      if (candidate) selected.push(candidate);
      if (selected.length === 3) break;
    }
    for (const candidate of candidates) {
      if (selected.length === 3) break;
      if (!selected.includes(candidate)) selected.push(candidate);
    }
    return selected;
  });
}

function sql(value: string | number | boolean | null) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

function jsonSql(value: unknown) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function artifactKey(day: string, booklet: string) {
  return `${day}:${booklet}`;
}

function buildQuestionLookup(parsed: EnemParseResult) {
  const result = new Map<string, ReturnType<EnemParseResult['artifacts'][number]['questions']['find']>>();
  for (const artifact of parsed.artifacts) {
    for (const question of artifact.questions) {
      result.set(`${artifactKey(artifact.day, artifact.booklet)}:${question.questionNumber}:${question.language ?? ''}`, question);
    }
  }
  return result;
}

function simulationGroups(questions: CanonicalEnemQuestion[]) {
  const groups: Array<{ key: string; title: string; type: 'AREA' | 'MINI'; year: number; questions: CanonicalEnemQuestion[] }> = [];
  for (const year of [...new Set(questions.map((question) => question.year))].sort()) {
    const playable = questions.filter((question) => question.year === year && question.officialAnswer !== 'ANNULLED');
    const areas = [...new Set(playable.map((question) => question.area))].sort();
    for (const area of areas) {
      groups.push({
        key: year === 2025 ? `AREA:${area}` : `AREA:${year}:${area}`,
        title: `ENEM ${year} · ${area.replaceAll('_', ' ')} · prática oficial`,
        type: 'AREA',
        year,
        questions: playable.filter((question) => question.area === area).slice(0, 45),
      });
    }
    groups.push({
      key: year === 2025 ? 'MINI:2025:DIAGNOSTIC' : `MINI:${year}:DIAGNOSTIC`,
      title: `ENEM ${year} · diagnóstico rápido`,
      type: 'MINI',
      year,
      questions: playable.filter((_, index) => index % 4 === 0).slice(0, 10),
    });
  }
  return groups;
}

export function buildEnemImportPlan(inputs: ImportInputs, options: {
  questionSet?: CanonicalEnemQuestion[];
  manifestVersion?: string;
  manifestFingerprint?: string;
} = {}): EnemImportPlan {
  const ready = (options.questionSet ?? inputs.canonical.canonicalQuestions).filter((question) => question.qualityState === 'PARSED');
  const manifestVersion = options.manifestVersion ?? inputs.manifest.manifestVersion;
  const manifestFingerprint = options.manifestFingerprint ?? inputs.manifest.manifestFingerprint;
  const artifactByKey = new Map(inputs.downloads.artifacts.map((artifact) => [artifactKey(artifact.day, artifact.booklet), artifact]));
  const questionByKey = buildQuestionLookup(inputs.parsed);
  const lines: string[] = [
    'begin;',
    'do $$',
    'declare',
    '  v_batch_id uuid;',
    '  v_question_id uuid;',
    '  v_simulation_id uuid;',
    'begin',
    `  select id into v_batch_id from public.learning_enem_import_batches where manifest_version = ${sql(manifestVersion)} and manifest_fingerprint = ${sql(manifestFingerprint)};`,
    `  if v_batch_id is null then insert into public.learning_enem_import_batches(manifest_version, manifest_fingerprint, source_catalog_reference, years, status, artifact_count, canonical_question_count, occurrence_count, metadata) values (${sql(manifestVersion)}, ${sql(manifestFingerprint)}, ${sql('https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos')}, ARRAY[${inputs.manifest.years.join(',')}]::integer[], 'IMPORTED', ${inputs.manifest.artifactCount}, ${ready.length}, ${ready.reduce((total, question) => total + question.occurrences.length, 0)}, ${jsonSql({ source_integrity: 'VERIFIED', pedagogical_enrichment: 'PENDING', adaptive_evidence_enabled: false, imported_by: 'TecEscola ENEM importer V1' })}) returning id into v_batch_id; end if;`,
  ];

  for (const question of ready) {
    const occurrence = question.occurrences[0];
    const artifact = occurrence ? artifactByKey.get(artifactKey(occurrence.day, occurrence.booklet)) : undefined;
    const parsedQuestion = occurrence ? questionByKey.get(`${artifactKey(occurrence.day, occurrence.booklet)}:${occurrence.questionNumber}:${occurrence.language ?? ''}`) : undefined;
    if (!occurrence || !artifact || !parsedQuestion) throw new Error(`ENEM_IMPORT_PROVENANCE_MISSING:${question.canonicalId}`);
    const correctOption = question.officialAnswer !== 'ANNULLED'
      ? question.options[question.officialAnswer.charCodeAt(0) - 'A'.charCodeAt(0)] ?? null
      : null;
    const metadata = {
      canonical_id: question.canonicalId,
      source_integrity: 'VERIFIED',
      pedagogical_enrichment: 'PENDING',
      adaptive_evidence_enabled: false,
      official_answer_letter: question.officialAnswer,
      official_occurrence_count: question.occurrences.length,
      annulled: question.officialAnswer === 'ANNULLED',
    };
    lines.push(`  select id into v_question_id from public.learning_question_bank where source_type = 'ENEM_OFFICIAL' and metadata->>'canonical_id' = ${sql(question.canonicalId)} limit 1;`);
    lines.push(`  if v_question_id is null then insert into public.learning_question_bank(package_type, source_type, source_name, source_year, source_exam, source_application, source_day, source_number, subject_area, statement, options, correct_answer, explanation, estimated_minutes, provenance, source_reference, metadata, active) values ('ENEM', 'ENEM_OFFICIAL', 'INEP', ${question.year}, 'ENEM', 'REGULAR', ${sql(question.day)}, ${occurrence.questionNumber}, ${sql(question.area)}, ${sql(question.statement)}, ${jsonSql(question.options)}, ${correctOption === null ? 'null' : jsonSql(correctOption)}, null, 4, 'INEP_OFFICIAL', ${sql(artifact.sourceReference)}, ${jsonSql(metadata)}, ${question.officialAnswer === 'ANNULLED' ? 'false' : 'true'}) returning id into v_question_id; end if;`);
    for (const item of question.occurrences) {
      const sourceArtifact = artifactByKey.get(artifactKey(item.day, item.booklet));
      const sourceQuestion = questionByKey.get(`${artifactKey(item.day, item.booklet)}:${item.questionNumber}:${item.language ?? ''}`);
      if (!sourceArtifact || !sourceQuestion) throw new Error(`ENEM_IMPORT_OCCURRENCE_PROVENANCE_MISSING:${question.canonicalId}`);
      lines.push(`  insert into public.learning_enem_official_occurrences(batch_id, question_bank_id, canonical_fingerprint, year, exam, application, day, booklet, question_number, language, official_answer, quality_state, source_reference, exam_url, answer_key_url, artifact_sha256, answer_key_sha256, source_page, metadata) values (v_batch_id, v_question_id, ${sql(question.canonicalId)}, ${item.year}, 'ENEM', 'REGULAR', ${sql(item.day)}, ${sql(item.booklet)}, ${item.questionNumber}, ${item.language ? sql(item.language) : 'null'}, ${sql(item.officialAnswer)}, 'IMPORTED', ${sql(sourceArtifact.sourceReference)}, ${sql(sourceArtifact.examUrl)}, ${sql(sourceArtifact.answerKeyUrl)}, ${sql(sourceArtifact.examSha256)}, ${sql(sourceArtifact.answerKeySha256)}, ${sourceQuestion.page}, ${jsonSql({ source_integrity: 'VERIFIED', pedagogical_enrichment: 'PENDING', adaptive_evidence_enabled: false })}) on conflict do nothing;`);
    }
  }

  for (const group of simulationGroups(ready)) {
    const questionCount = group.questions.length;
    lines.push(`  select id into v_simulation_id from public.learning_simulations where institution_id is null and metadata->>'enem_import_key' = ${sql(group.key)} limit 1;`);
    lines.push(`  if v_simulation_id is null then insert into public.learning_simulations(institution_id, title, simulation_type, area, source_year, question_count, duration_minutes, status, metadata) values (null, ${sql(group.title)}, ${sql(group.type)}, ${group.type === 'AREA' ? sql(group.questions[0]?.area ?? null) : 'null'}, ${group.year}, ${questionCount}, ${group.type === 'MINI' ? 25 : 90}, 'PUBLISHED', ${jsonSql({ enem_import_key: group.key, source_integrity: 'VERIFIED', pedagogical_enrichment: 'PENDING', adaptive_evidence_enabled: false })}) returning id into v_simulation_id; end if;`);
    lines.push(`  update public.learning_simulations set question_count = ${questionCount}, updated_at = now() where id = v_simulation_id;`);
    group.questions.forEach((question, index) => {
      lines.push(`  select id into v_question_id from public.learning_question_bank where source_type = 'ENEM_OFFICIAL' and metadata->>'canonical_id' = ${sql(question.canonicalId)} limit 1;`);
      lines.push(`  insert into public.learning_simulation_questions(simulation_id, position, question_bank_id) values (v_simulation_id, ${index + 1}, v_question_id) on conflict do nothing;`);
    });
  }

  lines.push('end $$;', 'commit;');
  return {
    manifestFingerprint: inputs.manifest.manifestFingerprint,
    canonicalQuestions: ready.length,
    occurrences: ready.reduce((total, question) => total + question.occurrences.length, 0),
    playableQuestions: ready.filter((question) => question.officialAnswer !== 'ANNULLED').length,
    annulledQuestions: ready.filter((question) => question.officialAnswer === 'ANNULLED').length,
    simulations: simulationGroups(ready).length,
    sql: `${lines.join('\n')}\n`,
  };
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli() {
  const args = process.argv.slice(2);
  const downloadsPath = argument('--downloads', args) ?? '.runtime/enem-download-2025.json';
  const parsedPath = argument('--parsed', args) ?? '.runtime/enem-parsed-2025.json';
  const canonicalPath = argument('--canonical', args) ?? '.runtime/enem-canonical-2025.json';
  const manifestPath = argument('--manifest', args) ?? '.runtime/enem-import-dry-run-2025.json';
  const outputPath = argument('--out', args) ?? '.runtime/enem-import-2025.sql';
  const rollback = args.includes('--rollback');
  const canary = args.includes('--canary');
  const inputs: ImportInputs = {
    downloads: JSON.parse(readFileSync(resolve(downloadsPath), 'utf8')),
    parsed: JSON.parse(readFileSync(resolve(parsedPath), 'utf8')),
    canonical: JSON.parse(readFileSync(resolve(canonicalPath), 'utf8')),
    manifest: JSON.parse(readFileSync(resolve(manifestPath), 'utf8')),
  };
  const questionSet = canary ? selectCanaryQuestions(inputs.canonical.canonicalQuestions) : undefined;
  const plan = buildEnemImportPlan(inputs, {
    questionSet,
    manifestVersion: canary ? `${inputs.manifest.manifestVersion}_CANARY` : undefined,
    manifestFingerprint: canary ? createHash('sha256').update(`${inputs.manifest.manifestFingerprint}:CANARY`).digest('hex') : undefined,
  });
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, rollback ? plan.sql.replace(/commit;\s*$/u, 'rollback;\n') : plan.sql, 'utf8');
  console.log(`ENEM_IMPORT_SQL_READY canonical=${plan.canonicalQuestions} occurrences=${plan.occurrences} playable=${plan.playableQuestions} annulled=${plan.annulledQuestions} simulations=${plan.simulations} output=${resolvedOutput}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
