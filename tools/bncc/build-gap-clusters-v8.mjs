import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const COMPONENT_SUBJECTS = { AR: 'ARTE', CG: 'EDUCACAO_INFANTIL', CHS: 'CIENCIAS_HUMANAS', CI: 'CIENCIAS', CNT: 'CIENCIAS_NATUREZA', CO: 'COMPUTACAO', EF: 'EDUCACAO_FISICA', EO: 'EDUCACAO_INFANTIL', ER: 'ENSINO_RELIGIOSO', ET: 'EDUCACAO_INFANTIL', GE: 'GEOGRAFIA', HI: 'HISTORIA', LI: 'LINGUA_INGLESA', LGG: 'LINGUAGENS', LP: 'LINGUA_PORTUGUESA', MA: 'MATEMATICA', MAT: 'MATEMATICA', TS: 'EDUCACAO_INFANTIL' };
const OPERATIONS = ['analisar', 'aplicar', 'avaliar', 'calcular', 'comparar', 'construir', 'compreender', 'distinguir', 'elaborar', 'explicar', 'identificar', 'interpretar', 'justificar', 'localizar', 'planejar', 'reconhecer', 'resolver', 'sintetizar', 'selecionar', 'relacionar', 'representar', 'rastrear', 'descrever', 'discutir', 'inferir', 'criar', 'experimentar', 'explorar', 'demonstrar', 'associar'];
const STOP_WORDS = new Set('a ao aos as com como da das de do dos e em entre para por que na nas no nos o os ou se sem sobre um uma umas uns seu sua seus suas pelo pela'.split(' '));
const TOPIC_FAMILIES = {
  MA: [
    ['NUMBERS_QUANTITY', ['numero', 'quantidade', 'contar', 'calculo', 'operacao', 'adicao', 'subtracao', 'multiplicacao', 'divisao', 'fracao', 'decimal', 'porcentagem', 'razao', 'proporcional']],
    ['GEOMETRY_MEASUREMENT', ['forma', 'figura', 'geometr', 'angulo', 'poligono', 'plano', 'medida', 'comprimento', 'area', 'volume', 'simetria']],
    ['PATTERNS_ALGEBRA', ['padrao', 'sequencia', 'regularidade', 'igualdade', 'equacao', 'expressao', 'variavel', 'funcao']],
    ['DATA_PROBABILITY', ['dado', 'tabela', 'grafico', 'estatistica', 'probabilidade', 'chance']],
  ],
  MAT: [],
  CI: [
    ['MATTER_TRANSFORMATIONS', ['materia', 'material', 'mistura', 'substancia', 'transformacao', 'propriedade', 'quimic']],
    ['LIFE_HEALTH', ['celula', 'corpo', 'organismo', 'seres', 'saude', 'sistema', 'higiene', 'visao']],
    ['EARTH_ENVIRONMENT', ['planeta', 'terra', 'ambiente', 'natureza', 'clima', 'agua', 'solo', 'astronom', 'universo']],
  ],
  CNT: [['MATTER_TRANSFORMATIONS', ['materia', 'material', 'mistura', 'substancia', 'transformacao', 'quimic']], ['LIFE_HEALTH', ['celula', 'corpo', 'organismo', 'saude']], ['EARTH_ENVIRONMENT', ['planeta', 'terra', 'ambiente', 'clima', 'agua', 'solo', 'astronom']]],
  LP: [['TEXT_LANGUAGE', ['texto', 'linguagem', 'palavra', 'frase', 'leitura', 'escrita', 'genero', 'literatura', 'narrativa', 'oralidade']],
    ['MEDIA_COMMUNICATION', ['midia', 'comunicacao', 'digital', 'informacao', 'publicidade', 'noticia']]],
  LGG: [['TEXT_LANGUAGE', ['texto', 'linguagem', 'palavra', 'frase', 'leitura', 'escrita', 'literatura', 'narrativa']], ['MEDIA_COMMUNICATION', ['midia', 'comunicacao', 'digital', 'informacao']]],
  AR: [['ARTS_CREATION', ['arte', 'musica', 'danca', 'teatro', 'imagem', 'obra', 'expressao', 'visual', 'som']],
    ['CULTURAL_CONTEXT', ['cultura', 'patrimonio', 'tradicao', 'artista']]],
  EF: [['BODY_MOVEMENT', ['corpo', 'movimento', 'jogo', 'esporte', 'brincadeira', 'danca', 'ginastica', 'luta']], ['HEALTH_LIFESTYLE', ['saude', 'qualidade', 'vida', 'exercicio']]],
  GE: [['SPACE_TERRITORY', ['espaco', 'territorio', 'paisagem', 'lugar', 'cartograf', 'mapa', 'cidade', 'campo', 'geograf']], ['ENVIRONMENT_SOCIETY', ['ambiente', 'natureza', 'clima', 'populacao', 'sociedade']]],
  HI: [['HISTORY_TIME_SOURCES', ['historia', 'tempo', 'passado', 'fonte', 'periodo', 'patrimonio']], ['SOCIETY_CULTURE', ['sociedade', 'cultura', 'trabalho', 'poder', 'politica']]],
  CHS: [['SOCIETY_CULTURE', ['sociedade', 'cultura', 'trabalho', 'poder', 'politica', 'territorio']], ['HISTORY_TIME_SOURCES', ['historia', 'tempo', 'passado', 'fonte']]],
  ER: [['RELIGION_SYMBOLS', ['relig', 'simbolo', 'rito', 'crenca', 'divindade', 'sagrado', 'espiritualidade']]],
  CO: [['COMPUTING_ALGORITHMS_DATA', ['algoritmo', 'comput', 'codigo', 'informacao', 'dado', 'tecnologia', 'digital', 'program']],
    ['SYSTEMS_PROBLEM_SOLVING', ['problema', 'sistema', 'sequencia', 'solucao', 'processo']]],
  LI: [['LANGUAGE_COMMUNICATION', ['lingua', 'ingles', 'texto', 'palavra', 'comunicacao', 'leitura', 'escrita']]],
};
TOPIC_FAMILIES.MAT = TOPIC_FAMILIES.MA;
function stableJson(value) { return JSON.stringify(value, (_key, current) => { if (!current || typeof current !== 'object' || Array.isArray(current)) return current; return Object.keys(current).sort().reduce((result, key) => { result[key] = current[key]; return result; }, {}); }); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function normalize(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'); }
function cognitiveOperation(descriptor) { const normalized = normalize(descriptor); return OPERATIONS.find((operation) => new RegExp(`\\b${operation}\\b`).test(normalized)) ?? 'UNSPECIFIED'; }
function semanticObject(descriptor, operation, componentCode) {
  const normalized = normalize(descriptor);
  const family = (TOPIC_FAMILIES[componentCode] ?? []).find(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)));
  if (family) return family[0];
  const tokens = normalized.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const meaningful = tokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token) && token !== operation);
  return meaningful.slice(0, 2).join('_').toUpperCase() || 'UNSPECIFIED';
}

