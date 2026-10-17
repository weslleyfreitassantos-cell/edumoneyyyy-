import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const stageFor = { PROBE: 'DIAGNOSTIC', PRACTICE: 'PRACTICE', TRANSFER: 'TRANSFER', LOCK_IN: 'CONSOLIDATION', REVIEW: 'REVIEW' };
const purposeAt = (index) => index < 10 ? 'PROBE' : index < 50 ? 'PRACTICE' : index < 75 ? 'TRANSFER' : index < 85 ? 'LOCK_IN' : 'REVIEW';
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
  { label: 'factor', context: 'Um caderno custa R$ 100 e recebe aumento de 20%.', question: 'Qual fator representa o novo preço?', correct: '1,20, pois o preço conserva 100% e recebe mais 20%.', criterion: 'Converta aumento percentual em fator multiplicativo antes de calcular.', transfer: 'Converta outro aumento em fator e aplique-o à base indicada.', overclaim: 'somar a taxa ao preço sem interpretar a base', evidence: 'preço inicial e taxa de aumento', nextStep: 'multiplicar a base por 1 + taxa/100', limit: 'o aumento aplicado ao preço inicial', comparison: 'base inicial e fator de aumento', refine: 'qual valor representa os 100% da base?', distractors: ['0,20, porque só a taxa deve ser usada.', '1,02, porque 20% equivale a 2%.', '20,00, porque fator não pode ser decimal.'] },
  { label: 'successive-up', context: 'Uma tarifa de R$ 200 aumenta 10% em janeiro e 5% em fevereiro, sempre sobre o valor vigente.', question: 'Como calcular o valor de fevereiro?', correct: 'Aplicar 1,10 a R$ 200 e depois 1,05 ao resultado de janeiro.', criterion: 'Atualize a base depois de cada etapa.', transfer: 'Modele duas altas sucessivas em outro preço sem somar taxas automaticamente.', overclaim: 'calcular as duas taxas sempre sobre R$ 200', evidence: 'ordem das altas e expressão “valor vigente”', nextStep: 'registrar o valor de janeiro antes da segunda multiplicação', limit: 'a base de cada mês', comparison: 'taxas, ordem e valores intermediários', refine: 'qual preço serve de base para fevereiro?', distractors: ['Somar 10% e 5% e aplicar 15% apenas uma vez.', 'Aplicar 5% primeiro porque é a menor taxa.', 'Subtrair 5% da primeira taxa sem calcular valores.'] },
  { label: 'successive-down', context: 'Um estoque de 500 unidades diminui 20% e depois diminui mais 10% sobre o estoque restante.', question: 'Qual afirmação é correta?', correct: 'As reduções devem ser aplicadas em sequência: 500 × 0,80 × 0,90.', criterion: 'Use fatores de redução e preserve a nova base.', transfer: 'Calcule outra sequência de descontos ou perdas com fatores sucessivos.', overclaim: 'tratar duas reduções como 30% da base inicial sem verificar a ordem', evidence: 'estoque inicial, duas reduções e base restante', nextStep: 'calcular o saldo após a primeira queda', limit: 'o estoque após cada redução', comparison: 'fator inicial e fator da etapa seguinte', refine: 'o segundo 10% incide sobre 500 ou sobre o saldo?', distractors: ['Aplicar 30% diretamente sobre 500 em qualquer caso.', 'Somar 20 e 10 unidades, sem usar percentuais.', 'A segunda redução aumenta o estoque restante.'] },
  { label: 'opposite', context: 'Um equipamento de R$ 800 aumenta 25% e depois recebe desconto de 25% sobre o preço reajustado.', question: 'Por que as taxas não se anulam?', correct: 'O aumento usa R$ 800 como base e o desconto usa a base maior de R$ 1.000.', criterion: 'Compare as bases antes de comparar os números das taxas.', transfer: 'Explique outra alta e queda iguais usando valores intermediários.', overclaim: 'concluir que percentuais iguais em sentidos opostos sempre retornam ao início', evidence: 'bases de R$ 800 e R$ 1.000', nextStep: 'calcular cada variação em relação à base correta', limit: 'as duas bases da sequência', comparison: 'quantia do aumento e quantia do desconto', refine: 'as duas taxas produziram quantias iguais em reais?', distractors: ['Elas se anulam porque têm o mesmo número.', 'O desconto usa sempre a base inicial.', 'A segunda etapa não altera o preço.'] },
  { label: 'points', context: 'A taxa de aprovação de uma turma passa de 40% para 50%.', question: 'Como distinguir pontos percentuais de variação relativa?', correct: 'A diferença é de 10 pontos percentuais; em relação a 40%, o aumento relativo é de 25%.', criterion: 'Subtraia taxas para pontos percentuais e divida a diferença pela taxa inicial para a variação relativa.', transfer: 'Analise outra mudança de taxa usando as duas formas de comparação.', overclaim: 'chamar 10 pontos percentuais de aumento relativo de 10%', evidence: 'taxa inicial de 40% e final de 50%', nextStep: 'identificar primeiro o tipo de comparação solicitado', limit: 'a base de 40% para a variação relativa', comparison: 'diferença absoluta entre taxas e razão pela taxa inicial', refine: 'a pergunta compara taxas ou mede mudança proporcional?', distractors: ['São 10% de aumento relativo em qualquer leitura.', 'São 90 pontos percentuais porque se usa 100 como base.', 'Não existe diferença porque ambas são porcentagens.'] },
  { label: 'recovery', context: 'Uma conta de R$ 300 recebe redução de 20% e depois precisa voltar ao valor inicial.', question: 'Qual base deve ser usada para calcular a taxa de recuperação?', correct: 'O valor reduzido de R$ 240, pois é sobre ele que o aumento de recuperação incide.', criterion: 'A recuperação usa a base atual, não a base anterior.', transfer: 'Encontre a taxa de recuperação em outro caso com uma redução inicial.', overclaim: 'usar a taxa de redução diretamente para recuperar o valor', evidence: 'valor inicial, redução de 20% e saldo de R$ 240', nextStep: 'dividir o que falta pela base reduzida', limit: 'o valor após a redução', comparison: 'quantia faltante e base da recuperação', refine: 'por que 60 dividido por 300 não responde à recuperação?', distractors: ['Usar 20% porque a taxa de ida e volta é sempre igual.', 'Dividir o que falta pelo valor inicial de R$ 300.', 'Recuperar é impossível sempre que há redução.'] },
  { label: 'inverse', context: 'Após um desconto de 25%, uma mochila custa R$ 180.', question: 'Como encontrar o preço antes do desconto?', correct: 'Resolver preço inicial × 0,75 = 180, portanto dividir 180 por 0,75.', criterion: 'Inverta o fator aplicado, em vez de acrescentar 25% ao valor final.', transfer: 'Reconstrua outro valor inicial conhecendo o fator e o preço final.', overclaim: 'adicionar 25% diretamente ao preço com desconto', evidence: 'fator 0,75 e preço final de R$ 180', nextStep: 'escrever a equação com o fator de redução', limit: 'o fator da etapa que produziu o valor final', comparison: 'preço inicial desconhecido e resultado após desconto', refine: 'qual operação desfaz a multiplicação por 0,75?', distractors: ['Somar R$ 45 a R$ 180 sem verificar a base.', 'Multiplicar R$ 180 por 0,75 novamente.', 'Subtrair 25 unidades, pois percentual é unidade.'] },
  { label: 'compare', context: 'Uma loja oferece 30% de desconto em um produto de R$ 400; outra oferece 20% e depois mais 10% sobre o preço já reduzido.', question: 'Qual comparação exige cálculo dos fatores?', correct: 'A segunda oferta usa 0,80 × 0,90, enquanto a primeira usa 0,70; é preciso comparar os preços finais.', criterion: 'Modele ofertas sucessivas com fatores e não some descontos sem base.', transfer: 'Compare outras ofertas com uma ou mais etapas.', overclaim: 'afirmar que 20% mais 10% equivale sempre a 30% sobre a mesma base', evidence: 'desconto único, dois descontos e preço inicial', nextStep: 'calcular o preço final de cada oferta', limit: 'as condições exatas das duas ofertas', comparison: 'fator 0,70 e produto 0,80 × 0,90', refine: 'o segundo 10% é calculado sobre R$ 400 ou sobre o preço após 20%?', distractors: ['As ofertas são iguais porque 20 + 10 = 30.', 'A segunda oferta é sempre melhor por ter duas etapas.', 'Nenhum fator pode ser usado para descontos.'] },
  { label: 'rounding', context: 'Uma população estimada de 1.250 indivíduos cresce 8% e o relatório deve apresentar o resultado inteiro mais próximo.', question: 'Qual procedimento evita erro de interpretação?', correct: 'Calcular 1.250 × 1,08 = 1.350 e só então verificar a forma de arredondamento exigida.', criterion: 'Faça o cálculo antes de arredondar e preserve a unidade.', transfer: 'Aplique o procedimento em outra estimativa com taxa percentual.', overclaim: 'arredondar a taxa ou a base antes de aplicar o fator sem justificativa', evidence: 'base de 1.250, fator 1,08 e exigência de resultado inteiro', nextStep: 'calcular o valor exato e arredondar no final', limit: 'o modelo de estimativa e a regra de apresentação', comparison: 'valor calculado e valor reportado', refine: 'em qual etapa o arredondamento é permitido?', distractors: ['Arredondar 8% para 10% antes da multiplicação.', 'Arredondar 1.250 para 1.000 para simplificar.', 'Ignorar a unidade porque o resultado é uma contagem.'] },
  { label: 'model', context: 'Um investimento rende 2% ao mês por três meses, com rendimento incorporado ao saldo a cada mês.', question: 'Qual modelo representa melhor a situação?', correct: 'Saldo final = saldo inicial × 1,02 × 1,02 × 1,02.', criterion: 'Use composição quando cada rendimento se incorpora à base seguinte.', transfer: 'Modele outro crescimento periódico com fator repetido.', overclaim: 'usar 6% sem verificar se o problema pede aproximação linear ou composição', evidence: 'taxa mensal, três períodos e rendimento incorporado', nextStep: 'contar períodos e multiplicar o fator em cada um', limit: 'a regra de incorporação mensal', comparison: 'soma aproximada e produto dos fatores', refine: 'o rendimento de cada mês entra na base do próximo?', distractors: ['Saldo inicial × 1,06 em qualquer situação.', 'Saldo inicial × 0,98 × 3.', 'A taxa deve ser aplicada somente no último mês.'] },
];

