import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/physics-average-speed.json');

const rows = [
  ['practice-01', 'PRACTICE', 'EASY', 'APPLY', 'WALKWAY_TIMING', 'Uma pessoa percorre 1,2 km em 20 min. Qual é a rapidez média em km/h?', '3,6 km/h', ['0,06 km/h', '24 km/h', '36 km/h'], 'Converta 20 min em 1/3 h. Então 1,2 ÷ (1/3) = 3,6 km/h.', 'Usar minutos como se fossem horas ou multiplicar as grandezas.', 'Escreva primeiro o tempo em horas; depois divida a distância pelo intervalo.', 0],
  ['practice-02', 'PRACTICE', 'MEDIUM', 'APPLY', 'DELIVERY_INTERVAL', 'Um entregador percorre 18 km entre 13h40 e 14h10, sem considerar o sentido do trajeto. Qual é a rapidez média?', '36 km/h', ['18 km/h', '30 km/h', '540 km/h'], 'O intervalo é 30 min = 0,5 h. A rapidez média é 18 ÷ 0,5 = 36 km/h.', 'Subtrair os horários sem converter o intervalo para a unidade da resposta.', 'Calcule o tempo decorrido, não use a hora final como duração.', 1],
  ['practice-03', 'PRACTICE', 'MEDIUM', 'INTERPRET', 'POOL_LAP_COUNT', 'Uma nadadora completa 8 voltas em uma piscina de 25 m em 4 min. Qual é sua rapidez média em m/s?', '0,83 m/s', ['6,25 m/s', '1,67 m/s', '200 m/s'], 'A distância total é 8 × 25 = 200 m. Quatro minutos são 240 s; 200 ÷ 240 ≈ 0,83 m/s.', 'Usar o comprimento de uma volta em vez da distância total ou esquecer a conversão de minutos.', 'Multiplique o número de voltas pelo comprimento e depois converta o tempo para segundos.', 2],
  ['practice-04', 'PRACTICE', 'HARD', 'ANALYZE', 'TRAIN_STOP_RECORD', 'Um trem percorre 72 km em 1 h e 30 min, incluindo uma parada de 10 min. Qual é a rapidez média da viagem inteira?', '48 km/h', ['54 km/h', '80 km/h', '72 km/h'], 'O tempo total decorrido continua sendo 1,5 h, incluindo a parada. Portanto, 72 ÷ 1,5 = 48 km/h.', 'Retirar a parada do intervalo quando a pergunta considera a viagem inteira.', 'Use o tempo entre a partida e a chegada; só exclua a parada se o enunciado pedir tempo em movimento.', 3],
  ['practice-05', 'PRACTICE', 'MEDIUM', 'COMPARE', 'SCHOOL_ROUTE_LOG', 'Dois trajetos têm 12 km. O trajeto A leva 20 min e o B, 30 min. Qual comparação está correta?', 'A tem rapidez média de 36 km/h e B de 24 km/h.', ['A tem 24 km/h e B 36 km/h.', 'Os dois têm 12 km/h porque a distância é igual.', 'A tem 0,6 km/h e B 0,4 km/h.'], '20 min = 1/3 h, então A: 12 ÷ 1/3 = 36 km/h. Para B, 30 min = 0,5 h: 12 ÷ 0,5 = 24 km/h.', 'Comparar só a distância e ignorar que os intervalos são diferentes.', 'Converta cada duração e calcule cada razão com as mesmas unidades.', 0],
  ['practice-06', 'PRACTICE', 'HARD', 'EVALUATE', 'TWO_SEGMENT_TRIP', 'Em um percurso de 30 km, uma van percorre 10 km a 20 km/h e os 20 km restantes a 40 km/h. Qual é a rapidez média total?', '30 km/h', ['20 km/h', '26,7 km/h', '40 km/h'], 'Os tempos são 10/20 = 0,5 h e 20/40 = 0,5 h. A viagem soma 30 km em 1 h, logo a rapidez média é 30 km/h.', 'Fazer a média aritmética das velocidades sem ponderar pelos tempos ou distâncias.', 'Calcule os tempos dos trechos, some distância e tempo e só então divida.', 1],
  ['transfer-01', 'TRANSFER', 'MEDIUM', 'INTERPRET', 'FERRY_SCHEDULE', 'Uma balsa percorre 4,5 km entre dois pontos em 15 min. Mantido o mesmo ritmo médio, quanto tempo levaria para percorrer 7,2 km?', '24 min', ['18 min', '30 min', '36 min'], 'A rapidez é 4,5 ÷ 15 = 0,3 km/min. Para 7,2 km, o tempo é 7,2 ÷ 0,3 = 24 min.', 'Aplicar uma proporção invertida: maior distância exige menor tempo no mesmo ritmo.', 'Encontre a razão distância/tempo e use-a para calcular a duração pedida.', 2],
  ['transfer-02', 'TRANSFER', 'HARD', 'ANALYZE', 'HIKING_RETURN_ROUTE', 'Em uma trilha, uma pessoa caminha 3 km até um mirante em 1 h e retorna pelo mesmo caminho em 1,5 h. Qual afirmação distingue corretamente rapidez média e velocidade média no percurso completo?', 'A rapidez média é 2,4 km/h e a velocidade média é zero, pois o deslocamento total é zero.', ['As duas médias são zero porque a pessoa terminou onde começou.', 'Ambas são 2,4 km/h porque a distância total é 6 km.', 'A rapidez média é zero e a velocidade média é 2,4 km/h.'], 'A distância total é 6 km e o tempo total 2,5 h, então a rapidez média é 2,4 km/h. Como posição final e inicial coincidem, o deslocamento e a velocidade média vetorial são zero.', 'Confundir distância percorrida com deslocamento ou tratar rapidez e velocidade como sinônimos.', 'Some o caminho para a rapidez; compare posições inicial e final para o deslocamento.', 3],
  ['transfer-03', 'TRANSFER', 'MEDIUM', 'APPLY', 'CYCLING_UNIT_CHANGE', 'Uma ciclista mantém rapidez média de 5 m/s por 12 min. Quantos quilômetros percorre nesse intervalo?', '3,6 km', ['0,36 km', '60 km', '36 km'], '12 min = 720 s. A distância é 5 × 720 = 3.600 m = 3,6 km.', 'Multiplicar por 12 sem converter minutos para segundos ou trocar metros por quilômetros.', 'Use distância = rapidez × tempo com unidades compatíveis e converta o resultado final.', 0],
  ['transfer-04', 'TRANSFER', 'HARD', 'EVALUATE', 'ROBOT_CART_SENSOR', 'Um carrinho percorre 2 m em 1 s, fica parado por 3 s e percorre mais 2 m em 1 s. Um relatório informa rapidez média de 2 m/s. Qual revisão é correta para o percurso todo?', 'A rapidez média é 0,8 m/s, pois são 4 m em 5 s.', ['É 4 m/s, pois houve dois trechos de 2 m/s.', 'É 1,6 m/s, pois as velocidades dos trechos devem ser somadas.', 'Permanece 2 m/s, pois o carrinho ficou parado por pouco tempo.'], 'A distância total é 4 m e o tempo decorrido é 1 + 3 + 1 = 5 s. Assim, 4 ÷ 5 = 0,8 m/s.', 'Ignorar o intervalo parado ao calcular a média do percurso completo.', 'Confira se o tempo do relatório inclui todo o intervalo entre início e fim.', 1],
  ['transfer-05', 'TRANSFER', 'HARD', 'ANALYZE', 'RUNNER_SPLIT_TIMES', 'Uma corredora percorre 400 m em 50 s e depois 600 m em 150 s. Qual evidência basta para concluir que a rapidez média do percurso foi 5 m/s?', 'A distância total de 1.000 m dividida pelo tempo total de 200 s.', ['A média aritmética entre 8 m/s e 4 m/s, que resulta em 6 m/s.', 'A maior rapidez de um dos trechos multiplicada por 200 s.', 'A diferença entre 600 m e 400 m dividida pelo primeiro tempo.'], 'Somar os trechos dá 1.000 m; somar os tempos dá 200 s. A razão total é 5 m/s. A média aritmética simples das rapidezes dos trechos daria 6 m/s e estaria errada.', 'Usar uma operação entre trechos sem verificar o quociente global.', 'Forme primeiro os totais; depois compare com qualquer média ponderada proposta.', 2],
  ['lock-01', 'LOCK_IN', 'MEDIUM', 'DISTINGUISH', 'ROUND_TRIP_TRACK', 'Um robô percorre uma pista de 60 m até o ponto final e retorna 60 m ao início em 40 s. Qual par de valores descreve rapidez média e módulo da velocidade média?', '3 m/s e 0 m/s.', ['0 m/s e 3 m/s.', '1,5 m/s e 1,5 m/s.', '3 m/s e 3 m/s.'], 'A distância percorrida é 120 m, então a rapidez média é 120/40 = 3 m/s. O deslocamento é zero porque o robô termina onde começou.', 'Usar a distância do caminho para calcular a velocidade média vetorial.', 'Separe comprimento do caminho e diferença entre as posições final e inicial.', 3],
  ['lock-02', 'LOCK_IN', 'HARD', 'ANALYZE', 'EQUAL_DISTANCE_SEGMENTS', 'Um veículo percorre a mesma distância em dois trechos: a 30 km/h no primeiro e a 60 km/h no segundo. Qual é a rapidez média nos dois trechos?', '40 km/h', ['45 km/h', '30 km/h', '60 km/h'], 'Para distâncias iguais, os tempos são inversamente proporcionais às rapidez. Por exemplo, em 60 km por trecho: 60/30 = 2 h e 60/60 = 1 h; 120 km/3 h = 40 km/h.', 'Usar média aritmética de 30 e 60 apesar dos tempos distintos.', 'Escolha uma mesma distância para cada trecho, calcule os tempos e divida os totais.', 0],
  ['lock-03', 'LOCK_IN', 'HARD', 'EVALUATE', 'GPS_REVIEW_INTERVAL', 'Um aplicativo registra 1,8 km em 6 min e informa 18 km/h. Qual avaliação do valor é correta?', 'Converter 6 min em 0,1 h; 1,8 ÷ 0,1 resulta em 18 km/h, então o valor está correto.', ['Converter 6 min em 6 h; o resultado seria 0,3 km/h.', 'Multiplicar 1,8 por 6; o resultado correto seria 10,8 km/h.', 'Converter 1,8 km em 1.800 km; o resultado seria 18.000 km/h.'], 'Seis minutos correspondem a 0,1 h. Dividindo 1,8 km por 0,1 h, obtém-se 18 km/h; a conversão confirma a unidade e o valor.', 'Declarar erro sem converter o intervalo para horas ou sem verificar a unidade resultante.', 'Faça a checagem dimensional: km dividido por hora deve resultar em km/h.', 1],
  ['review-01', 'REVIEW', 'EASY', 'IDENTIFY', 'AIRPORT_WALKWAY', 'Um painel mostra 900 m em 15 min. Qual cálculo fornece rapidez média em m/min?', '900 ÷ 15 = 60 m/min.', ['900 × 15 = 13.500 m/min.', '15 ÷ 900 = 0,017 m/min.', '900 − 15 = 885 m/min.'], 'Rapidez média é distância total dividida pelo tempo decorrido; neste caso, 900/15 = 60 m/min.', 'Inverter a razão ou usar operações incompatíveis com a definição.', 'Confira que a unidade final seja distância por tempo.', 2],
  ['review-02', 'REVIEW', 'MEDIUM', 'COMPARE', 'TWO_BUS_TRIPS', 'Dois ônibus percorrem 45 km. O ônibus A leva 45 min e o B leva 1 h. Qual comparação é correta?', 'A: 60 km/h; B: 45 km/h.', ['A: 45 km/h; B: 60 km/h.', 'A: 1 km/h; B: 0,75 km/h.', 'Ambos: 45 km/h porque percorreram a mesma distância.'], '45 min = 0,75 h. A rapidez de A é 45/0,75 = 60 km/h; a de B é 45/1 = 45 km/h.', 'Comparar percursos iguais sem considerar o tempo de cada um.', 'Converta ambos os tempos para horas antes de dividir.', 3],
  ['review-03', 'REVIEW', 'HARD', 'ANALYZE', 'DELIVERY_WITH_WAIT', 'Uma rota tem 10 km de movimento em 20 min e uma espera de 10 min. Para calcular a rapidez média da viagem inteira, qual razão usar?', '10 km ÷ 30 min, convertendo o intervalo total para a unidade desejada.', ['10 km ÷ 20 min, pois a espera não faz parte do tempo decorrido.', '20 min ÷ 10 km, pois tempo deve ficar no numerador.', 'A média entre 10/20 e zero, sem incluir os minutos de espera.'], 'Na viagem inteira, o intervalo decorrido inclui a espera: 30 min. A rapidez é 10 km / 0,5 h = 20 km/h.', 'Retirar tempo parado mesmo quando o intervalo pedido é o da viagem completa.', 'Observe o escopo da pergunta: trajeto todo ou apenas tempo em movimento?', 0],
  ['review-04', 'REVIEW', 'MEDIUM', 'INTERPRET', 'DISTANCE_TIME_TABLE', 'Uma tabela registra 0 km às 9h, 12 km às 9h20 e 24 km às 9h50 em um percurso sem retornos. Qual é a rapidez média de 9h a 9h50?', '28,8 km/h', ['24 km/h', '36 km/h', '48 km/h'], 'Foram percorridos 24 km em 50 min = 5/6 h. Logo, 24 ÷ (5/6) = 28,8 km/h.', 'Usar o tempo do segundo trecho em vez do intervalo total.', 'Subtraia os horários inicial e final e use a distância total percorrida.', 1],
  ['review-05', 'REVIEW', 'HARD', 'EVALUATE', 'AVERAGE_SPEED_CLAIM', 'Um relatório afirma “a velocidade média foi 4 m/s”, mas informa apenas que o deslocamento foi 40 m em 10 s e não diz se houve retorno no caminho. O que se pode concluir com segurança?', 'O módulo da velocidade média é 4 m/s; a rapidez média pode ser maior se o caminho total excedeu 40 m.', ['A rapidez média é necessariamente 4 m/s em qualquer trajeto.', 'A rapidez média é zero porque faltam dados sobre o sentido.', 'A velocidade média é 40 m/s porque 40 foi a distância inicial.'], 'Deslocamento/tempo fornece o módulo da velocidade média: 40/10 = 4 m/s. Para rapidez média, é necessário conhecer a distância total percorrida; retornos podem aumentá-la.', 'Tratar deslocamento e distância percorrida como sempre iguais.', 'Separe os dados sobre posições dos dados sobre o comprimento total do caminho.', 2],
  ['review-06', 'REVIEW', 'MEDIUM', 'APPLY', 'METRO_ESCALATOR', 'Uma escada rolante transporta uma pessoa por 90 m em 1 min e 30 s. Qual é a rapidez média em m/s?', '1 m/s', ['0,67 m/s', '1,5 m/s', '90 m/s'], 'Um minuto e 30 segundos são 90 s; 90 m ÷ 90 s = 1 m/s.', 'Converter 1 min 30 s como 1,30 min ou dividir pela distância.', 'Expresse toda a duração em segundos antes de calcular.', 3],
];

