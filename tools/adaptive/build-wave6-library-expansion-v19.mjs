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
    label: 'definition',
    context: 'Uma turma usa a palavra “democracia” em um debate, mas cada grupo parece atribuir a ela um significado diferente.',
    question: 'Qual primeiro passo melhora a conversa?',
    correct: 'Explicitar o sentido usado e conferir se as afirmações seguintes mantêm esse sentido.',
    criterion: 'Um conceito precisa ter um sentido compartilhado o bastante para que as razões possam ser comparadas.',
    transfer: 'Aplique o cuidado a palavras como “respeito”, “liberdade” ou “responsabilidade”.',
    overclaim: 'tratar uma palavra conhecida como se todos já concordassem com sua definição',
    evidence: 'definição apresentada, exemplos usados e relação entre o conceito e a conclusão',
    nextStep: 'pedir uma definição provisória e testar seu uso em exemplos concretos',
    limit: 'o sentido adotado naquele debate, sem presumir que seja o único possível',
    comparison: 'significado declarado e modo como a palavra aparece nas frases',
    refine: 'os grupos estão discordando do conceito ou apenas de uma aplicação dele?',
    distractors: [
      'Escolher o significado do grupo mais numeroso sem explicar o critério.',
      'Encerrar a discussão porque conceitos não podem ser definidos.',
      'Usar todos os sentidos ao mesmo tempo, mesmo quando entram em conflito.',
    ],
  },
  {
    label: 'necessary',
    context: 'Para participar de uma atividade, a escola exige inscrição e considera essa inscrição necessária. Uma estudante diz que ela é suficiente para garantir que a participação será proveitosa.',
    question: 'Que distinção ajuda a avaliar a frase?',
    correct: 'Inscrição pode ser necessária para participar, mas não é suficiente para garantir que a experiência será proveitosa.',
    criterion: 'Uma condição necessária precisa estar presente, enquanto uma condição suficiente bastaria para produzir o resultado analisado.',
    transfer: 'Use a distinção em uma regra que fale de aprovação, acesso ou conclusão de uma tarefa.',
    overclaim: 'confundir uma condição necessária com garantia suficiente do resultado',
    evidence: 'o que a condição permite iniciar e quais outros fatores participam do resultado',
    nextStep: 'verificar quais condições adicionais são exigidas para o objetivo mencionado',
    limit: 'a função da inscrição no processo e o resultado que se quer garantir',
    comparison: 'condição que precisa existir e condição que bastaria sozinha',
    refine: 'sem a inscrição o resultado é impossível, ou ela já garante o resultado?',
    distractors: [
      'Toda condição necessária produz o resultado sozinha.',
      'Uma condição suficiente nunca precisa estar presente.',
      'As duas expressões significam exatamente a mesma coisa.',
    ],
  },
  {
    label: 'example',
    context: 'Uma estudante dá o exemplo de uma bicicleta adaptada para explicar o conceito de acessibilidade.',
    question: 'O que o exemplo pode fazer na explicação?',
    correct: 'Mostrar uma aplicação possível do conceito, sem esgotar todos os casos que o conceito pode abranger.',
    criterion: 'Um exemplo ajuda a tornar um conceito observável, mas não deve ser confundido com sua definição completa.',
    transfer: 'Aplique o cuidado ao usar um caso de inclusão, justiça ou participação para explicar um conceito amplo.',
    overclaim: 'tratar um único exemplo como se definisse todos os casos do conceito',
    evidence: 'características do caso e propriedades que pertencem ao conceito em situações diferentes',
    nextStep: 'comparar o exemplo com outros casos e formular o critério geral que os relaciona',
    limit: 'o que o exemplo ilustra e o que ele não permite concluir sozinho',
    comparison: 'características do caso e critérios gerais do conceito',
    refine: 'o exemplo é um caso do conceito por qual propriedade relevante?',
    distractors: [
      'O exemplo prova que somente bicicletas adaptadas são acessibilidade.',
      'O exemplo não pode ensinar nada porque conceitos não têm casos.',
      'O exemplo substitui a necessidade de explicar qualquer critério.',
    ],
  },
  {
    label: 'boundary',
    context: 'Um grupo quer chamar qualquer comentário contrário de “violência verbal”, sem diferenciar crítica, insulto e ameaça.',
    question: 'Qual cuidado conceitual é necessário?',
    correct: 'Definir critérios e distinguir tipos de fala para que a categoria não inclua situações diferentes sem justificativa.',
    criterion: 'Uma categoria fica mais clara quando seus limites e diferenças internas são explicitados.',
    transfer: 'Use o método ao analisar palavras como “preconceito”, “brincadeira” ou “desinformação”.',
    overclaim: 'ampliar uma categoria até que qualquer comportamento caiba nela',
    evidence: 'conteúdo, intenção, efeito, contexto e relação entre os participantes',
    nextStep: 'listar casos centrais, casos limítrofes e critérios que justificam a classificação',
    limit: 'as propriedades observáveis da fala e a finalidade da categoria usada',
    comparison: 'crítica, insulto e ameaça segundo critérios explícitos',
    refine: 'qual característica torna os casos semelhantes e qual os diferencia?',
    distractors: [
      'Usar a categoria para todo comentário que cause desconforto.',
      'Rejeitar a categoria porque casos diferentes nunca podem ser comparados.',
      'Classificar a fala apenas pela opinião de quem ouviu, sem examinar o contexto.',
    ],
  },
  {
    label: 'descriptive-normative',
    context: 'Um relatório informa que muitos estudantes chegam atrasados e uma proposta conclui: “A escola deve punir todos com a mesma medida”.',
    question: 'Que diferença precisa aparecer na análise?',
    correct: 'O relatório descreve uma situação, enquanto a proposta acrescenta uma escolha normativa sobre como a escola deve agir.',
    criterion: 'Uma frase sobre o que acontece não é idêntica a uma frase sobre o que deve ser feito.',
    transfer: 'Aplique a distinção a uma notícia que apresenta um problema e recomenda uma política.',
    overclaim: 'tratar uma descrição de frequência como se ela determinasse uma obrigação',
    evidence: 'dado sobre atrasos, finalidade da regra, critérios de justiça e efeitos da punição',
    nextStep: 'explicitar o valor que sustenta a proposta e comparar consequências alternativas',
    limit: 'o que os dados mostram e o que ainda depende de decisão normativa',
    comparison: 'fato observado e recomendação sobre como agir',
    refine: 'qual frase descreve a situação e qual afirma o que a escola deve fazer?',
    distractors: [
      'A recomendação é um fato porque vem depois de um número.',
      'Dados nunca podem participar de uma decisão normativa.',
      'A frequência dos atrasos prova qual punição é justa.',
    ],
  },
  {
    label: 'universal-particular',
    context: 'Uma estudante afirma que “alguns projetos de leitura são acessíveis” e outra responde: “Então todos os projetos são acessíveis”.',
    question: 'Por que a resposta não decorre da primeira frase?',
    correct: 'A afirmação sobre alguns casos não autoriza concluir que a propriedade vale para todos os casos.',
    criterion: 'Quantificadores como “alguns”, “muitos” e “todos” têm alcances diferentes e não podem ser trocados sem argumento.',
    transfer: 'Aplique a atenção aos quantificadores em pesquisas, notícias e conclusões sobre grupos.',
    overclaim: 'transformar uma existência particular em uma afirmação universal',
    evidence: 'quantificador usado, conjunto considerado e casos que sustentam a extensão da conclusão',
    nextStep: 'manter o alcance da conclusão igual ao que a evidência permite',
    limit: 'a quantidade de casos realmente observados ou afirmados',
    comparison: 'alcance de “alguns” e alcance de “todos”',
    refine: 'a frase fala de pelo menos um caso ou de cada caso do conjunto?',
    distractors: [
      '“Alguns” sempre significa exatamente metade do conjunto.',
      'Uma afirmação particular é mais forte que uma universal.',
      'Se um projeto é acessível, todos os projetos necessariamente são.',
    ],
  },
  {
    label: 'operational',
    context: 'Uma pesquisa quer medir “participação dos estudantes”, mas não informa se observará presença, fala em aula, entrega de tarefas ou colaboração.',
    question: 'Que ajuste torna o conceito pesquisável?',
    correct: 'Definir indicadores observáveis e explicar como eles representam a participação que a pesquisa pretende estudar.',
    criterion: 'Uma definição operacional liga um conceito abstrato aos procedimentos e indicadores usados para observá-lo.',
    transfer: 'Use o procedimento para pesquisar bem-estar, colaboração ou autonomia em uma turma.',
    overclaim: 'considerar que qualquer medida escolhida representa automaticamente o conceito inteiro',
    evidence: 'indicadores definidos, justificativa de sua pertinência e limites da medida',
    nextStep: 'selecionar indicadores, testar se são compreensíveis e registrar o que ficará de fora',
    limit: 'a dimensão do conceito capturada pelos indicadores escolhidos',
    comparison: 'conceito amplo e evidência observável usada como indicador',
    refine: 'o indicador mede a propriedade ou apenas um resultado que pode ter outras causas?',
    distractors: [
      'Escolher o primeiro número disponível e chamar isso de participação.',
      'Evitar qualquer definição para não limitar o conceito.',
      'Usar apenas a opinião do pesquisador como medida universal.',
    ],
  },
  {
    label: 'category-error',
    context: 'Após uma aula sobre uma regra de convivência, alguém pergunta em que página do livro está localizada a “responsabilidade” de uma estudante.',
    question: 'Que problema aparece nessa pergunta?',
    correct: 'Ela trata uma qualidade ou relação normativa como se fosse um objeto físico localizado em uma página.',
    criterion: 'Uma pergunta pode misturar categorias diferentes quando aplica a uma coisa o tipo de propriedade próprio de outra.',
    transfer: 'Aplique o cuidado a perguntas que tratem uma regra, uma intenção ou uma relação como se fosse um objeto mensurável do mesmo modo.',
    overclaim: 'concluir que uma ideia não existe porque não pode ser localizada como um objeto',
    evidence: 'tipo de entidade discutida, propriedade atribuída e modo adequado de investigá-la',
    nextStep: 'reformular a pergunta para investigar comportamentos, razões ou relações que expressem responsabilidade',
    limit: 'o tipo de coisa que o conceito descreve e o tipo de evidência que ele admite',
    comparison: 'objeto localizado e qualidade ou relação normativa',
    refine: 'a pergunta usa uma propriedade adequada ao tipo de coisa mencionado?',
    distractors: [
      'A responsabilidade existe como objeto em alguma página desconhecida.',
      'Toda pergunta é válida exatamente como foi formulada.',
      'A regra deixa de ter sentido porque não é uma coisa material.',
    ],
  },
  {
    label: 'concept-change',
    context: 'Uma turma inicialmente define “tecnologia” apenas como aparelhos eletrônicos e depois estuda ferramentas, técnicas e formas de organização.',
    question: 'Como descrever a mudança conceitual?',
    correct: 'A definição foi ampliada e refinada para incluir propriedades e exemplos que a formulação inicial não contemplava.',
    criterion: 'Aprender um conceito pode exigir comparar a definição inicial com novas evidências e revisar seus limites.',
    transfer: 'Aplique o processo a conceitos que mudam quando a turma analisa novos casos ou perspectivas.',
    overclaim: 'tratar toda mudança de definição como erro ou como abandono completo do conceito',
    evidence: 'casos novos, propriedades comuns e razões para manter ou excluir exemplos',
    nextStep: 'registrar o que foi mantido, alterado e acrescentado na nova definição',
    limit: 'a versão do conceito construída no percurso e os casos que ela ainda não explica',
    comparison: 'definição inicial e definição revisada diante dos novos casos',
    refine: 'qual nova propriedade fez a turma rever o limite do conceito?',
    distractors: [
      'A turma passou a usar uma palavra diferente, então nenhum conceito foi aprendido.',
      'A definição inicial continua completa porque conceitos não podem mudar.',
      'Qualquer exemplo novo invalida automaticamente todas as definições anteriores.',
    ],
  },
  {
    label: 'classification',
    context: 'Uma biblioteca classifica materiais por assunto, faixa etária e formato, mas um material pode pertencer a mais de uma dessas categorias.',
    question: 'Que conclusão é mais adequada sobre a classificação?',
    correct: 'As categorias respondem a critérios diferentes e podem se sobrepor sem que isso torne a organização incoerente.',
    criterion: 'Uma classificação precisa indicar o critério de cada grupo; categorias de dimensões diferentes podem coexistir.',
    transfer: 'Aplique a ideia ao organizar atividades por tema, habilidade, formato ou nível de apoio.',
    overclaim: 'exigir que todo item pertença a uma única categoria mesmo quando os critérios são diferentes',
    evidence: 'critério de cada categoria, relação entre os grupos e finalidade da organização',
    nextStep: 'nomear as dimensões usadas e permitir sobreposição quando ela for informativa',
    limit: 'a finalidade prática da classificação e o critério que cada rótulo representa',
    comparison: 'categorias por assunto, idade e formato',
    refine: 'o material está sendo classificado segundo qual propriedade em cada lista?',
    distractors: [
      'A sobreposição prova que nenhuma classificação pode ser útil.',
      'Todos os materiais devem receber um único rótulo final.',
      'Categorias só podem existir quando os grupos não têm nenhuma característica comum.',
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
    ['Que pergunta ajuda a refinar o conceito?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v19-phil-distinguish-concept-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V19_PHILOSOPHY_DISTINGUISH_CONCEPT_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `Distinguir conceitos exige observar definição, alcance e critérios de aplicação. ${item.criterion}`,
    hint: 'Compare o significado, os exemplos e os limites do conceito antes de ampliar a conclusão.',
    errorFocus: 'PHILOSOPHY_DISTINGUISH_CONCEPT_DEFINITION_SCOPE_AND_APPLICATION',
    misconceptions: { [item.distractors[0]]: ['PHILOSOPHY_DISTINGUISH_CONCEPT_DEFINITION_SCOPE_AND_APPLICATION'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/philosophy-distinguish-concept.json');
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
    contentId: 'v19-phil-distinguish-concept',
    contentVersion: 19,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 19),
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
      copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V19 autoral com 100 questões; publicação mantida em STAGING e revisão pedagógica pendente.`.trim(),
    },
    sourceReconciliation: {
      ...(previous.sourceReconciliation ?? {}),
      sourceQuestionCount: previous.questions.length,
      newQuestions: 100,
      reusedQuestionsCountedAsNew: false,
      expansionStatus: 'AUTHORIAL_V19',
    },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`PHILOSOPHY_DISTINGUISH_CONCEPT_V19_INVALID:${validation.errors.join(',')}`);
  writeFileSync(
    resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v19-phil-distinguish-concept-expansion-v19.json'),
    `${JSON.stringify(pack, null, 2)}\n`,
  );
  writeFileSync(
    resolve(ROOT, 'supabase/migrations/20261016001800_bncc_philosophy_distinguish_concept_library_expansion_v19.sql'),
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
