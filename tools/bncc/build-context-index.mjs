import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const COMPONENT_LABELS = {
  AR: 'ARTE', CG: 'CORPO_GESTOS_MOVIMENTOS', CHS: 'CIENCIAS_HUMANAS_E_O_SOCIAIS', CI: 'CIENCIAS', CNT: 'CIENCIAS_DA_NATUREZA',
  CO: 'COMPUTACAO', EF: 'EDUCACAO_FISICA', EO: 'O_EU_O_OUTRO_E_O_NOS', ER: 'ENSINO_RELIGIOSO', ET: 'ESPACOS_TEMPOS_QUANTIDADES_RELACOES_TRANSFORMACOES',
  GE: 'GEOGRAFIA', HI: 'HISTORIA', LI: 'LINGUA_INGLESA', LGG: 'LINGUAGENS', LP: 'LINGUA_PORTUGUESA', MA: 'MATEMATICA', MAT: 'MATEMATICA', TS: 'TRACOS_SONS_CORES_E_FORMAS',
};
const KNOWLEDGE_AREAS = {
  AR: 'LINGUAGENS', EF: 'LINGUAGENS', LI: 'LINGUAGENS', LP: 'LINGUAGENS', LGG: 'LINGUAGENS', MA: 'MATEMATICA', MAT: 'MATEMATICA',
  CI: 'CIENCIAS_DA_NATUREZA', CNT: 'CIENCIAS_DA_NATUREZA', GE: 'CIENCIAS_HUMANAS', HI: 'CIENCIAS_HUMANAS', CHS: 'CIENCIAS_HUMANAS',
  ER: 'ENSINO_RELIGIOSO', CO: 'COMPUTACAO', CG: 'EDUCACAO_INFANTIL', EO: 'EDUCACAO_INFANTIL', ET: 'EDUCACAO_INFANTIL', TS: 'EDUCACAO_INFANTIL',
};
const OPERATIONS = ['analisar', 'aplicar', 'avaliar', 'calcular', 'comparar', 'construir', 'compreender', 'distinguir', 'elaborar', 'explicar', 'identificar', 'interpretar', 'justificar', 'localizar', 'planejar', 'reconhecer', 'resolver', 'sintetizar', 'selecionar', 'relacionar', 'representar', 'rastrear', 'descrever', 'discutir', 'inferir', 'criar', 'experimentar', 'explorar', 'demonstrar', 'associar'];

function stableJson(value) {
  return JSON.stringify(value, (_key, current) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
    return Object.keys(current).sort().reduce((result, key) => { result[key] = current[key]; return result; }, {});
  });
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function normalize(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'); }
function descriptorFromCatalog(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  const nextCode = text.search(/\((?:EI\d{2}[A-Z]{2}\d{2}|EF(?:\d{2}|67)[A-Z]{2}\d{2}|EM13(?:LGG|CNT|CHS|MAT)\d{3}|EM13(?:LP|CO)\d{2})\)/);
  return (nextCode >= 0 ? text.slice(0, nextCode) : text).replace(/^[\s):.-]+/, '').trim().slice(0, 900);
}
function cognitiveOperation(descriptor) {
  const normalized = normalize(descriptor);
  return OPERATIONS.find((operation) => new RegExp(`\\b${operation}\\b`).test(normalized)) ?? null;
}
function contextDescriptor(node, semantic) {
  if (semantic?.descriptor?.trim()) return { text: semantic.descriptor.trim().slice(0, 900), source: 'SEMANTIC_CANDIDATE_EXCERPT' };
  return { text: descriptorFromCatalog(node.officialTextExcerpt), source: 'OFFICIAL_CATALOG_EXCERPT' };
}

