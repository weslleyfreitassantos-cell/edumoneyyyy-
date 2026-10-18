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
  { label: 'particles', context: 'Uma espécie de enxofre tem número atômico 16, número de massa 32 e carga 2−.', question: 'Qual conjunto representa prótons, nêutrons e elétrons?', correct: '16 prótons, 16 nêutrons e 18 elétrons.', criterion: 'Use Z para prótons, A−Z para nêutrons e o sinal da carga para contar elétrons.', transfer: 'Calcule partículas em outra espécie usando número atômico, massa e carga.', overclaim: 'usar o número de massa como se fosse o número de prótons', evidence: 'número atômico, número de massa e carga da espécie', nextStep: 'separar os cálculos de prótons, nêutrons e elétrons antes de comparar', limit: 'os dados nucleares e a carga informados', comparison: 'quantidade de prótons e elétrons para interpretar a carga', refine: 'a diferença entre prótons e elétrons corresponde ao sinal da carga?', distractors: ['32 prótons, 16 nêutrons e 14 elétrons.', '16 prótons, 32 nêutrons e 14 elétrons.', '14 prótons, 16 nêutrons e 18 elétrons.'] },
  { label: 'isotopes', context: 'Duas espécies de carbono possuem seis prótons, mas uma tem seis nêutrons e a outra tem oito.', question: 'Como classificá-las?', correct: 'São isótopos do mesmo elemento, pois têm o mesmo número atômico e diferentes números de massa.', criterion: 'Identifique o elemento pelo número de prótons e o isótopo pela quantidade de nêutrons.', transfer: 'Classifique outro par de núcleos comparando prótons e nêutrons.', overclaim: 'chamar núcleos com o mesmo número de massa de isótopos sem comparar prótons', evidence: 'número de prótons e número de nêutrons de cada núcleo', nextStep: 'calcular o número de massa de cada isótopo sem alterar o elemento', limit: 'a identidade atômica determinada pelo número de prótons', comparison: 'prótons iguais e nêutrons diferentes', refine: 'o que permaneceu igual e o que mudou entre os núcleos?', distractors: ['São elementos diferentes porque seus números de massa mudam.', 'São íons porque o número de nêutrons é diferente.', 'São a mesma espécie exatamente, pois nêutrons não alteram A.'] },
  { label: 'ions', context: 'Um átomo neutro de magnésio tem 12 prótons e perde dois elétrons ao formar um íon.', question: 'Qual é a relação entre as partículas do íon?', correct: 'O íon possui 12 prótons e 10 elétrons, portanto sua carga é 2+.', criterion: 'Relacione perda de elétrons com carga positiva sem mudar o número de prótons.', transfer: 'Interprete a formação de outro cátion ou ânion a partir da contagem de elétrons.', overclaim: 'dizer que formar um íon altera o número de prótons do elemento', evidence: 'prótons mantidos e elétrons perdidos ou ganhos', nextStep: 'calcular carga como prótons menos elétrons', limit: 'a alteração eletrônica descrita, não a identidade nuclear', comparison: 'átomo neutro e íon após a transferência de elétrons', refine: 'a espécie ganhou ou perdeu elétrons em relação ao átomo neutro?', distractors: ['O íon possui 14 prótons, pois perdeu dois elétrons.', 'O íon possui 12 elétrons e carga 2+.', 'O íon deixa de ser magnésio ao perder elétrons.'] },
  { label: 'scattering', context: 'Em um experimento, a maioria das partículas atravessa uma lâmina metálica, algumas desviam e poucas retornam.', question: 'Que modelo é favorecido por esse padrão?', correct: 'Um átomo com grande região vazia e uma região central pequena, densa e positiva.', criterion: 'Relacione a frequência dos desvios ao espaço vazio e à concentração de carga.', transfer: 'Interprete outro resultado de espalhamento procurando evidências sobre a estrutura interna.', overclaim: 'afirmar que a carga positiva está distribuída uniformemente no átomo', evidence: 'maioria sem desvio e pequena fração com desvios intensos', nextStep: 'comparar o padrão observado às previsões dos modelos concorrentes', limit: 'o que o espalhamento permite inferir sobre distribuição de matéria e carga', comparison: 'previsão de esfera uniforme e previsão de núcleo concentrado', refine: 'qual observação seria improvável se a carga estivesse espalhada por todo o átomo?', distractors: ['O átomo é totalmente maciço porque poucas partículas retornaram.', 'A maioria atravessar prova que não existe carga positiva.', 'Todos os desvios têm a mesma origem e intensidade.'] },
  { label: 'spectra', context: 'Um gás excitado emite linhas luminosas em comprimentos de onda específicos, diferentes das linhas de outro elemento.', question: 'O que as linhas permitem investigar?', correct: 'As linhas funcionam como uma assinatura associada aos níveis de energia e à identidade do elemento.', criterion: 'Interprete linhas discretas como transições entre níveis, não como um contínuo qualquer.', transfer: 'Compare espectros de duas amostras para inferir composição e limites da identificação.', overclaim: 'concluir que qualquer cor observada identifica um elemento sem comparar linhas', evidence: 'posições das linhas e comparação com espectros de referência', nextStep: 'confrontar as linhas medidas com um banco de espectros conhecidos', limit: 'a identificação permitida pela qualidade e pelo padrão das linhas', comparison: 'espectro observado e espectro de referência do elemento', refine: 'as linhas coincidem dentro da resolução do instrumento?', distractors: ['Todas as cores de um gás são iguais independentemente do elemento.', 'Uma linha isolada sempre determina toda a composição da amostra.', 'O espectro contínuo não tem relação com energia.'] },
  { label: 'models', context: 'Um modelo representa elétrons em níveis de energia, mas não descreve o comportamento probabilístico observado em átomos complexos.', question: 'Como usar esse modelo de forma responsável?', correct: 'Usá-lo para explicar padrões compatíveis com seus pressupostos e reconhecer que ele tem limites para sistemas mais complexos.', criterion: 'Relacione explicação, evidência e domínio de validade de um modelo científico.', transfer: 'Avalie outro modelo indicando o fenômeno que ele explica e o que deixa de representar.', overclaim: 'tratar um modelo didático como cópia completa e literal do átomo', evidence: 'previsões do modelo e resultados observados em diferentes sistemas', nextStep: 'comparar previsões e limites com modelos mais abrangentes', limit: 'o domínio de validade explicitado para o modelo', comparison: 'fenômenos explicados e fenômenos que exigem outro modelo', refine: 'qual evidência o modelo explica e qual evidencia sua limitação?', distractors: ['Um modelo só é válido se não possuir nenhuma limitação.', 'Se um modelo explica um caso, ele explica todos os átomos.', 'Limitações tornam qualquer modelo inútil para aprender.'] },
  { label: 'atomic-number', context: 'Uma tabela organiza elementos pelo número de prótons. Um registro informa Z=17 e outro informa Z=18.', question: 'O que diferencia os dois registros?', correct: 'Eles representam elementos diferentes, porque o número atômico define a identidade do elemento.', criterion: 'Use o número atômico como critério de identidade antes de olhar massa ou carga.', transfer: 'Identifique elementos em outra tabela usando somente o número atômico.', overclaim: 'identificar um elemento pelo número de nêutrons ou elétrons em vez de prótons', evidence: 'valores de Z e a definição de número atômico', nextStep: 'consultar o símbolo correspondente a cada valor de Z', limit: 'a identidade elementar definida por prótons', comparison: 'Z=17 e Z=18 como números atômicos distintos', refine: 'o que precisaria permanecer igual para serem isótopos?', distractors: ['São o mesmo elemento porque ambos têm núcleos.', 'O elemento é definido pelo número de elétrons apenas.', 'Z representa o número de nêutrons de qualquer átomo.'] },
  { label: 'valence', context: 'Duas espécies neutras têm a mesma quantidade de elétrons na camada mais externa, embora pertençam a períodos diferentes.', question: 'Que cuidado é necessário ao comparar suas propriedades?', correct: 'A semelhança na camada externa pode sugerir comportamento relacionado, mas é preciso considerar estrutura completa e contexto químico.', criterion: 'Use padrões de elétrons de valência como pista, sem ignorar outras características.', transfer: 'Compare elementos de uma família avaliando semelhanças e diferenças de reatividade.', overclaim: 'afirmar propriedades idênticas só porque a camada externa tem a mesma ocupação', evidence: 'elétrons de valência, período e propriedades observadas', nextStep: 'comparar a configuração eletrônica completa e dados de reatividade', limit: 'a analogia baseada apenas em uma parte da configuração', comparison: 'camada externa e restante da estrutura eletrônica', refine: 'a semelhança observada é suficiente para prever o comportamento?', distractors: ['Uma camada externa igual torna todos os elementos idênticos.', 'O período não interfere em nenhuma propriedade.', 'Elétrons de valência não participam de ligações.'] },
  { label: 'abundance', context: 'Uma amostra contém 75% de um isótopo de massa 35 e 25% de outro de massa 37.', question: 'Qual massa atômica média aproxima a composição?', correct: '35,5 u, calculada por uma média ponderada das abundâncias.', criterion: 'Multiplique cada massa isotópica pela fração correspondente e some os resultados.', transfer: 'Calcule a massa média de outra amostra com abundâncias desiguais.', overclaim: 'tratar a massa média como número de massa de cada núcleo', evidence: 'massas isotópicas e respectivas abundâncias', nextStep: 'converter percentuais em frações e realizar a média ponderada', limit: 'a composição média daquela amostra', comparison: 'massa de cada isótopo e peso de sua abundância', refine: 'a média fica mais próxima do isótopo mais abundante?', distractors: ['36 u, pois basta fazer a média simples entre 35 e 37.', '37 u, porque o isótopo mais pesado sempre domina.', '35 u, porque o isótopo mais leve define o elemento.'] },
  { label: 'evidence', context: 'Um novo modelo atômico prevê uma linha espectral que o modelo anterior não previa. O experimento reproduz a linha em medições independentes.', question: 'Que uso da evidência é mais adequado?', correct: 'A linha reproduzida apoia o novo modelo nesse aspecto, mas outras previsões ainda devem ser testadas antes de aceitar toda a explicação.', criterion: 'Avalie modelos por previsões testáveis e diferencie apoio localizado de confirmação total.', transfer: 'Analise uma nova evidência comparando previsões de dois modelos.', overclaim: 'declarar um modelo completamente provado por uma única previsão confirmada', evidence: 'previsão distinta, repetição independente e alcance da evidência', nextStep: 'testar outras previsões e condições em que os modelos divergem', limit: 'o fenômeno específico reproduzido nas medições', comparison: 'previsões dos modelos e resultados experimentais repetidos', refine: 'a evidência testa apenas uma previsão ou todo o modelo?', distractors: ['Uma linha confirmada prova todos os detalhes do modelo.', 'Repetir a medição torna desnecessário testar outras previsões.', 'Modelos não precisam gerar previsões observáveis.'] },
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
    id: `v15-chemistry-atomic-structure-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V15_CHEMISTRY_ATOMIC_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A resposta conecta o modelo atômico à evidência observada e explicita o limite da inferência. ${item.criterion}`,
    hint: 'Identifique a partícula ou previsão relevante e compare o dado com a explicação proposta.',
    errorFocus: 'CHEMISTRY_ATOMIC_STRUCTURE_EVIDENCE_SCOPE',
    misconceptions: { [item.distractors[0]]: ['CHEMISTRY_ATOMIC_STRUCTURE_EVIDENCE_SCOPE'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/chemistry-atomic-structure.json');
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
    contentId: 'v15-chemistry-atomic-structure',
    contentVersion: 15,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 15),
    expectedQuestionCount: questions.length,
    expectedContextCount: questions.length,
    expectedPurposeCounts,
    expectedAnswerPositionCounts,
    publicationStatus: 'STAGING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    officialMappingStatus: 'NOT_CLAIMED',
    lesson: { ...previous.lesson, progression, copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V15 autoral com 100 questões e revisão pedagógica pendente; publicação mantida em STAGING.`.trim() },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V15' },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`CHEMISTRY_ATOMIC_INVALID:${validation.errors.join(',')}`);
  writeFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v15-chemistry-atomic-structure-expansion-v15.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(resolve(ROOT, 'supabase/migrations/20261016001400_bncc_chemistry_atomic_structure_library_expansion_v15.sql'), buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, newQuestions: 100, totalQuestions: questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
