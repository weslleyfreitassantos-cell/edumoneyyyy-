import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = path.join(ROOT, 'content/adaptive/tec-escola-core-v5/humanities-evidence-arguments-hs-v8.json');
const questions = [];

function addQuestion({ id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, hint, errorFocus }) {
  questions.push({ id, purpose, difficulty, cognitiveProcess, contextFamily, statement, options: [correctAnswer, ...distractors], correctAnswer, explanation, hint, errorFocus });
}

const probe = [
  ['source-type', 'Uma tabela mostra a população de quatro cidades em 2020. O que a tabela oferece diretamente?', 'Valores populacionais registrados para as cidades naquele ano.', ['A causa única de cada diferença.', 'A opinião de todos os moradores.', 'Uma previsão certa para todos os anos.'], 'Separe o dado registrado das explicações possíveis.', 'Tratar qualquer interpretação como se estivesse na tabela.'],
  ['claim-evidence', 'Qual frase apresenta uma afirmação apoiada por evidência?', 'O gráfico registra aumento de 10 para 16; por isso, o período final teve valor maior.', ['O gráfico prova que tudo melhorou.', 'Os valores cresceram porque as pessoas quiseram.', 'A linha mais colorida é a mais verdadeira.'], 'Procure uma ligação explícita entre dado e afirmação.', 'Confundir cor, intenção ou causa não medida com evidência.'],
  ['hypothesis', 'Uma hipótese em uma investigação é:', 'Uma explicação provisória que pode ser confrontada com evidências.', ['Uma opinião que não precisa de dados.', 'Uma conclusão definitiva antes da coleta.', 'Uma frase que substitui o problema.'], 'Hipótese é uma possibilidade testável, não uma certeza.', 'Tratar hipótese como resultado final.'],
  ['qualitative-quantitative', 'Qual exemplo é predominantemente qualitativo?', 'Relatos de moradores descrevendo como percebem uma mudança no bairro.', ['Uma contagem de 240 moradores.', 'Uma média de 6,2 km.', 'Uma tabela com 18 ocorrências.'], 'Observe se a informação descreve experiências ou apresenta medida numérica.', 'Confundir qualquer fonte com dado quantitativo.'],
];
probe.forEach(([contextFamily, statement, correctAnswer, distractors, hint, errorFocus], index) => addQuestion({ id: `v8-hum-evidence-probe-${String(index + 1).padStart(2, '0')}`, purpose: 'PROBE', difficulty: 'EASY', cognitiveProcess: 'IDENTIFY', contextFamily, statement, correctAnswer, distractors, explanation: 'A resposta distingue registro, interpretação, hipótese e tipo de informação sem concluir além do enunciado.', hint, errorFocus }));

