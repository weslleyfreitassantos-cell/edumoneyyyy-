import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const stageToPurpose = {
  FOUNDATION: 'PROBE',
  APPLICATION: 'PRACTICE',
  TRANSFER: 'TRANSFER',
  INTEGRATION: 'LOCK_IN',
  SPACED_REVIEW_CANDIDATE: 'REVIEW',
};
const purposeAt = (index) =>
  index < 10 ? 'PROBE' : index < 50 ? 'PRACTICE' : index < 75 ? 'TRANSFER' : index < 85 ? 'LOCK_IN' : 'REVIEW';
const processFor = {
  PROBE: ['IDENTIFY', 'DISTINGUISH', 'COMPARE', 'INTERPRET'],
  PRACTICE: ['INTERPRET', 'ANALYZE', 'COMPARE', 'APPLY'],
  TRANSFER: ['EVALUATE', 'APPLY', 'SYNTHESIZE', 'PLAN'],
  LOCK_IN: ['DISTINGUISH', 'EVALUATE', 'SYNTHESIZE'],
  REVIEW: ['INTERPRET', 'EVALUATE', 'COMPARE', 'SYNTHESIZE'],
};
const withAnswerAt = (correct, distractors, index) => {
  const options = [...distractors];
  options.splice(index % 4, 0, correct);
  return options;
};

