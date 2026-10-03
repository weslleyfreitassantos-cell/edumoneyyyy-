import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.resolve(root, process.argv[2] ?? 'content/bncc/official/catalog-2018.json');
const outputPath = path.resolve(root, process.argv[3] ?? 'content/bncc/mappings/coverage-2018.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

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
const mappings = nodes.map((node) => ({
  officialCode: node.code,
  stage: node.stage,
  kind: node.kind,
  gradeOrRange: node.gradeOrRange,
  componentCode: node.componentCode,
  officialSource: {
    id: node.officialSource.id,
    page: node.officialSource.page,
  },
  status: 'UNACCOUNTED',
  mappingSource: 'NOT_YET_MAPPED',
  reviewStatus: 'REVIEW_REQUIRED',
  canonicalSkillCodes: [],
  rationale: 'Nenhum mapeamento TecEscola foi promovido sem revisão pedagógica explícita.',
}));

const by = (field) => Object.fromEntries(
  [...new Set(nodes.map((node) => node[field]))].sort().map((value) => [
    value,
    mappings.filter((mapping) => mapping[field] === value).length,
  ]),
);

const coverage = {
  schemaVersion: 'tec-escola.bncc.mapping-coverage.v1',
  catalogVersion: catalog.catalogVersion,
  catalogHash: catalog.catalogHash,
  sourceOfTruth: 'official_catalog_plus_explicit_mapping_review',
  generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-03T00:00:00.000Z',
  statusContract: {
    accountedStatuses: ['MAPPED', 'EXPLICITLY_NON_ADAPTIVE'],
    unaccountedStatus: 'UNACCOUNTED',
    reviewRequiredStatus: 'REVIEW_REQUIRED',
  },
  summary: {
    totalOfficialNodes: mappings.length,
    mapped: 0,
    explicitlyNonAdaptive: 0,
    unaccounted: mappings.length,
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
console.log(`BNCC_MAPPING_UNACCOUNTED=${mappings.length}`);
console.log(`BNCC_MAPPING_HASH=${coverage.coverageHash}`);