const practice = [
  ['graph-scale', 'Um gráfico começa o eixo vertical em 90 em vez de 0 e mostra pequena diferença entre grupos. O que é importante observar?', 'A escala pode ampliar visualmente a diferença; compare também os valores e a origem do eixo.', ['A maior coluna sempre prova uma grande diferença.', 'A escala não influencia a leitura.', 'A cor das colunas substitui os números.'], 'Leia eixo, unidade e intervalo antes de interpretar.', 'Confundir aparência visual com magnitude do dado.'],
  ['sample-size', 'Uma pesquisa ouviu 20 estudantes de uma escola e apresentou a opinião como se fosse a de toda a cidade. Qual é o problema?', 'A amostra e o contexto não sustentam automaticamente a generalização para a cidade inteira.', ['Toda amostra é inútil.', 'Vinte respostas sempre representam qualquer população.', 'A conclusão fica correta se o gráfico for colorido.'], 'Pergunte quem foi ouvido e para quem a conclusão vale.', 'Generalizar sem considerar população e amostra.'],
  ['correlation', 'Em dois meses, aumentaram tanto o uso de bicicletas quanto a venda de frutas. O que se pode afirmar com segurança?', 'As duas medidas aumentaram no período; os dados, sozinhos, não provam que uma causou a outra.', ['Bicicletas causaram toda a venda de frutas.', 'A venda de frutas causou o uso de bicicletas.', 'Qualquer associação é uma causa.'], 'Descreva o padrão e mantenha a causalidade como hipótese.', 'Inferir causa diretamente de associação.'],
  ['source-bias', 'Uma empresa publica um relatório sobre a eficácia de seu próprio produto. Como usar a fonte criticamente?', 'Analisar método, dados, interesses envolvidos e comparar com outras fontes.', ['Aceitar tudo por ser relatório.', 'Rejeitar tudo sem ler os dados.', 'Usar apenas o título para concluir.'], 'Fonte tem perspectiva; isso pede análise, não aceitação ou rejeição automática.', 'Confundir interesse declarado com prova de falsidade.'],
  ['table-comparison', 'Uma tabela reúne dados de bairros com áreas muito diferentes. Para comparar ocorrências de forma mais justa, o que pode ajudar?', 'Considerar uma taxa ou proporção adequada, além dos valores absolutos.', ['Usar apenas o bairro com maior número.', 'Ignorar o tamanho de cada bairro.', 'Trocar os números por opiniões.'], 'Compare denominadores quando os tamanhos dos grupos variam.', 'Comparar contagens sem contexto.'],
  ['missing-data', 'Uma série temporal tem três meses sem registro. Qual cuidado é necessário?', 'Indicar a ausência e evitar afirmar uma tendência contínua sem examinar o impacto.', ['Preencher os meses com qualquer número.', 'Apagar os meses para deixar o gráfico regular.', 'Tratar ausência como valor zero sem justificativa.'], 'Dado ausente não é automaticamente zero.', 'Inventar ou apagar dados faltantes.'],
  ['counterexample', 'Uma hipótese diz que todos os estudantes preferem estudar de manhã. Uma resposta que contraria a hipótese é:', 'Um grupo de estudantes relata preferência por estudar à tarde ou à noite.', ['Outro estudante confirma a preferência da manhã.', 'A pergunta é repetida sem resposta.', 'O horário é mantido em segredo.'], 'Um contraexemplo precisa apresentar uma evidência relevante.', 'Confundir confirmação com refutação.'],
  ['argument-structure', 'Qual estrutura torna um argumento mais verificável?', 'Afirmação, evidência usada, explicação da relação e limite da conclusão.', ['Afirmação forte sem fonte.', 'Lista de opiniões sem relação.', 'Conclusão primeiro, sem indicar dados.'], 'Mostre como o dado apoia a afirmação.', 'Pular a ponte entre evidência e conclusão.'],
  ['map-evidence', 'Um mapa mostra concentração de serviços em uma região. O que ainda é necessário para discutir desigualdade de acesso?', 'Comparar localização, população, distância e critérios de disponibilidade.', ['Somente a cor mais escura.', 'Apenas o nome do mapa.', 'Uma conclusão sem conhecer os usuários.'], 'Mapa é evidência espacial, mas precisa de contexto.', 'Ler a representação sem considerar escala e população.'],
  ['interview-code', 'Ao analisar entrevistas, uma equipe agrupa falas por temas. Qual procedimento é mais cuidadoso?', 'Definir critérios, registrar exemplos e verificar se as categorias representam as falas.', ['Escolher apenas a fala mais chamativa.', 'Alterar falas para caber na hipótese.', 'Contar uma categoria sem explicar sua definição.'], 'Categorias precisam ser transparentes e rastreáveis.', 'Forçar dados qualitativos a confirmar uma ideia.'],
  ['alternative-explanation', 'Uma queda nas faltas coincide com mudança no transporte escolar. Qual pergunta ajuda a testar explicações alternativas?', 'Que outros fatores mudaram no mesmo período e como podem ter influenciado as faltas?', ['Qual fator parece mais interessante?', 'Como provar a primeira explicação sem comparar?', 'Por que toda coincidência é suficiente?'], 'Liste variáveis que mudaram junto.', 'Ignorar explicações alternativas.'],
  ['ethical-data', 'Ao apresentar relatos de estudantes sobre um tema sensível, qual cuidado é fundamental?', 'Proteger identidade, explicar o uso autorizado e evitar expor pessoas ao apresentar evidências.', ['Publicar nomes para aumentar impacto.', 'Selecionar relatos sem consentimento.', 'Usar qualquer detalhe pessoal como ilustração.'], 'Argumento consistente também exige responsabilidade ética.', 'Tratar dados pessoais como recurso livre.'],
];
practice.forEach(([contextFamily, statement, correctAnswer, distractors, hint, errorFocus], index) => addQuestion({ id: `v8-hum-evidence-practice-${String(index + 1).padStart(2, '0')}`, purpose: 'PRACTICE', difficulty: index < 5 ? 'EASY' : 'MEDIUM', cognitiveProcess: index < 5 ? 'INTERPRET' : 'ANALYZE', contextFamily, statement, correctAnswer, distractors, explanation: 'A resposta usa a fonte e o contexto de modo verificável, reconhecendo limites, alternativas ou cuidados éticos.', hint, errorFocus }));

