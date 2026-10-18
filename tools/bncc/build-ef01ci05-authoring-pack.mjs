import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_PATH = 'content/bncc/authoring/source-verification-v2.json';
const OFFICIAL_CODE = 'EF01CI05';
const OUTPUT = 'content/adaptive/tec-escola-core-v5/v1-science-time-scales-fi.json';

const rows = [
  ['PROBE','EASY','IDENTIFY','DAY_PARTS_ORDER','Uma rotina começa pela manhã, continua à tarde e termina à noite. Qual é a ordem apresentada?','Manhã, tarde e noite.',['Noite, manhã e tarde.','Tarde, noite e manhã.','Manhã, noite e tarde.'],'A sequência nomeia os três períodos diários na ordem usada na rotina.','Observe as partes do mesmo dia antes de pensar em dias diferentes.','REVERSE_DAY_PARTS'],
  ['PROBE','EASY','RELATE','MORNING_CLUE','O sol está surgindo e a criança está se preparando para a escola. Qual período do dia a situação representa?','Manhã.',['Tarde.','Noite.','Um mês.'],'A situação descreve o começo do dia, chamado manhã.','Procure o momento de início da rotina diária.','MISLABEL_DAY_PERIOD'],
  ['PROBE','EASY','IDENTIFY','WEEK_LENGTH','Como chamamos a sucessão de sete dias?','Uma semana.',['Uma noite.','Um mês.','Um ano.'],'Sete dias formam uma semana.','Conte a unidade que reúne vários dias.','CONFUSE_TIME_UNITS'],
  ['PROBE','EASY','IDENTIFY','YEAR_UNIT','Qual unidade reúne vários meses e marca uma volta completa do calendário anual?','Um ano.',['Uma manhã.','Uma semana.','Uma tarde.'],'O ano é uma escala maior que reúne meses no calendário.','Pense na unidade usada para comparar aniversários de um ano para outro.','CONFUSE_YEAR_WITH_DAY'],
  ['PRACTICE','EASY','SEQUENCE','AFTER_MONDAY','No calendário de uma semana, qual dia vem depois de segunda-feira?','Terça-feira.',['Domingo.','Sábado.','Sexta-feira.'],'A sucessão mostra terça-feira depois de segunda-feira.','Avance uma posição na sequência dos dias.','DAY_SEQUENCE_ERROR'],
  ['PRACTICE','EASY','SEQUENCE','BEFORE_FRIDAY','Qual dia vem imediatamente antes de sexta-feira na sequência semanal?','Quinta-feira.',['Sábado.','Domingo.','Terça-feira.'],'Quinta-feira ocupa a posição anterior à sexta-feira.','Volte uma posição a partir de sexta-feira.','DAY_SEQUENCE_ERROR'],
  ['PRACTICE','EASY','RELATE','SEVEN_DAY_CYCLE','Uma atividade acontece hoje e se repete depois de sete dias. Que unidade ajuda a descrever esse intervalo?','Uma semana.',['Uma manhã.','Um mês.','Um ano.'],'Sete dias correspondem a uma semana.','Relacione a quantidade de dias à unidade adequada.','CONFUSE_WEEK_WITH_MONTH'],
  ['PRACTICE','MEDIUM','COMPARE','MONTH_CALENDAR','Um calendário mostra muitos dias agrupados sob o nome de abril. O que esse agrupamento representa?','Um mês.',['Uma tarde.','Uma semana.','Um ano.'],'Abril é o nome de um mês que reúne vários dias no calendário.','Identifique o título que agrupa os dias.','CONFUSE_MONTH_WITH_WEEK'],
  ['PRACTICE','EASY','RELATE','AFTERNOON_ACTIVITY','A aula de arte ocorre depois do almoço e antes de escurecer. Qual período diário foi indicado?','Tarde.',['Manhã.','Noite.','Um ano.'],'A situação descreve a tarde, entre a manhã e a noite.','Use as pistas de posição dentro do dia.','MISLABEL_DAY_PERIOD'],
  ['PRACTICE','EASY','RELATE','NIGHT_ACTIVITY','A família lê uma história quando já está escuro e se prepara para dormir. Qual período aparece?','Noite.',['Manhã.','Tarde.','Uma semana.'],'Escuro e preparação para dormir são pistas da noite.','Pense no fim do dia.','MISLABEL_DAY_PERIOD'],
  ['PRACTICE','EASY','SEQUENCE','TOMORROW_FROM_TUESDAY','Se hoje é terça-feira, que dia será amanhã?','Quarta-feira.',['Segunda-feira.','Domingo.','Sábado.'],'Amanhã é o dia seguinte; depois de terça vem quarta-feira.','Avance apenas um dia.','CONFUSE_TOMORROW'],
  ['PRACTICE','EASY','SEQUENCE','YESTERDAY_FROM_THURSDAY','Se hoje é quinta-feira, que dia foi ontem?','Quarta-feira.',['Sexta-feira.','Domingo.','Terça-feira.'],'Ontem é o dia anterior; antes de quinta vem quarta-feira.','Volte apenas um dia.','CONFUSE_YESTERDAY'],
  ['PRACTICE','MEDIUM','SEQUENCE','MONTH_ORDER','No calendário, qual mês vem depois de março?','Abril.',['Janeiro.','Dezembro.','Fevereiro.'],'Abril vem imediatamente depois de março na sucessão dos meses.','Avance um mês, não um dia.','MONTH_SEQUENCE_ERROR'],
  ['PRACTICE','MEDIUM','SEQUENCE','YEAR_SUCCESSION','Uma criança compara o calendário de 2025 com o seguinte. Qual ano vem depois de 2025?','2026.',['2024.','2025.','2035.'],'A sucessão anual avança de 2025 para 2026.','Pense no próximo ano, não no anterior.','YEAR_SEQUENCE_ERROR'],
  ['PRACTICE','MEDIUM','RELATE','SCHOOL_WEEK','Uma turma planeja atividades de segunda a sexta. Qual escala está sendo usada principalmente?','Dias de uma semana.',['Períodos de uma única manhã.','Meses de um ano.','Séculos.'],'A proposta organiza dias que pertencem a uma semana escolar.','Veja se a sequência cobre vários dias próximos.','CONFUSE_WEEK_WITH_DAY_PART'],
  ['PRACTICE','MEDIUM','COMPARE','DAY_VS_MONTH','Qual afirmação compara corretamente dia e mês?','Um mês reúne vários dias.',['Um dia sempre reúne doze meses.','Um mês é menor que uma manhã.','Dia e mês são exatamente a mesma unidade.'],'O mês é uma escala mais ampla que agrupa dias.','Compare o tamanho das unidades do calendário.','REVERSE_TIME_SCALE'],
  ['TRANSFER','MEDIUM','PLAN','DAILY_ROUTINE_CARDS','A turma recebe cartões de acordar, almoçar e dormir. Como organizá-los em uma rotina diária comum?','Acordar pela manhã, almoçar à tarde e dormir à noite.',['Dormir pela manhã, acordar à noite e almoçar antes de acordar.','Almoçar à noite, dormir à tarde e acordar depois.','Acordar depois de dormir e colocar todos no mesmo período sem sequência.'],'A organização usa períodos do dia e a ordem da rotina apresentada.','Combine cada ação com seu período e depois ordene.','IGNORE_DAY_SEQUENCE'],
  ['TRANSFER','MEDIUM','COMPARE','TWO_WEEK_CALENDARS','Dois calendários mostram a mesma semana começando na segunda-feira, mas com atividades diferentes. O que permanece igual?','A sucessão dos dias da semana.',['O nome das atividades.','O mês inteiro.','O horário de cada pessoa.'],'As tarefas podem mudar, mas a unidade semana continua com sua sucessão de dias.','Separe a estrutura do calendário do conteúdo das atividades.','CONFUSE_EVENTS_WITH_TIME_SCALE'],
  ['TRANSFER','MEDIUM','APPLY','MONTH_BOUNDARY','Uma sequência mostra 30 de abril e depois 1º de maio. O que aconteceu?','Começou outro mês depois do último dia mostrado de abril.',['Começou outra semana no mesmo dia sem mudar o mês.','O dia voltou para 1º de abril.','Passou um ano inteiro.'],'A sequência atravessa a passagem de um mês para outro.','Observe os nomes dos meses antes e depois.','MISS_MONTH_TRANSITION'],
  ['TRANSFER','MEDIUM','SEQUENCE','CALENDAR_CARDS','Os cartões são “quarta-feira”, “sexta-feira” e “quinta-feira”. Qual ordem respeita a sucessão?','Quarta-feira, quinta-feira e sexta-feira.',['Sexta-feira, quarta-feira e quinta-feira.','Quinta-feira, sexta-feira e quarta-feira.','Quarta-feira, sexta-feira e quinta-feira.'],'A sequência correta coloca quinta entre quarta e sexta.','Procure o cartão que completa o intervalo.','DAY_SEQUENCE_ERROR'],
  ['TRANSFER','MEDIUM','EXPLAIN','SCHOOL_EVENT_MONTH','Um cartaz diz que uma feira acontecerá em outubro. O que essa informação identifica?','O mês em que a feira acontecerá.',['O período diário exato da feira.','O nome de todos os dias do ano.','A duração obrigatória de um ano.'],'O nome outubro localiza o evento em um mês, mas não informa sozinho o dia ou o horário.','Não confunda mês com dia e período diário.','OVERREAD_MONTH_INFORMATION'],
  ['TRANSFER','MEDIUM','COMPARE','DAY_PARTS_AND_DAYS','Qual diferença está correta entre “noite” e “terça-feira”?','Noite é um período do dia; terça-feira é um dia da semana.',['Noite é um mês e terça-feira é uma estação.','As duas palavras nomeiam o mesmo período.','Terça-feira é uma parte menor da noite.'],'As palavras pertencem a escalas diferentes: parte do dia e dia da semana.','Classifique cada palavra pela escala que nomeia.','MIX_SCALES'],
  ['TRANSFER','HARD','PLAN','YEAR_TIMELINE','Uma turma cria uma linha do tempo com “ano passado”, “este ano” e “ano que vem”. Qual ordem é adequada?','Ano passado, este ano e ano que vem.',['Ano que vem, ano passado e este ano.','Este ano, ano que vem e ano passado.','Ano passado, ano que vem e este ano sem considerar o presente.'],'A linha do tempo parte do passado, passa pelo presente e segue para o futuro próximo.','Use o presente como referência central.','REVERSE_YEAR_SEQUENCE'],
  ['TRANSFER','HARD','APPLY','CALENDAR_LOOKUP','Para descobrir em qual dia da semana cai uma data, qual recurso ajuda?','Consultar um calendário organizado.',['Escolher um período do dia ao acaso.','Contar apenas os meses sem olhar os dias.','Usar o nome de um ano como se fosse um dia.'],'Um calendário relaciona datas e dias da semana de modo organizado.','Escolha o recurso que mostra a relação entre as unidades.','USE_WRONG_CALENDAR_SCALE'],
  ['LOCK_IN','MEDIUM','DISTINGUISH','PERIOD_VS_SEQUENCE','Qual frase usa corretamente as duas ideias de tempo?','A manhã é um período do dia, e a semana reúne dias em sucessão.',['A manhã reúne doze meses, e a semana é parte da noite.','A semana é um instante dentro da manhã, e o mês é um gesto.','A noite é um ano, e a tarde é uma semana.'],'A resposta distingue período diário e unidade que organiza vários dias.','Verifique a escala de cada termo.','MIX_SCALES'],
  ['LOCK_IN','MEDIUM','EXPLAIN','TWELVE_MONTHS','Por que os nomes dos meses ajudam a acompanhar um ano?','Porque os meses organizam a sucessão de partes do ano.',['Porque cada mês é um período de uma única manhã.','Porque mês e dia significam exatamente a mesma coisa.','Porque o nome de um mês informa sozinho o horário de um evento.'],'Meses são unidades do calendário que organizam a passagem do ano.','Pense na relação entre mês e ano.','CONFUSE_MONTH_ROLE'],
  ['LOCK_IN','MEDIUM','SEQUENCE','WEEKEND_BOUNDARY','Se uma atividade ocorre no domingo e a próxima ocorre na segunda-feira seguinte, o que mudou?','Começou outra semana na sucessão apresentada.',['Passou um mês necessariamente.','Começou uma noite dentro da mesma hora.','O ano terminou obrigatoriamente.'],'A sequência de dias passou do domingo para a segunda-feira, iniciando outra semana.','Observe a sucessão semanal, não invente uma mudança maior.','OVERSTATE_TIME_JUMP'],
  ['LOCK_IN','HARD','JUSTIFY','EVIDENCE_LIMITS_TIME','Um cartão diz apenas “à tarde”. O que ainda falta para localizar completamente uma atividade no calendário?','A data ou o dia em que ela acontece.',['O nome de uma cor.','O nome de todos os anos futuros.','Uma característica física da pessoa.'],'O período diário não informa sozinho o dia do calendário.','Separe parte do dia de data e dia da semana.','TREAT_PERIOD_AS_DATE'],
  ['LOCK_IN','HARD','COMPARE','MONTH_AND_YEAR','Qual afirmação explica a relação entre mês e ano sem dizer que são iguais?','Um ano é organizado por uma sucessão de meses.',['Um ano é menor que um mês.','Um mês contém todos os anos.','Mês e ano são apenas nomes para a mesma duração.'],'O ano é uma escala maior que pode ser acompanhada por seus meses.','Procure a unidade que organiza a outra.','REVERSE_MONTH_YEAR'],
  ['LOCK_IN','HARD','APPLY','TIME_SCALE_CHOICE','Para planejar uma apresentação que acontecerá daqui a três semanas, qual informação é mais adequada?','Usar a sequência de semanas e consultar os dias do calendário.',['Escolher somente manhã ou noite.','Usar o nome de um mês sem verificar os dias.','Contar como se três semanas fossem três anos.'],'O planejamento exige uma unidade de semanas e a conferência dos dias concretos.','Escolha a escala indicada e depois localize a data.','CHOOSE_WRONG_SCALE'],
  ['REVIEW','EASY','IDENTIFY','REVIEW_MORNING','Qual palavra nomeia um período do dia em que muitas rotinas começam?','Manhã.',['Semana.','Mês.','Ano.'],'Manhã é um dos períodos diários.','Escolha entre as palavras da escala diária.','MISLABEL_DAY_PERIOD'],
  ['REVIEW','EASY','IDENTIFY','REVIEW_AFTERNOON','Qual palavra completa a sequência “manhã, ___, noite”?','Tarde.',['Semana.','Ano.','Abril.'],'Tarde fica entre manhã e noite na sequência de períodos diários.','Complete a sequência do mesmo dia.','REVERSE_DAY_PARTS'],
  ['REVIEW','EASY','SEQUENCE','REVIEW_TOMORROW','Se hoje é sábado, qual é o dia seguinte?','Domingo.',['Sexta-feira.','Quinta-feira.','Terça-feira.'],'Domingo vem depois de sábado na sucessão semanal.','Amanhã é apenas um passo adiante.','CONFUSE_TOMORROW'],
  ['REVIEW','EASY','SEQUENCE','REVIEW_YESTERDAY','Se hoje é segunda-feira, qual foi o dia anterior?','Domingo.',['Terça-feira.','Quarta-feira.','Sábado.'],'Domingo vem antes de segunda-feira na sucessão semanal.','Ontem é apenas um passo para trás.','CONFUSE_YESTERDAY'],
  ['REVIEW','MEDIUM','IDENTIFY','REVIEW_WEEK','Qual unidade é formada pela sucessão de dias?','Semana.',['Tarde.','Mês.','Noite.'],'A semana organiza uma sucessão de dias.','Compare a resposta com a unidade que reúne dias.','CONFUSE_WEEK_WITH_DAY_PART'],
  ['REVIEW','MEDIUM','IDENTIFY','REVIEW_MONTH','Qual palavra nomeia uma unidade do calendário maior que uma semana e menor que um ano?','Mês.',['Manhã.','Noite.','Dia.'],'O mês reúne muitos dias e faz parte da organização do ano.','Pense nas unidades entre semana e ano.','CONFUSE_MONTH_SCALE'],
  ['REVIEW','MEDIUM','SEQUENCE','REVIEW_MONTH_ORDER','Qual mês vem depois de junho?','Julho.',['Maio.','Abril.','Dezembro.'],'Julho é o mês seguinte a junho.','Avance um lugar na sequência anual.','MONTH_SEQUENCE_ERROR'],
  ['REVIEW','MEDIUM','SEQUENCE','REVIEW_YEAR_ORDER','Qual ano vem antes de 2030?','2029.',['2031.','2030.','2020.'],'A sucessão imediatamente anterior a 2030 é 2029.','Volte um ano na linha do tempo.','YEAR_SEQUENCE_ERROR'],
  ['REVIEW','HARD','JUSTIFY','REVIEW_CALENDAR_LIMIT','Um calendário mostra que uma reunião será na sexta-feira, mas não mostra o horário. O que podemos afirmar?','O dia da semana está indicado, mas o período diário ainda não.',['A reunião será necessariamente à noite.','A reunião durará um ano.','A reunião acontecerá em todos os meses.'],'A informação permite localizar o dia da semana, não inventar horário ou duração.','Use somente a evidência disponível no calendário.','INFER_UNSTATED_TIME'],
  ['REVIEW','HARD','COMPARE','REVIEW_ALL_SCALES','Qual opção apresenta uma sequência coerente de escalas, da menor indicada para a maior?','Manhã, dia, semana, mês, ano.',['Ano, mês, semana, dia, manhã.','Semana, manhã, ano, dia, mês.','Mês, ano, manhã, semana, dia.'],'A sequência vai de um período dentro do dia para unidades cada vez mais amplas do calendário.','Compare as unidades antes de ordená-las.','REVERSE_TIME_SCALE'],
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function buildQuestions() {
  return rows.map(([purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, hint, errorFocus], index) => {
    const answerIndex = index % 4;
    const options = [...distractors];
    options.splice(answerIndex, 0, correctAnswer);
    return {
      id: `v1-science-time-scales-fi-${String(index + 1).padStart(2, '0')}`,
      purpose, difficulty, cognitiveProcess, contextFamily, statement, options, correctAnswer, explanation, hint, errorFocus,
      misconceptions: Object.fromEntries(distractors.map((distractor) => [distractor, [errorFocus]])),
    };
  });
}

function buildPack() {
  const source = readJson(SOURCE_PATH).records.find((record) => record.officialCode === OFFICIAL_CODE);
  if (!source) throw new Error(`SOURCE_VERIFICATION_NOT_FOUND:${OFFICIAL_CODE}`);
  const questions = buildQuestions();
  const questionIds = questions.map((question) => question.id);
  return {
    packVersion: 'tec-escola-core-v5-question-first',
    contentVersion: 1,
    lessonVersion: 1,
    contentId: 'v1-science-time-scales-fi',
    canonicalSkillCode: 'AUTHORING_EF01CI05_TIME_SCALES',
    subject: 'SCIENCE',
    domain: 'TERRA_E_UNIVERSO',
    topic: 'períodos diários e sucessão de dias, semanas, meses e anos',
    databasePackId: 'TECESCOLA_CORE_V5_QUESTION_FIRST',
    officialMappingStatus: 'NOT_CLAIMED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING_INACTIVE',
    active: false,
    contentAuthoringStatus: 'AUTHORED',
    expectedPurposeCounts: { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 },
    expectedQuestionCount: 40,
    expectedContextCount: 40,
    expectedAnswerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    sourceContext: {
      officialCode: source.officialCode,
      relation: 'AUTHORING_CONTEXT_ONLY',
      mappingStatus: source.mappingStatus,
      sourceStatus: source.technicalVerificationStatus,
      descriptor: source.descriptor,
      officialSource: source.officialSource,
      note: 'Conteúdo autoral contextualizado para EF01CI05; o mapeamento canônico e a revisão pedagógica continuam pendentes.',
    },
    sourceReconciliation: {
      sourceQuestionCount: 0,
      feedbackAdded: 0,
      sourceReconciliationStatus: 'ORIGINAL_AUTHORING_CONTEXT',
      newQuestions: questions.length,
      reusedQuestionsCountedAsNew: false,
    },
    lesson: {
      title: 'Organizar o tempo em diferentes escalas',
      objective: 'Identificar e nomear manhã, tarde e noite e acompanhar a sucessão de dias, semanas, meses e anos em situações de calendário e rotina.',
      summary: 'Um dia pode ser observado em períodos como manhã, tarde e noite. Os dias se sucedem e podem ser organizados em semanas, meses e anos; cada escala responde a uma pergunta diferente.',
      explanation: '## Partes do dia\nManhã, tarde e noite são períodos usados para localizar acontecimentos dentro de um dia. Uma rotina pode começar pela manhã, continuar à tarde e terminar à noite, mas nem toda atividade segue a mesma rotina.\n\n## Sucessão dos dias\nDias têm uma ordem: depois de terça vem quarta, e antes de sexta vem quinta. As palavras ontem, hoje e amanhã dependem do dia escolhido como referência.\n\n## Semanas, meses e anos\nUma semana organiza uma sucessão de dias. Os meses reúnem dias no calendário e ajudam a acompanhar a passagem do ano. Um ano é uma escala mais ampla organizada por meses. Não confunda o nome de um mês com o horário ou o dia exato de um evento.\n\n## Exemplo resolvido\nSe hoje é terça-feira e uma atividade acontecerá daqui a uma semana, ela será novamente na terça-feira da semana seguinte. Para saber a data concreta, é preciso consultar o calendário; a informação “à tarde” ainda seria necessária para localizar o período dentro do dia.',
      workedExample: 'Organize os cartões “acordar”, “almoçar” e “dormir” como manhã, tarde e noite. Depois use um calendário fictício para marcar segunda, terça e quarta. Explique que a primeira sequência usa partes do dia e a segunda usa dias sucessivos.',
      commonMistake: 'Tratar manhã, semana e ano como unidades equivalentes; confundir ontem e amanhã; concluir um horário a partir apenas do nome do mês; ou afirmar uma duração que o calendário não informa.',
      tips: ['Classifique primeiro a escala: parte do dia, dia, semana, mês ou ano.', 'Use ontem, hoje e amanhã a partir de uma referência explícita.', 'Avance ou volte uma posição por vez ao ordenar dias e meses.', 'Consulte o calendário quando uma pergunta exigir uma data concreta.', 'Não invente horário, duração ou frequência que não foram informados.'],
      priorKnowledge: ['Ordenar acontecimentos simples de uma rotina.', 'Reconhecer antes, depois e agora.', 'Ler nomes de dias e meses com apoio visual.'],
      keyConcepts: ['manhã, tarde e noite', 'sucessão', 'ontem, hoje e amanhã', 'semana', 'mês', 'ano', 'calendário', 'escala de tempo'],
      progression: [
        { stage: 'FOUNDATION', focus: 'Nomear períodos do dia e reconhecer unidades básicas.', questionIds: questionIds.slice(0, 4) },
        { stage: 'APPLICATION', focus: 'Ordenar dias e meses em situações de calendário.', questionIds: questionIds.slice(4, 16) },
        { stage: 'TRANSFER', focus: 'Aplicar diferentes escalas para organizar rotinas e eventos.', questionIds: questionIds.slice(16, 24) },
        { stage: 'INTEGRATION', focus: 'Justificar a escala adequada e respeitar limites da informação.', questionIds: questionIds.slice(24, 30) },
        { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Retomar períodos, sucessões e relações entre escalas.', questionIds: questionIds.slice(30) },
      ],
      microExplanations: [
        { trigger: 'MIX_SCALES', text: 'Manhã, tarde e noite são períodos dentro do dia; semana, mês e ano organizam sucessões mais amplas.' },
        { trigger: 'SEQUENCE_REFERENCE', text: 'Ontem é o dia anterior e amanhã é o seguinte, sempre a partir do dia usado como referência.' },
        { trigger: 'CALENDAR_EVIDENCE_LIMIT', text: 'Um mês ou um dia da semana não informa sozinho o horário ou a duração de uma atividade.' },
      ],
      remediations: [
        { misconception: 'MIX_SCALES', prompt: 'Separe cartões em cinco grupos: período do dia, dia, semana, mês e ano; explique por que cada cartão pertence ao grupo.' },
        { misconception: 'DAY_SEQUENCE_ERROR', prompt: 'Use uma faixa de dias e avance ou volte uma casa a partir de uma referência explícita.' },
        { misconception: 'INFER_UNSTATED_TIME', prompt: 'Marque o que o calendário informa e escreva uma pergunta sobre o que ainda falta saber.' },
      ],
      authenticActivities: [{
        id: 'time-scale-calendar-map',
        title: 'Mapa de escalas do calendário',
        objective: 'Organizar cartões de períodos do dia, dias da semana, meses e anos e justificar qual escala responde a cada pergunta.',
        context: 'Atividade mediada pelo professor com calendário de estudo fictício, cartões de rotina e uma linha do tempo sem datas pessoais.',
        materials: ['Calendário fictício impresso', 'Cartões com manhã, tarde e noite', 'Cartões com dias e meses', 'Fita ou quadro para montar sequências'],
        instructions: 'Em grupos, organize uma rotina diária e depois monte uma sequência de dias e meses usando o calendário fictício. Para cada situação, indique a escala usada e registre uma informação que ainda não pode ser concluída. Não usar datas de nascimento, endereços ou compromissos reais de estudantes.',
        evidence: 'Registro que ordena períodos e unidades de tempo, nomeia a escala usada e distingue evidência disponível de informação ausente.',
        safety: 'Usar exemplos fictícios e permitir que o estudante participe por fala, desenho, cartões ou outra forma acessível.',
        privacyGuard: 'Não coletar aniversários, rotinas familiares, localização ou outros dados pessoais; trabalhar somente com calendário inventado.',
        ageRange: '1º ano do Ensino Fundamental, com leitura e mediação docente.',
        mediation: 'O professor oferece referências visuais, pergunta qual escala está sendo usada e não exige exposição de rotina pessoal.',
        rubric: [
          { criterion: 'Nomeação e sucessão', emerging: 'Mistura períodos e unidades sem ordenar.', developing: 'Ordena parte da sequência com apoio.', proficient: 'Nomeia períodos e organiza sucessões de dias e meses com justificativa.' },
          { criterion: 'Escolha da escala', emerging: 'Usa mês para responder a qualquer pergunta.', developing: 'Escolhe uma escala adequada após mediação.', proficient: 'Relaciona pergunta, evidência e escala sem inventar horário ou duração.' },
          { criterion: 'Participação e segurança', emerging: 'Usa dados reais de colegas.', developing: 'Aceita exemplos fictícios após orientação.', proficient: 'Mantém o calendário fictício e oferece formas acessíveis de participação.' },
        ],
      }],
      estimatedMinutes: 30,
      reviewWindowsDays: [1, 3, 7],
      reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
      sourceDossier: [{ title: source.officialSource.documentVersion, publisher: 'MEC/CNE', url: source.officialSource.url, page: source.officialSource.page, accessedOn: source.evidenceCheckedAt, supports: ['períodos diários', 'sucessão de dias', 'semanas, meses e anos'], use: 'Fonte oficial usada para rastreabilidade do descritor; os cenários, questões e atividade são autorais.' }],
      copyrightNote: 'Situações, alternativas, explicações e atividade são autorais e hipotéticas; o descritor oficial permanece apenas como contexto de autoria.',
    },
    questions,
  };
}

function validatePack(pack) {
  const errors = [];
  if (pack.sourceContext?.officialCode !== OFFICIAL_CODE) errors.push('SOURCE_CONTEXT_CODE_INVALID');
  if (pack.sourceContext?.relation !== 'AUTHORING_CONTEXT_ONLY') errors.push('AUTHORING_RELATION_INVALID');
  if (pack.officialMappingStatus !== 'NOT_CLAIMED') errors.push('MAPPING_MUST_REMAIN_UNCLAIMED');
  if (pack.publicationStatus !== 'STAGING_INACTIVE' || pack.active !== false) errors.push('PUBLICATION_MUST_REMAIN_INACTIVE');
  const ids = new Set();
  const contexts = new Set();
  for (const question of pack.questions ?? []) {
    if (ids.has(question.id)) errors.push(`DUPLICATE_ID:${question.id}`);
    ids.add(question.id);
    if (contexts.has(question.contextFamily)) errors.push(`DUPLICATE_CONTEXT:${question.contextFamily}`);
    contexts.add(question.contextFamily);
    if (!Array.isArray(question.options) || question.options.length !== 4 || new Set(question.options).size !== 4 || !question.options.includes(question.correctAnswer)) errors.push(`OPTIONS_INVALID:${question.id}`);
    if (!question.statement || !question.explanation || !question.hint || !question.errorFocus) errors.push(`FEEDBACK_INCOMPLETE:${question.id}`);
  }
  if (pack.questions.length !== 40 || contexts.size !== 40) errors.push(`QUESTION_OR_CONTEXT_COUNT:${pack.questions.length}:${contexts.size}`);
  if (!pack.lesson?.title || !pack.lesson?.objective || !pack.lesson?.explanation || pack.lesson.authenticActivities?.length < 1) errors.push('LESSON_OR_ACTIVITY_INCOMPLETE');
  return { valid: errors.length === 0, errors, questionCount: pack.questions.length, contextCount: contexts.size };
}

export function buildEf01Ci05Pack() { return buildPack(); }
export function validateEf01Ci05Pack(pack) { return validatePack(pack); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pack = buildPack();
  const validation = validatePack(pack);
  if (!validation.valid) throw new Error(`EF01CI05_PACK_INVALID:${validation.errors.join(',')}`);
  fs.writeFileSync(path.join(ROOT, OUTPUT), `${JSON.stringify(pack, null, 2)}\n`);
  console.log(JSON.stringify({ ...validation, output: OUTPUT, publicationStatus: pack.publicationStatus, officialMappingStatus: pack.officialMappingStatus }, null, 2));
}
