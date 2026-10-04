import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();

const COMPONENT_SUBJECTS = {
  AR: ['ARTE'],
  CHS: ['CIENCIAS_HUMANAS'],
  CI: ['CIENCIAS'],
  CNT: ['CIENCIAS_NATUREZA'],
  CO: ['COMPUTACAO'],
  EF: ['EDUCACAO_FISICA'],
  ER: ['ENSINO_RELIGIOSO'],
  GE: ['GEOGRAFIA'],
  HI: ['HISTORIA'],
  LI: ['LINGUA_INGLESA'],
  LGG: ['LINGUAGENS'],
  LP: ['LINGUA_PORTUGUESA'],
  MA: ['MATEMATICA'],
  MAT: ['MATEMATICA'],
};

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em',
  'entre', 'esse', 'esta', 'este', 'mais', 'na', 'nas', 'no', 'nos', 'o', 'os', 'ou',
  'para', 'pela', 'pelas', 'pelo', 'pelos', 'que', 'se', 'sem', 'sua', 'suas', 'um',
  'uma', 'umas', 'uns', 'por', 'sobre',
]);

const COGNITIVE_OPERATIONS = new Set([
  'analisar', 'aplicar', 'avaliar', 'calcular', 'comparar', 'construir', 'compreender',
  'distinguir', 'elaborar', 'explicar', 'identificar', 'interpretar', 'justificar',
  'localizar', 'planejar', 'reconhecer', 'resolver', 'sintetizar', 'selecionar',
  'relacionar', 'representar', 'rastrear', 'descrever', 'discutir', 'inferir',
]);

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
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value) {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
}

function gradeNumber(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function subjectAreasForNode(node) {
  return COMPONENT_SUBJECTS[node.componentCode] ?? [];
}

function isCompatible(skill, node) {
  const grade = gradeNumber(node.gradeOrRange);
  const subjects = subjectAreasForNode(node);
  return node.kind === 'SKILL'
    && skill.stage === node.stage
    && (grade === null || skill.gradeLevels?.includes(grade))
    && subjects.some((subject) => skill.subjectAreas?.includes(subject));
}

function descriptorForNode(node) {
  const excerpt = String(node.officialTextExcerpt ?? '').replace(/\s+/g, ' ').trim();
  const withoutLeadingMarker = excerpt.replace(/^\)\s*/, '');
  const nextCode = withoutLeadingMarker.search(/\s+\((?:EI\d{2}[A-Z]{2}\d{2}|EF(?:\d{2}|67)[A-Z]{2}\d{2}|EM13(?:LGG|CNT|CHS|MAT)\d{3}|EM13(?:LP|CO)\d{2})\)/);
  return (nextCode >= 0 ? withoutLeadingMarker.slice(0, nextCode) : withoutLeadingMarker).trim();
}

function operationTokens(value) {
  return [...tokens(value)].filter((token) => COGNITIVE_OPERATIONS.has(token));
}

function overlap(left, right) {
  return [...left].filter((token) => right.has(token));
}

function scoreCandidate(skill, node) {
  const descriptor = descriptorForNode(node);
  const descriptorTokens = tokens(descriptor);
  const skillTokens = tokens([
    skill.title,
    ...(skill.aliases ?? []),
    skill.objective,
    skill.description,
    skill.masteryCapability,
    skill.domain,
  ].join(' '));
  const titleTokens = tokens([skill.title, ...(skill.aliases ?? [])].join(' '));
  const descriptorOperations = new Set(operationTokens(descriptor));
  const skillOperations = new Set(operationTokens([skill.title, skill.objective, skill.masteryCapability].join(' ')));
  const lexical = titleTokens.size ? overlap(titleTokens, descriptorTokens).length / titleTokens.size : 0;
  const objective = skillTokens.size ? overlap(skillTokens, descriptorTokens).length / skillTokens.size : 0;
  const operation = descriptorOperations.size && skillOperations.size
    ? overlap(descriptorOperations, skillOperations).length / Math.max(descriptorOperations.size, skillOperations.size)
    : 0;
  const score = Math.min(1, lexical * 0.55 + objective * 0.25 + operation * 0.2);
  const differences = [];
  if (!operation) differences.push('demanda cognitiva precisa de comparação pedagógica');
  if (!lexical) differences.push('vocabulário do descritor não coincide diretamente com o título canônico');
  if (score < 0.45) differences.push('evidência semântica insuficiente para qualquer promoção');
  return {
    canonicalSkillCode: skill.code,
    score: Number(score.toFixed(4)),
    confidence: score >= 0.75 ? 'HIGH' : score >= 0.45 ? 'MEDIUM' : 'LOW',
    rationale: `Candidato semântico compatível por etapa, série, componente e comparação estruturada de descritor com objetivo canônico (${skill.code}).`,
    differences,
  };
}

