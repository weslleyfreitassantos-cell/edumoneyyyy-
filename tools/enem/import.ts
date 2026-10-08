import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnemDownloadedArtifact } from './download.ts';
import type { CanonicalEnemQuestion } from './canonicalize.ts';
import type { EnemParseResult } from './parse.ts';
import { renderQuestionKey, type EnemAssetRenderManifest, type RenderedQuestionAssetManifest } from './render-question-assets.ts';
import { ENEM_AREAS, ENEM_SUBJECTS, buildSubjectClassificationRegistry, type SubjectClassificationRecord } from './classification.ts';
import { isEnemImportableQuestion } from './importability.ts';

interface ImportInputs {
  downloads: { artifacts: EnemDownloadedArtifact[] };
  parsed: EnemParseResult;
  canonical: { canonicalQuestions: CanonicalEnemQuestion[] };
  assets?: { artifacts: EnemAssetRenderManifest[] };
  classification?: SubjectClassificationRecord[];
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
  const ready = questions.filter(isEnemImportableQuestion);
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
  const utf8Hex = Buffer.from(value, 'utf8').toString('hex');
  return `convert_from(decode('${utf8Hex}', 'hex'), 'UTF8')`;
}

function jsonSql(value: unknown) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function artifactKey(year: number, day: string, booklet: string) {
  return `${year}:${day}:${booklet}`;
}

function buildQuestionLookup(parsed: EnemParseResult) {
  const result = new Map<string, ReturnType<EnemParseResult['artifacts'][number]['questions']['find']>>();
  for (const artifact of parsed.artifacts) {
    for (const question of artifact.questions) {
      result.set(`${artifactKey(artifact.year, artifact.day, artifact.booklet)}:${question.questionNumber}:${question.language ?? ''}`, question);
    }
  }
  return result;
}

const subjectTitles: Record<typeof ENEM_SUBJECTS[number], string> = {
  MATEMATICA: 'Matemática',
  LINGUA_PORTUGUESA: 'Língua Portuguesa',
  HISTORIA: 'História',
  GEOGRAFIA: 'Geografia',
  FILOSOFIA: 'Filosofia',
  SOCIOLOGIA: 'Sociologia',
  BIOLOGIA: 'Biologia',
  QUIMICA: 'Química',
  FISICA: 'Física',
  INGLES: 'Inglês',
  ESPANHOL: 'Espanhol',
};

const areaTitles: Record<typeof ENEM_AREAS[number], string> = {
  LINGUAGENS: 'Linguagens, Códigos e suas Tecnologias',
  CIENCIAS_HUMANAS: 'Ciências Humanas e suas Tecnologias',
  CIENCIAS_NATUREZA: 'Ciências da Natureza e suas Tecnologias',
  MATEMATICA: 'Matemática e suas Tecnologias',
};

function dynamicTemplates() {
  return [
    ...ENEM_SUBJECTS.map((subject) => ({ key: `SUBJECT:${subject}`, title: subjectTitles[subject], type: 'SUBJECT' as const, subject, area: null, count: 10, duration: 20 })),
    ...ENEM_AREAS.map((area) => ({ key: `AREA:${area}`, title: areaTitles[area], type: 'AREA' as const, subject: null, area, count: 45, duration: 90 })),
  ];
}

