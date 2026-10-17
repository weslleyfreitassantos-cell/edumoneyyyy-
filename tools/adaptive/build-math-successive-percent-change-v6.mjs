import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ADAPTIVE = join(ROOT, 'content/adaptive');
const SEED_PACK_PATH = join(ADAPTIVE, 'tec-escola-core-v5/math-successive-percent-change.json');
const PACK_PATH = join(ADAPTIVE, 'tec-escola-core-v5/math-successive-percent-change-v6.json');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const authoredSourceFeedback = {
  'v3-mathematics-percentage-6': ['Calcule o valor após a alta e use esse novo valor como base do desconto.', 'Supor que taxas iguais em sentidos opostos se anulam embora incidam sobre bases diferentes.'],
  'v4-authored-mathematics-successive-probe-01': ['Encontre primeiro 120% de R$ 100; depois calcule 10% de desconto sobre esse resultado.', 'Aplicar a redução à base inicial em vez do preço reajustado.'],
  'v4-authored-mathematics-successive-probe-02': ['O desconto deixa 80% do orçamento; aplique o aumento de 10% ao saldo, não aos R$ 250.', 'Usar a base inicial para a segunda variação.'],
  'v4-authored-mathematics-successive-practice-01': ['Atualize o kit após o primeiro aumento e aplique o segundo fator ao preço já reajustado.', 'Somar duas taxas como se fossem percentuais da mesma base.'],
  'v4-authored-mathematics-successive-practice-02': ['Calcule o preço depois do desconto de 25%; só então aplique o reajuste de 20%.', 'Aplicar o segundo percentual ao valor original.'],
  'v4-authored-mathematics-successive-transfer-01': ['Aplique 1,15 ao aluguel e 0,90 ao valor que resultar; confira se o total faz sentido.', 'Somar +15% e -10% sem compor os fatores.'],
  'v4-authored-mathematics-successive-lock-in-01': ['Depois da alta de 50%, calcule qual é a base da queda de 50%.', 'Tratar percentuais iguais como quantias iguais quando a base mudou.'],
  'v4-authored-mathematics-successive-review-01': ['Calcule o reajuste primeiro; a bolsa é 10% do preço reajustado.', 'Subtrair a mesma quantia do aumento mesmo quando a segunda taxa usa outra base.'],
  'v4-authored-mathematics-successive-review-02': ['Compare os fatores 1,25 e 0,80 e acompanhe os valores após cada etapa.', 'Concluir que as taxas se anulam sem verificar as bases e os valores.'],
};

