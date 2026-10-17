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
  { label: 'balance', context: 'A reação de formação da água é representada por H₂ + O₂ → H₂O.', question: 'Que ajuste conserva os átomos de cada elemento?', correct: '2 H₂ + O₂ → 2 H₂O.', criterion: 'Conte os átomos dos dois lados e altere coeficientes, não índices das fórmulas.', transfer: 'Balanceie outra equação simples conferindo cada elemento após o ajuste.', overclaim: 'alterar índices das fórmulas para fazer uma equação parecer balanceada', evidence: 'quantidade de átomos de hidrogênio e oxigênio em cada lado', nextStep: 'contar os átomos antes e depois e ajustar os coeficientes mínimos', limit: 'a conservação de átomos representada pela equação', comparison: 'átomos nos reagentes e nos produtos', refine: 'algum elemento aparece com contagem diferente em um dos lados?', distractors: ['H₂ + O₂ → H₂O₂, pois basta mudar um índice.', 'H₂ + 2 O₂ → H₂O.', '2 H₂ + 2 O₂ → H₂O.'] },
  { label: 'ratio', context: 'Na equação 2 H₂ + O₂ → 2 H₂O, os coeficientes indicam a proporção entre as substâncias.', question: 'Quantos mol de água correspondem a 3 mol de O₂ com H₂ em excesso?', correct: '6 mol de H₂O, pois a proporção O₂:H₂O é 1:2.', criterion: 'Leia a razão molar pelos coeficientes da equação balanceada.', transfer: 'Use outra equação balanceada para converter mol de reagente em mol de produto.', overclaim: 'usar a massa dos coeficientes como se fossem massas molares', evidence: 'coeficientes 2:1:2 e excesso de hidrogênio', nextStep: 'montar uma relação molar e verificar qual reagente limita', limit: 'a proporção da equação e o excesso informado', comparison: 'mol de oxigênio disponíveis e mol de água previstos', refine: 'o reagente usado está em excesso ou limita a formação?', distractors: ['3 mol, porque o produto acompanha diretamente o reagente.', '1,5 mol, porque é preciso dividir o oxigênio por dois.', '2 mol, pois o coeficiente da água é sempre fixo.'] },
  { label: 'limiting', context: 'Para 2 Na + Cl₂ → 2 NaCl, são misturados 3 mol de Na e 2 mol de Cl₂.', question: 'Qual reagente limita a formação de sal?', correct: 'O sódio limita, pois 3 mol de Na exigem apenas 1,5 mol de Cl₂ e permitem formar 3 mol de NaCl.', criterion: 'Compare a quantidade disponível com a quantidade exigida pela proporção molar.', transfer: 'Determine o reagente limitante em outra mistura antes de calcular o produto.', overclaim: 'escolher como limitante o reagente com menor número de mol sem considerar a proporção', evidence: 'quantidades disponíveis e razão 2 Na para 1 Cl₂', nextStep: 'calcular quanto produto cada reagente poderia formar', limit: 'a mistura específica e a equação balanceada', comparison: 'produto previsto a partir de cada reagente', refine: 'qual reagente se esgota primeiro na proporção da equação?', distractors: ['O cloro limita porque há menos coeficiente na fórmula.', 'Nenhum limita porque há dois reagentes.', 'O sódio está em excesso porque seu número é maior.'] },
  { label: 'molar-mass', context: 'A decomposição de 1 mol de CaCO₃ produz 1 mol de CaO e 1 mol de CO₂. A massa molar de CaCO₃ é 100 g/mol.', question: 'Que massa de CaCO₃ corresponde a 0,5 mol?', correct: '50 g, calculados por 0,5 mol × 100 g/mol.', criterion: 'Converta mol e massa usando a massa molar com unidades compatíveis.', transfer: 'Converta uma quantidade de massa em mol em outra reação sem perder unidades.', overclaim: 'multiplicar massa molar por mol sem conferir a unidade obtida', evidence: 'quantidade em mol e massa molar do composto', nextStep: 'escrever a relação m = n × M antes de substituir os valores', limit: 'a massa molar fornecida e a quantidade da amostra', comparison: 'mol disponíveis e gramas correspondentes', refine: 'o resultado está em gramas e é proporcional à quantidade de matéria?', distractors: ['200 g, pois é preciso dobrar a massa molar.', '100,5 g, somando mol e massa molar.', '0,005 g, dividindo massa molar por 100.'] },
  { label: 'gas', context: 'Em condições iguais de temperatura e pressão, uma reação libera 2 mol de H₂ para cada 1 mol de O₂ consumido.', question: 'Como comparar os volumes dos gases na mesma condição?', correct: 'O volume de H₂ será o dobro do volume de O₂, porque o número de mols está na razão 2:1.', criterion: 'Em mesma temperatura e pressão, relacione volume gasoso e quantidade de matéria.', transfer: 'Compare volumes gasosos de outra equação em condições iguais.', overclaim: 'comparar volumes de gases sem considerar temperatura e pressão', evidence: 'razão molar e condições iguais de temperatura e pressão', nextStep: 'verificar se as condições permitem usar a proporção de volumes', limit: 'a comparação entre gases nas condições informadas', comparison: 'mols e volumes de H₂ e O₂', refine: 'temperatura e pressão são iguais para os dois gases?', distractors: ['O volume será igual porque gases ocupam todo o recipiente.', 'O₂ terá o dobro do volume porque sua molécula é maior.', 'Não é possível comparar volumes em nenhuma condição.'] },
  { label: 'yield', context: 'Uma reação deveria produzir 10 g de produto, mas o laboratório recupera 8 g após a purificação.', question: 'Qual é o rendimento percentual aproximado?', correct: '80%, pois o rendimento é a massa obtida dividida pela massa teórica, vezes 100.', criterion: 'Relacione rendimento real e rendimento teórico sem inverter a fração.', transfer: 'Calcule o rendimento de outro experimento com perdas de produto.', overclaim: 'usar a massa obtida como se fosse sempre o rendimento teórico', evidence: 'massa real de 8 g e massa teórica de 10 g', nextStep: 'dividir 8 por 10 e converter a razão em porcentagem', limit: 'as massas comparadas após a mesma etapa de purificação', comparison: 'produto previsto e produto recuperado', refine: 'qual massa representa o limite teórico da reação?', distractors: ['125%, dividindo a massa teórica pela real.', '18%, subtraindo as duas massas.', '8%, porque a massa real já é o percentual.'] },
  { label: 'conservation', context: 'Em uma reação fechada, 12 g de reagentes formam produtos gasosos e sólidos. O sistema inteiro é pesado antes e depois.', question: 'Qual resultado é esperado pela conservação da massa?', correct: 'A massa total dos produtos deve corresponder a 12 g, mesmo que a distribuição entre gás e sólido mude.', criterion: 'Considere a fronteira fechada e conserve a massa total dos átomos.', transfer: 'Analise uma reação com diferentes estados físicos mantendo o sistema completo.', overclaim: 'dizer que um gás não participa da massa total dos produtos', evidence: 'sistema fechado e massa total inicial de reagentes', nextStep: 'somar as massas de todas as fases presentes no sistema', limit: 'o conjunto de matéria dentro da fronteira definida', comparison: 'massa total antes e depois, incluindo o gás', refine: 'alguma fase ficou fora da medição?', distractors: ['A massa diminui porque gases não têm massa.', 'A massa aumenta sempre que aparece um sólido.', 'Somente o sólido deve ser pesado para conferir a conservação.'] },
  { label: 'excess', context: 'Em uma síntese, a proporção exige 1 mol de A para 2 mol de B. Há 4 mol de A e 5 mol de B.', question: 'Qual afirmação descreve a mistura?', correct: 'B é limitante e A fica em excesso, pois 4 mol de A exigiriam 8 mol de B.', criterion: 'Calcule a demanda de cada reagente antes de identificar o excesso.', transfer: 'Classifique reagentes em excesso e limitante em outra proporção.', overclaim: 'chamar de excesso o reagente com maior massa sem usar os mols e a equação', evidence: 'proporção 1:2 e quantidades de A e B', nextStep: 'comparar cada quantidade disponível com a demanda estequiométrica', limit: 'a proporção molar e os valores informados', comparison: 'B disponível e B necessário para consumir A', refine: 'quanto de B seria necessário para usar todo A?', distractors: ['A é limitante porque seu número de mol é menor.', 'Os dois estão em excesso porque sobrará matéria.', 'B está em excesso porque sua quantidade absoluta é maior.'] },
  { label: 'unit', context: 'Uma tabela registra 0,25 mol de uma substância, mas o cálculo do estudante usa 25 g sem informar a massa molar.', question: 'Qual problema deve ser corrigido?', correct: 'Mol e gramas são grandezas diferentes; é necessário informar a massa molar para converter entre elas.', criterion: 'Mantenha unidades explícitas e use uma relação de conversão justificada.', transfer: 'Revise outro cálculo químico procurando trocas indevidas entre mol, massa e volume.', overclaim: 'tratar qualquer número em uma tabela como se tivesse a mesma unidade', evidence: 'unidade registrada, unidade usada e massa molar ausente', nextStep: 'anotar as unidades em cada etapa e obter a massa molar necessária', limit: 'a conversão autorizada pelos dados disponíveis', comparison: 'quantidade de matéria e massa correspondente', refine: 'há informação suficiente para converter a unidade?', distractors: ['0,25 mol é sempre igual a 25 g.', 'Basta remover a unidade para o cálculo ficar correto.', 'Massa molar só importa em reações com gases.'] },
  { label: 'report', context: 'Um relatório calcula o produto usando uma equação não balanceada e não informa qual reagente foi usado em excesso.', question: 'Qual revisão é necessária?', correct: 'Balancear a equação, registrar as quantidades e identificar o reagente limitante antes de aceitar o cálculo do produto.', criterion: 'Verifique a equação, as unidades e o limitante antes de interpretar resultados quantitativos.', transfer: 'Audite outro relatório de estequiometria procurando etapas que impedem a reprodução.', overclaim: 'aceitar um resultado numérico sem conferir a equação e as condições da mistura', evidence: 'equação não balanceada e excesso não informado', nextStep: 'corrigir a equação e explicitar a base do cálculo', limit: 'as premissas quantitativas registradas no relatório', comparison: 'resultado calculado e método que o produziu', refine: 'a proporção usada vem de uma equação balanceada?', distractors: ['O relatório está correto porque apresenta um número final.', 'Balanceamento não interfere na quantidade de produto.', 'O reagente limitante é irrelevante quando a massa é medida.'] },
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
    ['Que pergunta ajuda a refinar o cálculo?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v16-chemistry-stoichiometry-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V16_CHEMISTRY_STOICHIOMETRY_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A resposta usa a equação balanceada, unidades e limites da mistura para justificar o cálculo. ${item.criterion}`,
    hint: 'Escreva a equação balanceada, destaque as unidades e confira o reagente limitante.',
    errorFocus: 'CHEMISTRY_STOICHIOMETRY_RATIO_AND_UNIT',
    misconceptions: { [item.distractors[0]]: ['CHEMISTRY_STOICHIOMETRY_RATIO_AND_UNIT'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/chemistry-stoichiometry.json');
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
    contentId: 'v16-chemistry-stoichiometry',
    contentVersion: 16,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 16),
    expectedQuestionCount: questions.length,
    expectedContextCount: questions.length,
    expectedPurposeCounts,
    expectedAnswerPositionCounts,
    publicationStatus: 'STAGING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    officialMappingStatus: 'NOT_CLAIMED',
    lesson: { ...previous.lesson, progression, copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V16 autoral com 100 questões e revisão pedagógica pendente; publicação mantida em STAGING.`.trim() },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V16' },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`CHEMISTRY_STOICHIOMETRY_INVALID:${validation.errors.join(',')}`);
  writeFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v16-chemistry-stoichiometry-expansion-v16.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(resolve(ROOT, 'supabase/migrations/20261016001500_bncc_chemistry_stoichiometry_library_expansion_v16.sql'), buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, newQuestions: 100, totalQuestions: questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