export function buildGapClustersV8(candidates, semanticCandidates, contextIndex) {
  const semanticByCode = new Map((semanticCandidates.candidates ?? []).map((item) => [item.officialCode, item]));
  const contextByCode = new Map((contextIndex.nodes ?? []).map((item) => [item.code, item]));
  const groups = new Map();
  for (const candidate of (candidates.candidates ?? []).filter((item) => item.mappingType === 'CANONICAL_GAP')) {
    const semantic = semanticByCode.get(candidate.officialCode);
    const context = contextByCode.get(candidate.officialCode);
    const descriptor = semantic?.descriptor ?? context?.officialContext?.descriptor ?? '';
    const operation = context?.officialContext?.cognitiveOperation ?? cognitiveOperation(descriptor);
    const object = semanticObject(descriptor, operation, candidate.componentCode);
    const key = [candidate.stage, candidate.gradeOrRange ?? 'UNSPECIFIED', candidate.componentCode ?? 'UNSPECIFIED', operation, object].join('|');
    const group = groups.get(key) ?? { clusterKey: key, officialCodes: [], stage: candidate.stage, gradeRange: candidate.gradeOrRange ?? 'UNSPECIFIED', componentCode: candidate.componentCode ?? 'UNSPECIFIED', subject: COMPONENT_SUBJECTS[candidate.componentCode] ?? 'REVIEW_REQUIRED', operation, object, currentCandidates: [], contexts: [] };
    group.officialCodes.push(candidate.officialCode);
    for (const suggestion of semantic?.candidates ?? []) group.currentCandidates.push({ officialCode: candidate.officialCode, canonicalSkillCode: suggestion.canonicalSkillCode, confidence: suggestion.confidence, score: suggestion.score });
    if (context) group.contexts.push(context);
    groups.set(key, group);
  }
  const clusters = [...groups.values()].sort((left, right) => left.clusterKey.localeCompare(right.clusterKey)).map((group) => {
    const contexts = group.contexts;
    const sourcePages = [...new Set(contexts.map((context) => context.sourceProvenance.page).filter(Boolean))].sort((a, b) => a - b);
    const sourceArtifacts = [...new Set(contexts.map((context) => context.sourceProvenance.artifactId).filter(Boolean))].sort();
    const descriptorSamples = [...new Set(contexts.map((context) => context.officialContext.descriptor).filter(Boolean))].slice(0, 3);
    const semanticCandidateSkills = [...new Set(group.currentCandidates.map((item) => item.canonicalSkillCode).filter(Boolean))].sort();
    const identity = [group.stage, group.gradeRange, group.componentCode, group.operation, group.object].join('|');
    return {
      clusterId: `V8_GAP_${identity.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`,
      officialCodes: [...new Set(group.officialCodes)].sort(), stage: group.stage, gradeRange: group.gradeRange, component: group.componentCode, subject: group.subject,
      domain: null, subdomain: null, semanticObject: group.object, cognitiveOperation: group.operation,
      officialContext: { knowledgeArea: contexts[0]?.component?.knowledgeArea ?? null, thematicUnit: null, knowledgeObject: null, fieldOfExperience: contexts[0]?.officialContext?.fieldOfExperience ?? null, officialPath: contexts[0]?.officialPath ?? [], sourceArtifacts, sourcePages, descriptorSamples, structuralNeighborCount: contexts.reduce((total, context) => total + context.neighborNodes.length, 0), contextStatus: 'AVAILABLE_STRUCTURAL_CONTEXT_WITH_EXCERPT' },
      currentCandidates: group.currentCandidates.sort((left, right) => `${left.officialCode}:${left.canonicalSkillCode}`.localeCompare(`${right.officialCode}:${right.canonicalSkillCode}`)), semanticCandidateSkills,
      rationale: 'Cluster semântico determinístico por etapa, ano, componente, operação cognitiva e objeto textual; não cria skill nem afirma equivalência BNCC.', confidence: 'LOW', reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', promotionStatus: 'NOT_PROMOTED',
    };
  });
  const output = {
    schemaVersion: 'tec-escola.bncc.canonical-gaps.v8', catalogVersion: candidates.catalogVersion, catalogHash: candidates.catalogHash, contextHash: contextIndex.contextHash,
    sourceOfTruth: 'official_context_index_plus_mapping_candidates_plus_scoped_semantic_candidates', generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-04T00:00:00.000Z',
    statusContract: { gapStatus: 'CANONICAL_GAP_REVIEW_REQUIRED', reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', promotionRule: 'Clusters organizam propostas independentes; nenhum cluster promove uma skill ou um mapeamento.' },
    summary: { officialGapCodes: clusters.reduce((total, cluster) => total + cluster.officialCodes.length, 0), gapClusters: clusters.length, contextualizedClusters: clusters.filter((cluster) => cluster.semanticObject !== 'UNSPECIFIED').length, unresolvedSemanticObjectClusters: clusters.filter((cluster) => cluster.semanticObject === 'UNSPECIFIED').length, clustersWithSemanticSignals: clusters.filter((cluster) => cluster.currentCandidates.length > 0).length, promoted: 0 },
    clusters,
  };
  return { ...output, gapsHash: hash(stableJson({ ...output, generatedAt: undefined })) };
}

function run() {
  const candidatesPath = path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/candidates-2018.json');
  const semanticPath = path.resolve(root, process.argv[3] ?? 'content/bncc/mappings/semantic-candidates-2018.json');
  const contextPath = path.resolve(root, process.argv[4] ?? 'content/bncc/official/context-index.json');
  const outputPath = path.resolve(root, process.argv[5] ?? 'content/bncc/canonical/clusters-v8.json');
  const output = buildGapClustersV8(JSON.parse(fs.readFileSync(candidatesPath, 'utf8')), JSON.parse(fs.readFileSync(semanticPath, 'utf8')), JSON.parse(fs.readFileSync(contextPath, 'utf8')));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_V8_CLUSTERS_OUTPUT=${path.relative(root, outputPath)}`); console.log(`BNCC_V8_GAP_CLUSTERS=${output.summary.gapClusters}`); console.log(`BNCC_V8_GAP_CODES=${output.summary.officialGapCodes}`); console.log(`BNCC_V8_CONTEXTUALIZED_CLUSTERS=${output.summary.contextualizedClusters}`); console.log(`BNCC_V8_GAP_HASH=${output.gapsHash}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