const newQuestions = [
  {
    id: 'v6-math-successive-transfer-03', purpose: 'TRANSFER', difficulty: 'HARD', cognitiveProcess: 'ANALYZE',
    contextFamily: 'COLETA_SELETIVA',
    statement: 'Um ponto de coleta recebeu 2.500 kg de recicláveis em um mês. No mês seguinte, o total cresceu 12%; depois, caiu 5% em relação ao novo total. Qual foi o resultado final e a variação em relação ao primeiro mês?',
    options: ['2.660 kg; aumento de 6,4%.', '2.650 kg; aumento de 6%.', '2.800 kg; aumento de 12%.', '2.660 kg; aumento de 12%.'],
    correctAnswer: '2.660 kg; aumento de 6,4%.',
    explanation: 'A primeira etapa dá 2.500 × 1,12 = 2.800 kg. A redução usa 2.800 como base: 2.800 × 0,95 = 2.660 kg. O acréscimo de 160 kg corresponde a 160 ÷ 2.500 = 6,4%.',
    hint: 'Registre o total depois do crescimento; aplique a queda sobre esse total e compare o resultado com 2.500 kg.',
    errorFocus: 'BASE_ATUALIZADA_E_VARIACAO_TOTAL',
    misconceptions: { '2.650 kg; aumento de 6%.': ['SOMAR_TAXAS_SEM_ATUALIZAR_BASE'], '2.800 kg; aumento de 12%.': ['IGNORAR_SEGUNDA_ETAPA'], '2.660 kg; aumento de 12%.': ['CONFUNDIR_VARIACAO_DA_ETAPA_COM_VARIACAO_TOTAL'] },
  },
  {
    id: 'v6-math-successive-review-01', purpose: 'REVIEW', difficulty: 'HARD', cognitiveProcess: 'EVALUATE',
    contextFamily: 'REVISAO_DE_CONTA',
    statement: 'Uma tarifa de R$ 250 aumenta 20% e, no período seguinte, recebe desconto de 20%. Caio afirma que o valor volta a R$ 250 porque “mais 20 e menos 20 se anulam”. Qual análise corrige o raciocínio?',
    options: ['Volta a R$ 250, pois taxas com o mesmo número sempre se anulam.', 'Termina em R$ 240: a queda é 20% de R$ 300, então fica R$ 10 abaixo do início.', 'Termina em R$ 250, pois o desconto de R$ 60 é calculado sobre a base inicial.', 'Termina em R$ 300, pois só o aumento altera o valor.'],
    correctAnswer: 'Termina em R$ 240: a queda é 20% de R$ 300, então fica R$ 10 abaixo do início.',
    explanation: 'A tarifa sobe de R$ 250 para R$ 300. O desconto é 20% de R$ 300, isto é, R$ 60; o valor final é R$ 240. A redução de R$ 60 não é igual ao aumento inicial de R$ 50.',
    hint: 'Calcule primeiro o aumento em reais; em seguida, encontre 20% do valor já aumentado.',
    errorFocus: 'PERCENTUAIS_IGUAIS_NAO_SAO_QUANTIAS_IGUAIS',
    misconceptions: { 'Volta a R$ 250, pois taxas com o mesmo número sempre se anulam.': ['CANCELAMENTO_INDEVIDO'], 'Termina em R$ 250, pois o desconto de R$ 60 é calculado sobre a base inicial.': ['BASE_INICIAL_REUTILIZADA'], 'Termina em R$ 300, pois só o aumento altera o valor.': ['ETAPA_IGNORADA'] },
  },
  {
    id: 'v6-math-successive-review-02', purpose: 'REVIEW', difficulty: 'HARD', cognitiveProcess: 'COMPARE',
    contextFamily: 'ESTOQUE_DE_REAGENTES',
    statement: 'Um laboratório tinha 40 kg de um reagente. O estoque caiu 30% e, no mês seguinte, cresceu 30% sobre o estoque restante. Qual alternativa informa corretamente a quantidade final e sua relação com a inicial?',
    options: ['40 kg; voltou ao valor inicial porque as taxas se anulam.', '36,4 kg; ficou 3,6% abaixo do valor inicial.', '36,4 kg; ficou 9% abaixo do valor inicial.', '28 kg; a segunda variação não altera a quantidade.'],
    correctAnswer: '36,4 kg; ficou 9% abaixo do valor inicial.',
    explanation: 'Após a queda, restam 40 × 0,70 = 28 kg. O aumento é 30% de 28, ou 8,4 kg, levando o estoque a 36,4 kg. A perda de 3,6 kg equivale a 9% dos 40 kg iniciais.',
    hint: 'Atualize o estoque após a queda. Depois compare o total final com 40 kg, que é a base da variação total.',
    errorFocus: 'COMPOSICAO_E_BASE_DA_VARIACAO_TOTAL',
    misconceptions: { '40 kg; voltou ao valor inicial porque as taxas se anulam.': ['CANCELAMENTO_INDEVIDO'], '36,4 kg; ficou 3,6% abaixo do valor inicial.': ['DIFERENCA_ABSOLUTA_LIDA_COMO_PERCENTUAL'], '28 kg; a segunda variação não altera a quantidade.': ['ETAPA_IGNORADA'] },
  },
  {
    id: 'v6-math-successive-review-03', purpose: 'REVIEW', difficulty: 'HARD', cognitiveProcess: 'APPLY',
    contextFamily: 'CONSUMO_DE_ENERGIA',
    statement: 'Uma instalação reduziu o consumo mensal de 2.500 kWh em 10%. Para voltar exatamente a 2.500 kWh, qual aumento percentual deve incidir sobre o consumo já reduzido?',
    options: ['10%, pois a redução e a recuperação usam a mesma taxa.', '12,5%, pois basta acrescentar metade da redução percentual.', '25%, pois 250 kWh correspondem a um quarto do consumo atual.', '11,1% aproximadamente, pois o aumento incide sobre 2.250 kWh.'],
    correctAnswer: '11,1% aproximadamente, pois o aumento incide sobre 2.250 kWh.',
    explanation: 'Após reduzir 10%, o consumo é 2.250 kWh. Para recuperar 250 kWh, a taxa é 250 ÷ 2.250 ≈ 0,1111, ou 11,1%. A base menor exige uma taxa percentual maior para recuperar a mesma quantidade.',
    hint: 'Calcule o consumo reduzido e divida os 250 kWh que faltam por essa nova base.',
    errorFocus: 'PERCENTUAL_DE_RECUPERACAO_USA_BASE_MENOR',
    misconceptions: { '10%, pois a redução e a recuperação usam a mesma taxa.': ['REAPLICAR_TAXA_SOBRE_BASE_DIFERENTE'], '12,5%, pois basta acrescentar metade da redução percentual.': ['AJUSTE_PROPORCIONAL_SEM_BASE'], '25%, pois 250 kWh correspondem a um quarto do consumo atual.': ['DENOMINADOR_INCORRETO'] },
  },
];

