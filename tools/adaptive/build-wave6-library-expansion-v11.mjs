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
const posterVisual = {
  layout: 'TWO_COLUMN',
  items: [
    { src: '/learning/art/poster-contrast-a.svg', alt: 'Cartaz A: chamada “Feira de trocas do bairro” em letras azul-marinho, grande, sobre um bloco amarelo; as informações de data e local aparecem menores abaixo.', caption: 'Cartaz A' },
    { src: '/learning/art/poster-contrast-b.svg', alt: 'Cartaz B: a mesma chamada em letras cinza-claro diretamente sobre fundo branco; os detalhes têm tamanho e peso visual próximos aos da chamada.', caption: 'Cartaz B' },
  ],
};

const items = [
  { label: 'contrast', context: 'Os dois cartazes autorais da Feira de trocas do bairro usam o mesmo texto, mas o cartaz A coloca a chamada azul-marinho grande sobre um bloco amarelo, enquanto o B usa letras cinza-claro sobre fundo branco.', question: 'Qual diferença de composição é observável?', correct: 'A separação entre chamada e fundo é mais forte no cartaz A, criando uma hierarquia mais nítida.', criterion: 'Compare contraste, escala e relação figura-fundo nos dois cartazes.', transfer: 'Use os mesmos critérios para comparar dois cartazes de outro evento.', overclaim: 'afirmar que o amarelo tem um significado universal', evidence: 'cor, tamanho da chamada e relação com o fundo', nextStep: 'descrever o que muda no destaque sem inventar intenção', limit: 'os elementos visíveis nos cartazes', comparison: 'contraste e hierarquia de A e B', refine: 'qual característica visual sustenta a ideia de maior destaque?', visualStimulus: posterVisual, distractors: ['O cartaz B tem maior contraste porque todos os elementos têm peso semelhante.', 'Os cartazes são idênticos porque anunciam o mesmo evento.', 'O cartaz A prova que toda cor amarela comunica urgência.'] },
  { label: 'figure-ground', context: 'Em uma colagem autoral, uma forma escura se aproxima de outras formas escuras sobre um fundo também escuro, enquanto uma forma clara fica isolada em uma área clara.', question: 'Que aspecto deve ser investigado primeiro?', correct: 'As relações de figura e fundo, contraste e proximidade, antes de atribuir um significado à forma.', criterion: 'Descreva como as formas se separam ou se misturam ao fundo.', transfer: 'Analise figura e fundo em outra composição com áreas de baixo contraste.', overclaim: 'dizer que a forma isolada representa uma emoção específica', evidence: 'luminosidade, separação, proximidade e fundo', nextStep: 'mapear quais formas se destacam e por quais relações', limit: 'a organização formal apresentada', comparison: 'separação das figuras e contraste local', refine: 'o destaque vem da cor, da posição, do espaço ou da combinação?', distractors: ['A forma clara tem significado fixo em qualquer obra.', 'Figura e fundo são definidos apenas pelo título.', 'Baixo contraste sempre impede qualquer leitura.'] },
  { label: 'scale', context: 'Uma instalação apresenta uma pequena casa de papel ao lado de uma árvore muito maior, embora os dois objetos sejam reconhecíveis em escala reduzida.', question: 'O que a diferença de escala permite descrever?', correct: 'A árvore recebe maior presença visual relativa, mas o sentido dessa escolha exige contexto adicional.', criterion: 'Relacione tamanho relativo e presença sem transformar escala em intenção comprovada.', transfer: 'Compare escala relativa em outra obra sem declarar uma mensagem universal.', overclaim: 'afirmar que o elemento maior sempre é mais importante para o artista', evidence: 'tamanho relativo, posição e reconhecimento dos objetos', nextStep: 'descrever presença visual e procurar informações contextuais', limit: 'a relação de escala observada', comparison: 'tamanho relativo e destaque', refine: 'o que a obra informa, além do tamanho, sobre essa escolha?', distractors: ['O objeto maior prova a intenção biográfica do artista.', 'A escala não pode produzir diferença de destaque.', 'A casa deixa de ser reconhecível por ser menor.'] },
  { label: 'framing', context: 'Uma fotografia mostra uma praça inteira em plano aberto; outra recorta apenas uma banca de sementes e as mãos de quem troca os produtos.', question: 'Que comparação é sustentada pelo enquadramento?', correct: 'O plano aberto informa relações com o espaço, enquanto o recorte fechado concentra a atenção na troca.', criterion: 'Compare quais elementos entram no campo e quais ficam fora dele.', transfer: 'Analise outro par de imagens distinguindo contexto amplo e detalhe.', overclaim: 'tratar o recorte como registro completo da praça', evidence: 'campo visível, detalhe da banca e elementos excluídos', nextStep: 'listar o que cada enquadramento permite ou impede observar', limit: 'o que está dentro de cada quadro', comparison: 'contexto amplo e detalhe recortado', refine: 'qual informação desaparece quando o enquadramento fecha?', distractors: ['O plano fechado mostra tudo o que havia na praça.', 'O plano aberto não contém nenhuma escolha compositiva.', 'O recorte prova que a banca é o único assunto da praça.'] },
  { label: 'rhythm', context: 'Uma gravura autoral repete pequenos círculos em intervalos regulares e, perto da borda, aproxima progressivamente esses círculos.', question: 'Como descrever a relação entre repetição e variação?', correct: 'A repetição cria ritmo, e a diminuição dos intervalos altera a cadência perto da borda.', criterion: 'Observe o padrão e a mudança dos intervalos antes de atribuir técnica ou narrativa.', transfer: 'Identifique ritmo e variação em outra composição com elementos repetidos.', overclaim: 'concluir que a obra foi produzida por uma máquina', evidence: 'círculos, repetição e mudança gradual dos intervalos', nextStep: 'marcar o padrão e o trecho em que a cadência muda', limit: 'o padrão formal informado', comparison: 'intervalos regulares e intervalos reduzidos', refine: 'a repetição permanece igual ou foi modificada?', distractors: ['A repetição prova o equipamento usado.', 'A borda necessariamente inicia uma história.', 'A variação elimina qualquer ritmo.'] },
  { label: 'balance', context: 'Uma composição assimétrica coloca uma forma escura grande à esquerda e várias formas claras menores à direita, distribuídas em alturas diferentes.', question: 'Que hipótese formal pode ser testada?', correct: 'O peso visual pode ser distribuído por tamanho, contraste e posição, mesmo sem simetria espelhada.', criterion: 'Compare peso visual e equilíbrio sem tratar simetria como único modo de organizar a obra.', transfer: 'Avalie equilíbrio em outra composição assimétrica com critérios explícitos.', overclaim: 'dizer que toda composição equilibrada precisa ser simétrica', evidence: 'tamanho, contraste, posição e quantidade de formas', nextStep: 'comparar o peso visual de cada lado usando os mesmos critérios', limit: 'a distribuição dos elementos descritos', comparison: 'simetria, tamanho, contraste e posição', refine: 'quais relações compensam a diferença de tamanho?', distractors: ['Sem simetria não existe equilíbrio.', 'A forma grande sempre domina sem considerar contraste.', 'Quantidade de formas define sozinha o peso visual.'] },
  { label: 'color', context: 'Uma pintura autoral usa vermelho e azul em áreas próximas, com vermelho muito mais saturado e azul parcialmente coberto por cinza.', question: 'Qual observação é mais segura?', correct: 'A saturação e a cobertura diferem, o que pode alterar o destaque relativo das áreas.', criterion: 'Descreva propriedades visuais sem fixar uma interpretação emocional universal.', transfer: 'Compare saturação e cobertura em outra pintura.', overclaim: 'atribuir ao vermelho a mesma emoção em qualquer cultura ou situação', evidence: 'saturação, cobertura e proximidade entre áreas', nextStep: 'comparar o destaque relativo e buscar contexto antes de interpretar', limit: 'as propriedades visuais informadas', comparison: 'saturação e cobertura das áreas', refine: 'o que é observação e o que seria hipótese de sentido?', distractors: ['Vermelho sempre representa perigo para qualquer público.', 'A cor coberta deixa de participar da obra.', 'Azul e vermelho têm a mesma saturação por serem cores.'] },
  { label: 'space', context: 'Em um desenho, uma figura ocupa apenas o canto inferior e uma grande área vazia permanece ao redor; em outro, a figura quase toca as bordas.', question: 'Que relação compositiva pode ser comparada?', correct: 'O espaço negativo e a proximidade das bordas alteram o enquadramento e a sensação de abertura da composição.', criterion: 'Observe espaço vazio, margens e relação da figura com o quadro.', transfer: 'Compare espaço negativo em outro desenho ou cartaz.', overclaim: 'afirmar que área vazia significa solidão para todas as pessoas', evidence: 'área vazia, margens e proximidade das bordas', nextStep: 'descrever como o espaço muda entre os dois desenhos', limit: 'o espaço e as margens observadas', comparison: 'figura isolada e figura próxima às bordas', refine: 'o que muda quando a figura se aproxima do limite?', distractors: ['O espaço vazio não participa da composição.', 'A figura isolada prova uma emoção universal.', 'Tocar a borda sempre significa que o desenho está incompleto.'] },
  { label: 'focal', context: 'Um cartaz fictício reúne título, ilustração, data e três chamadas secundárias. O título tem maior tamanho, contraste e espaço livre ao redor.', question: 'Que leitura é sustentada pelos dados?', correct: 'O título tende a funcionar como ponto focal porque combina escala, contraste e espaço de destaque.', criterion: 'Relacione ponto focal a múltiplas evidências, não a uma preferência pessoal.', transfer: 'Identifique ponto focal em outro cartaz usando pelo menos dois critérios.', overclaim: 'garantir que todas as pessoas olharão primeiro para o título', evidence: 'escala, contraste e espaço livre do título', nextStep: 'comparar o título com os elementos secundários', limit: 'a hierarquia visual indicada', comparison: 'título, ilustração e chamadas secundárias', refine: 'qual relação além do tamanho sustenta o destaque?', distractors: ['O ponto focal é definido apenas pelo assunto escrito.', 'Todas as pessoas necessariamente olham na mesma ordem.', 'Espaço livre reduz sempre a importância de um elemento.'] },
  { label: 'context', context: 'Uma obra é exposta primeiro em uma sala branca com luz frontal e depois em um corredor estreito com luz lateral; nenhuma alteração na obra é registrada.', question: 'O que pode ser comparado com segurança?', correct: 'As condições de apresentação mudaram e podem alterar a percepção de luz, escala e circulação, sem provar mudança na obra.', criterion: 'Separe características da obra das condições de exposição.', transfer: 'Analise outra mudança de espaço sem atribuir ao objeto uma alteração não documentada.', overclaim: 'afirmar que a obra mudou de significado só porque mudou de sala', evidence: 'sala, luz, circulação e ausência de alteração registrada', nextStep: 'registrar o que mudou no entorno e o que permaneceu', limit: 'as condições de exposição informadas', comparison: 'obra, luz, espaço e percurso do público', refine: 'qual mudança é do contexto e qual seria da obra?', distractors: ['A obra foi alterada porque a sala mudou.', 'O contexto nunca interfere na experiência visual.', 'A luz lateral prova a intenção original do artista.'] },
];