const items = [
  {
    label: 'privacy',
    context: 'Uma turma quer publicar um relato sobre saúde escolar em um mural digital e precisa confirmar o consentimento das pessoas envolvidas.',
    question: 'Qual primeira análise torna a decisão mais responsável?',
    correct: 'Verificar consentimento, risco de identificação e necessidade de cada informação antes de publicar.',
    criterion: 'Separe a finalidade do relato dos dados que podem expor uma pessoa.',
    transfer: 'Aplique o mesmo cuidado a uma pesquisa de opinião ou formulário da escola.',
    overclaim: 'tratar a retirada do nome como garantia automática de privacidade',
    evidence: 'finalidade, autorização e possibilidade de reidentificação',
    nextStep: 'retirar detalhes desnecessários e confirmar como o material circulará',
    limit: 'os dados realmente necessários para a finalidade declarada',
    comparison: 'benefício informativo e exposição evitável',
    refine: 'quem pode ser reconhecido mesmo sem o nome aparecer?',
    distractors: [
      'Publicar tudo porque o relato foi produzido por estudantes.',
      'Divulgar primeiro e retirar depois se alguém reclamar.',
      'Perguntar apenas se a maioria da turma aprovou o texto.',
    ],
  },
  {
    label: 'fairness',
    context: 'Uma escola precisa distribuir vagas limitadas em uma oficina que apoia diferentes necessidades de aprendizagem.',
    question: 'Que decisão apresenta um critério mais justificável?',
    correct: 'Explicitar critérios, considerar barreiras de acesso e revisar a distribuição quando os efeitos forem conhecidos.',
    criterion: 'Compare igualdade de oportunidade, necessidade e efeitos concretos da regra.',
    transfer: 'Use esse método para analisar outra fila de atendimento com recursos limitados.',
    overclaim: 'chamar qualquer distribuição idêntica de justa sem examinar as barreiras',
    evidence: 'necessidades informadas, critérios públicos e efeitos sobre a participação',
    nextStep: 'registrar o critério e verificar se ele produz uma barreira previsível',
    limit: 'as informações disponíveis e a finalidade legítima da oficina',
    comparison: 'vantagens e custos distribuídos entre os grupos',
    refine: 'a mesma regra produz condições comparáveis para todos?',
    distractors: [
      'Entregar todas as vagas a quem se inscreveu primeiro, sem registrar o motivo.',
      'Sortear sem verificar se o formato impede a participação de alguém.',
      'Escolher a alternativa mais popular e encerrar a análise.',
    ],
  },
  {
    label: 'speech',
    context: 'Em um fórum da escola, uma mensagem crítica sobre a direção mistura uma denúncia verificável e uma acusação sem fonte.',
    question: 'Como responder eticamente ao conteúdo?',
    correct: 'Distinguir a denúncia que pode ser verificada da acusação sem evidência e proteger a crítica sem espalhar a parte não sustentada.',
    criterion: 'Respeite a expressão de uma preocupação e, ao mesmo tempo, exija evidência para atribuir responsabilidade.',
    transfer: 'Aplique a distinção a uma postagem compartilhada em um grupo de mensagens.',
    overclaim: 'silenciar toda crítica ou repetir toda acusação como se fosse fato',
    evidence: 'afirmações verificáveis, fontes e diferença entre crítica e acusação',
    nextStep: 'pedir esclarecimento sobre a evidência e responder somente ao que pode ser sustentado',
    limit: 'o alcance da evidência apresentada e a proteção das pessoas envolvidas',
    comparison: 'liberdade de questionar e risco de dano por informação falsa',
    refine: 'qual parte do texto é observação e qual parte atribui intenção?',
    distractors: [
      'Apagar toda a mensagem porque uma frase não tem fonte.',
      'Repassar o texto inteiro porque críticas nunca precisam de evidência.',
      'Identificar publicamente o autor para desencorajar novas mensagens.',
    ],
  },
  {
    label: 'research',
    context: 'Um grupo apresenta um experimento que teve resultado diferente do esperado.',
    question: 'Qual atitude demonstra responsabilidade na investigação?',
    correct: 'Relatar o resultado, indicar as limitações do procedimento e propor uma repetição ou controle adequado.',
    criterion: 'Uma conclusão deve acompanhar o que os dados sustentam, inclusive quando o resultado não confirma a hipótese.',
    transfer: 'Transfira o critério para uma pesquisa sobre hábitos de estudo da turma.',
    overclaim: 'descartar o resultado inesperado ou ajustá-lo até confirmar a hipótese inicial',
    evidence: 'dados observados, método, controles e limitações declaradas',
    nextStep: 'revisar o procedimento e decidir que nova observação reduziria a incerteza',
    limit: 'o desenho do experimento e a qualidade dos dados coletados',
    comparison: 'resultado obtido e conclusão que ele permite defender',
    refine: 'o dado permite afirmar causalidade ou apenas uma associação?',
    distractors: [
      'Excluir os dados que contrariaram a expectativa para manter a hipótese.',
      'Concluir que a hipótese é definitivamente falsa com uma única medição.',
      'Omitir o método porque somente o resultado final importa.',
    ],
  },
  {
    label: 'collective-work',
    context: 'Em um trabalho coletivo, uma estudante fez grande parte da pesquisa, mas a apresentação atribui o resultado ao grupo inteiro sem explicar as contribuições.',
    question: 'Qual procedimento combina reconhecimento e colaboração?',
    correct: 'Registrar as contribuições, dar crédito proporcional e revisar a divisão de tarefas sem transformar o crédito em punição.',
    criterion: 'Reconheça autoria e responsabilidade sem abandonar a cooperação necessária ao trabalho comum.',
    transfer: 'Use o critério para avaliar um projeto com tarefas que mudaram ao longo do processo.',
    overclaim: 'apagar diferenças de contribuição em nome de uma igualdade apenas formal',
    evidence: 'registros de tarefas, versões do trabalho e acordos feitos pelo grupo',
    nextStep: 'conferir o histórico do trabalho e combinar como os créditos serão apresentados',
    limit: 'as contribuições documentadas e o objetivo coletivo da atividade',
    comparison: 'responsabilidade individual e resultado produzido em conjunto',
    refine: 'que registro permite distinguir participação, autoria e revisão?',
    distractors: [
      'Dar o mesmo crédito sem conversar, pois todo trabalho coletivo é idêntico.',
      'Retirar do grupo quem produziu mais partes, sem considerar a tarefa comum.',
      'Publicar somente o nome de quem apresentou, independentemente da contribuição.',
    ],
  },
  {
    label: 'environment',
    context: 'Uma campanha escolar quer reduzir o desperdício de água, mas a solução proposta aumenta o custo de famílias que já têm menos recursos.',
    question: 'Que avaliação evita uma solução aparentemente boa, mas injusta?',
    correct: 'Comparar a redução esperada, os custos distribuídos e alternativas que alcancem o objetivo sem transferir o peso aos mais vulneráveis.',
    criterion: 'Considere benefício ambiental, distribuição dos custos e alternativas menos excludentes.',
    transfer: 'Aplique a análise a uma decisão sobre energia, transporte ou descarte de resíduos.',
    overclaim: 'defender qualquer medida ambiental sem analisar quem suporta seus custos',
    evidence: 'estimativa de economia, custo por grupo e alternativas disponíveis',
    nextStep: 'calcular os efeitos para diferentes famílias e testar uma alternativa de apoio',
    limit: 'os dados de impacto e as condições materiais das pessoas afetadas',
    comparison: 'resultado ambiental e distribuição do sacrifício exigido',
    refine: 'a medida reduz o problema sem criar uma barreira maior para alguém?',
    distractors: [
      'Aplicar a mesma cobrança a todos porque igualdade dispensa análise de impacto.',
      'Abandonar a campanha porque qualquer custo torna a ação antiética.',
      'Escolher a proposta mais divulgada sem estimar seus efeitos.',
    ],
  },
  {
    label: 'digital-sharing',
    context: 'Uma estudante recebe em um grupo privado uma foto de outra pessoa e pensa em encaminhá-la para denunciar uma situação.',
    question: 'Qual ação reduz o dano sem apagar a possibilidade de pedir ajuda?',
    correct: 'Evitar o encaminhamento amplo, preservar apenas a evidência necessária e procurar um canal responsável de apoio.',
    criterion: 'Diferencie denunciar uma situação de espalhar uma imagem que pode causar novo dano.',
    transfer: 'Aplique o critério a capturas de tela e áudios recebidos em redes sociais.',
    overclaim: 'compartilhar uma exposição privada com qualquer pessoa em nome da denúncia',
    evidence: 'finalidade da denúncia, necessidade do arquivo e canal seguro disponível',
    nextStep: 'consultar um responsável confiável e enviar somente o necessário pelo canal adequado',
    limit: 'a proteção da pessoa exposta e a competência de quem receberá a informação',
    comparison: 'necessidade de intervenção e risco de ampliar a circulação',
    refine: 'quem precisa ver o material para agir e quem não precisa recebê-lo?',
    distractors: [
      'Encaminhar para toda a turma para obter mais opiniões.',
      'Apagar a foto e não contar a ninguém, mesmo havendo risco imediato.',
      'Publicar a imagem com o rosto coberto, sem avaliar se outros detalhes identificam a pessoa.',
    ],
  },
  {
    label: 'proportional-response',
    context: 'Uma estudante descumpre uma regra pela primeira vez, sem causar dano, e a proposta é aplicar uma resposta proporcional suspendendo sua participação em todas as atividades do mês.',
    question: 'Qual análise deve orientar a resposta?',
    correct: 'Relacionar a consequência à gravidade e à finalidade da regra, ouvindo a estudante e comparando alternativas educativas menos amplas.',
    criterion: 'Uma resposta proporcional considera dano, intenção, histórico, reparação possível e finalidade da medida.',
    transfer: 'Use esse raciocínio em uma regra de convivência digital ou de uso de materiais.',
    overclaim: 'aplicar a maior punição disponível para demonstrar autoridade',
    evidence: 'regra violada, dano concreto, contexto e possibilidades de reparação',
    nextStep: 'ouvir as partes e escolher a resposta suficiente para reparar e prevenir a repetição',
    limit: 'o fato confirmado e a finalidade educativa da regra',
    comparison: 'gravidade do fato e alcance da consequência proposta',
    refine: 'a medida repara o dano ou apenas amplia a exclusão?',
    distractors: [
      'Aplicar a punição máxima para impedir que outros questionem a regra.',
      'Ignorar o fato porque ninguém se machucou fisicamente.',
      'Escolher a consequência pelo número de pessoas que aprovam a punição.',
    ],
  },
  {
    label: 'tradition',
    context: 'Uma tradição de uma comunidade é apresentada em uma feira escolar, mas estudantes do próprio grupo dizem que a explicação simplifica sua história.',
    question: 'Como a turma pode apresentar a tradição com respeito?',
    correct: 'Consultar pessoas do grupo, reconhecer diferenças internas e evitar transformar uma prática diversa em imagem fixa ou exótica.',
    criterion: 'Contexto e participação dos envolvidos ajudam a evitar generalizações sobre uma comunidade.',
    transfer: 'Aplique o cuidado a uma pesquisa sobre religião, língua, festa ou memória local.',
    overclaim: 'falar em nome de todo um grupo a partir de uma única descrição',
    evidence: 'fontes do grupo, diversidade de perspectivas e contexto histórico da prática',
    nextStep: 'revisar a apresentação com participantes e explicitar o que ainda é limitado',
    limit: 'o alcance das fontes consultadas e a diversidade existente no grupo',
    comparison: 'descrição produzida pela turma e vozes das pessoas apresentadas',
    refine: 'a apresentação mostra pluralidade ou reduz a comunidade a um traço?',
    distractors: [
      'Manter a explicação porque a turma já pesquisou uma fonte na internet.',
      'Retirar toda referência à tradição para evitar qualquer discordância.',
      'Escolher a versão mais colorida e simples para tornar a feira mais atraente.',
    ],
  },
  {
    label: 'scarce-resource',
    context: 'Um conselho estudantil tem um único horário disponível para uma atividade de apoio e recebe pedidos de três grupos com necessidades diferentes.',
    question: 'Qual justificativa torna a escolha revisável e responsável?',
    correct: 'Explicar as necessidades consideradas, justificar o critério, oferecer alternativas aos demais e marcar uma revisão dos efeitos.',
    criterion: 'Quando o recurso é escasso, transparência e possibilidade de revisão limitam a arbitrariedade.',
    transfer: 'Aplique o método a equipamentos, salas ou horários compartilhados.',
    overclaim: 'tratar uma escolha difícil como neutra apenas porque foi feita por uma autoridade',
    evidence: 'necessidades dos grupos, finalidade do horário e alternativas concretas',
    nextStep: 'registrar a decisão, comunicar os motivos e acompanhar quem ficou sem atendimento',
    limit: 'as informações e os recursos realmente disponíveis naquele momento',
    comparison: 'urgência, benefício esperado e alternativas para cada grupo',
    refine: 'que dado poderia levar o conselho a rever a ordem escolhida?',
    distractors: [
      'Escolher o grupo mais conhecido para evitar críticas posteriores.',
      'Sortear e não registrar os motivos, pois a aleatoriedade elimina toda injustiça.',
      'Atender o pedido mais antigo sem comparar a urgência dos demais.',
    ],
  },
];

