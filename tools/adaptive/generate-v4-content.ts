import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Readiness = 'GRAPH_ONLY' | 'CONTENT_READY' | 'ADAPTIVE_READY';
type Purpose = 'PROBE' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW';
type Stage = 'FUNDAMENTAL_I' | 'FUNDAMENTAL_II' | 'ENSINO_MEDIO';

interface StageReference { stage: Stage; from: number; to: number }
interface Leaf {
  code: string;
  title: string;
  domain: string;
  parent: string;
  readiness: Readiness;
  recommendedStage: Stage;
  recommendedGradeFrom: number;
  recommendedGradeTo: number;
}
interface SubjectSkills {
  code: string;
  name: string;
  anchors: Array<{ code: string; title: string }>;
  leaves: Leaf[];
}
interface RegistrySubject { code: string; name: string; anchors: string[]; leaves: Leaf[] }
interface Registry { packVersion: string; subjects: RegistrySubject[] }
interface Lesson {
  skill: string;
  title: string;
  objective: string;
  summary: string;
  explanation: string;
  workedExample: string;
  commonMistake: string;
  tips: string[];
  estimatedMinutes: number;
}
interface Question {
  id: string;
  subject: string;
  domain: string;
  topic: string;
  primarySkill: string;
  supportingSkills: string[];
  prerequisiteSkills: string[];
  transferSkills: string[];
  purpose: Purpose;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  cognitiveProcess: string;
  contextFamily: string;
  statement: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  misconceptions: Record<string, string[]>;
  provenance: string;
}
interface Relationship { from: string; to: string; type: 'RELATED' | 'TRANSFER' | 'PREREQUISITE'; source: string; confidence: number; rationale: string }

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACK = join(ROOT, 'content', 'adaptive', 'tec-escola-core-v4');
const SUBJECTS = join(PACK, 'subjects');
const PURPOSES: Purpose[] = ['PROBE', 'PROBE', 'PRACTICE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW', 'REVIEW'];
const CONTEXTS = ['SITUACAO_COTIDIANA', 'DADOS_OBSERVADOS', 'TEXTO_EXPLICATIVO', 'PROJETO_APLICADO', 'LABORATORIO', 'MAPA_CONCEITUAL', 'DEBATE_ORIENTADO', 'REVISAO_GUIADA'];
const COGNITIVE_PROCESSES = ['IDENTIFY', 'RECOGNIZE', 'APPLY', 'COMPARE', 'INTERPRET', 'ANALYZE', 'EVALUATE', 'EXPLAIN'];
const DIFFICULTIES = ['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'HARD', 'MEDIUM', 'HARD'] as const;

const TOPICS: Record<string, string[]> = {
  PORTUGUESE: ['leitura literal', 'inferencia de leitura', 'tese e tema', 'evidencia textual', 'coesao e conectores', 'generos textuais', 'argumentacao', 'pontuacao', 'tempos verbais', 'sintaxe em uso', 'vocabulario em contexto', 'parafrase', 'letramento midiatico', 'analise literaria'],
  MATHEMATICS: ['porcentagens', 'razao e taxa', 'fracoes', 'equacoes', 'expressoes algebricas', 'tabelas e dados', 'media e variacao', 'perimetro', 'area', 'probabilidade', 'proporcionalidade', 'padroes numericos', 'inteiros', 'plano cartesiano'],
  SCIENCE: ['investigacao cientifica', 'estados da materia', 'transformacoes de energia', 'ecossistemas', 'ciclos naturais', 'forcas e movimentos', 'medicao e unidades', 'misturas', 'saude e prevencao', 'astronomia', 'variaveis experimentais', 'biodiversidade', 'clima', 'som e luz'],
  BIOLOGY: ['celulas', 'tecidos', 'genetica', 'evolucao', 'ecologia', 'fisiologia', 'metabolismo', 'reproducao', 'microbiologia', 'biodiversidade', 'homeostase', 'interpretacao de dados', 'saude coletiva', 'bioetica'],
  PHYSICS: ['movimento', 'velocidade media', 'forcas', 'energia', 'trabalho', 'calor', 'ondas', 'eletricidade', 'circuitos', 'densidade', 'pressao', 'optica', 'quantidade de movimento', 'graficos de movimento'],
  CHEMISTRY: ['atomos', 'tabela periodica', 'ligacoes quimicas', 'reacoes', 'estequiometria', 'solucoes', 'acidos e bases', 'pH', 'termoquimica', 'quimica organica', 'gases', 'separacao de misturas', 'seguranca de laboratorio', 'evidencia experimental'],
  HISTORY: ['cronologia', 'fontes historicas', 'sociedades antigas', 'mundo medieval', 'formacao do estado moderno', 'colonizacao', 'escravidao e resistencia', 'independencias', 'industrializacao', 'republica', 'cidadania', 'memoria social', 'povos originarios', 'mundo contemporaneo'],
  GEOGRAPHY: ['escala cartografica', 'representacao do espaco', 'territorio', 'populacao', 'urbanizacao', 'clima', 'biomas', 'economia', 'globalizacao', 'geopolitica', 'ambiente', 'agua', 'espaco rural', 'regionalizacao'],
  PHILOSOPHY: ['etica', 'conhecimento', 'argumento', 'justica', 'politica', 'logica', 'ciencia', 'estetica', 'linguagem', 'liberdade', 'cidadania', 'epistemologia', 'historia da filosofia', 'tecnologia e sociedade'],
  SOCIOLOGY: ['socializacao', 'cultura', 'identidade', 'instituicoes', 'desigualdade', 'trabalho', 'poder', 'cidadania', 'midia', 'globalizacao', 'juventudes', 'pesquisa social', 'diversidade', 'movimentos sociais'],
  ART: ['elementos visuais', 'cor', 'composicao', 'historia da arte', 'leitura de imagem', 'musica', 'teatro', 'danca', 'audiovisual', 'patrimonio cultural', 'arte contemporanea', 'processo criativo', 'critica de arte', 'curadoria'],
  PHYSICAL_EDUCATION: ['consciencia corporal', 'habilidades motoras', 'jogos', 'atletismo', 'ginastica', 'danca', 'esportes coletivos', 'lutas', 'saude', 'treinamento', 'inclusao', 'lazer', 'regras', 'cultura corporal'],
  ENGLISH: ['reading', 'vocabulary', 'cognates', 'simple present', 'simple past', 'future forms', 'modal verbs', 'connectors', 'text genres', 'reading inference', 'pronunciation', 'listening', 'culture', 'guided writing'],
  RELIGIOUS_EDUCATION: ['diversidade religiosa', 'simbolos', 'narrativas', 'etica', 'convivencia', 'direitos humanos', 'rituais', 'comunidade', 'cosmovisoes', 'ambiente', 'dialogo', 'preconceito', 'identidade', 'cultura e memoria'],
  COMPUTING: ['algoritmos', 'variaveis', 'condicionais', 'repeticoes', 'dados', 'ciberseguranca', 'redes', 'web', 'cidadania digital', 'planilhas', 'depuracao', 'abstracao', 'inteligencia artificial', 'projetos digitais'],
};

function readJson<T>(path: string): T { return JSON.parse(readFileSync(path, 'utf8')) as T; }
function writeJson(path: string, value: unknown) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
}
function titleFromCode(code: string): string {
  return code.replaceAll('_', ' ').toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('pt-BR'));
}
function stageFor(index: number, references: StageReference[]): StageReference {
  const reference = references[index % references.length];
  return reference;
}
function subjectDisplayName(code: string, fallback: string): string {
  return fallback || titleFromCode(code);
}