const transfer = [
  ['policy-brief', 'Um conselho escolar precisa decidir onde ampliar uma biblioteca. Há dados de distância, número de estudantes, frequência de uso e entrevistas. Qual proposta é mais defensável?', 'Explicitar critérios, combinar dados quantitativos e relatos e reconhecer limites antes de recomendar uma unidade.', ['Escolher o local com o gráfico mais alto sem ler as entrevistas.', 'Usar apenas uma opinião porque é mais rápida.', 'Decidir pela aparência do bairro.'], 'Uma decisão complexa precisa de critérios e evidências diferentes.', 'Reduzir decisão pública a um indicador isolado.'],
  ['historical-source', 'Duas fontes descrevem um mesmo evento histórico de perspectivas opostas. Como construir uma hipótese?', 'Comparar autoria, época, interesses, convergências e diferenças antes de propor uma explicação provisória.', ['Escolher a fonte mais longa como verdadeira.', 'Somar frases incompatíveis sem contexto.', 'Descartar a fonte que usa linguagem diferente.'], 'Contextualize cada narrativa antes de comparar.', 'Hierarquizar fonte por tamanho ou estilo.'],
  ['environmental-data', 'Uma comunidade avalia a qualidade da água com medições, relatos e mapa de pontos de coleta. Qual argumento é mais forte?', 'Relacionar medidas e locais, confrontar relatos com o período observado e indicar incertezas e próximos dados.', ['Afirmar uma causa única com uma medição.', 'Usar só o relato mais alarmante.', 'Ignorar diferenças entre pontos.'], 'Conecte evidências sem esconder sua escala e incerteza.', 'Construir certeza ampla com evidência parcial.'],
  ['social-indicator', 'Um índice social melhorou, mas a média esconde diferenças entre grupos. O que a análise deve fazer?', 'Desagregar os dados por grupos e discutir como a média pode ocultar desigualdades.', ['Concluir que todos melhoraram igualmente.', 'Abandonar o índice sem investigar.', 'Usar apenas o grupo com maior valor.'], 'Média geral pode ocultar distribuição.', 'Confundir média com experiência de todos.'],
  ['digital-trace', 'Uma plataforma afirma que uma campanha alcançou muitas pessoas porque houve muitas visualizações. Que dado adicional ajuda?', 'Distinguir visualizações, pessoas únicas, interações e o período observado.', ['Usar apenas o número maior.', 'Considerar toda visualização como aprendizagem.', 'Ignorar a definição de alcance.'], 'Defina exatamente o que cada métrica conta.', 'Tratar métricas diferentes como equivalentes.'],
  ['public-hearing', 'Em uma audiência pública, grupos apresentam números e relatos diferentes. Qual postura favorece um argumento responsável?', 'Perguntar sobre métodos, reconhecer experiências distintas e tornar os critérios de decisão explícitos.', ['Escolher o grupo que fala mais alto.', 'Excluir relatos por não serem números.', 'Aceitar a primeira estatística sem verificar.'], 'Argumentos públicos devem ser examináveis e inclusivos.', 'Confundir força retórica com qualidade da evidência.'],
  ['scenario-model', 'Um modelo projeta aumento de temperatura para as próximas décadas. Como comunicar o resultado?', 'Informar pressupostos, horizonte, incerteza e o que o modelo não determina sozinho.', ['Apresentar a projeção como data certa.', 'Omitir o método para facilitar a mensagem.', 'Dizer que qualquer cenário tem o mesmo significado.'], 'Modelo depende de dados e pressupostos.', 'Transformar projeção condicionada em previsão inevitável.'],
  ['argument-revision', 'Após encontrar dados que contradizem parte do argumento, qual é a melhor resposta?', 'Revisar a afirmação, explicar a divergência e investigar se o alcance ou a hipótese precisam mudar.', ['Apagar o dado contrário.', 'Manter a conclusão sem comentário.', 'Trocar a pergunta para esconder o conflito.'], 'Evidência contrária pode melhorar o argumento.', 'Proteger a conclusão em vez de revisar o raciocínio.'],
];
transfer.forEach(([contextFamily, statement, correctAnswer, distractors, hint, errorFocus], index) => addQuestion({ id: `v8-hum-evidence-transfer-${String(index + 1).padStart(2, '0')}`, purpose: 'TRANSFER', difficulty: index < 3 ? 'MEDIUM' : 'HARD', cognitiveProcess: ['SYNTHESIZE', 'COMPARE', 'EVALUATE', 'JUSTIFY'][index % 4], contextFamily, statement, correctAnswer, distractors, explanation: 'A resposta compõe argumento com fontes de naturezas diferentes, explicita critérios e limita o alcance da conclusão.', hint, errorFocus }));

