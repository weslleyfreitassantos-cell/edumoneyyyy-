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
  HISTORY_INTERPRET_PERIODIZATION: {
    sourceFile: 'v5-history-interpret-periodization.json',
    prefix: 'history-interpret-periodization-expansion',
    migration: '20261016000100_bncc_history_periodization_library_expansion_v7.sql',
    subject: 'HISTORY',
    items: [
      { label: 'archives', context: 'Um arquivo escolar registra planejamento de uma reforma em 1988, adoção de materiais em 1990 e mudanças de prática em 1993.', question: 'Qual recorte é mais adequado?', correct: 'Separar planejamento, adoção e prática, porque a mudança ocorreu em etapas.', criterion: 'Compare os marcos e diga qual aspecto cada um torna visível.', transfer: 'Use etapas diferentes ao analisar outra mudança institucional.', overclaim: 'tratar 1988 como se toda a mudança já tivesse acontecido', evidence: 'as datas, os documentos e os registros de prática de cada etapa', nextStep: 'montar uma linha do tempo e anotar o que cada fonte realmente mostra', limit: 'o processo escolar registrado e não toda experiência de todos os estudantes', comparison: 'o mesmo critério temporal nas diferentes fontes', refine: 'o que mudou em cada etapa e o que permaneceu?', distractors: ['A reforma aconteceu inteira no primeiro registro.', 'As datas não ajudam a organizar processos históricos.', 'A última data explica sozinha todas as etapas.'] },
      { label: 'city', context: 'Uma cidade recebeu iluminação pública em bairros centrais antes de alcançar áreas periféricas.', question: 'O que a comparação deve evitar?', correct: 'Dizer que a cidade inteira mudou ao mesmo tempo.', criterion: 'Compare lugar, período e grupos afetados antes de generalizar.', transfer: 'Analise outra inovação considerando ritmos diferentes entre regiões.', overclaim: 'considerar a primeira instalação como mudança universal', evidence: 'registros por bairro, datas de instalação e relatos dos moradores', nextStep: 'separar a cronologia central da cronologia periférica', limit: 'os bairros e anos observados nas fontes', comparison: 'a ordem e o ritmo da mudança em cada área', refine: 'quem teve acesso e quando?', distractors: ['Somente o nome da cidade.', 'A periferia nunca passa por mudanças.', 'Uma instalação prova que todos foram beneficiados.'] },
      { label: 'agriculture', context: 'Fontes indicam que uma técnica agrícola foi testada por alguns produtores e adotada por outros apenas anos depois.', question: 'Que interpretação respeita o tempo histórico?', correct: 'A inovação teve experimentação, circulação e adoção em ritmos distintos.', criterion: 'Identifique as etapas e os grupos envolvidos em cada momento.', transfer: 'Use a mesma análise para outra tecnologia que se espalhou gradualmente.', overclaim: 'afirmar que a técnica transformou toda a produção no primeiro teste', evidence: 'relatos de teste, registros de adoção e comparação entre produtores', nextStep: 'marcar o início do teste separadamente da expansão da prática', limit: 'os produtores e o período documentados', comparison: 'experimentação, circulação e adoção sem misturá-las', refine: 'o que a fonte informa sobre cada grupo?', distractors: ['Todo teste é automaticamente uma adoção geral.', 'A adoção não pode ser estudada por fontes.', 'Uma técnica não pode ter efeitos graduais.'] },
      { label: 'school', context: 'Uma escola trocou o currículo em um ano, mas manteve livros e avaliações anteriores durante dois anos.', question: 'O que a situação evidencia?', correct: 'Mudança normativa e continuidade de práticas podem coexistir.', criterion: 'Diferencie a decisão formal dos materiais e práticas que continuaram.', transfer: 'Compare norma e implementação em outra reforma educacional.', overclaim: 'concluir que a troca curricular eliminou imediatamente todas as práticas anteriores', evidence: 'o texto normativo, os livros usados e as avaliações de cada ano', nextStep: 'criar categorias separadas para regra, material e prática', limit: 'a escola e o período descritos', comparison: 'o que mudou formalmente e o que continuou no cotidiano', refine: 'qual evidência mostra a diferença entre decisão e uso?', distractors: ['Uma norma sempre apaga práticas anteriores.', 'Livros não são evidência histórica.', 'Continuidade significa que nada mudou.'] },
      { label: 'labor', context: 'Uma fábrica abriu em 1970, mas o emprego formal cresceu lentamente até 1978.', question: 'Qual periodização é mais informativa?', correct: 'Uma que distinga abertura da fábrica e expansão do emprego formal.', criterion: 'Use marcos ligados ao aspecto histórico analisado.', transfer: 'Escolha marcos diferentes quando o foco mudar de produção para trabalho.', overclaim: 'usar a abertura como prova de crescimento imediato do emprego', evidence: 'data de abertura, registros de contratação e série de empregos', nextStep: 'declarar se o foco é produção, contratação ou efeitos sociais', limit: 'o indicador de emprego e o intervalo observado', comparison: 'o início da atividade e o ritmo de contratação', refine: 'qual indicador define a etapa que está sendo estudada?', distractors: ['A fábrica e o emprego são sempre o mesmo evento.', 'Somente o ano mais conhecido importa.', 'Uma data substitui todos os indicadores.'] },
      { label: 'migration', context: 'Famílias chegaram a uma região em diferentes décadas, por motivos de trabalho, seca e redes familiares.', question: 'Como organizar a análise?', correct: 'Separar os períodos e relacionar motivos, origem e destino sem supor uma experiência única.', criterion: 'Relacione tempo, fatores de saída e oportunidades de chegada.', transfer: 'Compare outro movimento populacional usando períodos e motivos específicos.', overclaim: 'atribuir o mesmo motivo a todas as famílias', evidence: 'datas de chegada, relatos, condições de origem e redes no destino', nextStep: 'agrupar os registros por período e motivo declarado', limit: 'as famílias e décadas presentes nas fontes', comparison: 'pressões na origem e oportunidades no destino em cada período', refine: 'quais diferenças entre as ondas migratórias aparecem?', distractors: ['Toda migração tem uma causa única.', 'A década não muda a interpretação.', 'Relatos familiares não podem ser comparados.'] },
      { label: 'policy', context: 'Uma política ambiental foi anunciada em 2001, regulamentada em 2003 e fiscalizada com mais intensidade em 2007.', question: 'Qual sequência explica melhor o processo?', correct: 'Anúncio, regulamentação e fiscalização são etapas distintas da implementação.', criterion: 'Diferencie decisão, regra detalhada e prática de fiscalização.', transfer: 'Aplique as três etapas ao estudo de outra política pública.', overclaim: 'considerar o anúncio como prova de implementação completa', evidence: 'ato de anúncio, regulamento e registros de fiscalização', nextStep: 'organizar a sequência e associar cada fonte ao seu papel', limit: 'o processo de implementação documentado', comparison: 'as datas e funções de cada etapa', refine: 'o que a regulamentação acrescentou ao anúncio?', distractors: ['A fiscalização sempre ocorre antes do anúncio.', 'Um anúncio não pode ser fonte histórica.', 'As três etapas são a mesma coisa.'] },
      { label: 'memory', context: 'Um museu apresenta uma narrativa sobre um conflito, enquanto cartas de moradores registram experiências diferentes.', question: 'Que recorte ajuda a interpretar as fontes?', correct: 'Comparar a memória institucional com as experiências registradas em cada período e grupo.', criterion: 'Observe autoria, momento, finalidade e continuidade dos relatos.', transfer: 'Leia outras memórias públicas sem tratá-las como relato completo de todos.', overclaim: 'tomar a narrativa do museu como a única experiência possível', evidence: 'autoria, data, finalidade e divergências entre os registros', nextStep: 'identificar o que cada fonte inclui, omite e situa no tempo', limit: 'a posição de cada autor e o conjunto de relatos disponível', comparison: 'narrativa institucional e experiências locais com o mesmo cuidado', refine: 'quem fala, em que momento e com qual finalidade?', distractors: ['A fonte institucional é sempre neutra.', 'Memórias diferentes tornam a história impossível.', 'Uma carta representa todos os moradores.'] },
      { label: 'technology', context: 'Uma ferramenta digital foi criada em 2010, popularizada em 2014 e regulada pela escola em 2018.', question: 'O que uma linha do tempo bem construída mostra?', correct: 'Criação, circulação e regulação podem ser marcos de dimensões diferentes.', criterion: 'Nomeie o aspecto associado a cada data.', transfer: 'Monte uma periodização para outra tecnologia usando criação, uso e regulação.', overclaim: 'dizer que a criação já significava uso amplo e regulado', evidence: 'data de criação, indicadores de uso e norma escolar', nextStep: 'separar invenção, difusão e regulamentação no quadro', limit: 'a ferramenta e o contexto escolar descritos', comparison: 'a dimensão tecnológica, social e institucional em cada etapa', refine: 'qual mudança cada marco realmente representa?', distractors: ['Criar uma ferramenta é o mesmo que popularizá-la.', 'Regulação prova que todos a usavam.', 'Uma linha do tempo não pode ter dimensões.'] },
      { label: 'analogy', context: 'Um estudante compara uma reforma de transporte de 1950 com uma expansão de ciclovias atual porque ambas alteraram deslocamentos.', question: 'Qual cuidado é necessário?', correct: 'Comparar objetivos, atores, tecnologias e contextos, e não apenas o efeito visível.', criterion: 'Defina dimensões comuns e respeite as diferenças de cada período.', transfer: 'Use uma matriz de semelhanças e diferenças em outra comparação histórica.', overclaim: 'afirmar que os processos são iguais por terem um efeito parecido', evidence: 'fontes sobre objetivos, atores, infraestrutura e período', nextStep: 'criar uma tabela com semelhanças, diferenças e limites', limit: 'as dimensões realmente documentadas', comparison: 'o mesmo conjunto de dimensões nos dois períodos', refine: 'qual semelhança é relevante e qual diferença muda a interpretação?', distractors: ['Qualquer semelhança torna os eventos idênticos.', 'Períodos diferentes não podem ser comparados.', 'Somente os nomes das obras importam.'] },
    ],
  },
  SCIENCE_EXPLAIN_MATTER_TRANSFORMATION: {
    sourceFile: 'v5-science-explain-matter-transformation.json',
    prefix: 'science-matter-transformation-expansion',
    migration: '20261016000200_bncc_science_matter_transformation_library_expansion_v7.sql',
    subject: 'SCIENCE',
    items: [
      { label: 'ice', context: 'Um cubo de gelo derrete sobre uma bandeja e continua sendo água.', question: 'Que transformação é mais bem descrita?', correct: 'Uma mudança de estado físico, pois a substância observada continua sendo água.', criterion: 'Compare estado e composição antes de nomear a transformação.', transfer: 'Use estado e composição para analisar outro material que aquece ou esfria.', overclaim: 'chamar toda alteração visível de reação química', evidence: 'estado, temperatura e composição observada antes e depois', nextStep: 'registrar o que mudou e o que permaneceu igual', limit: 'o material e as condições da bandeja', comparison: 'estado físico e composição usando o mesmo material', refine: 'a substância mudou ou apenas seu estado?', distractors: ['Toda mudança de aparência cria uma substância nova.', 'O gelo desaparece sem transformar-se.', 'Não é possível observar mudanças de estado.'] },
      { label: 'burning', context: 'Uma folha de papel queima em uma área ventilada e restam cinzas e fumaça.', question: 'Qual evidência aponta para transformação química?', correct: 'A formação de materiais diferentes, como cinzas e gases, indica mudança de composição.', criterion: 'Procure produtos e evidências de composição, não apenas alteração de forma.', transfer: 'Verifique produtos formados ao analisar outra combustão autorizada.', overclaim: 'afirmar que qualquer mudança de cor prova a mesma reação', evidence: 'materiais iniciais, cinzas, gases e condições de combustão', nextStep: 'descrever materiais antes e depois sem ignorar a segurança', limit: 'o papel e as condições observadas, sem generalizar para toda combustão', comparison: 'composição antes e produtos depois', refine: 'quais produtos foram realmente observados?', distractors: ['A folha apenas mudou de lugar.', 'Cinzas são sempre o mesmo material que o papel.', 'Fumaça não pode ser uma evidência.'] },
      { label: 'salt', context: 'Sal se dissolve em água; depois, parte da água evapora e cristais aparecem novamente.', question: 'Como explicar a sequência?', correct: 'A dissolução e a evaporação alteram a distribuição e o estado, permitindo recuperar cristais de sal.', criterion: 'Acompanhe o sal e a água em cada etapa do procedimento.', transfer: 'Analise outra mistura distinguindo dissolução, separação e formação de material.', overclaim: 'dizer que o sal deixou de existir ao se dissolver', evidence: 'cristais, água, evaporação e material recuperado', nextStep: 'desenhar o sistema antes, durante e depois da evaporação', limit: 'a mistura e o procedimento descritos', comparison: 'o que está distribuído na solução e o que reaparece como cristal', refine: 'qual parte foi separada e por qual processo?', distractors: ['Dissolver sempre cria um material novo.', 'Evaporação transforma sal em água.', 'Uma mistura não pode ser separada.'] },
      { label: 'mass', context: 'Uma reação é feita em um recipiente aberto e a massa medida depois é menor que antes.', question: 'Qual cautela é necessária?', correct: 'A diferença pode envolver materiais que escaparam; o sistema aberto impede concluir que a matéria desapareceu.', criterion: 'Defina o sistema e considere gases ou vapores que podem sair.', transfer: 'Use recipiente fechado ao investigar conservação de massa em outra reação segura.', overclaim: 'concluir que a matéria foi destruída apenas pela medida final', evidence: 'tipo de recipiente, massa inicial e final e possíveis gases', nextStep: 'repetir a comparação em sistema fechado e registrar o procedimento', limit: 'o sistema aberto e as medidas disponíveis', comparison: 'massa dentro do recipiente e materiais que podem ter saído', refine: 'o que ficou fora da medida?', distractors: ['Toda massa menor prova destruição de matéria.', 'Recipientes não alteram medidas.', 'Gases nunca participam de transformações.'] },
      { label: 'control', context: 'Dois comprimidos efervescentes são comparados, mas um teste usa água fria e o outro água quente.', question: 'Por que a comparação é limitada?', correct: 'A temperatura mudou junto com o comprimido, então não é possível atribuir a diferença apenas ao material.', criterion: 'Identifique variáveis que precisam permanecer iguais.', transfer: 'Controle temperatura, volume e tempo ao comparar outro procedimento.', overclaim: 'atribuir qualquer diferença ao comprimido sem controlar a temperatura', evidence: 'temperatura, volume, tempo e identidade do comprimido', nextStep: 'repetir mantendo as condições constantes e variando um fator principal', limit: 'as condições dos dois testes', comparison: 'o comprimido sob temperatura e volume equivalentes', refine: 'qual variável foi alterada sem intenção?', distractors: ['Mais variáveis sempre tornam o teste melhor.', 'Temperatura não interfere em dissolução.', 'Um único teste elimina toda incerteza.'] },
      { label: 'temperature', context: 'Uma colher de chocolate sólido aquece e fica líquida; depois, ao esfriar, endurece novamente.', question: 'O que o ciclo indica?', correct: 'A matéria mudou de estado e pôde retornar ao estado inicial nas condições observadas.', criterion: 'Compare o material e as condições em cada mudança de estado.', transfer: 'Descreva reversibilidade observada sem transformá-la em regra universal.', overclaim: 'afirmar que toda transformação reversível é exclusivamente física em qualquer condição', evidence: 'material, temperatura, estado antes e depois e retorno observado', nextStep: 'registrar o ciclo e as condições que permitiram o retorno', limit: 'o chocolate e o intervalo de temperatura observado', comparison: 'a mesma substância em estados diferentes', refine: 'o que permitiu retornar e o que foi efetivamente medido?', distractors: ['O chocolate virou outra substância ao derreter.', 'Endurecer prova que nada mudou.', 'Toda mudança de estado é irreversível.'] },
      { label: 'gas', context: 'Uma massa fermentada cresce e libera bolhas durante o preparo.', question: 'Qual interpretação é prudente?', correct: 'Há produção ou liberação de gás no processo, mas é preciso identificar condições e materiais envolvidos.', criterion: 'Relacione bolhas, sistema e evidências sem inventar a composição do gás.', transfer: 'Observe gás, temperatura e tempo em outra transformação antes de concluir.', overclaim: 'nomear um gás específico sem evidência da composição', evidence: 'bolhas, odor autorizado, massa, temperatura e tempo do preparo', nextStep: 'registrar sinais observáveis e comparar com um controle', limit: 'as condições do preparo e os sinais observados', comparison: 'o sistema fermentado e um sistema de controle', refine: 'qual dado diferencia produção de gás de ar já presente?', distractors: ['Toda bolha é necessariamente oxigênio.', 'O gás não faz parte da matéria.', 'Bolhas provam qualquer reação possível.'] },
      { label: 'rust', context: 'Um prego ficou úmido por vários dias e apresentou uma camada avermelhada.', question: 'O que deve orientar a explicação?', correct: 'A exposição prolongada e a presença de água podem estar relacionadas à formação de outro material na superfície.', criterion: 'Considere tempo, umidade, material inicial e evidências da camada.', transfer: 'Compare outro caso de alteração de superfície com condições controladas.', overclaim: 'afirmar a causa completa sem comparar umidade, oxigênio e tempo', evidence: 'prego, umidade, tempo, aparência e condições de exposição', nextStep: 'comparar pregos em condições diferentes e registrar a superfície', limit: 'o prego e as condições de exposição descritas', comparison: 'umidade, tempo e presença de ar entre os grupos', refine: 'qual condição está associada à camada e qual ainda falta testar?', distractors: ['A camada é apenas água colorida sem investigação.', 'Tempo nunca afeta transformações.', 'Uma observação basta para provar todos os mecanismos.'] },
      { label: 'filter', context: 'Uma mistura de areia e água passa por um filtro, e a areia fica retida.', question: 'O que o procedimento mostra?', correct: 'A mistura pode ser separada por uma propriedade física que permite reter a areia.', criterion: 'Relacione tamanho das partículas, filtro e material retido.', transfer: 'Escolha um método de separação considerando a propriedade relevante de outra mistura.', overclaim: 'dizer que filtrar transforma areia em outra substância', evidence: 'materiais da mistura, poros do filtro e resíduos retidos', nextStep: 'identificar qual componente atravessou e qual ficou retido', limit: 'a mistura e o filtro utilizados', comparison: 'tamanho das partículas e passagem pelo filtro', refine: 'qual propriedade tornou a separação possível?', distractors: ['Filtrar sempre cria um novo material.', 'A areia evaporou durante o processo.', 'Toda mistura tem os mesmos métodos de separação.'] },
      { label: 'color', context: 'Uma solução azul recebe outro líquido e fica esverdeada; o procedimento não registra volumes nem composição.', question: 'Qual conclusão é proporcional?', correct: 'A cor mudou, mas faltam dados para identificar com segurança a transformação ou sua causa.', criterion: 'Separe a observação da explicação que ainda precisa de evidência.', transfer: 'Solicite composição, volume e controle antes de explicar outra mudança de cor.', overclaim: 'identificar a substância formada apenas pela cor', evidence: 'cor, volumes, composição, ordem de mistura e controle', nextStep: 'repetir com registros completos e comparação adequada', limit: 'a mudança de cor observada, sem nomear produtos não medidos', comparison: 'observação da cor e explicação química em separado', refine: 'que informação falta para diferenciar hipóteses?', distractors: ['A cor sozinha identifica qualquer substância.', 'Sem composição nada pode ser observado.', 'Toda cor nova prova combustão.'] },
    ],
  },
};

