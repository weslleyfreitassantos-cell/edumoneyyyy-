import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();

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

export function buildCanonicalGraph(v4Registry, relationships, canonicalRegistry, canonicalRelationships = {}) {
  const v4Subjects = [...(v4Registry.subjects ?? [])].sort((left, right) => left.code.localeCompare(right.code));
  const anchors = new Map();
  const leaves = new Map();
  for (const subject of v4Subjects) {
    for (const code of subject.anchors ?? []) {
      anchors.set(code, { code, class: 'ANCHOR', subjectCode: subject.code, subjectName: subject.name });
    }
    for (const leaf of subject.leaves ?? []) {
      leaves.set(leaf.code, {
        code: leaf.code,
        class: 'LEAF',
        subjectCode: subject.code,
        subjectName: subject.name,
        parent: leaf.parent,
        title: leaf.title,
        objective: leaf.objective,
        domain: leaf.domain,
        readiness: leaf.readiness,
        contentAuthoringStatus: leaf.content_authoring_status,
        recommendedStage: leaf.recommendedStage,
        recommendedGradeFrom: leaf.recommendedGradeFrom,
        recommendedGradeTo: leaf.recommendedGradeTo,
      });
    }
  }

  const seedSkills = [...(canonicalRegistry.skills ?? [])]
    .filter((skill) => !leaves.has(skill.code))
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((skill) => ({
      code: skill.code,
      class: 'SEED_SKILL',
      title: skill.title,
      stage: skill.stage,
      gradeLevels: skill.gradeLevels ?? [],
      subjectAreas: skill.subjectAreas ?? [],
      kind: skill.kind,
    }));

  const knownCodes = new Set([...anchors.keys(), ...leaves.keys(), ...seedSkills.map((skill) => skill.code)]);
  const edges = [...(relationships.hierarchy ?? []), ...(canonicalRelationships.hierarchy ?? [])]
    .map(([parent, child]) => ({ parent, child }))
    .sort((left, right) => left.parent.localeCompare(right.parent) || left.child.localeCompare(right.child));
  const otherCodes = [...new Set(edges.flatMap((edge) => [edge.parent, edge.child]).filter((code) => !knownCodes.has(code)))].sort();
  const otherSemanticNodes = otherCodes.map((code) => ({
    code,
    class: 'OTHER_SEMANTIC_NODE',
    source: 'TECESCOLA_CORE_V4_RELATIONSHIPS',
    resolution: 'REVIEW_REQUIRED',
  }));
  const nodeCodes = new Set([...knownCodes, ...otherCodes]);
  const parents = new Set(edges.map((edge) => edge.parent));
  const children = new Set(edges.map((edge) => edge.child));
  const nodes = [
    ...[...anchors.values()].sort((left, right) => left.code.localeCompare(right.code)),
    ...[...leaves.values()].sort((left, right) => left.code.localeCompare(right.code)),
    ...seedSkills,
    ...otherSemanticNodes,
  ];
  if (nodes.some((node) => !nodeCodes.has(node.code))) throw new Error('canonical graph node index mismatch');

  const output = {
    schemaVersion: 'tec-escola.bncc.canonical-graph.v1',
    sourceOfTruth: 'TECESCOLA_CORE_V4_REGISTRY_AND_RELATIONSHIPS_PLUS_CANONICAL_SEED_REGISTRY_AND_BNCC_CANONICAL_RELATIONSHIPS',
    graphStatus: 'AUDITED_NOT_BNCC_PROMOTED',
    statusContract: {
      targetableClasses: ['LEAF', 'SEED_SKILL'],
      structuralClasses: ['ANCHOR', 'OTHER_SEMANTIC_NODE'],
      unresolvedClass: 'OTHER_SEMANTIC_NODE',
      unresolvedPolicy: 'Não criar habilidade ou mapeamento BNCC automaticamente para nó semântico sem definição autoral.',
    },
    summary: {
      subjects: v4Subjects.length,
      anchors: anchors.size,
      leaves: leaves.size,
      seedSkills: seedSkills.length,
      targetableSkills: leaves.size + seedSkills.length,
      otherSemanticNodes: otherSemanticNodes.length,
      hierarchyEdges: edges.length,
      orphanAnchors: [...anchors.keys()].filter((code) => !parents.has(code) && !children.has(code)).sort(),
      orphanLeaves: [...leaves.keys()].filter((code) => !children.has(code)).sort(),
      unresolvedSemanticNodes: otherCodes,
    },
    nodes,
    edges,
  };
  return { ...output, graphHash: hash(stableJson({ ...output, graphHash: undefined })) };
}

function run() {
  const registryPath = path.resolve(root, process.argv[2] ?? 'content/adaptive/tec-escola-core-v4/registry.json');
  const relationshipsPath = path.resolve(root, process.argv[3] ?? 'content/adaptive/tec-escola-core-v4/relationships.json');
  const canonicalPath = path.resolve(root, process.argv[4] ?? 'content/bncc/canonical/registry.json');
  const canonicalRelationshipsPath = path.resolve(root, process.argv[5] ?? 'content/bncc/canonical/relationships-v4.json');
  const outputPath = path.resolve(root, process.argv[6] ?? 'content/bncc/canonical/graph-v4.json');
  const output = buildCanonicalGraph(
    JSON.parse(fs.readFileSync(registryPath, 'utf8')),
    JSON.parse(fs.readFileSync(relationshipsPath, 'utf8')),
    JSON.parse(fs.readFileSync(canonicalPath, 'utf8')),
    JSON.parse(fs.readFileSync(canonicalRelationshipsPath, 'utf8')),
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_CANONICAL_GRAPH_OUTPUT=${path.relative(root, outputPath)}`);
  console.log(`BNCC_CANONICAL_GRAPH_TARGETABLE_SKILLS=${output.summary.targetableSkills}`);
  console.log(`BNCC_CANONICAL_GRAPH_ANCHORS=${output.summary.anchors}`);
  console.log(`BNCC_CANONICAL_GRAPH_OTHER_SEMANTIC_NODES=${output.summary.otherSemanticNodes}`);
  console.log(`BNCC_CANONICAL_GRAPH_HASH=${output.graphHash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
