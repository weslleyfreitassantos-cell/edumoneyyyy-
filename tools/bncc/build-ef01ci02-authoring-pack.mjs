import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = 'content/adaptive/tec-escola-core-v5/v1-science-body-parts-fi.json';
const SOURCE_PATH = 'content/bncc/authoring/source-verification-v2.json';
const OFFICIAL_CODE = 'EF01CI02';

const rows = [
  ['PROBE', 'EASY', 'IDENTIFY', 'ROSTO_ESPELHO', 'Ao olhar para o rosto no espelho, qual parte do corpo ajuda a enxergar o próprio reflexo?', 'Os olhos.', ['As mãos.', 'Os joelhos.', 'Os pés.'], 'EYES_FUNCTION', 0],
  ['PROBE', 'EASY', 'NAME', 'PALMAS_BATENDO', 'Para bater palmas, quais partes do corpo se aproximam?', 'As mãos.', ['As orelhas.', 'Os tornozelos.', 'Os cabelos.'], 'BODY_PART_NAME', 1],
  ['PROBE', 'EASY', 'RELATE', 'SOM_DA_CAMPANHA', 'Uma criança ouve a campainha da escola. Qual parte do corpo recebe esse som?', 'As orelhas.', ['Os dedos.', 'Os dentes.', 'Os ombros.'], 'EARS_FUNCTION', 2],
  ['PROBE', 'EASY', 'IDENTIFY', 'CHEIRO_DA_FRUTA', 'Para perceber o cheiro de uma fruta, qual parte do corpo participa principalmente?', 'O nariz.', ['O cotovelo.', 'O calcanhar.', 'A unha.'], 'NOSE_FUNCTION', 3],
  ['PRACTICE', 'EASY', 'RELATE', 'CHUTE_BOLA', 'Na brincadeira de chutar uma bola, qual parte do corpo empurra a bola?', 'O pé.', ['A língua.', 'A testa.', 'A orelha.'], 'LEGS_AND_FEET', 0],
  ['PRACTICE', 'EASY', 'RELATE', 'DESENHO_LINHAS', 'Para segurar o lápis e fazer linhas, qual parte do corpo é usada diretamente?', 'A mão.', ['O peito.', 'O nariz.', 'O calcanhar.'], 'HANDS_FUNCTION', 1],
  ['PRACTICE', 'EASY', 'EXPLAIN', 'MASTIGAR_MACA', 'Os dentes ajudam a realizar qual ação quando comemos uma maçã?', 'Mastigar e triturar o alimento.', ['Escutar a música.', 'Sentir o cheiro da sala.', 'Dobrar o joelho.'], 'TEETH_FUNCTION', 2],
  ['PRACTICE', 'EASY', 'RELATE', 'CORRER_NO_PATIO', 'Quando uma criança corre no pátio, quais partes do corpo ajudam a sustentar e mover o corpo?', 'As pernas e os pés.', ['As unhas e os cabelos.', 'Os dentes e a língua.', 'As orelhas e o nariz.'], 'LEGS_AND_FEET', 3],
  ['PRACTICE', 'EASY', 'EXPLAIN', 'OUVIR_HISTORIA', 'A professora lê uma história. O que as orelhas ajudam a fazer?', 'Ouvir os sons e as palavras.', ['Sentir o gosto do lanche.', 'Segurar o livro.', 'Pular mais alto.'], 'EARS_FUNCTION', 0],
  ['PRACTICE', 'EASY', 'EXPLAIN', 'SABONETE_MAOS', 'Por que lavamos as mãos antes de comer?', 'Para remover sujeiras e microrganismos da pele.', ['Para enxergar melhor.', 'Para ouvir mais longe.', 'Para fazer os dentes crescerem.'], 'SKIN_CARE', 1],
  ['PRACTICE', 'EASY', 'RELATE', 'GOSTO_DA_BANANA', 'Qual parte da boca ajuda a perceber sabores como o doce da banana?', 'A língua.', ['O cotovelo.', 'O joelho.', 'A sobrancelha.'], 'TONGUE_FUNCTION', 2],
  ['PRACTICE', 'EASY', 'EXPLAIN', 'RESPIRAR_TRANQUILO', 'Qual ação está relacionada ao trabalho dos pulmões?', 'Respirar e trocar gases com o ambiente.', ['Mastigar a comida.', 'Escrever uma palavra.', 'Escutar uma canção.'], 'LUNGS_FUNCTION', 3],
  ['PRACTICE', 'MEDIUM', 'RELATE', 'CORACAO_BATENDO', 'Depois de correr, a criança percebe o coração batendo mais rápido. O que o coração faz?', 'Ajuda a movimentar o sangue pelo corpo.', ['Transforma som em luz.', 'Tritura os alimentos na boca.', 'Movimenta apenas os cabelos.'], 'HEART_FUNCTION', 0],
  ['PRACTICE', 'MEDIUM', 'EXPLAIN', 'BRACO_ALCANCE', 'Para alcançar um livro na mesa, que combinação ajuda a realizar o movimento?', 'Braço, mão e articulações.', ['Dentes, língua e nariz.', 'Orelhas, olhos e cabelos.', 'Unhas, pele e sobrancelhas.'], 'JOINTS_AND_MOVEMENT', 1],
  ['PRACTICE', 'MEDIUM', 'IDENTIFY', 'JOELHO_DOBRA', 'Qual parte permite dobrar a perna quando sentamos?', 'O joelho.', ['O pulso da mão.', 'A língua.', 'O nariz.'], 'JOINTS_AND_MOVEMENT', 2],
  ['PRACTICE', 'MEDIUM', 'EXPLAIN', 'PELE_TOQUE', 'A pele ajuda a perceber qual situação?', 'Que um objeto está quente, frio, macio ou áspero.', ['Qual é o nome de uma música sem ouvi-la.', 'Quanto uma pessoa enxerga sem olhar.', 'O gosto de um alimento sem colocá-lo na boca.'], 'SKIN_SENSATION', 3],
  ['TRANSFER', 'MEDIUM', 'APPLY', 'BOLA_NO_GOL', 'Durante um jogo de bola, uma criança não enxerga bem o gol à distância. Qual cuidado ajuda?', 'Aproximar-se com segurança e pedir orientação a um adulto.', ['Correr de olhos fechados.', 'Usar os ouvidos para enxergar.', 'Colocar o lápis na boca.'], 'SAFETY_AND_ACCESS', 0],
  ['TRANSFER', 'MEDIUM', 'COMPARE', 'ESCUTAR_NO_RUIDO', 'Em um lugar muito barulhento, qual estratégia pode ajudar alguém a acompanhar uma explicação?', 'Ir para um local mais silencioso ou usar um recurso de comunicação combinado.', ['Tapar os olhos para ouvir melhor.', 'Correr sem avisar ninguém.', 'Ignorar a pessoa que está falando.'], 'SAFETY_AND_ACCESS', 1],
  ['TRANSFER', 'MEDIUM', 'EXPLAIN', 'ADAPTAR_BRINCADEIRA', 'Uma colega movimenta o corpo de um jeito diferente. Qual atitude torna a brincadeira mais inclusiva?', 'Perguntar como ela prefere participar e adaptar regras com segurança.', ['Dizer que ela não pode brincar.', 'Escolher por ela sem perguntar.', 'Exigir que todos façam o mesmo movimento.'], 'RESPECT_AND_INCLUSION', 2],
  ['TRANSFER', 'MEDIUM', 'APPLY', 'LANCHE_SEGURO', 'Antes do lanche, qual conjunto de ações cuida melhor do corpo?', 'Lavar as mãos, sentar com segurança e comer com atenção.', ['Correr enquanto mastiga.', 'Compartilhar utensílios sem combinar.', 'Comer sem lavar as mãos.'], 'HEALTH_ROUTINE', 3],
  ['TRANSFER', 'MEDIUM', 'COMPARE', 'DESENHO_DO_CORPO', 'Ao desenhar uma pessoa, como representar uma parte do corpo com respeito?', 'Observar que os corpos têm formas e características diversas.', ['Desenhar todos os corpos exatamente iguais.', 'Dizer que só um formato é correto.', 'Apagar colegas que têm características diferentes.'], 'RESPECT_AND_INCLUSION', 0],
  ['TRANSFER', 'MEDIUM', 'EXPLAIN', 'SINAL_DE_PARADA', 'Uma criança não ouve um aviso sonoro no pátio. Qual alternativa pode transmitir o mesmo aviso?', 'Um sinal visual ou um gesto combinado.', ['Falar mais baixo sem olhar para ela.', 'Esconder o aviso.', 'Esperar que ela adivinhe.'], 'SAFETY_AND_ACCESS', 1],
  ['TRANSFER', 'MEDIUM', 'APPLY', 'SOL_E_PELE', 'Ao brincar no sol, qual cuidado protege a pele?', 'Usar proteção adequada, procurar sombra e seguir a orientação de um adulto.', ['Ficar no sol mais tempo para a pele mudar de cor.', 'Usar qualquer produto desconhecido.', 'Evitar beber água.'], 'SKIN_CARE', 2],
  ['TRANSFER', 'MEDIUM', 'COMPARE', 'MOVIMENTO_E_DESCANSO', 'Depois de uma atividade intensa, por que é importante fazer uma pausa?', 'Porque o corpo precisa recuperar energia e observar como está se sentindo.', ['Porque os olhos deixam de existir.', 'Porque o coração para de funcionar.', 'Porque descansar impede todo movimento futuro.'], 'HEALTH_ROUTINE', 3],
  ['LOCK_IN', 'MEDIUM', 'DISTINGUISH', 'OLHO_E_ORELHA', 'Qual frase diferencia corretamente olhos e orelhas?', 'Os olhos ajudam a ver e as orelhas ajudam a ouvir.', ['Os olhos mastigam e as orelhas respiram.', 'Os olhos correm e as orelhas dobram o joelho.', 'Os olhos sentem cheiro e as orelhas sentem gosto.'], 'SENSES_DISTINCTION', 0],
  ['LOCK_IN', 'MEDIUM', 'DISTINGUISH', 'NARIZ_E_LINGUA', 'Qual frase diferencia corretamente nariz e língua?', 'O nariz participa do olfato e a língua participa do paladar.', ['O nariz bombeia sangue e a língua move as pernas.', 'O nariz enxerga e a língua escuta.', 'O nariz dobra o braço e a língua protege a pele.'], 'SENSES_DISTINCTION', 1],
  ['LOCK_IN', 'MEDIUM', 'EXPLAIN', 'CORPO_EM_CONJUNTO', 'Por que várias partes do corpo podem participar da mesma atividade?', 'Porque os movimentos e sentidos trabalham em conjunto para realizar ações.', ['Porque uma única parte faz todas as funções.', 'Porque sentidos não ajudam em atividades.', 'Porque o corpo funciona apenas quando está parado.'], 'BODY_SYSTEMS_OVERVIEW', 2],
  ['LOCK_IN', 'HARD', 'EXPLAIN', 'LIMITE_DA_OBSERVACAO', 'Uma criança observa apenas que alguém correu mais devagar. O que ela pode afirmar com segurança?', 'Pode descrever o movimento observado, sem concluir sozinha a causa.', ['Pode afirmar qual órgão está doente.', 'Pode diagnosticar uma pessoa.', 'Pode dizer que todos correrão assim.'], 'EVIDENCE_AND_LIMITS', 3],
  ['LOCK_IN', 'HARD', 'APPLY', 'CUIDADO_COM_DOR', 'Se uma parte do corpo dói durante a atividade, qual é uma atitude segura?', 'Parar, avisar um adulto e seguir a orientação recebida.', ['Continuar para provar coragem.', 'Esconder a dor dos adultos.', 'Tomar qualquer remédio por conta própria.'], 'SAFETY_AND_ACCESS', 0],
  ['LOCK_IN', 'HARD', 'COMPARE', 'FUNCAO_E_APARENCIA', 'Qual comparação usa uma função do corpo, e não apenas sua aparência?', 'Dizer que as mãos ajudam a segurar e manipular objetos.', ['Dizer que o cabelo é bonito.', 'Dizer que a camiseta é azul.', 'Dizer que o sapato é novo.'], 'FUNCTION_NOT_APPEARANCE', 1],
  ['REVIEW', 'EASY', 'IDENTIFY', 'REVISAO_OLHOS', 'Qual parte do corpo usamos principalmente para ler uma figura?', 'Os olhos.', ['Os joelhos.', 'As mãos.', 'Os dentes.'], 'EYES_FUNCTION', 2],
  ['REVIEW', 'EASY', 'IDENTIFY', 'REVISAO_MAOS', 'Qual parte do corpo ajuda a abrir uma caixa com cuidado?', 'As mãos.', ['As orelhas.', 'Os pulmões.', 'A língua.'], 'HANDS_FUNCTION', 3],
  ['REVIEW', 'EASY', 'RELATE', 'REVISAO_OUVIDO', 'Quando ouvimos uma música, qual sentido está sendo usado?', 'A audição.', ['A visão.', 'O paladar.', 'O tato.'], 'EARS_FUNCTION', 0],
  ['REVIEW', 'EASY', 'RELATE', 'REVISAO_CHEIRO', 'Quando percebemos o cheiro do sabonete, qual sentido está sendo usado?', 'O olfato.', ['A audição.', 'A visão.', 'O equilíbrio.'], 'NOSE_FUNCTION', 1],
  ['REVIEW', 'EASY', 'RELATE', 'REVISAO_SABOR', 'Quando percebemos que uma fruta está doce, qual sentido participa?', 'O paladar.', ['A audição.', 'A visão.', 'O tato.'], 'TONGUE_FUNCTION', 2],
  ['REVIEW', 'MEDIUM', 'EXPLAIN', 'REVISAO_RESPIRACAO', 'Qual frase explica uma função dos pulmões?', 'Eles participam da respiração.', ['Eles produzem pensamentos.', 'Eles mastigam alimentos.', 'Eles dobram os dedos.'], 'LUNGS_FUNCTION', 3],
  ['REVIEW', 'MEDIUM', 'EXPLAIN', 'REVISAO_CIRCULACAO', 'Qual frase explica uma função do coração?', 'Ele ajuda a impulsionar o sangue pelo corpo.', ['Ele reconhece cores.', 'Ele produz sons da fala.', 'Ele sente o gosto do sal.'], 'HEART_FUNCTION', 0],
  ['REVIEW', 'MEDIUM', 'APPLY', 'REVISAO_HIGIENE', 'Qual rotina ajuda a cuidar da pele das mãos?', 'Lavar as mãos quando necessário e secá-las adequadamente.', ['Usar as mãos sujas para comer.', 'Compartilhar qualquer produto sem orientação.', 'Esconder feridas sem avisar.'], 'SKIN_CARE', 1],
  ['REVIEW', 'MEDIUM', 'COMPARE', 'REVISAO_MOVIMENTO', 'Qual opção relaciona corretamente parte e movimento?', 'O joelho ajuda a dobrar a perna.', ['O nariz ajuda a fechar a mão.', 'A orelha ajuda a chutar a bola.', 'A língua ajuda a girar o tornozelo.'], 'JOINTS_AND_MOVEMENT', 2],
  ['REVIEW', 'HARD', 'EXPLAIN', 'REVISAO_INCLUSAO', 'Qual atitude respeita diferentes maneiras de usar e perceber o corpo?', 'Ouvir a pessoa e adaptar a comunicação ou a atividade com segurança.', ['Impor um único jeito de participar.', 'Fazer piada com uma diferença corporal.', 'Excluir quem precisa de apoio.'], 'RESPECT_AND_INCLUSION', 3],
];