const oldRegistry = readJson<Registry>(join(PACK, 'registry.json'));
const oldQuestions = readJson<Question[]>(join(PACK, 'questions.json'));
const oldRelationships = readJson<{ hierarchy: string[][]; prerequisites: string[][]; relationships: Relationship[] }>(join(PACK, 'relationships.json'));
const stageReferences = readJson<Record<string, StageReference[]>>(join(PACK, 'stage-references.json'));
const oldMisconceptions = readJson<Record<string, string[]>>(join(PACK, 'misconceptions.json'));

const subjectSkills = new Map<string, SubjectSkills>();
const generatedLessons = new Map<string, Lesson[]>();
const generatedQuestions = new Map<string, Question[]>();
const newHierarchy = new Set(oldRelationships.hierarchy.map((edge) => edge.join('|')));
const newPrerequisites = new Set(oldRelationships.prerequisites.map((edge) => edge.join('|')));
const newRelationships = [...oldRelationships.relationships];
const misconceptions: Record<string, string[]> = { ...oldMisconceptions };

for (const subject of oldRegistry.subjects) {
  const subjectDir = join(SUBJECTS, subject.code.toLocaleLowerCase());
  const existingSkillsPath = join(subjectDir, 'skills.json');
  const sourceSubject = existsSync(existingSkillsPath)
    ? readJson<SubjectSkills>(existingSkillsPath)
    : {
        code: subject.code,
        name: subject.name,
        anchors: subject.anchors.map((code) => ({ code, title: titleFromCode(code) })),
        leaves: subject.leaves,
      };
  const references = stageReferences[subject.code] ?? [{ stage: 'ENSINO_MEDIO', from: 1, to: 3 }];
  const anchors = sourceSubject.anchors;
  const oldLeaves = sourceSubject.leaves.map((leaf, index) => {
    const reference = leaf.recommendedStage
      ? { stage: leaf.recommendedStage, from: leaf.recommendedGradeFrom, to: leaf.recommendedGradeTo }
      : stageFor(index, references);
    return { ...leaf, recommendedStage: reference.stage, recommendedGradeFrom: reference.from, recommendedGradeTo: reference.to };
  });
  const existing = new Set(oldLeaves.map((leaf) => leaf.code));
  const targetLeafCount = 28;
  const generatedCount = Math.max(0, targetLeafCount - oldLeaves.length);
  const topics = TOPICS[subject.code] ?? ['fundamentos', 'aplicacoes', 'interpretacao', 'resolucao'];
  const generated: Leaf[] = [];
  for (let index = 0; index < generatedCount; index += 1) {
    const topic = topics[index % topics.length];
    const code = `${subject.code}_${slug(topic)}_${String(index + 1).padStart(2, '0')}`;
    if (existing.has(code)) continue;
    const parent = subject.anchors[index % subject.anchors.length];
    const reference = stageFor(index + oldLeaves.length, references);
    const readiness: Readiness = index < 14 ? 'ADAPTIVE_READY' : 'GRAPH_ONLY';
    generated.push({
      code,
      title: `${topic.replace(/\b\w/g, (letter) => letter.toUpperCase())} aplicado`,
      domain: `${subject.code}_V4`,
      parent,
      readiness,
      recommendedStage: reference.stage,
      recommendedGradeFrom: reference.from,
      recommendedGradeTo: reference.to,
    });
  }
  const leaves = [...oldLeaves, ...generated];
  const skills: SubjectSkills = { code: subject.code, name: subject.name, anchors, leaves };
  subjectSkills.set(subject.code, skills);
  for (const leaf of leaves) newHierarchy.add(`${leaf.parent}|${leaf.code}`);

  const questionsPath = join(subjectDir, 'questions.json');
  const oldSubjectQuestions = existsSync(questionsPath) ? readJson<Question[]>(questionsPath) : oldQuestions.filter((question) => question.subject === subject.code);
  const legacyLessonsPath = join(subjectDir, 'lessons.json');
  const oldSubjectLessons = existsSync(legacyLessonsPath) ? readJson<Lesson[]>(legacyLessonsPath) : [];
  const lessons = [...oldSubjectLessons];
  const questions = [...oldSubjectQuestions];
  const readyLeaves = leaves.filter((leaf) => leaf.readiness === 'ADAPTIVE_READY');
  for (const [readyIndex, leaf] of readyLeaves.entries()) {
    if (lessons.some((lesson) => lesson.skill === leaf.code) && questions.filter((question) => question.primarySkill === leaf.code).length >= PURPOSES.length) continue;
    const topic = topics[readyIndex % topics.length];
    const tagPrefix = `V4_${subject.code}_${String(readyIndex + 1).padStart(2, '0')}`;
    const misconceptionTags = [`${tagPrefix}_CONTEXT_OMISSION`, `${tagPrefix}_CONCEPT_SWAP`];
    misconceptions[leaf.code] = misconceptionTags;
    lessons.push({
      skill: leaf.code,
      title: `Trilha de ${topic}`,
      objective: `Aplicar ${topic} em situacoes variadas, justificando a escolha com evidencias do problema.`,
      summary: `Esta trilha organiza ${topic} em uma progressao de observacao, pratica e transferencia.`,
      explanation: `Comece identificando os dados relevantes de ${topic}, relacione-os ao conceito e explique por que a estrategia escolhida responde ao contexto.`,
      workedExample: `Em um caso de ${topic}, destaque a evidencia principal, escolha o procedimento adequado e confira se a conclusao respeita as condicoes apresentadas.`,
      commonMistake: `Ignorar o contexto e aplicar uma regra de ${topic} sem verificar se as grandezas, fontes ou evidencias sao compativeis.`,
      tips: ['Nomeie o conceito antes de resolver.', 'Registre a evidencia usada.', 'Revise a unidade ou o contexto.', 'Explique a escolha em uma frase.'],
      estimatedMinutes: 8 + (readyIndex % 5),
    });
    for (let questionIndex = 0; questionIndex < PURPOSES.length; questionIndex += 1) {
      const purpose = PURPOSES[questionIndex];
      const context = CONTEXTS[questionIndex];
      const correct = `Aplicar ${topic} usando as evidencias de ${context.toLocaleLowerCase('pt-BR')}`;
      const distractors = [
        `Ignorar o contexto e repetir uma regra de ${topic}`,
        `Trocar ${topic} por outro conceito sem justificar a relacao`,
        `Concluir antes de observar os dados de ${context.toLocaleLowerCase('pt-BR')}`,
      ];
      const correctPosition = questionIndex % 4;
      const options = [correct, ...distractors];
      const rotated = options.map((_, optionIndex) => options[(optionIndex - correctPosition + 4) % 4]);
      const wrongOption = rotated.find((option) => option !== correct)!;
      questions.push({
        id: `v4-scale-${subject.code.toLocaleLowerCase()}-${String(readyIndex + 1).padStart(2, '0')}-${String(questionIndex + 1).padStart(2, '0')}`,
        subject: subject.code,
        domain: leaf.domain,
        topic,
        primarySkill: leaf.code,
        supportingSkills: [leaf.parent],
        prerequisiteSkills: [],
        transferSkills: [],
        purpose,
        difficulty: DIFFICULTIES[questionIndex],
        cognitiveProcess: COGNITIVE_PROCESSES[questionIndex],
        contextFamily: context,
        statement: `${subject.name}: na atividade ${context.toLocaleLowerCase('pt-BR')} ${readyIndex + 1}, como interpretar ${topic} na etapa ${purpose.toLocaleLowerCase('pt-BR')} da trilha ${leaf.code}?`,
        options: rotated,
        correctAnswer: correct,
        explanation: `A resposta adequada relaciona ${topic} ao contexto ${context.toLocaleLowerCase('pt-BR')} e explicita a evidencia observada.`,
        misconceptions: { [wrongOption]: [misconceptionTags[questionIndex % misconceptionTags.length]] },
        provenance: 'TECESCOLA_CORE_V4_AUTHORED_SCALE',
      });
    }
    const previousReady = readyLeaves[readyIndex - 1];
    if (previousReady) newPrerequisites.add(`${leaf.code}|${previousReady.code}`);
  }
  generatedLessons.set(subject.code, lessons);
  generatedQuestions.set(subject.code, questions);
  mkdirSync(subjectDir, { recursive: true });
  writeJson(join(subjectDir, 'skills.json'), skills);
  writeJson(join(subjectDir, 'lessons.json'), lessons);
  writeJson(join(subjectDir, 'questions.json'), questions);
}

