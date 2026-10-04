import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
function stableJson(value) { return JSON.stringify(value, (_key, current) => { if (!current || typeof current !== 'object' || Array.isArray(current)) return current; return Object.keys(current).sort().reduce((result, key) => { result[key] = current[key]; return result; }, {}); }); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function humanize(value) { return String(value ?? '').toLocaleLowerCase('pt-BR').split('_').filter(Boolean).map((part) => part[0].toLocaleUpperCase('pt-BR') + part.slice(1)).join(' '); }
function gradeBounds(value) {
  const numbers = String(value ?? '').match(/\d+/g)?.map(Number) ?? [];
  return { gradeFrom: numbers[0] ?? null, gradeTo: numbers.at(-1) ?? null };
}
function proposalCode(cluster) {
  const prefix = cluster.subject === 'EDUCACAO_INFANTIL' ? 'EARLY_CHILDHOOD' : cluster.subject;
  return `${prefix}_${cluster.cognitiveOperation}_${cluster.semanticObject}`.replace(/[^A-Z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toUpperCase();
}

export function buildProposalsV8(clusters, registry) {
  const existing = new Set((registry.skills ?? []).map((skill) => skill.code));
  const proposals = (clusters.clusters ?? []).map((cluster) => {
    const candidate = cluster.semanticCandidateSkills?.[0] ?? null;
    const canonicalCode = candidate ?? proposalCode(cluster);
    const bounds = gradeBounds(cluster.gradeRange);
    const evidence = cluster.officialContext?.descriptorSamples?.[0] ?? null;
    const reuseExisting = Boolean(candidate && existing.has(candidate));
    return {
      proposalId: `V8_PROPOSAL_${cluster.clusterId.replace(/^V8_GAP_/, '')}`,
      officialCodes: cluster.officialCodes,
      canonicalCode,
      title: humanize(cluster.semanticObject),
      objective: evidence,
      description: evidence ? `Proposta derivada do contexto oficial disponível: ${evidence}` : 'Proposta aguardando descritor oficial contextualizado.',
      masteryCapability: `Demonstrar domínio sobre ${humanize(cluster.semanticObject)}.`,
      subject: cluster.subject,
      domain: cluster.domain,
      subdomain: cluster.subdomain,
      recommendedStage: cluster.stage,
      gradeFrom: bounds.gradeFrom,
      gradeTo: bounds.gradeTo,
      evidenceCapability: evidence ? 'DESCRIPTOR_BACKED_PROPOSAL' : 'STRUCTURAL_ONLY_PROPOSAL',
      masteryTargetable: reuseExisting,
      parentAnchor: null,
      suggestedPrerequisites: [],
      suggestedRelated: [],
      suggestedTransfer: [],
      rationale: reuseExisting
        ? 'Candidato canônico existente reaproveitado para revisão; isto não promove o mapeamento oficial.'
        : 'Nova skill apenas proposta a partir de contexto estrutural e textual; exige revisão pedagógica antes de entrar no grafo.',
      confidence: reuseExisting ? 'MEDIUM' : 'LOW',
      proposalStatus: reuseExisting ? 'REUSE_EXISTING_CANDIDATE' : 'NEW_SKILL_PENDING_REVIEW',
      reviewStatus: 'PROPOSAL_PENDING',
    };
  }).sort((left, right) => left.proposalId.localeCompare(right.proposalId));
  const output = {
    schemaVersion: 'tec-escola.bncc.mapping-proposals.v8', catalogVersion: clusters.catalogVersion, catalogHash: clusters.catalogHash,
    contextHash: clusters.contextHash, gapsHash: clusters.gapsHash, sourceOfTruth: 'v8_contextual_gap_clusters_plus_canonical_registry',
    generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-04T00:00:00.000Z',
    statusContract: {
      proposalStatus: ['REUSE_EXISTING_CANDIDATE', 'NEW_SKILL_PENDING_REVIEW'], reviewStatus: ['PROPOSAL_PENDING', 'INDEPENDENTLY_REVIEWED'],
      promotionRule: 'Propostas nunca promovem cobertura; somente decisão pedagógica versionada pode alterar o grafo.',
    },
    summary: {
      clusters: clusters.clusters.length, proposals: proposals.length, reuseExisting: proposals.filter((item) => item.proposalStatus === 'REUSE_EXISTING_CANDIDATE').length,
      newSkillPendingReview: proposals.filter((item) => item.proposalStatus === 'NEW_SKILL_PENDING_REVIEW').length, promoted: 0,
    },
    proposals,
  };
  return { ...output, proposalsHash: hash(stableJson({ ...output, generatedAt: undefined })) };
}

function run() {
  const clustersPath = path.resolve(root, process.argv[2] ?? 'content/bncc/canonical/clusters-v8.json');
  const registryPath = path.resolve(root, process.argv[3] ?? 'content/bncc/canonical/registry.json');
  const outputPath = path.resolve(root, process.argv[4] ?? 'content/bncc/mappings/proposals-v8.json');
  const output = buildProposalsV8(JSON.parse(fs.readFileSync(clustersPath, 'utf8')), JSON.parse(fs.readFileSync(registryPath, 'utf8')));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_V8_PROPOSALS_OUTPUT=${path.relative(root, outputPath)}`); console.log(`BNCC_V8_PROPOSALS=${output.summary.proposals}`); console.log(`BNCC_V8_REUSE_EXISTING=${output.summary.reuseExisting}`); console.log(`BNCC_V8_NEW_PENDING=${output.summary.newSkillPendingReview}`); console.log(`BNCC_V8_PROPOSALS_HASH=${output.proposalsHash}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