function makeQuestion({ definition, item, caseIndex, variant }) {
  const index = caseIndex * 10 + variant;
  const purpose = purposeAt(index);
  const variants = [
    [item.question, item.correct],
    ['Qual critério deve orientar a análise?', `Use ${item.criterion}`],
    ['Como transferir esse raciocínio para outro caso?', item.transfer],
    ['Qual conclusão deve ser evitada sem mais informações?', `Evite ${item.overclaim}.`],
    ['Que evidência deve ser verificada primeiro?', `Verifique ${item.evidence}.`],
    ['Qual é o próximo passo mais cuidadoso?', item.nextStep],
    ['Qual limite deve aparecer na resposta?', `Mantenha a conclusão ligada a ${item.limit}.`],
    ['Que comparação é mais justa?', `Compare ${item.comparison}.`],
    ['Qual seria um exagero interpretativo?', `Seria exagero ${item.overclaim}.`],
    ['Que pergunta ajuda a refinar a investigação?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v7-${definition.prefix}-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V7_${definition.prefix.toUpperCase()}_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A resposta usa as evidências do contexto e mantém a conclusão dentro das condições descritas. ${item.criterion}`,
    hint: `Leia o contexto, identifique a evidência e confira qual limite foi informado.`,
    errorFocus: `${definition.prefix.toUpperCase()}_EVIDENCE_SCOPE_CONFUSION`,
    misconceptions: { [item.distractors[0]]: [`${definition.prefix.toUpperCase()}_EVIDENCE_SCOPE_CONFUSION`] },
  };
}

function buildPack(definition) {
  const previous = JSON.parse(readFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v5/${definition.sourceFile}`), 'utf8'));
  const newQuestions = cases[definition.subject === 'HISTORY' ? 'HISTORY_INTERPRET_PERIODIZATION' : 'SCIENCE_EXPLAIN_MATTER_TRANSFORMATION'].items.flatMap((item, caseIndex) => Array.from({ length: 10 }, (_, variant) => makeQuestion({ definition, item, caseIndex, variant })));
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
    contentId: `v7-${definition.prefix}`,
    contentVersion: 7,
    lessonVersion: 7,
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
      copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V7 autoral com 100 questões, progressão de dificuldade e revisão pedagógica pendente; publicação mantida em STAGING.`.trim(),
    },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V7' },
    questions,
  };
}

export function buildWave4LibraryExpansionPacks() {
  return Object.fromEntries(Object.values(cases).map((definition) => [definition.subject, buildPack(definition)]));
}

function main() {
  const packs = buildWave4LibraryExpansionPacks();
  const report = [];
  for (const definition of Object.values(cases)) {
    const pack = packs[definition.subject];
    const validation = validateQuestionFirstPack(pack);
    if (!validation.valid) throw new Error(`${definition.subject}_INVALID:${validation.errors.join(',')}`);
    const outputName = definition.sourceFile.replace('.json', '-v7.json');
    writeFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v5/${outputName}`), `${JSON.stringify(pack, null, 2)}\n`);
    writeFileSync(resolve(ROOT, `supabase/migrations/${definition.migration}`), buildMigration(pack));
    report.push({ subject: definition.subject, newQuestions: 100, totalQuestions: pack.questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus });
  }
  process.stdout.write(`${JSON.stringify({ valid: true, packs: report }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