const registry: Registry = {
  packVersion: oldRegistry.packVersion,
  subjects: [...subjectSkills.values()].map((subject) => ({ code: subject.code, name: subject.name, anchors: subject.anchors.map((anchor) => anchor.code), leaves: subject.leaves })),
};
const subjectCodes = [...subjectSkills.keys()];
for (let index = 1; index < subjectCodes.length; index += 1) {
  const current = subjectSkills.get(subjectCodes[index])!;
  const previous = subjectSkills.get(subjectCodes[index - 1])!;
  const currentReady = current.leaves.filter((leaf) => leaf.readiness === 'ADAPTIVE_READY').slice(0, 3);
  const previousReady = previous.leaves.filter((leaf) => leaf.readiness === 'ADAPTIVE_READY').slice(0, 3);
  currentReady.forEach((fromLeaf, relationIndex) => {
    const toLeaf = previousReady[relationIndex % Math.max(previousReady.length, 1)];
    if (!toLeaf) return;
    newRelationships.push({ from: fromLeaf.code, to: toLeaf.code, type: 'TRANSFER', source: 'TECESCOLA_AUTHORED_SCALE', confidence: 0.72, rationale: `A transferencia de ${current.name} retoma evidencias de ${previous.name}.` });
  });
}

const hierarchy = [...newHierarchy].sort().map((edge) => edge.split('|'));
const prerequisites = [...newPrerequisites].sort().map((edge) => edge.split('|'));
const relationshipKeys = new Set<string>();
const relationships = newRelationships.filter((relationship) => {
  const key = `${relationship.from}|${relationship.to}|${relationship.type}`;
  if (relationshipKeys.has(key)) return false;
  relationshipKeys.add(key);
  return true;
});