const lockIn = [
  ['claim-scope', 'Qual conclusão respeita o alcance de uma pesquisa feita com uma amostra pequena?', 'Entre as pessoas consultadas e no período estudado, apareceu o padrão descrito; outras populações exigem investigação.', ['Toda a sociedade pensa assim.', 'A amostra prova uma causa universal.', 'Nenhuma conclusão é possível com amostra pequena.'], ['Toda pesquisa pequena é inútil.', 'O tamanho não importa para generalização.', 'A conclusão deve ser universal para ser válida.'], 'Indique grupo e período antes de ampliar a afirmação.', 'Generalizar ou descartar completamente a evidência.'],
  ['source-triangulation', 'Por que combinar uma tabela, entrevistas e um mapa pode ser útil?', 'Cada fonte mostra uma dimensão do problema, permitindo comparar convergências, diferenças e limites.', ['Mais fontes sempre eliminam incerteza.', 'Uma fonte se torna verdadeira por haver outras.', 'Fontes diferentes não podem ser comparadas.'], ['Apenas uma fonte é suficiente sempre.', 'Fontes múltiplas eliminam todo erro.', 'Qualquer fonte diferente é incompatível.'], 'Combine sem tratar todas as fontes como a mesma medida.', 'Confundir triangulação com certeza automática.'],
  ['causal-care', 'Qual pergunta é necessária antes de dizer que uma política causou uma mudança?', 'Que comparação ou evidência permite separar o efeito da política de outras mudanças no período?', ['A mudança ocorreu depois?', 'O gráfico tem uma linha crescente?', 'Alguém acredita na política?'], ['Toda sequência temporal prova causa.', 'Causa não precisa de comparação.', 'Opinião substitui desenho de investigação.'], 'Depois não significa necessariamente por causa.', 'Inferir causalidade de sequência temporal simples.'],
  ['reproducible', 'Um argumento é mais confiável quando outra pessoa consegue:', 'Localizar as fontes, entender os critérios e refazer a comparação com os dados disponíveis.', ['Repetir apenas a opinião do autor.', 'Adivinhar os dados ausentes.', 'Confiar no design do relatório.'], ['Transparência é apenas estética.', 'Fontes não precisam ser localizáveis.', 'Reprodução depende de concordar.'], 'Pense no caminho que liga evidência e conclusão.', 'Confundir credibilidade com aparência.'],
  ['uncertainty', 'Qual frase comunica incerteza de modo informativo?', 'Os dados sugerem uma diferença no período observado, mas a amostra e as medidas não permitem afirmar a causa.', ['Os dados não servem para nada.', 'A causa está provada sem dúvida.', 'Incerteza significa que qualquer opinião é igual.'], ['Incerteza impede toda conclusão.', 'Certeza é necessária para usar dados.', 'Opiniões têm o mesmo peso que evidências.'], 'Incerteza delimita, não apaga, o que foi observado.', 'Tratar incerteza como ausência total de conhecimento.'],
  ['ethical-argument', 'Qual prática é incompatível com um argumento responsável?', 'Omitir deliberadamente uma evidência relevante porque ela enfraquece a conclusão.', ['Indicar uma limitação.', 'Comparar duas fontes.', 'Revisar hipótese diante de novo dado.'], ['Só o resultado final importa.', 'Limitações enfraquecem toda pesquisa.', 'Revisar é abandonar o argumento.'], 'Considere transparência e rastreabilidade.', 'Selecionar evidências de forma enganosa.'],
];
lockIn.forEach(([contextFamily, statement, correctAnswer, distractors, alternateDistractors, hint, errorFocus], index) => addQuestion({ id: `v8-hum-evidence-lock-${String(index + 1).padStart(2, '0')}`, purpose: 'LOCK_IN', difficulty: index < 3 ? 'MEDIUM' : 'HARD', cognitiveProcess: 'JUSTIFY', contextFamily, statement, correctAnswer, distractors: distractors, explanation: 'A resposta torna o argumento verificável, proporcional aos dados e responsável diante de limites e divergências.', hint, errorFocus }));

