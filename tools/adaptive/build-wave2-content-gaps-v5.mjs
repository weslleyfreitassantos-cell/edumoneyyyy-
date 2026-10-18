import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const PURPOSE_COUNTS = { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 5, REVIEW: 11 };
const purposeAt = (index) => index < 4 ? 'PROBE' : index < 16 ? 'PRACTICE' : index < 24 ? 'TRANSFER' : index < 29 ? 'LOCK_IN' : 'REVIEW';
const stageFor = { PROBE: 'DIAGNOSTIC', PRACTICE: 'PRACTICE', TRANSFER: 'TRANSFER', LOCK_IN: 'CONSOLIDATION', REVIEW: 'REVIEW' };
const processFor = {
  PROBE: ['IDENTIFY', 'DISTINGUISH', 'COMPARE', 'INTERPRET'],
  PRACTICE: ['INTERPRET', 'ANALYZE', 'COMPARE', 'APPLY'],
  TRANSFER: ['EVALUATE', 'APPLY', 'SYNTHESIZE', 'PLAN'],
  LOCK_IN: ['DISTINGUISH', 'EVALUATE', 'SYNTHESIZE'],
  REVIEW: ['INTERPRET', 'EVALUATE', 'COMPARE', 'SYNTHESIZE'],
};

const officialBnccSource = {
  publisher: 'Ministério da Educação, Brasil',
  title: 'Base Nacional Comum Curricular',
  url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
  license: 'Referência curricular geral; o alinhamento oficial específico deste pacote não foi reivindicado.',
};

