import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));

const OPERATION_PATTERNS = [
  ['IDENTIFY', /identificar|reconhecer|localizar|conhecer/gi],
  ['DESCRIBE', /descrever|caracterizar|registrar/gi],
  ['COMPARE', /comparar|diferenciar|relacionar/gi],
  ['ANALYZE', /analisar|interpretar|examinar|investigar/gi],
  ['EXPLAIN', /explicar|discutir|compreender/gi],
  ['CREATE', /criar|produzir|elaborar|propor/gi],
  ['PLAN', /planejar|executar|avaliar|argumentar/gi],
];
const EVIDENCE_PATTERNS = [
  ['SOURCE', /fonte|registro|documento|texto/gi],
  ['DATA', /dados|tabela|gráfico|quantidade|proporção/gi],
  ['OBSERVATION', /observar|observação|fenômeno|evidência/gi],
  ['CONTEXT', /sociedade|cultura|ambiente|território|paisagem/gi],
  ['ARGUMENT', /argument|hipótese|justificar|conclusão/gi],
];
const PREREQUISITE_PATTERNS = /processo|sistema|modelo|transforma|relação|condição|continuidade|ruptura|proporção|perspectiva/gi;

const countMatches = (text, pattern) => [...text.matchAll(pattern)].length;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const roundToFive = (value) => Math.ceil(value / 5) * 5;

export function scoreNode(node) {
  if (node.kind === 'LEARNING_DEVELOPMENT_OBJECTIVE') {
    return {
      complexityTier: 'EXPERIENTIAL',
      technicalMinimumQuestions: 0,
      pedagogicalMinimumQuestions: 0,
      recommendedLibraryQuestions: 0,
      extensiveLibraryQuestions: 0,
      observationalExperiences: 2,
      observationCriteria: 5,
      operations: [],
      evidenceModes: ['OBSERVATION', 'CONTEXT'],
      rationale: 'Objetivo de desenvolvimento: evidência mediada e observacional, não questionário infantil automático.',
    };
  }

  const text = `${node.officialTextExcerpt ?? ''}`;
  const operations = OPERATION_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const evidenceModes = EVIDENCE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const grade = Number.parseInt(node.gradeOrRange, 10);
  const agePressure = Number.isFinite(grade) ? (grade <= 2 ? 1 : grade <= 5 ? 2 : grade <= 9 ? 3 : 4) : 3;
  const operationPressure = clamp(Math.max(1, operations.length), 1, 5);
  const evidencePressure = clamp(evidenceModes.length, 0, 4);
  const prerequisitePressure = clamp(countMatches(text, PREREQUISITE_PATTERNS), 0, 5);
  const complexityScore = operationPressure * 2 + evidencePressure + prerequisitePressure + agePressure;
  const complexityTier = complexityScore >= 18 ? 'HIGH' : complexityScore >= 13 ? 'MEDIUM_HIGH' : complexityScore >= 9 ? 'MEDIUM' : 'FOUNDATIONAL';
  const pedagogicalMinimumQuestions = roundToFive(40 + Math.max(0, complexityScore - 8) * 5);
  const recommendedLibraryQuestions = roundToFive(pedagogicalMinimumQuestions * (complexityTier === 'HIGH' ? 1.5 : 1.35));
  const extensiveLibraryQuestions = roundToFive(recommendedLibraryQuestions * (complexityTier === 'FOUNDATIONAL' ? 1.4 : 1.6));

  return {
    complexityTier,
    complexityScore,
    technicalMinimumQuestions: 40,
    pedagogicalMinimumQuestions,
    recommendedLibraryQuestions,
    extensiveLibraryQuestions,
    observationalExperiences: 0,
    observationCriteria: 0,
    operations,
    evidenceModes,
    pressure: { age: agePressure, operations: operationPressure, evidence: evidencePressure, prerequisites: prerequisitePressure },
    rationale: 'Estimativa técnica: operações explícitas, modos de evidência, pressão de pré-requisitos e faixa etária; não é aprovação pedagógica nem garantia de aprendizagem.',
  };
}

function addAggregate(target, node, score) {
  target.officialNodes += 1;
  if (node.kind === 'LEARNING_DEVELOPMENT_OBJECTIVE') target.developmentObjectives += 1;
  else target.skills += 1;
  for (const key of ['technicalMinimumQuestions', 'pedagogicalMinimumQuestions', 'recommendedLibraryQuestions', 'extensiveLibraryQuestions', 'observationalExperiences', 'observationCriteria']) {
    target[key] += score[key] ?? 0;
  }
}

