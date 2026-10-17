import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const stageToPurpose = { FOUNDATION: 'PROBE', APPLICATION: 'PRACTICE', TRANSFER: 'TRANSFER', INTEGRATION: 'LOCK_IN', SPACED_REVIEW_CANDIDATE: 'REVIEW' };
const purposeAt = (index) => index < 10 ? 'PROBE' : index < 50 ? 'PRACTICE' : index < 75 ? 'TRANSFER' : index < 85 ? 'LOCK_IN' : 'REVIEW';
const processFor = {
  PROBE: ['IDENTIFY', 'DISTINGUISH', 'COMPARE', 'INTERPRET'],
  PRACTICE: ['INTERPRET', 'ANALYZE', 'COMPARE', 'APPLY'],
  TRANSFER: ['EVALUATE', 'APPLY', 'SYNTHESIZE', 'PLAN'],
  LOCK_IN: ['DISTINGUISH', 'EVALUATE', 'SYNTHESIZE'],
  REVIEW: ['INTERPRET', 'EVALUATE', 'COMPARE', 'SYNTHESIZE'],
};
const withAnswerAt = (correct, distractors, index) => { const options = [...distractors]; options.splice(index % 4, 0, correct); return options; };

const items = [
  {
    label: 'force-motion',
    context: 'Uma bola permanece parada no chão até que uma estudante a empurre.',
    question: 'O que a ação do empurrão ajuda a explicar?',
    correct: 'Uma interação pode alterar o estado de movimento da bola.',
    criterion: 'Força representa uma interação capaz de alterar o movimento ou deformar um corpo.',
    transfer: 'Aplique o critério a um carrinho que começa a se mover quando é puxado.',
    overclaim: 'dizer que todo objeto em movimento precisa receber força no mesmo sentido o tempo todo',
    evidence: 'estado inicial, interação aplicada e mudança observada no movimento',
    nextStep: 'descrever a interação e comparar o movimento antes e depois dela',
    limit: 'a mudança observada e as interações relevantes no caso',
    comparison: 'bola parada e bola depois do empurrão',
    refine: 'qual interação mudou o estado de movimento?',
    distractors: ['A bola cria movimento sem interação alguma.', 'Todo objeto parado não possui nenhuma força.', 'A massa da bola desaparece quando ela se move.'],
  },
  {
    label: 'net-force',
    context: 'Duas equipes puxam uma corda em sentidos opostos com forças de mesma intensidade.',
    question: 'Qual modelo descreve melhor a força resultante?',
    correct: 'As forças se compensam e a força resultante é nula, embora as interações existam.',
    criterion: 'A força resultante depende da soma vetorial das forças, não da simples presença de uma força isolada.',
    transfer: 'Use a ideia em um objeto submetido a empurrões opostos de intensidades diferentes.',
    overclaim: 'concluir que nenhuma força existe quando a resultante é nula',
    evidence: 'intensidade, direção e sentido de cada força que atua no corpo',
    nextStep: 'representar as forças com sentidos e comparar suas intensidades antes de somá-las',
    limit: 'o equilíbrio da resultante e não a ausência de interações',
    comparison: 'forças opostas individuais e força resultante',
    refine: 'as forças são iguais apenas em intensidade ou também têm sentidos opostos?',
    distractors: ['Uma das equipes não exerce força porque o objeto não se move.', 'A resultante é igual à soma das intensidades sem considerar sentidos.', 'A corda precisa acelerar porque duas forças sempre produzem movimento.'],
  },
  {
    label: 'free-body',
    context: 'Um livro está apoiado sobre uma mesa horizontal e permanece em repouso.',
    question: 'Quais interações devem aparecer em um diagrama do livro?',
    correct: 'O peso para baixo e a força de apoio da mesa para cima, com resultante vertical nula.',
    criterion: 'Um diagrama de corpo livre deve representar as forças que atuam no corpo escolhido, com direção e sentido.',
    transfer: 'Aplique o procedimento a uma caixa apoiada em uma rampa ou suspensa por uma corda.',
    overclaim: 'desenhar somente a força que parece mais visível e ignorar o apoio',
    evidence: 'corpo analisado, contato com a mesa e interação gravitacional',
    nextStep: 'delimitar o livro e listar separadamente cada interação que age sobre ele',
    limit: 'as forças externas no corpo escolhido, não as forças que ele exerce em outros corpos',
    comparison: 'peso, apoio e resultante no livro',
    refine: 'qual corpo recebe cada força desenhada?',
    distractors: ['Desenhar apenas o peso porque a mesa não exerce força.', 'Desenhar uma força do livro sobre a mesa dentro do diagrama do livro.', 'Desenhar uma seta horizontal porque todo contato produz movimento.'],
  },
  {
    label: 'friction',
    context: 'Uma caixa é empurrada sobre o piso e para depois que o empurrão termina.',
    question: 'Que interação ajuda a explicar a parada?',
    correct: 'O atrito entre a caixa e o piso se opõe ao movimento e reduz sua velocidade.',
    criterion: 'O atrito depende do contato entre superfícies e pode atuar contra o deslizamento relativo.',
    transfer: 'Aplique o critério a uma bicicleta que freia ou a um tênis que evita escorregar.',
    overclaim: 'afirmar que o atrito sempre acelera o corpo na direção do movimento',
    evidence: 'superfícies em contato, sentido do deslizamento e alteração da velocidade',
    nextStep: 'identificar o sentido relativo do movimento e desenhar o atrito em sentido contrário',
    limit: 'o modelo de contato e as condições específicas das superfícies',
    comparison: 'empurrão aplicado e atrito durante a desaceleração',
    refine: 'qual movimento relativo o atrito está contrariando?',
    distractors: ['O piso puxa a caixa para frente sem contato.', 'O atrito aparece apenas quando a caixa está parada.', 'A caixa para porque sua massa se transforma em calor.'],
  },
  {
    label: 'newton-two',
    context: 'Dois carrinhos recebem a mesma força resultante, mas um deles tem o dobro da massa do outro.',
    question: 'Como comparar as acelerações?',
    correct: 'O carrinho de maior massa terá menor aceleração, pois a aceleração depende da razão entre força resultante e massa.',
    criterion: 'Na relação F = m·a, mantendo a força resultante, aumentar a massa reduz a aceleração.',
    transfer: 'Aplique a relação ao comparar veículos que recebem forças resultantes diferentes.',
    overclaim: 'dizer que o carrinho mais pesado sempre acelera mais por ter mais massa',
    evidence: 'força resultante, massa de cada carrinho e relação quantitativa entre elas',
    nextStep: 'escrever a relação entre força, massa e aceleração antes de comparar os valores',
    limit: 'a comparação sob as condições de força resultante indicadas',
    comparison: 'massa dobrada e aceleração correspondente',
    refine: 'qual grandeza foi mantida constante na comparação?',
    distractors: ['Os dois têm a mesma aceleração porque recebem a mesma força.', 'O carrinho mais pesado acelera o dobro.', 'A aceleração depende apenas do tamanho do carrinho.'],
  },
  {
    label: 'action-reaction',
    context: 'Ao caminhar, uma pessoa empurra o chão para trás e o chão exerce uma força sobre seus pés.',
    question: 'Como interpretar esse par de forças?',
    correct: 'São forças de ação e reação em corpos diferentes, com mesma intensidade e sentidos opostos.',
    criterion: 'O par de terceira lei atua em corpos diferentes; por isso, essas forças não se anulam no mesmo diagrama.',
    transfer: 'Aplique o critério a um foguete, a um remo ou a um salto.',
    overclaim: 'cancelar ação e reação no mesmo corpo por terem sentidos opostos',
    evidence: 'corpo que recebe cada força, direção, sentido e intensidade da interação',
    nextStep: 'identificar os dois corpos envolvidos e separar as forças em seus respectivos diagramas',
    limit: 'a distinção entre forças que atuam em corpos diferentes',
    comparison: 'força do pé no chão e força do chão no pé',
    refine: 'as duas forças atuam no mesmo corpo ou em corpos diferentes?',
    distractors: ['As forças se anulam porque agem juntas sobre o pé.', 'A força do chão é maior porque o chão é mais pesado.', 'A pessoa caminha sem exercer interação no chão.'],
  },
  {
    label: 'weight-mass',
    context: 'Uma astronauta leva o mesmo objeto para a Lua, onde a gravidade é menor que na Terra.',
    question: 'Que comparação está correta?',
    correct: 'A massa do objeto permanece a mesma, enquanto seu peso diminui por depender da gravidade local.',
    criterion: 'Massa mede a quantidade de matéria e peso é a força gravitacional que atua sobre o corpo.',
    transfer: 'Aplique a distinção a uma balança e a um dinamômetro usados em locais com gravidades diferentes.',
    overclaim: 'usar massa e peso como sinônimos em qualquer situação',
    evidence: 'quantidade de matéria, aceleração gravitacional e instrumento de medida usado',
    nextStep: 'separar a propriedade do corpo da força gravitacional do ambiente',
    limit: 'o significado físico de cada grandeza e o local da comparação',
    comparison: 'massa constante e peso dependente da gravidade',
    refine: 'a grandeza muda por causa do objeto ou por causa do campo gravitacional?',
    distractors: ['A massa diminui porque o objeto fica mais leve.', 'O peso permanece igual em qualquer planeta.', 'Massa só existe quando há gravidade.'],
  },
  {
    label: 'safety',
    context: 'Uma escola precisa escolher entre dois suportes para uma estrutura. Ambos suportam a carga prevista, mas um tem maior margem de segurança contra impactos.',
    question: 'Que informação é relevante para a decisão?',
    correct: 'Comparar carga, resistência, condições de impacto e margem de segurança, não apenas a carga média prevista.',
    criterion: 'Um modelo físico aplicado à segurança deve considerar forças esperadas, variações e consequências de uma falha.',
    transfer: 'Aplique a análise a capacetes, corrimãos ou prateleiras submetidos a usos diferentes.',
    overclaim: 'considerar seguro qualquer material que suporte apenas a carga ideal calculada',
    evidence: 'cargas máximas, impactos, propriedades do material e margem de segurança',
    nextStep: 'estimar cenários de uso e verificar a resistência além da situação média',
    limit: 'as condições de teste e as situações reais que ainda não foram medidas',
    comparison: 'carga prevista, carga variável e margem de segurança',
    refine: 'o suporte foi avaliado apenas em repouso ou também em situações de impacto?',
    distractors: ['Escolher o suporte mais leve sem verificar sua resistência.', 'Aprovar o suporte porque a carga média nunca produz força.', 'Ignorar impactos porque eles não fazem parte do cálculo ideal.'],
  },
  {
    label: 'model-limit',
    context: 'Um gráfico de movimento foi construído supondo que não há resistência do ar, mas o objeto observado é uma folha de papel.',
    question: 'Como usar o modelo com responsabilidade?',
    correct: 'Reconhecer que a aproximação pode ser útil, mas verificar se a resistência do ar altera significativamente o movimento da folha.',
    criterion: 'Todo modelo físico simplifica aspectos do fenômeno e precisa ter suas condições de validade explicitadas.',
    transfer: 'Aplique o cuidado a modelos sem atrito, sem perdas de energia ou com movimento uniforme ideal.',
    overclaim: 'tratar uma aproximação útil como descrição exata de qualquer situação',
    evidence: 'hipóteses do modelo, propriedades do objeto e diferença entre previsão e observação',
    nextStep: 'comparar previsão e dados e decidir se a hipótese simplificadora precisa ser revisada',
    limit: 'a ausência de resistência do ar e o formato específico da folha',
    comparison: 'modelo ideal e movimento real observado',
    refine: 'qual hipótese pode deixar de ser desprezível nesse objeto?',
    distractors: ['Descartar todo modelo porque nenhuma simplificação é permitida.', 'Aceitar o gráfico como exato sem comparar com dados.', 'Concluir que a folha não sofre força gravitacional.'],
  },
  {
    label: 'transfer',
    context: 'Um ciclista aumenta a velocidade em uma subida enquanto a força de resistência também cresce.',
    question: 'Que análise combina forças e movimento?',
    correct: 'É preciso comparar a força resultante ao longo do trajeto, pois a velocidade pode aumentar enquanto a aceleração diminui.',
    criterion: 'Velocidade e aceleração são grandezas diferentes; a aceleração depende da força resultante instantânea.',
    transfer: 'Transfira a análise para um elevador que inicia, mantém e reduz sua velocidade.',
    overclaim: 'concluir que velocidade alta significa necessariamente força resultante alta',
    evidence: 'variação da velocidade, forças propulsora e resistivas em cada trecho',
    nextStep: 'analisar intervalos do movimento e comparar força resultante com a mudança da velocidade',
    limit: 'o instante ou intervalo analisado e as forças que variam durante o trajeto',
    comparison: 'velocidade instantânea e aceleração produzida pela resultante',
    refine: 'a velocidade está mudando ou apenas tem um valor alto naquele instante?',
    distractors: ['A velocidade e a aceleração são a mesma grandeza.', 'Se há movimento, a resultante precisa apontar sempre para frente.', 'Resistência não pode alterar a aceleração porque não produz força.'],
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
    ['Que pergunta ajuda a refinar o modelo?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v20-physics-model-force-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V20_PHYSICS_MODEL_FORCE_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `Um modelo de forças precisa relacionar interações, resultante e mudança do movimento. ${item.criterion}`,
    hint: 'Identifique o corpo, represente as interações e diferencie velocidade de aceleração antes de concluir.',
    errorFocus: 'PHYSICS_MODEL_FORCE_INTERACTIONS_RESULTANT_AND_MOTION',
    misconceptions: { [item.distractors[0]]: ['PHYSICS_MODEL_FORCE_INTERACTIONS_RESULTANT_AND_MOTION'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/physics-force-motion.json');
  const previous = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const newQuestions = items.flatMap((item, caseIndex) => Array.from({ length: 10 }, (_, variant) => makeQuestion({ item, caseIndex, variant })));
  const questions = [...previous.questions, ...newQuestions];
  const expectedPurposeCounts = Object.fromEntries(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
  const expectedAnswerPositionCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map((label, position) => [label, questions.filter((question) => question.options.indexOf(question.correctAnswer) === position).length]));
  const newIdsByPurpose = new Map(PURPOSES.map((purpose) => [purpose, newQuestions.filter((question) => question.purpose === purpose).map((question) => question.id)]));
  const progression = (previous.lesson.progression ?? []).map((stage) => ({ ...stage, questionIds: [...(stage.questionIds ?? []), ...(newIdsByPurpose.get(stageToPurpose[stage.stage]) ?? [])] }));
  const pack = {
    ...previous,
    contentId: 'v20-physics-model-force',
    contentVersion: 20,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 20),
    expectedQuestionCount: questions.length,
    expectedContextCount: questions.length,
    expectedPurposeCounts,
    expectedAnswerPositionCounts,
    publicationStatus: 'STAGING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    officialMappingStatus: 'NOT_CLAIMED',
    lesson: { ...previous.lesson, progression, copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V20 autoral com 100 questões; publicação mantida em STAGING e revisão pedagógica pendente.`.trim() },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V20' },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`PHYSICS_MODEL_FORCE_V20_INVALID:${validation.errors.join(',')}`);
  writeFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v20-physics-model-force-expansion-v20.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(resolve(ROOT, 'supabase/migrations/20261016001900_bncc_physics_model_force_library_expansion_v20.sql'), buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, newQuestions: 100, totalQuestions: questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