const purposeCounts = { PROBE: 0, PRACTICE: 6, TRANSFER: 5, LOCK_IN: 3, REVIEW: 6 };
const answerPositionCounts = [0, 0, 0, 0];
const questions = rows.map(([id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, errorFocus, hint, answerPosition]) => {
  const options = [...distractors];
  options.splice(answerPosition, 0, correctAnswer);
  answerPositionCounts[answerPosition] += 1;
  return {
    id: `v5-physics-speed-${id}`,
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
    misconceptions: Object.fromEntries(distractors.map((option, index) => [option, [`${errorFocus} Alternativa-distrator ${index + 1}.`]])),
  };
});

const sourceFeedbackById = {
  'v3-physics-physics_average_speed-1': ['Use distância dividida pelo intervalo de tempo; confira que km e h produzem km/h.', 'Confundir a definição de rapidez média ou a unidade resultante.'],
  'v3-physics-physics_average_speed-3': ['Para encontrar distância, use rapidez × tempo e mantenha km/h e h.', 'Dividir quando a relação pede multiplicar rapidez pelo tempo.'],
  'v3-physics-physics_average_speed-4': ['Para encontrar duração, divida distância por rapidez; km dividido por km/h resulta em horas.', 'Multiplicar distância e rapidez ou misturar unidades.'],
  'v3-physics-physics_average_speed-8': ['Some as distâncias e os tempos dos dois trechos antes de calcular a média.', 'Calcular apenas um trecho em vez do percurso completo.'],
  'v3-physics-physics_average_speed-12': ['Com a mesma distância, compare os tempos: maior duração corresponde a menor rapidez média.', 'Comparar trajetos iguais sem considerar a duração.'],
  'v4-authored-physics-review-01': ['Converta 1,5 h para 1 hora e meia e divida a distância por esse total.', 'Tratar o decimal 1,5 como 1 hora e 5 minutos.'],
  'v4-authored-physics-average-speed-lock-in-01': ['O tempo total informado já inclui a parada; use todo o intervalo da viagem.', 'Retirar a parada do tempo apesar de o enunciado incluir a viagem inteira.'],
  'v4-authored-physics-average-speed-practice-01': ['A relação é distância total dividida pelo tempo total, com as unidades indicadas.', 'Multiplicar a distância pelo tempo em vez de dividir.'],
  'v9-physics-speed-09': ['A unidade pedida é m/min; não converta o tempo para horas.', 'Converter para outra unidade quando o enunciado pede m/min.'],
  'v9-physics-speed-10': ['Divida 18 km por 1,5 h e mantenha a unidade km/h.', 'Interpretar 1,5 h como 1 h 5 min.'],
  'v9-physics-speed-11': ['Some 20/60 a 2 horas antes de dividir 84 km pelo tempo.', 'Ler 2 h 20 min como 2,20 h.'],
  'v9-physics-speed-12': ['Calcule os tempos dos trechos e use a distância total pelo tempo total.', 'Usar média aritmética em trechos de mesma distância e rapidez diferentes.'],
  'v9-physics-speed-13': ['Converta 25 minutos em horas antes de calcular km/h.', 'Usar o número 25 como se fossem horas.'],
  'v9-physics-speed-14': ['A pergunta considera a viagem inteira; a parada permanece dentro do intervalo de uma hora.', 'Excluir o trânsito parado do tempo decorrido solicitado.'],
  'v9-physics-speed-15': ['45 minutos equivalem a 0,75 hora; divida 27 por 0,75.', 'Usar 45 como horas ou converter a unidade no sentido errado.'],
  'v9-physics-speed-16': ['Distância total: 3 km; duração total: 1 h.', 'Usar apenas a distância ou a duração de um dos trechos.'],
  'v9-physics-speed-17': ['Converta 40 minutos em 2/3 de hora antes da divisão.', 'Usar 40 como horas ou tomar a duração como resultado.'],
  'v9-physics-speed-18': ['Entre 8h e 10h30 decorrem 2,5 h; divida 150 km por esse intervalo.', 'Subtrair os dígitos do horário ou ignorar os 30 minutos.'],
  'v9-physics-speed-19': ['Use o caminho total e os 60 s completos, incluindo o período parado.', 'Excluir a pausa do intervalo total.'],
  'v9-physics-speed-20': ['Calcule cada rapidez dividindo os 90 km pelo tempo correspondente.', 'Supor que distâncias iguais implicam rapidez iguais.'],
};

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(ROOT, relativePath), 'utf8'));
const originalQuestions = [
  ...readJson('content/adaptive/tec-escola-core-v4/subjects/physics/questions.json').filter((question) => question.primarySkill === 'PHYSICS_AVERAGE_SPEED'),
  ...['question-expansion-v1.json', 'question-expansion-v2.json']
    .flatMap((file) => readJson(`content/adaptive/tec-escola-core-v9/${file}`).questions)
    .filter((question) => question.skill === 'PHYSICS_AVERAGE_SPEED'),
];
const sourceQuestionFeedback = originalQuestions.map((question) => {
  const feedback = sourceFeedbackById[question.id];
  if (!feedback) throw new Error(`PHYSICS_AVERAGE_SPEED_SOURCE_FEEDBACK_MISSING:${question.id}`);
  return { questionId: question.id, hint: feedback[0], errorFocus: feedback[1] };
});
if (originalQuestions.length !== 20 || sourceQuestionFeedback.length !== Object.keys(sourceFeedbackById).length) {
  throw new Error('PHYSICS_AVERAGE_SPEED_SOURCE_RECONCILIATION_FAILED');
}