const purposeCounts = { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 };
const positionLabels = ['A', 'B', 'C', 'D'];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function buildQuestions() {
  return rows.map(([purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, errorFocus, position], index) => {
    const options = [...distractors];
    options.splice(position, 0, correctAnswer);
    return {
      id: `v1-science-body-parts-fi-${String(index + 1).padStart(2, '0')}`,
      purpose,
      difficulty,
      cognitiveProcess,
      contextFamily,
      statement,
      options,
      correctAnswer,
      explanation: `A resposta relaciona a situação apresentada à função de ${correctAnswer.toLocaleLowerCase('pt-BR')}. A observação deve permanecer limitada ao que a atividade permite perceber.`,
      hint: 'Nomeie a parte do corpo ou o sentido ligado à ação descrita e explique a função observável.',
      errorFocus,
      misconceptions: Object.fromEntries(distractors.map((distractor) => [distractor, [errorFocus]])),
    };
  });
}

function buildPack() {
  const source = readJson(SOURCE_PATH).records.find((record) => record.officialCode === OFFICIAL_CODE);
  if (!source) throw new Error(`SOURCE_VERIFICATION_NOT_FOUND:${OFFICIAL_CODE}`);
  const questions = buildQuestions();
  const answerPositions = Object.fromEntries(positionLabels.map((label, index) => [label, questions.filter((question) => question.options.indexOf(question.correctAnswer) === index).length]));
  const sourceContext = {
    officialCode: source.officialCode,
    relation: 'AUTHORING_CONTEXT_ONLY',
    mappingStatus: 'CANONICAL_GAP',
    sourceStatus: source.technicalVerificationStatus,
    descriptor: source.descriptor,
    officialSource: source.officialSource,
    note: 'O descritor é contexto de autoria; o vínculo canônico, a revisão pedagógica e a publicação permanecem pendentes.',
  };
  const questionIds = questions.map((question) => question.id);
  return {
    packVersion: 'tec-escola-core-v5-question-first',
    contentVersion: 1,
    lessonVersion: 1,
    contentId: 'v1-science-body-parts-fi',
    canonicalSkillCode: 'AUTHORING_EF01CI02_BODY_FUNCTIONS',
    subject: 'SCIENCE',
    domain: 'CORPO_HUMANO',
    topic: 'partes do corpo humano e suas funções',
    databasePackId: 'TECESCOLA_CORE_V5_QUESTION_FIRST',
    officialMappingStatus: 'NOT_CLAIMED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING_INACTIVE',
    active: false,
    contentAuthoringStatus: 'AUTHORED',
    expectedPurposeCounts: purposeCounts,
    expectedQuestionCount: 40,
    expectedContextCount: 40,
    expectedAnswerPositionCounts: answerPositions,
    sourceContext,
    sourceReconciliation: {
      sourceQuestionCount: 0,
      feedbackAdded: 0,
      sourceReconciliationStatus: 'NO_SOURCE_QUESTION_REUSED',
      newQuestions: questions.length,
      reusedQuestionsCountedAsNew: false,
    },
    lesson: {
      title: 'Meu corpo: partes, sentidos e funções',
      objective: 'Localizar, nomear e representar partes do corpo humano, relacionando-as a funções observáveis e respeitando diferentes formas de perceber e movimentar o corpo.',
      summary: 'O corpo tem partes que trabalham juntas. Podemos observar funções como ver, ouvir, cheirar, saborear, tocar, respirar e movimentar-se sem reduzir pessoas a um único padrão corporal.',
      explanation: '## Observar sem reduzir\nNomeie partes do corpo a partir de desenhos, movimentos e situações cotidianas. Uma mesma ação pode envolver várias partes e cada pessoa pode realizá-la de maneira diferente.\n\n## Relacionar parte e função\nOs olhos participam da visão, as orelhas da audição, o nariz do olfato e a língua do paladar. A pele participa do tato; mãos, braços, pernas e articulações ajudam em movimentos. Pulmões e coração têm funções internas que podem ser estudadas por sinais e modelos apropriados.\n\n## Cuidar e incluir\nHigiene, descanso, segurança e comunicação acessível ajudam a cuidar do corpo. Não se deve diagnosticar uma pessoa pela aparência nem excluir alguém por se movimentar ou perceber de outro modo.',
      workedExample: 'Em um desenho de uma criança ouvindo uma história, marque as orelhas como partes relacionadas à audição, os olhos como partes que podem acompanhar imagens e as mãos como partes que podem segurar o livro. Explique que a atividade pode ser adaptada para diferentes formas de participação.',
      commonMistake: 'Confundir uma parte do corpo com outra função, tratar um único jeito de mover-se como regra para todas as pessoas ou fazer diagnóstico sem orientação profissional.',
      tips: ['Pergunte qual ação está sendo realizada antes de escolher a parte do corpo.', 'Use desenhos, gestos, objetos e comunicação alternativa para representar funções.', 'Diferencie observação, explicação e diagnóstico.', 'Adapte a atividade sem pressupor que todos os corpos funcionam da mesma maneira.'],
      priorKnowledge: ['Nomear objetos e ações do cotidiano.', 'Comparar situações simples e seguir orientações de segurança.'],
      keyConcepts: ['parte do corpo', 'função', 'sentidos', 'movimento', 'higiene', 'segurança', 'acessibilidade', 'respeito às diferenças'],
      progression: [
        { stage: 'FOUNDATION', focus: 'Nomear partes e relacionar sentidos a situações simples.', questionIds: questionIds.slice(0, 8) },
        { stage: 'APPLICATION', focus: 'Explicar funções e cuidados em atividades do cotidiano.', questionIds: questionIds.slice(8, 20) },
        { stage: 'TRANSFER', focus: 'Aplicar o conhecimento em situações de segurança e inclusão.', questionIds: questionIds.slice(20, 28) },
        { stage: 'CONSOLIDATION', focus: 'Distinguir função, aparência, observação e diagnóstico.', questionIds: questionIds.slice(28, 34) },
        { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Retomar partes, sentidos, movimento e cuidado em contextos novos.', questionIds: questionIds.slice(34) },
      ],
      microExplanations: [
        { trigger: 'PART_FUNCTION_CONFUSION', text: 'Volte à ação descrita: ver, ouvir, cheirar, saborear, tocar ou movimentar-se. Depois relacione a parte do corpo à função observável.' },
        { trigger: 'BODY_STANDARDIZATION', text: 'A função pode ser realizada com adaptações e apoios diferentes. Não transforme um único corpo em padrão para avaliar todos.' },
        { trigger: 'OBSERVATION_AS_DIAGNOSIS', text: 'Uma observação em sala não permite diagnosticar uma pessoa. Descreva o que foi percebido e procure um adulto ou profissional responsável quando necessário.' },
      ],
      remediations: [
        { misconception: 'PART_FUNCTION_CONFUSION', prompt: 'Ligue cartões de ações a partes do corpo e explique por que cada ligação faz sentido.' },
        { misconception: 'BODY_STANDARDIZATION', prompt: 'Adapte uma brincadeira para duas formas diferentes de participação e registre como ambas alcançam o objetivo.' },
        { misconception: 'OBSERVATION_AS_DIAGNOSIS', prompt: 'Separe em duas colunas o que pode ser observado e o que exigiria avaliação de um profissional.' },
      ],
      authenticActivities: [{ id: 'body-map-with-accessible-choices', title: 'Mapa do corpo com diferentes formas de participação', instructions: 'Em pequenos grupos, use desenho, colagem, gestos ou comunicação alternativa para representar partes do corpo e uma função observável. Convide cada participante a escolher como quer contribuir.', evidence: 'Mapa ou registro multimodal com pelo menos seis partes, funções e uma adaptação de participação.', privacyGuard: 'Não registrar diagnósticos, fotos corporais ou informações de saúde; usar materiais e exemplos genéricos.', rubric: [{ criterion: 'Relação parte-função', emerging: 'Nomeia partes sem relacioná-las às funções.', developing: 'Relaciona algumas partes às funções com apoio.', proficient: 'Relaciona partes e funções com explicações observáveis.' }, { criterion: 'Inclusão e segurança', emerging: 'Propõe uma única forma de participação.', developing: 'Aceita uma adaptação sugerida.', proficient: 'Oferece escolhas de participação e evita diagnóstico ou exposição.' }] }],
      estimatedMinutes: 30,
      reviewWindowsDays: [1, 3, 7],
      reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
      sourceDossier: [{ title: source.officialSource.documentVersion, publisher: 'MEC/CNE', url: source.officialSource.url, page: source.officialSource.page, accessedOn: source.evidenceCheckedAt, supports: ['partes do corpo', 'representação gráfica', 'funções observáveis'], use: 'Fonte oficial usada para rastreabilidade do descritor; nenhum texto, questão ou ilustração foi copiado.' }],
      copyrightNote: 'Situações, alternativas, explicações e atividade são autorais e hipotéticas; o descritor oficial permanece apenas como contexto de autoria.',
    },
    questions,
  };
}

function validatePack(pack) {
  const errors = [];
  if (pack.sourceContext?.officialCode !== OFFICIAL_CODE) errors.push('SOURCE_CONTEXT_CODE_INVALID');
  if (pack.sourceContext?.relation !== 'AUTHORING_CONTEXT_ONLY') errors.push('AUTHORING_RELATION_INVALID');
  if (pack.officialMappingStatus !== 'NOT_CLAIMED') errors.push('MAPPING_MUST_REMAIN_UNCLAIMED');
  if (pack.publicationStatus !== 'STAGING_INACTIVE' || pack.active !== false) errors.push('PUBLICATION_MUST_REMAIN_INACTIVE');
  if (!pack.lesson?.title || !pack.lesson?.objective || !pack.lesson?.explanation || !pack.lesson?.workedExample || !pack.lesson?.commonMistake) errors.push('LESSON_INCOMPLETE');
  const ids = new Set();
  const contexts = new Set();
  const purposes = Object.fromEntries(Object.keys(purposeCounts).map((key) => [key, 0]));
  const positions = [0, 0, 0, 0];
  for (const question of pack.questions ?? []) {
    if (ids.has(question.id)) errors.push(`DUPLICATE_ID:${question.id}`);
    ids.add(question.id);
    if (contexts.has(question.contextFamily)) errors.push(`DUPLICATE_CONTEXT:${question.contextFamily}`);
    contexts.add(question.contextFamily);
    purposes[question.purpose] = (purposes[question.purpose] ?? 0) + 1;
    if (!Array.isArray(question.options) || question.options.length !== 4 || new Set(question.options).size !== 4) errors.push(`OPTIONS_INVALID:${question.id}`);
    if (!question.options?.includes(question.correctAnswer)) errors.push(`ANSWER_INVALID:${question.id}`);
    else positions[question.options.indexOf(question.correctAnswer)] += 1;
    if (!question.statement || !question.explanation || !question.hint || !question.errorFocus) errors.push(`FEEDBACK_INCOMPLETE:${question.id}`);
  }
  for (const [purpose, count] of Object.entries(purposeCounts)) if (purposes[purpose] !== count) errors.push(`PURPOSE_COUNT:${purpose}:${purposes[purpose]}`);
  if (contexts.size !== 40) errors.push(`CONTEXT_COUNT:${contexts.size}`);
  if (positions.some((count) => count !== 10)) errors.push(`ANSWER_POSITION_COUNTS:${positions.join(',')}`);
  return { valid: errors.length === 0, errors, questionCount: pack.questions?.length ?? 0, contextCount: contexts.size, purposeCounts: purposes, answerPositionCounts: Object.fromEntries(positionLabels.map((label, index) => [label, positions[index]])) };
}

function main() {
  const pack = buildPack();
  const validation = validatePack(pack);
  if (!validation.valid) throw new Error(`EF01CI02_PACK_INVALID:${validation.errors.join(',')}`);
  const outputPath = path.join(ROOT, OUTPUT);
  const expected = `${JSON.stringify(pack, null, 2)}\n`;
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8').replaceAll('\r\n', '\n') !== expected.replaceAll('\r\n', '\n')) throw new Error('EF01CI02_PACK_OUTPUT_STALE');
  } else {
    fs.writeFileSync(outputPath, expected);
  }
  console.log(JSON.stringify({ ...validation, output: OUTPUT, publicationStatus: pack.publicationStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { buildPack, validatePack };