const review = [
  ['review-data', 'O que uma tabela fornece?', 'Dados organizados segundo categorias, medidas ou períodos definidos.', ['Uma causa automática.', 'Uma opinião universal.', 'Uma previsão certa.']],
  ['review-hypothesis', 'Uma hipótese deve ser:', 'Clara o bastante para ser confrontada com evidências.', ['Impossível de verificar.', 'Uma certeza final.', 'Uma frase sem relação com a pergunta.']],
  ['review-sample', 'Ao avaliar uma generalização, observe:', 'Quem foi pesquisado, quantas pessoas participaram e em qual contexto.', ['Somente o tamanho do título.', 'A cor do gráfico.', 'A confiança do autor sem método.']],
  ['review-source', 'Ler uma fonte criticamente envolve:', 'Considerar autoria, contexto, método, interesses e evidências apresentadas.', ['Aceitar ou rejeitar sem examinar.', 'Usar apenas a manchete.', 'Ignorar a data.']],
  ['review-correlation', 'Associação entre duas medidas:', 'Mostra que variaram juntas, mas não prova sozinha uma relação de causa.', ['Prova sempre a causa.', 'Não pode ser observada.', 'É igual a opinião.']],
  ['review-argument', 'Um argumento precisa ligar:', 'Afirmação, evidência e raciocínio.', ['Título, cor e opinião.', 'Causa, certeza e propaganda.', 'Pergunta, desenho e gosto.']],
  ['review-missing', 'Um dado ausente deve ser:', 'Indicado e analisado antes de ser interpretado.', ['Preenchido por qualquer valor.', 'Tratado como zero automaticamente.', 'Apagado sem registro.']],
  ['review-alternative', 'Uma explicação alternativa é:', 'Outra possibilidade que também pode explicar o padrão observado.', ['Um erro que deve ser ocultado.', 'Uma conclusão obrigatória.', 'Um dado sem relação.']],
  ['review-ethics', 'Ao usar relato de uma pessoa, proteja:', 'Identidade, uso autorizado e contexto necessário para não expor a pessoa.', ['Somente a estética.', 'A publicação do nome.', 'O dado pessoal sem limite.']],
  ['review-limit', 'Uma boa conclusão informa:', 'O que os dados sustentam e o que ainda não permitem afirmar.', ['Somente uma certeza.', 'Nenhuma limitação.', 'A opinião mais popular.']],
];
review.forEach(([contextFamily, statement, correctAnswer, distractors], index) => addQuestion({ id: `v8-hum-evidence-review-${String(index + 1).padStart(2, '0')}`, purpose: 'REVIEW', difficulty: index < 5 ? 'EASY' : 'MEDIUM', cognitiveProcess: 'RECALL_AND_APPLY', contextFamily, statement, correctAnswer, distractors, explanation: 'A revisão retoma a relação entre fonte, evidência, hipótese, argumento, ética e limite.', hint: 'Releia o papel da evidência na construção de uma conclusão.', errorFocus: 'Confundir dado, hipótese, causa e opinião.' }));