const idsFor = (purpose) => questions.filter((question) => question.purpose === purpose).map((question) => question.id);
const pack = {
  packVersion: 'tec-escola-core-v5-question-first',
  contentId: 'v5-physics-average-speed',
  subject: 'PHYSICS',
  domain: 'MOVIMENTO',
  topic: 'rapidez_media_distancia_tempo_e_unidades',
  canonicalSkillCode: 'PHYSICS_AVERAGE_SPEED',
  contentVersion: 5,
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
    title: 'Rapidez média: caminho, tempo e unidades',
    objective: 'Calcular e interpretar rapidez média em trajetos completos, converter unidades e diferenciar distância percorrida de deslocamento ao avaliar o movimento.',
    summary: 'A rapidez média do percurso é a distância total dividida pelo tempo total decorrido. Some os trechos e as durações, converta unidades antes da divisão e não confunda distância percorrida com deslocamento.',
    explanation: '## 1. Identifique o que a questão mede\nRapidez é escalar: informa quanto caminho foi percorrido por intervalo de tempo e não inclui direção. Neste percurso, rapidez média = distância total percorrida ÷ tempo total decorrido. Se o enunciado pergunta por velocidade média vetorial, use deslocamento (posição final menos inicial) ÷ intervalo; uma volta ao ponto de partida pode ter rapidez positiva e velocidade média vetorial nula.\n\n## 2. Some o percurso antes de calcular\nEm uma viagem com trechos, some todas as distâncias percorridas e some os intervalos. Se a pergunta é sobre a viagem inteira, o tempo parado entre saída e chegada também entra no tempo decorrido. Só use tempo “em movimento” quando o problema pedir explicitamente essa medida.\n\n## 3. Torne as unidades compatíveis\nPara obter km/h, expresse o tempo em horas; para m/s, use metros e segundos. Lembre: 1 h = 60 min = 3.600 s e 1 km = 1.000 m. Converta antes de dividir; 1,5 h significa uma hora e meia, não uma hora e cinco minutos.\n\n## 4. Não tire a média simples das rapidez dos trechos\nA média aritmética só funciona em condições específicas. A regra geral é distância total ÷ tempo total. Em distâncias iguais feitas a rapidez diferentes, o trecho mais lento consome mais tempo; por isso, a média do percurso não é simplesmente a média dos dois valores.\n\n## 5. Confira resultado e significado\nA unidade deve ser distância/tempo. Faça uma estimativa para perceber erro de escala e pergunte se a quantidade calculada corresponde à distância percorrida ou ao deslocamento. Uma resposta numérica pode estar aritmeticamente correta e ainda responder à grandeza errada.\n\n## Exemplo resolvido\nUm ciclista percorre 12 km a 24 km/h e depois 12 km a 12 km/h. No primeiro trecho, gasta 12/24 = 0,5 h; no segundo, 12/12 = 1 h. A distância total é 24 km e o tempo total é 1,5 h. Logo, a rapidez média é 24/1,5 = 16 km/h, não 18 km/h (a média simples entre 24 e 12). O trecho mais lento durou o dobro, então pesou mais no tempo total.',
    workedExample: 'No exemplo dos dois trechos de 12 km, o ciclista leva 0,5 h no primeiro e 1 h no segundo. A rapidez média é (12 + 12)/(0,5 + 1) = 16 km/h. A média simples das rapidez falha porque os tempos dos trechos são diferentes.',
    commonMistake: 'Calcular a média aritmética das rapidez dos trechos ou excluir uma parada mesmo quando se pede a viagem completa, sem verificar distância e tempo totais.',
    commonErrors: ['Usar o tempo de um trecho em vez do intervalo total.', 'Tratar 1,5 h como 1 h 5 min.', 'Usar minutos como horas sem conversão.', 'Excluir uma parada do tempo total sem que a questão peça tempo em movimento.', 'Confundir a distância percorrida com o deslocamento.', 'Tirar média simples de rapidez em trechos com durações diferentes.'],
    tips: ['Sublinhe se a questão pede rapidez, velocidade vetorial, viagem completa ou apenas movimento.', 'Faça uma linha para distância total e outra para tempo total.', 'Converta unidades antes da divisão e escreva a unidade no resultado.', 'Em trechos diferentes, some distância e tempo; não tire a média simples dos valores.'],
    priorKnowledge: ['Dividir números inteiros e decimais.', 'Converter entre horas, minutos e segundos.', 'Interpretar distância percorrida e posições inicial e final.'],
    keyConcepts: ['rapidez média como distância total por tempo total', 'intervalo de tempo decorrido', 'conversão de unidades', 'média de trechos com diferentes durações', 'distância percorrida e deslocamento', 'rapidez escalar e velocidade vetorial'],
    progression: [
      { stage: 'FOUNDATION', focus: 'Aplicar a razão distância/tempo e manter unidades coerentes.', questionIds: idsFor('PRACTICE') },
      { stage: 'APPLICATION', focus: 'Calcular trajetos com conversões, paradas e trechos diferentes.', questionIds: idsFor('TRANSFER') },
      { stage: 'TRANSFER', focus: 'Analisar dados de movimento e distinguir rapidez de velocidade média vetorial.', questionIds: idsFor('LOCK_IN') },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Retomar estimativa, unidade, intervalo completo e significado físico em novos contextos.', questionIds: idsFor('REVIEW') },
    ],
    microExplanations: [
      { trigger: 'TOTALS_BEFORE_DIVISION', text: 'Em vários trechos, some as distâncias percorridas e os tempos antes de dividir.' },
      { trigger: 'ELAPSED_TIME', text: 'Tempo decorrido entre saída e chegada pode incluir pausas; leia o escopo pedido.' },
      { trigger: 'UNIT_CONVERSION', text: 'Minutos não são horas decimais: 30 min = 0,5 h e 20 min = 1/3 h.' },
      { trigger: 'UNEQUAL_SEGMENT_TIMES', text: 'A média simples das rapidez não representa o percurso quando os tempos são diferentes.' },
      { trigger: 'DISTANCE_VS_DISPLACEMENT', text: 'Distância mede o caminho; deslocamento compara as posições final e inicial.' },
      { trigger: 'UNIT_SANITY_CHECK', text: 'Distância dividida por tempo deve produzir uma unidade como km/h ou m/s.' },
    ],
    remediations: [
      { id: 'SEGMENT_TOTALS', misconception: 'MEDIA_SIMPLES_DE_TRECHOS', prompt: 'Monte uma tabela com distância e tempo de cada trecho. Some cada coluna e calcule a razão dos totais.' },
      { id: 'TIME_CONVERSION', misconception: 'MINUTOS_TRATADOS_COMO_HORAS', prompt: 'Converta o intervalo para a unidade da resposta. Mostre por que 20 min equivalem a 1/3 h.' },
      { id: 'WHOLE_TRIP', misconception: 'PARADA_EXCLUIDA_INDEVIDAMENTE', prompt: 'Marque saída e chegada na linha do tempo. A pergunta considera o trajeto inteiro ou apenas movimento?' },
      { id: 'DISTANCE_OR_DISPLACEMENT', misconception: 'CAMINHO_CONFUNDIDO_COM_DESLOCAMENTO', prompt: 'Desenhe o percurso, some seu comprimento e compare a posição inicial com a final.' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 24,
    sourceDossier: [
      {
        title: '2.2 Speed and Velocity',
        publisher: 'OpenStax, Physics',
        url: 'https://openstax.org/books/physics/pages/2-2-speed-and-velocity',
        accessedOn: '2026-10-13',
        supports: ['Rapidez média como distância percorrida dividida pelo tempo decorrido.', 'Distinção entre rapidez escalar e velocidade vetorial baseada em deslocamento.'],
        use: 'Referência conceitual para fórmulas e distinção de grandezas; exemplos e itens deste pacote são autorais.',
      },
    ],
    copyrightNote: 'Questões, exemplos e explicações deste pacote são autorais. A fonte apoia definições conceituais; mapeamento oficial e revisão pedagógica humana permanecem pendentes.',
  },
};

const actualPurposeCounts = Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
if (questions.length !== 20 || JSON.stringify(actualPurposeCounts) !== JSON.stringify(purposeCounts)) {
  throw new Error('PHYSICS_AVERAGE_SPEED_V5_QUESTION_COUNTS_INVALID');
}
if (answerPositionCounts.some((count, index) => count !== 5)) throw new Error('PHYSICS_AVERAGE_SPEED_V5_ANSWER_POSITIONS_UNBALANCED');

export function buildPhysicsAverageSpeedPack() {
  return structuredClone(pack);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Wrote ${questions.length} original physics questions and ${sourceQuestionFeedback.length} source-feedback records to ${OUTPUT}`);
}
