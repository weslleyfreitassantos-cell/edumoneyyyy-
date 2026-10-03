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
  return String(value ?? '')
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

function structuralChecks(skill, node, candidate, eligible) {
  const grade = gradeNumber(node.gradeOrRange);
  const subjects = subjectAreasForNode(node);
  const officialTokens = tokens(`${node.officialTextExcerpt} ${node.componentCode}`);
  const skillTokens = tokens(`${skill?.title ?? ''} ${(skill?.aliases ?? []).join(' ')}`);
  const overlap = [...skillTokens].filter((token) => officialTokens.has(token)).sort();
  const score = skillTokens.size ? overlap.length / skillTokens.size : 0;
  const top = eligible[0];
  const second = eligible[1];
  const margin = top && second ? top.score - second.score : top?.score ?? 0;

  return {
    officialNodePresent: true,
    exactlyOneCandidate: candidate.candidateCanonicalSkillCodes.length === 1,
    canonicalSkillPresent: Boolean(skill),
    stageCompatible: Boolean(skill && skill.stage === node.stage),
    gradeCompatible: Boolean(skill && (grade === null || skill.gradeLevels?.includes(grade))),
    componentCompatible: Boolean(skill && subjects.some((subject) => skill.subjectAreas?.includes(subject))),
    candidateIsTopMatch: Boolean(skill && top?.skill.code === skill.code),
    scoreRecomputed: Number(score.toFixed(4)),
    scoreMatchesCandidate: Number(score.toFixed(4)) === Number(candidate.confidenceScore ?? 0),
    margin: Number(margin.toFixed(4)),
    lexicalOverlap: overlap,
    lexicalOverlapCount: overlap.length,
  };
}

function reviewCandidate(candidate, catalogNode, skills) {
  if (!catalogNode) {
    return {
      decision: 'REJECT',
      reviewStatus: 'TECHNICALLY_REVIEWED',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      promotionStatus: 'NOT_PROMOTED',
      reason: 'O código oficial da candidatura não existe no catálogo congelado.',
      checks: { officialNodePresent: false },
      canonicalSkill: null,
    };
  }

  const skillByCode = new Map(skills.map((skill) => [skill.code, skill]));
  const canonicalSkill = skillByCode.get(candidate.candidateCanonicalSkillCodes?.[0]);
  const eligible = skills
    .filter((skill) => skill.stage === catalogNode.stage)
    .map((skill) => {
      const officialTokens = tokens(`${catalogNode.officialTextExcerpt} ${catalogNode.componentCode}`);
      const skillTokens = tokens(`${skill.title} ${(skill.aliases ?? []).join(' ')}`);
      const overlap = [...skillTokens].filter((token) => officialTokens.has(token));
      return { skill, score: skillTokens.size ? overlap.length / skillTokens.size : 0 };
    })
    .sort((left, right) => right.score - left.score || left.skill.code.localeCompare(right.skill.code));

  if (catalogNode.kind !== 'SKILL') {
    return {
      decision: 'HIERARCHY_ONLY',
      reviewStatus: 'TECHNICALLY_CLASSIFIED',
      pedagogicalReviewStatus: 'NOT_APPLICABLE',
      promotionStatus: 'NOT_PROMOTED',
      reason: 'Nó oficial estrutural/observacional; não deve ser promovido diretamente a habilidade adaptativa.',
      checks: { officialNodePresent: true, kindIsSkill: false },
      canonicalSkill: null,
    };
  }

  if (!canonicalSkill) {
    return {
      decision: 'CANONICAL_GAP',
      reviewStatus: 'TECHNICALLY_REVIEWED',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      promotionStatus: 'NOT_PROMOTED',
      reason: 'Não existe habilidade canônica candidata; criar ou revisar uma skill exige decisão pedagógica explícita.',
      checks: { officialNodePresent: true, kindIsSkill: true, canonicalSkillPresent: false },
      canonicalSkill: null,
    };
  }

  const checks = structuralChecks(canonicalSkill, catalogNode, candidate, eligible);
  const structurallyValid = [
    'officialNodePresent',
    'exactlyOneCandidate',
    'canonicalSkillPresent',
    'stageCompatible',
    'gradeCompatible',
    'componentCompatible',
    'candidateIsTopMatch',
    'scoreMatchesCandidate',
  ].every((key) => checks[key] === true);
  const conservative = structurallyValid
    && candidate.confidence === 'HIGH'
    && checks.scoreRecomputed >= 0.75
    && checks.margin >= 0.15
    && checks.lexicalOverlapCount >= 2;

  return {
    decision: conservative ? 'APPROVE_CONSERVATIVE' : structurallyValid ? 'NEEDS_HUMAN_REVIEW' : 'REJECT',
    reviewStatus: 'TECHNICALLY_REVIEWED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    promotionStatus: 'NOT_PROMOTED',
    reason: conservative
      ? 'Compatibilidade estrutural e evidência lexical fortes; aprovação conservadora ainda requer revisão pedagógica humana antes da promoção.'
      : structurallyValid
        ? 'Compatibilidade técnica encontrada, mas a evidência não é suficiente para aprovação automatizada; revisão pedagógica humana é obrigatória.'
        : 'A candidatura falhou em uma ou mais verificações independentes de estrutura, compatibilidade ou reprodução do score.',
    checks,
    canonicalSkill: {
      code: canonicalSkill.code,
      title: canonicalSkill.title,
      aliases: canonicalSkill.aliases ?? [],
      stage: canonicalSkill.stage,
      gradeLevels: canonicalSkill.gradeLevels ?? [],
      subjectAreas: canonicalSkill.subjectAreas ?? [],
    },
  };
}

