import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
const increment = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

const catalog = readJson('content/bncc/official/catalog-2018.json');
const coverage = readJson('content/bncc/mappings/coverage-2018.json');
const inventory = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');
const sourceVerification = readJson('content/bncc/authoring/source-verification-v2.json');
const verificationByCode = new Map(sourceVerification.records.map((record) => [record.officialCode, record]));
const coverageByCode = new Map(coverage.mappings.map((mapping) => [mapping.officialCode, mapping]));
const nodes = catalog.nodes ?? [];

const scenarioRubric = {
  skill: {
    basis: 'The V4 depth gate requires 4 PROBE, 12 PRACTICE, 8 TRANSFER, 6 LOCK_IN and 10 REVIEW items: 40 questions as the minimum technical journey.',
    minimum: { lessons: 1, workedExamples: 1, activities: 1, diagnosticAssessments: 1, masteryAssessments: 1, reviewQuestions: 10, questions: 40 },
    recommended: { lessons: 2, workedExamples: 3, activities: 2, diagnosticAssessments: 2, masteryAssessments: 2, reviewQuestions: 20, questions: 80 },
    extensive: { lessons: 3, workedExamples: 5, activities: 3, diagnosticAssessments: 3, masteryAssessments: 3, reviewQuestions: 30, questions: 120 },
  },
  developmentObjective: {
    basis: 'Development objectives in Early Childhood require observable, mediated experiences. They are not converted into a child quiz; counts refer to experiences and educator records.',
    minimum: { lessons: 1, workedExamples: 0, activities: 1, diagnosticAssessments: 0, masteryAssessments: 1, reviewQuestions: 0, questions: 0, observationalExperiences: 1, observationCriteria: 3 },
    recommended: { lessons: 2, workedExamples: 0, activities: 2, diagnosticAssessments: 0, masteryAssessments: 2, reviewQuestions: 0, questions: 0, observationalExperiences: 2, observationCriteria: 5 },
    extensive: { lessons: 3, workedExamples: 0, activities: 3, diagnosticAssessments: 0, masteryAssessments: 3, reviewQuestions: 0, questions: 0, observationalExperiences: 3, observationCriteria: 7 },
  },
};

function addScenarioTotals(target, scenario, definition) {
  for (const key of Object.keys(definition)) target[key] = (target[key] ?? 0) + (definition[key] ?? 0) * scenario;
}

