import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/physics-unit-conversion.json');

const rows = [
  ['probe-01', 'PROBE', 'EASY', 'APPLY', 'KMH_TO_MS_CHECK', 'O painel de um veículo registra 72 km/h. Qual medida em m/s representa a mesma rapidez?', '20 m/s', ['259,2 m/s', '25,9 m/s', '72 m/s'], 'Como 1 km = 1.000 m e 1 h = 3.600 s, 72 × 1.000 ÷ 3.600 = 20 m/s.', 'Inverter o fator 3,6 ou converter só a distância.', 'Escreva km/h × (1.000 m/1 km) × (1 h/3.600 s) e confira o cancelamento.', 0],
  ['probe-02', 'PROBE', 'EASY', 'APPLY', 'MAP_DISTANCE_SCALE', 'Um mapa informa um percurso de 2,5 km. Qual é essa distância em metros?', '2.500 m', ['250 m', '25.000 m', '0,0025 m'], 'Cada quilômetro tem 1.000 metros: 2,5 × 1.000 = 2.500 m.', 'Mover a vírgula uma ou duas casas em vez de multiplicar por mil.', 'Use a igualdade 1 km = 1.000 m.', 1],
  ['probe-03', 'PROBE', 'MEDIUM', 'CONVERT', 'LAB_TIMER_MINUTES', 'Um cronômetro registra 4,5 min. Quanto tempo isso representa em segundos?', '270 s', ['4,5 s', '45 s', '270 min'], 'Um minuto tem 60 segundos; 4,5 × 60 = 270 s.', 'Multiplicar por 10 ou manter o valor numérico e trocar apenas o símbolo.', 'Converta cada minuto em 60 segundos, inclusive a parte decimal.', 2],
  ['probe-04', 'PROBE', 'MEDIUM', 'COMPARE', 'EQUIVALENT_SPEED_PAIR', 'Qual par representa a mesma rapidez?', '36 km/h e 10 m/s', ['36 km/h e 36 m/s', '36 km/h e 3,6 m/s', '36 km/h e 100 m/s'], '36 km/h × 1.000/3.600 = 10 m/s; portanto, o par é equivalente.', 'Comparar os números sem converter ou aplicar 3,6 no sentido errado.', 'Converta 36 km/h para m/s antes de comparar.', 3],
  ['practice-01', 'PRACTICE', 'EASY', 'CONVERT', 'WALKING_ROUTE_KM', 'Uma caminhada tem 0,8 km. Quantos metros ela percorre?', '800 m', ['80 m', '8.000 m', '0,8 m'], '0,8 km × 1.000 m/km = 800 m.', 'Tratar 0,8 km como 0,8 m ou deslocar a vírgula incorretamente.', 'Multiplique por 1.000; o resultado em metros deve ser maior que o número em quilômetros.', 0],
  ['practice-02', 'PRACTICE', 'EASY', 'CONVERT', 'FABRIC_CENTIMETERS', 'Uma fita tem 750 cm de comprimento. Qual é seu comprimento em metros?', '7,5 m', ['75 m', '0,75 m', '7.500 m'], 'Como 100 cm = 1 m, 750 ÷ 100 = 7,5 m.', 'Multiplicar por 100 ao passar para uma unidade maior.', 'Para passar de centímetros para metros, agrupe 100 centímetros por metro.', 1],
  ['practice-03', 'PRACTICE', 'EASY', 'CONVERT', 'MODEL_MILLIMETERS', 'Uma peça mede 45 mm. Qual medida equivalente está em centímetros?', '4,5 cm', ['0,45 cm', '45 cm', '450 cm'], '10 mm = 1 cm; assim, 45 mm ÷ 10 = 4,5 cm.', 'Mover a vírgula na direção contrária ao converter para uma unidade maior.', 'Um centímetro contém dez milímetros.', 2],
  ['practice-04', 'PRACTICE', 'MEDIUM', 'CONVERT', 'OBSERVATION_HOURS', 'Uma observação dura 2,25 h. Quantos segundos ela dura?', '8.100 s', ['2.250 s', '5.400 s', '22.500 s'], '2,25 h × 3.600 s/h = 8.100 s.', 'Usar 60 como se uma hora tivesse 60 segundos ou esquecer o fator 3.600.', 'Converta horas diretamente para segundos usando 1 h = 3.600 s.', 3],
  ['practice-05', 'PRACTICE', 'EASY', 'CONVERT', 'SWIM_INTERVAL', 'Um intervalo de treino dura 7 min e 30 s. Qual é sua duração total em segundos?', '450 s', ['430 s', '75 s', '7.500 s'], '7 min = 420 s; somando os 30 s, a duração é 450 s.', 'Somar 7 e 30 sem converter os minutos ou interpretar 7 min 30 s como 7,30 min.', 'Converta primeiro os 7 minutos e depois some os segundos restantes.', 0],
  ['practice-06', 'PRACTICE', 'MEDIUM', 'APPLY', 'ROAD_SIGN_SPEED', 'Um painel mostra 54 km/h. Qual valor equivalente deve ser escrito em m/s?', '15 m/s', ['194,4 m/s', '3,6 m/s', '54 m/s'], '54 ÷ 3,6 = 15 m/s. A divisão decorre de 1.000/3.600.', 'Multiplicar por 3,6 ao converter de km/h para m/s.', 'O valor numérico em m/s fica menor; divida por 3,6.', 1],
  ['practice-07', 'PRACTICE', 'MEDIUM', 'APPLY', 'CYCLING_SPEED_LABEL', 'Um ciclocomputador indica 8 m/s. Qual indicação equivalente aparece em km/h?', '28,8 km/h', ['2,22 km/h', '8 km/h', '800 km/h'], '8 × 3,6 = 28,8 km/h; a conversão é o caminho inverso de km/h para m/s.', 'Dividir por 3,6 no sentido inverso ou trocar apenas a unidade.', 'Para m/s → km/h, multiplique por 3,6.', 2],
  ['practice-08', 'PRACTICE', 'MEDIUM', 'APPLY', 'CONVEYOR_RATE', 'Uma esteira se desloca a 0,6 km/min. Qual é essa rapidez em m/s?', '10 m/s', ['0,01 m/s', '0,6 m/s', '36 m/s'], '0,6 km/min = 600 m/60 s = 10 m/s.', 'Converter quilômetros para metros, mas manter minutos como se fossem segundos.', 'Converta o numerador e o denominador: 0,6 km = 600 m e 1 min = 60 s.', 3],
  ['practice-09', 'PRACTICE', 'MEDIUM', 'CONVERT', 'RIVER_CURRENT_RATE', 'Uma medição de corrente é 1,25 km/min. Qual é o valor equivalente em km/h?', '75 km/h', ['1,25 km/h', '45 km/h', '4,5 km/h'], 'Em uma hora há 60 minutos: 1,25 km/min × 60 min/h = 75 km/h.', 'Dividir por 60 ao converter uma taxa por minuto para taxa por hora.', 'A unidade min está no denominador; use 60 minutos para cada hora.', 0],
  ['practice-10', 'PRACTICE', 'MEDIUM', 'CONVERT', 'ROBOT_SENSOR_CMS', 'Um sensor mede 0,35 m/s. Qual valor equivalente está em cm/s?', '35 cm/s', ['3,5 cm/s', '0,35 cm/s', '350 cm/s'], '0,35 m/s × 100 cm/m = 35 cm/s.', 'Alterar o denominador sem converter o metro para centímetros.', 'O tempo continua em segundos; converta apenas metros para centímetros.', 1],
  ['practice-11', 'PRACTICE', 'EASY', 'CONVERT', 'TRACK_LENGTH_SCIENTIFIC', 'Uma pista tem 3,6 × 10³ m de extensão. Qual é essa extensão em quilômetros?', '3,6 km', ['0,0036 km', '36 km', '360 km'], '3,6 × 10³ m = 3.600 m; dividindo por 1.000, obtemos 3,6 km.', 'Ler 10³ como 10 ou aplicar o fator de conversão no sentido errado.', 'Substitua 10³ por 1.000 antes de converter metros para quilômetros.', 2],
  ['practice-12', 'PRACTICE', 'HARD', 'ANALYZE', 'UNIT_FACTOR_SETUP', 'Qual expressão converte corretamente 90 km/h para m/s por cancelamento de unidades?', '90 × (1.000 m/1 km) × (1 h/3.600 s) = 25 m/s', ['90 × (1 km/1.000 m) × (3.600 s/1 h) = 25 m/s', '90 × (3.600 s/1 h) × (1.000 m/1 km) = 324.000 m/s', '90 × (1.000 km/1 m) × (1 h/3.600 s) = 25 m/s'], 'O fator deve cancelar km no numerador e h no denominador: 90 × 1.000/3.600 = 25 m/s.', 'Escolher fatores que não cancelam as unidades originais ou inverter só um deles.', 'Confira que km e h desaparecem e que restam m/s.', 3],
  ['transfer-01', 'TRANSFER', 'MEDIUM', 'COMPARE', 'CYCLE_TRACK_COMPARE', 'Na mesma pista, o sensor A marca 16 m/s e o sensor B, 54 km/h. Qual leitura indica maior rapidez?', 'A, pois 16 m/s equivalem a 57,6 km/h.', ['B, pois 54 é maior que 16.', 'As duas são iguais porque ambas descrevem movimento.', 'B, pois 54 km/h equivalem a 19,44 m/s.'], '16 m/s × 3,6 = 57,6 km/h, que é maior que 54 km/h.', 'Comparar 16 e 54 sem igualar as unidades.', 'Converta uma leitura para a unidade da outra antes de ordenar.', 0],
  ['transfer-02', 'TRANSFER', 'MEDIUM', 'COMPARE', 'BELT_SPEED_COMPARISON', 'Uma esteira opera a 0,24 km/min e outra a 15 m/s. Qual delas é mais rápida?', 'A de 15 m/s; 0,24 km/min corresponde a 4 m/s.', ['A de 0,24 km/min, porque 0,24 é maior que 15.', 'As duas têm a mesma rapidez.', 'Não é possível comparar sem conhecer a distância total.'], '0,24 km/min = 240 m/60 s = 4 m/s. Portanto, 15 m/s é maior.', 'Comparar os valores numéricos antes de converter km/min.', 'Transforme 0,24 km em metros e 1 min em segundos.', 1],
  ['transfer-03', 'TRANSFER', 'MEDIUM', 'CHECK', 'GPS_EXPORT_FORMAT', 'Um GPS exporta 72 km/h, mas o relatório pede m/s. Qual registro conserva o valor físico e atende ao formato pedido?', '20 m/s', ['259,2 m/s', '72 m/s', '0,02 m/s'], '72 km/h ÷ 3,6 = 20 m/s; muda a representação, não a rapidez física.', 'Aplicar o fator inverso ou trocar o rótulo sem converter o número.', 'Use 36 km/h = 10 m/s como referência de escala.', 2],
  ['transfer-04', 'TRANSFER', 'HARD', 'EVALUATE', 'LAB_RATE_DIMENSIONS', 'Uma equipe calcula 250 cm em 1 min e quer expressar a taxa em m/s. Qual procedimento e resultado estão corretos?', '250 cm = 2,5 m e 1 min = 60 s; 2,5/60 ≈ 0,0417 m/s.', ['250 ÷ 60 = 4,17 m/s, sem converter centímetros.', '250 × 60 = 15.000 m/s, convertendo minutos em segundos.', '2,5 ÷ 1 = 2,5 m/s, mantendo os valores numéricos.'], '250 cm = 2,5 m e 1 min = 60 s; 2,5/60 ≈ 0,0417 m/s.', 'Converter o numerador, o denominador ou ambos no sentido incorreto.', 'Anote a taxa como 250 cm/min e converta cada unidade antes de dividir.', 3],
  ['transfer-05', 'TRANSFER', 'MEDIUM', 'COMPARE', 'SPRINTER_SPEED_TRIAL', 'Uma corredora atinge 12 m/s; outra medição registra 40 km/h. Qual valor é maior?', '12 m/s, pois 40 km/h ≈ 11,1 m/s.', ['40 km/h, pois 40 é maior que 12.', 'Os valores são iguais: 12 m/s = 40 km/h.', 'Não se pode comparar m/s e km/h.'], '40 km/h ÷ 3,6 ≈ 11,1 m/s; logo, 12 m/s é maior.', 'Ordenar os números antes de converter ou arredondar 11,1 para 12 sem critério.', 'Converta 40 km/h para m/s e compare com 12 m/s.', 0],
  ['transfer-06', 'TRANSFER', 'HARD', 'APPLY', 'DRONE_RATE_REPORT', 'Um drone percorre 0,9 km por minuto. Como essa taxa deve aparecer em m/s?', '15 m/s', ['0,9 m/s', '54 m/s', '900 m/s'], '0,9 km/min = 900 m/60 s = 15 m/s.', 'Converter só quilômetros ou só minutos.', 'Converta os dois lados da taxa antes de simplificar.', 1],
  ['transfer-07', 'TRANSFER', 'HARD', 'COMPARE', 'TUNNEL_SENSOR_MATCH', 'Um sensor registra 1,8 km em 90 s; outro informa 72 km/h. Como se comparam as velocidades?', 'São iguais: ambos correspondem a 20 m/s.', ['O primeiro é mais rápido: 72 km/h = 18 m/s.', 'O segundo é mais rápido: 1,8 km/90 s = 2 m/s.', 'Não há dados suficientes para comparar.'], '1,8 km = 1.800 m; 1.800/90 = 20 m/s. Já 72 km/h = 20 m/s.', 'Converter a distância, mas usar 90 como minutos, ou inverter o fator 3,6.', 'Calcule a primeira taxa em m/s e transforme 72 km/h para a mesma unidade.', 2],
  ['transfer-08', 'TRANSFER', 'HARD', 'COMPARE', 'MOVING_WALKWAY_MATCH', 'Uma passarela move-se a 1.800 cm em 12 s; outra, a 5,4 km/h. Qual comparação é correta?', 'As duas têm 1,5 m/s.', ['A primeira é mais rápida, pois 1.800/12 = 150 m/s.', 'A segunda é mais rápida, pois 5,4 km/h = 15 m/s.', 'A primeira é 1,5 km/h e a segunda é 5,4 m/s.'], '1.800 cm = 18 m; 18/12 = 1,5 m/s. E 5,4 km/h ÷ 3,6 = 1,5 m/s.', 'Esquecer que 100 cm = 1 m ou aplicar 3,6 no sentido errado.', 'Converta 1.800 cm para metros e 5,4 km/h para m/s.', 3],
  ['lock-01', 'LOCK_IN', 'MEDIUM', 'DIAGNOSE', 'WRONG_FACTOR_REVIEW', 'Um relatório transforma 72 km/h em 259,2 m/s multiplicando por 3,6. Qual correção explica o erro?', 'Para km/h → m/s, deve-se dividir por 3,6; o resultado correto é 20 m/s.', ['A multiplicação está certa; basta escrever km/h.', 'Deve-se multiplicar por 60, obtendo 4.320 m/s.', 'A conversão é impossível porque as unidades são diferentes.'], 'O fator 3,6 vale de m/s para km/h. No sentido inverso, 72 ÷ 3,6 = 20 m/s.', 'Usar o fator correto no sentido errado.', 'Derive o fator: 1.000 m por km dividido por 3.600 s por hora.', 0],
  ['lock-02', 'LOCK_IN', 'MEDIUM', 'APPLY', 'VELOCIMETER_REVERSE_FACTOR', 'Um velocímetro de laboratório marca 25 m/s. Qual é a leitura equivalente em km/h?', '90 km/h', ['6,94 km/h', '25 km/h', '900 km/h'], '25 m/s × 3,6 = 90 km/h.', 'Dividir por 3,6 ou multiplicar por 36.', 'De m/s para km/h, multiplique por 3,6.', 1],
  ['lock-03', 'LOCK_IN', 'HARD', 'EVALUATE', 'LIMIT_SIGN_COMPARISON', 'Uma via tem limite de 40 km/h e outra, de 12 m/s. Qual afirmação é correta?', '12 m/s é maior; 40 km/h ≈ 11,1 m/s.', ['São iguais porque os dois valores terminam em unidade de velocidade.', '40 km/h é maior porque 40 > 12.', 'Não há como comparar limites expressos em unidades distintas.'], '40 ÷ 3,6 ≈ 11,1 m/s; assim, 12 m/s é maior.', 'Comparar apenas os números ou supor que a unidade impede conversão.', 'Converta 40 km/h para m/s antes de comparar.', 2],
  ['lock-04', 'LOCK_IN', 'HARD', 'ANALYZE', 'KILOMETER_PER_SECOND_REPORT', 'Um instrumento mede 0,5 km/s. Qual valor equivalente está em km/h?', '1.800 km/h', ['0,5 km/h', '1,8 km/h', '180 km/h'], '0,5 km/s × 3.600 s/h = 1.800 km/h.', 'Aplicar o fator 3,6 quando a unidade de origem é por segundo, não por metro por segundo.', 'Como a distância já está em quilômetros, converta apenas segundos para horas: multiplique por 3.600.', 3],
  ['lock-05', 'LOCK_IN', 'HARD', 'CHECK', 'MILLISECOND_UNIT_CANCEL', 'Um sensor mede 0,3 m por milissegundo. Qual é a taxa equivalente em m/s?', '300 m/s', ['0,0003 m/s', '3 m/s', '30 m/s'], '1 ms = 0,001 s; 0,3 m/0,001 s = 300 m/s.', 'Tratar milissegundo como segundo ou aplicar o prefixo milli no sentido errado.', 'Converta o denominador: dividir por 0,001 equivale a multiplicar por 1.000.', 0],
  ['lock-06', 'LOCK_IN', 'HARD', 'EVALUATE', 'CENTIMETER_PER_MINUTE_METHOD', 'Qual cálculo converte corretamente 250 cm/min para m/s?', '250 cm/min × (1 m/100 cm) × (1 min/60 s) ≈ 0,0417 m/s.', ['250 ÷ 60 = 4,17 m/s, sem converter cm.', '250 × 100 × 60 = 1.500.000 m/s.', '250 cm/min = 2,5 m/s porque 1 min = 1 s.'], '250 cm/min × 1 m/100 cm × 1 min/60 s = 2,5/60 ≈ 0,0417 m/s.', 'Cancelar ou converter unidades com fatores invertidos.', 'Escolha fatores que eliminem cm e min e deixem somente m/s.', 1],
  ['review-01', 'REVIEW', 'EASY', 'CONVERT', 'PARK_DISTANCE_RETRIEVAL', 'Uma trilha tem 5,4 km. Qual distância é equivalente em metros?', '5.400 m', ['540 m', '54 m', '54.000 m'], '5,4 × 1.000 = 5.400 m.', 'Aplicar o prefixo kilo como fator 100 ou 10.000.', 'Lembre-se: kilo significa mil vezes a unidade base.', 2],
  ['review-02', 'REVIEW', 'MEDIUM', 'CONVERT', 'FIELD_RECORD_DURATION', 'Um registro de campo durou 2 h e 15 min. Qual é a duração em segundos?', '8.100 s', ['2.250 s', '5.400 s', '7.500 s'], '2 h = 7.200 s e 15 min = 900 s; total = 8.100 s.', 'Converter apenas uma parte do tempo ou usar 60 s por hora.', 'Converta horas e minutos separadamente e some os segundos.', 3],
  ['review-03', 'REVIEW', 'MEDIUM', 'CONVERT', 'VEHICLE_SPEED_RECALL', 'Um veículo de teste se desloca a 108 km/h. Qual valor é equivalente em m/s?', '30 m/s', ['388,8 m/s', '108 m/s', '10,8 m/s'], '108 ÷ 3,6 = 30 m/s.', 'Multiplicar pelo fator no sentido inverso.', 'Use a relação 36 km/h = 10 m/s.', 0],
  ['review-04', 'REVIEW', 'EASY', 'CONVERT', 'TREADMILL_SPEED_RECALL', 'Uma esteira indica 3 m/s. Qual é a indicação equivalente em km/h?', '10,8 km/h', ['0,83 km/h', '3 km/h', '108 km/h'], '3 × 3,6 = 10,8 km/h.', 'Dividir por 3,6 ou deslocar a vírgula sem usar o fator.', 'Para m/s → km/h, multiplique por 3,6.', 1],
  ['review-05', 'REVIEW', 'HARD', 'COMPARE', 'CART_AND_ESCALATOR', 'Um carrinho move-se a 2 km/min e uma escada a 30 m/s. Qual é mais rápida?', 'O carrinho, pois 2 km/min ≈ 33,3 m/s.', ['A escada, porque 2 km/min = 2 m/s.', 'As duas têm a mesma rapidez.', 'O carrinho, pois 2 km/min = 120 m/s.'], '2 km/min = 2.000 m/60 s ≈ 33,3 m/s, acima de 30 m/s.', 'Converter quilômetros mas esquecer os 60 segundos do minuto.', 'Expresse 2 km/min em metros por segundo antes de comparar.', 2],
  ['review-06', 'REVIEW', 'HARD', 'ANALYZE', 'DIMENSIONAL_CONVERSION_REVIEW', 'Qual operação mostra corretamente que 72 km/h equivalem a 20 m/s?', '72 × (1.000 m/1 km) × (1 h/3.600 s) = 20 m/s', ['72 × (1 km/1.000 m) × (3.600 s/1 h) = 20 m/s', '72 × (1.000 km/1 m) × (1 h/3.600 s) = 20 m/s', '72 × (3.600 s/1 h) × (1.000 m/1 km) = 20 m/s'], 'Os fatores cancelam km e h, deixando m/s; o valor é 72 × 1.000/3.600 = 20.', 'Inverter um dos fatores ou escolher razões que não cancelam as unidades iniciais.', 'Confira as unidades como fatores; a unidade desejada precisa sobrar no resultado.', 3],
  ['review-07', 'REVIEW', 'MEDIUM', 'COMPARE', 'WALKER_SENSOR_EQUIVALENCE', 'Um sensor registra 0,12 km/min e outro, 7,2 km/h. Qual comparação está correta?', 'Os dois registram 2 m/s.', ['0,12 km/min é maior: equivale a 12 m/s.', '7,2 km/h é maior: equivale a 7,2 m/s.', 'Os dois registram 0,2 m/s.'], '0,12 km/min = 120 m/60 s = 2 m/s. E 7,2 km/h = 2 m/s.', 'Tratar km/min e km/h como a mesma unidade de taxa.', 'Converta cada taxa para m/s; as duas resultam em 2.', 0],
  ['review-08', 'REVIEW', 'HARD', 'CONVERT', 'CENTIMETER_MILLISECOND_SENSOR', 'Uma vibração percorre 2,5 cm em 1 ms. Qual é a rapidez em m/s?', '25 m/s', ['0,025 m/s', '2,5 m/s', '250 m/s'], '2,5 cm = 0,025 m e 1 ms = 0,001 s; 0,025/0,001 = 25 m/s.', 'Converter somente centímetros ou somente milissegundos.', 'Troque cm por m e ms por s antes de dividir.', 1],
  ['review-09', 'REVIEW', 'MEDIUM', 'CONVERT', 'FLOW_RATE_RECALL', 'Uma esteira de laboratório desloca-se a 0,45 km/min. Qual é a taxa equivalente em m/s?', '7,5 m/s', ['0,0075 m/s', '27 m/s', '450 m/s'], '0,45 km/min = 450 m/60 s = 7,5 m/s.', 'Converter km para m, mas não converter minuto para segundos.', 'Use 450 metros em cada intervalo de 60 segundos.', 2],
  ['review-10', 'REVIEW', 'EASY', 'CONVERT', 'FIELD_TIMER_RECALL', 'Um cronômetro registra 1 h e 20 min. Quantos segundos se passaram?', '4.800 s', ['4.880 s', '5.200 s', '5.600 s'], '1 h = 3.600 s; 20 min = 1.200 s; total = 4.800 s.', 'Somar os números 60 e 20 sem levar em conta suas unidades.', 'Converta cada parcela para segundos e só depois some.', 3],
];