export function expandSemanticCandidates(catalog, registry) {
  const skills = [...(registry?.skills ?? [])].sort((left, right) => left.code.localeCompare(right.code));
  const candidates = [...(catalog.nodes ?? [])]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((node) => {
      if (node.kind !== 'SKILL') {
        return {
          officialCode: node.code,
          stage: node.stage,
          kind: node.kind,
          gradeOrRange: node.gradeOrRange,
          componentCode: node.componentCode,
          descriptor: descriptorForNode(node),
          candidates: [],
          reviewStatus: 'NOT_APPLICABLE',
          promotionStatus: 'NOT_PROMOTED',
        };
      }
      const ranked = skills
        .filter((skill) => isCompatible(skill, node))
        .map((skill) => scoreCandidate(skill, node))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score || left.canonicalSkillCode.localeCompare(right.canonicalSkillCode));
      return {
        officialCode: node.code,
        stage: node.stage,
        kind: node.kind,
        gradeOrRange: node.gradeOrRange,
        componentCode: node.componentCode,
        descriptor: descriptorForNode(node),
        candidates: ranked.slice(0, 3),
        reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
        promotionStatus: 'NOT_PROMOTED',
      };
    });
  const skillNodes = candidates.filter((item) => item.kind === 'SKILL');
  const output = {
    schemaVersion: 'tec-escola.bncc.semantic-candidates.v1',
    catalogVersion: catalog.catalogVersion,
    catalogHash: catalog.catalogHash,
    sourceOfTruth: 'official_catalog_plus_versioned_canonical_registry',
    generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-04T00:00:00.000Z',
    statusContract: {
      candidateStatus: 'SEMANTIC_CANDIDATE',
      reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      promotionRule: 'Nenhuma sugestão semântica pode promover mapeamento sem revisão independente e decisão pedagógica explícita.',
    },
    summary: {
      totalOfficialNodes: candidates.length,
      eligibleSkillNodes: skillNodes.length,
      candidatesWithSuggestions: skillNodes.filter((item) => item.candidates.length > 0).length,
      semanticSuggestions: skillNodes.reduce((total, item) => total + item.candidates.length, 0),
      hierarchyOnly: candidates.length - skillNodes.length,
      promoted: 0,
      maxCandidatesPerNode: 3,
    },
    candidates,
  };
  return { ...output, candidatesHash: hash(stableJson({ ...output, generatedAt: undefined })) };
}

function run() {
  const catalogPath = path.resolve(root, process.argv[2] ?? 'content/bncc/official/catalog-2018.json');
  const registryPath = path.resolve(root, process.argv[3] ?? 'content/bncc/canonical/registry.json');
  const outputPath = path.resolve(root, process.argv[4] ?? 'content/bncc/mappings/semantic-candidates-2018.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const output = expandSemanticCandidates(catalog, registry);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_SEMANTIC_CANDIDATES_OUTPUT=${path.relative(root, outputPath)}`);
  console.log(`BNCC_SEMANTIC_SUGGESTIONS=${output.summary.semanticSuggestions}`);
  console.log(`BNCC_SEMANTIC_CANDIDATES_HASH=${output.candidatesHash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
