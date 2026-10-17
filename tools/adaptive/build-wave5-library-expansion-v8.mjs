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

const cases = {
  BIOLOGY_INHERITANCE: {
    sourceFile: 'biology-inheritance.json',
    prefix: 'biology-inheritance-expansion-v8',
    migration: '20261016000300_bncc_biology_inheritance_library_expansion_v8.sql',
    subject: 'BIOLOGY',
    domain: 'GENETICA',
    skillCode: 'BIOLOGY_EXPLAIN_INHERITANCE',
    items: [
      { label: 'allele', context: 'Em uma planta, a cor da semente depende de versões diferentes de um gene.', question: 'Qual é a função de um alelo nesse modelo?', correct: 'É uma versão possível de um gene que pode contribuir para uma característica.', criterion: 'Diferencie gene, alelo e característica observada.', transfer: 'Use a distinção entre gene e alelo ao interpretar outro heredograma.', overclaim: 'dizer que um alelo determina sozinho todo o organismo', evidence: 'as versões do gene, o genótipo e a característica observada', nextStep: 'identificar quais versões estão sendo comparadas antes de prever o fenótipo', limit: 'o modelo genético e a característica descrita', comparison: 'as versões do gene e o traço correspondente', refine: 'qual informação falta para ligar o genótipo ao fenótipo?', distractors: ['É uma célula que produz todos os tecidos.', 'É o ambiente que substitui o gene.', 'É uma característica já pronta e sem variação.'] },
      { label: 'genotype', context: 'Um indivíduo possui duas cópias de um gene, uma herdada de cada progenitor.', question: 'O que o genótipo registra?', correct: 'A combinação de alelos presente para o gene analisado.', criterion: 'Leia a combinação de alelos sem confundi-la com a aparência.', transfer: 'Descreva o genótipo antes de inferir o fenótipo em outro caso.', overclaim: 'tratar genótipo e fenótipo como sinônimos', evidence: 'alelos herdados, relação de dominância e característica observada', nextStep: 'anotar as duas cópias e depois verificar o modelo de expressão', limit: 'o gene e as regras do modelo fornecido', comparison: 'combinação de alelos e característica expressa', refine: 'a aparência está determinada ou ainda depende de outra condição?', distractors: ['Somente a aparência externa do indivíduo.', 'A quantidade de células do organismo.', 'A idade em que a característica surgiu.'] },
      { label: 'dominance', context: 'No modelo de uma flor, o alelo R mascara a expressão de r quando ambos estão presentes.', question: 'Como interpretar o heterozigoto Rr?', correct: 'Ele tem dois alelos diferentes e expressa a característica prevista pela dominância de R.', criterion: 'Use a regra de dominância fornecida, sem atribuir maior valor biológico ao alelo.', transfer: 'Aplique a mesma leitura a outro par de alelos explicitamente definido.', overclaim: 'dizer que o alelo dominante é sempre mais forte ou mais comum', evidence: 'genótipo Rr e regra de expressão do modelo', nextStep: 'separar a descrição do genótipo da conclusão fenotípica', limit: 'o sistema de dominância indicado no enunciado', comparison: 'alelos diferentes e expressão do heterozigoto', refine: 'qual regra foi dada e qual regra não foi informada?', distractors: ['Rr contém apenas o alelo R.', 'O alelo r elimina o alelo R.', 'Dominante significa necessariamente mais frequente.'] },
      { label: 'punnett', context: 'Um cruzamento Aa x Aa é representado por um quadro de Punnett com quatro combinações equiprováveis no modelo.', question: 'Para que serve o quadro?', correct: 'Para organizar combinações de alelos e estimar probabilidades no cruzamento descrito.', criterion: 'Relacione cada célula do quadro a uma combinação possível de gametas.', transfer: 'Monte outro quadro somente depois de identificar os alelos dos progenitores.', overclaim: 'confundir probabilidade do modelo com garantia para cada descendente', evidence: 'genótipos parentais, gametas e combinações do quadro', nextStep: 'listar gametas e contar as combinações antes de calcular a proporção', limit: 'as hipóteses de equiprobabilidade do cruzamento', comparison: 'combinações possíveis e probabilidade prevista', refine: 'o que é uma proporção esperada e o que seria observado?', distractors: ['Para provar exatamente a aparência de cada descendente.', 'Para substituir os genótipos parentais.', 'Para eliminar a influência das regras do modelo.'] },
      { label: 'probability', context: 'Em um cruzamento, o modelo prevê 25% de descendentes aa.', question: 'O que essa porcentagem significa?', correct: 'Que, em muitas repetições sob as mesmas condições, a proporção esperada de aa é aproximadamente 25%.', criterion: 'Diferencie expectativa estatística de certeza individual.', transfer: 'Interprete outra proporção sem transformar o percentual em promessa para um nascimento.', overclaim: 'afirmar que exatamente um em cada quatro descendentes terá aa', evidence: 'probabilidade do modelo, número de descendentes e condições do cruzamento', nextStep: 'explicar se a amostra é pequena ou grande antes de comparar com a previsão', limit: 'o modelo e a quantidade de descendentes observados', comparison: 'proporção esperada e frequência observada', refine: 'a diferença observada é compatível com o tamanho da amostra?', distractors: ['Que o primeiro descendente será aa.', 'Que 25% é uma característica fixa de cada indivíduo.', 'Que a previsão vale sem conhecer os progenitores.'] },
      { label: 'pedigree', context: 'Em um heredograma, quadrados representam pessoas de um sexo e círculos representam pessoas de outro; símbolos preenchidos indicam o traço analisado.', question: 'Qual leitura é inicial e adequada?', correct: 'Identificar a legenda e acompanhar relações familiares antes de inferir o padrão de herança.', criterion: 'Leia a legenda, gerações e relações sem pular para uma conclusão.', transfer: 'Use o mesmo procedimento em outro heredograma com legenda explícita.', overclaim: 'identificar o padrão sem observar a legenda e os vínculos', evidence: 'símbolos, legenda, gerações e parentesco', nextStep: 'marcar indivíduos afetados e não afetados por geração', limit: 'o heredograma e a legenda apresentados', comparison: 'distribuição do traço entre gerações e relações familiares', refine: 'qual padrão aparece e qual hipótese ainda precisa ser testada?', distractors: ['Ignorar a legenda porque todos os símbolos têm o mesmo sentido.', 'Ler cada símbolo sem considerar as gerações.', 'Concluir o gene apenas pela quantidade de pessoas.'] },
      { label: 'environment', context: 'Duas plantas com o mesmo genótipo recebem quantidades diferentes de luz e crescem com alturas distintas.', question: 'Qual conclusão é mais cuidadosa?', correct: 'A altura observada resulta do genótipo considerado e das condições ambientais que diferiram.', criterion: 'Considere interação entre informação genética e ambiente.', transfer: 'Analise outra característica sem atribuir toda diferença ao gene.', overclaim: 'atribuir a diferença apenas ao genótipo quando a luz variou', evidence: 'genótipo, luz, altura e condições de cultivo', nextStep: 'controlar luz, água e solo antes de comparar o efeito do genótipo', limit: 'as condições experimentais realmente registradas', comparison: 'genótipo igual e ambiente diferente', refine: 'qual variável ambiental pode explicar parte da diferença?', distractors: ['O ambiente nunca afeta características.', 'O mesmo genótipo garante a mesma altura em qualquer condição.', 'A altura observada revela todo o genoma.'] },
      { label: 'mutation', context: 'Uma alteração na sequência de DNA é encontrada em algumas células, mas não há dados sobre sua função.', question: 'Qual afirmação evita extrapolação?', correct: 'A alteração deve ser descrita e investigada; sua consequência não pode ser definida apenas por sua presença.', criterion: 'Separe a identificação da variante da interpretação de seu efeito.', transfer: 'Avalie outra variante procurando evidências de expressão e função.', overclaim: 'chamar toda alteração de DNA de doença ou benefício', evidence: 'sequência, células afetadas, expressão e evidências funcionais', nextStep: 'comparar a sequência e buscar dados sobre expressão e função', limit: 'a amostra e as evidências disponíveis', comparison: 'variante encontrada e efeito funcional demonstrado', refine: 'qual experimento diferenciaria presença de consequência?', distractors: ['Toda mutação causa doença.', 'Uma alteração nunca pode ser neutra.', 'A presença da variante prova sua função.'] },
      { label: 'meiosis', context: 'Na formação de gametas, uma célula diploide origina células com metade do número de cromossomos.', question: 'Que papel esse processo cumpre?', correct: 'Reduz o número cromossômico para que a fecundação possa restaurar a condição diploide.', criterion: 'Relacione redução cromossômica e fecundação.', transfer: 'Explique outra situação usando o ciclo entre gametas e zigoto.', overclaim: 'dizer que a meiose duplica indefinidamente o número de cromossomos', evidence: 'condição diploide, gametas haploides e fecundação', nextStep: 'indicar o número cromossômico antes e depois de cada etapa', limit: 'o ciclo reprodutivo descrito', comparison: 'meiose, gameta e restauração na fecundação', refine: 'por que a redução é necessária antes da união dos gametas?', distractors: ['A meiose cria gametas com todos os cromossomos duplicados.', 'A fecundação reduz novamente o número cromossômico.', 'Gametas e células corporais têm sempre a mesma ploidia.'] },
      { label: 'evidence', context: 'Uma família observa a repetição de uma característica em três gerações e deseja identificar seu padrão de herança.', question: 'Qual dado adicional fortalece a análise?', correct: 'Um heredograma completo com parentesco, indivíduos afetados e informação sobre o traço em cada geração.', criterion: 'Peça dados que permitam comparar transmissão e distribuição do traço.', transfer: 'Solicite evidências equivalentes em outra investigação familiar.', overclaim: 'inferir o padrão com uma observação isolada', evidence: 'parentesco, gerações, sexo quando relevante e presença do traço', nextStep: 'organizar os dados familiares e testar hipóteses alternativas', limit: 'a família observada e o modelo que pode ser testado', comparison: 'padrões de transmissão e hipóteses concorrentes', refine: 'que caso da família poderia contrariar a hipótese?', distractors: ['Somente o nome da característica.', 'Uma foto sem contexto familiar.', 'A opinião de uma pessoa sem dados de parentesco.'] },
    ],
  },
  ENGLISH_INFER_FROM_TEXT: {
    sourceFile: 'english-infer-from-text-v6.json',
    prefix: 'english-infer-from-text-expansion-v8',
    migration: '20261016000400_bncc_english_inference_library_expansion_v8.sql',
    subject: 'ENGLISH',
    domain: 'READING_INFERENCE',
    skillCode: 'ENGLISH_INFER_FROM_TEXT',
    items: [
      { label: 'notice', context: 'A school notice says: "The library will close at 4 p.m. on Friday for inventory."', question: 'What can the reader infer?', correct: 'Students should return or borrow books before 4 p.m. on Friday.', criterion: 'Connect the closing time with the action students may need to take.', transfer: 'Use the same evidence-based reading in another school notice.', overclaim: 'say that the library will be closed for the whole week', evidence: 'the day, the time and the stated reason for closing', nextStep: 'check the notice for an alternative opening time', limit: 'the Friday schedule stated in the text', comparison: 'explicit schedule information and the action it suggests', refine: 'which part is explicit and which part is an inference?', distractors: ['Students can use the library after midnight.', 'The library will move to another city.', 'Inventory means students must buy new books.'] },
      { label: 'weather', context: 'Maya takes an umbrella after reading: "Dark clouds covered the sky, and the forecast mentioned scattered showers."', question: 'Why is her choice reasonable?', correct: 'The visual sign and the forecast together suggest that rain may occur.', criterion: 'Combine two clues without treating the rain as certain everywhere.', transfer: 'Infer a likely action from another forecast using its stated conditions.', overclaim: 'claim that it will rain continuously in every place', evidence: 'dark clouds and the forecast of scattered showers', nextStep: 'look for the time and area covered by the forecast', limit: 'the forecast conditions and the local observation', comparison: 'the observed sign and the forecast information', refine: 'what remains uncertain about the rain?', distractors: ['An umbrella proves that the sun disappeared forever.', 'Scattered showers mean snow in every region.', 'A forecast cannot support any inference.'] },
      { label: 'advertisement', context: 'An advertisement says: "Bring your reusable bottle and get a free refill during the event."', question: 'What is the intended action?', correct: 'Participants are encouraged to bring a reusable bottle to receive a refill.', criterion: 'Identify the invitation and the condition attached to the benefit.', transfer: 'Read another advertisement by separating offer, condition and audience.', overclaim: 'say that every product at the event is free', evidence: 'the imperative verb, the reusable bottle and the refill offer', nextStep: 'check who can receive the refill and when', limit: 'the condition described in the advertisement', comparison: 'requested action and promised benefit', refine: 'what does the text require before the benefit?', distractors: ['Participants must throw away their bottles.', 'The event will provide a new phone to everyone.', 'The refill is available only after the event ends.'] },
      { label: 'narrative', context: 'In a story, Leo kept the lights off, spoke softly and checked the sleeping baby before opening the door.', question: 'What can the reader infer about Leo?', correct: 'He was trying to avoid waking the baby.', criterion: 'Use the sequence of actions and their shared purpose.', transfer: 'Infer a character goal from coordinated actions in another narrative.', overclaim: 'say that Leo was afraid of every door', evidence: 'the lights, voice, baby and timing of the actions', nextStep: 'look for the consequence that the character is trying to avoid', limit: 'the scene and actions described', comparison: 'several actions pointing to one immediate goal', refine: 'which action would be unnecessary if the baby were awake?', distractors: ['He wanted to make the room brighter.', 'He was preparing a loud celebration.', 'He had forgotten that the baby existed.'] },
      { label: 'cause', context: 'The text reports: "The river rose after two days of heavy rain, blocking the lower road."', question: 'What is the cause of the road being blocked?', correct: 'The river rose after the heavy rain and covered or obstructed the lower road.', criterion: 'Follow the temporal and causal relation stated in the sentence.', transfer: 'Trace cause and effect in another short news sentence.', overclaim: 'say that traffic blocked the river', evidence: 'heavy rain, rising river and lower road', nextStep: 'identify which event happened first and which result followed', limit: 'the causal sequence reported by the text', comparison: 'event that preceded the result and the result itself', refine: 'is the sentence stating a cause or only two events?', distractors: ['The road caused the rain to stop.', 'The river was built after the road.', 'The text says nothing about rain.'] },
      { label: 'reference', context: 'In the sentence "The team repaired the bridge because it was unsafe," the pronoun it refers to the bridge.', question: 'Why?', correct: 'The bridge is the item that can be unsafe and is the object of the repair.', criterion: 'Use grammar and meaning together to resolve the reference.', transfer: 'Resolve another pronoun by testing each possible antecedent in context.', overclaim: 'choose a reference only because it is the nearest word', evidence: 'the pronoun, the repair action and the adjective unsafe', nextStep: 'replace the pronoun with each candidate and check meaning', limit: 'the sentence context provided', comparison: 'grammatical position and semantic compatibility', refine: 'which candidate fits both grammar and meaning?', distractors: ['It refers to the word team because teams cannot repair things.', 'It has no possible reference.', 'It refers to unsafe as if an adjective were a place.'] },
      { label: 'tone', context: 'A review states: "The film is visually striking, but its rushed ending leaves important questions unanswered."', question: 'What is the reviewer\'s attitude?', correct: 'The reviewer recognizes a strength while expressing a reservation about the ending.', criterion: 'Read the contrast marked by but and connect praise with criticism.', transfer: 'Identify balanced evaluation in another review with contrasting evidence.', overclaim: 'call the review completely positive or completely negative', evidence: 'visually striking, but, rushed ending and unanswered questions', nextStep: 'separate the positive observation from the limitation', limit: 'the two aspects evaluated in the review', comparison: 'praise and criticism joined by contrast', refine: 'which word changes the direction of the evaluation?', distractors: ['The reviewer says the film has no images.', 'The reviewer recommends ignoring the ending.', 'The review contains only praise.'] },
      { label: 'data', context: 'A short report says: "Attendance rose from 60 to 75 students after the bus route changed."', question: 'What is supported by the report?', correct: 'Attendance increased during the period associated with the route change, although the report alone does not prove causation.', criterion: 'Describe the numerical change and keep the causal claim limited.', transfer: 'Interpret another small data statement without confusing association with proof.', overclaim: 'say that the route change is the only possible cause', evidence: 'the two attendance values and the timing of the route change', nextStep: 'seek a comparison period or additional explanation', limit: 'the reported association and its missing controls', comparison: 'before and after values with the timing of the change', refine: 'what evidence would strengthen a causal explanation?', distractors: ['Attendance fell to zero.', 'The route change proves every student attended.', 'Numbers cannot be compared in a report.'] },
      { label: 'contrast', context: 'The text says: "Unlike the old device, the new model uses less energy but needs a stronger network."', question: 'What contrast is presented?', correct: 'The new model improves energy use while creating a greater network requirement.', criterion: 'Track both sides of unlike and but.', transfer: 'Summarize another comparison by naming one advantage and one trade-off.', overclaim: 'say that the new model is better in every respect', evidence: 'less energy, but and stronger network', nextStep: 'write the advantage and limitation in separate notes', limit: 'the two characteristics explicitly compared', comparison: 'energy consumption and network requirement', refine: 'which change is beneficial and which creates a demand?', distractors: ['The old device uses no energy.', 'Both models require exactly the same network.', 'The new model is described as having no trade-off.'] },
      { label: 'summary', context: 'A paragraph explains that students planned a garden, measured sunlight, selected native plants and recorded weekly growth.', question: 'Which summary preserves the main idea?', correct: 'Students used a measured plan to create a native-plant garden and monitor its growth.', criterion: 'Keep the project, method and outcome without listing every minor detail.', transfer: 'Summarize another process by retaining purpose, method and result.', overclaim: 'add a result that the paragraph never reports', evidence: 'planning, sunlight measurement, native plants and weekly records', nextStep: 'remove details that do not change the central process', limit: 'the actions and outcome stated in the paragraph', comparison: 'main project steps and supporting details', refine: 'what sequence could be omitted without changing the idea?', distractors: ['Students abandoned every garden immediately.', 'The paragraph is only about weather.', 'The students measured no condition at all.'] },
    ],
  },
};