export function buildCoverageSizingReportV3() {
  const catalog = readJson('content/bncc/official/catalog-2018.json');
  const coverage = readJson('content/bncc/mappings/coverage-2018.json');
  const inventory = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');
  const sourceVerification = readJson('content/bncc/authoring/source-verification-v2.json');
  const coverageByCode = new Map(coverage.mappings.map((mapping) => [mapping.officialCode, mapping]));
  const verificationByCode = new Map(sourceVerification.records.map((record) => [record.officialCode, record]));
  const byStage = new Map();
  const byMappingStatus = new Map();
  const nodeSizing = [];
  const totals = { officialNodes: 0, skills: 0, developmentObjectives: 0, technicalMinimumQuestions: 0, pedagogicalMinimumQuestions: 0, recommendedLibraryQuestions: 0, extensiveLibraryQuestions: 0, observationalExperiences: 0, observationCriteria: 0 };

  for (const node of catalog.nodes ?? []) {
    const score = scoreNode(node);
    const mappingStatus = coverageByCode.get(node.code)?.status ?? 'UNACCOUNTED';
    const stage = byStage.get(node.stage) ?? { officialNodes: 0, skills: 0, developmentObjectives: 0, technicalMinimumQuestions: 0, pedagogicalMinimumQuestions: 0, recommendedLibraryQuestions: 0, extensiveLibraryQuestions: 0, observationalExperiences: 0, observationCriteria: 0 };
    const statusAggregate = byMappingStatus.get(mappingStatus) ?? { mappingStatus, officialNodes: 0, skills: 0, developmentObjectives: 0, technicalMinimumQuestions: 0, pedagogicalMinimumQuestions: 0, recommendedLibraryQuestions: 0, extensiveLibraryQuestions: 0, observationalExperiences: 0, observationCriteria: 0 };
    addAggregate(stage, node, score);
    addAggregate(statusAggregate, node, score);
    addAggregate(totals, node, score);
    byStage.set(node.stage, stage);
    byMappingStatus.set(mappingStatus, statusAggregate);
    nodeSizing.push({ officialCode: node.code, stage: node.stage, componentCode: node.componentCode, kind: node.kind, mappingStatus, exactSourceVerified: verificationByCode.has(node.code), ...score });
  }

  return {
    schemaVersion: 'tec-escola.bncc.coverage-sizing.v3',
    campaignId: 'TECESCOLA_BNCC_5000_AND_REAL_COVERAGE_V3',
    generatedAt: '2026-10-16',
    sourceBasis: {
      officialCatalog: 'content/bncc/official/catalog-2018.json',
      mappingCoverage: 'content/bncc/mappings/coverage-2018.json',
      technicalInventory: 'content/bncc/authoring/knowledge-factory-inventory-v4.json',
      sourceVerification: 'content/bncc/authoring/source-verification-v2.json',
    },
    auditedFacts: {
      ...totals,
      mappingStatuses: Object.fromEntries([...byMappingStatus.entries()].sort().map(([key, value]) => [key, value.officialNodes])),
      technicalDeepReadySequences: inventory.existingContent?.technicalDeepReady ?? 0,
      v5QuestionTotal: inventory.existingContent?.v5QuestionTotal ?? 0,
      consolidatedQuestionTotal: inventory.existingContent?.consolidatedQuestionTotal ?? 0,
      exactSourceVerificationCodes: sourceVerification.records.map((record) => record.officialCode),
    },
    sizingMethodology: {
      technicalMinimum: '40 questions for a skill journey when the V4 purpose gate applies; 0 child questions for Early Childhood development objectives.',
      pedagogicalMinimum: 'Technical minimum adjusted by the observed number of operations, evidence modes, prerequisite pressure and grade-band abstraction in the official descriptor.',
      recommendedLibrary: 'Pedagogical minimum multiplied by a complexity-sensitive context factor and rounded upward to five.',
      extensiveLibrary: 'Recommended library multiplied by a complexity-sensitive review and transfer factor and rounded upward to five.',
      dimensions: ['operations', 'evidenceModes', 'prerequisitePressure', 'agePressure'],
      limitation: 'All values are authoring estimates. They do not certify official mapping, human review, student readiness or learning outcomes.',
    },
    byStage: Object.fromEntries([...byStage.entries()].sort()),
    byMappingStatus: [...byMappingStatus.values()].sort((a, b) => a.mappingStatus.localeCompare(b.mappingStatus)),
    nodeSizing,
    gates: { publicationStatus: 'STAGING_INACTIVE', pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED' },
  };
}

function main() {
  const report = buildCoverageSizingReportV3();
  fs.writeFileSync(path.join(ROOT, 'content/bncc/authoring/coverage-sizing-v3.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ valid: true, officialNodes: report.auditedFacts.officialNodes, pedagogicalMinimumQuestions: report.auditedFacts.pedagogicalMinimumQuestions, recommendedLibraryQuestions: report.auditedFacts.recommendedLibraryQuestions, extensiveLibraryQuestions: report.auditedFacts.extensiveLibraryQuestions }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