const purposeCounts = { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 };
const answerPositionCounts = [0, 0, 0, 0];
const questions = rows.map(([id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, errorFocus, hint, answerPosition]) => {
  const options = [...distractors];
  options.splice(answerPosition, 0, correctAnswer);
  answerPositionCounts[answerPosition] += 1;
  return {
    id: `v5-physics-units-${id}`,
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
  'v3-physics-physics_average_speed-9': ['Derive o fator: 72 km/h × 1.000 m/km ÷ 3.600 s/h = 20 m/s.', 'Aplicar o fator 3,6 no sentido errado ou comparar apenas os valores numéricos.'],
  'v93-phys-units-01': ['Para km/h → m/s, divida por 3,6; também pode cancelar km e h com fatores equivalentes.', 'Multiplicar por 3,6 na conversão de km/h para m/s.'],
  'v93-phys-units-02': ['Converta 15 m/s para km/h (× 3,6) ou 50 km/h para m/s (÷ 3,6) antes de comparar.', 'Comparar valores numéricos com unidades diferentes diretamente.'],
  'v93-phys-units-04': ['De m/s para km/h, multiplique por 3,6.', 'Dividir por 3,6 no sentido inverso.'],
  'v93-phys-units-06': ['Converta primeiro 180 km/3 h para km/h; depois divida por 3,6 para obter m/s.', 'Converter somente a distância ou inverter o fator 3,6.'],
  'v93-phys-units-07': ['Passe 2,4 km para 2.400 m e 2 min para 120 s antes de calcular a taxa.', 'Converter apenas uma das duas grandezas.'],
  'v93-phys-units-10': ['Mantenha as unidades durante as etapas: 2.700 m/90 s = 30 m/s; depois × 3,6 = 108 km/h.', 'Aplicar o fator de conversão no sentido errado.'],
  'v93-phys-units-12': ['Transforme 1,8 km em 1.800 m para compatibilizar com 12 m/s.', 'Usar distância em quilômetros com velocidade em metros por segundo.'],
  'v93-phys-units-13': ['Converta 12 m/s em 43,2 km/h ou 40 km/h em aproximadamente 11,1 m/s.', 'Comparar as magnitudes sem igualar as unidades.'],
  'v93-phys-units-14': ['5 km/10 s resulta em 0,5 km/s; para km/h, multiplique por 3.600, não troque só o rótulo.', 'Atribuir km/h a uma razão cujo tempo permanece em segundos.'],
  'v93-phys-units-15': ['Derive 3,6 de 1.000 m/km e 3.600 s/h, em vez de memorizar apenas o par.', 'Memorizar um valor sem compreender o sentido da conversão.'],
  'v93-phys-units-17': ['30 min são 0,5 h; mantenha a unidade de tempo indicada no cálculo.', 'Usar minutos como se fossem horas ou não converter o intervalo.'],
  'v93-phys-units-19': ['1 km = 1.000 m; multiplique 3,2 por 1.000.', 'Deslocar a vírgula pelo número errado de casas.'],
  'v93-phys-units-20': ['Para distância, (m/s) × s cancela segundos e deixa metros.', 'Ignorar o cancelamento das unidades no produto.'],
};

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(ROOT, relativePath), 'utf8'));
const v4Questions = readJson('content/adaptive/tec-escola-core-v4/subjects/physics/questions.json')
  .filter((question) => question.id === 'v3-physics-physics_average_speed-9');
