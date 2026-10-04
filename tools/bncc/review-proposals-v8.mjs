import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
function stableJson(value) { return JSON.stringify(value, (_key, current) => { if (!current || typeof current !== 'object' || Array.isArray(current)) return current; return Object.keys(current).sort().reduce((result, key) => { result[key] = current[key]; return result; }, {}); }); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

export function reviewProposalsV8(proposals, registry) {
  const knownSkills = new Set((registry.skills ?? []).map((skill) => skill.code));
  const reviews = (proposals.proposals ?? []).map((proposal) => {
    const checks = {
      officialEvidence: proposal.officialCodes.length > 0,
      stage: Boolean(proposal.recommendedStage),
      grade: Number.isInteger(proposal.gradeFrom) && Number.isInteger(proposal.gradeTo) && proposal.gradeFrom <= proposal.gradeTo,
      subject: Boolean(proposal.subject),
      semanticScope: Boolean(proposal.semanticObject ?? proposal.title),
      candidateExists: proposal.proposalStatus !== 'REUSE_EXISTING_CANDIDATE' || knownSkills.has(proposal.canonicalCode),
      noPedagogicalClaim: proposal.reviewStatus !== 'PEDAGOGICAL_REVIEWED',
    };
    const valid = Object.values(checks).every(Boolean);
    const decision = !valid ? 'REJECT' : proposal.proposalStatus === 'REUSE_EXISTING_CANDIDATE' ? 'REUSE_EXISTING' : 'HUMAN_REVIEW_REQUIRED';
    return {
      proposalId: proposal.proposalId, canonicalCode: proposal.canonicalCode, officialCodes: proposal.officialCodes,
      decision, checks, reviewStatus: 'INDEPENDENTLY_REVIEWED', promotionStatus: 'NOT_PROMOTED',
      reason: decision === 'REUSE_EXISTING'
        ? 'Estrutura compatível com skill existente; revisão pedagógica continua necessária para mapear o código oficial.'
        : decision === 'HUMAN_REVIEW_REQUIRED'
          ? 'A proposta é nova ou semanticamente insuficiente para aprovação automática; requer revisão pedagógica.'
          : 'A proposta falhou uma verificação estrutural independente.',
      reviewedBy: 'TECESCOLA_AUTOMATED_PROPOSAL_REVIEW_V8',
    };
  }).sort((left, right) => left.proposalId.localeCompare(right.proposalId));
  const count = (decision) => reviews.filter((review) => review.decision === decision).length;
  const output = {
    schemaVersion: 'tec-escola.bncc.mapping-proposal-reviews.v8', catalogVersion: proposals.catalogVersion, catalogHash: proposals.catalogHash,
    proposalsHash: proposals.proposalsHash, sourceOfTruth: 'independent_structural_proposal_review', generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-04T00:00:00.000Z',
    statusContract: { decisions: ['REUSE_EXISTING', 'HUMAN_REVIEW_REQUIRED', 'REJECT'], promotionRule: 'Nenhuma revisão automatizada escreve PEDAGOGICAL_REVIEWED ou altera a cobertura.' },
    summary: { total: reviews.length, reuseExisting: count('REUSE_EXISTING'), humanReviewRequired: count('HUMAN_REVIEW_REQUIRED'), rejected: count('REJECT'), promoted: 0 },
    reviews,
  };
  return { ...output, reviewHash: hash(stableJson({ ...output, generatedAt: undefined })) };
}

function run() {
  const proposalsPath = path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/proposals-v8.json');
  const registryPath = path.resolve(root, process.argv[3] ?? 'content/bncc/canonical/registry.json');
  const outputPath = path.resolve(root, process.argv[4] ?? 'content/bncc/mappings/proposal-reviews-v8.json');
  const output = reviewProposalsV8(JSON.parse(fs.readFileSync(proposalsPath, 'utf8')), JSON.parse(fs.readFileSync(registryPath, 'utf8')));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_V8_PROPOSAL_REVIEWS_OUTPUT=${path.relative(root, outputPath)}`); console.log(`BNCC_V8_PROPOSAL_REVIEWS=${output.summary.total}`); console.log(`BNCC_V8_REUSE_EXISTING_REVIEWED=${output.summary.reuseExisting}`); console.log(`BNCC_V8_HUMAN_REVIEW_REQUIRED=${output.summary.humanReviewRequired}`); console.log(`BNCC_V8_PROPOSAL_REVIEW_HASH=${output.reviewHash}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
