import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[2] ?? 'content/bncc/official/catalog-2018.json'), 'utf8'));
const context = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[3] ?? 'content/bncc/official/context-index.json'), 'utf8'));
const failures = [];
const catalogCodes = new Set((catalog.nodes ?? []).map((node) => node.code));
const contextCodes = new Set();
for (const node of context.nodes ?? []) {
  if (contextCodes.has(node.code)) failures.push(`duplicate:${node.code}`);
  contextCodes.add(node.code);
  if (!catalogCodes.has(node.code)) failures.push(`unknown:${node.code}`);
  if (!node.stage || !node.component?.code || !node.sourceProvenance?.artifactId || !node.sourceProvenance?.page) failures.push(`missing_structural_context:${node.code}`);
  if (node.parentNodes?.length || node.childNodes?.length) failures.push(`inferred_hierarchy:${node.code}`);
  for (const neighbor of node.neighborNodes ?? []) {
    if (!catalogCodes.has(neighbor)) failures.push(`unknown_neighbor:${node.code}:${neighbor}`);
    if (neighbor === node.code) failures.push(`self_neighbor:${node.code}`);
  }
}
for (const code of catalogCodes) if (!contextCodes.has(code)) failures.push(`missing:${code}`);
if (context.summary?.officialNodes !== catalogCodes.size) failures.push('summary.officialNodes');
if (context.catalogHash !== catalog.catalogHash) failures.push('catalogHash');
if (context.contextContract?.semanticStatus !== 'AVAILABLE_CONTEXT_ONLY') failures.push('semanticStatus');
if (failures.length) { console.error(`BNCC_CONTEXT_INDEX_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`); process.exit(1); }
console.log(`BNCC_CONTEXT_INDEX_VALIDATION=PASS nodes=${contextCodes.size} descriptors=${context.summary.nodesWithDescriptor}`);