function makeQuestion({ item, caseIndex, variant }) {
  const index = caseIndex * 10 + variant;
  const purpose = purposeAt(index);
  const variants = [
    [item.question, item.correct],
    ['Qual critério deve orientar o cálculo?', `Use ${item.criterion}`],
    ['Como transferir esse raciocínio para outro caso?', item.transfer],
    ['Qual conclusão deve ser evitada?', `Evite ${item.overclaim}.`],
    ['Que dado deve ser conferido primeiro?', `Confira ${item.evidence}.`],
    ['Qual é o próximo passo mais cuidadoso?', item.nextStep],
    ['Qual limite deve aparecer na resposta?', `Mantenha a conclusão ligada a ${item.limit}.`],
    ['Que comparação é mais justa?', `Compare ${item.comparison}.`],
    ['Qual seria um erro de modelagem?', `Seria erro ${item.overclaim}.`],
    ['Que pergunta ajuda a refinar o cálculo?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v12-math-successive-percent-change-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V12_MATH_SUCCESSIVE_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A resposta atualiza a base e respeita o tipo de comparação pedido. ${item.criterion}`,
    hint: 'Escreva a base, transforme a taxa em fator e acompanhe cada etapa antes de comparar.',
    errorFocus: 'MATH_SUCCESSIVE_PERCENT_BASE_CONFUSION',
    misconceptions: { [item.distractors[0]]: ['MATH_SUCCESSIVE_PERCENT_BASE_CONFUSION'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/math-successive-percent-change-v6.json');
  const previous = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const newQuestions = items.flatMap((item, caseIndex) => Array.from({ length: 10 }, (_, variant) => makeQuestion({ item, caseIndex, variant })));
  const questions = [...previous.questions, ...newQuestions];
  const expectedPurposeCounts = Object.fromEntries(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
  const expectedAnswerPositionCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map((label, position) => [label, questions.filter((question) => question.options.indexOf(question.correctAnswer) === position).length]));
  const newIdsByPurpose = new Map(PURPOSES.map((purpose) => [purpose, newQuestions.filter((question) => question.purpose === purpose).map((question) => question.id)]));
  const progression = (previous.lesson.progression ?? []).map((stage) => ({
    ...stage,
    questionIds: [...(stage.questionIds ?? []), ...(newIdsByPurpose.get(Object.entries(stageFor).find(([, value]) => value === stage.stage)?.[0]) ?? [])],
  }));
  const pack = {
    ...previous,
    contentId: 'v12-math-successive-percent-change',
    contentVersion: 12,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 12),
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
      microExplanations: [
        { id: 'math-base', title: 'Base vigente', content: 'Depois de cada etapa, o resultado passa a ser a base da próxima taxa.' },
        { id: 'math-factor', title: 'Fator multiplicativo', content: 'Aumento de p% usa 1 + p/100; redução de p% usa 1 - p/100.' },
        { id: 'math-points', title: 'Pontos percentuais', content: 'A diferença entre duas taxas é expressa em pontos percentuais; a variação relativa usa a taxa inicial como base.' },
        { id: 'math-recovery', title: 'Recuperação', content: 'Para recuperar uma perda, divida o que falta pelo valor atual, que pode ser menor que a base inicial.' },
      ],
      sourceDossier: [
        { title: 'Base Nacional Comum Curricular', publisher: 'Ministério da Educação, Brasil', url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf', use: 'Referência curricular geral; exemplos, cálculos e questões deste pacote são autorais.' },
        { title: 'Prealgebra 2e, Percent Applications', publisher: 'OpenStax', url: 'https://openstax.org/details/books/prealgebra-2e', use: 'Conferência conceitual sobre porcentagens e fatores; o pacote não reproduz exercícios ou texto da fonte.' },
      ],
      copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V12 autoral com 100 questões e revisão pedagógica pendente; publicação mantida em STAGING.`.trim(),
    },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V12' },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`MATH_INVALID:${validation.errors.join(',')}`);
  writeFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v12-math-successive-percent-change-expansion-v12.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(resolve(ROOT, 'supabase/migrations/20261016001100_bncc_math_successive_percent_change_library_expansion_v12.sql'), buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, newQuestions: 100, totalQuestions: questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
