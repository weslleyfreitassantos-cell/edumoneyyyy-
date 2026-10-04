import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.resolve(root, process.argv[2] ?? 'content/bncc/official/catalog-2018.json');
const reviewsPath = path.resolve(root, process.argv[3] ?? 'content/bncc/mappings/reviews-2018.json');
const promotionsPath = path.resolve(root, process.argv[4] ?? 'content/bncc/mappings/promoted-2018.json');
const outputPath = path.resolve(root, process.argv[5] ?? 'content/bncc/mappings/coverage-2018.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const reviews = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
const promotions = JSON.parse(fs.readFileSync(promotionsPath, 'utf8'));

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

const nodes = [...(catalog.nodes ?? [])].sort((left, right) => left.code.localeCompare(right.code));
const reviewByCode = new Map((reviews.reviews ?? []).map((review) => [review.officialCode, review]));
const promotionByCode = new Map((promotions.promotions ?? []).map((promotion) => [promotion.officialCode, promotion]));
const mappings = nodes.map((node) => {
  const review = reviewByCode.get(node.code);
  const promotion = promotionByCode.get(node.code);
  const base = {
    officialCode: node.code,
    stage: node.stage,
    kind: node.kind,
    gradeOrRange: node.gradeOrRange,
    componentCode: node.componentCode,
    officialSource: { id: node.officialSource.id, page: node.officialSource.page },
  };

  if (promotion) {
    return {
      ...base,
      status: 'MAPPED',
      mappingSource: 'AUTOMATED_SAFE_PROMOTION',
      reviewStatus: promotion.reviewStatus,
      pedagogicalReviewStatus: promotion.pedagogicalReviewStatus,
      canonicalSkillCodes: promotion.canonicalSkillCodes,
      rationale: promotion.rationale,
    };
  }

  if (node.kind !== 'SKILL') {
    return {
      ...base,
      status: 'HIERARCHY_ONLY',
      mappingSource: 'OFFICIAL_NODE_CLASSIFICATION',
      reviewStatus: 'NOT_APPLICABLE',
      canonicalSkillCodes: [],
      rationale: 'Nó oficial estrutural; permanece contabilizado como hierarquia e não recebe mastery automaticamente.',
    };
  }

  return {
    ...base,
    status: 'SOURCE_REVIEW_REQUIRED',
    mappingSource: 'TECHNICAL_REVIEW_WITH_PEDAGOGICAL_GATE',
    reviewStatus: review?.pedagogicalReviewStatus ?? 'PEDAGOGICAL_REVIEW_PENDING',
    canonicalSkillCodes: [],
    rationale: review?.reason ?? 'A fonte oficial ou a correspondência canônica exige revisão antes de qualquer mapeamento.',
  };
});

const by = (field) => Object.fromEntries(
  [...new Set(nodes.map((node) => node[field]))].sort().map((value) => [
    value,
    mappings.filter((mapping) => mapping[field] === value).length,
  ]),
);

const coverage = {
  schemaVersion: 'tec-escola.bncc.mapping-coverage.v2',
  catalogVersion: catalog.catalogVersion,
  catalogHash: catalog.catalogHash,
  sourceOfTruth: 'official_catalog_plus_independent_review_plus_safe_promotions',
  generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-04T00:00:00.000Z',
  statusContract: {
    accountedStatuses: ['MAPPED', 'HIERARCHY_ONLY', 'EXPLICITLY_NON_ADAPTIVE', 'SOURCE_REVIEW_REQUIRED'],
    unaccountedStatus: 'UNACCOUNTED',
    reviewRequiredStatus: 'SOURCE_REVIEW_REQUIRED',
  },
  summary: {
    totalOfficialNodes: mappings.length,
    mapped: mappings.filter((mapping) => mapping.status === 'MAPPED').length,
    hierarchyOnly: mappings.filter((mapping) => mapping.status === 'HIERARCHY_ONLY').length,
    explicitlyNonAdaptive: 0,
    sourceReviewRequired: mappings.filter((mapping) => mapping.status === 'SOURCE_REVIEW_REQUIRED').length,
    unaccounted: mappings.filter((mapping) => mapping.status === 'UNACCOUNTED').length,
    byStage: by('stage'),
    byComponent: by('componentCode'),
  },
  mappings,
};

const canonical = stableJson({ ...coverage, generatedAt: undefined });
coverage.coverageHash = hash(canonical);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(coverage, null, 2)}\n`, 'utf8');
console.log(`BNCC_MAPPING_OUTPUT=${path.relative(root, outputPath)}`);
console.log(`BNCC_MAPPING_TOTAL=${mappings.length}`);
console.log(`BNCC_MAPPING_MAPPED=${coverage.summary.mapped}`);
console.log(`BNCC_MAPPING_HIERARCHY_ONLY=${coverage.summary.hierarchyOnly}`);
console.log(`BNCC_MAPPING_SOURCE_REVIEW_REQUIRED=${coverage.summary.sourceReviewRequired}`);
console.log(`BNCC_MAPPING_UNACCOUNTED=${coverage.summary.unaccounted}`);
console.log(`BNCC_MAPPING_HASH=${coverage.coverageHash}`);