function makeQuestion({ item, caseIndex, variant }) {
  const index = caseIndex * 10 + variant;
  const purpose = purposeAt(index);
  const variants = [
    [item.question, item.correct],
    ['Qual critério deve orientar a análise?', `Use ${item.criterion}`],
    ['Como transferir esse raciocínio para outra obra?', item.transfer],
    ['Qual conclusão deve ser evitada sem contexto adicional?', `Evite ${item.overclaim}.`],
    ['Que evidência visual deve ser verificada primeiro?', `Verifique ${item.evidence}.`],
    ['Qual é o próximo passo mais cuidadoso?', item.nextStep],
    ['Qual limite deve aparecer na resposta?', `Mantenha a conclusão ligada a ${item.limit}.`],
    ['Que comparação é mais justa?', `Compare ${item.comparison}.`],
    ['Qual seria um exagero interpretativo?', `Seria exagero ${item.overclaim}.`],
    ['Que pergunta ajuda a refinar a leitura?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v11-art-compare-compositions-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V11_ART_COMPARE_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A resposta se apoia nas relações visuais descritas e separa observação de interpretação. ${item.criterion}`,
    hint: 'Observe elementos e relações antes de atribuir intenção, emoção ou significado universal.',
    errorFocus: 'ART_VISUAL_EVIDENCE_BEFORE_INFERENCE',
    misconceptions: { [item.distractors[0]]: ['ART_VISUAL_EVIDENCE_BEFORE_INFERENCE'] },
    ...(item.visualStimulus ? { visualStimulus: item.visualStimulus } : {}),
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/art-compare-compositions.json');
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
    contentId: 'v11-art-compare-compositions-visual-evidence',
    contentVersion: 11,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 11),
    expectedQuestionCount: questions.length,
    expectedContextCount: questions.length,
    expectedPurposeCounts,
    expectedAnswerPositionCounts,
    publicationStatus: 'STAGING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    officialMappingStatus: 'NOT_CLAIMED',
    lesson: { ...previous.lesson, progression, copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V11 autoral com 100 questões e revisão pedagógica pendente; publicação mantida em STAGING.`.trim() },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V11' },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`ART_INVALID:${validation.errors.join(',')}`);
  writeFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v11-art-compare-compositions-expansion-v11.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(resolve(ROOT, 'supabase/migrations/20261016001000_bncc_art_compare_compositions_library_expansion_v11.sql'), buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, newQuestions: 100, totalQuestions: questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, visualQuestions: questions.filter((question) => question.visualStimulus).length, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
