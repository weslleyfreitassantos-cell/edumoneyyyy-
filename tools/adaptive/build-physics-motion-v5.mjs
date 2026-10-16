import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const physicsQuestions = JSON.parse(readFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v4/subjects/physics/questions.json'), 'utf8'));
const purposes = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const purposeFor = (index) => index < 4 ? 'PROBE' : index < 16 ? 'PRACTICE' : index < 24 ? 'TRANSFER' : index < 30 ? 'LOCK_IN' : 'REVIEW';
const distractorsFor = (answer, wrong) => [...new Set(wrong.filter((value) => value !== answer))].slice(0, 3);
const motionObject = (id) => {
  if (['ONIBUS_TERMINAL'].includes(id)) return 'dois ônibus';
  return ({
  CICLISTA: 'uma ciclista', CARRINHO: 'um carrinho', ONIBUS: 'um ônibus', TREM: 'um trem', ELEVADOR: 'um elevador',
  PATINADOR: 'uma pessoa de patins', BOLA: 'uma bola', VAN: 'uma van', BARCO: 'um barco', ATLETA: 'um atleta',
  SKATE: 'uma pessoa no skate', MOTO: 'uma moto', CAMINHAO: 'um caminhão', TRATOR: 'um trator', VEICULO: 'um veículo',
  CORREDOR: 'uma pessoa correndo', METRO: 'um metrô', ROBO: 'um robô', PESSOA: 'uma pessoa', FERRY: 'uma balsa',
  BICICLETA: 'uma bicicleta', CAMINHANTE: 'uma pessoa caminhando', PATINETE: 'um patinete', CARROS: 'dois carros',
  CICLISTAS: 'dois ciclistas', CORREDORES: 'dois corredores', TRENS: 'dois trens', BARCOS: 'dois barcos',
  PATINADORES: 'duas pessoas de patins', AERONAVES: 'duas aeronaves', MOTOS: 'duas motos', BALSAS: 'duas balsas',
  BICICLETAS: 'duas bicicletas', CAMINHANTES: 'duas pessoas caminhando', LANCHAS: 'duas lanchas', VANS: 'duas vans',
}[id.split('_')[0]] ?? 'um móvel');
};

const accelerationCases = [
  ['CICLISTA_SUBIDA', 2, 8, 3], ['CARRINHO_RAMPA', 0, 6, 2], ['ONIBUS_PARTIDA', 4, 10, 3], ['TREM_FREIO', 18, 6, 4],
  ['ELEVADOR_SUBIDA', 1, 9, 4], ['PATINADOR_PISTA', 3, 15, 6], ['BOLA_ROLAMENTO', 12, 4, 4], ['VAN_TRANSITO', 5, 17, 6],
  ['BARCO_CORRENTE', 2, 8, 4], ['ATLETA_SPRINT', 1, 7, 2], ['METRO_PARTIDA', 0, 12, 4], ['SKATE_RAMPA', 4, 16, 4],
  ['MOTO_REDUCAO', 20, 8, 4], ['CARRINHO_LABORATORIO', 2, 14, 6], ['BICICLETA_DESCIDA', 6, 18, 3], ['TREM_TRILHO', 10, 22, 6],
  ['FREIO_ONIBUS', 24, 12, 4], ['CORREDOR_FINAL', 3, 11, 4], ['ELEVADOR_PARADA', 16, 4, 6], ['BOLA_CHUTE', 0, 20, 5],
  ['TRATOR_PARTIDA', 2, 14, 3], ['PATINETE_PISTA', 5, 17, 4], ['CAMINHAO_FREIO', 28, 10, 6], ['BARCO_MANOBRA', 6, 18, 4],
  ['CICLISTA_FREIO', 16, 4, 3], ['CARRINHO_SUPERFICIE', 1, 13, 4], ['TREM_ESTACAO', 8, 20, 6], ['VAN_ESTRADA', 4, 16, 3],
  ['ATLETA_CURVA', 2, 14, 6], ['MOTO_RETA', 10, 22, 4], ['ELEVADOR_DESCIDA', 18, 6, 3], ['SKATE_PISTA', 0, 12, 3],
  ['ONIBUS_CORREDOR', 20, 8, 3], ['BOLA_RETORNO', -2, 6, 4], ['CICLISTA_SENTIDO', -4, 8, 4], ['TREM_MARCHA_RE', 10, -2, 4],
  ['CARRINHO_MARCHA_RE', -6, 2, 2], ['BARCO_MUDANCA_SENTIDO', 8, -4, 4], ['PATINADOR_FREIO', -2, -14, 4], ['VEICULO_RECUO', 6, -6, 3],
];
const relativeCases = [
  ['CICLISTAS_MESMO_SENTIDO', 18, 12, 'same'], ['CORREDORES_MESMO_SENTIDO', 9, 5, 'same'], ['TRENS_APROXIMACAO', 72, 54, 'opposite'], ['BARCOS_AFASTAMENTO', 14, 9, 'opposite'],
  ['ONIBUS_E_BICICLETA', 48, 12, 'same'], ['PATINADORES_APROXIMACAO', 6, 4, 'opposite'], ['CARROS_MESMO_SENTIDO', 90, 72, 'same'], ['BALSAS_AFASTAMENTO', 20, 15, 'opposite'],
  ['ATLETAS_PISTA', 8, 3, 'same'], ['TRENS_SENTIDOS_OPPOSTOS', 60, 40, 'opposite'], ['CICLISTAS_APROXIMACAO', 16, 10, 'opposite'], ['AERONAVES_MESMO_SENTIDO', 800, 650, 'same'],
  ['MOTOS_E_ONIBUS', 54, 36, 'same'], ['BARCOS_RIO', 12, 7, 'opposite'], ['CORREDORES_REVEZAMENTO', 7, 4, 'same'], ['CARROS_ENCONTRO', 80, 50, 'opposite'],
  ['TRATORES_MESMO_SENTIDO', 24, 18, 'same'], ['PATINETES_APROXIMACAO', 10, 6, 'opposite'], ['METRO_E_TREM', 66, 42, 'same'], ['BICICLETAS_ENCONTRO', 15, 9, 'opposite'],
  ['BARCOS_CANAL', 21, 13, 'same'], ['ATLETAS_SENTIDOS_OPPOSTOS', 11, 5, 'opposite'], ['VANS_E_CAMINHOES', 70, 45, 'same'], ['TRENS_ENCONTRO', 90, 54, 'opposite'],
  ['CICLISTAS_PONTE', 20, 12, 'same'], ['LANCHAS_APROXIMACAO', 30, 18, 'opposite'], ['CORREDORES_PISTA', 12, 8, 'same'], ['CARROS_AFASTAMENTO', 96, 64, 'opposite'],
  ['PATINADORES_MESMO_SENTIDO', 9, 6, 'same'], ['BALSAS_ENCONTRO', 25, 15, 'opposite'], ['MOTOS_E_CARRO', 100, 70, 'same'], ['CAMINHANTES_APROXIMACAO', 5, 3, 'opposite'],
  ['TRENS_DISTANCIA', 80, 50, 'same'], ['BARCOS_ESTUARIO', 18, 11, 'opposite'], ['BICICLETAS_TRILHA', 24, 15, 'same'], ['AERONAVES_APROXIMACAO', 900, 600, 'opposite'],
  ['ONIBUS_TERMINAL', 60, 42, 'same'], ['CORREDORES_ENCONTRO', 10, 7, 'opposite'], ['CARROS_ESTRADA', 110, 85, 'same'], ['PATINETES_PRAÇA', 8, 5, 'opposite'],
];
const uniformCases = [
  ['TREM_INTERVALOS', [0, 2, 4, 6], [0, 10, 20, 30]], ['CICLISTA_TRILHA', [0, 1, 2, 3], [2, 5, 8, 11]], ['ELEVADOR_ANDAR', [0, 2, 4, 6], [12, 8, 4, 0]], ['ESTEIRA_CAIXAS', [0, 3, 6, 9], [0, 6, 12, 18]],
  ['ONIBUS_RETA', [0, 5, 10, 15], [4, 14, 24, 34]], ['BARCO_CANAL', [0, 2, 4, 6], [30, 24, 18, 12]], ['ROBO_CORREDOR', [0, 4, 8, 12], [0, 12, 24, 36]], ['ATLETA_PISTA', [0, 2, 4, 6], [5, 13, 21, 29]],
  ['METRO_TRECHO', [0, 3, 6, 9], [18, 33, 48, 63]], ['PATINADOR_GINASIO', [0, 5, 10, 15], [40, 30, 20, 10]], ['CARRINHO_LAB', [0, 1, 2, 3], [7, 10, 13, 16]], ['FERRY_TRAVESSIA', [0, 4, 8, 12], [0, 20, 40, 60]],
  ['TRATOR_ESTRADA', [0, 2, 4, 6], [10, 16, 22, 28]], ['CORREDOR_PARQUE', [0, 3, 6, 9], [27, 21, 15, 9]], ['VAN_BAIRRO', [0, 4, 8, 12], [3, 19, 35, 51]], ['SKATE_RAMPA', [0, 2, 4, 6], [12, 8, 4, 0]],
  ['TREM_CARGA', [0, 5, 10, 15], [50, 75, 100, 125]], ['BICICLETA_CICLOVIA', [0, 2, 4, 6], [1, 9, 17, 25]], ['BARCO_MARINA', [0, 3, 6, 9], [30, 42, 54, 66]], ['ELEVADOR_DESCIDA', [0, 2, 4, 6], [24, 18, 11, 6]],
  ['MOTO_AVENIDA', [0, 4, 8, 12], [0, 36, 72, 108]], ['PESSOA_CALCADA', [0, 5, 10, 15], [20, 15, 10, 5]], ['ONIBUS_INTERURBANO', [0, 6, 12, 18], [2, 38, 74, 110]], ['ROBO_ARMAZEM', [0, 3, 6, 9], [15, 6, -3, -12]],
  ['TREM_SUBURBANO', [0, 2, 4, 6], [0, 14, 28, 42]], ['ATLETA_RETROCESSO', [0, 3, 6, 9], [9, 3, -3, -9]], ['CAMINHAO_RODOVIA', [0, 5, 10, 15], [10, 35, 60, 85]], ['PATINETE_CICLOVIA', [0, 2, 4, 6], [0, 7, 14, 21]],
  ['BARCO_CORRENTE', [0, 4, 8, 12], [48, 32, 17, 0]], ['METRO_PLATAFORMA', [0, 2, 4, 6], [100, 100, 100, 100]], ['CICLISTA_SUBIDA', [0, 3, 6, 9], [0, 9, 18, 27]], ['CARRINHO_DESCIDA', [0, 1, 2, 3], [20, 17, 13, 11]],
  ['VAN_ESTRADA', [0, 5, 10, 15], [5, 30, 55, 80]], ['PESSOA_CORREDOR', [0, 2, 4, 6], [0, 6, 11, 18]], ['TREM_LINHA', [0, 3, 6, 9], [45, 30, 14, 0]], ['ROBO_LABORATORIO', [0, 4, 8, 12], [2, 14, 26, 38]],
  ['BARCO_LAGO', [0, 3, 6, 9], [6, 0, -6, -12]], ['PATINADOR_PISTA', [0, 2, 4, 6], [4, 12, 20, 28]], ['CAMINHANTE_TRILHA', [0, 6, 12, 18], [0, 24, 48, 72]], ['ELEVADOR_TORRE', [0, 5, 10, 15], [30, 10, -9, -30]],
];

const labelNumber = (value) => {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
};
const formatAcceleration = (value) => `${labelNumber(Math.abs(value))} m/s², sentido ${value < 0 ? 'negativo' : value > 0 ? 'positivo' : 'nulo'}`;
const formatVelocity = (value) => value === 0 ? '0 m/s (repouso)' : `${labelNumber(Math.abs(value))} m/s, sentido ${value < 0 ? 'negativo' : 'positivo'}`;
const answerChoice = (question, index, answer, wrong) => {
  const distractors = distractorsFor(answer, wrong);
  while (distractors.length < 3) distractors.push(`${distractors.length + 2} unidades`);
  const position = index % 4;
  const options = distractors.slice(0, 3);
  options.splice(position, 0, answer);
  return { ...question, options, correctAnswer: answer, misconceptions: { [options[(position + 1) % 4]]: [question.errorFocus] } };
};

function buildAccelerationQuestions() {
  return accelerationCases.map(([contextFamily, initial, final, seconds], index) => {
    const purpose = purposeFor(index);
    const delta = final - initial;
    const acceleration = delta / seconds;
    const answer = formatAcceleration(acceleration);
    const isReview = purpose === 'REVIEW';
    const isLock = purpose === 'LOCK_IN';
    const isTransfer = purpose === 'TRANSFER';
    const statement = isLock
      ? `Um sensor acompanha ${motionObject(contextFamily)}: a velocidade mudou de ${initial} m/s para ${final} m/s em ${seconds} s. Uma pessoa afirma que a aceleração média é ${formatAcceleration(final / seconds)}, usando apenas a velocidade final. Qual revisão está correta?`
      : isTransfer && index % 3 === 0
        ? `Em um ensaio com ${motionObject(contextFamily)}, a velocidade passa de ${initial} m/s para ${final} m/s em ${seconds} s. Qual aceleração média com sinal deve ser registrada?`
        : isTransfer && index % 3 === 1
          ? `Um relatório de ${motionObject(contextFamily)} informa velocidades de ${initial} m/s e ${final} m/s, separadas por ${seconds} s. Qual resultado expressa a variação por segundo e seu sentido no eixo adotado?`
          : isTransfer
            ? `Ao analisar ${motionObject(contextFamily)}, uma pessoa divide a velocidade final ${final} m/s por ${seconds} s e chama o resultado de aceleração. Qual aceleração média corrigida usa também a velocidade inicial de ${initial} m/s?`
      : isReview && index % 2 === 1
        ? `Em um ensaio com ${motionObject(contextFamily)}, a velocidade foi ${initial} m/s no início e ${final} m/s ${seconds} s depois. Qual aceleração média, com sinal, descreve a variação nesse intervalo?`
        : `Um sensor acompanha ${motionObject(contextFamily)}. A velocidade passa de ${initial} m/s para ${final} m/s em ${seconds} s. Qual é a aceleração média no intervalo?`;
    const errorFocus = initial < final ? 'ACCELERATION_USES_VELOCITY_CHANGE_PER_TIME' : 'NEGATIVE_ACCELERATION_SIGN_AND_REFERENCE';
    const explanation = `A variação da velocidade é ${final} − (${initial}) = ${delta} m/s. Dividindo pelo intervalo de ${seconds} s, o módulo da aceleração média é ${labelNumber(Math.abs(acceleration))} m/s², no sentido ${acceleration < 0 ? 'negativo' : 'positivo'} do eixo adotado. O sinal não indica, sozinho, se o módulo da rapidez aumenta ou diminui.`;
    const wrong = [formatAcceleration(final / seconds), formatAcceleration(delta), formatAcceleration(Math.abs(delta) / seconds)];
    return answerChoice({
      id: `v5-physics-acceleration-${String(index + 1).padStart(2, '0')}`,
      purpose, difficulty: index < 4 ? 'EASY' : index < 24 ? 'MEDIUM' : 'HARD',
      cognitiveProcess: isLock ? 'EVALUATE' : isTransfer ? ['CALCULATE', 'INTERPRET', 'EVALUATE'][index % 3] : isReview ? 'INTERPRET' : 'CALCULATE', contextFamily,
      statement,
      explanation: isLock ? `A conta precisa usar a variação completa, não apenas a velocidade final. ${explanation}` : explanation,
      hint: 'Registre velocidade inicial, velocidade final e intervalo. Calcule (final − inicial) ÷ tempo, mantendo a unidade m/s².',
      errorFocus,
    }, index, answer, wrong);
  });
}

function buildRelativeQuestions() {
  return relativeCases.map(([contextFamily, firstSpeed, secondSpeed, direction], index) => {
    const purpose = purposeFor(index);
    const relative = direction === 'same' ? Math.abs(firstSpeed - secondSpeed) : firstSpeed + secondSpeed;
    const answer = `${labelNumber(relative)} km/h`;
    const verb = direction === 'same' ? 'seguem no mesmo sentido' : 'se deslocam em sentidos opostos';
    const frame = index % 2 ? 'em relação ao primeiro móvel' : 'para um observador parado em relação ao solo';
    const isLock = purpose === 'LOCK_IN';
    const isTransfer = purpose === 'TRANSFER';
    const distance = isTransfer && direction === 'opposite' ? relative * (1 + (index % 3)) : [12, 18, 24, 30, 36, 42, 48, 60][index % 8];
    const time = distance / relative;
    const asksTime = isTransfer && direction === 'opposite' && Number.isInteger(time);
    const correct = asksTime ? `${labelNumber(time)} h` : answer;
    const claimedOperation = direction === 'same' ? 'somou os módulos' : 'subtraiu os módulos';
    const statement = isLock
      ? `Dois móveis ${verb}, com velocidades de ${firstSpeed} km/h e ${secondSpeed} km/h. Uma resolução ${claimedOperation} sem considerar o sentido. Qual velocidade relativa descreve corretamente o movimento de um em relação ao outro?`
      : asksTime
        ? `Dois móveis partem separados por ${distance} km e se aproximam em sentidos opostos. Suas velocidades constantes são ${firstSpeed} km/h e ${secondSpeed} km/h. Em quanto tempo se encontram?`
        : isTransfer && direction === 'same' && index % 4 === 0
          ? `Dois móveis seguem no mesmo sentido a ${firstSpeed} km/h e ${secondSpeed} km/h. Uma análise soma os módulos para estimar quanto um se afasta do outro por hora. Qual taxa relativa corrige essa análise?`
          : isTransfer
            ? `Em um teste com dois móveis ${verb}, uma ficha registra ${firstSpeed} km/h e ${secondSpeed} km/h. Qual módulo de velocidade relativa deve ser anotado após considerar os sentidos?`
        : `Dois móveis ${verb}, com velocidades constantes de ${firstSpeed} km/h e ${secondSpeed} km/h. Qual é o módulo da velocidade relativa entre eles?`;
    const operation = direction === 'same' ? `${Math.max(firstSpeed, secondSpeed)} − ${Math.min(firstSpeed, secondSpeed)} = ${relative}` : `${firstSpeed} + ${secondSpeed} = ${relative}`;
    const calculation = asksTime ? `A rapidez de aproximação é ${operation} km/h. Então, tempo = distância ÷ rapidez relativa = ${distance} ÷ ${relative} = ${labelNumber(time)} h.` : `Como os sentidos são ${direction === 'same' ? 'iguais' : 'opostos'}, a rapidez relativa é ${operation} km/h.`;
    const wrong = asksTime ? [`${labelNumber(distance / Math.abs(firstSpeed - secondSpeed))} h`, `${labelNumber(distance / (firstSpeed + secondSpeed))} h`, `${labelNumber(relative)} h`] : [`${labelNumber(firstSpeed + secondSpeed)} km/h`, `${labelNumber(Math.abs(firstSpeed - secondSpeed))} km/h`, `${labelNumber(Math.max(firstSpeed, secondSpeed))} km/h`];
    const errorFocus = direction === 'same' ? 'SAME_DIRECTION_SPEEDS_MUST_BE_SUBTRACTED' : 'OPPOSITE_DIRECTION_SPEEDS_MUST_BE_ADDED';
    return answerChoice({
      id: `v5-physics-relative-speed-${String(index + 1).padStart(2, '0')}`,
      purpose, difficulty: index < 4 ? 'EASY' : index < 24 ? 'MEDIUM' : 'HARD',
      cognitiveProcess: isLock ? 'EVALUATE' : asksTime ? 'SOLVE' : isTransfer ? (index % 4 === 0 ? 'COMPARE' : 'EVALUATE') : 'INTERPRET', contextFamily,
      statement, explanation: `${calculation} ${frame} define o referencial; para o módulo da velocidade relativa, sentidos iguais levam à diferença dos módulos e sentidos opostos levam à soma.`,
      hint: 'Desenhe uma seta para cada movimento e escolha quem observa. Mesmo sentido: compare os módulos; sentidos opostos: some os módulos.', errorFocus,
    }, index, correct, wrong);
  });
}

function buildUniformQuestions() {
  return uniformCases.map(([contextFamily, times, positions], index) => {
    const purpose = purposeFor(index);
    const increments = positions.slice(1).map((value, i) => value - positions[i]);
    const intervals = times.slice(1).map((value, i) => value - times[i]);
    const constant = increments.every((value, i) => value / intervals[i] === increments[0] / intervals[0]);
    const speed = increments[0] / intervals[0];
    const isLock = purpose === 'LOCK_IN';
    const isTransfer = purpose === 'TRANSFER';
    const answer = purpose === 'LOCK_IN'
      ? constant ? 'Sim: deslocamentos iguais em tempos iguais indicam velocidade constante.' : 'Não: as razões entre deslocamento e tempo variam entre intervalos.'
      : isTransfer ? constant ? `${formatVelocity(speed)}; movimento uniforme.` : 'Os dados não sustentam movimento uniforme: a razão varia entre trechos.'
        : constant ? formatVelocity(speed) : 'Não é uniforme: a razão entre deslocamento e tempo varia.';
    const table = times.map((time, i) => `${time} s → ${positions[i]} m`).join('; ');
    const statement = isLock
      ? `Uma turma analisou a posição de ${motionObject(contextFamily)} nos instantes ${table}. Um estudante conclui que o movimento é uniforme porque os instantes estão igualmente espaçados. Qual avaliação usa o critério físico correto?`
      : isTransfer && index % 3 === 0
        ? `Uma equipe registra a posição de ${motionObject(contextFamily)}: ${table}. Qual conclusão sobre a uniformidade e a velocidade com sinal é sustentada pelos trechos?`
        : isTransfer && index % 3 === 1
          ? `Considere os pares tempo–posição de ${motionObject(contextFamily)}: ${table}. O que os dados permitem concluir sobre a constância da velocidade?`
          : isTransfer
            ? `Uma ficha de ${motionObject(contextFamily)} traz os dados ${table}. A equipe afirma que eles mostram movimento uniforme; qual conclusão, apoiada pelos intervalos, confirma ou corrige essa afirmação?`
      : `Um sensor registra a posição de ${motionObject(contextFamily)}: ${table}. Considerando os intervalos iguais de tempo, qual é a classificação e, se for uniforme, a velocidade com sinal?`;
    const wrong = isLock
      ? ['Sim, porque os instantes estão igualmente espaçados, mesmo sem comparar as posições.', 'Não, porque a posição precisa ficar constante para haver velocidade constante.', 'Basta dividir a posição final pelo tempo total para provar que a velocidade foi constante.']
      : isTransfer && constant
        ? [`${formatVelocity(speed + 2)}; movimento uniforme.`, `${formatVelocity(speed - 2)}; movimento uniforme.`, 'Os dados não sustentam movimento uniforme.']
        : isTransfer
          ? [`${formatVelocity(increments[0] / intervals[0])}; movimento uniforme.`, `${formatVelocity(increments.at(-1) / intervals.at(-1))}; movimento uniforme.`, 'A posição final maior, por si só, prova velocidade constante.']
      : constant
        ? [...new Set([positions.at(-1) / times.at(-1), speed + 2, speed - 2, speed + 1, speed - 1].filter((value) => value !== speed).map(formatVelocity).filter((value) => value !== formatVelocity(speed)))].slice(0, 3)
        : [`${labelNumber(increments.at(-1) / intervals.at(-1))} m/s`, 'Sim: a posição final é maior que a inicial.', 'Sim: todo deslocamento indica velocidade constante.'];
    const explanation = `Compare a variação de posição em cada intervalo igual: ${increments.map((value, i) => `${value} m em ${intervals[i]} s`).join('; ')}. ${constant ? `A razão é constante, então o movimento é uniforme e v = Δposição/Δtempo = ${labelNumber(speed)} m/s. O sinal indica o sentido no eixo escolhido.` : 'As razões por intervalo não são iguais; portanto, os dados não sustentam movimento uniforme.'} Posição constante seria repouso, que é um caso particular de velocidade constante igual a zero.`;
    return answerChoice({
      id: `v5-physics-uniform-motion-${String(index + 1).padStart(2, '0')}`,
      purpose, difficulty: index < 4 ? 'EASY' : index < 24 ? 'MEDIUM' : 'HARD',
      cognitiveProcess: isLock ? 'EVALUATE' : isTransfer ? ['APPLY', 'INTERPRET', 'EVALUATE'][index % 3] : 'INTERPRET', contextFamily, statement,
      explanation, hint: 'Compare Δposição/Δtempo em cada trecho. Em movimento uniforme, a razão é a mesma; posição constante significa repouso.',
      errorFocus: constant ? 'UNIFORM_MOTION_CONFUSED_WITH_REST_OR_FINAL_POSITION_OVER_TOTAL_TIME' : 'EQUAL_TIME_STEPS_DO_NOT_GUARANTEE_EQUAL_DISPLACEMENTS',
    }, index, answer, wrong);
  });
}

const lessonData = {
  PHYSICS_INTERPRET_ACCELERATION: {
    domain: 'MOVIMENTO', topic: 'interpretar_aceleracao_media', title: 'Interpretar aceleração como variação da velocidade',
    objective: 'Interpretar aceleração média como variação de velocidade por intervalo de tempo, com sinal e unidade coerentes.',
    explanation: '## Aceleração mede mudança de velocidade\nA aceleração média é **a = (v final − v inicial) ÷ intervalo de tempo**. Se a velocidade muda de 4 m/s para 10 m/s em 3 s, a variação é 6 m/s e a aceleração média é 2 m/s².\n\n## O sinal depende do eixo\nUma aceleração negativa indica variação no sentido negativo do eixo escolhido. Ela não significa sempre que o objeto está ficando mais lento: se velocidade e aceleração têm o mesmo sentido, o módulo da velocidade aumenta; se têm sentidos opostos, diminui.\n\n## Unidade e interpretação\nDividir m/s por s resulta em m/s². A aceleração média resume o intervalo; ela não diz que a aceleração foi constante em cada instante. Compare início, fim e duração antes de interpretar.',
    example: 'Um carrinho passa de 2 m/s para 8 m/s em 3 s: Δv = 6 m/s; a = 6/3 = 2 m/s². Se passa de 8 m/s para 2 m/s no mesmo intervalo, a = −2 m/s² no eixo positivo escolhido.',
    concepts: ['variação da velocidade', 'intervalo de tempo', 'aceleração média', 'sinal', 'm/s²'],
    micro: [['DELTA_V_FIRST','Subtraia a velocidade inicial da final antes de dividir pelo tempo.'],['UNIT_ACCELERATION','Uma unidade de m/s dividida por segundo resulta em m/s².'],['SIGN_IS_DIRECTION','O sinal informa a orientação da variação em relação ao eixo escolhido.'],['NEGATIVE_NOT_ALWAYS_SLOWER','Aceleração negativa só significa redução da rapidez se a velocidade aponta no sentido positivo.'],['AVERAGE_INTERVAL','A aceleração média resume o intervalo; não prova que a aceleração instantânea foi constante.'],['CHECK_MAGNITUDE','Confira se a variação por segundo é compatível com os dados e com o intervalo.']],
    remediations: [['USE_INITIAL_FINAL','Trocar variação por velocidade final.','Monte uma linha com inicial, final e diferença; calcule final − inicial antes de qualquer divisão.'],['DIVIDE_BY_TIME','Esquecer o intervalo de tempo.','Depois de achar Δv, divida pelo número de segundos e escreva m/s².'],['INTERPRET_SIGN','Tratar sinal negativo como “sempre desacelera”.','Desenhe o eixo e compare o sentido da velocidade ao da aceleração; rapidez depende dessa relação.'],['KEEP_UNITS','Misturar km/h com m/s.','Converta todas as velocidades para a mesma unidade antes de calcular.'],['MEAN_VS_INSTANT','Afirmar aceleração constante a partir de uma média.','Limite a conclusão ao intervalo e aos dados fornecidos.'],['RECHECK_SUBTRACTION','Inverter a ordem da diferença.','Siga a convenção final menos inicial e mantenha o sinal até interpretar o resultado.']],
  },
  PHYSICS_RELATIVE_SPEED: {
    domain: 'MOVIMENTO', topic: 'comparar_velocidade_relativa', title: 'Comparar movimentos a partir de um referencial',
    objective: 'Determinar a rapidez relativa a partir de um referencial explícito e dos sentidos dos movimentos.',
    explanation: '## Comece pelo referencial\nVelocidade descreve posição mudando em relação a um referencial. Para comparar dois móveis, declare quem observa e represente os sentidos com setas.\n\n## Mesmo sentido e sentidos opostos\nSe dois móveis seguem no mesmo sentido, o módulo da velocidade relativa é a diferença entre os módulos. A 18 km/h e 12 km/h no mesmo sentido, um vê o outro afastar-se a 6 km/h. Em sentidos opostos, os módulos se somam: 10 km/h e 5 km/h dão aproximação relativa de 15 km/h.\n\n## Encontro e afastamento\nSe a distância inicial e as velocidades forem constantes, tempo de encontro = distância ÷ rapidez relativa. Não some velocidades no mesmo sentido, nem subtraia quando os móveis se aproximam em sentidos opostos. Unifique as unidades antes de comparar.',
    example: 'Dois ciclistas estão separados por 30 km e se aproximam a 10 km/h e 5 km/h. A rapidez de aproximação é 15 km/h; o encontro ocorre em 30 ÷ 15 = 2 h.',
    concepts: ['referencial', 'sentido do movimento', 'velocidade relativa', 'aproximação', 'afastamento'],
    micro: [['CHOOSE_FRAME','Declare quem observa antes de comparar as velocidades.'],['SAME_DIRECTION','No mesmo sentido, a rapidez relativa é a diferença dos módulos.'],['OPPOSITE_DIRECTION','Em sentidos opostos, a rapidez de aproximação ou afastamento soma os módulos.'],['DRAW_ARROWS','Setas tornam visível se os móveis se aproximam ou se afastam.'],['MEETING_TIME','Tempo de encontro é a distância inicial dividida pela rapidez relativa.'],['MATCH_UNITS','Compare velocidades somente depois de converter para a mesma unidade.']],
    remediations: [['SET_REFERENCE','Fazer conta sem indicar quem observa.','Marque o referencial e escreva os sentidos dos dois movimentos.'],['SAME_SENSE_SUBTRACT','Somar velocidades que apontam para o mesmo sentido.','Considere a diferença dos módulos: o móvel mais rápido alcança o mais lento à taxa dessa diferença.'],['OPPOSITE_SENSE_ADD','Subtrair movimentos em sentidos opostos.','Quando a distância entre eles diminui, some os módulos para obter a rapidez relativa.'],['DISTANCE_OVER_RELATIVE','Dividir distância por apenas uma velocidade no encontro.','Calcule primeiro a rapidez relativa e depois divida a separação inicial por ela.'],['CONVERT_FIRST','Comparar km/h e m/s diretamente.','Converta uma das velocidades e mantenha a unidade até o resultado.'],['SEPARATE_DIRECTION_MAGNITUDE','Confundir módulo com sentido.','Informe a rapidez relativa como módulo e descreva separadamente o sentido do movimento relativo.']],
  },
  PHYSICS_UNIFORM_MOTION: {
    domain: 'MOVIMENTO', topic: 'identificar_movimento_uniforme', title: 'Identificar movimento uniforme em registros',
    objective: 'Reconhecer movimento uniforme comparando deslocamentos em intervalos iguais e distinguindo posição de velocidade.',
    explanation: '## O critério é a velocidade constante\nEm movimento uniforme, a velocidade permanece constante: em intervalos iguais de tempo, o deslocamento é igual. A razão Δposição/Δtempo tem o mesmo valor em cada trecho.\n\n## Posição não é velocidade\nPosição constante descreve repouso, um caso particular de movimento uniforme com velocidade zero. Uma posição que cresce ou diminui linearmente pode representar movimento uniforme; o sinal mostra o sentido no eixo escolhido.\n\n## Leia tabelas e gráficos com cuidado\nCompare cada par de medidas, não apenas o primeiro e o último valor. Em um gráfico posição-tempo, uma reta com inclinação constante indica velocidade constante; uma reta horizontal indica repouso. Intervalos de tempo iguais, por si só, não garantem movimento uniforme: as variações de posição também precisam ser iguais.',
    example: 'As posições são 0 m, 10 m, 20 m e 30 m nos tempos 0 s, 2 s, 4 s e 6 s. Cada intervalo tem Δposição = 10 m e Δtempo = 2 s; logo v = 5 m/s constante.',
    concepts: ['posição', 'deslocamento', 'velocidade constante', 'intervalos iguais', 'inclinação'],
    micro: [['COMPARE_INTERVALS','Compare deslocamentos em intervalos iguais, não só posições finais.'],['CONSTANT_RATIO','Movimento uniforme mantém Δposição/Δtempo constante.'],['REST_IS_ZERO','Posição constante é repouso: velocidade uniforme igual a zero.'],['SLOPE_POSITION_TIME','A inclinação de posição-tempo representa velocidade.'],['SIGNED_DIRECTION','Inclinação negativa indica movimento no sentido negativo do eixo escolhido.'],['EQUAL_TIME_NOT_ENOUGH','Tempos igualmente espaçados não bastam; verifique as mudanças de posição.']],
    remediations: [['SUBTRACT_EACH_STEP','Usar apenas o deslocamento total.','Calcule posição final menos inicial em cada intervalo e compare as razões.'],['REST_VS_UNIFORM','Achar que velocidade constante exige posição constante.','Separe posição de velocidade: uma reta inclinada pode ter velocidade constante; horizontal é repouso.'],['EQUAL_INTERVALS','Confundir intervalos iguais com movimento uniforme.','Compare também os deslocamentos correspondentes a cada intervalo.'],['SIGNED_SLOPE','Ignorar movimento no sentido negativo.','Mantenha o sinal do deslocamento e interprete-o em relação ao eixo.'],['RATIO_NOT_POSITION','Dividir posição final pelo tempo total sem checar trechos.','Verifique cada intervalo antes de concluir que a velocidade foi constante.'],['READ_TABLE','Ler linhas fora de ordem.','Organize pares tempo–posição e percorra-os cronologicamente.']],
  },
};

function buildPack(skillCode, questions) {
  const data = lessonData[skillCode];
  const sourceQuestions = physicsQuestions.filter((question) => question.primarySkill === skillCode);
  const counts = Object.fromEntries(purposes.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
  const stem = skillCode.replaceAll('_', '-').toLowerCase();
  const lesson = {
    title: data.title, objective: data.objective,
    summary: `${data.objective} A explicação usa dados explícitos e distingue o modelo físico de conclusões que os dados não autorizam.`,
    explanation: data.explanation, workedExample: data.example,
    commonMistake: 'Ignorar o referencial, inverter a variação, misturar unidades ou concluir mais do que os dados mostram.',
    tips: ['Anote dados e unidades antes de calcular.', 'Declare o referencial ou o eixo adotado.', 'Mostre a relação usada e confira se a conclusão responde ao enunciado.'],
    estimatedMinutes: 28, priorKnowledge: ['Ler tabelas de valores.', 'Calcular diferenças e razões simples.'], keyConcepts: data.concepts,
    progression: purposes.map((purpose) => ({
      stage: ({ PROBE: 'DIAGNOSTIC', PRACTICE: 'PRACTICE', TRANSFER: 'TRANSFER', LOCK_IN: 'CONSOLIDATION', REVIEW: 'REVIEW' })[purpose],
      focus: ({ PROBE: 'Verificar ideias iniciais e leitura das grandezas.', PRACTICE: 'Aplicar o critério com apoio gradual.', TRANSFER: 'Interpretar dados em contextos e justificar a escolha do modelo.', LOCK_IN: 'Localizar e corrigir erros de raciocínio.', REVIEW: 'Retomar conceitos com dados e representações variadas.' })[purpose],
      questionIds: questions.filter((question) => question.purpose === purpose).map((question) => question.id),
    })),
    microExplanations: data.micro.map(([trigger, text]) => ({ trigger, text })),
    remediations: data.remediations.map(([id, misconception, prompt]) => ({ id, misconception, prompt })),
    authenticActivities: [{
      id: `v5-${stem}-motion-audit`, title: `Auditoria de registros: ${data.title.toLowerCase()}`,
      objective: data.objective,
      context: 'Use tabelas sintéticas elaboradas para a atividade, com medidas fictícias e unidades explícitas.',
      materials: ['Tabela de dados sintéticos', 'Papel quadriculado ou planilha acessível', 'Calculadora opcional'],
      instructions: `Em pares, organize os dados, identifique o referencial ou eixo, calcule as grandezas solicitadas e escreva uma conclusão limitada às evidências. Em seguida, confira um cálculo de outro grupo e explique eventual divergência.`,
      evidence: 'Registro reproduzível dos dados, operações com unidades e justificativa baseada nas medidas fornecidas.',
      privacyGuard: 'Utilize apenas dados sintéticos. Não registrar trajetos, velocidade, rotina ou localização de estudantes.',
      rubric: [
        { criterion: 'Leitura dos dados', emerging: 'Troca valores, unidades ou intervalos.', developing: 'Organiza os dados com uma orientação.', proficient: 'Organiza todos os pares e unidades corretamente.' },
        { criterion: 'Modelo e cálculo', emerging: 'Escolhe operação sem relacioná-la aos dados.', developing: 'Aplica a relação correta com apoio.', proficient: 'Justifica o modelo e calcula com sinais e unidades coerentes.' },
        { criterion: 'Conclusão', emerging: 'Afirma algo não sustentado pelo registro.', developing: 'Conclui a partir de parte dos dados.', proficient: 'Explica a conclusão e seus limites usando as evidências.' },
      ],
    }],
    reviewWindowsDays: [1, 3, 7], reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    sourceDossier: [{ publisher: 'TecEscola', title: 'Conjunto de medidas e situações de movimento sintéticas', license: 'Dados, enunciados e explicações autorais; cenários hipotéticos, sem alegação de fonte oficial.' }],
    copyrightNote: 'Questões, valores, explicações e atividade são autorais e sintéticos. Revisão pedagógica pendente; alinhamento oficial não reivindicado.',
  };
  return {
    packVersion: 'tec-escola-core-v5-question-first', contentId: `v5-${stem}-sequence`,
    subject: 'PHYSICS', domain: data.domain, topic: data.topic, canonicalSkillCode: skillCode,
    contentVersion: 1, lessonVersion: 1, expectedQuestionCount: 40, expectedContextCount: 40,
    expectedPurposeCounts: counts, expectedAnswerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    officialMappingStatus: 'NOT_CLAIMED', pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', publicationStatus: 'STAGING', contentAuthoringStatus: 'AUTHORED',
    sourceQuestionFeedback: sourceQuestions.map((question) => ({
      questionId: question.id,
      hint: skillCode === 'PHYSICS_INTERPRET_ACCELERATION' ? 'Calcule primeiro a variação da velocidade (final menos inicial) e só então divida pelo tempo.' : skillCode === 'PHYSICS_RELATIVE_SPEED' ? 'Declare os sentidos e o referencial antes de decidir entre somar ou subtrair os módulos.' : 'Compare a variação da posição em cada intervalo igual de tempo, mantendo o sinal.',
      errorFocus: skillCode,
    })),
    sourceReconciliation: { sourceQuestionCount: sourceQuestions.length, feedbackAdded: sourceQuestions.length, sourceReconciliationStatus: 'EXACT', newQuestions: 40, reusedQuestionsCountedAsNew: false },
    lesson, questions,
  };
}

export function buildPhysicsMotionPacks() {
  return [
    ['PHYSICS_INTERPRET_ACCELERATION', buildAccelerationQuestions()],
    ['PHYSICS_RELATIVE_SPEED', buildRelativeQuestions()],
    ['PHYSICS_UNIFORM_MOTION', buildUniformQuestions()],
  ].map(([skillCode, questions]) => buildPack(skillCode, questions));
}

function main() {
  const migrations = ['20261015001700', '20261015001800', '20261015001900'];
  for (const [index, pack] of buildPhysicsMotionPacks().entries()) {
    const result = validateQuestionFirstPack(pack);
    if (!result.valid) throw new Error(`${pack.canonicalSkillCode}_INVALID:${result.errors.join(',')}`);
    const stem = pack.contentId.replace('v5-physics-', '');
    writeFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v5/physics-${stem}.json`), `${JSON.stringify(pack, null, 2)}\n`);
    writeFileSync(resolve(ROOT, `supabase/migrations/${migrations[index]}_bncc_${stem.replaceAll('-', '_')}_question_first_v5.sql`), buildMigration(pack));
    process.stdout.write(`${JSON.stringify({ skill: pack.canonicalSkillCode, questions: result.questionCount, contexts: result.contextCount, purposes: result.counts, answerPositions: result.answerPositionCounts, feedback: pack.sourceQuestionFeedback.length }, null, 2)}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
