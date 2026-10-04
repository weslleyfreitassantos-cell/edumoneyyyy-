import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();

const SAFE_PROMOTIONS = {
  EF06HI01: {
    canonicalSkillCode: 'HISTORY_INTERPRET_PERIODIZATION',
    evidence: ['periodização dos processos históricos'],
  },
  EF09CI01: {
    canonicalSkillCode: 'SCIENCE_EXPLAIN_MATTER_TRANSFORMATION',
    evidence: ['mudanças de estado físico da matéria', 'constituição submicroscópica'],
  },
};

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
    .toLocaleLowerCase('pt-BR');
}

export function promoteSafeMappings(reviews, catalog) {
  const reviewByCode = new Map((reviews.reviews ?? []).map((review) => [review.officialCode, review]));
  const catalogByCode = new Map((catalog.nodes ?? []).map((node) => [node.code, node]));
  const promotions = Object.entries(SAFE_PROMOTIONS).sort(([left], [right]) => left.localeCompare(right)).map(([officialCode, rule]) => {
    const review = reviewByCode.get(officialCode);
    const official = catalogByCode.get(officialCode);
    if (!review || !official) throw new Error(`Safe promotion source missing for ${officialCode}`);
    if (review.decision !== 'APPROVE_CONSERVATIVE') {
      throw new Error(`${officialCode} is not an APPROVE_CONSERVATIVE review`);
    }
    if (review.candidateCanonicalSkillCodes?.length !== 1
      || review.candidateCanonicalSkillCodes[0] !== rule.canonicalSkillCode
      || review.canonicalSkill?.code !== rule.canonicalSkillCode) {
      throw new Error(`${officialCode} canonical candidate does not match the allowlist`);
    }
    if (!Object.values(review.checks ?? {}).every((check) => check !== false)) {
      throw new Error(`${officialCode} failed an independent structural check`);
    }
    const excerpt = normalize(official.officialTextExcerpt);
    if (!rule.evidence.every((phrase) => excerpt.includes(normalize(phrase)))) {
      throw new Error(`${officialCode} does not contain the expected official evidence`);
    }

    return {
      officialCode,
      canonicalSkillCodes: [rule.canonicalSkillCode],
      status: 'MAPPED',
      reviewStatus: 'TECH_VALIDATED',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      promotionStatus: 'AUTOMATED_SAFE_PROMOTION',
      reviewSource: 'TECESCOLA_AUTOMATED_INDEPENDENT_REVIEW_V1',
      reviewMethod: 'STRICT_STRUCTURAL_AND_OFFICIAL_EVIDENCE_RULES',
      reviewedAt: reviews.generatedAt,
      reviewerType: 'AUTOMATED_INDEPENDENT_VALIDATOR',
      rationale: 'Promoção técnica conservadora: etapa, componente, faixa e candidato único compatíveis, com evidência semântica explícita no trecho oficial congelado. Revisão pedagógica humana continua pendente.',
      evidence: rule.evidence,
    };
  });

  const output = {
    schemaVersion: 'tec-escola.bncc.safe-promotions.v1',
    catalogVersion: reviews.catalogVersion,
    catalogHash: reviews.catalogHash,
    candidatesHash: reviews.candidatesHash,
    sourceOfTruth: 'official_catalog_plus_independent_technical_review_plus_strict_allowlist',
    generatedAt: reviews.generatedAt,
    statusContract: {
      mappedStatus: 'MAPPED',
      technicalReviewStatus: 'TECH_VALIDATED',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      humanReviewClaim: 'Never infer PEDAGOGICAL_REVIEWED from automated promotion.',
    },
    summary: {
      promoted: promotions.length,
      pedagogicalReviewPending: promotions.filter((item) => item.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING').length,
    },
    promotions,
  };

  return { ...output, promotionHash: hash(stableJson({ ...output, generatedAt: undefined })) };
}

function run() {
  const reviewsPath = path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/reviews-2018.json');
  const catalogPath = path.resolve(root, process.argv[3] ?? 'content/bncc/official/catalog-2018.json');
  const outputPath = path.resolve(root, process.argv[4] ?? 'content/bncc/mappings/promoted-2018.json');
  const output = promoteSafeMappings(
    JSON.parse(fs.readFileSync(reviewsPath, 'utf8')),
    JSON.parse(fs.readFileSync(catalogPath, 'utf8')),
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_SAFE_PROMOTIONS_OUTPUT=${path.relative(root, outputPath)}`);
  console.log(`BNCC_SAFE_PROMOTIONS=${output.summary.promoted}`);
  console.log(`BNCC_SAFE_PROMOTION_HASH=${output.promotionHash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
