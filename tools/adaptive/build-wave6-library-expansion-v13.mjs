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
  { label: 'population', context: 'Uma equipe conta indivíduos da mesma espécie em uma área delimitada e repete a contagem no ano seguinte.', question: 'Que unidade ecológica e comparação estão descritas?', correct: 'Uma população observada em dois momentos, porque os indivíduos pertencem à mesma espécie e área definida.', criterion: 'Use espécie, espaço e tempo para interpretar uma população.', transfer: 'Classifique outra contagem ecológica indicando espécie, área e período.', overclaim: 'chamar qualquer conjunto de seres vivos de comunidade', evidence: 'mesma espécie, área delimitada e duas datas', nextStep: 'registrar método, área e período de cada contagem', limit: 'a população e os momentos observados', comparison: 'número de indivíduos e condições de cada ano', refine: 'o conjunto reúne uma espécie ou várias?', distractors: ['Uma comunidade inteira, porque toda contagem local inclui espécies diferentes.', 'A biosfera, pois a contagem ocorreu em ambiente natural.', 'Um ecossistema completo, sem considerar a área.'] },
  { label: 'density', context: 'Duas ilhas têm 100 lagartos cada; uma mede 1 km² e a outra mede 4 km².', question: 'Qual medida permite comparar ocupação do espaço?', correct: 'A densidade, calculada relacionando número de indivíduos e área de cada ilha.', criterion: 'Relacione tamanho da população e área, não apenas o total bruto.', transfer: 'Compare densidades em outro par de áreas com tamanhos diferentes.', overclaim: 'dizer que populações iguais sempre ocupam o espaço com a mesma intensidade', evidence: '100 indivíduos e áreas de 1 km² e 4 km²', nextStep: 'calcular indivíduos por unidade de área', limit: 'as duas ilhas e suas áreas medidas', comparison: 'número total e número por área', refine: 'qual ilha possui mais indivíduos por quilômetro quadrado?', distractors: ['A ilha maior sempre tem maior densidade.', 'Densidade depende apenas da cor dos lagartos.', 'O total de indivíduos já é uma densidade.'] },
  { label: 'sampling', context: 'Uma floresta é grande demais para contar todas as árvores. Pesquisadores selecionam parcelas em locais diferentes e registram a mesma medida em cada parcela.', question: 'Por que usar parcelas variadas?', correct: 'Para obter uma amostra que represente diferentes partes do ambiente e reduzir o risco de um único local distorcer a estimativa.', criterion: 'Avalie amostragem considerando representatividade e padronização.', transfer: 'Planeje amostragem em outro ambiente heterogêneo.', overclaim: 'afirmar que uma parcela prova o número total da floresta', evidence: 'floresta grande, parcelas diferentes e mesma medida', nextStep: 'definir seleção, tamanho e distribuição das parcelas', limit: 'a estimativa produzida pela amostra', comparison: 'locais amostrados e população total estimada', refine: 'as parcelas cobrem condições distintas da floresta?', distractors: ['Uma única árvore representa toda a floresta.', 'Parcelas variadas impedem qualquer comparação.', 'A amostra dispensa registrar o método.'] },
  { label: 'mark', context: 'Em uma lagoa, 40 peixes são marcados e soltos. Na segunda amostragem, 50 peixes são capturados, dos quais 10 têm marca.', question: 'Que cuidado acompanha uma estimativa por marcação e recaptura?', correct: 'Verificar se as marcas permanecem, se os peixes se misturaram e se a captura foi comparável antes de estimar a população.', criterion: 'Considere pressupostos do método antes de tratar a conta como exata.', transfer: 'Analise outra estimativa com amostras e indivíduos marcados.', overclaim: 'dizer que a primeira amostra é sempre o tamanho total da lagoa', evidence: 'marcados, recapturados e condições de mistura', nextStep: 'avaliar pressupostos e calcular uma estimativa com incerteza', limit: 'o método e suas condições', comparison: 'marcação inicial e proporção de recaptura', refine: 'as marcas alteraram a chance de captura?', distractors: ['A população é exatamente 40 porque essa foi a primeira captura.', 'As marcas tornam a estimativa desnecessária.', 'Qualquer peixe sem marca prova que a população dobrou.'] },
  { label: 'trend', context: 'Um gráfico mostra que o número observado de aves diminuiu em três meses, enquanto a vegetação alta aumentou e o horário das observações mudou.', question: 'Qual conclusão é mais responsável?', correct: 'Há uma tendência de menor detecção, mas é preciso avaliar vegetação, horário e outros fatores antes de concluir queda populacional.', criterion: 'Diferencie abundância real de chance de detecção.', transfer: 'Interprete outra série temporal com mudanças no método de observação.', overclaim: 'tratar uma queda de observações como prova imediata de extinção', evidence: 'contagem, vegetação e mudança de horário', nextStep: 'padronizar horários e usar métodos complementares', limit: 'os dados observacionais disponíveis', comparison: 'número observado e condições de detecção', refine: 'a população mudou ou ficou mais difícil de observar?', distractors: ['A espécie foi extinta no primeiro mês de queda.', 'A vegetação não pode afetar a observação.', 'Qualquer gráfico de contagem prova causalidade.'] },
  { label: 'correlation', context: 'Em dois anos, uma população de insetos e a temperatura média aumentaram juntas, mas também houve mudança no uso do solo.', question: 'O que os dados sustentam?', correct: 'Uma associação temporal, não uma causa exclusiva; o uso do solo e outras variáveis também precisam ser investigados.', criterion: 'Separe correlação de causalidade e procure variáveis alternativas.', transfer: 'Avalie outra associação populacional sem transformar coincidência em causa.', overclaim: 'afirmar que a temperatura causou toda a mudança apenas pela simultaneidade', evidence: 'duas séries que aumentam e mudança no uso do solo', nextStep: 'comparar áreas, períodos e variáveis de controle', limit: 'a associação observada nos dois anos', comparison: 'tendência conjunta e explicações alternativas', refine: 'que comparação ajudaria a separar os efeitos?', distractors: ['A simultaneidade prova causa única.', 'Uso do solo não participa de populações.', 'Duas medições bastam para eliminar incerteza.'] },
  { label: 'age', context: 'Uma população de tartarugas apresenta muitos juvenis, poucos adultos e nenhum registro confiável de indivíduos muito velhos.', question: 'Que pergunta ajuda a interpretar a estrutura?', correct: 'Investigar recrutamento, sobrevivência e esforço de amostragem antes de concluir que a população está crescendo.', criterion: 'Use classes etárias e qualidade da amostra para formular hipóteses.', transfer: 'Analise outra estrutura etária separando composição observada e dinâmica futura.', overclaim: 'inferir crescimento automático somente pela presença de juvenis', evidence: 'classes etárias e ausência de registro confiável de adultos velhos', nextStep: 'acompanhar coortes e padronizar a detecção por idade', limit: 'a estrutura etária observada', comparison: 'proporções de juvenis, adultos e velhos', refine: 'a ausência de velhos indica mortalidade ou falha de detecção?', distractors: ['Muitos juvenis sempre significam crescimento garantido.', 'A idade não interfere em uma população.', 'A ausência de registro prova que nenhum adulto velho existe.'] },
  { label: 'season', context: 'Uma área recebe mais aves migratórias no inverno, mas o esforço de observação é maior nessa estação e os observadores usam pontos diferentes.', question: 'Qual procedimento melhora a comparação?', correct: 'Padronizar pontos, esforço e horário ou modelar a detecção antes de comparar os números entre estações.', criterion: 'Controle o método ao interpretar variação sazonal.', transfer: 'Compare outra população em estações diferentes usando esforço equivalente.', overclaim: 'dizer que mais registros significam automaticamente mais indivíduos', evidence: 'estação, esforço, pontos e contagens', nextStep: 'registrar esforço e repetir pontos comparáveis', limit: 'a comparação sazonal com método disponível', comparison: 'número registrado e esforço de observação', refine: 'o aumento veio da população ou da busca mais intensa?', distractors: ['O inverno explica qualquer diferença sem medição.', 'Pontos diferentes tornam toda comparação mais certa.', 'Esforço de observação não precisa ser registrado.'] },
  { label: 'capacity', context: 'Uma população cresce em um ambiente até que alimento e espaço se tornam limitantes; depois o número oscila ao redor de um valor.', question: 'Qual interpretação é compatível?', correct: 'O ambiente pode estar impondo uma capacidade de suporte variável, e o valor depende das condições e recursos.', criterion: 'Relacione tamanho populacional, recursos e condições ambientais.', transfer: 'Analise outra oscilação populacional verificando recursos e perturbações.', overclaim: 'tratar capacidade de suporte como número fixo independente do ambiente', evidence: 'crescimento, alimento, espaço e oscilação', nextStep: 'medir recursos e mudanças ambientais ao longo do tempo', limit: 'as condições observadas no ambiente', comparison: 'tamanho populacional e recursos disponíveis', refine: 'que mudança ambiental alteraria o valor de equilíbrio?', distractors: ['O limite é fixo para sempre.', 'Recursos deixam de importar quando a população cresce.', 'Oscilação prova ausência de competição.'] },
  { label: 'control', context: 'Uma equipe quer testar se a retirada de uma planta invasora altera a abundância de uma espécie nativa. Ela escolhe um local para retirar e outro semelhante sem retirar.', question: 'Por que manter um local de comparação?', correct: 'Para comparar a mudança com uma condição sem a intervenção e avaliar explicações alternativas.', criterion: 'Use controle e medidas antes/depois para interpretar intervenção.', transfer: 'Planeje outra investigação de população com local ou período de referência.', overclaim: 'atribuir qualquer mudança à retirada sem observar o local de comparação', evidence: 'intervenção, local semelhante e medida de abundância', nextStep: 'medir ambos os locais antes e depois com método igual', limit: 'a inferência permitida pelo desenho do estudo', comparison: 'local com intervenção e local de comparação', refine: 'o que aconteceria sem retirar a planta?', distractors: ['O segundo local torna desnecessário medir antes.', 'Qualquer diferença prova a causa sem considerar o ambiente.', 'Controle significa eliminar todos os organismos.'] },
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
    ['Que pergunta ajuda a refinar a investigação?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v13-biology-population-data-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V13_BIOLOGY_POPULATION_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A resposta distingue observação, estimativa e inferência causal, preservando o limite dos dados. ${item.criterion}`,
    hint: 'Separe o dado observado da hipótese e verifique o método de amostragem.',
    errorFocus: 'BIOLOGY_POPULATION_DATA_EVIDENCE_SCOPE',
    misconceptions: { [item.distractors[0]]: ['BIOLOGY_POPULATION_DATA_EVIDENCE_SCOPE'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/biology-population-data.json');
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
    contentId: 'v13-biology-population-data',
    contentVersion: 13,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 13),
    expectedQuestionCount: questions.length,
    expectedContextCount: questions.length,
    expectedPurposeCounts,
    expectedAnswerPositionCounts,
    publicationStatus: 'STAGING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    officialMappingStatus: 'NOT_CLAIMED',
    lesson: { ...previous.lesson, progression, copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V13 autoral com 100 questões e revisão pedagógica pendente; publicação mantida em STAGING.`.trim() },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V13' },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`BIOLOGY_INVALID:${validation.errors.join(',')}`);
  writeFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v13-biology-population-data-expansion-v13.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(resolve(ROOT, 'supabase/migrations/20261016001200_bncc_biology_population_data_library_expansion_v13.sql'), buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, newQuestions: 100, totalQuestions: questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