const sourceQuestionsFor = (subject, skills) => {
  const path = resolve(ROOT, `content/adaptive/tec-escola-core-v4/subjects/${subject}/questions.json`);
  const legacy = JSON.parse(readFileSync(path, 'utf8')).filter((question) => skills.includes(question.primarySkill));
  let expanded = [];
  try {
    expanded = (JSON.parse(readFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v9/question-expansion-v3.json'), 'utf8')).questions ?? [])
      .filter((question) => skills.includes(question.skill));
  } catch {
    expanded = [];
  }
  return [...legacy, ...expanded];
};

const withAnswerAt = (correct, distractors, index) => {
  const options = [...distractors];
  options.splice(index % 4, 0, correct);
  return options;
};

const makeQuestion = ({ prefix, index, contextFamily, statement, correctAnswer, distractors, explanation, hint, misconception }) => {
  const purpose = purposeAt(index);
  return {
    id: `v5-${prefix}-${String(index + 1).padStart(2, '0')}`,
    purpose,
    difficulty: index < 4 ? 'EASY' : index < 16 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `${contextFamily}_${String(index + 1).padStart(2, '0')}`,
    statement,
    options: withAnswerAt(correctAnswer, distractors, index),
    correctAnswer,
    explanation,
    hint,
    errorFocus: misconception,
    misconceptions: { [distractors[0]]: [misconception] },
  };
};

const evidenceCases = [
  ['registro de ponte', 'um livro municipal de 1912 anota três dias de interdição após uma cheia', 'O que a fonte permite afirmar diretamente?', 'o registro municipal anotou uma interdição temporária depois da cheia', 'que todos os moradores apoiaram a interdição', 'que a ponte nunca mais foi usada', 'que a cheia foi causada pela interdição'],
  ['entrevista de trabalhadora', 'uma entrevista gravada décadas depois relata a participação em uma greve, enquanto o jornal da época não cita seu nome', 'Como relacionar as fontes?', 'a entrevista preserva uma memória individual posterior e o jornal oferece um registro contemporâneo, cada qual com limites próprios', 'o silêncio do jornal prova que a entrevistada não participou', 'a entrevista é falsa por ter sido gravada depois', 'as duas fontes são idênticas por mencionar a mesma greve'],
  ['carta de trabalhador', 'uma carta de 1930 descreve jornadas longas e evita nomear o empregador', 'Que aspecto ajuda a interpretar o documento?', 'destinatário, posição do autor e possível risco de circulação podem influenciar o que foi escrito', 'a carta representa todos os trabalhadores da cidade', 'o silêncio sobre o nome prova que a jornada não existia', 'uma carta privada não tem qualquer valor histórico'],
  ['fotografia de inauguração', 'uma fotografia mostra uma avenida recém-inaugurada com faixas oficiais e arquibancadas', 'O que a imagem sozinha não comprova?', 'que a obra resolveu problemas de mobilidade para diferentes grupos e trajetos', 'que havia uma inauguração no local enquadrado', 'que estruturas e faixas aparecem na imagem', 'que a fotografia registra um momento e um recorte do espaço'],
  ['censos de ocupação', 'dois censos usam categorias diferentes para classificar trabalhadores rurais', 'Qual cuidado metodológico é necessário?', 'comparar definições, cobertura e procedimentos antes de tratar os percentuais como equivalentes', 'percentuais nunca podem ser comparados', 'as categorias oficiais mantêm sempre o mesmo significado', 'a diferença só pode ser erro de cálculo'],
  ['lei e experiências', 'uma lei altera formalmente uma condição jurídica, mas relatos posteriores mostram experiências diferentes entre grupos', 'Que conjunto amplia a análise?', 'combinar a norma com registros judiciais, contratos, correspondências, relatos e dados locais contextualizados', 'usar apenas o texto da lei como retrato completo', 'aplicar uma lembrança atual a todos os grupos', 'usar somente a data de promulgação'],
  ['dois jornais', 'dois jornais noticiam uma manifestação, um destacando reivindicações e outro destacando bloqueios', 'Como comparar os relatos?', 'examinar autoria, público, vocabulário, seleção de fatos e outras fontes sobre o evento', 'escolher o título mais curto como mais confiável', 'somar os textos como se fossem um relato neutro', 'descartar os dois porque jornais nunca são fontes'],
  ['patrimônio local', 'uma estação virou centro cultural; moradores a associam ao trabalho e jovens aos eventos atuais', 'Qual abordagem acolhe as narrativas?', 'documentar usos, memórias e transformações em períodos e grupos distintos', 'escolher uma memória e eliminar as demais', 'usar a função atual para explicar toda a história do prédio', 'tratar o patrimônio como espaço sem relações sociais'],
  ['acervo digital', 'um arquivo digital disponibiliza apenas cartas preservadas e catalogadas de uma associação', 'Qual limite precisa ser explicitado?', 'o acervo pode ser seletivo e não representar todas as pessoas ou opiniões do grupo', 'documentos digitalizados não podem ser fontes', 'a existência de cartas prova que todos escreveram', 'a catalogação elimina qualquer seleção'],
  ['mapa histórico', 'um mapa escolar de 1950 representa nomes e fronteiras conforme a administração daquele período', 'Que cuidado orienta o uso do mapa?', 'contextualizar data, finalidade, legenda, escala e mudanças posteriores', 'usá-lo como retrato atemporal do espaço atual', 'ignorar legenda e escala por ser uma imagem', 'supor que os nomes atuais eram usados da mesma forma'],
];

const periodizationCases = [
  ['ferrovia regional', 'as fontes registram planejamento entre 1880 e 1884, construção entre 1885 e 1889 e operação a partir de 1890', 'Qual recorte descreve melhor a periodização?', 'separar planejamento, construção e operação, reconhecendo etapas diferentes do processo', 'tratar 1880 como início imediato da operação', 'afirmar que nada aconteceu antes de 1890', 'considerar todo o processo uma mudança instantânea'],
  ['reforma escolar', 'uma escola mudou o currículo em 1972, mas manteve parte dos livros até 1975', 'O que a sobreposição mostra?', 'periodizações podem ter transições graduais e práticas antigas podem coexistir com novas', 'a mudança ocorreu inteira em um único dia', 'o currículo não mudou porque livros antigos permaneceram', '1975 é automaticamente a data de toda a reforma'],
  ['produção agrícola', 'registros apontam seca em 1910, novas técnicas em 1915 e recuperação em 1920', 'Que divisão evita uma explicação linear?', 'distinguir crise, resposta e recuperação, sem tratar a técnica como causa única', 'iniciar o período apenas em 1920', 'afirmar que a seca acabou com toda produção', 'atribuir cada mudança a uma única data'],
  ['movimento social', 'o grupo foi fundado em 1964, ampliou reivindicações em 1968 e mudou sua organização em 1971', 'Como usar os marcos?', 'como referências para comparar mudanças internas, sem presumir que cada marco encerra a etapa anterior', 'como fronteiras naturais e absolutas', 'como prova de que o grupo deixou de existir em 1968', 'como datas que explicam sozinhas as ações'],
  ['cidade e água', 'bairros receberam rede de água em 1965, 1974 e 1985, em ritmos diferentes', 'Que periodização é mais cuidadosa?', 'organizar fases de expansão e comparar os ritmos territoriais sem transformar uma data em padrão geral', 'usar a primeira data para toda a cidade', 'concluir que todos receberam água em 1965', 'ignorar diferenças entre bairros'],
  ['imprensa local', 'um jornal circulou de 1930 a 1942, alterou o formato em 1936 e mudou a direção em 1939', 'Qual aspecto os marcos permitem investigar?', 'mudanças de formato e direção dentro da continuidade de circulação do jornal', 'que o jornal deixou de existir em 1936', 'que a direção não afetou qualquer conteúdo', 'que cada troca de direção criou um jornal totalmente novo'],
  ['tecnologia doméstica', 'fogões a lenha e a gás aparecem juntos nos anúncios entre 1950 e 1960', 'O que uma fronteira rígida apagaria?', 'a coexistência e os diferentes ritmos de adoção entre os materiais', 'a existência dos fogões a lenha antes de 1950', 'a mudança para o gás em todos os lares', 'a necessidade de comparar grupos e lugares'],
  ['legislação trabalhista', 'uma norma foi publicada em 1943, regulamentada em 1945 e aplicada de modo desigual em relatos posteriores', 'Como periodizar o processo?', 'distinguir publicação, regulamentação e aplicação, mantendo a diferença entre norma e experiência', 'considerar a publicação como aplicação universal', 'ignorar os relatos posteriores', 'dizer que a lei nunca existiu'],
  ['música comunitária', 'o grupo usou instrumentos acústicos até 1998, incorporou equipamento eletrônico em 2001 e manteve ensaios semanais', 'Que leitura combina mudança e permanência?', 'a instrumentação mudou, enquanto a prática semanal de ensaio aparece nos dois momentos', 'tudo mudou quando surgiu o equipamento', 'nada mudou porque os ensaios continuaram', 'o grupo deixou de existir em 2001'],
  ['migração regional', 'a saída do campo cresceu entre 1970 e 1980 e estabilizou entre 1981 e 1985, com experiências distintas', 'Qual pergunta a periodização permite fazer?', 'como crescimento, estabilização e diferenças entre grupos se relacionam a condições históricas específicas', 'qual data explica sozinha todos os deslocamentos', 'por que todas as famílias fizeram o mesmo caminho', 'por que a estabilização prova que a migração terminou'],
];

const tableCases = [
  ['biblioteca', [8, 12, 10, 6], 'Qual foi o maior número registrado?', '12 empréstimos, na terça-feira', '6 empréstimos, porque é o menor valor', '36 empréstimos, confundindo soma e maior valor', '10 empréstimos, porque aparece no meio'],
  ['horta', [14, 9, 11, 16], 'Qual foi a diferença entre o maior e o menor registro?', '7 unidades', '5 unidades', '40 unidades', '2 unidades'],
  ['transporte escolar', [18, 22, 20, 16], 'Qual é o total dos quatro registros?', '76 passageiros', '60 passageiros', '22 passageiros', '4 passageiros'],
  ['leitura', [6, 10, 14, 18], 'Qual é a média dos quatro valores?', '12 livros', '18 livros', '48 livros', '10 livros'],
  ['chuva', [20, 15, 25, 10], 'Em qual período aparece o menor valor?', 'no quarto período', 'no primeiro período', 'no terceiro período', 'em todos os períodos'],
  ['energia', [30, 24, 18, 12], 'Quanto o último valor difere do primeiro?', '18 unidades a menos', '6 unidades a menos', '18 unidades a mais', '84 unidades a menos'],
  ['feira', [7, 13, 9, 11], 'Qual é a soma dos dois maiores valores?', '24 registros', '20 registros', '40 registros', '13 registros'],
  ['água', [40, 35, 45, 30], 'Qual valor representa a mediana dos quatro registros?', '37,5 unidades', '35 unidades', '40 unidades', '150 unidades'],
  ['oficina', [5, 8, 8, 11], 'Quantos registros são iguais a 8?', '2 registros', '1 registro', '3 registros', '32 registros'],
  ['esporte', [12, 16, 20, 24], 'Qual é o aumento do primeiro para o último valor?', '12 unidades', '8 unidades', '36 unidades', '2 unidades'],
];

const percentCases = [
  ['livros da biblioteca', 120, 10, 'livros', 'Quantos livros correspondem a 10% de 120?', '12 livros', '10 livros', '110 livros', '1200 livros'],
  ['estudantes inscritos', 160, 20, 'estudantes', 'Quantos estudantes correspondem a 20% de 160?', '32 estudantes', '20 estudantes', '80 estudantes', '140 estudantes'],
  ['garrafas recolhidas', 200, 25, 'garrafas', 'Quantas garrafas correspondem a 25% de 200?', '50 garrafas', '25 garrafas', '75 garrafas', '175 garrafas'],
  ['ingressos vendidos', 240, 30, 'ingressos', 'Quantos ingressos correspondem a 30% de 240?', '72 ingressos', '30 ingressos', '80 ingressos', '210 ingressos'],
  ['mudas plantadas', 300, 15, 'mudas', 'Quantas mudas correspondem a 15% de 300?', '45 mudas', '15 mudas', '60 mudas', '285 mudas'],
  ['páginas lidas', 360, 25, 'páginas', 'Quantas páginas correspondem a 25% de 360?', '90 páginas', '25 páginas', '120 páginas', '335 páginas'],
  ['kits distribuídos', 480, 10, 'kits', 'Quantos kits correspondem a 10% de 480?', '48 kits', '10 kits', '96 kits', '470 kits'],
  ['participantes', 560, 20, 'participantes', 'Quantos participantes correspondem a 20% de 560?', '112 participantes', '1120 participantes', '56 participantes', '440 participantes'],
  ['questões revisadas', 640, 30, 'questões', 'Quantas questões correspondem a 30% de 640?', '192 questões', '160 questões', '210 questões', '448 questões'],
  ['cartões impressos', 800, 15, 'cartões', 'Quantos cartões correspondem a 15% de 800?', '120 cartões', '80 cartões', '150 cartões', '680 cartões'],
];

const movementCases = [
  ['equilíbrio na recepção', 'a pessoa amplia a base de apoio e flexiona levemente os joelhos antes de empurrar um objeto leve', 'Qual efeito é mais diretamente esperado?', 'maior estabilidade postural, pois a base e a posição do centro de massa favorecem o equilíbrio', 'eliminação de toda força de reação', 'redução da massa corporal', 'repouso permanente do movimento'],
  ['arremesso', 'uma estudante coordena apoio dos pés, rotação do tronco e ação do braço', 'Qual análise é mais adequada?', 'a coordenação de segmentos pode transferir contribuições ao movimento, mas o resultado depende da tarefa e da prática', 'somente o antebraço determina o arremesso', 'o tronco impede qualquer transferência', 'a técnica garante a mesma distância para todos'],
  ['aterrissagem', 'um estudante aterrissa com joelhos rígidos e equilíbrio instável', 'Qual orientação favorece controle?', 'flexionar quadris e joelhos de modo controlado e distribuir o apoio, respeitando condições individuais', 'travar as articulações', 'aterrissar sempre sobre uma perna', 'evitar qualquer ajuste postural'],
  ['corrida e frenagem', 'uma atleta precisa parar após uma corrida curta em piso regular', 'Que ação ajuda a desacelerar com controle?', 'reduzir a velocidade gradualmente e organizar passos e base de apoio antes da parada', 'parar com articulações travadas', 'aumentar a velocidade no último passo', 'ignorar a direção do corpo'],
  ['salto horizontal', 'a turma compara saltos com braços parados e com balanço coordenado', 'O que deve ser observado?', 'como braços, pernas e tronco se coordenam para produzir e controlar o deslocamento', 'apenas a altura da pessoa', 'a força de um único dedo do pé', 'o resultado sem considerar a tarefa'],
  ['mudança de direção', 'em um jogo, a pessoa muda de direção rapidamente após sinal visual', 'Qual combinação apoia a mudança?', 'baixar o centro de massa, organizar a base e orientar a força para a nova direção', 'manter o corpo rígido e a base estreita', 'olhar para trás e ignorar o apoio', 'aplicar força sempre para frente'],
  ['lançamento adaptado', 'um participante usa uma bola mais leve e ajusta a distância do alvo', 'Qual princípio orienta a adaptação?', 'modificar material e espaço para preservar participação e permitir controle do movimento', 'usar o mesmo peso para todos', 'eliminar a escolha do participante', 'aumentar a distância sem observar segurança'],
  ['giro', 'durante um giro, a estudante aproxima os braços do corpo e depois os abre', 'Qual interpretação é coerente?', 'a distribuição da massa em relação ao eixo pode alterar a facilidade de girar e de controlar a rotação', 'a massa desaparece ao girar', 'abrir os braços elimina o eixo', 'o giro não depende da posição dos segmentos'],
  ['passe com apoio', 'em um passe, o estudante orienta os pés e acompanha o movimento com tronco e braços', 'O que a análise deve considerar?', 'sequência, direção da força, equilíbrio e coordenação entre segmentos', 'somente o formato da bola', 'apenas a velocidade final', 'a intenção sem observar o movimento'],
  ['caminhada em terreno irregular', 'a turma caminha em uma superfície com pequenas mudanças de altura', 'Qual ajuste ajuda a manter segurança?', 'reduzir a velocidade, ampliar a atenção ao apoio e ajustar o comprimento dos passos', 'manter passos longos sem olhar o terreno', 'bloquear os joelhos', 'aumentar a velocidade em toda mudança'],
];

const buildEvidenceQuestions = () => evidenceCases.flatMap((item, caseIndex) => Array.from({ length: 4 }, (_, variant) => {
  const index = caseIndex * 4 + variant;
  const [label, source, question, correct, d1, d2, d3] = item;
  const variants = [
    `${source}. ${question}`,
    `${source}. Qual afirmação respeita o alcance dessa fonte?`,
    `${source}. Que informação adicional ajudaria a aprofundar a análise?`,
    `${source}. Qual conclusão deve ser evitada sem outras evidências?`,
  ];
  const answers = [correct, `a afirmação deve permanecer limitada ao recorte, autoria e finalidade do ${label}`, `outras fontes sobre contexto, autoria e efeitos ajudariam a examinar a questão`, `uma conclusão geral sobre todas as pessoas, lugares e períodos não é sustentada por esse recorte`];
  return makeQuestion({ prefix: 'history-interpret-evidence', index, contextFamily: `HISTORY_SOURCE_${label.replaceAll(' ', '_').toUpperCase()}`, statement: variants[variant], correctAnswer: answers[variant], distractors: [d1, d2, d3], explanation: `A fonte oferece uma evidência situada. A resposta correta preserva seu recorte e diferencia o que é observável do que exigiria comparação, autoria e contexto adicionais.`, hint: 'Pergunte quem produziu a fonte, quando, para qual finalidade e qual afirmação aparece de fato.', misconception: 'SOURCE_SCOPE_OR_CONTEXT_IGNORED' });
}));

const buildPeriodizationQuestions = () => periodizationCases.flatMap((item, caseIndex) => Array.from({ length: 4 }, (_, variant) => {
  const index = caseIndex * 4 + variant;
  const [label, source, question, correct, d1, d2, d3] = item;
  const variants = [
    `${source}. ${question}`,
    `${source}. Qual limite deve acompanhar essa divisão em períodos?`,
    `${source}. Que comparação seria produtiva a partir dos marcos?`,
    `${source}. Qual afirmação transforma indevidamente um marco em fronteira absoluta?`,
  ];
  const answers = [correct, 'os marcos são recortes analíticos; transições, sobreposições e diferenças entre grupos devem ser verificadas', 'comparar ritmos, práticas e agentes antes, durante e depois dos marcos definidos', 'dizer que a mudança ocorreu de uma vez e do mesmo modo para todos'];
  return makeQuestion({ prefix: 'history-interpret-periodization', index, contextFamily: `HISTORY_PERIOD_${label.replaceAll(' ', '_').toUpperCase()}`, statement: variants[variant], correctAnswer: answers[variant], distractors: [d1, d2, d3], explanation: 'Periodização é uma ferramenta de análise, não uma fronteira natural. Os marcos ajudam a organizar a comparação, mas precisam ser testados contra ritmos, continuidades, grupos e fontes.', hint: 'Use os marcos para perguntar o que mudou, quando, para quem e com que continuidade.', misconception: 'PERIOD_BOUNDARY_TREATED_AS_INSTANT_UNIVERSAL_CHANGE' });
}));

const buildTableQuestions = () => tableCases.flatMap((item, caseIndex) => Array.from({ length: 4 }, (_, variant) => {
  const index = caseIndex * 4 + variant;
  const [label, values, question, correct, d1, d2, d3] = item;
  const periods = ['segunda', 'terça', 'quarta', 'quinta'];
  const table = periods.map((period, position) => `${period}: ${values[position]}`).join('; ');
  const variants = [
    `Tabela didática de ${label}: ${table}. ${question}`,
    `Tabela didática de ${label}: ${table}. Qual leitura compara os registros sem misturar linha, coluna e unidade?`,
    `Tabela didática de ${label}: ${table}. Que limite deve acompanhar uma conclusão baseada nesses valores?`,
    `Tabela didática de ${label}: ${table}. Qual procedimento confere o resultado antes de responder?`,
  ];
  const answers = [correct, 'manter cada valor associado ao período indicado e usar somente a operação pedida', 'afirmar apenas o que os quatro registros mostram, sem generalizar para outros períodos', 'identificar cabeçalho, unidade, operação e recalcular com os valores da tabela'];
  return makeQuestion({ prefix: 'math-interpret-data-table', index, contextFamily: `MATH_TABLE_${label.replaceAll(' ', '_').toUpperCase()}`, statement: variants[variant], correctAnswer: answers[variant], distractors: [d1, d2, d3], explanation: 'A leitura correta mantém os registros associados e executa a operação indicada. Uma tabela mostra o conjunto observado; ela não autoriza misturar valores nem generalizar além do período informado.', hint: 'Leia a pergunta, localize os valores correspondentes e confira se a operação é máximo, diferença, soma, média ou contagem.', misconception: 'TABLE_OPERATION_OR_SCOPE_CONFUSION' });
}));

const buildPercentQuestions = () => percentCases.flatMap((item, caseIndex) => Array.from({ length: 4 }, (_, variant) => {
  const index = caseIndex * 4 + variant;
  const [label, base, percent, unit, question, correct, d1, d2, d3] = item;
  const variants = [
    `${question} A base é ${base} ${unit}.`,
    `Uma atividade registra ${base} ${unit} em ${label}. Qual é ${percent}% dessa quantidade?`,
    `Para conferir uma meta de ${percent}% de ${base} ${unit} em ${label}, qual quantidade deve ser calculada?`,
    `A tabela de ${label} tem base de ${base} ${unit}. Qual expressão representa ${percent}% da base?`,
  ];
  const answers = [correct, correct, correct, `${percent}/100 × ${base} = ${correct}`];
  return makeQuestion({ prefix: 'math-percent-of-quantity', index, contextFamily: `MATH_PERCENT_${label.replaceAll(' ', '_').toUpperCase()}`, statement: variants[variant], correctAnswer: answers[variant], distractors: [d1, d2, d3], explanation: `${percent}% significa ${percent}/100 da base. Calculamos ${percent}/100 × ${base}, mantendo explícito que a base é ${base} ${unit}.`, hint: 'Transforme o percentual em fração sobre 100 e multiplique pela quantidade-base.', misconception: 'PERCENT_BASE_OR_RATE_CONFUSION' });
}));

const buildMovementQuestions = () => movementCases.flatMap((item, caseIndex) => Array.from({ length: 4 }, (_, variant) => {
  const index = caseIndex * 4 + variant;
  const [label, context, question, correct, d1, d2, d3] = item;
  const variants = [
    `Na situação de ${label}, ${context}. ${question}`,
    `Na situação de ${label}, ${context}. Que relação entre corpo, força e equilíbrio deve ser observada?`,
    `Na situação de ${label}, ${context}. Qual adaptação mantém participação e segurança?`,
    `Na situação de ${label}, ${context}. Que conclusão seria exagerada?`,
  ];
  const answers = [correct, 'observar posição do centro de massa, base de apoio, direção da força e coordenação dos segmentos', 'ajustar espaço, material, velocidade ou amplitude conforme a tarefa e as condições da pessoa', 'afirmar que uma única técnica garante o mesmo resultado para todos os corpos e contextos'];
  return makeQuestion({ prefix: 'pe-analyze-movement', index, contextFamily: `PE_MOVEMENT_${label.replaceAll(' ', '_').toUpperCase()}`, statement: variants[variant], correctAnswer: answers[variant], distractors: [d1, d2, d3], explanation: 'A análise do movimento relaciona equilíbrio, força, coordenação, espaço e tarefa. Uma orientação pode favorecer controle, mas precisa respeitar diferenças individuais e condições de segurança.', hint: 'Observe base de apoio, centro de massa, direção da força, sequência dos segmentos e possibilidade de adaptação.', misconception: 'SINGLE_TECHNIQUE_OR_SEGMENT_TREATED_AS_UNIVERSAL' });
}));

const lessonFor = {
  HISTORY_INTERPRET_EVIDENCE: {
    title: 'Interpretar evidências históricas com contexto', objective: 'Interpretar fontes históricas considerando autoria, contexto, recorte e limites da evidência.', summary: 'Uma fonte registra um recorte produzido por alguém em condições específicas. Interpretar exige separar observação, inferência e generalização.', explanation: '## 1. Localize a fonte\nPergunte quem produziu, quando, onde, para quem e com qual finalidade. Autoria e circulação influenciam escolhas, silêncios e vocabulário.\n\n## 2. Separe o registro da inferência\nUma fotografia mostra elementos visíveis; uma lei registra uma norma; um relato preserva uma experiência. Nenhum gênero explica sozinho todas as consequências sociais.\n\n## 3. Preserve o alcance\nDiga “no documento consultado”, “no grupo observado” ou “no período registrado” quando a cobertura for limitada. Ausência em um acervo não prova inexistência.\n\n## 4. Compare sem apagar diferenças\nFontes podem confirmar um aspecto e divergir em outro. Compare definições, interesses, datas e contextos antes de escolher uma versão.\n\n## Exemplo resolvido\nUm registro informa três dias de interdição de uma ponte após uma cheia. A conclusão proporcional é que a administração registrou uma interdição temporária; a causa da cheia e a opinião de todos os moradores exigem outras fontes.\n\n## 5. Escreva a conclusão\nUse: “A fonte registra ___. Isso permite afirmar ___. Não permite concluir ___ porque falta ___.”', workedExample: 'Compare uma lei e um relato: a lei informa a norma formal; o relato informa uma experiência situada. Use cada fonte para a pergunta que ela pode responder e indique o que ainda precisa ser investigado.', commonMistake: 'Tratar a fonte como relato completo e neutro, generalizar um caso, confundir silêncio documental com inexistência ou afirmar causa sem mecanismo.', tips: ['Contextualize autoria, data, lugar e finalidade.', 'Diferencie observação, interpretação e causa.', 'Delimite grupo, período e acervo.', 'Confronte fontes sem exigir concordância total.'], estimatedMinutes: 28, priorKnowledge: ['Identificar data e autoria de um documento.', 'Comparar duas informações sobre o mesmo acontecimento.'], keyConcepts: ['fonte', 'autoria', 'contexto', 'recorte', 'corroboração', 'inferência', 'silêncio documental'], activity: 'Auditar uma fonte curta, anotando autoria, recorte, afirmação sustentada e informação ausente.'
  },
  HISTORY_INTERPRET_PERIODIZATION: {
    title: 'Construir periodizações históricas', objective: 'Interpretar períodos como recortes analíticos para comparar mudanças, continuidades e ritmos.', summary: 'Datas e marcos organizam a análise, mas não são fronteiras naturais. Transições podem ser graduais, simultâneas e diferentes entre grupos.', explanation: '## 1. Defina o aspecto\nAntes de dividir o tempo, diga se observará leis, práticas, tecnologias, instituições ou experiências.\n\n## 2. Use marcos com justificativa\nUma mudança normativa, uma crise ou uma nova prática pode marcar uma etapa, mas o marco precisa ser explicado e confrontado com fontes.\n\n## 3. Procure sobreposições\nPráticas antigas podem continuar quando uma nova regra ou tecnologia aparece. Grupos e lugares também mudam em ritmos diferentes.\n\n## 4. Evite o antes/depois automático\nA ordem temporal não demonstra causa. Compare condições, agentes e consequências sem transformar uma data em explicação completa.\n\n## Exemplo resolvido\nSe uma norma é publicada em 1943, regulamentada em 1945 e vivida de formas diferentes depois, é mais rigoroso separar norma, regulamentação e aplicação.\n\n## 5. Registre o recorte\nNomeie o período, os critérios usados e o que permanece fora da análise.', workedExample: 'Divida uma reforma escolar em mudança curricular, adoção de livros e práticas de sala. Os marcos ajudam a comparar etapas, mas a coexistência dos materiais impede afirmar uma virada instantânea.', commonMistake: 'Tratar marcos como fronteiras universais, ignorar continuidades ou atribuir toda mudança à data mais conhecida.', tips: ['Explique o critério de cada período.', 'Compare ritmos entre lugares e grupos.', 'Procure continuidade dentro da mudança.', 'Não confunda sucessão com causalidade.'], estimatedMinutes: 28, priorKnowledge: ['Ordenar acontecimentos em uma linha do tempo.', 'Distinguir anterioridade, duração e simultaneidade.'], keyConcepts: ['período', 'marco', 'transição', 'ritmo', 'continuidade', 'recorte'], activity: 'Montar duas periodizações para o mesmo conjunto de fontes e justificar qual aspecto cada uma torna visível.'
  },
  MATH_INTERPRET_DATA_TABLE: {
    title: 'Interpretar dados em tabelas', objective: 'Ler cabeçalhos, unidades, linhas e colunas para calcular e comunicar resultados proporcionais.', summary: 'Uma célula depende do cabeçalho e do registro ao qual pertence. Máximo, diferença, soma, média e contagem respondem perguntas diferentes.', explanation: '## 1. Leia a estrutura\nIdentifique título, cabeçalhos, unidades e período. Mantenha os valores da mesma linha associados.\n\n## 2. Traduza a pergunta\n“Maior” pede máximo; “diferença” pede subtração; “total” pede soma; “média” pede soma dividida pela quantidade de registros.\n\n## 3. Confira a unidade\nNão compare quilômetros com horas nem conte uma célula vazia como zero sem uma regra explícita.\n\n## 4. Limite a conclusão\nOs valores descrevem os registros apresentados. Não explicam sozinhos a causa nem representam períodos ausentes.\n\n## Exemplo resolvido\nSe uma tabela registra 8, 12, 10 e 6 empréstimos de segunda a quinta, o maior valor é 12 e o total é 36. São respostas diferentes para perguntas diferentes.\n\n## 5. Revise\nReleia a pergunta, refaça a operação e escreva a unidade do resultado.', workedExample: 'Para uma tabela de quatro dias, localize a coluna pedida, some somente os registros correspondentes e informe o período coberto. Não transforme uma manhã observada no total do dia.', commonMistake: 'Misturar linhas, confundir máximo com soma, ignorar unidade ou generalizar um conjunto pequeno.', tips: ['Leia cabeçalho e unidade antes do número.', 'Associe cada valor ao período correto.', 'Recalcule e escreva a unidade.', 'Diga qual período a tabela cobre.'], estimatedMinutes: 24, priorKnowledge: ['Comparar números e realizar as quatro operações.', 'Ler linhas e colunas simples.'], keyConcepts: ['cabeçalho', 'unidade', 'máximo', 'diferença', 'soma', 'média', 'escopo'], activity: 'Revisar uma tabela didática, marcar a pergunta, escolher a operação e justificar o limite da resposta.'
  },
  MATH_PERCENT_OF_QUANTITY: {
    title: 'Calcular percentual de uma quantidade', objective: 'Calcular um percentual de uma quantidade mantendo explícita a base do cálculo.', summary: 'Percentual é uma razão sobre 100. Para encontrar uma parte, transforme a taxa em fração ou decimal e multiplique pela quantidade-base.', explanation: '## 1. Identifique a base\nA base é o todo ao qual o percentual se refere. Leia a frase completa antes de calcular.\n\n## 2. Transforme a taxa\n10% = 10/100 = 0,10; 25% = 25/100 = 0,25.\n\n## 3. Multiplique\nPara 25% de 200, calcule 25/100 × 200 = 50. A unidade acompanha a base.\n\n## 4. Faça uma estimativa\n10% deve ser um décimo; 50% deve ser metade. A estimativa ajuda a detectar respostas maiores que o todo.\n\n## Exemplo resolvido\n20% de 160 = 0,20 × 160 = 32 estudantes. A base é 160, não 20.\n\n## 5. Comunique\nEscreva taxa, base, operação e unidade. Se a pergunta pedir o restante, subtraia a parte do todo depois de calcular.', workedExample: 'Para 15% de 800 cartões, use 15/100 × 800 = 120 cartões. O número 800 é a base e 120 é a parte correspondente.', commonMistake: 'Usar o percentual como se fosse a quantidade, trocar a base ou esquecer a unidade.', tips: ['Circule a quantidade-base.', 'Converta a taxa para uma fração sobre 100.', 'Compare o resultado com o todo.', 'Mantenha a unidade da quantidade.'], estimatedMinutes: 22, priorKnowledge: ['Multiplicar e dividir por 10 e 100.', 'Interpretar parte e todo.'], keyConcepts: ['percentual', 'base', 'parte', 'fração', 'decimal', 'estimativa'], activity: 'Resolver situações de percentual em um quadro com taxa, base, operação, resultado e unidade.'
  },
  PE_ANALYZE_MOVEMENT: {
    title: 'Analisar movimento corporal', objective: 'Analisar habilidades motoras considerando equilíbrio, força, coordenação, espaço e adaptação.', summary: 'Movimento é uma relação entre corpo, tarefa e ambiente. Base de apoio, centro de massa, direção da força e coordenação ajudam a explicar controle.', explanation: '## 1. Observe antes de avaliar\nDescreva apoio, posição do corpo, direção, velocidade e sequência dos segmentos. Evite concluir apenas pelo resultado.\n\n## 2. Relacione equilíbrio e base\nBase mais ampla, centro de massa organizado e ajustes dos joelhos podem favorecer estabilidade, dependendo da tarefa.\n\n## 3. Analise a cadeia\nPés, pernas, tronco e braços podem coordenar contribuições. Nenhum segmento explica sozinho toda habilidade.\n\n## 4. Adapte com segurança\nMaterial, espaço, velocidade e amplitude podem ser ajustados para ampliar participação sem impor o mesmo padrão a todos.\n\n## Exemplo resolvido\nNa aterrissagem, flexão controlada de quadris e joelhos aumenta a possibilidade de absorver o impacto e manter equilíbrio; a orientação precisa respeitar condições individuais.\n\n## 5. Dê feedback observável\nIndique o que foi visto, o efeito provável e uma mudança testável, sem rotular o corpo ou garantir resultado.', workedExample: 'Em uma mudança de direção, observe a base, o centro de massa e a direção da força. Reduzir velocidade e organizar os passos pode favorecer controle; a tarefa e o espaço precisam ser considerados.', commonMistake: 'Reduzir o movimento a força, aparência ou um segmento, tratar técnica como garantia universal ou ignorar adaptação e segurança.', tips: ['Descreva apoio, força e direção.', 'Relacione segmentos sem isolar um deles.', 'Adapte material e espaço quando necessário.', 'Use feedback observável e respeitoso.'], estimatedMinutes: 26, priorKnowledge: ['Reconhecer posições e deslocamentos.', 'Participar de práticas corporais com regras de segurança.'], keyConcepts: ['equilíbrio', 'base de apoio', 'centro de massa', 'força', 'coordenação', 'adaptação', 'segurança'], activity: 'Observar uma habilidade com consentimento, registrar dois elementos do movimento e propor um ajuste seguro e testável.'
  },
};

const targetDefinitions = [
  { key: 'HISTORY_INTERPRET_EVIDENCE', prefix: 'history-interpret-evidence', subject: 'HISTORY', domain: 'FONTES', contentId: 'v5-history-interpret-evidence', migration: '20261015002400_bncc_history_interpret_evidence_question_first_v5.sql', skills: ['HISTORY_INTERPRET_EVIDENCE'], buildQuestions: buildEvidenceQuestions },
  { key: 'HISTORY_INTERPRET_PERIODIZATION', prefix: 'history-interpret-periodization', subject: 'HISTORY', domain: 'TEMPO_HISTORICO', contentId: 'v5-history-interpret-periodization', migration: '20261015002500_bncc_history_interpret_periodization_question_first_v5.sql', skills: ['HISTORY_INTERPRET_PERIODIZATION'], buildQuestions: buildPeriodizationQuestions },
  { key: 'MATH_INTERPRET_DATA_TABLE', prefix: 'math-interpret-data-table', subject: 'MATHEMATICS', domain: 'DADOS', contentId: 'v5-math-interpret-data-table', migration: '20261015002600_bncc_math_interpret_data_table_question_first_v5.sql', skills: ['MATH_INTERPRET_DATA_TABLE'], buildQuestions: buildTableQuestions },
  { key: 'MATH_PERCENT_OF_QUANTITY', prefix: 'math-percent-of-quantity', subject: 'MATHEMATICS', domain: 'PORCENTAGEM', contentId: 'v5-math-percent-of-quantity', migration: '20261015002700_bncc_math_percent_of_quantity_question_first_v5.sql', skills: ['MATH_PERCENT_OF_QUANTITY'], buildQuestions: buildPercentQuestions },
  { key: 'PE_ANALYZE_MOVEMENT', prefix: 'pe-analyze-movement', subject: 'PHYSICAL_EDUCATION', domain: 'CORPO', contentId: 'v5-pe-analyze-movement', migration: '20261015002800_bncc_pe_analyze_movement_question_first_v5.sql', skills: ['PE_ANALYZE_MOVEMENT'], buildQuestions: buildMovementQuestions },
];

const buildPack = (definition) => {
  const questions = definition.buildQuestions();
  const sourceQuestions = sourceQuestionsFor(definition.subject === 'PHYSICAL_EDUCATION' ? 'physical_education' : definition.subject.toLowerCase(), definition.skills);
  const purposeCounts = Object.fromEntries(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
  const lesson = lessonFor[definition.key];
  return {
    packVersion: 'tec-escola-core-v5-question-first',
    contentId: definition.contentId,
    subject: definition.subject,
    domain: definition.domain,
    topic: lesson.title.toLocaleLowerCase('pt-BR'),
    canonicalSkillCode: definition.key,
    contentVersion: 1,
    lessonVersion: 1,
    expectedQuestionCount: 40,
    expectedContextCount: 40,
    expectedPurposeCounts: purposeCounts,
    expectedAnswerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    officialMappingStatus: 'NOT_CLAIMED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING',
    contentAuthoringStatus: 'AUTHORED',
    sourceQuestionFeedback: sourceQuestions.map((question) => ({ questionId: question.id, hint: 'Leia o recorte, identifique a habilidade solicitada e limite a conclusão ao que a fonte ou situação sustenta.', errorFocus: `${definition.key}_SCOPE_AND_EVIDENCE` })),
    sourceReconciliation: { sourceQuestionCount: sourceQuestions.length, feedbackAdded: sourceQuestions.length, sourceReconciliationStatus: 'EXACT', newQuestions: 40, reusedQuestionsCountedAsNew: false },
    lesson: {
      ...lesson,
      progression: PURPOSES.map((purpose) => ({ stage: stageFor[purpose], focus: ({ PROBE: 'Identificar a ideia ou operação central.', PRACTICE: 'Aplicar o procedimento em situações variadas.', TRANSFER: 'Avaliar limites e transferir para novo contexto.', LOCK_IN: 'Consolidar o raciocínio e reparar erros comuns.', REVIEW: 'Revisar evidência, estratégia e comunicação.' })[purpose], questionIds: questions.filter((question) => question.purpose === purpose).map((question) => question.id) })),
      microExplanations: [{ trigger: 'READ_CONTEXT', text: 'Leia contexto, pergunta e unidade antes de escolher.' }, { trigger: 'BOUND_CONCLUSION', text: 'A melhor resposta é a que não afirma mais do que os dados permitem.' }, { trigger: 'CHECK_OPERATION', text: 'Nomeie a operação ou evidência usada antes de concluir.' }, { trigger: 'REPAIR_ERROR', text: 'Quando errar, compare sua resposta com o aspecto que a pergunta realmente mede.' }],
      remediations: [{ id: 'LOCATE_SCOPE', misconception: 'Ignorar recorte, base ou condição da situação.', prompt: 'Sublinhe sujeito, período, unidade e condição. Reescreva a resposta incluindo esses limites.' }, { id: 'SEPARATE_EVIDENCE', misconception: 'Confundir observação, cálculo, causa ou conclusão.', prompt: 'Faça duas colunas: o que está registrado ou calculado e o que seria uma interpretação adicional.' }, { id: 'CHECK_RESULT', misconception: 'Aceitar resultado sem verificar operação ou coerência.', prompt: 'Refaça a operação, compare com uma estimativa e escreva a unidade ou consequência.' }, { id: 'TRANSFER_CONTEXT', misconception: 'Aplicar regra de um caso a todos os casos.', prompt: 'Identifique o que permanece igual e o que mudou no novo contexto antes de aplicar o procedimento.' }],
      reviewWindowsDays: [1, 3, 7], reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED', sourceDossier: [officialBnccSource],
      authenticActivities: [{ id: `${definition.contentId}-activity`, title: `Oficina de ${lesson.title.toLocaleLowerCase('pt-BR')}`, objective: lesson.objective, context: 'Situação didática autoral e sem coleta de dados pessoais.', materials: ['Texto ou tabela didática acessível', 'Registro de estratégia', 'Feedback do professor'], instructions: lesson.activity, evidence: 'Registro da análise com resposta, justificativa e limite explicitado.', safety: 'Permitir resposta escrita, oral ou digital e adaptar linguagem, tempo e suporte.', privacyGuard: 'Usar apenas situações fictícias; não registrar dados pessoais do estudante.', ageRange: 'Ensino Fundamental II, com mediação docente.', mediation: 'O docente verifica evidência, estratégia, limite e possibilidade de transferência.', rubric: [{ criterion: 'Estratégia', emerging: 'Escolhe sem explicar.', developing: 'Explica parte do procedimento.', proficient: 'Justifica a estratégia e confere o resultado.' }, { criterion: 'Limite', emerging: 'Generaliza ou omite condição.', developing: 'Reconhece parte do recorte.', proficient: 'Comunica exatamente o que a situação sustenta.' }] }],
      copyrightNote: 'Questões, dados, situações, explicações e feedbacks são autorais. Revisão pedagógica pendente; alinhamento oficial não reivindicado; publicação mantida em STAGING.',
    },
    questions,
  };
};

export const buildWave2ContentGapPacks = () => Object.fromEntries(targetDefinitions.map((definition) => [definition.key, buildPack(definition)]));

function main() {
  const packs = buildWave2ContentGapPacks();
  const report = [];
  for (const definition of targetDefinitions) {
    const pack = packs[definition.key];
    const validation = validateQuestionFirstPack(pack);
    if (!validation.valid) throw new Error(`${definition.key}_INVALID:${validation.errors.join(',')}`);
    writeFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v5/${definition.contentId}.json`), `${JSON.stringify(pack, null, 2)}\n`);
    writeFileSync(resolve(ROOT, `supabase/migrations/${definition.migration}`), buildMigration(pack));
    report.push({ skill: definition.key, questions: validation.questionCount, contexts: validation.contextCount, counts: validation.counts, answerPositions: validation.answerPositionCounts, sourceQuestions: pack.sourceReconciliation.sourceQuestionCount, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus });
  }
  process.stdout.write(`${JSON.stringify({ valid: true, packs: report }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