function build() {
  const byStage = new Map();
  const byStageComponent = new Map();
  const mappingStatuses = new Map();
  const totals = { officialNodes: nodes.length, skills: 0, developmentObjectives: 0 };
  const estimates = { minimum: {}, recommended: {}, extensive: {} };
  for (const node of nodes) {
    const kind = node.kind === 'LEARNING_DEVELOPMENT_OBJECTIVE' ? 'developmentObjective' : 'skill';
    totals[kind === 'skill' ? 'skills' : 'developmentObjectives'] += 1;
    const mapping = coverageByCode.get(node.code);
    increment(mappingStatuses, mapping?.status ?? 'UNACCOUNTED');
    const stage = byStage.get(node.stage) ?? { officialNodes: 0, skills: 0, developmentObjectives: 0, minimum: {}, recommended: {}, extensive: {} };
    stage.officialNodes += 1;
    stage[kind === 'skill' ? 'skills' : 'developmentObjectives'] += 1;
    addScenarioTotals(stage.minimum, 1, scenarioRubric[kind].minimum);
    addScenarioTotals(stage.recommended, 1, scenarioRubric[kind].recommended);
    addScenarioTotals(stage.extensive, 1, scenarioRubric[kind].extensive);
    byStage.set(node.stage, stage);
    const key = `${node.stage}/${node.componentCode}`;
    const component = byStageComponent.get(key) ?? { stage: node.stage, componentCode: node.componentCode, officialNodes: 0, skills: 0, developmentObjectives: 0, minimum: {}, recommended: {}, extensive: {} };
    component.officialNodes += 1;
    component[kind === 'skill' ? 'skills' : 'developmentObjectives'] += 1;
    addScenarioTotals(component.minimum, 1, scenarioRubric[kind].minimum);
    addScenarioTotals(component.recommended, 1, scenarioRubric[kind].recommended);
    addScenarioTotals(component.extensive, 1, scenarioRubric[kind].extensive);
    byStageComponent.set(key, component);
    addScenarioTotals(estimates.minimum, 1, scenarioRubric[kind].minimum);
    addScenarioTotals(estimates.recommended, 1, scenarioRubric[kind].recommended);
    addScenarioTotals(estimates.extensive, 1, scenarioRubric[kind].extensive);
  }

  const verifiedSourceCodes = nodes.filter((node) => verificationByCode.has(node.code)).map((node) => node.code);
  const report = {
    schemaVersion: 'tec-escola.bncc.coverage-sizing.v2',
    campaignId: 'TECESCOLA_BNCC_FULL_COVERAGE',
    generatedAt: '2026-10-16',
    sourceBasis: {
      officialCatalog: 'content/bncc/official/catalog-2018.json',
      mappingCoverage: 'content/bncc/mappings/coverage-2018.json',
      technicalInventory: 'content/bncc/authoring/knowledge-factory-inventory-v4.json',
      sourceVerification: 'content/bncc/authoring/source-verification-v2.json',
      officialPortal: 'https://downloadbncc.mec.gov.br/',
      officialDocument: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
    },
    auditedFacts: {
      ...totals,
      mappingStatuses: Object.fromEntries([...mappingStatuses.entries()].sort()),
      sourceTextHumanVerifiedByFactory: inventory.officialCoverage?.sourceTextHumanVerified ?? 0,
      sourceTextRequiresReviewByFactory: inventory.officialCoverage?.sourceTextRequiresReview ?? nodes.length,
      exactSourceVerificationsThisIncrement: verifiedSourceCodes.length,
      exactSourceVerificationCodes: verifiedSourceCodes,
      technicalDeepReadySequences: inventory.existingContent?.technicalDeepReady ?? 0,
      v5QuestionTotal: inventory.existingContent?.v5QuestionTotal ?? 0,
      consolidatedQuestionTotal: inventory.existingContent?.consolidatedQuestionTotal ?? 0,
      humanReviewedContent: 0,
      studentAvailableNewContent: 0,
    },
    scenarioRubric,
    estimates,
    byStage: Object.fromEntries([...byStage.entries()].sort(([a], [b]) => a.localeCompare(b))),
    byStageAndComponent: [...byStageComponent.values()].sort((a, b) => `${a.stage}/${a.componentCode}`.localeCompare(`${b.stage}/${b.componentCode}`)),
    interpretation: {
      minimum: 'One complete technical journey per skill; development objectives use mediated observation instead of child quizzes.',
      recommended: 'Two distinct lessons and twice the minimum question/experience evidence to support alternate contexts, review and remediation.',
      extensive: 'Three lessons and three times the minimum evidence, with additional examples, contexts and recovery opportunities.',
      limitation: 'These are library-size estimates. They do not prove individual learning, curriculum implementation or human pedagogical approval.',
    },
    pending: [
      'Official source text and canonical mapping review remains open for the 1,723-node matrix except for the one exact technical verification recorded in this increment.',
      'Pedagogical human review remains pending for all generated content.',
      'Early Childhood objectives require experiential product wiring and educator observation records before publication.',
    ],
  };
  return report;
}

export function buildCoverageSizingReport() {
  return build();
}

function main() {
  const report = build();
  fs.writeFileSync(path.join(ROOT, 'content/bncc/authoring/coverage-sizing-v2.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ valid: true, officialNodes: report.auditedFacts.officialNodes, minimumQuestions: report.estimates.minimum.questions, recommendedQuestions: report.estimates.recommended.questions, extensiveQuestions: report.estimates.extensive.questions, exactSourceVerifications: report.auditedFacts.exactSourceVerificationsThisIncrement }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