export function buildContextIndex(catalog, semanticCandidates = { candidates: [] }) {
  const sourceById = new Map((catalog.sources ?? []).map((source) => [source.id, source]));
  const semanticByCode = new Map((semanticCandidates.candidates ?? []).map((item) => [item.officialCode, item]));
  const nodes = [...(catalog.nodes ?? [])].sort((left, right) => left.code.localeCompare(right.code));
  const structuralGroups = new Map();
  for (const node of nodes) {
    const key = [node.stage, node.gradeOrRange ?? 'UNSPECIFIED', node.componentCode ?? 'UNSPECIFIED'].join('|');
    const group = structuralGroups.get(key) ?? [];
    group.push(node.code);
    structuralGroups.set(key, group);
  }
  const indexedNodes = nodes.map((node) => {
    const source = sourceById.get(node.officialSource?.id);
    const descriptor = contextDescriptor(node, semanticByCode.get(node.code));
    const group = structuralGroups.get([node.stage, node.gradeOrRange ?? 'UNSPECIFIED', node.componentCode ?? 'UNSPECIFIED'].join('|')) ?? [];
    const position = group.indexOf(node.code);
    const neighborNodes = [group[position - 2], group[position - 1], group[position + 1], group[position + 2]].filter(Boolean);
    const componentLabel = node.stage === 'EDUCACAO_INFANTIL' && node.componentCode === 'EF'
      ? 'ESCUTA_FALA_PENSAMENTO_IMAGINACAO'
      : COMPONENT_LABELS[node.componentCode] ?? null;
    const knowledgeArea = node.stage === 'EDUCACAO_INFANTIL'
      ? 'EDUCACAO_INFANTIL'
      : KNOWLEDGE_AREAS[node.componentCode] ?? null;
    return {
      code: node.code, stage: node.stage, yearOrRange: node.gradeOrRange ?? null, kind: node.kind,
      component: { code: node.componentCode ?? null, label: componentLabel, knowledgeArea },
      officialContext: {
        descriptor: descriptor.text || null, descriptorSource: descriptor.source, thematicUnit: null, knowledgeObject: null,
        fieldOfExperience: node.stage === 'EDUCACAO_INFANTIL' ? componentLabel : null,
        cognitiveOperation: cognitiveOperation(descriptor.text), semanticContextStatus: descriptor.text ? 'EXCERPT_ONLY' : 'STRUCTURAL_ONLY',
      },
      parentNodes: [], childNodes: [], neighborNodes,
      officialPath: [node.stage, node.componentCode ?? 'UNSPECIFIED', node.gradeOrRange ?? 'UNSPECIFIED'],
      sourceProvenance: { artifactId: node.officialSource?.id ?? null, artifactFile: source?.file ?? null, documentVersion: node.officialSource?.documentVersion ?? null, url: node.officialSource?.url ?? null, page: node.officialSource?.page ?? null },
      contextAvailability: {
        descriptor: Boolean(descriptor.text), stage: Boolean(node.stage), yearOrRange: Boolean(node.gradeOrRange), component: Boolean(node.componentCode),
        thematicUnit: false, knowledgeObject: false, parentNodes: false, childNodes: false, neighborNodes: neighborNodes.length > 0,
      },
    };
  });
  const output = {
    schemaVersion: 'tec-escola.bncc.official-context-index.v1', catalogVersion: catalog.catalogVersion, catalogHash: catalog.catalogHash,
    sourceOfTruth: 'official_catalog_plus_versioned_semantic_excerpts', generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-04T00:00:00.000Z',
    contextContract: {
      semanticStatus: 'AVAILABLE_CONTEXT_ONLY', nullMeans: 'The frozen catalog does not expose this field; no semantic value is inferred.',
      hierarchyRule: 'Parent and child links remain empty until an official hierarchy artifact is available.',
      neighborRule: 'Neighbors share stage, year/range and component; adjacency is structural, not semantic equivalence.',
    },
    summary: {
      officialNodes: indexedNodes.length, nodesWithDescriptor: indexedNodes.filter((node) => node.contextAvailability.descriptor).length,
      nodesWithThematicUnit: 0, nodesWithKnowledgeObject: 0, nodesWithParentOrChild: 0,
      nodesWithStructuralNeighbors: indexedNodes.filter((node) => node.neighborNodes.length > 0).length,
    },
    nodes: indexedNodes,
  };
  return { ...output, contextHash: hash(stableJson({ ...output, generatedAt: undefined })) };
}

function run() {
  const catalogPath = path.resolve(root, process.argv[2] ?? 'content/bncc/official/catalog-2018.json');
  const semanticPath = path.resolve(root, process.argv[3] ?? 'content/bncc/mappings/semantic-candidates-2018.json');
  const outputPath = path.resolve(root, process.argv[4] ?? 'content/bncc/official/context-index.json');
  const output = buildContextIndex(JSON.parse(fs.readFileSync(catalogPath, 'utf8')), JSON.parse(fs.readFileSync(semanticPath, 'utf8')));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_CONTEXT_INDEX_OUTPUT=${path.relative(root, outputPath)}`);
  console.log(`BNCC_CONTEXT_INDEX_NODES=${output.summary.officialNodes}`);
  console.log(`BNCC_CONTEXT_INDEX_DESCRIPTORS=${output.summary.nodesWithDescriptor}`);
  console.log(`BNCC_CONTEXT_INDEX_HASH=${output.contextHash}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
