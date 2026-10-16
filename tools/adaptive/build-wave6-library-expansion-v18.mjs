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
    label: 'structure',
    context: 'Em uma reunião, uma estudante apresenta a premissa “A biblioteca ampliou o horário” e conclui: “logo, mais estudantes poderão estudar depois da aula”.',
    question: 'Qual é a conclusão apresentada nesse argumento?',
    correct: 'Mais estudantes poderão estudar depois da aula.',
    criterion: 'Separe a informação tomada como razão da afirmação que o argumento pretende sustentar.',
    transfer: 'Aplique a distinção a uma notícia que use “portanto”, “assim” ou “logo”.',
    overclaim: 'tratar a premissa como se fosse a conclusão do argumento',
    evidence: 'a relação entre a ampliação do horário e a possibilidade de estudar depois da aula',
    nextStep: 'reconstruir as premissas e a conclusão antes de avaliar se a inferência é suficiente',
    limit: 'o que o enunciado realmente afirma, sem acrescentar resultados não observados',
    comparison: 'razão oferecida e conclusão defendida',
    refine: 'qual frase continuaria fazendo sentido depois de “logo”?',
    distractors: [
      'A biblioteca ampliou o horário.',
      'A reunião aconteceu depois da aula.',
      'Todas as pessoas estudarão na biblioteca.',
    ],
  },
  {
    label: 'relevance',
    context: 'Um cartaz diz que uma proposta de transporte escolar deve ser aprovada porque o estudante que a apresentou é muito simpático.',
    question: 'Que avaliação identifica o problema principal da justificativa?',
    correct: 'A simpatia da pessoa não é evidência relevante para saber se a proposta funciona ou atende à necessidade apresentada.',
    criterion: 'Uma razão deve ter relação com a conclusão que pretende apoiar, e não apenas produzir uma impressão favorável.',
    transfer: 'Use o mesmo critério ao avaliar uma propaganda que elogia a pessoa em vez de explicar o produto.',
    overclaim: 'aceitar uma razão irrelevante porque ela torna o autor mais simpático',
    evidence: 'dados sobre rota, segurança, horários, custo e necessidade dos estudantes',
    nextStep: 'pedir informações ligadas ao funcionamento da proposta e deixar a simpatia fora do critério',
    limit: 'a relação entre a evidência apresentada e a decisão a ser tomada',
    comparison: 'característica pessoal do autor e evidência sobre a proposta',
    refine: 'essa informação ajuda a avaliar a proposta ou apenas a pessoa que a apresentou?',
    distractors: [
      'A proposta é verdadeira porque foi escrita em um cartaz colorido.',
      'Toda opinião de estudante deve ser aceita sem análise.',
      'A proposta é falsa porque o autor é simpático.',
    ],
  },
  {
    label: 'causality',
    context: 'Depois que uma turma passou a usar uma nova agenda, as notas médias aumentaram. Um relatório conclui que a agenda causou todo o aumento.',
    question: 'Qual informação é necessária para avaliar essa conclusão causal?',
    correct: 'Comparar o período com outras explicações possíveis, como mudanças no conteúdo, no estudo e na composição da turma.',
    criterion: 'Uma associação temporal sugere uma hipótese, mas não prova sozinha que uma variável causou o resultado.',
    transfer: 'Aplique o cuidado a uma postagem que atribua uma melhora de saúde a um único hábito.',
    overclaim: 'confundir o fato de duas mudanças ocorrerem juntas com prova de causalidade',
    evidence: 'comparação adequada, medidas antes e depois e fatores que também mudaram',
    nextStep: 'examinar controles e explicações alternativas antes de afirmar causa',
    limit: 'o desenho da observação e os fatores que não foram controlados',
    comparison: 'associação observada e evidência necessária para sustentar causa',
    refine: 'o que mais poderia ter mudado ao mesmo tempo que a agenda?',
    distractors: [
      'Aumentar a certeza porque o relatório foi escrito depois do resultado.',
      'Concluir que a agenda nunca ajuda, pois uma causa não foi provada.',
      'Ignorar os dados anteriores e escolher a explicação mais popular.',
    ],
  },
  {
    label: 'counterexample',
    context: 'Uma pessoa afirma: “Toda regra da escola é obedecida por todos”. Um estudante apresenta como contraexemplo um caso documentado em que a regra foi descumprida.',
    question: 'O que o caso lembrado mostra sobre a afirmação?',
    correct: 'Ele funciona como contraexemplo à afirmação universal, embora não determine sozinho por que a regra foi descumprida.',
    criterion: 'Uma afirmação sobre todos pode ser enfraquecida por um caso que pertença ao conjunto e não a satisfaça.',
    transfer: 'Procure contraexemplos ao analisar frases como “ninguém”, “sempre” ou “todas as vezes”.',
    overclaim: 'tratar um contraexemplo como explicação completa de todos os casos',
    evidence: 'a confirmação de que o caso pertence ao conjunto descrito e contraria a regra geral',
    nextStep: 'reformular a afirmação e investigar em que condições a regra é ou não obedecida',
    limit: 'o alcance do caso apresentado e o que ele não permite generalizar',
    comparison: 'afirmação universal e caso que a contradiz',
    refine: 'o caso realmente se encaixa nos termos “toda” e “é obedecida”?',
    distractors: [
      'O caso prova que nenhuma regra pode ser obedecida.',
      'O caso confirma a afirmação porque uma exceção não importa.',
      'O caso explica a intenção de todas as pessoas da escola.',
    ],
  },
  {
    label: 'authority',
    context: 'Um vídeo apresenta uma afirmação sobre alimentação e diz apenas que “um especialista famoso” concorda, sem identificar a fonte ou o estudo.',
    question: 'Qual verificação é mais importante antes de aceitar a afirmação?',
    correct: 'Identificar a fonte, a área de competência, o estudo citado e se a conclusão corresponde aos dados disponíveis.',
    criterion: 'A autoridade pode ser uma pista, mas não substitui a identificação da fonte e a análise da evidência pertinente.',
    transfer: 'Aplique o critério a uma publicação que mencione um profissional sem mostrar sua pesquisa.',
    overclaim: 'considerar verdadeira qualquer afirmação apenas porque um especialista foi mencionado',
    evidence: 'nome, credenciais relevantes, fonte primária e limites do resultado apresentado',
    nextStep: 'localizar a fonte original e conferir se ela sustenta a frase divulgada',
    limit: 'a área de competência da pessoa e o alcance do estudo citado',
    comparison: 'prestígio atribuído e evidência verificável',
    refine: 'a pessoa tem competência para essa afirmação e a fonte pode ser conferida?',
    distractors: [
      'Aceitar a frase porque pessoas famosas nunca erram.',
      'Rejeitar a frase sem consultar a fonte, pois todo especialista é suspeito.',
      'Escolher a versão com mais compartilhamentos como prova suficiente.',
    ],
  },
  {
    label: 'ambiguity',
    context: 'Em um debate, alguém diz: “A escola deve dar liberdade aos estudantes”, mas não explica se liberdade significa escolher atividades, horários ou regras de convivência.',
    question: 'Qual pergunta melhora a análise do argumento?',
    correct: 'Perguntar qual sentido de “liberdade” está sendo usado e quais limites ou responsabilidades acompanham a proposta.',
    criterion: 'Termos importantes precisam manter um sentido suficientemente claro para que as razões possam ser avaliadas.',
    transfer: 'Aplique o procedimento a palavras como “justiça”, “segurança” ou “qualidade” em uma proposta pública.',
    overclaim: 'tirar uma conclusão firme de uma palavra que pode ter sentidos diferentes',
    evidence: 'definição operacional, exemplo de aplicação e consequência prevista para cada interpretação',
    nextStep: 'pedir esclarecimento do termo antes de comparar a proposta com alternativas',
    limit: 'o significado que o autor realmente pretende defender no contexto',
    comparison: 'sentidos possíveis e efeitos de cada interpretação',
    refine: 'a conclusão muda quando a palavra é entendida de outra maneira?',
    distractors: [
      'Escolher o significado mais conveniente e não informar a escolha.',
      'Encerrar o debate porque palavras abstratas nunca podem ser analisadas.',
      'Considerar todos os sentidos verdadeiros ao mesmo tempo, sem comparar efeitos.',
    ],
  },
  {
    label: 'analogy',
    context: 'Uma estudante afirma que a escola deve organizar os grupos como um time esportivo, pois em ambos os casos pessoas cooperam para atingir um objetivo.',
    question: 'O que deve ser examinado antes de usar essa analogia como justificativa?',
    correct: 'Verificar se as semelhanças são relevantes para a organização escolar e se as diferenças não mudam a conclusão.',
    criterion: 'Uma analogia sustenta uma conclusão quando a semelhança comparada é pertinente, não apenas quando os contextos parecem parecidos.',
    transfer: 'Avalie outra comparação perguntando quais propriedades são comuns e quais são decisivas para o caso novo.',
    overclaim: 'concluir que dois contextos funcionam da mesma forma porque compartilham uma característica',
    evidence: 'objetivo da comparação, semelhanças relevantes e diferenças que alteram as responsabilidades',
    nextStep: 'explicitar a regra que a analogia pretende apoiar e testar suas diferenças importantes',
    limit: 'o aspecto específico em que os contextos são comparados',
    comparison: 'cooperação comum e diferenças de finalidade, regras e responsabilidades',
    refine: 'a semelhança explica a conclusão ou apenas torna os exemplos visualmente parecidos?',
    distractors: [
      'Aceitar a analogia porque qualquer semelhança prova a mesma organização.',
      'Rejeitar a analogia sem examinar o aspecto comparado.',
      'Trocar a conclusão por uma descrição do esporte mencionado.',
    ],
  },
  {
    label: 'sample',
    context: 'Uma pesquisa ouve dez estudantes de uma turma e afirma que todos os estudantes da cidade preferem estudar pela manhã.',
    question: 'Qual limitação deve ser destacada?',
    correct: 'A amostra é pequena e pode não representar a diversidade de estudantes da cidade nem suas preferências.',
    criterion: 'Uma generalização precisa considerar tamanho, seleção e diversidade da amostra em relação ao conjunto descrito.',
    transfer: 'Use o critério ao analisar uma enquete de rede social apresentada como retrato de toda a população.',
    overclaim: 'generalizar para toda uma população sem justificar a representatividade da amostra',
    evidence: 'forma de seleção, tamanho da amostra e comparação com a população que a conclusão menciona',
    nextStep: 'ampliar e diversificar a coleta antes de estender a conclusão para a cidade',
    limit: 'o grupo efetivamente observado, e não todos os estudantes citados na conclusão',
    comparison: 'características da amostra e diversidade da população-alvo',
    refine: 'quem foi ouvido e quem ficou fora da pesquisa?',
    distractors: [
      'A pesquisa prova a preferência de todos porque dez pessoas são suficientes em qualquer situação.',
      'Nenhuma pesquisa pode produzir informação útil sobre preferências.',
      'A conclusão fica mais forte se o título da pesquisa for chamativo.',
    ],
  },
  {
    label: 'burden',
    context: 'Em uma conversa, uma pessoa afirma que existe um objeto invisível na sala e diz que os demais devem provar que ele não existe.',
    question: 'Que princípio ajuda a avaliar essa exigência?',
    correct: 'Quem apresenta uma afirmação deve indicar razões ou evidências proporcionais antes de exigir que os outros aceitem a conclusão.',
    criterion: 'A ausência de uma refutação não transforma automaticamente uma afirmação sem evidência em conhecimento.',
    transfer: 'Aplique o princípio a uma mensagem que acusa alguém sem apresentar fatos verificáveis.',
    overclaim: 'transferir todo o ônus de justificar a afirmação para quem apenas pediu evidência',
    evidence: 'a afirmação feita, as razões apresentadas e o tipo de verificação possível',
    nextStep: 'pedir a base da afirmação e manter a conclusão suspensa enquanto a evidência não aparece',
    limit: 'a diferença entre não ter prova suficiente e provar que algo é impossível',
    comparison: 'responsabilidade de justificar uma afirmação e dificuldade de refutá-la',
    refine: 'a pessoa ofereceu uma razão ou apenas pediu que os outros descartassem todas as possibilidades?',
    distractors: [
      'Aceitar a afirmação porque ninguém conseguiu provar o contrário imediatamente.',
      'Concluir que o objeto não existe com certeza apenas porque não foi observado.',
      'Encerrar qualquer investigação, pois toda afirmação tem o mesmo peso.',
    ],
  },
  {
    label: 'fact-value',
    context: 'Um relatório informa que a fila de atendimento aumentou e recomenda que a escola dê prioridade a estudantes em situação de maior vulnerabilidade.',
    question: 'Como analisar a passagem do dado para a recomendação?',
    correct: 'Distinguir o fato medido do critério de valor que justifica a prioridade e avaliar se os dados sustentam a proposta.',
    criterion: 'Uma recomendação envolve escolhas normativas; ela precisa explicitar o valor adotado além de citar um dado descritivo.',
    transfer: 'Aplique a distinção a uma notícia que descreva um problema e depois recomende uma política pública.',
    overclaim: 'tratar uma preferência normativa como se fosse uma consequência automática do dado',
    evidence: 'medida da fila, definição de vulnerabilidade, finalidade da prioridade e efeitos esperados',
    nextStep: 'explicitar o critério de justiça e comparar a recomendação com alternativas possíveis',
    limit: 'o que o relatório mediu e o que ainda depende de uma escolha de valor',
    comparison: 'descrição do problema e princípio usado para recomendar uma ação',
    refine: 'qual parte é observação e qual parte propõe como a escola deve agir?',
    distractors: [
      'A recomendação é um fato porque aparece depois de um número.',
      'Nenhuma política pode ser analisada com dados, pois valores são sempre irracionais.',
      'A maior fila prova sozinha qual grupo merece prioridade.',
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
    ['Que pergunta ajuda a refinar a análise?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v18-phil-evaluate-argument-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V18_PHILOSOPHY_EVALUATE_ARGUMENT_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `Avaliar um argumento exige separar razões, conclusão e limites da inferência. ${item.criterion}`,
    hint: 'Identifique a conclusão, confira a evidência relevante e procure explicações alternativas antes de generalizar.',
    errorFocus: 'PHILOSOPHY_EVALUATE_ARGUMENT_REASONS_EVIDENCE_AND_INFERENCE_LIMITS',
    misconceptions: { [item.distractors[0]]: ['PHILOSOPHY_EVALUATE_ARGUMENT_REASONS_EVIDENCE_AND_INFERENCE_LIMITS'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/philosophy-evaluate-argument.json');
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
    contentId: 'v18-phil-evaluate-argument',
    contentVersion: 18,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 18),
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
      copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V18 autoral com 100 questões; publicação mantida em STAGING e revisão pedagógica pendente.`.trim(),
    },
    sourceReconciliation: {
      ...(previous.sourceReconciliation ?? {}),
      sourceQuestionCount: previous.questions.length,
      newQuestions: 100,
      reusedQuestionsCountedAsNew: false,
      expansionStatus: 'AUTHORIAL_V18',
    },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`PHILOSOPHY_EVALUATE_ARGUMENT_V18_INVALID:${validation.errors.join(',')}`);
  writeFileSync(
    resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v18-phil-evaluate-argument-expansion-v18.json'),
    `${JSON.stringify(pack, null, 2)}\n`,
  );
  writeFileSync(
    resolve(ROOT, 'supabase/migrations/20261016001700_bncc_philosophy_evaluate_argument_library_expansion_v18.sql'),
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
