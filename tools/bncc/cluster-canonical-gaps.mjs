import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const COMPONENT_SUBJECTS = {
  AR: 'ARTE', CHS: 'CIENCIAS_HUMANAS', CI: 'CIENCIAS', CNT: 'CIENCIAS_NATUREZA', CO: 'COMPUTACAO',
  EF: 'EDUCACAO_FISICA', ER: 'ENSINO_RELIGIOSO', GE: 'GEOGRAFIA', HI: 'HISTORIA', LI: 'LINGUA_INGLESA',
  LGG: 'LINGUAGENS', LP: 'LINGUA_PORTUGUESA', MA: 'MATEMATICA', MAT: 'MATEMATICA',
};
const COGNITIVE_OPERATIONS = [
  'analisar', 'aplicar', 'avaliar', 'calcular', 'comparar', 'construir', 'compreender', 'distinguir',
  'elaborar', 'explicar', 'identificar', 'interpretar', 'justificar', 'localizar', 'planejar',
  'reconhecer', 'resolver', 'sintetizar', 'selecionar', 'relacionar', 'representar', 'rastrear',
  'descrever', 'discutir', 'inferir',
];

function stableJson(value) {
  return JSON.stringify(value, (_key, current) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
    return Object.keys(current).sort().reduce((result, key) => {
      result[key] = current[key];
      return result;
    }, {});
  });
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function cognitiveOperation(descriptor) {
  const normalized = normalize(descriptor);
  return COGNITIVE_OPERATIONS.find((operation) => new RegExp(`\\b${operation}\\b`).test(normalized)) ?? 'UNSPECIFIED';
}

function clusterId(key) {
  return `GAP_${key.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;
}

export function clusterCanonicalGaps(candidates, semanticCandidates) {
  const semanticByCode = new Map((semanticCandidates?.candidates ?? []).map((item) => [item.officialCode, item]));
  const groups = new Map();
  for (const candidate of (candidates?.candidates ?? []).filter((item) => item.mappingType === 'CANONICAL_GAP')) {
    const semantic = semanticByCode.get(candidate.officialCode);
    const operation = cognitiveOperation(semantic?.descriptor ?? '');
    const key = [candidate.stage, candidate.gradeOrRange ?? 'UNSPECIFIED', candidate.componentCode ?? 'UNSPECIFIED', operation].join('|');
    const group = groups.get(key) ?? {
      clusterKey: key,
      officialCodes: [],
      stage: candidate.stage,
      gradeRange: candidate.gradeOrRange ?? 'UNSPECIFIED',
      componentCode: candidate.componentCode ?? 'UNSPECIFIED',
      subject: COMPONENT_SUBJECTS[candidate.componentCode] ?? 'REVIEW_REQUIRED',
      cognitiveOperation: operation,
      semanticCandidateSkills: new Set(),
    };
    group.officialCodes.push(candidate.officialCode);
    for (const suggestion of semantic?.candidates ?? []) group.semanticCandidateSkills.add(suggestion.canonicalSkillCode);
    groups.set(key, group);
  }

  const clusters = [...groups.values()]
    .sort((left, right) => left.clusterKey.localeCompare(right.clusterKey))
    .map((group) => ({
      clusterId: clusterId(group.clusterKey),
      officialCodes: group.officialCodes.sort(),
      stage: group.stage,
      gradeRange: group.gradeRange,
      componentCode: group.componentCode,
      subject: group.subject,
      domain: null,
      cognitiveOperation: group.cognitiveOperation,
      suggestedSkill: null,
      objective: null,
      capability: null,
      semanticCandidateSkills: [...group.semanticCandidateSkills].sort(),
      rationale: 'Agrupamento estrutural para revisão pedagógica; não há evidência suficiente para criar ou promover uma habilidade canônica automaticamente.',
      confidence: 'LOW',
      reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      promotionStatus: 'NOT_PROMOTED',
    }));
  const output = {
    schemaVersion: 'tec-escola.bncc.canonical-gaps.v1',
    catalogVersion: candidates.catalogVersion,
    catalogHash: candidates.catalogHash,
    sourceOfTruth: 'mapping_candidates_plus_scoped_semantic_candidates',
    generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-04T00:00:00.000Z',
    statusContract: {
      gapStatus: 'CANONICAL_GAP_REVIEW_REQUIRED',
      reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      promotionRule: 'Clusters organizam a revisão, mas não criam skills nem promovem mapeamentos.',
    },
    summary: {
      officialGapCodes: clusters.reduce((total, cluster) => total + cluster.officialCodes.length, 0),
      gapClusters: clusters.length,
      clustersWithSemanticSignals: clusters.filter((cluster) => cluster.semanticCandidateSkills.length > 0).length,
      unresolvedDomainClusters: clusters.filter((cluster) => cluster.domain === null).length,
      promoted: 0,
    },
    clusters,
  };
  return { ...output, gapsHash: hash(stableJson({ ...output, generatedAt: undefined })) };
}

function run() {
  const candidatesPath = path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/candidates-2018.json');
  const semanticPath = path.resolve(root, process.argv[3] ?? 'content/bncc/mappings/semantic-candidates-2018.json');
  const outputPath = path.resolve(root, process.argv[4] ?? 'content/bncc/canonical/gaps-reviewed.json');
  const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
  const semanticCandidates = JSON.parse(fs.readFileSync(semanticPath, 'utf8'));
  const output = clusterCanonicalGaps(candidates, semanticCandidates);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_GAP_CLUSTERS_OUTPUT=${path.relative(root, outputPath)}`);
  console.log(`BNCC_GAP_CLUSTERS=${output.summary.gapClusters}`);
  console.log(`BNCC_GAP_CODES=${output.summary.officialGapCodes}`);
  console.log(`BNCC_GAP_HASH=${output.gapsHash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