export function reviewMappings(candidates, catalog, registry) {
  const catalogByCode = new Map((catalog.nodes ?? []).map((node) => [node.code, node]));
  const skills = [...(registry.skills ?? [])].sort((left, right) => left.code.localeCompare(right.code));
  const reviews = [...(candidates.candidates ?? [])]
    .sort((left, right) => left.officialCode.localeCompare(right.officialCode))
    .map((candidate) => {
      const official = catalogByCode.get(candidate.officialCode);
      const result = reviewCandidate(candidate, official, skills);
      return {
        officialCode: candidate.officialCode,
        officialTextExcerpt: official?.officialTextExcerpt ?? null,
        kind: candidate.kind,
        stage: candidate.stage,
        gradeOrRange: candidate.gradeOrRange,
        componentCode: candidate.componentCode,
        candidateCanonicalSkillCodes: candidate.candidateCanonicalSkillCodes ?? [],
        candidateConfidence: candidate.confidence,
        candidateConfidenceScore: candidate.confidenceScore ?? 0,
        ...result,
        reviewedBy: 'TECESCOLA_AUTOMATED_INDEPENDENT_REVIEW_V1',
      };
    });
  const count = (predicate) => reviews.filter(predicate).length;
  const output = {
    schemaVersion: 'tec-escola.bncc.mapping-reviews.v1',
    catalogVersion: catalog.catalogVersion,
    catalogHash: catalog.catalogHash,
    candidatesHash: candidates.candidatesHash,
    sourceOfTruth: 'official_catalog_plus_versioned_canonical_registry_plus_independent_technical_review',
    generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-03T00:00:00.000Z',
    statusContract: {
      reviewStatus: ['TECHNICALLY_REVIEWED', 'TECHNICALLY_CLASSIFIED'],
      decisions: ['APPROVE_CONSERVATIVE', 'NEEDS_HUMAN_REVIEW', 'REJECT', 'CANONICAL_GAP', 'HIERARCHY_ONLY'],
      pedagogicalReviewStatus: ['PEDAGOGICAL_REVIEW_PENDING', 'NOT_APPLICABLE'],
      promotionRule: 'Nenhuma decisão automatizada promove cobertura; revisão pedagógica humana continua obrigatória.',
    },
    summary: {
      total: reviews.length,
      technicallyReviewed: count((item) => item.reviewStatus === 'TECHNICALLY_REVIEWED'),
      technicallyClassified: count((item) => item.reviewStatus === 'TECHNICALLY_CLASSIFIED'),
      approveConservative: count((item) => item.decision === 'APPROVE_CONSERVATIVE'),
      needsHumanReview: count((item) => item.decision === 'NEEDS_HUMAN_REVIEW'),
      rejected: count((item) => item.decision === 'REJECT'),
      canonicalGaps: count((item) => item.decision === 'CANONICAL_GAP'),
      hierarchyOnly: count((item) => item.decision === 'HIERARCHY_ONLY'),
      pedagogicalReviewPending: count((item) => item.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING'),
      promoted: 0,
    },
    reviews,
  };
  return { ...output, reviewHash: hash(stableJson({ ...output, generatedAt: undefined })) };
}

function run() {
  const candidatesPath = path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/candidates-2018.json');
  const catalogPath = path.resolve(root, process.argv[3] ?? 'content/bncc/official/catalog-2018.json');
  const registryPath = path.resolve(root, process.argv[4] ?? 'content/bncc/canonical/registry.json');
  const outputPath = path.resolve(root, process.argv[5] ?? 'content/bncc/mappings/reviews-2018.json');
  const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const output = reviewMappings(candidates, catalog, registry);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_REVIEWS_OUTPUT=${path.relative(root, outputPath)}`);
  console.log(`BNCC_REVIEWS_TOTAL=${output.summary.total}`);
  console.log(`BNCC_REVIEWS_APPROVE_CONSERVATIVE=${output.summary.approveConservative}`);
  console.log(`BNCC_REVIEWS_NEEDS_HUMAN=${output.summary.needsHumanReview}`);
  console.log(`BNCC_REVIEWS_CANONICAL_GAPS=${output.summary.canonicalGaps}`);
  console.log(`BNCC_REVIEWS_HIERARCHY_ONLY=${output.summary.hierarchyOnly}`);
  console.log(`BNCC_REVIEWS_HASH=${output.reviewHash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