function makeQuestion({ item, caseIndex, variant }) {
  const index = caseIndex * 10 + variant;
  const purpose = purposeAt(index);
  const variants = [
    [item.question, item.correct],
    ['Qual critério deve orientar a análise?', `Use ${item.criterion}`],
    ['Como transferir esse raciocínio para outro caso?', item.transfer],
    ['Qual conclusão deve ser evitada?', `Evite ${item.overclaim}.`],
    ['Que evidência deve ser conferida primeiro?', `Confira ${item.evidence}.`],
    ['Qual é o próximo passo mais cuidadoso?', item.nextStep],
    ['Qual limite deve aparecer na resposta?', `Mantenha a conclusão ligada a ${item.limit}.`],
    ['Que comparação é mais justa?', `Compare ${item.comparison}.`],
    ['Qual seria um exagero interpretativo?', `Seria exagero ${item.overclaim}.`],
    ['Que pergunta ajuda a refinar a decisão?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v17-phil-ethical-principle-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V17_PHILOSOPHY_ETHICS_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `Uma decisão ética precisa ligar fatos, critérios e efeitos sem ultrapassar o que a situação sustenta. ${item.criterion}`,
    hint: 'Separe fatos de suposições, identifique quem é afetado e compare alternativas proporcionais.',
    errorFocus: 'PHILOSOPHY_ETHICAL_PRINCIPLE_FACTS_RIGHTS_AND_PROPORTIONALITY',
    misconceptions: { [item.distractors[0]]: ['PHILOSOPHY_ETHICAL_PRINCIPLE_FACTS_RIGHTS_AND_PROPORTIONALITY'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/philosophy-ethical-principle.json');
  const previous = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const newQuestions = items.flatMap((item, caseIndex) =>
    Array.from({ length: 10 }, (_, variant) => makeQuestion({ item, caseIndex, variant })),
  );
  const questions = [...previous.questions, ...newQuestions];
  const expectedPurposeCounts = Object.fromEntries(
    PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]),
  );
  const expectedAnswerPositionCounts = Object.fromEntries(
    ['A', 'B', 'C', 'D'].map((label, position) => [
      label,
      questions.filter((question) => question.options.indexOf(question.correctAnswer) === position).length,
    ]),
  );
  const newIdsByPurpose = new Map(
    PURPOSES.map((purpose) => [purpose, newQuestions.filter((question) => question.purpose === purpose).map((question) => question.id)]),
  );
  const progression = (previous.lesson.progression ?? []).map((stage) => ({
    ...stage,
    questionIds: [
      ...(stage.questionIds ?? []),
      ...(newIdsByPurpose.get(stageToPurpose[stage.stage]) ?? []),
    ],
  }));
  const pack = {
    ...previous,
    contentId: 'v17-phil-ethical-principle',
    contentVersion: 17,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 17),
    expectedQuestionCount: questions.length,
    expectedContextCount: questions.length,
    expectedPurposeCounts,
    expectedAnswerPositionCounts,
    publicationStatus: 'STAGING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    officialMappingStatus: 'NOT_CLAIMED',
    lesson: {
      ...previous.lesson,
      progression,
      copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V17 autoral com 100 questões; publicação mantida em STAGING e revisão pedagógica pendente.`.trim(),
    },
    sourceReconciliation: {
      ...(previous.sourceReconciliation ?? {}),
      sourceQuestionCount: previous.questions.length,
      newQuestions: 100,
      reusedQuestionsCountedAsNew: false,
      expansionStatus: 'AUTHORIAL_V17',
    },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`PHILOSOPHY_ETHICAL_PRINCIPLE_V17_INVALID:${validation.errors.join(',')}`);
  writeFileSync(
    resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v17-phil-ethical-principle-expansion-v17.json'),
    `${JSON.stringify(pack, null, 2)}\n`,
  );
  writeFileSync(
    resolve(ROOT, 'supabase/migrations/20261016001600_bncc_philosophy_ethical_principle_library_expansion_v17.sql'),
    buildMigration(pack),
  );
  process.stdout.write(`${JSON.stringify({
    valid: true,
    newQuestions: 100,
    totalQuestions: questions.length,
    purposeCounts: validation.counts,
    answerPositionCounts: validation.answerPositionCounts,
    publicationStatus: pack.publicationStatus,
    pedagogicalReviewStatus: pack.pedagogicalReviewStatus,
    officialMappingStatus: pack.officialMappingStatus,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
