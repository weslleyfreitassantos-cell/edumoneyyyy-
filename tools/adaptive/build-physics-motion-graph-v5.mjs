import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/physics-motion-graph.json');
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(ROOT, relativePath), 'utf8'));

const rows = [
  ['probe-01', 'PROBE', 'EASY', 'CALCULATE', 'POSITION_SLOPE_RAMP', 'Em um gráfico posição-tempo, a posição passa de 4 m para 22 m entre 2 s e 8 s, em um trecho reto. Qual é a velocidade média nesse intervalo?', '3 m/s', ['18 m/s', '4 m/s', '26 m/s'], 'A inclinação é Δx/Δt = (22 - 4)/(8 - 2) = 18/6 = 3 m/s.', 'Usar a posição final sem subtrair a inicial ou dividir pela posição em vez do intervalo.', 'Subtraia as duas posições e os dois tempos; depois divida as variações.', 0],
  ['probe-02', 'PROBE', 'MEDIUM', 'DISTINGUISH', 'POSITION_HEIGHT_VS_SLOPE', 'Em um gráfico posição-tempo, um objeto está em x = 20 m no instante 2 s e em x = 28 m no instante 6 s. Qual grandeza é indicada pela altura 28 m no segundo ponto?', 'A posição do objeto nesse instante; a velocidade depende da inclinação.', ['A velocidade instantânea, necessariamente 28 m/s.', 'A aceleração, necessariamente 28 m/s².', 'A distância total percorrida desde o início, necessariamente 28 m.'], 'O eixo vertical representa posição, portanto a altura do ponto informa x = 28 m. A velocidade é obtida pela inclinação, Δx/Δt, não pela altura isolada.', 'Ler a coordenada vertical como velocidade sem verificar o rótulo do eixo.', 'Leia primeiro a unidade e o nome do eixo vertical; altura e inclinação são informações diferentes.', 1],
  ['probe-03', 'PROBE', 'MEDIUM', 'INTERPRET', 'NEGATIVE_VELOCITY_INTERVAL', 'Em um gráfico velocidade-tempo, v = -3 m/s durante 5 s. Qual é o deslocamento nesse intervalo?', '-15 m', ['15 m no sentido positivo', '-0,6 m', '-5 m'], 'Com velocidade constante, o deslocamento é v·Δt = (-3 m/s)·(5 s) = -15 m. O sinal informa o sentido em relação ao eixo escolhido.', 'Trocar o sinal da velocidade por módulo ou dividir velocidade por tempo.', 'Multiplique a velocidade algébrica pelo intervalo; não descarte o sinal.', 2],
  ['practice-01', 'PRACTICE', 'EASY', 'CALCULATE', 'POSITION_TABLE_INTERVAL', 'Uma tabela de um gráfico posição-tempo informa x = -4 m em t = 2 s e x = 14 m em t = 8 s. Qual é a velocidade média entre esses pontos?', '3 m/s', ['2,25 m/s', '18 m/s', '-2 m/s'], 'Δx = 14 - (-4) = 18 m e Δt = 8 - 2 = 6 s. Assim, v_m = 18/6 = 3 m/s.', 'Esquecer que subtrair uma posição negativa aumenta a variação ou usar o tempo final como intervalo.', 'Use Δx = x_final - x_inicial e Δt = t_final - t_inicial.', 3],
  ['practice-02', 'PRACTICE', 'EASY', 'INTERPRET', 'FLAT_POSITION_TRACE', 'Um trecho horizontal em x = 7 m aparece por 4 s em um gráfico posição-tempo. O que se conclui sobre esse trecho?', 'A posição é constante e a velocidade é zero nesse intervalo.', ['O objeto se move a 7 m/s.', 'A aceleração é 7 m/s².', 'O objeto percorre 7 m a cada segundo.'], 'A linha horizontal indica Δx = 0 ao longo do intervalo. Logo, a inclinação e a velocidade são zero; o objeto permanece na posição 7 m.', 'Confundir a altura x = 7 m com velocidade ou distância percorrida por segundo.', 'Neste gráfico, a altura é posição. Compare as posições ao longo do tempo.', 0],
  ['practice-03', 'PRACTICE', 'EASY', 'CALCULATE', 'VELOCITY_RECTANGLE_AREA', 'Em um gráfico velocidade-tempo, v = 4 m/s do instante 1 s ao 7 s. Qual é o deslocamento nesse intervalo?', '24 m', ['6 m', '28 m', '24 m/s'], 'A área do retângulo sob o gráfico é v·Δt = 4·(7 - 1) = 24 m. Como a velocidade é positiva, o deslocamento também é positivo.', 'Multiplicar pela hora final em vez da duração ou manter unidade de velocidade no resultado.', 'A largura do retângulo é 7 - 1 = 6 s; multiplique pela altura 4 m/s.', 1],
  ['practice-04', 'PRACTICE', 'MEDIUM', 'CALCULATE', 'VELOCITY_SLOPE_ACCELERATION', 'Em um gráfico velocidade-tempo, a velocidade aumenta de 2 m/s para 10 m/s entre 3 s e 7 s. Qual é a aceleração média?', '2 m/s²', ['8 m/s²', '3 m/s²', '2,5 m/s²'], 'A inclinação de v por t é Δv/Δt = (10 - 2)/(7 - 3) = 8/4 = 2 m/s².', 'Usar Δv sem dividir pelo intervalo ou confundir inclinação de v-t com velocidade.', 'Calcule a variação da velocidade e divida pelos 4 segundos decorridos.', 2],
  ['practice-05', 'PRACTICE', 'MEDIUM', 'COMPARE', 'POSITION_GRAPHS_DIFFERENT_INTERVALS', 'No gráfico posição-tempo A, a posição cresce 18 m em 6 s. No B, cresce 20 m em 4 s. Qual comparação das velocidades médias está correta?', 'A: 3 m/s; B: 5 m/s; portanto B tem maior velocidade média.', ['A: 18 m/s; B: 20 m/s; portanto B tem maior velocidade.', 'A: 3 m/s; B: 4 m/s; portanto B tem maior velocidade.', 'A: 0,33 m/s; B: 0,2 m/s; portanto A tem maior velocidade.'], 'As inclinações são Δx/Δt: A = 18/6 = 3 m/s e B = 20/4 = 5 m/s. A maior inclinação numérica corresponde à maior velocidade média neste caso.', 'Comparar apenas as variações de posição sem considerar a duração.', 'Calcule separadamente Δx/Δt de cada gráfico antes de comparar.', 3],
  ['practice-06', 'PRACTICE', 'MEDIUM', 'ANALYZE', 'SIGNED_VELOCITY_AREAS', 'Em um gráfico velocidade-tempo, v = +3 m/s por 4 s e depois v = -3 m/s por 4 s. Qual é o deslocamento total?', '0 m', ['24 m', '12 m', '-6 m'], 'A primeira área algébrica é +12 m e a segunda é -12 m. O deslocamento total é a soma assinada: +12 - 12 = 0 m.', 'Somar os módulos das áreas quando se pede deslocamento, ou ignorar o sinal de v.', 'Para deslocamento, some áreas acima e abaixo do eixo com seus sinais.', 0],
  ['practice-07', 'PRACTICE', 'HARD', 'EVALUATE', 'VISUAL_SCALE_MISMATCH', 'Dois gráficos posição-tempo usam escalas diferentes: no A, 1 quadrícula horizontal vale 2 s e 1 vertical vale 5 m; no B, 1 horizontal vale 1 s e 1 vertical vale 1 m. Cada reta sobe 3 quadrículas verticais em 2 horizontais. Como comparar as velocidades?', 'Calcular com as escalas: A = 3,75 m/s e B = 1,5 m/s; A tem maior inclinação física.', ['As velocidades são iguais porque as retas têm o mesmo ângulo desenhado.', 'B tem maior velocidade porque sua escala vertical usa números menores.', 'A velocidade não pode ser comparada quando as escalas são diferentes.'], 'No A, Δx = 15 m e Δt = 4 s, então 3,75 m/s. No B, Δx = 3 m e Δt = 2 s, então 1,5 m/s. O aspecto visual sozinho não basta.', 'Comparar o ângulo na tela sem converter quadrículas em valores dos eixos.', 'Transforme cada quadrícula em unidade física e só então calcule Δx/Δt.', 1],
  ['transfer-01', 'TRANSFER', 'MEDIUM', 'CALCULATE', 'ELEVATOR_POSITION_OFFSET', 'Um elevador está em x = 7 m no instante 2 s e em x = 31 m no instante 8 s. Qual é o deslocamento e a velocidade média no intervalo?', '24 m e 4 m/s', ['31 m e 3,9 m/s', '24 m e 6 m/s', '38 m e 4 m/s'], 'O deslocamento é 31 - 7 = 24 m. O intervalo é 8 - 2 = 6 s; v_m = 24/6 = 4 m/s.', 'Usar a coordenada final como deslocamento ou dividir pela hora final em vez do intervalo.', 'Subtraia a posição inicial e o instante inicial antes de calcular a razão.', 2],
  ['transfer-02', 'TRANSFER', 'HARD', 'ANALYZE', 'VELOCITY_AREA_DISTANCE_VS_DISPLACEMENT', 'Em um gráfico velocidade-tempo, v = +6 m/s de 0 a 2 s e v = -3 m/s de 2 a 6 s. Qual é a distância total percorrida?', '24 m', ['0 m', '12 m', '24 m de deslocamento e distância.'], 'Os deslocamentos dos trechos são +12 m e -12 m. A distância soma os módulos: 12 + 12 = 24 m; o deslocamento resultante é zero.', 'Confundir distância total com deslocamento algébrico ou atribuir sinal à distância.', 'Para distância, some os módulos das áreas; para deslocamento, some as áreas com sinal.', 3],
  ['transfer-03', 'TRANSFER', 'MEDIUM', 'DISTINGUISH', 'POSITION_TRACE_THREE_SEGMENTS', 'Um gráfico posição-tempo tem inclinação positiva no primeiro trecho, zero no segundo e negativa no terceiro. Qual sequência descreve o movimento?', 'Move-se no sentido positivo, fica parado e depois se move no sentido negativo.', ['Acelera continuamente, pois a linha muda de inclinação.', 'Fica parado, move-se no sentido positivo e depois acelera.', 'Move-se sempre no sentido positivo, mas cada vez mais devagar.'], 'Em x-t, o sinal da inclinação indica o sentido da velocidade: positivo, zero e negativo. A descrição não permite concluir que a aceleração seja contínua.', 'Ler toda mudança de inclinação como aceleração contínua ou ignorar o sinal.', 'Interprete a inclinação em cada trecho separadamente e não infira mais do que o gráfico mostra.', 0],
  ['transfer-04', 'TRANSFER', 'HARD', 'CALCULATE', 'TRIANGULAR_VELOCITY_AREA', 'Um gráfico velocidade-tempo mostra uma reta que vai de 0 m/s em 0 s a 8 m/s em 4 s. Qual deslocamento ocorre nesses 4 s?', '16 m', ['32 m', '4 m', '8 m'], 'A área sob a reta é um triângulo: (base × altura)/2 = (4 s × 8 m/s)/2 = 16 m.', 'Tratar a área triangular como retângulo e esquecer o fator 1/2.', 'Desenhe o triângulo sob a reta e use metade do produto base × altura.', 1],
  ['lock-01', 'LOCK_IN', 'MEDIUM', 'EVALUATE', 'GRAPH_HEIGHT_SPEED_CLAIM', 'Uma estudante afirma: “No gráfico posição-tempo, o ponto mais alto sempre representa o objeto mais veloz.” Qual avaliação é correta?', 'A altura indica posição; a velocidade média depende da inclinação no intervalo.', ['A afirmação é correta: maior posição significa maior velocidade.', 'A altura indica aceleração e a inclinação indica posição.', 'A velocidade é o tempo indicado no eixo horizontal.'], 'Em x-t, a coordenada vertical é posição. A velocidade média depende de Δx/Δt; um objeto pode estar numa posição alta e parado, com inclinação zero.', 'Confundir o valor instantâneo da posição com a taxa de variação da posição.', 'Separe a coordenada do ponto da inclinação da curva ao redor dele.', 2],
  ['lock-02', 'LOCK_IN', 'HARD', 'INTERPRET', 'NEGATIVE_VT_DISTANCE', 'Um gráfico v-t mostra v = -2 m/s durante 6 s. Qual par descreve deslocamento e distância percorrida?', '-12 m de deslocamento; 12 m de distância.', ['12 m no sentido positivo; distância 12 m.', '-12 m de deslocamento; a distância é igual a -12 m.', '0 m de deslocamento; 12 m de distância.'], 'O deslocamento é a área algébrica: (-2)·6 = -12 m. A distância é o módulo do caminho nesse trecho: 12 m.', 'Atribuir sinal negativo à distância ou retirar o sinal do deslocamento.', 'Mantenha o sinal para deslocamento e use o módulo para distância.', 3],
  ['lock-03', 'LOCK_IN', 'MEDIUM', 'DISTINGUISH', 'HORIZONTAL_LINE_GRAPH_TYPE', 'Uma linha horizontal aparece em v = 5 m/s por 7 s. Qual interpretação respeita o tipo de gráfico?', 'No gráfico velocidade-tempo, a velocidade é constante e a aceleração é zero.', ['O objeto está parado porque toda linha horizontal indica repouso.', 'A posição permanece constante em 5 m.', 'A aceleração é constante e igual a 5 m/s².'], 'No gráfico v-t, a altura informa velocidade. Se ela é constante, a inclinação Δv/Δt é zero; repouso corresponderia a v = 0.', 'Aplicar a interpretação de trecho horizontal de um gráfico posição-tempo a um gráfico velocidade-tempo.', 'Antes de interpretar uma linha horizontal, confirme qual grandeza está no eixo vertical.', 0],
  ['review-01', 'REVIEW', 'MEDIUM', 'ANALYZE', 'VELOCITY_CROSSING_ZERO', 'Em um gráfico velocidade-tempo, a curva cruza de valores positivos para negativos. O que se pode concluir no instante do cruzamento?', 'A velocidade é zero naquele instante; a posição não precisa ser zero.', ['A posição e a velocidade são zero necessariamente.', 'O objeto fica parado durante todo o intervalo mostrado.', 'A aceleração é zero no cruzamento.'], 'O valor v = 0 no cruzamento indica velocidade nula naquele instante. A posição depende do histórico do movimento; o sinal da inclinação, não o cruzamento em si, informa aceleração.', 'Confundir a velocidade nula com posição nula ou repouso durante todo o período.', 'Leia o eixo vertical no cruzamento e não infira a posição sem um gráfico x-t ou condição inicial.', 1],
  ['review-02', 'REVIEW', 'HARD', 'CALCULATE', 'VELOCITY_CHANGE_SIGN', 'Em um gráfico velocidade-tempo, a velocidade passa de +8 m/s para -4 m/s em 3 s, em uma reta. Qual é a aceleração média?', '-4 m/s²', ['5 m/s²', '-12 m/s²', '6 m/s²'], 'Δv = -4 - 8 = -12 m/s. Dividindo por 3 s, a aceleração média é -4 m/s².', 'Usar a diferença de módulos ou não considerar o sinal da velocidade final.', 'Faça velocidade final menos inicial, preservando os sinais, e divida pelo intervalo.', 2],
  ['review-04', 'REVIEW', 'HARD', 'EVALUATE', 'GRAPH_EVIDENCE_LIMITS', 'Um gráfico posição-tempo mostra apenas os pontos x = 2 m em 0 s e x = 10 m em 4 s, sem informação sobre o caminho entre eles. Qual conclusão é garantida?', 'A velocidade média no intervalo é 2 m/s; o detalhe do movimento entre os pontos não foi informado.', ['A velocidade foi constante e igual a 2 m/s em todos os instantes.', 'A distância total percorrida foi exatamente 8 m, mesmo se houve retornos.', 'A aceleração foi zero durante os 4 s.'], 'A velocidade média resulta de Δx/Δt = (10 - 2)/4 = 2 m/s. Dois pontos não determinam se houve mudanças de sentido ou aceleração entre eles.', 'Tratar a secante entre dois pontos como prova de movimento uniforme em todo o intervalo.', 'Diferencie o que a variação média permite calcular do que exigiria a forma completa da curva.', 3],
  ['review-05', 'REVIEW', 'MEDIUM', 'INTERPRET', 'POSITION_LOCAL_EXTREMUM', 'Uma curva suave de posição-tempo atinge um máximo local em x = 12 m. Qual é a velocidade instantânea nesse instante?', '0 m/s', ['12 m/s', 'A aceleração é necessariamente zero.', '1 m/s²'], 'No máximo local suave, a tangente à curva é horizontal naquele instante. Sua inclinação, que representa velocidade instantânea, é zero.', 'Confundir a posição do máximo com a velocidade ou estender a conclusão sobre aceleração.', 'A velocidade instantânea é a inclinação da tangente, não a altura do ponto.', 0],
  ['review-06', 'REVIEW', 'MEDIUM', 'CALCULATE', 'VT_DECELERATION_INTERVAL', 'Em um gráfico v-t, a velocidade cai de 9 m/s em 2 s para 0 m/s em 5 s. Qual é a aceleração média nesse intervalo?', '-3 m/s²', ['4 m/s²', '-9 m/s²', '0 m/s²'], 'Δv/Δt = (0 - 9)/(5 - 2) = -9/3 = -3 m/s².', 'Usar apenas o módulo da redução ou dividir pela coordenada final do tempo.', 'Subtraia velocidades e instantes na mesma ordem: final menos inicial.', 1],
  ['review-07', 'REVIEW', 'HARD', 'CALCULATE', 'VT_TRAPEZOID_AREA', 'Em um gráfico v-t, a velocidade aumenta linearmente de 2 m/s para 6 m/s durante 5 s. Qual é o deslocamento?', '20 m', ['30 m', '10 m', '4 m'], 'A área do trapézio é velocidade média × tempo: ((2 + 6)/2)·5 = 4·5 = 20 m.', 'Usar só a velocidade final ou calcular a variação de velocidade como deslocamento.', 'Para uma variação linear, use a velocidade média dos extremos vezes a duração.', 2],
  ['review-08', 'REVIEW', 'MEDIUM', 'DISTINGUISH', 'NEGATIVE_CONSTANT_VELOCITY_GRAPHS', 'Um objeto tem velocidade constante negativa. Qual par de gráficos é compatível com esse movimento?', 'Uma reta decrescente em x-t e uma linha horizontal abaixo de zero em v-t.', ['Uma reta horizontal em x-t e uma linha horizontal acima de zero em v-t.', 'Uma reta crescente em x-t e uma linha horizontal em v = 0 no gráfico v-t.', 'Uma curva crescente em x-t e uma linha vertical em v-t.'], 'Velocidade negativa constante produz posição que diminui linearmente e valor de velocidade constante abaixo do eixo v = 0.', 'Interpretar o sinal da posição como direção da velocidade ou confundir constância de x com constância de v.', 'Ligue a inclinação negativa em x-t ao valor negativo constante em v-t.', 3],
];

