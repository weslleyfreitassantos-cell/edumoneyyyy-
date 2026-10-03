import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.cwd(), process.argv[2] ?? 'content/bncc/official/catalog-2018.json');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
const failures = [];
if (catalog.schemaVersion !== 'tec-escola.bncc.official-catalog.v1') failures.push('schemaVersion');
if (catalog.sourceOfTruth !== 'official_mec_bncc_pdf') failures.push('sourceOfTruth');
if (!Array.isArray(catalog.sources) || catalog.sources.length < 2) failures.push('sources');
if (!Array.isArray(catalog.nodes) || catalog.nodes.length === 0) failures.push('nodes');
const codes = new Set();
for (const node of catalog.nodes ?? []) {
  if (!/^(?:EI\d{2}[A-Z]{2}\d{2}|EF(?:\d{2}|67)[A-Z]{2}\d{2}|EM13(?:LGG|CNT|CHS|MAT)\d{3}|EM13(?:LP|CO)\d{2})$/.test(node.code)) failures.push(`invalid_code:${node.code}`);
  if (codes.has(node.code)) failures.push(`duplicate_code:${node.code}`);
  codes.add(node.code);
  if (!node.officialSource?.url || !node.officialSource?.page) failures.push(`missing_provenance:${node.code}`);
  if (!node.officialTextExcerpt) failures.push(`missing_excerpt:${node.code}`);
}
if (catalog.coverage?.duplicateOfficialCodes?.length) failures.push('duplicateOfficialCodes');
if (failures.length) {
  console.error(`BNCC_CATALOG_VALIDATION=FAIL ${failures.slice(0, 20).join(',')}`);
  process.exit(1);
}
console.log(`BNCC_CATALOG_VALIDATION=PASS nodes=${catalog.nodes.length} hash=${catalog.catalogHash}`);