export function buildEnemImportPlan(inputs: ImportInputs, options: {
  questionSet?: CanonicalEnemQuestion[];
  manifestVersion?: string;
  manifestFingerprint?: string;
} = {}): EnemImportPlan {
  const registry = inputs.classification ?? buildSubjectClassificationRegistry(inputs.canonical.canonicalQuestions);
  const registryById = new Map(registry.map((record) => [record.canonical_id, record]));
  const sourceReady = (options.questionSet ?? inputs.canonical.canonicalQuestions).filter(isEnemImportableQuestion);
  const manifestVersion = options.manifestVersion ?? inputs.manifest.manifestVersion;
  const manifestFingerprint = options.manifestFingerprint ?? inputs.manifest.manifestFingerprint;
  const artifactByKey = new Map(inputs.downloads.artifacts.map((artifact) => [artifactKey(artifact.year, artifact.day, artifact.booklet), artifact]));
  const questionByKey = buildQuestionLookup(inputs.parsed);
  const renderByKey = new Map<string, RenderedQuestionAssetManifest>();
  for (const manifest of inputs.assets?.artifacts ?? []) {
    for (const question of manifest.questions) renderByKey.set(renderQuestionKey(manifest, question.questionNumber, question.language), question);
  }
  const ready = inputs.assets
    ? sourceReady.filter((question) => question.occurrences.some((occurrence) => renderByKey.get(renderQuestionKey(occurrence, occurrence.questionNumber, occurrence.language))?.renderReady))
    : sourceReady;
  const lines: string[] = [
    'begin;',
    'do $$',
    'declare',
    '  v_batch_id uuid;',
    '  v_question_id uuid;',
    '  v_occurrence_id uuid;',
    '  v_simulation_id uuid;',
    'begin',
    `  select id into v_batch_id from public.learning_enem_import_batches where manifest_version = ${sql(manifestVersion)} and manifest_fingerprint = ${sql(manifestFingerprint)};`,
    `  if v_batch_id is null then insert into public.learning_enem_import_batches(manifest_version, manifest_fingerprint, source_catalog_reference, years, status, artifact_count, canonical_question_count, occurrence_count, metadata) values (${sql(manifestVersion)}, ${sql(manifestFingerprint)}, ${sql('https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos')}, ARRAY[${inputs.manifest.years.join(',')}]::integer[], 'IMPORTED', ${inputs.manifest.artifactCount}, ${ready.length}, ${ready.reduce((total, question) => total + question.occurrences.length, 0)}, ${jsonSql({ source_integrity: 'VERIFIED', pedagogical_enrichment: 'PENDING', adaptive_evidence_enabled: false, imported_by: 'TecEscola ENEM importer V1' })}) returning id into v_batch_id; end if;`,
  ];

  for (const question of ready) {
    const record = registryById.get(question.canonicalId);
    const occurrence = question.occurrences.find((item) => renderByKey.get(renderQuestionKey(item, item.questionNumber, item.language))?.renderReady) ?? question.occurrences[0];
    const artifact = occurrence ? artifactByKey.get(artifactKey(occurrence.year, occurrence.day, occurrence.booklet)) : undefined;
    const parsedQuestion = occurrence ? questionByKey.get(`${artifactKey(occurrence.year, occurrence.day, occurrence.booklet)}:${occurrence.questionNumber}:${occurrence.language ?? ''}`) : undefined;
    if (!occurrence || !artifact || !parsedQuestion || !record?.area_verified) throw new Error(`ENEM_IMPORT_PROVENANCE_MISSING:${question.canonicalId}`);
    const correctOption = question.officialAnswer !== 'ANNULLED'
      ? question.options[question.officialAnswer.charCodeAt(0) - 'A'.charCodeAt(0)] ?? null
      : null;
    const firstRender = renderByKey.get(renderQuestionKey(occurrence, occurrence.questionNumber, occurrence.language));
    const metadata = {
      canonical_id: question.canonicalId,
      source_integrity: 'VERIFIED',
      statement_integrity: question.statementIntegrity ?? 'REVIEW_REQUIRED',
      options_integrity: question.optionsIntegrity ?? 'REVIEW_REQUIRED',
      control_char_count: question.controlCharCount ?? 0,
      render_mode: firstRender?.renderMode ?? 'TEXT_OPTIONS',
      render_ready: firstRender?.renderReady ?? false,
      area_verified: record.area_verified,
      enem_subject: record.subject,
      subject_verified: record.subject_verified,
      classification_reason_code: record.reason_code,
      classification_source_fingerprint: record.source_fingerprint,
      statement_assets: firstRender?.statementAssets ?? [],
      option_assets: firstRender?.optionAssets ?? {},
      enem_area: record.area,
      pedagogical_enrichment: 'PENDING',
      adaptive_evidence_enabled: false,
      official_answer_letter: question.officialAnswer,
      official_occurrence_count: question.occurrences.length,
      annulled: question.officialAnswer === 'ANNULLED',
      source_provenance: {
        year: occurrence.year,
        exam: 'ENEM',
        application: 'REGULAR',
        day: occurrence.day,
        booklet: occurrence.booklet,
        question_number: occurrence.questionNumber,
        language: occurrence.language,
        source_page: parsedQuestion.page,
        source_sha256: artifact.examSha256,
      },
    };
    lines.push(`  select id into v_question_id from public.learning_question_bank where source_type = 'ENEM_OFFICIAL' and metadata->>'canonical_id' = ${sql(question.canonicalId)} limit 1;`);
    lines.push(`  if v_question_id is null then insert into public.learning_question_bank(package_type, source_type, source_name, source_year, source_exam, source_application, source_day, source_number, subject_area, statement, options, correct_answer, explanation, estimated_minutes, provenance, source_reference, metadata, active) values ('ENEM', 'ENEM_OFFICIAL', 'INEP', ${occurrence.year}, 'ENEM', 'REGULAR', ${sql(occurrence.day)}, ${occurrence.questionNumber}, ${sql(record.area)}, ${sql(question.statement)}, ${jsonSql(question.options)}, ${correctOption === null ? 'null' : jsonSql(correctOption)}, null, 4, 'INEP_OFFICIAL', ${sql(artifact.sourceReference)}, ${jsonSql(metadata)}, true) returning id into v_question_id; end if;`);
    lines.push(`  update public.learning_question_bank set package_type = 'ENEM', source_name = 'INEP', source_year = ${occurrence.year}, source_exam = 'ENEM', source_application = 'REGULAR', source_day = ${sql(occurrence.day)}, source_number = ${occurrence.questionNumber}, subject_area = ${sql(record.area)}, statement = ${sql(question.statement)}, options = ${jsonSql(question.options)}, correct_answer = ${correctOption === null ? 'null' : jsonSql(correctOption)}, provenance = 'INEP_OFFICIAL', source_reference = ${sql(artifact.sourceReference)}, metadata = ${jsonSql(metadata)}, active = true, updated_at = now() where id = v_question_id;`);
    for (const item of question.occurrences) {
      const sourceArtifact = artifactByKey.get(artifactKey(item.year, item.day, item.booklet));
      const sourceQuestion = questionByKey.get(`${artifactKey(item.year, item.day, item.booklet)}:${item.questionNumber}:${item.language ?? ''}`);
      if (!sourceArtifact || !sourceQuestion) throw new Error(`ENEM_IMPORT_OCCURRENCE_PROVENANCE_MISSING:${question.canonicalId}`);
      lines.push(`  insert into public.learning_enem_official_occurrences(batch_id, question_bank_id, canonical_fingerprint, year, exam, application, day, booklet, question_number, language, official_answer, quality_state, source_reference, exam_url, answer_key_url, artifact_sha256, answer_key_sha256, source_page, metadata) values (v_batch_id, v_question_id, ${sql(question.canonicalId)}, ${item.year}, 'ENEM', 'REGULAR', ${sql(item.day)}, ${sql(item.booklet)}, ${item.questionNumber}, ${item.language ? sql(item.language) : 'null'}, ${sql(item.officialAnswer)}, 'IMPORTED', ${sql(sourceArtifact.sourceReference)}, ${sql(sourceArtifact.examUrl)}, ${sql(sourceArtifact.answerKeyUrl)}, ${sql(sourceArtifact.examSha256)}, ${sql(sourceArtifact.answerKeySha256)}, ${sourceQuestion.page}, ${jsonSql({ source_integrity: 'VERIFIED', render_mode: 'HYBRID', pedagogical_enrichment: 'PENDING', adaptive_evidence_enabled: false })}) on conflict do nothing;`);
      lines.push(`  select id into v_occurrence_id from public.learning_enem_official_occurrences where year = ${item.year} and exam = 'ENEM' and application = 'REGULAR' and day = ${sql(item.day)} and booklet = ${sql(item.booklet)} and question_number = ${item.questionNumber} and coalesce(language, '') = ${sql(item.language ?? '')} limit 1;`);
      const render = renderByKey.get(renderQuestionKey(item, item.questionNumber, item.language));
      for (const asset of render?.statementAssets ?? []) {
        lines.push(`  insert into public.learning_enem_media_assets(occurrence_id, media_fingerprint, media_type, source_page, storage_path, quality_state, metadata) values (v_occurrence_id, ${sql(asset.sha256)}, ${sql(asset.mediaType)}, ${asset.page}, ${sql(asset.storagePath)}, ${render.renderReady ? "'VALIDATED'" : "'REVIEW_REQUIRED'"}, ${jsonSql({ asset_role: asset.assetRole, official_pdf_crop: true, render_ready: render.renderReady, sha256: asset.sha256, crop: asset.crop, source_page: asset.page, excluded_option_labels: render.excludedOptionLabels })}) on conflict do nothing;`);
      }
      for (const option of Object.values(render?.optionAssets ?? {}).flat()) {
        lines.push(`  insert into public.learning_enem_media_assets(occurrence_id, media_fingerprint, media_type, source_page, storage_path, quality_state, metadata) values (v_occurrence_id, ${sql(option.sha256)}, ${sql(option.mediaType)}, ${option.page}, ${sql(option.storagePath)}, ${render?.renderReady ? "'VALIDATED'" : "'REVIEW_REQUIRED'"}, ${jsonSql({ asset_role: option.assetRole, option_label: option.optionLabel, official_pdf_crop: true, render_ready: render?.renderReady ?? false, sha256: option.sha256, crop: option.crop, source_page: option.page })}) on conflict do nothing;`);
      }
    }
  }

  for (const template of dynamicTemplates()) {
    const metadata = {
      dynamic_pool: true,
      dynamic_key: template.key,
      enem_mode: template.type,
      enem_subject: template.subject,
      enem_area: template.area,
      display_title: template.title,
      source_integrity: 'VERIFIED',
    };
    lines.push(`  select id into v_simulation_id from public.learning_simulations where institution_id is null and metadata->>'dynamic_key' = ${sql(template.key)} limit 1;`);
    lines.push(`  if v_simulation_id is null then insert into public.learning_simulations(institution_id, title, simulation_type, area, source_year, question_count, duration_minutes, status, metadata) values (null, ${sql(template.title)}, ${sql(template.type)}, ${sql(template.area)}, null, ${template.count}, ${template.duration}, 'PUBLISHED', ${jsonSql(metadata)}) returning id into v_simulation_id; end if;`);
    lines.push(`  update public.learning_simulations set title = ${sql(template.title)}, simulation_type = ${sql(template.type)}, area = ${sql(template.area)}, source_year = null, question_count = ${template.count}, duration_minutes = ${template.duration}, status = 'PUBLISHED', metadata = ${jsonSql(metadata)}, updated_at = now() where id = v_simulation_id;`);
  }

  lines.push('end $$;', 'commit;');
  return {
    manifestFingerprint: inputs.manifest.manifestFingerprint,
    canonicalQuestions: ready.length,
    occurrences: ready.reduce((total, question) => total + question.occurrences.length, 0),
    playableQuestions: ready.filter((question) => question.officialAnswer !== 'ANNULLED').length,
    annulledQuestions: ready.filter((question) => question.officialAnswer === 'ANNULLED').length,
    simulations: dynamicTemplates().length,
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
  const assetsPath = argument('--assets', args);
  const classificationPath = argument('--classification', args);
  const outputPath = argument('--out', args) ?? '.runtime/enem-import-2025.sql';
  const rollback = args.includes('--rollback');
  const canary = args.includes('--canary');
  const inputs: ImportInputs = {
    downloads: JSON.parse(readFileSync(resolve(downloadsPath), 'utf8')),
    parsed: JSON.parse(readFileSync(resolve(parsedPath), 'utf8')),
    canonical: JSON.parse(readFileSync(resolve(canonicalPath), 'utf8')),
    manifest: JSON.parse(readFileSync(resolve(manifestPath), 'utf8')),
    assets: assetsPath ? JSON.parse(readFileSync(resolve(assetsPath), 'utf8')) : undefined,
    classification: classificationPath ? JSON.parse(readFileSync(resolve(classificationPath), 'utf8')) : undefined,
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