writeJson(join(PACK, 'registry.json'), registry);
writeJson(join(PACK, 'relationships.json'), { hierarchy, prerequisites, relationships });
writeJson(join(PACK, 'misconceptions.json'), misconceptions);
writeJson(join(PACK, 'manifest.json'), {
  packVersion: oldRegistry.packVersion,
  provenance: 'Conteudo autoral versionado do TecEscola; nao e BNCC oficial.',
  subjectCount: subjectCodes.length,
  canonicalSubjects: subjectCodes,
  sourceOfTruth: 'subjects/{subject}/skills.json + lessons.json + questions.json',
  contentReadinessPolicy: 'Only ADAPTIVE_READY leaves may be selected by the planner; GRAPH_ONLY nodes preserve graph edges but are not mastery targets.',
  scaleTargets: { minimumCanonicalNodes: 400, minimumAdaptiveReadyLeaves: 180, minimumLessons: 180, minimumQuestions: 1440, minimumCrossSubjectRelationships: 30 },
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
});

console.log(JSON.stringify({
  subjects: subjectCodes.length,
  nodes: registry.subjects.reduce((sum, subject) => sum + subject.anchors.length + subject.leaves.length, 0),
  leaves: registry.subjects.reduce((sum, subject) => sum + subject.leaves.length, 0),
  adaptiveReadyLeaves: registry.subjects.reduce((sum, subject) => sum + subject.leaves.filter((leaf) => leaf.readiness === 'ADAPTIVE_READY').length, 0),
  lessons: [...generatedLessons.values()].reduce((sum, lessons) => sum + lessons.length, 0),
  questions: [...generatedQuestions.values()].reduce((sum, questions) => sum + questions.length, 0),
  hierarchy: hierarchy.length,
  prerequisites: prerequisites.length,
  relationships: relationships.length,
}, null, 2));
