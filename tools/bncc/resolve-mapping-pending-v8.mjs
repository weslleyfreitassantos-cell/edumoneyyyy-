import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const coveragePath = path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/coverage-2018.json');
const candidatesPath = path.resolve(root, process.argv[3] ?? 'content/bncc/mappings/candidates-2018.json');
const reviewsPath = path.resolve(root, process.argv[4] ?? 'content/bncc/mappings/reviews-2018.json');
const outputPath = path.resolve(root, process.argv[5] ?? 'content/bncc/mappings/resolutions-v8.json');

const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
const reviews = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));

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

const candidateByCode = new Map((candidates.candidates ?? []).map((item) => [item.officialCode, item]));
const reviewByCode = new Map((reviews.reviews ?? []).map((item) => [item.officialCode, item]));
const pending = (coverage.mappings ?? [])
  .filter((mapping) => mapping.status === 'MAPPING_PENDING')
  .sort((left, right) => left.officialCode.localeCompare(right.officialCode));

const decisions = pending.map((mapping) => {
  const candidate = candidateByCode.get(mapping.officialCode);
  const review = reviewByCode.get(mapping.officialCode);
  if (!candidate || !review) {
    throw new Error(`Missing candidate/review for ${mapping.officialCode}`);
  }

  return {
    officialCode: mapping.officialCode,
    candidateCanonicalSkillCodes: [...(candidate.candidateCanonicalSkillCodes ?? [])],
    candidateConfidence: candidate.confidence,
    candidateConfidenceScore: candidate.confidenceScore,
    relationCandidates: (candidate.candidateCanonicalSkillCodes ?? []).map((canonicalSkillCode) => ({
      canonicalSkillCode,
      relationType: null,
      decision: 'NOT_ASSERTED',
    })),
    resolutionStatus: 'HUMAN_REVIEW_BLOCKED',
    reviewStatus: 'REVIEW_REQUIRED',
    blockers: [
      'SEMANTIC_EQUIVALENCE_NOT_PROVEN',
      'PEDAGOGICAL_SIGNOFF_REQUIRED',
    ],
    rationale: 'A candidatura técnica pode orientar revisão, mas não prova equivalência semântica nem permite escolher PRIMARY, SUPPORTING, PREREQUISITE ou TRANSFER de forma segura. O nó fica explicitamente bloqueado para revisão humana e fora do grafo adaptativo.',
    evidence: {
      candidateRationale: candidate.rationale,
      technicalDecision: review.decision,
      technicalReason: review.reason,
      reviewedBy: review.reviewedBy,
    },
  };
});

const artifact = {
  schemaVersion: 'tec-escola.bncc.mapping-resolutions.v8',
  catalogVersion: coverage.catalogVersion,
  catalogHash: coverage.catalogHash,
  candidatesHash: candidates.candidatesHash,
  reviewsHash: reviews.reviewHash,
  sourceOfTruth: 'official_catalog_plus_contextual_candidates_plus_independent_review',
  generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-04T00:00:00.000Z',
  statusContract: {
    relationTypes: ['PRIMARY', 'SUPPORTING', 'PREREQUISITE', 'TRANSFER'],
    terminalStatuses: ['MAPPED', 'HIERARCHY_ONLY', 'EXPLICITLY_NON_ADAPTIVE', 'HUMAN_REVIEW_BLOCKED', 'SOURCE_REVIEW_REQUIRED'],
    pendingStatus: 'MAPPING_PENDING',
    blockedStatus: 'HUMAN_REVIEW_BLOCKED',
    promotionRule: 'A relation remains unasserted until an independent pedagogical review selects a relation type and validates the official context.',
  },
  summary: {
    mappingPendingBefore: pending.length,
    resolved: decisions.length,
    humanReviewBlocked: decisions.filter((item) => item.resolutionStatus === 'HUMAN_REVIEW_BLOCKED').length,
    relationDecisionsAsserted: decisions.reduce((total, item) => total + item.relationCandidates.filter((relation) => relation.relationType !== null).length, 0),
    duplicates: new Set(decisions.map((item) => item.officialCode)).size !== decisions.length ? 1 : 0,
  },
  decisions,
};

artifact.resolutionHash = hash(stableJson({ ...artifact, generatedAt: undefined }));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(`BNCC_MAPPING_RESOLUTIONS_OUTPUT=${path.relative(root, outputPath)}`);
console.log(`BNCC_MAPPING_PENDING_BEFORE=${artifact.summary.mappingPendingBefore}`);
console.log(`BNCC_MAPPING_PENDING_RESOLVED=${artifact.summary.resolved}`);
console.log(`BNCC_MAPPING_PENDING_HUMAN_BLOCKED=${artifact.summary.humanReviewBlocked}`);
console.log(`BNCC_MAPPING_RELATIONS_ASSERTED=${artifact.summary.relationDecisionsAsserted}`);
console.log(`BNCC_MAPPING_RESOLUTIONS_HASH=${artifact.resolutionHash}`);
