#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAIN = '562fd003e643124981e8345a6a83b11a660c1d16';
const SOURCE_BASE = 'edf53f75dc9693ff0467925cbef4613c0b432910';
const SOURCE_HEAD = '2961073c44d3ae09605b3d481d346c92d7aec46b';
const RECOVERY_HEAD = 'e93fb56ae2ec9a93795c406312ca23c5ef3f690d';
const REPORT_DIR = 'docs/reconciliation';
const CSV_PATH = path.join(REPORT_DIR, 'tec-escola-bncc-v5-pr360-v14-inventory.csv');
const COLLISION = 'supabase/migrations/20261015000100_bncc_art_exclude_unsubstantiated_poster_question.sql';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).trimEnd();
}

function treeMap(commit) {
  const output = execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', commit], {
    maxBuffer: 128 * 1024 * 1024,
  });
  const map = new Map();
  for (const entry of output.toString('utf8').split('\0').filter(Boolean)) {
    const tab = entry.indexOf('\t');
    const metadata = entry.slice(0, tab).split(' ');
    map.set(entry.slice(tab + 1), metadata[2]);
  }
  return map;
}

function readBlobs(blobIds) {
  const ids = [...new Set(blobIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const result = spawnSync('git', ['cat-file', '--batch'], {
    input: `${ids.join('\n')}\n`, encoding: null, maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`git cat-file --batch failed: ${result.stderr.toString('utf8')}`);
  const bytes = result.stdout;
  const blobs = new Map();
  let cursor = 0;
  for (const requestedId of ids) {
    const endOfHeader = bytes.indexOf(10, cursor);
    const header = bytes.subarray(cursor, endOfHeader).toString('ascii').split(' ');
    if (header[1] !== 'blob') throw new Error(`Expected blob ${requestedId}, received ${header.join(' ')}`);
    const size = Number(header[2]);
    cursor = endOfHeader + 1;
    blobs.set(requestedId, bytes.subarray(cursor, cursor + size).toString('utf8'));
    cursor += size + 1;
  }
  return blobs;
}

function parseNulNameStatus(buffer) {
  const tokens = buffer.toString('utf8').split('\0').filter(Boolean);
  const entries = [];
  for (let i = 0; i < tokens.length;) {
    const status = tokens[i++];
    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = tokens[i++];
      const filePath = tokens[i++];
      entries.push({ status, oldPath, filePath });
    } else {
      const filePath = tokens[i++];
      entries.push({ status, oldPath: status === 'D' ? filePath : '', filePath });
    }
  }
  return entries;
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function category(file) {
  const p = file.toLowerCase();
  if (/inclusive|educacao-inclusiva|pei|paee|aee/.test(p)) return '12-inclusive-education';
  if (p.startsWith('supabase/migrations/')) return '09-database-migrations';
  if (/\.(test|spec)\.[^.]+$/.test(p) || p.includes('/tests/')) return '10-tests';
  if (/\.(md|mdx|rst|txt)$/.test(p) || p.startsWith('docs/')) return '11-documentation';
  if (p.startsWith('content/adaptive/') || p.startsWith('public/learning/')) return '05-questions-and-content';
  if (p.startsWith('content/bncc/') || p.includes('/mapping') || p.includes('curriculum')) return '06-bncc-mappings';
  if (/tutor|adaptive|guided-learning/.test(p)) return '01-adaptive-tutor';
  if (p.startsWith('src/hooks/') || p.includes('/context')) return '04-hooks-and-contexts';
  if (p.startsWith('src/services/') || p.startsWith('supabase/functions/')) return '02-services-and-apis';
  if (p.startsWith('src/components/')) return '03-react-components';
  if (p.startsWith('src/pages/')) return '03-react-components';
  if (p.startsWith('tools/')) return '07-generation-and-validation-tools';
  if (p.startsWith('scripts/')) return '08-pedagogical-scripts';
  return '13-historical-or-other';
}

function classify(file, status, sourceBlob, mainBlob, recoveredPaths) {
  if (file === COLLISION) return {
    classification: 'G',
    rationale: 'Migration version collision: PR #360 SQL differs from the migration already occupying 20261015000100 on main.',
    action: 'Keep the main migration; never import this historical file under the same version. Reconcile its behavior only as a separately reviewed migration if still required.',
  };
  if (status.startsWith('D')) return {
    classification: 'B',
    rationale: 'The historical PR deletes this path; no deletion is carried into the current main by this inventory.',
    action: 'Retain current main state; review deletion intent only if a current caller or maintainer identifies a need.',
  };
  if (sourceBlob && mainBlob && sourceBlob === mainBlob) return {
    classification: 'A',
    rationale: 'The source and current main blobs are identical for this path.',
    action: 'No reintegration needed.',
  };
  if (file.startsWith('content/adaptive/tec-escola-core-v5/') || file.startsWith('public/learning/')) return {
    classification: 'F',
    rationale: 'Candidate V5 lesson/question/media content; package state is STAGING or review-pending, and answer fields exist in public Git source.',
    action: 'Keep isolated from runtime publication. Validate curriculum mappings and pedagogy per version; do not promote or copy in bulk.',
  };
  if (file.startsWith('supabase/migrations/')) {
    if (mainBlob) return {
      classification: 'G',
      rationale: 'Same-path migration differs from current main; historical SQL may conflict with later schema/security changes.',
      action: 'Preserve main; compare effects and production ledger in a separately authorized, read-only migration reconciliation.',
    };
    return {
      classification: 'D',
      rationale: 'Historical migration is absent from main; production application status was not verified in this campaign.',
      action: 'Do not copy or apply. Check current schema, ledger, ownership, RLS, and dependencies before designing any new migration.',
    };
  }
  if (recoveredPaths.has(file) && !mainBlob) return {
    classification: 'C',
    rationale: 'A corresponding currently missing renderer/service capability is implemented in successor PR #439.',
    action: 'Review and integrate through PR #439 after its current CI; this inventory does not merge PR #360.',
  };
  if (mainBlob) return {
    classification: 'B',
    rationale: 'The path exists on main with a different blob; filename overlap alone does not prove behavioral equivalence.',
    action: 'Preserve main and review only the behavior-level delta when a specific requirement is established.',
  };
  if (/\.(test|spec)\.[^.]+$/.test(file) || file.startsWith('docs/') || file.startsWith('tools/') || file.startsWith('scripts/')) return {
    classification: 'E',
    rationale: 'Historical authoring, validation, test, or documentation artifact; it is not by itself evidence of a runtime dependency.',
    action: 'Retain historical provenance; adopt selectively only when a current workflow needs it and the tool is validated against current contracts.',
  };
  return {
    classification: 'G',
    rationale: 'Source-only behavior or architecture candidate; compatibility/equivalence is not proven by this path-level comparison.',
    action: 'Keep out of main until a focused behavior review establishes a concrete missing capability and safe successor scope.',
  };
}

function walkQuestions(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  if (Array.isArray(value)) {
    for (const item of value) walkQuestions(item, result);
    return result;
  }
  if (Array.isArray(value.questions)) {
    for (const q of value.questions) {
      if (q && typeof q === 'object' && (q.id || q.statement || q.prompt)) result.push(q);
    }
  }
  for (const [key, child] of Object.entries(value)) if (key !== 'questions') walkQuestions(child, result);
  return result;
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

const sourceDiff = parseNulNameStatus(execFileSync('git', ['diff', '--name-status', '-z', '-M', SOURCE_BASE, SOURCE_HEAD]));
const recoveryPaths = new Set(git('diff', '--name-only', MAIN, RECOVERY_HEAD).split(/\r?\n/).filter(Boolean));
const sourceTree = treeMap(SOURCE_HEAD);
const mainTree = treeMap(MAIN);
const columns = ['diff_status', 'path', 'previous_path', 'category', 'source_blob_sha', 'main_blob_sha', 'content_state', 'classification', 'rationale', 'next_action'];
const rows = [];
const classCounts = Object.fromEntries('ABCDEFG'.split('').map((c) => [c, 0]));
const categoryCounts = new Map();
const migrationRows = [];
for (const entry of sourceDiff) {
  const sourcePath = entry.status.startsWith('D') ? entry.oldPath : entry.filePath;
  const sourceBlob = sourceTree.get(sourcePath) ?? '';
  const mainBlob = mainTree.get(entry.filePath) ?? '';
  const state = entry.status.startsWith('D') ? 'deleted-in-source' : !mainBlob ? 'absent-from-main' : sourceBlob === mainBlob ? 'identical-blob' : 'same-path-divergent-blob';
  const result = classify(entry.filePath, entry.status, sourceBlob, mainBlob, recoveryPaths);
  classCounts[result.classification] += 1;
  const group = category(entry.filePath);
  categoryCounts.set(group, (categoryCounts.get(group) ?? 0) + 1);
  if (group === '09-database-migrations') migrationRows.push(entry);
  rows.push([entry.status, entry.filePath, entry.oldPath, group, sourceBlob, mainBlob, state, result.classification, result.rationale, result.action]);
}

const packPaths = [...sourceTree.keys()].filter((p) => p.startsWith('content/adaptive/tec-escola-core-v5/') && p.endsWith('.json'));
const packs = [];
const allQuestions = [];
const statusCounts = new Map();
const mappingCounts = new Map();
const subjectCounts = new Map();
const difficultyCounts = new Map();
const gradeMetadataCount = { count: 0 };
const answerPackCount = { count: 0 };
const packBlobs = readBlobs(packPaths.map((p) => sourceTree.get(p)));
for (const packPath of packPaths) {
  const pack = JSON.parse(packBlobs.get(sourceTree.get(packPath)));
  packs.push({ path: packPath, pack });
  statusCounts.set(pack.publicationStatus ?? 'UNSPECIFIED', (statusCounts.get(pack.publicationStatus ?? 'UNSPECIFIED') ?? 0) + 1);
  mappingCounts.set(pack.officialMappingStatus ?? 'UNSPECIFIED', (mappingCounts.get(pack.officialMappingStatus ?? 'UNSPECIFIED') ?? 0) + 1);
  subjectCounts.set(pack.subject ?? 'UNSPECIFIED', (subjectCounts.get(pack.subject ?? 'UNSPECIFIED') ?? 0) + 1);
  if (pack.grade || pack.schoolYear || pack.gradeBand || pack.stage) gradeMetadataCount.count += 1;
  const qs = walkQuestions(pack);
  allQuestions.push(...qs.map((question) => ({ packPath, pack, question })));
  for (const question of qs) {
    const difficulty = question.difficulty ?? 'UNSPECIFIED';
    difficultyCounts.set(difficulty, (difficultyCounts.get(difficulty) ?? 0) + 1);
  }
  if (qs.some((q) => ['correctAnswer', 'answer_key', 'accepted_answers'].some((k) => Object.hasOwn(q, k)))) answerPackCount.count += 1;
}
const idMap = new Map();
const stemMap = new Map();
for (const item of allQuestions) {
  const id = String(item.question.id ?? '').trim();
  if (id) idMap.set(id, [...(idMap.get(id) ?? []), item]);
  const stem = normalizeText(item.question.statement ?? item.question.prompt);
  if (stem) stemMap.set(stem, [...(stemMap.get(stem) ?? []), item]);
}
const duplicateIdGroups = [...idMap.values()].filter((g) => g.length > 1);
const duplicateStemGroups = [...stemMap.values()].filter((g) => g.length > 1);
const answerConflicts = duplicateStemGroups.filter((g) => new Set(g.map((x) => normalizeText(x.question.correctAnswer ?? JSON.stringify(x.question.answer_key ?? x.question.accepted_answers ?? null)))).size > 1).length;
const duplicateIdContentConflictGroups = duplicateIdGroups.filter((g) => new Set(g.map((x) => normalizeText(x.question.statement ?? x.question.prompt))).size > 1).length;
const mainPackPaths = [...mainTree.keys()].filter((p) => p.startsWith('content/adaptive/') && p.endsWith('.json'));
const mainQuestionBlobs = readBlobs(mainPackPaths.map((p) => mainTree.get(p)));
const mainIds = new Set();
const mainStems = new Set();
for (const packPath of mainPackPaths) {
  try {
    const pack = JSON.parse(mainQuestionBlobs.get(mainTree.get(packPath)));
    for (const q of walkQuestions(pack)) {
      if (q.id) mainIds.add(String(q.id));
      const stem = normalizeText(q.statement ?? q.prompt);
      if (stem) mainStems.add(stem);
    }
  } catch { /* Some adaptive JSON files are registries, not question packs. */ }
}
const sourceIds = new Set([...idMap.keys()]);
const sourceStems = new Set([...stemMap.keys()]);
const exactIdOverlap = [...sourceIds].filter((id) => mainIds.has(id)).length;
const exactStemOverlap = [...sourceStems].filter((stem) => mainStems.has(stem)).length;
const visualRefs = new Set();
for (const { pack } of packs) {
  const text = JSON.stringify(pack);
  for (const match of text.matchAll(/(?:\/learning\/[^"\s]+\.(?:png|jpg|jpeg|webp|svg))/gi)) visualRefs.add(match[0]);
}
const sourceAssets = [...sourceTree.keys()].filter((p) => p.startsWith('public/learning/'));
const mainAssets = new Set([...mainTree.keys()].filter((p) => p.startsWith('public/learning/')));
const missingAssets = sourceAssets.filter((p) => !mainAssets.has(p));
const uniqueSkillCodes = new Set(packs.map(({ pack }) => pack.canonicalSkillCode).filter(Boolean));
const collisionFiles = sourceDiff.filter((entry) => entry.filePath.includes('/20261015000100')).length;
const sourceMigrationPaths = [...sourceTree.keys()].filter((p) => p.startsWith('supabase/migrations/') && p.endsWith('.sql'));
const mainMigrationPaths = [...mainTree.keys()].filter((p) => p.startsWith('supabase/migrations/') && p.endsWith('.sql'));
const migrationVersion = (p) => path.posix.basename(p).match(/^(\d{14})_/)?.[1] ?? null;
const sourceMigrationsByVersion = new Map(sourceMigrationPaths.map((p) => [migrationVersion(p), p]).filter(([v]) => v));
const mainMigrationsByVersion = new Map(mainMigrationPaths.map((p) => [migrationVersion(p), p]).filter(([v]) => v));
const sharedMigrationVersions = [...sourceMigrationsByVersion.keys()].filter((v) => mainMigrationsByVersion.has(v));
const migrationVersionCollisions = sharedMigrationVersions.filter((v) => {
  const sourcePath = sourceMigrationsByVersion.get(v);
  const mainPath = mainMigrationsByVersion.get(v);
  return sourcePath !== mainPath || sourceTree.get(sourcePath) !== mainTree.get(mainPath);
});
const testSupportPaths = sourceDiff.filter((e) => /(^|\/)(e2e|tests?)(\/|$)|\.(test|spec)\./i.test(e.filePath));
for (const group of [
  '01-adaptive-tutor', '02-services-and-apis', '03-react-components', '04-hooks-and-contexts',
  '05-questions-and-content', '06-bncc-mappings', '07-generation-and-validation-tools',
  '08-pedagogical-scripts', '09-database-migrations', '10-tests', '11-documentation',
  '12-inclusive-education', '13-historical-or-other',
]) if (!categoryCounts.has(group)) categoryCounts.set(group, 0);

if (sourceDiff.length !== 767 || packPaths.length !== 225 || allQuestions.length !== 11187) {
  throw new Error(`Pinned snapshot invariant failed: files=${sourceDiff.length}, packs=${packPaths.length}, questions=${allQuestions.length}`);
}
if (sourceMigrationPaths.length !== 334 || mainMigrationPaths.length !== 265 || migrationVersionCollisions.length !== 1) {
  throw new Error(`Migration inventory invariant failed: source=${sourceMigrationPaths.length}, main=${mainMigrationPaths.length}, collisions=${migrationVersionCollisions.length}`);
}

const csvText = `${columns.map(csv).join(',')}\n${rows.map((row) => row.map(csv).join(',')).join('\n')}\n`;
await mkdir(REPORT_DIR, { recursive: true });
await writeFile(CSV_PATH, csvText, 'utf8');

console.log(JSON.stringify({
  main: MAIN,
  sourceBase: SOURCE_BASE,
  sourceHead: SOURCE_HEAD,
  changedPaths: sourceDiff.length,
  classCounts,
  categoryCounts: Object.fromEntries([...categoryCounts.entries()].sort()),
  migrationDiffFiles: migrationRows.length,
  sqlMigrationFiles: migrationRows.filter((e) => e.filePath.endsWith('.sql')).length,
  collisionFiles,
  sourceSqlMigrations: sourceMigrationPaths.length,
  mainSqlMigrations: mainMigrationPaths.length,
  sharedMigrationVersions: sharedMigrationVersions.length,
  sourceOnlyMigrationVersions: [...sourceMigrationsByVersion.keys()].filter((v) => !mainMigrationsByVersion.has(v)).length,
  mainOnlyMigrationVersions: [...mainMigrationsByVersion.keys()].filter((v) => !sourceMigrationsByVersion.has(v)).length,
  migrationVersionCollisions: migrationVersionCollisions.map((v) => ({ version: v, source: sourceMigrationsByVersion.get(v), main: mainMigrationsByVersion.get(v) })),
  changedTestSupportPaths: testSupportPaths.length,
  packs: packPaths.length,
  packsWithSamePathOnMain: packPaths.filter((p) => mainTree.has(p)).length,
  packsWithIdenticalBlobOnMain: packPaths.filter((p) => mainTree.get(p) && mainTree.get(p) === sourceTree.get(p)).length,
  packsWithDifferentBlobAtSamePathOnMain: packPaths.filter((p) => mainTree.get(p) && mainTree.get(p) !== sourceTree.get(p)).length,
  packsAbsentFromMain: packPaths.filter((p) => !mainTree.has(p)).length,
  questions: allQuestions.length,
  uniqueQuestionIds: idMap.size,
  uniqueExactNormalizedStems: stemMap.size,
  questionIdsAlreadyInMain: exactIdOverlap,
  exactNormalizedStemsAlreadyInMain: exactStemOverlap,
  duplicateIdGroups: duplicateIdGroups.length,
  duplicateQuestionInstancesById: duplicateIdGroups.reduce((n, g) => n + g.length - 1, 0),
  duplicateExactNormalizedStemGroups: duplicateStemGroups.length,
  duplicateStemAnswerConflictGroups: answerConflicts,
  duplicateIdContentConflictGroups,
  subjects: Object.fromEntries([...subjectCounts.entries()].sort()),
  difficulty: Object.fromEntries([...difficultyCounts.entries()].sort()),
  packsWithExplicitGradeOrStageMetadata: gradeMetadataCount.count,
  publicationStatus: Object.fromEntries([...statusCounts.entries()].sort()),
  officialMappingStatus: Object.fromEntries([...mappingCounts.entries()].sort()),
  uniqueCanonicalSkillCodes: uniqueSkillCodes.size,
  packsWithPublicAnswerFields: answerPackCount.count,
  sourcePublicAssets: sourceAssets.length,
  sourcePublicAssetsMissingFromMain: missingAssets.length,
  publicAssetReferencesInPacks: visualRefs.size,
  csv: CSV_PATH,
}, null, 2));
