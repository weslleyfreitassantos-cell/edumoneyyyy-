import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PATHS = {
  catalog: 'content/bncc/official/catalog-2018.json',
  mappings: 'content/bncc/mappings/coverage-2018.json',
  pending: 'content/bncc/authoring/pending-coverage-audit-v3.json',
  sourceVerification: 'content/bncc/authoring/source-verification-v2.json',
  packages: 'content/adaptive/tec-escola-core-v5',
  output: 'content/bncc/authoring/coverage-matrix-v8.json',
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function buildContentEvidence() {
  const byOfficialCode = new Map();
  for (const file of fs.readdirSync(path.join(ROOT, PATHS.packages)).filter((name) => name.endsWith('.json') && name !== 'checkpoint.json').sort()) {
    const pack = readJson(path.join(PATHS.packages, file));
    const officialCode = pack.sourceContext?.officialCode;
    if (!officialCode) continue;
    const current = byOfficialCode.get(officialCode) ?? [];
    current.push({
      file,
      contentId: pack.contentId ?? null,
      canonicalSkillCode: pack.canonicalSkillCode ?? null,
      lesson: Boolean(pack.lesson),
      questionCount: Array.isArray(pack.questions) ? pack.questions.length : 0,
      officialMappingStatus: pack.officialMappingStatus ?? 'NOT_CLAIMED',
      pedagogicalReviewStatus: pack.pedagogicalReviewStatus ?? 'PEDAGOGICAL_REVIEW_PENDING',
      publicationStatus: pack.publicationStatus ?? 'STAGING_INACTIVE',
      relation: pack.sourceContext.relation ?? 'AUTHORING_CONTEXT_ONLY',
    });
    byOfficialCode.set(officialCode, current);
  }
  return byOfficialCode;
}

export function buildCoverageMatrix(root = ROOT) {
  const catalog = readJson(PATHS.catalog);
  const mappings = readJson(PATHS.mappings);
  const pending = readJson(PATHS.pending);
  const sourceVerification = readJson(PATHS.sourceVerification);
  const mappingByCode = new Map(mappings.mappings.map((item) => [item.officialCode, item]));
  const pendingByCode = new Map(pending.records.map((item) => [item.officialCode, item]));
  const sourceByCode = new Map(sourceVerification.records.map((item) => [item.officialCode, item]));
  const contentByCode = buildContentEvidence();
  const rows = catalog.nodes.map((node) => {
    const mapping = mappingByCode.get(node.code);
    const queue = pendingByCode.get(node.code) ?? (mapping.status === 'MAPPED'
      ? {
        queueStatus: 'MAPPED_REVIEW_PENDING',
        nextAction: 'REVIEW_SOURCE_AND_CONTENT_DEPTH',
        studentPublicationStatus: 'STAGING_INACTIVE',
        pedagogicalReviewStatus: mapping.pedagogicalReviewStatus ?? 'PEDAGOGICAL_REVIEW_PENDING',
      }
      : null);
    const source = sourceByCode.get(node.code);
    const packages = contentByCode.get(node.code) ?? [];
    if (!mapping || !queue) throw new Error(`MISSING_AUDIT_RECORD:${node.code}`);
    return {
      officialCode: node.code,
      stage: node.stage,
      gradeOrRange: node.gradeOrRange,
      componentCode: node.componentCode,
      kind: node.kind,
      officialSource: node.officialSource,
      evidence: {
        exactSourceVerified: Boolean(source),
        exactSourceVerificationRecord: source ? source.verificationId ?? null : null,
        mappingStatus: mapping.status,
        mappingSource: mapping.mappingSource,
        queueStatus: queue.queueStatus,
        nextAction: queue.nextAction,
        packages,
        contentStatus: packages.length ? 'AUTHORING_CONTEXT_PRESENT_REVIEW_REQUIRED' : 'NO_EXPLICIT_AUTHORING_PACKAGE',
        missingWork: packages.length
          ? ['CANONICAL_MAPPING_REVIEW', 'PEDAGOGICAL_REVIEW', 'PUBLICATION_GATE']
          : ['SOURCE_TEXT_REVIEW_OR_MAPPING_REVIEW', 'AUTHORING_PACKAGE', 'PEDAGOGICAL_REVIEW', 'PUBLICATION_GATE'],
      },
      governance: {
        studentPublicationStatus: queue.studentPublicationStatus,
        pedagogicalReviewStatus: queue.pedagogicalReviewStatus,
        officialMappingStatus: packages.every((item) => item.officialMappingStatus === 'NOT_CLAIMED') ? 'NOT_CLAIMED' : 'REVIEW_REQUIRED',
      },
    };
  }).sort((a, b) => a.officialCode.localeCompare(b.officialCode));
  const body = {
    schemaVersion: 'tec-escola.bncc.coverage-matrix.v8',
    campaignId: 'TECESCOLA_BNCC_DEEP_COVERAGE_AUTONOMOUS_V8',
    generatedFrom: PATHS.catalog,
    sourceInputs: PATHS,
    status: 'AUDITABLE_STAGING_MATRIX',
    policy: {
      officialSourceVerificationIsNotCanonicalMapping: true,
      authoringContextIsNotOfficialApproval: true,
      noStudentPublication: true,
      noProductionWrites: true,
      exactSourceVerificationCount: rows.filter((row) => row.evidence.exactSourceVerified).length,
      canonicalMappingCount: rows.filter((row) => row.evidence.mappingStatus === 'MAPPED').length,
      authoringContextCount: rows.filter((row) => row.evidence.packages.length > 0).length,
    },
    summary: {
      totalOfficialNodes: rows.length,
      byStage: Object.fromEntries([...new Set(rows.map((row) => row.stage))].sort().map((stage) => [stage, rows.filter((row) => row.stage === stage).length])),
      byMappingStatus: Object.fromEntries([...new Set(rows.map((row) => row.evidence.mappingStatus))].sort().map((status) => [status, rows.filter((row) => row.evidence.mappingStatus === status).length])),
      rowsWithAuthoringContext: rows.filter((row) => row.evidence.packages.length > 0).length,
      rowsWithExactSourceVerification: rows.filter((row) => row.evidence.exactSourceVerified).length,
    },
    rows,
  };
  return { ...body, matrixHash: hash(stableJson(body)) };
}

export function compileCoverageMatrixV8(root = ROOT, check = false) {
  const result = buildCoverageMatrix(root);
  const outputPath = path.join(root, PATHS.output);
  const expected = `${JSON.stringify(result, null, 2)}\n`;
  if (check) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n') !== expected.replace(/\r\n/g, '\n')) throw new Error('COVERAGE_MATRIX_V8_OUTPUT_STALE');
    return result;
  }
  fs.writeFileSync(outputPath, expected);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = compileCoverageMatrixV8(ROOT, process.argv.includes('--check'));
  console.log(JSON.stringify({ totalOfficialNodes: result.summary.totalOfficialNodes, authoringContextCount: result.summary.rowsWithAuthoringContext, exactSourceVerificationCount: result.summary.rowsWithExactSourceVerification, canonicalMappingCount: result.policy.canonicalMappingCount }, null, 2));
}
