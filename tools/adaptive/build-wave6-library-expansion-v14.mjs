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
  { label: 'precipitate', context: 'Duas soluções incolores são misturadas e formam um sólido branco. Em um controle, cada solução permanece líquida quando testada separadamente.', question: 'Que evidência torna a hipótese de reação mais forte?', correct: 'O sólido aparece na mistura e não nos controles, indicando um produto com propriedades diferentes.', criterion: 'Compare o produto com os reagentes e use controles realizados nas mesmas condições.', transfer: 'Avalie outro experimento em que um produto surge somente depois da combinação dos reagentes.', overclaim: 'dizer que qualquer turvação prova uma reação sem verificar o controle', evidence: 'sólido formado, controles e propriedades das soluções', nextStep: 'repetir a mistura e caracterizar o sólido com uma propriedade observável', limit: 'a evidência disponível e as condições do ensaio', comparison: 'mistura e controles, mantendo volume e temperatura comparáveis', refine: 'o sólido também aparece quando cada solução é testada sozinha?', distractors: ['A cor branca prova a reação mesmo sem comparar controles.', 'O sólido estava necessariamente escondido em uma das soluções.', 'Nenhuma observação de produto pode apoiar uma hipótese química.'] },
  { label: 'gas', context: 'Um comprimido efervescente é colocado em água à temperatura ambiente e libera bolhas. Em outro ensaio, a água é aquecida sem o comprimido e também libera pequenas bolhas.', question: 'Como separar as explicações possíveis?', correct: 'É preciso comparar os ensaios: o aquecimento pode liberar gás dissolvido, enquanto o comprimido pode produzir gás por uma transformação química.', criterion: 'Distingua uma pista observada de uma explicação e compare condições de controle.', transfer: 'Interprete outro caso com bolhas verificando se o gás já estava dissolvido ou se apareceu após reagentes interagirem.', overclaim: 'afirmar que toda bolha é produto de uma reação', evidence: 'presença do comprimido, temperatura e identidade do gás', nextStep: 'manter um controle sem comprimido e analisar o gás formado', limit: 'as condições comparadas e a identificação do gás', comparison: 'ensaio com comprimido e ensaio aquecido sem comprimido', refine: 'o gás aparece sem os reagentes que supostamente o produziriam?', distractors: ['As bolhas sempre têm a mesma origem, independentemente das condições.', 'Aquecer água transforma qualquer gás dissolvido em uma nova substância.', 'O controle sem comprimido não acrescenta informação.'] },
  { label: 'color', context: 'Uma solução azul fica verde após a adição de outra solução. Em uma repetição, a mistura é separada e os componentes originais são recuperados.', question: 'Qual interpretação é mais cuidadosa?', correct: 'A mudança de cor é uma pista, mas a recuperação dos componentes impede tratá-la sozinha como prova de produto novo.', criterion: 'Não confunda mudança visual com identificação de substância; considere análises complementares.', transfer: 'Analise uma mudança de cor em que a composição final ainda não foi determinada.', overclaim: 'concluir uma transformação química apenas pela cor observada', evidence: 'cor inicial, cor final e recuperação dos componentes', nextStep: 'usar uma análise adicional para verificar se surgiu uma substância diferente', limit: 'o que a observação e a separação permitem afirmar', comparison: 'amostras antes e depois, usando o mesmo método de análise', refine: 'a cor mudou porque houve reação ou porque os componentes foram combinados?', distractors: ['A cor final identifica automaticamente todos os produtos.', 'Recuperar os componentes prova que a cor nunca mudou.', 'Toda mistura colorida é uma transformação química.'] },
  { label: 'temperature', context: 'Ao misturar duas substâncias, a temperatura do recipiente diminui. O mesmo resfriamento não ocorre quando cada substância é misturada com água em separado.', question: 'O que o resfriamento sustenta?', correct: 'A diferença entre a mistura e os controles é uma evidência de interação energética, mas a classificação química exige avaliar também a composição e a reversibilidade.', criterion: 'Use a temperatura como evidência contextual, sem tratá-la como prova isolada.', transfer: 'Avalie outro experimento em que calor é absorvido e verifique se houve formação de substância nova.', overclaim: 'tratar qualquer mudança de temperatura como prova conclusiva de reação', evidence: 'temperaturas inicial e final, controles e composição após o ensaio', nextStep: 'medir as condições com repetição e investigar produtos e reversibilidade', limit: 'a variação térmica observada e suas explicações alternativas', comparison: 'mistura dos reagentes e controles térmicos', refine: 'a energia mudou por reação ou por dissolução e transferência de calor?', distractors: ['O resfriamento prova sozinho quais produtos foram formados.', 'Uma mistura que esfria nunca pode ser uma mudança física.', 'Controles térmicos não são necessários para interpretar calor.'] },
  { label: 'mass', context: 'Em um recipiente fechado, dois reagentes são misturados e a massa total permanece igual antes e depois. A aparência e a composição das amostras mudam.', question: 'Qual conclusão combina as duas observações?', correct: 'Pode ter ocorrido uma transformação química com conservação da massa total no sistema fechado.', criterion: 'Separe conservação da massa de conservação da identidade das substâncias.', transfer: 'Interprete uma reação em outro recipiente fechado comparando massa e composição.', overclaim: 'dizer que massa constante significa que nenhuma reação ocorreu', evidence: 'massa do sistema fechado e evidências de composição diferente', nextStep: 'identificar reagentes e produtos sem abandonar a fronteira do sistema', limit: 'a conservação de massa no recipiente analisado', comparison: 'massa total e identidade das substâncias antes e depois', refine: 'a massa foi medida no mesmo sistema e a composição foi investigada?', distractors: ['Massa constante impede a formação de substâncias novas.', 'A mudança de composição prova que parte da massa desapareceu.', 'Somente sistemas abertos conservam massa.'] },
  { label: 'open-system', context: 'Uma reação que produz gás acontece em um copo aberto. A massa medida no copo diminui, e o gás não foi coletado.', question: 'Por que a massa indicada pode diminuir?', correct: 'Parte da matéria saiu do sistema medido como gás; a leitura não permite concluir que a matéria foi destruída.', criterion: 'Defina a fronteira do sistema antes de interpretar uma mudança na massa medida.', transfer: 'Analise uma reação em que um sólido entra no sistema e compare a massa registrada com a massa total.', overclaim: 'afirmar destruição de matéria a partir de uma balança que mede só o recipiente', evidence: 'recipiente aberto, gás liberado e ausência de coleta', nextStep: 'fechar o sistema ou coletar o gás para comparar a massa total', limit: 'a massa do conteúdo que permaneceu no recipiente', comparison: 'sistema medido e sistema ampliado com o gás liberado', refine: 'qual parte da matéria ficou fora da balança?', distractors: ['A massa caiu porque toda reação destrói matéria.', 'O gás não tem massa depois que sai do copo.', 'Fechar o sistema impediria qualquer transformação química.'] },
  { label: 'reversible', context: 'Um sólido cristaliza ao resfriar uma solução e desaparece quando a solução é aquecida novamente. A composição do soluto pode ser recuperada.', question: 'Que dado favorece uma mudança física?', correct: 'A recuperação do mesmo soluto após aquecimento indica reorganização reversível sem evidência de substância nova.', criterion: 'Considere reversibilidade e composição recuperada ao distinguir mudanças físicas e químicas.', transfer: 'Classifique outro processo reversível verificando se a substância original pode ser obtida novamente.', overclaim: 'usar a formação de cristais como prova suficiente de reação', evidence: 'cristalização, aquecimento e recuperação do soluto', nextStep: 'comparar a composição antes e depois do ciclo', limit: 'a reversibilidade demonstrada nas condições do experimento', comparison: 'solução inicial, cristais e solução recuperada', refine: 'o ciclo recupera a mesma substância ou produz outra?', distractors: ['Todo sólido formado durante resfriamento é produto químico.', 'Reversibilidade não informa nada sobre a composição.', 'Aquecer sempre desfaz uma reação química.'] },
  { label: 'rate', context: 'Dois comprimidos iguais reagem em água. Um foi triturado e libera gás mais rapidamente, mas ambos deixam de reagir após o mesmo tempo total.', question: 'O que a comparação indica?', correct: 'A trituração aumentou a velocidade de contato, mas não prova que a quantidade total de transformação ou os produtos sejam diferentes.', criterion: 'Diferencie velocidade de reação de quantidade total e identidade dos produtos.', transfer: 'Interprete outro experimento em que uma condição altera o tempo, sem concluir automaticamente que alterou o produto.', overclaim: 'dizer que uma reação mais rápida sempre produz mais substância', evidence: 'tamanho das partículas, tempo de liberação e produtos finais', nextStep: 'controlar a quantidade e comparar a transformação total ao final', limit: 'a velocidade observada e a quantidade de reagente usada', comparison: 'comprimido triturado e comprimido inteiro ao longo do tempo', refine: 'a condição mudou a taxa ou também a quantidade final?', distractors: ['Triturar cria uma substância diferente em qualquer reação.', 'A reação mais rápida necessariamente consome mais reagente.', 'Tempo de reação e quantidade transformada são a mesma medida.'] },
  { label: 'alternative', context: 'Uma amostra aquece quando dois líquidos são misturados. A equipe conclui que ocorreu uma reação, mas não mediu a temperatura dos líquidos ao serem combinados nem verificou a dissolução.', question: 'Qual crítica melhora a conclusão?', correct: 'É necessário comparar a mistura com controles e investigar se a dissolução ou a temperatura inicial explicam o aquecimento antes de atribuí-lo a uma reação.', criterion: 'Procure explicações alternativas e dados de controle antes de fechar uma inferência.', transfer: 'Revise outra conclusão baseada em uma única pista e proponha uma comparação relevante.', overclaim: 'aceitar a primeira explicação sem testar causas alternativas', evidence: 'temperaturas iniciais, controles de dissolução e produtos analisados', nextStep: 'repetir o ensaio com medidas iniciais e controles adequados', limit: 'o que foi medido e o que ainda não foi testado', comparison: 'mistura reativa e processos físicos que também liberam ou absorvem calor', refine: 'qual explicação diferente da reação também prevê o aquecimento?', distractors: ['Uma única observação sempre elimina explicações alternativas.', 'Controles só servem quando não há mudança de temperatura.', 'A equipe pode afirmar o produto sem analisar a amostra.'] },
  { label: 'report', context: 'Um relatório descreve uma mistura que ficou turva, liberou calor e depois voltou a ficar transparente. O texto chama o processo de reação irreversível sem informar controles ou análise dos componentes.', question: 'Como o relatório deve ser revisado?', correct: 'Deve separar observações de interpretações, registrar controles e explicar se a composição mudou antes de afirmar uma reação irreversível.', criterion: 'Escreva conclusões proporcionais às evidências e torne explícitos método e incerteza.', transfer: 'Melhore outro relatório que usa linguagem conclusiva sem descrever controles e limites.', overclaim: 'transformar uma observação em conclusão definitiva sem dados suficientes', evidence: 'turbidez, calor, reversibilidade e ausência de controles no relatório', nextStep: 'adicionar controles, método de análise e uma conclusão limitada aos dados', limit: 'a qualidade e a extensão das evidências registradas', comparison: 'observações descritas e afirmações feitas no relatório', refine: 'quais dados faltam para distinguir mistura física de reação?', distractors: ['O relatório está completo porque menciona três observações.', 'Voltar a ficar transparente prova que houve reação irreversível.', 'Controles e método não precisam aparecer em um relatório científico.'] },
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
    id: `v14-chemistry-reaction-evidence-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V14_CHEMISTRY_REACTION_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A resposta interpreta uma evidência química sem ignorar controles, composição ou limites do sistema. ${item.criterion}`,
    hint: 'Separe o que foi observado da explicação e procure controles que testem alternativas.',
    errorFocus: 'CHEMISTRY_REACTION_EVIDENCE_SCOPE',
    misconceptions: { [item.distractors[0]]: ['CHEMISTRY_REACTION_EVIDENCE_SCOPE'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/chemistry-reaction-evidence.json');
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
    contentId: 'v14-chemistry-reaction-evidence',
    contentVersion: 14,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 14),
    expectedQuestionCount: questions.length,
    expectedContextCount: questions.length,
    expectedPurposeCounts,
    expectedAnswerPositionCounts,
    publicationStatus: 'STAGING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    officialMappingStatus: 'NOT_CLAIMED',
    lesson: { ...previous.lesson, progression, copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V14 autoral com 100 questões e revisão pedagógica pendente; publicação mantida em STAGING.`.trim() },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V14' },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`CHEMISTRY_INVALID:${validation.errors.join(',')}`);
  writeFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v14-chemistry-reaction-evidence-expansion-v14.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(resolve(ROOT, 'supabase/migrations/20261016001300_bncc_chemistry_reaction_evidence_library_expansion_v14.sql'), buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, newQuestions: 100, totalQuestions: questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