const purposeCounts = { PROBE: 3, PRACTICE: 7, TRANSFER: 4, LOCK_IN: 3, REVIEW: 7 };
const answerPositionCounts = [0, 0, 0, 0];
const questions = rows.map(([id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, errorFocus, hint, answerPosition]) => {
  const options = [...distractors];
  options.splice(answerPosition, 0, correctAnswer);
  answerPositionCounts[answerPosition] += 1;
  return {
    id: `v5-physics-motion-graph-${id}`,
    purpose,
    difficulty,
    cognitiveProcess,
    contextFamily,
    statement,
    options,
    correctAnswer,
    explanation,
    errorFocus,
    hint,
    misconceptions: Object.fromEntries(distractors.map((option, index) => [option, [`${errorFocus} Distrator ${index + 1}.`]])),
  };
});

const v4Questions = readJson('content/adaptive/tec-escola-core-v4/subjects/physics/questions.json')
  .filter((question) => question.primarySkill === 'PHYSICS_INTERPRET_MOTION_GRAPH');
const v9Questions = readJson('content/adaptive/tec-escola-core-v9/journey-expansion-a-v1.json').journeys
  .filter((journey) => journey.skill === 'PHYSICS_INTERPRET_MOTION_GRAPH')
  .flatMap((journey) => journey.questions ?? []);
