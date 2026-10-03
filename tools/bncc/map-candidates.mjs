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

export function stableJson(value) {
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
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value) {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2));
}

function gradeNumber(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function subjectAreasForNode(node) {
  return COMPONENT_SUBJECTS[node.componentCode] ?? [];
}

function compatible(skill, node) {
  const grade = gradeNumber(node.gradeOrRange);
  const subjects = subjectAreasForNode(node);
  return skill.stage === node.stage
    && (grade === null || skill.gradeLevels?.includes(grade))
    && subjects.some((subject) => skill.subjectAreas?.includes(subject));
}

function score(skill, node) {
  const descriptorTokens = tokens(`${node.officialTextExcerpt} ${node.componentCode}`);
  const skillTokens = tokens(`${skill.title} ${(skill.aliases ?? []).join(' ')}`);
  const overlap = [...skillTokens].filter((token) => descriptorTokens.has(token));
  return skillTokens.size ? overlap.length / skillTokens.size : 0;
}

function confidenceFor(value) {
  if (value >= 0.75) return 'HIGH';
  if (value >= 0.45) return 'MEDIUM';
  return 'LOW';
}

export function generateMappingCandidates(catalog, registry) {
  const skills = [...(registry?.skills ?? [])].sort((left, right) => left.code.localeCompare(right.code));
  const registryCodes = skills.map((skill) => skill.code);
  const candidates = [...(catalog.nodes ?? [])]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((node) => {
      const eligible = skills
        .filter((skill) => compatible(skill, node))
        .map((skill) => ({ skill, score: score(skill, node) }))
        .sort((left, right) => right.score - left.score || left.skill.code.localeCompare(right.skill.code));
      const best = eligible[0];
      const second = eligible[1];
      const margin = best && second ? best.score - second.score : best?.score ?? 0;
      const confidence = best ? confidenceFor(best.score) : 'LOW';
      const canPropose = Boolean(best && best.score >= 0.45 && margin >= 0.15);
      const mappingType = node.kind === 'SKILL'
        ? canPropose ? 'ONE_TO_ONE_CANDIDATE' : 'CANONICAL_GAP'
        : 'HIERARCHY_ONLY';

      return {
        officialCode: node.code,
        stage: node.stage,
        kind: node.kind,
        gradeOrRange: node.gradeOrRange,
        componentCode: node.componentCode,
        officialSource: node.officialSource,
        status: 'CANDIDATE',
        mappingType,
        confidence,
        confidenceScore: Number((best?.score ?? 0).toFixed(4)),
        candidateCanonicalSkillCodes: canPropose ? [best.skill.code] : [],
        reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
        mappingSource: 'TECESCOLA_DERIVED_AUTOMATED',
        rationale: canPropose
          ? `Candidato compatível por etapa, ano, componente e sobreposição lexical (${best.skill.code}); requer revisão pedagógica antes da promoção.`
          : node.kind === 'SKILL'
            ? 'Nenhuma habilidade canônica compatível foi encontrada com confiança suficiente; registrar lacuna em vez de forçar reuso.'
            : 'Nó oficial amplo ou observacional; manter como estrutura/hierarquia até definição pedagógica explícita.',
      };
    });

  const counts = (predicate) => candidates.filter(predicate).length;
  const output = {
    schemaVersion: 'tec-escola.bncc.mapping-candidates.v1',
    catalogVersion: catalog.catalogVersion,
    catalogHash: catalog.catalogHash,
    sourceOfTruth: 'official_catalog_plus_versioned_canonical_registry',
    generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-03T00:00:00.000Z',
    registry: {
      schemaVersion: registry?.schemaVersion ?? null,
      skillCodes: registryCodes,
    },
    statusContract: {
      candidateStatus: 'CANDIDATE',
      reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      promotionRule: 'Nenhum candidato é MAPPED sem revisão e validação independentes.',
    },
    summary: {
      totalOfficialNodes: candidates.length,
      oneToOneCandidates: counts((item) => item.mappingType === 'ONE_TO_ONE_CANDIDATE'),
      canonicalGaps: counts((item) => item.mappingType === 'CANONICAL_GAP'),
      hierarchyOnly: counts((item) => item.mappingType === 'HIERARCHY_ONLY'),
      highConfidence: counts((item) => item.confidence === 'HIGH'),
      mediumConfidence: counts((item) => item.confidence === 'MEDIUM'),
      lowConfidence: counts((item) => item.confidence === 'LOW'),
      pedagogicalReviewPending: candidates.length,
    },
    candidates,
  };
  return { ...output, candidatesHash: hash(stableJson({ ...output, generatedAt: undefined })) };
}

function run() {
  const catalogPath = path.resolve(root, process.argv[2] ?? 'content/bncc/official/catalog-2018.json');
  const registryPath = path.resolve(root, process.argv[3] ?? 'content/bncc/canonical/registry.json');
  const outputPath = path.resolve(root, process.argv[4] ?? 'content/bncc/mappings/candidates-2018.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const output = generateMappingCandidates(catalog, registry);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_CANDIDATES_OUTPUT=${path.relative(root, outputPath)}`);
  console.log(`BNCC_CANDIDATES_TOTAL=${output.summary.totalOfficialNodes}`);
  console.log(`BNCC_ONE_TO_ONE_CANDIDATES=${output.summary.oneToOneCandidates}`);
  console.log(`BNCC_CANONICAL_GAPS=${output.summary.canonicalGaps}`);
  console.log(`BNCC_CANDIDATES_HASH=${output.candidatesHash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
