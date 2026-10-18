import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildScienceHumanDiversityPack } from '../adaptive/build-science-human-diversity-v5.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_PATH = 'content/bncc/authoring/source-verification-v2.json';
const OFFICIAL_CODE = 'EF01CI04';
const OUTPUT = 'content/adaptive/tec-escola-core-v5/v1-science-human-diversity-fi.json';

const additionalQuestions = [
  {
    id: 'v1-science-diversity-transfer-08', purpose: 'TRANSFER', difficulty: 'MEDIUM', cognitiveProcess: 'COMPARE', contextFamily: 'NEW_SHARED_GAME',
    statement: 'Duas personagens têm aparências diferentes e escolhem participar da mesma brincadeira. Qual frase usa as evidências da história?',
    correctAnswer: 'Elas têm características diferentes e escolheram a mesma brincadeira.',
    options: ['Elas têm características diferentes e escolheram a mesma brincadeira.', 'A aparência decide quem deve comandar.', 'A personagem mais alta brinca melhor.', 'Todas as pessoas parecidas escolhem a mesma brincadeira.'],
    explanation: 'A história mostra uma diferença observável e uma escolha compartilhada, mas não cria ranking nem regra para grupos.',
    hint: 'Separe o que a cena mostra do que seria uma generalização.',
    errorFocus: 'GENERALIZE_APPEARANCE_OR_ASSIGN_VALUE',
  },
  {
    id: 'v1-science-diversity-lock-06', purpose: 'LOCK_IN', difficulty: 'HARD', cognitiveProcess: 'RESPOND', contextFamily: 'NEW_EXCLUSION_REPAIR',
    statement: 'Um colega é deixado fora de uma atividade por causa de uma característica física. Qual ação ajuda a reparar a situação?',
    correctAnswer: 'Interromper a exclusão, convidar sem pressionar e pedir apoio ao educador.',
    options: ['Interromper a exclusão, convidar sem pressionar e pedir apoio ao educador.', 'Dizer que a pessoa precisa mudar sua aparência.', 'Pedir que ela prove que consegue participar.', 'Fazer uma piada para chamar atenção para o caso.'],
    explanation: 'Acolhimento envolve remover a exclusão, oferecer escolha e buscar mediação; não exige que a pessoa se prove ou se exponha.',
    hint: 'Pense em segurança, escolha e apoio, não em culpa da pessoa excluída.',
    errorFocus: 'BLAME_TARGET_OR_DEMAND_PROOF',
  },
  {
    id: 'v1-science-diversity-review-10', purpose: 'REVIEW', difficulty: 'MEDIUM', cognitiveProcess: 'DISTINGUISH', contextFamily: 'NEW_VISIBLE_AND_UNKNOWN',
    statement: 'Um cartão fictício mostra uma personagem com cabelo cacheado segurando uma bola. O que continua desconhecido?',
    correctAnswer: 'Se ela prefere jogar bola ou como é sua personalidade.',
    options: ['Se ela prefere jogar bola ou como é sua personalidade.', 'Que o cartão mostra cabelo cacheado.', 'Que existe uma bola na cena.', 'Que há uma personagem no cartão.'],
    explanation: 'A imagem apresenta características e objetos visíveis, mas não prova preferências ou personalidade.',
    hint: 'Diferencie presença de um objeto de intenção ou gosto.',
    errorFocus: 'INFER_PREFERENCE_FROM_OBJECT',
  },
  {
    id: 'v1-science-diversity-probe-04', purpose: 'PROBE', difficulty: 'EASY', cognitiveProcess: 'DESCRIBE', contextFamily: 'NEW_RESPECTFUL_DESCRIPTION',
    statement: 'Qual frase descreve duas personagens sem dizer que uma vale mais do que a outra?',
    correctAnswer: 'Uma usa óculos e a outra usa um chapéu; ambas estão lendo.',
    options: ['Uma usa óculos e a outra usa um chapéu; ambas estão lendo.', 'A personagem de óculos é mais inteligente.', 'O chapéu mostra quem é mais importante.', 'A personagem sem acessório não consegue ler.'],
    explanation: 'A resposta nomeia elementos e uma ação observável, sem inferir valor ou capacidade.',
    hint: 'Escolha a frase que fica no que o desenho realmente apresenta.',
    errorFocus: 'RANK_OR_INFER_CAPACITY',
  },
  {
    id: 'v1-science-diversity-practice-12', purpose: 'PRACTICE', difficulty: 'MEDIUM', cognitiveProcess: 'PLAN', contextFamily: 'NEW_VOLUNTARY_PARTICIPATION',
    statement: 'A turma quer estudar diversidade usando personagens inventados. Qual plano protege a participação?',
    correctAnswer: 'Oferecer cartões fictícios, permitir passar a vez e avaliar a descrição da história.',
    options: ['Oferecer cartões fictícios, permitir passar a vez e avaliar a descrição da história.', 'Pedir fotos dos estudantes para comparar corpos.', 'Escolher a pessoa mais diferente para explicar sua aparência.', 'Dar nota ao retrato considerado mais bonito.'],
    explanation: 'Personagens fictícios e participação voluntária permitem aprender sem coletar imagens, ranquear corpos ou exigir exposição.',
    hint: 'Procure a proposta que mantém o foco no material fictício e respeita limites pessoais.',
    errorFocus: 'FORCED_DISCLOSURE_OR_BODY_RANKING',
  },
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function buildPack() {
  const source = readJson(SOURCE_PATH).records.find((record) => record.officialCode === OFFICIAL_CODE);
  if (!source) throw new Error(`SOURCE_VERIFICATION_NOT_FOUND:${OFFICIAL_CODE}`);
  const pack = structuredClone(buildScienceHumanDiversityPack());
  pack.contentId = 'v1-science-human-diversity-fi';
  pack.expectedQuestionCount = 40;
  pack.expectedContextCount = 40;
  pack.expectedPurposeCounts = { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 };
  pack.publicationStatus = 'STAGING_INACTIVE';
  pack.active = false;
  pack.sourceContext = {
    officialCode: source.officialCode,
    relation: 'AUTHORING_CONTEXT_ONLY',
    mappingStatus: source.mappingStatus,
    sourceStatus: source.technicalVerificationStatus,
    descriptor: source.descriptor,
    officialSource: source.officialSource,
    note: 'Conteúdo autoral contextualizado para EF01CI04; o mapeamento canônico e a revisão pedagógica continuam pendentes.',
  };
  pack.sourceReconciliation = {
    sourceQuestionCount: 0,
    feedbackAdded: 0,
    sourceReconciliationStatus: 'ORIGINAL_AUTHORING_CONTEXT_WITH_FIVE_ADDITIONAL_ITEMS',
    newQuestions: 40,
    reusedQuestionsCountedAsNew: false,
  };
  pack.questions = [...pack.questions, ...additionalQuestions.map((question) => ({
    ...question,
    misconceptions: Object.fromEntries(question.options.slice(1).map((option) => [option, [question.errorFocus]])),
  }))];
  pack.lesson.progression = pack.lesson.progression.map((stage) => ({ ...stage, questionIds: stage.questionIds ?? [] }));
  pack.lesson.progression.find((stage) => stage.stage === 'FOUNDATION').questionIds.push('v1-science-diversity-probe-04');
  pack.lesson.progression.find((stage) => stage.stage === 'APPLICATION').questionIds.push('v1-science-diversity-practice-12');
  pack.lesson.progression.find((stage) => stage.stage === 'TRANSFER').questionIds.push('v1-science-diversity-transfer-08');
  pack.lesson.progression.find((stage) => stage.stage === 'INTEGRATION').questionIds.push('v1-science-diversity-lock-06');
  pack.lesson.progression.find((stage) => stage.stage === 'SPACED_REVIEW_CANDIDATE').questionIds.push('v1-science-diversity-review-10');
  return pack;
}

function validatePack(pack) {
  const errors = [];
  if (pack.sourceContext?.officialCode !== OFFICIAL_CODE) errors.push('SOURCE_CONTEXT_CODE_INVALID');
  if (pack.sourceContext?.relation !== 'AUTHORING_CONTEXT_ONLY') errors.push('AUTHORING_RELATION_INVALID');
  if (pack.officialMappingStatus !== 'NOT_CLAIMED') errors.push('MAPPING_MUST_REMAIN_UNCLAIMED');
  if (pack.publicationStatus !== 'STAGING_INACTIVE' || pack.active !== false) errors.push('PUBLICATION_MUST_REMAIN_INACTIVE');
  const ids = new Set();
  const contexts = new Set();
  for (const question of pack.questions ?? []) {
    if (ids.has(question.id)) errors.push(`DUPLICATE_ID:${question.id}`);
    ids.add(question.id);
    if (contexts.has(question.contextFamily)) errors.push(`DUPLICATE_CONTEXT:${question.contextFamily}`);
    contexts.add(question.contextFamily);
    if (!Array.isArray(question.options) || question.options.length !== 4 || new Set(question.options).size !== 4 || !question.options.includes(question.correctAnswer)) errors.push(`OPTIONS_INVALID:${question.id}`);
    if (!question.statement || !question.explanation || !question.hint || !question.errorFocus) errors.push(`FEEDBACK_INCOMPLETE:${question.id}`);
  }
  if (pack.questions.length !== 40 || contexts.size !== 40) errors.push(`QUESTION_OR_CONTEXT_COUNT:${pack.questions.length}:${contexts.size}`);
  if (!pack.lesson?.title || !pack.lesson?.objective || !pack.lesson?.explanation || pack.lesson.authenticActivities?.length < 1) errors.push('LESSON_OR_ACTIVITY_INCOMPLETE');
  return { valid: errors.length === 0, errors, questionCount: pack.questions.length, contextCount: contexts.size };
}

export function buildEf01Ci04Pack() { return buildPack(); }
export function validateEf01Ci04Pack(pack) { return validatePack(pack); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pack = buildPack();
  const validation = validatePack(pack);
  if (!validation.valid) throw new Error(`EF01CI04_PACK_INVALID:${validation.errors.join(',')}`);
  fs.writeFileSync(path.join(ROOT, OUTPUT), `${JSON.stringify(pack, null, 2)}\n`);
  console.log(JSON.stringify({ ...validation, output: OUTPUT, publicationStatus: pack.publicationStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2));
}