function makeQuestion({ definition, item, caseIndex, variant }) {
  const index = caseIndex * 10 + variant;
  const purpose = purposeAt(index);
  const variants = [
    [item.question, item.correct],
    ['Which criterion should guide the reading?', `Use ${item.criterion}`],
    ['How can this reasoning transfer to another case?', item.transfer],
    ['Which conclusion should be avoided without more information?', `Avoid ${item.overclaim}.`],
    ['What evidence should be checked first?', `Check ${item.evidence}.`],
    ['What is the most careful next step?', item.nextStep],
    ['What limit should appear in the answer?', `Keep the conclusion connected to ${item.limit}.`],
    ['Which comparison is fair?', `Compare ${item.comparison}.`],
    ['What would be an interpretive overreach?', `It would be an overreach to ${item.overclaim}.`],
    ['Which question would refine the investigation?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v8-${definition.prefix}-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V8_${definition.prefix.toUpperCase()}_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A resposta usa as evidências do contexto e mantém a conclusão dentro das condições descritas. ${item.criterion}`,
    hint: `Leia o contexto, identifique a evidência e confira qual limite foi informado.`,
    errorFocus: `${definition.skillCode}_EVIDENCE_SCOPE_CONFUSION`,
    misconceptions: { [item.distractors[0]]: [`${definition.skillCode}_EVIDENCE_SCOPE_CONFUSION`] },
  };
}

function buildPack(definition) {
  const previous = JSON.parse(readFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v5/${definition.sourceFile}`), 'utf8'));
  const newQuestions = definition.items.flatMap((item, caseIndex) => Array.from({ length: 10 }, (_, variant) => makeQuestion({ definition, item, caseIndex, variant })));
  const questions = [...previous.questions, ...newQuestions];
  const expectedPurposeCounts = Object.fromEntries(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
  const expectedAnswerPositionCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map((label, position) => [label, questions.filter((question) => question.options.indexOf(question.correctAnswer) === position).length]));
  const newIdsByPurpose = new Map(PURPOSES.map((purpose) => [purpose, newQuestions.filter((question) => question.purpose === purpose).map((question) => question.id)]));
  const progression = (previous.lesson.progression ?? []).map((stage) => ({
    ...stage,
    questionIds: [...(stage.questionIds ?? []), ...(newIdsByPurpose.get(Object.entries(stageFor).find(([, value]) => value === stage.stage)?.[0]) ?? [])],
  }));
  return {
    ...previous,
    contentId: `v8-${definition.prefix}`,
    contentVersion: 8,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 8),
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
      copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V8 autoral com 100 questões, progressão de dificuldade e revisão pedagógica pendente; publicação mantida em STAGING.`.trim(),
    },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V8' },
    questions,
  };
}

export function buildWave5LibraryExpansionPacks() {
  return Object.fromEntries(Object.values(cases).map((definition) => [definition.subject, buildPack(definition)]));
}

function main() {
  const packs = buildWave5LibraryExpansionPacks();
  const report = [];
  for (const definition of Object.values(cases)) {
    const pack = packs[definition.subject];
    const validation = validateQuestionFirstPack(pack);
    if (!validation.valid) throw new Error(`${definition.subject}_INVALID:${validation.errors.join(',')}`);
    const outputName = `v8-${definition.prefix}.json`;
    writeFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v5/${outputName}`), `${JSON.stringify(pack, null, 2)}\n`);
    writeFileSync(resolve(ROOT, `supabase/migrations/${definition.migration}`), buildMigration(pack));
    report.push({ subject: definition.subject, skillCode: definition.skillCode, newQuestions: 100, totalQuestions: pack.questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus });
  }
  process.stdout.write(`${JSON.stringify({ valid: true, packs: report }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