function readSources() {
  const skill = 'MATH_SUCCESSIVE_PERCENT_CHANGE';
  const v4Questions = readJson(join(ADAPTIVE, 'tec-escola-core-v4/subjects/mathematics/questions.json'))
    .filter((question) => question.primarySkill === skill);
  const journey = readJson(join(ADAPTIVE, 'tec-escola-core-v9/journey-expansion-a-v1.json')).journeys
    .find((item) => item.skill === skill && item.journeyCode === 'MATHEMATICS_SUCCESSIVE_PERCENT_V93');
  if (v4Questions.length !== 9 || !Array.isArray(journey?.questions) || journey.questions.length !== 20) {
    throw new Error('MATH_SUCCESSIVE_PERCENT_SOURCE_RECONCILIATION_FAILED');
  }
  const journeyFeedback = journey.questions.map((question) => ({
    questionId: question.id,
    hint: question.remediationHint ?? question.hint,
    errorFocus: question.errorFocus,
  }));
  const feedback = [
    ...v4Questions.map((question) => {
      const [hint, errorFocus] = authoredSourceFeedback[question.id] ?? [];
      if (!hint || !errorFocus) throw new Error(`MATH_SUCCESSIVE_PERCENT_SOURCE_FEEDBACK_MISSING:${question.id}`);
      return { questionId: question.id, hint, errorFocus };
    }),
    ...journeyFeedback,
  ];
  if (feedback.length !== 29 || feedback.some((item) => !item.hint || !item.errorFocus)
    || new Set(feedback.map((item) => item.questionId)).size !== 29) {
    throw new Error('MATH_SUCCESSIVE_PERCENT_SOURCE_FEEDBACK_INCOMPLETE');
  }
  return feedback;
}