const purposeCounts = Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
const answerPositionCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map((letter, index) => [letter, questions.filter((question) => question.options.indexOf(question.correctAnswer) === index).length]));
const questionIds = questions.map((question) => question.id);
const pack = {
  packVersion: 'tec-escola-core-v5-question-first',
  contentVersion: 8,
  contentId: 'v8-humanities-evidence-arguments-hs',
  canonicalSkillCode: 'HUMANITIES_EVIDENCE_ARGUMENTS_HS',
  subject: 'HUMANITIES',
  domain: 'EVIDENCIAS_E_ARGUMENTOS',
  topic: 'hipóteses, evidências qualitativas e quantitativas e argumentos contextualizados',
  databasePackId: 'TECESCOLA_CORE_V5_QUESTION_FIRST',
  officialMappingStatus: 'NOT_CLAIMED',
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
  publicationStatus: 'STAGING_INACTIVE',
  contentAuthoringStatus: 'AUTHORED',
  expectedPurposeCounts: purposeCounts,
  expectedQuestionCount: questions.length,
  expectedContextCount: new Set(questions.map((question) => question.contextFamily)).size,
  expectedAnswerPositionCounts: answerPositionCounts,
  sourceContext: {
    officialCode: 'EM13CHS103',
    relation: 'AUTHORING_CONTEXT_ONLY',
    mappingStatus: 'CANONICAL_GAP',
    sourceStatus: 'OFFICIAL_SOURCE_CONTEXT_RECORDED_SOURCE_TEXT_REVIEW_REQUIRED',
    descriptor: 'Elaborar hipóteses, selecionar evidências e compor argumentos relativos a processos políticos, econômicos, sociais, ambientais, culturais e epistemológicos, com base na sistematização de dados e informações de natureza qualitativa e quantitativa.',
    officialSource: {
      id: 'BNCC_EI_EF_2018',
      documentVersion: 'BNCC Educação Infantil e Ensino Fundamental, versão final 2018',
      url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
      page: 560,
    },
    note: 'O descritor é usado como contexto de autoria; o vínculo canônico e a revisão do texto-fonte permanecem pendentes.',
  },
  lesson: {
    title: 'Da hipótese ao argumento: como usar evidências',
    objective: 'Elaborar hipóteses, selecionar evidências qualitativas e quantitativas e construir argumentos proporcionais ao contexto, aos métodos e aos limites dos dados.',
    summary: 'Um argumento não é apenas uma opinião acompanhada de um número. É preciso formular uma hipótese ou afirmação, identificar a fonte, entender como o dado foi produzido, explicar a relação e indicar o que a evidência não resolve. Fontes diferentes podem se complementar, divergir ou exigir investigação adicional.',
    progressiveExplanation: [
      'Comece pela pergunta e defina a afirmação que será examinada. Uma hipótese é provisória: deve ser clara o bastante para ser confrontada e revisada.',
      'Leia a fonte com contexto: autoria, data, população, unidade, escala, método e interesses. Uma tabela, entrevista, mapa e narrativa apresentam informações de naturezas diferentes.',
      'Selecione evidências relevantes e descreva o que elas mostram antes de explicar por quê. Diferencie associação de causalidade e procure variáveis que mudaram juntas.',
      'Componha o argumento em quatro partes: afirmação, evidência, raciocínio e limite. Para problemas complexos, combine fontes sem transformá-las em uma única medida.',
      'Comunique incertezas e revise o argumento quando aparecer evidência contrária. Proteger pessoas, registrar critérios e tornar fontes rastreáveis também faz parte da responsabilidade de argumentar.',
    ],
    workedExample: 'Uma escola quer avaliar se uma mudança no transporte reduziu faltas. A hipótese inicial é que o acesso melhorou. A equipe compara registros de faltas antes e depois, separa os dados por turma e período, consulta relatos de estudantes e verifica se houve outras mudanças no calendário ou na composição das turmas. O argumento pode dizer que as faltas diminuíram no período observado e que os relatos apontam o transporte como uma possível explicação, mas não deve afirmar causalidade exclusiva sem uma comparação adequada. A equipe registra limitações e propõe acompanhar os meses seguintes.',
    commonErrors: ['Tratar hipótese como conclusão.', 'Usar número sem unidade, período ou população.', 'Confundir associação com causa.', 'Escolher apenas a fonte que confirma a ideia.', 'Generalizar uma amostra pequena ou expor dados pessoais.'],
    remediations: [
      { id: 'ARGUMENT_PARTS', trigger: 'Apresenta opinião sem ligação com evidência', explanation: 'Use o roteiro afirmação, dado, raciocínio e limite.', workedExample: 'Afirmação: as faltas diminuíram. Dado: registros caíram de 18 para 11 no período. Raciocínio: a diferença aparece na comparação. Limite: outros fatores ainda não foram isolados.', selfCheck: 'Mostrei qual dado apoia a afirmação e até onde ele vale?' },
      { id: 'CAUSE_OR_ASSOCIATION', trigger: 'Conclui causa de duas mudanças simultâneas', explanation: 'Liste variáveis que mudaram juntas e indique que comparação diferenciaria as hipóteses.', workedExample: 'Se faltas e transporte mudaram ao mesmo tempo, verifique calendário, turmas e outros acessos antes de atribuir o efeito apenas ao transporte.', selfCheck: 'Minha conclusão reconhece outras explicações plausíveis?' },
      { id: 'SOURCE_CONTEXT', trigger: 'Compara fontes sem contexto', explanation: 'Registre autoria, data, população, método, unidade e interesses antes de juntar resultados.', workedExample: 'Uma entrevista descreve experiência; uma tabela conta ocorrências. Elas podem dialogar, mas não são a mesma medida.', selfCheck: 'Expliquei o que cada fonte realmente permite observar?' },
    ],
    everydayApplication: 'Ler notícias, gráficos, mapas, pesquisas escolares e relatos públicos, identificando evidências, limites, interesses e alternativas antes de formar uma opinião ou recomendar uma ação.',
    practiceGuidance: 'Peça sempre que o estudante marque fonte, unidade, período, população e critério. Em temas sensíveis, use dados fictícios ou anonimizados e não solicite informações pessoais identificáveis.',
    priorKnowledge: ['Ler tabelas, gráficos e textos informativos simples.', 'Distinguir afirmação de pergunta e reconhecer comparação.', 'Registrar uma fonte e identificar o período de um dado.'],
    keyConcepts: ['hipótese', 'afirmação', 'evidência', 'fonte', 'amostra', 'variável', 'associação', 'causalidade', 'argumento', 'limite e incerteza'],
    progression: [
      { stage: 'FOUNDATION', focus: 'Distinguir dados, hipóteses, tipos de fonte e partes do argumento.', questionIds: questionIds.slice(0, 8) },
      { stage: 'APPLICATION', focus: 'Interpretar fontes e construir comparações com contexto.', questionIds: questionIds.slice(8, 20) },
      { stage: 'TRANSFER', focus: 'Compor argumentos em problemas públicos, históricos, ambientais e sociais.', questionIds: questionIds.slice(20, 28) },
      { stage: 'INTEGRATION', focus: 'Revisar hipóteses, comunicar incerteza e proteger participantes.', questionIds: questionIds.slice(28, 34) },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Retomar fonte, evidência, causalidade e limites.', questionIds: questionIds.slice(34) },
    ],
    microExplanations: [
      { trigger: 'DATA_BEFORE_CAUSE', text: 'Descreva o padrão antes de atribuir uma causa.' },
      { trigger: 'SOURCE_CONTEXT', text: 'Sem população, período, unidade e método, o dado fica difícil de interpretar.' },
      { trigger: 'CLAIM_EVIDENCE_REASONING', text: 'O argumento precisa explicar por que o dado apoia a afirmação.' },
      { trigger: 'LIMIT_AND_UNCERTAINTY', text: 'Uma conclusão proporcional informa o que ainda não foi demonstrado.' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 40,
    sourceDossier: [{
      title: 'Base Nacional Comum Curricular: Ciências Humanas e Sociais Aplicadas',
      publisher: 'Ministério da Educação',
      url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
      page: 560,
      supports: ['Contexto oficial registrado para formular hipóteses, selecionar evidências e compor argumentos com dados qualitativos e quantitativos.'],
      use: 'Contexto de autoria; não representa aprovação de mapeamento canônico nem revisão pedagógica humana.',
    }],
    copyrightNote: 'Questões, exemplos e cenários são autorais. A fonte oficial orienta o contexto; a revisão do texto-fonte, o mapeamento canônico e a aprovação pedagógica permanecem pendentes.',
  },
  questions,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), questionCount: questions.length, purposeCounts, contextCount: pack.expectedContextCount }, null, 2));