const originalQuestions = [...v4Questions, ...v9Questions];
const sourceFeedbackById = {
  'v3-physics-physics_average_speed-5': ['Leia a inclinação como variação de posição dividida pela variação de tempo.', 'Confundir a inclinação do gráfico posição-tempo com outras grandezas.'],
  'v3-physics-physics_average_speed-10': ['Em um gráfico velocidade-tempo, a área algébrica acumula deslocamento.', 'Confundir a área com massa, aceleração ou a altura do gráfico.'],
};
const sourceQuestionFeedback = originalQuestions.map((question) => {
  const feedback = sourceFeedbackById[question.id] ?? [question.remediationHint, question.errorFocus];
  if (!feedback[0] || !feedback[1]) throw new Error(`PHYSICS_MOTION_GRAPH_SOURCE_FEEDBACK_MISSING:${question.id}`);
  return { questionId: question.id, hint: feedback[0], errorFocus: feedback[1] };
});
if (originalQuestions.length !== 22 || sourceQuestionFeedback.length !== 22) {
  throw new Error('PHYSICS_MOTION_GRAPH_SOURCE_RECONCILIATION_FAILED');
}

const idsFor = (purpose) => questions.filter((question) => question.purpose === purpose).map((question) => question.id);
const pack = {
  packVersion: 'tec-escola-core-v5-question-first',
  contentId: 'v5-physics-motion-graph',
  subject: 'PHYSICS',
  domain: 'MOVIMENTO',
  topic: 'interpretacao_de_graficos_de_movimento',
  canonicalSkillCode: 'PHYSICS_INTERPRET_MOTION_GRAPH',
  contentVersion: 5,
  lessonVersion: 6,
  expectedQuestionCount: questions.length,
  expectedContextCount: new Set(questions.map((question) => question.contextFamily)).size,
  expectedAnswerPositionCounts: Object.fromEntries(['A', 'B', 'C', 'D'].map((label, index) => [label, answerPositionCounts[index]])),
  expectedPurposeCounts: purposeCounts,
  officialMappingStatus: 'NOT_CLAIMED',
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
  publicationStatus: 'STAGING',
  contentAuthoringStatus: 'AUTHORED',
  sourceQuestionFeedback,
  questions,
  lesson: {
    title: 'Ler gráficos de movimento: posição, velocidade e área',
    objective: 'Interpretar gráficos posição-tempo e velocidade-tempo usando eixos, escalas, inclinação e área para descrever o movimento sem confundir posição, velocidade, aceleração, distância e deslocamento.',
    summary: 'O significado de um gráfico depende dos eixos. Em x-t, a inclinação é velocidade; em v-t, a inclinação é aceleração e a área algébrica é deslocamento. Escala e sinal fazem parte da leitura.',
    explanation: '## 1. Leia os eixos antes do desenho\nUm gráfico não é um desenho do caminho do objeto. Leia o nome e a unidade dos dois eixos. Em posição-tempo (x-t), a altura de um ponto é a posição naquele instante. Em velocidade-tempo (v-t), a altura é a velocidade. A mesma linha horizontal tem interpretações diferentes conforme a variável vertical.\n\n## 2. Em posição-tempo, a inclinação representa velocidade\nEscolha dois pontos de um trecho e calcule v_m = Δx/Δt = (x₂ - x₁)/(t₂ - t₁). A inclinação positiva indica movimento no sentido positivo do eixo escolhido; negativa, no sentido oposto; zero, posição constante naquele intervalo. A altura do ponto não é velocidade. Uma posição grande pode coexistir com repouso.\n\nSe o trecho é curvo, a razão entre dois pontos fornece velocidade média no intervalo. A velocidade em um instante corresponde à inclinação local; não se deve chamar toda secante de velocidade constante. Com escalas diferentes, converta quadrículas para valores de x e t antes de comparar retas.\n\n## 3. Em velocidade-tempo, inclinação e área respondem a perguntas distintas\nA inclinação de v-t é aceleração média: a_m = Δv/Δt. Uma linha horizontal em v = 5 m/s significa velocidade constante de 5 m/s, portanto aceleração zero; não significa repouso. Repouso aparece em v = 0.\n\nA área algébrica entre a linha e o eixo do tempo representa deslocamento. Para velocidade constante, a área é um retângulo: Δx = v·Δt. Para uma variação linear de 0 a 8 m/s em 4 s, é um triângulo: Δx = (4·8)/2 = 16 m. A unidade confirma a operação: (m/s)·s = m.\n\n## 4. Preserve o sinal e diferencie distância de deslocamento\nÁreas acima do eixo em v-t são positivas; abaixo, negativas. Somá-las com sinal dá deslocamento. Para distância percorrida, some os módulos das áreas, pois distância não fica negativa. Por exemplo, +3 m/s por 4 s e -3 m/s por 4 s produzem deslocamento +12 - 12 = 0 m, mas distância 12 + 12 = 24 m.\n\nO sinal depende do sentido positivo escolhido. Velocidade negativa não quer dizer posição negativa; velocidade zero num instante não significa que a posição seja zero nem que o objeto permaneça parado antes e depois.\n\n## 5. Não conclua além dos dados\nDois pontos de x-t determinam a velocidade média entre eles, mas não revelam se houve aceleração ou mudança de sentido no meio. Uma reta desenhada entre os pontos só representa velocidade constante se o enunciado ou o gráfico completo sustentar essa interpretação. Registre o que o gráfico permite afirmar e o que ainda não foi informado.\n\n## Exemplo resolvido\nUm gráfico v-t mostra v = +6 m/s de 0 a 2 s e v = -3 m/s de 2 a 6 s. No primeiro trecho, a área é +6·2 = +12 m. No segundo, é -3·4 = -12 m. O deslocamento total é +12 - 12 = 0 m. Já a distância percorrida é |12| + |-12| = 24 m. A resposta muda porque deslocamento soma áreas com sinal e distância soma seus módulos.',
    workedExample: 'Para v = +6 m/s por 2 s e depois v = -3 m/s por 4 s: deslocamento = (+6)(2) + (-3)(4) = 0 m; distância = |(+6)(2)| + |(-3)(4)| = 24 m. Confira as unidades: m/s vezes s resulta em m.',
    commonMistake: 'Interpretar a altura como velocidade em um gráfico x-t; tratar toda linha horizontal como repouso; comparar o ângulo sem levar em conta escala; ou somar áreas de v-t sem sinal quando a pergunta pede deslocamento.',
    commonErrors: ['Confundir altura e inclinação em x-t.', 'Usar x_final/ t_final em vez de Δx/Δt.', 'Interpretar trecho horizontal em v-t como repouso.', 'Comparar ângulos desenhados em escalas diferentes.', 'Confundir área algébrica (deslocamento) com soma dos módulos (distância).', 'Deduzir movimento uniforme a partir de apenas dois pontos.'],
    tips: ['Escreva x-t ou v-t ao lado do gráfico antes de interpretá-lo.', 'Marque dois pontos e calcule as variações, não use coordenadas isoladas.', 'Em v-t, desenhe as regiões e anote os sinais antes de somar.', 'Faça uma checagem de unidades e diferencie conclusão média de comportamento instantâneo.'],
    priorKnowledge: ['Ler coordenadas e escalas em eixos cartesianos.', 'Calcular diferenças entre valores positivos e negativos.', 'Multiplicar unidades como m/s por s e interpretar sinais relativos a um eixo.'],
    keyConcepts: ['posição como altura em x-t', 'velocidade como inclinação em x-t', 'aceleração como inclinação em v-t', 'deslocamento como área algébrica em v-t', 'distância como soma dos módulos das áreas', 'escala e limites de inferência'],
    progression: [
      { stage: 'DIAGNOSTIC', focus: 'Separar coordenada vertical, inclinação e sinal no gráfico apresentado.', questionIds: idsFor('PROBE') },
      { stage: 'PRACTICE', focus: 'Calcular inclinações e áreas em trechos simples e verificar unidades.', questionIds: idsFor('PRACTICE') },
      { stage: 'TRANSFER', focus: 'Combinar trechos, escalas e sentidos para resolver situações novas.', questionIds: idsFor('TRANSFER') },
      { stage: 'CONSOLIDATION', focus: 'Explicar o significado físico das representações e resolver erros comuns.', questionIds: idsFor('LOCK_IN') },
      { stage: 'REVIEW', focus: 'Retomar sinais e limites de inferência em contextos variados.', questionIds: idsFor('REVIEW') },
    ],
    microExplanations: [
      { trigger: 'GRAPH_AXES_FIRST', text: 'A leitura da linha depende da variável no eixo vertical; identifique gráfico x-t ou v-t primeiro.' },
      { trigger: 'SLOPE_FROM_CHANGES', text: 'Inclinação é variação vertical dividida pela variação horizontal, com unidades.' },
      { trigger: 'SIGNED_AREA', text: 'Em v-t, áreas abaixo do eixo contam negativas para deslocamento.' },
      { trigger: 'DISTANCE_VS_DISPLACEMENT', text: 'A distância soma módulos; o deslocamento soma áreas com sinais.' },
      { trigger: 'SCALE_AND_EVIDENCE', text: 'Use números dos eixos e não infira o trecho entre pontos sem evidência.' },
    ],
    remediations: [
      { id: 'AXIS_MIXUP', misconception: 'ALTURA_LIDA_COMO_INCLINACAO', prompt: 'Diga o que cada eixo mede. Em seguida, calcule uma inclinação com dois pontos e compare com a altura de um deles.' },
      { id: 'VT_AREA_SIGN', misconception: 'AREA_SEM_SINAL', prompt: 'Separe o gráfico v-t nos cruzamentos com o eixo, calcule cada área e escreva seu sinal antes de somar.' },
      { id: 'DISTANCE_DISPLACEMENT', misconception: 'DISTANCIA_CONFUNDIDA_COM_DESLOCAMENTO', prompt: 'Some as áreas algébricas para deslocamento; depois some os valores absolutos para distância.' },
      { id: 'VISUAL_SCALE', misconception: 'ANGULO_VISUAL_SEM_ESCALA', prompt: 'Converta quadrículas em unidades reais dos eixos e recalcule Δx/Δt.' },
      { id: 'EVIDENCE_LIMIT', misconception: 'MEDIA_CONFUNDIDA_COM_INSTANTANEA', prompt: 'Identifique o intervalo coberto pelos pontos. Que informação seria necessária para afirmar como o movimento ocorreu dentro dele?' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 26,
    sourceDossier: [
      {
        title: 'Graphical Analysis of One-Dimensional Motion',
        publisher: 'OpenStax, College Physics 2e',
        url: 'https://openstax.org/books/college-physics-2e/pages/2-8-graphical-analysis-of-one-dimensional-motion',
        accessedOn: '2026-10-13',
        supports: ['Leitura de gráficos posição-tempo e velocidade-tempo.', 'Relação entre inclinação, velocidade e aceleração; área em gráfico velocidade-tempo.'],
        use: 'Referência conceitual. Os itens, exemplos numéricos, feedback e explicações deste pacote foram escritos para o TecEscola.',
      },
    ],
    copyrightNote: 'Itens, exemplos e explicações deste pacote são autorais. A fonte sustenta conceitos de cinemática; correspondência oficial BNCC e revisão pedagógica humana permanecem pendentes.',
  },
};

const actualPurposeCounts = Object.fromEntries(Object.keys(purposeCounts).map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
if (questions.length !== 24 || JSON.stringify(actualPurposeCounts) !== JSON.stringify(purposeCounts)) {
  throw new Error('PHYSICS_MOTION_GRAPH_V5_QUESTION_COUNTS_INVALID');
}
if (answerPositionCounts.some((count) => count !== 6)) throw new Error('PHYSICS_MOTION_GRAPH_V5_ANSWER_POSITIONS_UNBALANCED');

export function buildPhysicsMotionGraphPack() {
  return structuredClone(pack);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Wrote ${questions.length} original physics questions and ${sourceQuestionFeedback.length} source-feedback records to ${OUTPUT}`);
}