export function buildMathSuccessivePercentChangePack() {
  const seed = readJson(SEED_PACK_PATH);
  const newQuestionIds = new Set(newQuestions.map((question) => question.id));
  const priorQuestions = seed.questions.filter((question) => !newQuestionIds.has(question.id));
  if (priorQuestions.length !== 10) throw new Error('MATH_SUCCESSIVE_PERCENT_BASE_PACK_CHANGED');
  const questions = [...priorQuestions, ...newQuestions];
  const positionCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map((label) => [label, questions.filter((question) => question.options.indexOf(question.correctAnswer) === ['A', 'B', 'C', 'D'].indexOf(label)).length]));
  return {
    ...seed,
    contentVersion: 6,
    lessonVersion: 6,
    expectedQuestionCount: 14,
    expectedContextCount: 14,
    expectedPurposeCounts: { PROBE: 2, PRACTICE: 2, TRANSFER: 3, LOCK_IN: 2, REVIEW: 5 },
    expectedAnswerPositionCounts: positionCounts,
    sourceQuestionFeedback: readSources(),
    lesson: {
      ...seed.lesson,
      priorKnowledge: ['Calcular porcentagens de uma quantidade.', 'Interpretar aumentos, reduções e valores de referência.'],
      keyConcepts: ['Cada taxa usa a base vigente naquela etapa.', 'A variação total é relativa ao valor inicial.', 'Pontos percentuais comparam taxas; variação relativa usa uma taxa-base.'],
      progressiveExplanation: [
        'Antes de calcular, escreva a base e o que a pergunta compara. Um aumento de p% é o fator 1 + p/100; uma redução é 1 - p/100.',
        'Aplique cada fator na ordem e atualize a base. Exemplo: R$ 200 com alta de 10% passa a R$ 220; uma queda de 10% sobre R$ 220 retira R$ 22 e termina em R$ 198.',
        'Para obter a variação total, compare o resultado com o valor inicial. De R$ 200 para R$ 198, a mudança é -R$ 2, isto é, -1% da base inicial; não é a soma automática das taxas.',
        'Quando se comparam taxas, diferencie pontos percentuais da variação relativa. De 12% para 15% são 3 pontos percentuais; em relação a 12%, o aumento é 3/12 = 25%.',
      ],
      commonErrors: [
        'Somar taxas sucessivas que incidem sobre bases diferentes.',
        'Usar a base inicial para calcular a segunda etapa.',
        'Confundir diferença absoluta, pontos percentuais e variação relativa.',
        'Calcular uma taxa de recuperação usando a base antes da redução.',
      ],
      remediations: [
        { id: 'UPDATE_PERCENT_BASE', trigger: 'A segunda variação usa a base inicial por engano.', explanation: 'A base deve ser atualizada depois de cada etapa.', workedExample: 'R$ 100 sobe 20% para R$ 120; uma queda de 20% sobre R$ 120 resulta em R$ 96.', selfCheck: 'Qual valor serve de base para a taxa desta etapa?' },
        { id: 'PERCENTAGE_POINTS', trigger: 'Diferença entre taxas é confundida com variação relativa.', explanation: 'Subtraia as taxas para obter pontos percentuais e divida a diferença pela taxa inicial para obter a variação relativa.', workedExample: 'De 8% para 10% são 2 pontos percentuais; relativamente a 8%, o aumento é 25%.', selfCheck: 'A pergunta compara duas taxas ou mede mudança relativa a uma taxa inicial?' },
        { id: 'RECOVERY_BASE', trigger: 'A taxa de recuperação reaplica a redução sobre a base original.', explanation: 'A recuperação percentual incide sobre o valor reduzido, que é uma base menor.', workedExample: 'Depois de cair de 100 para 90, é preciso aumentar 10/90 ≈ 11,1% para voltar a 100.', selfCheck: 'Você dividiu o que falta pela quantidade atual?' },
      ],
    },
    questions,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pack = buildMathSuccessivePercentChangePack();
  writeFileSync(PACK_PATH, `${JSON.stringify(pack, null, 2)}\n`);
  process.stdout.write(`Wrote ${pack.questions.length} staged math questions and ${pack.sourceQuestionFeedback.length} source-feedback records to ${PACK_PATH}\n`);
}
