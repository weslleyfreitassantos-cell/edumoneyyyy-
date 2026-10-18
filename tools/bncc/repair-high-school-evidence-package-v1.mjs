import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateCurriculumPackageRubric } from './curriculum-package-rubric.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE_PATH = 'content/adaptive/tec-escola-core-v5/humanities-evidence-arguments-hs-v8.json';
const SOURCE_PATH = 'content/bncc/authoring/source-verification-v2.json';
const REPORT_PATH = 'content/bncc/authoring/high-school-evidence-recovery-v1.json';
const SOURCE_URL = 'https://basenacionalcomum.mec.gov.br/images/historico/BNCC_EnsinoMedio_embaixa_site_110518.pdf';
const DESCRIPTOR = 'Elaborar hipóteses, selecionar evidências e compor argumentos relativos a processos políticos, econômicos, sociais, ambientais, culturais e epistemológicos, com base na sistematização de dados e informações de natureza qualitativa e quantitativa (expressões artísticas, textos filosóficos e sociológicos, documentos históricos, gráficos, mapas, tabelas etc.).';
const PHASES = [
  ['PROBE', 'Distinguir afirmação, hipótese, dado, evidência e fonte.'],
  ['PRACTICE', 'Interpretar medidas e fontes em contexto, registrando método, escala e população.'],
  ['TRANSFER', 'Construir argumentos proporcionais a evidências em contextos sociais, ambientais e históricos.'],
  ['LOCK_IN', 'Confrontar hipóteses, explicações alternativas, incerteza e limites.'],
  ['REVIEW', 'Retomar conceitos e revisar conclusões à luz de novas evidências.'],
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function snapshot(pack) {
  const answerPositions = [0, 1, 2, 3].map((position) => pack.questions.filter((question) => question.options.indexOf(question.correctAnswer) === position).length);
  return {
    questionCount: pack.questions.length,
    uniqueQuestionIds: new Set(pack.questions.map((question) => question.id)).size,
    uniqueQuestionStems: new Set(pack.questions.map((question) => question.statement.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())).size,
    answerPositionCounts: answerPositions,
    purposeCounts: pack.questions.reduce((counts, question) => ({ ...counts, [question.purpose]: (counts[question.purpose] ?? 0) + 1 }), {}),
    evidenceMode: pack.evidenceMode ?? 'OBJECTIVE_LEARNING_PATH',
    publicationStatus: pack.publicationStatus,
    pedagogicalReviewStatus: pack.pedagogicalReviewStatus,
    officialMappingStatus: pack.officialMappingStatus,
    active: pack.active === true,
  };
}

function getSourceRecord() {
  return {
    verificationId: 'BNCC_EM13CHS103_MEC_P136_V1',
    officialCode: 'EM13CHS103',
    stage: 'ENSINO_MEDIO',
    kind: 'SKILL',
    componentCode: 'CHS',
    gradeOrRange: '1-3',
    descriptor: DESCRIPTOR,
    officialSource: {
      id: 'BNCC_EM_2018',
      documentVersion: 'BNCC Ensino Médio, versão homologada 2018',
      url: SOURCE_URL,
      page: 136,
    },
    localCatalogMatch: 'EXACT_DESCRIPTOR_AND_CODE',
    sourcePageNote: 'Descritor conferido no documento oficial do MEC para o Ensino Médio; a página e a URL correspondem ao catálogo BNCC local.',
    technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
    mappingStatus: 'CANONICAL_GAP',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    studentPublicationStatus: 'STAGING_INACTIVE',
    contentDecision: 'AUTHORING_CONTEXT_ONLY_UNTIL_CANONICAL_REVIEW',
    evidenceCheckedAt: '2026-10-18',
  };
}

function repairPackage(original, sourceRecord) {
  const pack = structuredClone(original);
  pack.active = false;
  pack.evidenceMode = 'OBJECTIVE_LEARNING_PATH';
  pack.publicationStatus = 'STAGING_INACTIVE';
  pack.pedagogicalReviewStatus = 'PEDAGOGICAL_REVIEW_PENDING';
  pack.officialMappingStatus = 'NOT_CLAIMED';
  pack.sourceContext = {
    ...pack.sourceContext,
    officialCode: sourceRecord.officialCode,
    relation: 'AUTHORING_CONTEXT_ONLY',
    mappingStatus: 'CANONICAL_GAP',
    sourceStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
    descriptor: sourceRecord.descriptor,
    officialSource: structuredClone(sourceRecord.officialSource),
    sourceVerificationId: sourceRecord.verificationId,
    note: 'Descritor conferido na fonte oficial do MEC. O vínculo canônico, a revisão pedagógica humana e qualquer publicação continuam pendentes.',
  };

  pack.lesson.explanation = 'Investigue uma pergunta transformando-a em hipótese clara, que possa ser confrontada. Antes de comparar dados, registre autoria, data, população, unidade, escala e método: uma contagem, um relato e um mapa podem iluminar aspectos diferentes sem serem medidas equivalentes. Selecione evidências relevantes, descreva o que mostram e explique por que apoiam (ou não) a afirmação. Verifique explicações alternativas, diferencie associação de causalidade e comunique incerteza. Um argumento responsável reúne afirmação, evidência, raciocínio e limites; ele pode ser revisto quando novas fontes ou dados aparecem. Em temas sensíveis, use dados fictícios ou anonimizados e não exponha participantes.';
  pack.lesson.commonMistake = 'Tratar uma correlação ou uma fonte isolada como prova de causa, ignorando método, contexto, alternativas e limites.';
  pack.lesson.progression = PHASES.map(([phase, focus]) => ({
    phase,
    focus,
    questionIds: pack.questions.filter((question) => question.purpose === phase).map((question) => question.id),
  }));
  pack.lesson.authenticActivities = [{
    title: 'Construir e revisar um argumento baseado em fontes',
    context: 'Dossiê didático com dados fictícios ou anonimizados, fontes qualitativas e quantitativas identificadas e uma pergunta social, histórica ou ambiental delimitada.',
    steps: [
      'Formule uma hipótese verificável e registre, para cada fonte, autoria, data, população, método, unidade e limite conhecido.',
      'Selecione evidências de pelo menos duas naturezas, descreva o padrão observado e organize uma matriz que separe dado, interpretação e hipótese.',
      'Redija ou apresente afirmação, evidência, raciocínio e limite; confronte uma explicação alternativa e indique que evidência adicional poderia mudar a conclusão.',
    ],
    evidence: 'Dossiê argumentativo rastreável, com fontes atribuídas, hipótese revisável, evidências qualitativas e quantitativas, raciocínio explícito, explicação alternativa e limite da conclusão.',
    rubric: [
      { criterion: 'Qualidade e contexto das evidências', emerging: 'Apresenta informação sem identificar fonte ou contexto.', developing: 'Identifica fontes e descreve evidências com apoio, mas deixa lacunas de método ou alcance.', proficient: 'Atribui cada evidência à fonte e considera método, população, período, unidade e alcance.' },
      { criterion: 'Raciocínio e explicações alternativas', emerging: 'Apresenta opinião ou afirma causalidade sem ligação demonstrada.', developing: 'Relaciona evidência e afirmação, mas considera poucas alternativas.', proficient: 'Explica a relação entre evidência e afirmação, compara uma alternativa e diferencia associação de causalidade.' },
      { criterion: 'Limites e comunicação', emerging: 'Generaliza além dos dados e omite incerteza.', developing: 'Indica uma limitação após orientação.', proficient: 'Delimita a conclusão, comunica incerteza e identifica que dado poderia revisar o argumento.' },
    ],
  }];
  pack.lesson.accessibilitySupports = [
    'Disponibilizar tabelas em alto contraste e formato textual compatível com leitor de tela; descrever gráficos, mapas e imagens com texto alternativo e legenda que preserve escala e fonte.',
    'Oferecer glossário, instruções em etapas, exemplos parcialmente resolvidos e tempo flexível; aceitar argumento escrito, oral, visual ou por comunicação alternativa, sem reduzir o critério de evidência.',
    'Usar cenários fictícios ou dados anonimizados em temas sensíveis; permitir que o estudante escolha entre contextos equivalentes e não solicite relato pessoal ou identificação de participantes.',
  ];
  pack.lesson.remediations = pack.lesson.remediations.map((item) => ({
    ...item,
    errorFocus: item.errorFocus ?? item.trigger,
    action: item.action ?? `${item.explanation} ${item.workedExample} ${item.selfCheck}`,
  }));

  const correctPositionCounts = [0, 0, 0, 0];
  pack.questions.forEach((question, index) => {
    const currentCorrect = question.options.indexOf(question.correctAnswer);
    if (currentCorrect < 0) throw new Error(`Gabarito não encontrado: ${question.id}`);
    const targetPosition = index % 4;
    const options = question.options.filter((_, optionIndex) => optionIndex !== currentCorrect);
    options.splice(targetPosition, 0, question.correctAnswer);
    question.options = options;
    question.accessibility = {
      ...(question.accessibility ?? {}),
      supports: [
        'Apresentar texto e dados também em formato acessível, com unidades, fonte e rótulos legíveis.',
        'Permitir resposta por seleção, fala, escrita ou tecnologia assistiva e oferecer tempo flexível.',
      ],
    };
    correctPositionCounts[targetPosition] += 1;
  });
  pack.expectedAnswerPositionCounts = Object.fromEntries(correctPositionCounts.map((count, index) => [String.fromCharCode(65 + index), count]));
  return pack;
}

const checkOnly = process.argv.includes('--check');
const packageOriginal = readJson(PACKAGE_PATH);
const sourceArtifact = readJson(SOURCE_PATH);
const sourceRecord = getSourceRecord();
const currentSourceRecord = sourceArtifact.records.find((item) => item.officialCode === sourceRecord.officialCode);
if (currentSourceRecord && JSON.stringify(currentSourceRecord) !== JSON.stringify(sourceRecord)) {
  throw new Error(`Há um registro de fonte divergente para ${sourceRecord.officialCode}; revisão manual necessária.`);
}

const before = snapshot(packageOriginal);
const repaired = repairPackage(packageOriginal, sourceRecord);
const rubric = evaluateCurriculumPackageRubric(repaired, {
  requirements: { mode: 'OBJECTIVE_LEARNING_PATH', questions: 40, concepts: 3, prerequisites: 1, remediations: 2, accessibilitySupports: 2 },
  officialSourceRecord: sourceRecord,
});
if (rubric.status !== 'AUTOMATED_SCREEN_PASS') {
  throw new Error(`Rubrica técnica incompleta: ${rubric.incomplete.join(', ')}`);
}
if (repaired.questions.length !== packageOriginal.questions.length
  || repaired.questions.some((question, index) => question.correctAnswer !== packageOriginal.questions[index].correctAnswer
    || question.id !== packageOriginal.questions[index].id)) {
  throw new Error('A recuperação não pode alterar IDs ou gabaritos das questões existentes.');
}
const after = snapshot(repaired);
const report = {
  schemaVersion: 'tec-escola.bncc.high-school-evidence-recovery.v1',
  generatedAt: '2026-10-18',
  packageFile: PACKAGE_PATH,
  officialCode: 'EM13CHS103',
  sourceVerificationId: sourceRecord.verificationId,
  before,
  after,
  questionIdsAndCorrectAnswersPreserved: true,
  questionOptionsReorderedOnlyToBalanceAnswerPositions: true,
  automatedScreen: rubric,
  humanPedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
  canonicalMappingStatus: 'CANONICAL_GAP',
  publicationStatus: 'STAGING_INACTIVE',
  publicationAuthorized: false,
  repairNotes: [
    'Corrigido o contexto da fonte para a BNCC oficial do Ensino Médio e conferida a transcrição do descritor.',
    'Convertida a progressão existente para fases explícitas que mapeiam as questões já existentes por finalidade.',
    'Acrescentadas atividade autêntica, apoios de acessibilidade e ações de retomada alinhadas ao argumento baseado em evidências.',
    'Reordenadas alternativas sem mudar gabaritos, conteúdo ou quantidade das 40 questões para eliminar viés de posição.',
  ],
};

if (checkOnly) {
  const existingReport = fs.existsSync(path.join(ROOT, REPORT_PATH)) ? readJson(REPORT_PATH) : null;
  const alreadyApplied = JSON.stringify(packageOriginal) === JSON.stringify(repaired)
    && sourceArtifact.records.some((item) => item.verificationId === sourceRecord.verificationId)
    && existingReport?.after?.questionCount === after.questionCount;
  if (!alreadyApplied) process.exitCode = 1;
  console.log(JSON.stringify({ status: alreadyApplied ? 'PASS' : 'NEEDS_REPAIR', rubric: rubric.status, after }, null, 2));
} else {
  if (!currentSourceRecord) sourceArtifact.records.push(sourceRecord);
  writeJson(SOURCE_PATH, sourceArtifact);
  writeJson(PACKAGE_PATH, repaired);
  writeJson(REPORT_PATH, report);
  console.log(JSON.stringify({ status: 'REPAIRED', rubric: rubric.status, after, humanPedagogicalReviewStatus: report.humanPedagogicalReviewStatus, publicationStatus: report.publicationStatus }, null, 2));
}