const v9Journey = readJson('content/adaptive/tec-escola-core-v9/journey-expansion-a-v1.json')
  .journeys.find((journey) => journey.skill === 'PHYSICS_UNIT_CONVERSION');
const v9QuestionIds = Object.keys(sourceFeedbackById).filter((id) => id.startsWith('v93-'));
const v9Questions = v9Journey?.questions.filter((question) => v9QuestionIds.includes(question.id)) ?? [];
const originalQuestions = [...v4Questions, ...v9Questions];
const sourceQuestionFeedback = originalQuestions.map((question) => {
  const feedback = sourceFeedbackById[question.id];
  if (!feedback) throw new Error(`PHYSICS_UNIT_CONVERSION_SOURCE_FEEDBACK_MISSING:${question.id}`);
  return { questionId: question.id, hint: feedback[0], errorFocus: feedback[1] };
});
if (!v9Journey || originalQuestions.length !== 14 || sourceQuestionFeedback.length !== 14) {
  throw new Error('PHYSICS_UNIT_CONVERSION_SOURCE_RECONCILIATION_FAILED');
}

const idsFor = (purpose) => questions.filter((question) => question.purpose === purpose).map((question) => question.id);
const pack = {
  packVersion: 'tec-escola-core-v5-question-first',
  contentId: 'v5-physics-unit-conversion-wave3',
  subject: 'PHYSICS',
  domain: 'MEDIDAS',
  topic: 'conversao_de_unidades_de_movimento',
  canonicalSkillCode: 'PHYSICS_UNIT_CONVERSION',
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
  sourceReconciliation: {
    v4SourceQuestionIds: v4Questions.map((question) => question.id),
    v9SourceQuestionIds: v9Questions.map((question) => question.id),
    v9ItemsNotReusedBecauseTheyAssessSpeedOrAccelerationRatherThanUnitConversion: ['v93-phys-units-03', 'v93-phys-units-05', 'v93-phys-units-08', 'v93-phys-units-09', 'v93-phys-units-11', 'v93-phys-units-16', 'v93-phys-units-18'],
  },
  questions,
  lesson: {
    title: 'Converter unidades e comparar movimentos',
    objective: 'Converter medidas de distância e tempo, manter as unidades coerentes em taxas de movimento e comparar rapidez apenas depois de expressá-las na mesma unidade.',
    summary: 'Use fatores equivalentes a 1 para trocar a unidade sem alterar a grandeza. Cancele as unidades antigas, verifique a unidade final e só então compare os valores.',
    explanation: '## 1. Grandeza e unidade não são a mesma coisa\nA distância ou o tempo medidos não mudam quando trocamos a unidade; muda apenas o número que os representa. Por exemplo, 1 km e 1.000 m descrevem a mesma distância. Uma comparação física só é válida se as quantidades estiverem expressas em unidades compatíveis.\n\n## 2. Converta com fatores que valem 1\nEscreva uma igualdade conhecida como fração: 1 km = 1.000 m, então podemos multiplicar por (1.000 m)/(1 km), que vale 1. As unidades km se cancelam e sobra m. Do mesmo modo, 1 h = 3.600 s e 1 min = 60 s. Não é uma regra de mover a vírgula sem pensar: o fator deve cancelar a unidade que você quer retirar.\n\n## 3. Converta taxas acompanhando numerador e denominador\nUma taxa como km/h tem distância no numerador e tempo no denominador. Para passar de km/h a m/s, multiplique por (1.000 m/1 km) e por (1 h/3.600 s): o valor numérico é dividido por 3,6. No caminho inverso, m/s para km/h, multiplique por 3,6. O fator vem de 1.000/3.600, não de uma regra arbitrária.\n\n## 4. Exemplo resolvido: comparação de dois sensores\nO sensor A indica 18 m/s; o B indica 54 km/h. Para comparar, passe A para km/h: 18 × 3,6 = 64,8 km/h. Como 64,8 > 54, A é mais rápido. Conferência: 54 km/h ÷ 3,6 = 15 m/s, que também é menor que 18 m/s. Assim, 18 m/s não equivale a 54 km/h.\n\n## 5. Verifique o resultado antes de aceitar\nEscreva a unidade em cada linha. Se você calcula uma distância por tempo, o resultado precisa continuar sendo distância/tempo. Confira se a unidade desejada sobrou depois dos cancelamentos e estime se o tamanho faz sentido. Ao comparar duas velocidades, transforme ambas para a mesma unidade ou transforme apenas uma; não compare diretamente números acompanhados de unidades diferentes.\n\n## 6. Quando o erro aparecer\nSe km/h virou um valor muito maior em m/s, confira a direção do fator 3,6. Se km/min virou m/s, converta tanto km para m quanto min para s. Se a unidade final estiver errada, não corrija apenas o rótulo: volte à expressão e faça as unidades cancelarem.',
    workedExample: 'Um carrinho percorre 0,24 km em 1 min. Em metros e segundos: 0,24 km = 240 m e 1 min = 60 s; portanto a taxa é 240/60 = 4 m/s. Para compará-la a outro sensor que indica 14,4 km/h, converta 14,4 ÷ 3,6 = 4 m/s. As duas leituras são equivalentes.',
    commonMistake: 'Aplicar o fator 3,6 no sentido errado, converter só uma parte de uma taxa ou comparar os valores numéricos sem igualar as unidades.',
    commonErrors: ['Multiplicar por 3,6 ao converter km/h para m/s.', 'Converter km para m e esquecer hora/minuto para segundo.', 'Trocar o rótulo da unidade sem converter o número.', 'Usar fatores que não cancelam as unidades antigas.', 'Somar ou comparar grandezas expressas em unidades diferentes.', 'Tratar 1 h como 60 s em vez de 3.600 s.'],
    tips: ['Escreva a unidade junto de cada número, inclusive nos fatores de conversão.', 'Monte os fatores para que as unidades indesejadas apareçam uma vez em cima e outra embaixo.', 'Para km/h → m/s, divida por 3,6; para m/s → km/h, multiplique por 3,6.', 'Antes de comparar, converta ambos os valores para a mesma unidade.'],
    priorKnowledge: ['Multiplicar e dividir números decimais.', 'Reconhecer frações equivalentes.', 'Interpretar distância e duração.'],
    keyConcepts: ['fator de conversão equivalente a 1', 'cancelamento algébrico de unidades', 'prefixos kilo, centi e milli', 'conversão de tempo entre horas, minutos e segundos', 'unidade composta de rapidez', 'comparação de medidas na mesma unidade'],
    progression: [
      { stage: 'FOUNDATION', focus: 'Converter comprimentos e durações com fatores equivalentes.', questionIds: [...idsFor('PROBE'), ...idsFor('PRACTICE')] },
      { stage: 'CONVERSION_IN_CONTEXT', focus: 'Converter taxas compostas e comparar rapidez de sensores em situações novas.', questionIds: idsFor('TRANSFER') },
      { stage: 'ERROR_ANALYSIS', focus: 'Diagnosticar fatores invertidos e justificar os cancelamentos dimensionais.', questionIds: idsFor('LOCK_IN') },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Recuperar conversões de distância, tempo e rapidez em contextos variados.', questionIds: idsFor('REVIEW') },
    ],
    microExplanations: [
      { trigger: 'CONVERSION_FACTOR', text: 'Multiplique por uma razão equivalente a 1; escolha a orientação que cancela a unidade antiga.' },
      { trigger: 'KMH_TO_MS', text: 'km/h → m/s: km vira m por ×1.000 e hora vira s por ÷3.600; no total, divida por 3,6.' },
      { trigger: 'MS_TO_KMH', text: 'm/s → km/h é o caminho inverso; multiplique por 3,6.' },
      { trigger: 'COMPOUND_RATE', text: 'Em km/min → m/s, converta numerador e denominador; 0,6 km/min = 600 m/60 s.' },
      { trigger: 'UNIT_CANCELLATION', text: 'Se a unidade que você quer retirar não cancela, inverta o fator antes de calcular.' },
      { trigger: 'COMPARE_SAME_UNIT', text: 'Antes de ordenar duas medidas, expresse ambas na mesma unidade.' },
    ],
    remediations: [
      { id: 'FACTOR_DIRECTION', misconception: 'FATOR_3_6_INVERTIDO', prompt: 'Derive 3,6 de 1.000 m por km e 3.600 s por hora; escreva qual unidade cancela em cada fator.' },
      { id: 'BOTH_RATE_UNITS', misconception: 'CONVERSAO_PARCIAL_DA_TAXA', prompt: 'Escreva a taxa como fração e circule numerador e denominador. Converta cada um separadamente.' },
      { id: 'LABEL_WITHOUT_CONVERSION', misconception: 'ROTULO_TROCADO_SEM_CONVERSAO', prompt: 'Mantenha o número original e escreva os fatores de conversão; não altere o rótulo até as unidades cancelarem.' },
      { id: 'COMPARE_COMPATIBLE_UNITS', misconception: 'COMPARACAO_DE_NUMEROS_INCOMPATIVEIS', prompt: 'Escolha uma unidade comum e transforme cada medida antes de decidir qual é maior.' },
      { id: 'TIME_SCALE', misconception: 'HORA_MINUTO_SEGUNDO_CONFUNDIDOS', prompt: 'Monte a cadeia 1 h = 60 min = 3.600 s e converta cada parte da duração antes de somar.' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 25,
    sourceDossier: [
      {
        title: 'The International System of Units (SI Brochure), 9th edition, updated 2026',
        publisher: 'Bureau International des Poids et Mesures (BIPM)',
        url: 'https://www.bipm.org/en/web/guest/publications/si-brochure',
        accessedOn: '2026-10-13',
        supports: ['Referência normativa para unidades, símbolos e prefixos do SI.'],
        license: 'Creative Commons Attribution 4.0 International',
        use: 'Consulta de notação e unidades; texto, exemplos e questões do pacote são autorais.',
      },
      {
        title: '1.2 Physical Quantities and Units',
        publisher: 'OpenStax, College Physics 2e',
        url: 'https://openstax.org/books/college-physics-2e/pages/1-2-physical-quantities-and-units',
        accessedOn: '2026-10-13',
        supports: ['Fatores de conversão, conversões de unidades e análise das unidades resultantes em problemas de movimento.'],
        license: 'OpenStax, CC BY 4.0',
        use: 'Referência conceitual; conteúdo deste pacote foi escrito de forma independente.',
      },
      {
        title: '1.4 Dimensional Analysis',
        publisher: 'OpenStax, University Physics Volume 1',
        url: 'https://openstax.org/books/university-physics-volume-1/pages/1-4-dimensional-analysis',
        accessedOn: '2026-10-13',
        supports: ['Consistência dimensional e uso das unidades para verificar expressões físicas.'],
        license: 'OpenStax, CC BY-NC-SA',
        use: 'Referência conceitual consultada; não houve reprodução de exemplos ou questões.',
      },
    ],
    copyrightNote: 'Questões, explicações e exemplos são autorais e não reproduzem itens das fontes consultadas. Referências sustentam notação SI e análise dimensional; mapeamento BNCC oficial e revisão pedagógica humana permanecem pendentes.',
  },
};

const actualPurposeCounts = Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
if (questions.length !== 40 || JSON.stringify(actualPurposeCounts) !== JSON.stringify(purposeCounts)) {
  throw new Error('PHYSICS_UNIT_CONVERSION_V5_QUESTION_COUNTS_INVALID');
}
if (answerPositionCounts.some((count) => count !== 10)) throw new Error('PHYSICS_UNIT_CONVERSION_V5_ANSWER_POSITIONS_UNBALANCED');

export function buildPhysicsUnitConversionPack() {
  return structuredClone(pack);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Wrote ${questions.length} authorial physics unit-conversion questions and ${sourceQuestionFeedback.length} source-feedback records to ${OUTPUT}`);
}
