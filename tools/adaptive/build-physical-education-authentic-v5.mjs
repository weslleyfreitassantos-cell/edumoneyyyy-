import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const sourceDossier = [
  { title: 'WHO Guidelines on Physical Activity and Sedentary Behaviour: Glossary of Terms', publisher: 'World Health Organization', url: 'https://www.ncbi.nlm.nih.gov/books/NBK566047/', accessedOn: '2026-10-13', supports: ['Exercício é subcategoria de atividade física planejada, estruturada e repetitiva com propósito definido.'], use: 'Checagem conceitual para diferenciar atividade física e exercício; enunciados, exemplos e atividades deste pacote são autorais.' },
  { title: 'WHO Guidelines on Physical Activity and Sedentary Behaviour: Children and Adolescents', publisher: 'World Health Organization', url: 'https://www.who.int/publications/i/item/9789240015128', accessedOn: '2026-10-13', supports: ['Atividade física juvenil pode ocorrer em lazer, educação física, transporte e tarefas; oportunidades devem ser seguras, equitativas, agradáveis e adequadas à idade e capacidade.'], use: 'Fundamenta variedade, segurança e acessibilidade; não é usado para prescrever dose ou rotina individual.' },
  { title: 'Guia de Atividade Física para a População Brasileira', publisher: 'Ministério da Saúde', url: 'https://bvsms.saude.gov.br/bvs/publicacoes/guia_atividade_fisica_populacao_brasileira.pdf', accessedOn: '2026-10-13', supports: ['Orientações brasileiras para atividade física e exercício, inclusive crianças e jovens; distinção de que exercício é uma forma planejada de atividade física.'], use: 'Referência pública para contexto e linguagem; os pacotes não reproduzem o guia nem formulam recomendação clínica.' }
];

function q(id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, hint, errorFocus, tags, index) {
  const answerIndex = index % 4;
  const options = [...distractors];
  options.splice(answerIndex, 0, correctAnswer);
  const misconceptions = Object.fromEntries(options.flatMap((option, optionIndex) => optionIndex === answerIndex ? [] : [[option, [tags[optionIndex < answerIndex ? optionIndex : optionIndex - 1]]]]));
  return { id, purpose, difficulty, cognitiveProcess, contextFamily, statement, options, correctAnswer, explanation, hint, errorFocus, misconceptions };
}

function packBase({ contentId, skill, domain, title, objective, summary, explanation, workedExample, commonMistake, questions, activity, microExplanations, remediations }) {
  const purposeCounts = { PROBE: 1, PRACTICE: 2, TRANSFER: 1, LOCK_IN: 1, REVIEW: 1 };
  const idsFor = (purpose) => questions.filter((item) => item.purpose === purpose).map((item) => item.id);
  const correctPositions = Object.fromEntries(['A', 'B', 'C', 'D'].map((position, index) => [position, questions.filter((item) => item.options.indexOf(item.correctAnswer) === index).length]));
  return {
    packVersion: 'tec-escola-core-v5-question-first',
    contentVersion: 5,
    contentId,
    canonicalSkillCode: skill,
    subject: 'PHYSICAL_EDUCATION',
    domain,
    topic: title.toLocaleLowerCase('pt-BR'),
    databasePackId: 'TECESCOLA_CORE_V5_QUESTION_FIRST',
    officialMappingStatus: 'NOT_CLAIMED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING',
    contentAuthoringStatus: 'AUTHORED',
    expectedPurposeCounts: purposeCounts,
    expectedQuestionCount: 6,
    expectedContextCount: 6,
    expectedAnswerPositionCounts: correctPositions,
    lesson: {
      title,
      objective,
      summary,
      explanation,
      workedExample,
      commonMistake,
      tips: ['Observe o contexto e o propósito, não apenas o nome do movimento.', 'Planeje opções seguras e acessíveis com mediação do professor.', 'A atividade digital verifica compreensão e planejamento, não aptidão física.'],
      priorKnowledge: ['Reconhecer movimentos corporais em situações cotidianas.', 'Descrever espaço, regras e escolhas em uma atividade.'],
      keyConcepts: ['Atividade física é uma categoria ampla de movimento.', 'Exercício físico é planejado, estruturado e repetido com propósito.', 'Segurança, acesso, escolha e adaptação fazem parte do planejamento.'],
      progression: [
        { stage: 'FOUNDATION', focus: 'Identificar o contexto, o planejamento e o propósito de uma situação.', questionIds: [idsFor('PROBE')[0], idsFor('PRACTICE')[0]] },
        { stage: 'APPLICATION', focus: 'Planejar uma opção e justificar cuidados e adaptações.', questionIds: [idsFor('PRACTICE')[1], idsFor('TRANSFER')[0], idsFor('LOCK_IN')[0]] },
        { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Revisar uma proposta diante de um novo contexto ou barreira.', questionIds: idsFor('REVIEW') }
      ],
      microExplanations,
      remediations,
      authenticActivities: [activity],
      reviewWindowsDays: [1, 3, 7],
      reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
      estimatedMinutes: 25,
      sourceDossier,
      copyrightNote: 'Questões e propostas de atividade são autorais. Fontes oficiais fundamentam conceitos e salvaguardas, mas não equivalem a validação do percurso ou aprovação curricular. Mapeamento e revisão pedagógica permanecem pendentes.'
    },
    questions
  };
}

const distinguishQuestions = [
  q('v5-pe-distinguish-probe-01','PROBE','EASY','CLASSIFY','GARDEN_POT_ARRANGING','Durante uma atividade escolar, uma estudante organiza vasos leves na horta, sem seguir um plano de treino. Como classificar o movimento descrito?','É atividade física; não há evidência de exercício planejado.',['É exercício físico estruturado obrigatoriamente.','Não é atividade física porque não houve competição.','É treinamento de força.'],'O movimento corporal pode ser atividade física. A descrição não informa plano, estrutura, repetição e propósito de exercício.','Procure movimento e depois verifique se a situação também foi planejada e estruturada.','Exigir plano ou competição para reconhecer atividade física',['NO_PLAN_NO_ACTIVITY','COMPETITION_REQUIRED','GARDEN_WORK_IS_STRENGTH_TRAINING'],0),
  q('v5-pe-distinguish-practice-01','PRACTICE','MEDIUM','DISTINGUISH','REHEARSED_MOVEMENT','Uma turma repete uma sequência de movimentos com objetivo de praticar coordenação, sob orientação docente. Qual leitura é mais precisa?','É atividade física e pode ser exercício planejado, pois há estrutura, repetição e propósito.',['Não é atividade física porque a sequência tem regras.','Só é exercício se houver competição.','É apenas lazer porque não usa equipamento.'],'A situação contém movimento e uma organização repetida com objetivo; equipamento ou competição não são requisitos para a categoria.','Observe a estrutura, a repetição e o objetivo descritos.','Reduzir exercício a esporte competitivo ou equipamento',['RULES_EXCLUDE_ACTIVITY','COMPETITION_DEFINES_EXERCISE','EQUIPMENT_REQUIRED'],1),
  q('v5-pe-distinguish-transfer-01','TRANSFER','MEDIUM','PLAN','SCHOOL_ROUTE_CHOICES','Uma escola quer oferecer movimento em um dia de chuva. Qual proposta distingue uma atividade cotidiana de uma opção planejada e considera o contexto?','Mapear deslocamentos seguros no espaço interno e oferecer uma sequência opcional com objetivo, adaptações e supervisão.',['Mandar todos correrem no corredor molhado para cumprir uma meta.','Dizer que só uma aula competitiva conta como movimento.','Exigir que cada estudante conte quanto se movimenta em casa.'],'A proposta observa opções no contexto escolar e estrutura uma possibilidade planejada sem obrigar nem coletar dados pessoais.','Considere espaço, supervisão, escolha e uma alternativa acessível.','Ignorar contexto, segurança ou privacidade',['UNSAFE_CORRIDOR','COMPETITION_ONLY','PERSONAL_ACTIVITY_DISCLOSURE'],2),
  q('v5-pe-distinguish-lock-01','LOCK_IN','HARD','REPAIR','PLANNED_MOBILITY_SEQUENCE','Um estudante afirma: “Sem aparelhos, não pode ser exercício”. Como corrigir a ideia?','Uma sequência de movimentos pode ser exercício se for planejada, estruturada, repetida e tiver propósito; equipamento não é obrigatório.',['Todo movimento é exercício, mesmo sem organização.','Só aparelhos de academia definem exercício.','Exercício exige medir o desempenho de cada colega.'],'O critério está na organização e no propósito, não em aparelhos ou competição. A avaliação da aula não precisa medir corpos.','Retire o aparelho da explicação e confira se os critérios de planejamento continuam presentes.','Confundir exercício com academia ou teste de desempenho',['GYM_EQUIPMENT_REQUIRED','ALL_MOVEMENT_IS_EXERCISE','BODY_TEST_REQUIRED'],3),
  q('v5-pe-distinguish-review-01','REVIEW','HARD','EVALUATE','PLAY_AND_PRACTICE','Um grupo brinca espontaneamente de lançar uma bola; em outra aula, pratica lançamentos repetidos com um objetivo definido pelo professor. Qual conclusão é melhor?','Ambas envolvem atividade física; a segunda também pode ser exercício planejado.',['A brincadeira não envolve atividade física porque não tem plano.','A prática só é exercício se alguém vencer.','As duas situações são idênticas em organização e propósito.'],'O tipo de movimento pode ser parecido, mas o contexto e o planejamento diferem. A brincadeira continua sendo atividade física.','Compare o movimento com o modo como cada situação foi organizada.','Ignorar contexto ou reduzir exercício à competição',['PLAY_NOT_ACTIVITY','WINNER_REQUIRED','CONTEXT_IRRELEVANT'],4),
  q('v5-pe-distinguish-practice-02','PRACTICE','MEDIUM','CLASSIFY','BREAKTIME_DANCE','No intervalo, um grupo dança espontaneamente ao ouvir uma música. O que a descrição permite afirmar?','É atividade física; não há informação suficiente para dizer que seja exercício planejado.',['Não é atividade física porque não foi uma aula.','É exercício estruturado porque existe música.','Só conta como movimento se houver coreografia avaliada.'],'Dançar envolve movimento e pode ser atividade física. A presença de música não demonstra, sozinha, planejamento, estrutura e propósito de exercício.','Separe a atividade observada da organização que não foi descrita.','Inferir exercício planejado a partir de música ou avaliação',['MUSIC_MEANS_EXERCISE','SCHOOL_LESSON_REQUIRED','ASSESSMENT_REQUIRED'],5)
];

const distinguish = packBase({
  contentId: 'pe-distinguish-activity-exercise',
  skill: 'PE_DISTINGUISH_ACTIVITY_EXERCISE_FII',
  domain: 'ATIVIDADE_E_EXERCICIO',
  title: 'Atividade física e exercício: observar contexto e propósito',
  objective: 'Distinguir movimento cotidiano de exercício planejado e propor alternativas de participação considerando escolha, acesso e segurança.',
  summary: 'Atividade física inclui movimentos em diferentes situações. Exercício é uma forma planejada, estruturada e repetida com propósito. A mesma ação pode aparecer em contextos diferentes. Compreender essa distinção não exige teste corporal nem comparação de aptidão.',
  explanation: '## Movimento em muitos contextos\nCaminhar para chegar a um lugar, brincar, dançar ou participar de uma aula podem envolver atividade física. A categoria é ampla e não depende de competição.\n\n## Quando falamos em exercício\nExercício é uma subcategoria: há planejamento, estrutura, repetição e um propósito. Um movimento cotidiano pode também fazer parte de exercício quando é organizado com esses elementos. Observe a situação inteira, não apenas o nome do movimento.\n\n## Planejar sem excluir\nUma proposta escolar precisa considerar espaço, supervisão, escolha e formas diferentes de participação. Não prescreva intensidade individual, não compare corpos e não exija que alguém revele saúde, deficiência ou rotina. Uma atividade escrita ou desenhada pode ser uma alternativa equivalente à demonstração de movimento.\n\n## Exemplo resolvido\nSubir escadas para chegar à sala envolve atividade física, mas a descrição não informa um plano de exercício. Em uma aula, uma sequência de movimentos repetida com propósito definido pode ser exercício e também atividade física. Para a turma, o professor verifica espaço seguro, alternativas e participação voluntária.',
  workedExample: 'Pergunta: uma turma se movimenta livremente numa festa e, em outra aula, pratica uma sequência repetida com objetivo combinado. Passo 1: note que as duas situações envolvem movimento. Passo 2: procure planejamento, estrutura, repetição e propósito. Passo 3: classifique a segunda também como exercício planejado, sem dizer que a festa “não conta” como atividade física.',
  commonMistake: 'Tratar atividade física e exercício como sinônimos perfeitos; exigir academia ou competição; transformar uma resposta sobre conceitos em diagnóstico ou medida de aptidão.',
  questions: distinguishQuestions,
  microExplanations: [
    { trigger: 'MOVEMENT_IS_BROAD', text: 'Atividade física pode ocorrer em transporte, brincadeira, lazer e aula; competição não é requisito.' },
    { trigger: 'EXERCISE_IS_PLANNED', text: 'Procure planejamento, estrutura, repetição e propósito para identificar exercício.' },
    { trigger: 'SAME_MOVEMENT_DIFFERENT_CONTEXT', text: 'O contexto pode mudar a classificação; compare como e por que a ação foi organizada.' },
    { trigger: 'NO_BODY_TEST', text: 'Esta tarefa avalia raciocínio sobre situações, não força, velocidade, saúde ou aptidão do estudante.' }
  ],
  remediations: [
    { id: 'pe-distinguish-remediate-context', misconception: 'CONTEXT_IGNORED', prompt: 'Descreva primeiro o movimento; depois marque se havia plano, estrutura, repetição e propósito. Reavalie a classificação.' },
    { id: 'pe-distinguish-remediate-competition', misconception: 'COMPETITION_REQUIRED', prompt: 'Pense em uma brincadeira sem vencedor e em uma sequência orientada sem competição. Que elementos, além de competir, ajudam a classificar exercício?' },
    { id: 'pe-distinguish-remediate-equipment', misconception: 'EQUIPMENT_REQUIRED', prompt: 'Retire os equipamentos do cenário e verifique se ainda existe uma sequência planejada e repetida com propósito.' }
  ],
  activity: {
    id: 'v5-pe-distinguish-movement-context-lab',
    title: 'Movimento, contexto e escolha',
    objective: 'Classificar situações fictícias e planejar uma opção de movimento com alternativas voluntárias e acessíveis.',
    context: 'Investigação em pequenos grupos com cartões de situações cotidianas e propostas de aula preparadas pelo educador.',
    materials: ['Cartões fictícios de situações de movimento', 'Quadro “atividade física”, “exercício planejado” e “o que falta saber”', 'Folha para desenhar uma proposta com duas formas de participação'],
    instructions: 'Classifique cartões justificando a decisão por movimento, planejamento, estrutura, repetição e propósito. Depois crie uma proposta curta para a escola com uma opção de movimento e uma alternativa equivalente sentada, observacional ou desenhada. Se houver demonstração, ela é voluntária, supervisionada e pode ser substituída pela representação em papel. Não medir desempenho nem pedir relatos sobre corpos, saúde ou rotina familiar.',
    evidence: 'Quadro de classificação com justificativas, proposta com duas formas de participação e anotação de uma condição de segurança ou acesso.',
    safety: 'Qualquer vivência corporal depende de espaço e supervisão docente, é voluntária e pode ser substituída por alternativa equivalente. Não aplicar teste de aptidão, comparar resultados, prescrever exercício individual ou pedir diagnóstico/atestado como conteúdo da aula.',
    privacyGuard: 'Não coletar peso, medidas, frequência cardíaca, diagnóstico, deficiência, imagens, rotina de movimento ou dados de saúde dos estudantes.',
    ageRange: '6º e 7º anos do Ensino Fundamental, com mediação docente.',
    mediation: 'O professor contextualiza os exemplos, verifica condições locais e garante alternativa sem movimento. A rubrica observa classificação, justificativa, acesso e segurança, não habilidade atlética.',
    rubric: [
      { criterion: 'Distinção conceitual', emerging: 'Confunde toda atividade física com exercício planejado.', developing: 'Identifica movimento e planejamento com perguntas de apoio.', proficient: 'Justifica a classificação usando contexto, organização e propósito.' },
      { criterion: 'Justificativa', emerging: 'Baseia a resposta em competição ou equipamento como regra.', developing: 'Nomeia um critério adequado após orientação.', proficient: 'Usa critérios pertinentes e identifica informação ausente quando necessário.' },
      { criterion: 'Acesso e participação', emerging: 'Propõe uma única forma obrigatória.', developing: 'Adiciona alternativa após mediação.', proficient: 'Inclui escolhas equivalentes e condição de segurança sem medir aptidão.' }
    ]
  }
});

const safePlanQuestions = [
  q('v5-pe-safe-plan-probe-01','PROBE','EASY','IDENTIFY_HAZARD','CLEAR_SPACE','Antes de uma atividade de movimento, o grupo encontra mochilas espalhadas no espaço. Qual é o primeiro cuidado?','Parar o início, organizar o espaço com o professor e confirmar uma área livre.',['Começar depressa para terminar antes.','Pedir que alguém desvie dos obstáculos enquanto o grupo se move.','Ignorar as mochilas se a atividade for curta.'],'Um espaço obstruído pode causar tropeços; a turma deve organizar a área com supervisão antes de iniciar.','Observe primeiro o espaço e peça apoio docente para retirar obstáculos.','Ignorar risco ambiental em favor de começar logo',['START_WITH_OBSTACLES','INDIVIDUAL_AVOIDANCE_ONLY','SHORT_MEANS_SAFE'],0),
  q('v5-pe-safe-plan-practice-01','PRACTICE','MEDIUM','CHOOSE_OPTION','SCHOOL_ACTIVITY_SPACE','A quadra está fechada e a turma quer se movimentar em outro local da escola. Que plano considera melhor o contexto?','Escolher com o professor uma área livre e supervisionada, com opções e pausas combinadas.',['Usar um corredor estreito com circulação de outras turmas.','Exigir que todos mantenham o mesmo ritmo.','Continuar mesmo quando alguém pede pausa.'],'Área, circulação, supervisão e escolha precisam ser verificadas antes da atividade.','Confira espaço, pessoas circulando, alternativas e como pedir pausa.','Ignorar circulação, escolha e sinais de desconforto',['NARROW_BUSY_CORRIDOR','ONE_PACE_FOR_ALL','NO_PAUSE'],1),
  q('v5-pe-safe-plan-transfer-01','TRANSFER','MEDIUM','ADAPT','WEATHER_CHANGE','Uma proposta ao ar livre não pode ocorrer por causa da chuva. Qual é uma revisão segura do plano?','Escolher com o educador uma alternativa interna adequada ou adiar, verificando espaço e acesso.',['Usar o piso molhado para uma corrida.','Mover a atividade sem verificar o novo local.','Cancelar toda atividade de movimento para sempre.'],'Mudar de espaço exige reavaliar piso, circulação, supervisão e acessibilidade; adiar pode ser uma escolha adequada.','Reavalie as condições antes de transferir a atividade para outro lugar.','Supor que o plano continua seguro após mudar o ambiente',['WET_FLOOR_RUN','NO_NEW_SPACE_CHECK','NEVER_MOVE_AGAIN'],2),
  q('v5-pe-safe-plan-lock-01','LOCK_IN','HARD','RESPOND_TO_SIGNAL','DIZZINESS_SIGNAL','Durante uma atividade, uma pessoa relata tontura. Qual resposta é apropriada na aula?','Interromper a participação dela, avisar o professor e seguir o protocolo de segurança da escola.',['Mandar continuar até o fim para não atrasar o grupo.','Pedir aos colegas que descubram a causa médica.','Transformar a situação em disputa para ver quem aguenta mais.'],'Tontura pede pausa e comunicação ao adulto responsável; colegas não devem diagnosticar nem pressionar a pessoa.','Priorize parar e avisar o professor, sem tentar diagnosticar.','Desempenho sobreposto à segurança ou diagnóstico entre pares',['PUSH_THROUGH_SIGNAL','PEER_DIAGNOSIS','ENDURANCE_CONTEST'],3),
  q('v5-pe-safe-plan-review-01','REVIEW','HARD','REVISE_PLAN','ACCESS_ALTERNATIVE','Um plano prevê uma única atividade em pé, mas a escola precisa oferecer participação por diferentes meios. Qual revisão melhora o plano?','Consultar o grupo e preparar opções equivalentes, como versão sentada, observação ativa ou registro da estratégia.',['Manter a regra para todos, sem exceção.','Retirar da atividade quem não fizer do modo original.','Pedir que cada pessoa explique sua condição de saúde para a turma.'],'Opções equivalentes ampliam participação; não é necessário exigir divulgação de informação pessoal.','Troque uma forma única por escolhas que preservem o objetivo pedagógico.','Confundir uniformidade com equidade e exigir exposição',['ONE_FORM_FOR_ALL','EXCLUDE_DIFFERENCE','FORCED_HEALTH_DISCLOSURE'],4),
  q('v5-pe-safe-plan-practice-02','PRACTICE','MEDIUM','ORGANIZE_MATERIALS','SHARED_EQUIPMENT','Uma turma tem poucos materiais para uma atividade planejada. Qual ajuste considera participação e segurança?','Organizar estações ou turnos com espaço livre, regras claras e alternativas para quem aguarda.',['Lançar os materiais todos ao mesmo tempo em um espaço apertado.','Excluir quem não conseguiu pegar o material primeiro.','Aumentar a velocidade para que a turma termine logo.'],'Turnos e espaço organizado reduzem colisões e permitem participação; o professor verifica se a proposta é adequada ao local.','Pense em circulação, espera e opção de participação antes de aumentar o ritmo.','Confundir pressa e competição com organização segura',['CROWDED_EQUIPMENT','FIRST_COMES_EXCLUDED','SPEED_OVER_SAFETY'],5)
];

const safePlan = packBase({
  contentId: 'pe-plan-safe-activity',
  skill: 'PE_PLAN_SAFE_ACTIVITY',
  domain: 'SAUDE',
  title: 'Planejar atividades de movimento com segurança e acesso',
  objective: 'Planejar uma proposta escolar de movimento que considere espaço, supervisão, escolha, adaptação, pausa e resposta a sinais de desconforto.',
  summary: 'Um plano seguro começa pelo contexto: espaço, circulação, materiais, supervisão e alternativas. A turma não precisa seguir um único ritmo nem expor informações de saúde. A experiência física é mediada pelo professor; a atividade digital trabalha planejamento, sem prescrever exercício pessoal ou avaliar aptidão.',
  explanation: '## Comece pelo ambiente\nAntes de uma proposta, observe piso, obstáculos, circulação, materiais, clima e supervisão. Uma mudança de local exige nova checagem: o plano não continua automaticamente seguro em qualquer espaço.\n\n## Planeje escolhas e adaptações\nUma proposta acessível permite formas diferentes de participação e uma alternativa equivalente, como observar e registrar estratégias. Pergunte sobre a atividade, não sobre diagnóstico, peso, condição de saúde ou rotina familiar. Ninguém deve ser pressionado a demonstrar movimento.\n\n## Combine comunicação e pausas\nO professor explica como pedir pausa e como chamar ajuda. Se alguém relata mal-estar, interrompe a participação e comunica o adulto responsável, seguindo o protocolo da escola; colegas não diagnosticam. Esta lição não prescreve intensidade, duração ou tratamento individual.\n\n## Exemplo resolvido\nA quadra está indisponível. O grupo não ocupa automaticamente o corredor: consulta o professor, verifica uma sala livre, circulação, piso e acessibilidade, propõe opções e combina sinal de pausa. Se nenhum espaço for adequado, adiar é uma decisão segura.',
  workedExample: 'Revise um plano de caminhada quando começa a chover. 1) Pare antes de transferir a atividade. 2) Consulte o professor. 3) Verifique piso, circulação e acessibilidade do espaço alternativo. 4) Ofereça opção equivalente e possibilidade de adiamento. 5) Registre a razão da escolha sem atribuir culpa a participantes.',
  commonMistake: 'Achar que uma atividade é segura apenas porque é curta; transferir o plano sem rever o espaço; impor ritmo igual; interpretar pausas como falta de esforço; pedir que estudantes revelem informações pessoais para receber uma adaptação.',
  questions: safePlanQuestions,
  microExplanations: [
    { trigger: 'CHECK_ENVIRONMENT', text: 'Antes de começar ou mudar de espaço, confira piso, obstáculos, circulação, materiais e supervisão.' },
    { trigger: 'ACCESS_IS_PART_OF_PLAN', text: 'Planeje mais de uma forma de participar; escolha e acessibilidade não são exceções improvisadas.' },
    { trigger: 'PAUSE_AND_TELL_ADULT', text: 'Diante de mal-estar, pare a participação e avise o professor. Não peça que colegas façam diagnóstico.' },
    { trigger: 'NO_PERSONAL_HEALTH_DISCLOSURE', text: 'Uma adaptação não deve exigir que o estudante exponha diagnóstico ou histórico de saúde à turma.' }
  ],
  remediations: [
    { id: 'pe-safe-remediate-space', misconception: 'ENVIRONMENT_IGNORED', prompt: 'Faça uma lista de espaço, piso, obstáculos, circulação e supervisão. Marque o que o professor precisa verificar antes de decidir.' },
    { id: 'pe-safe-remediate-uniformity', misconception: 'ONE_FORM_FOR_ALL', prompt: 'Escreva duas opções equivalentes de participação e escolha uma que não exija explicar informações de saúde.' },
    { id: 'pe-safe-remediate-signal', misconception: 'PUSH_THROUGH_SIGNAL', prompt: 'Reordene as ações: parar, comunicar o adulto responsável e seguir o protocolo escolar. Retire diagnósticos e pressão por desempenho.' }
  ],
  activity: {
    id: 'v5-pe-safe-activity-plan-audit',
    title: 'Revisão de segurança e participação',
    objective: 'Produzir e revisar um plano escolar de movimento com checagem do ambiente, alternativa acessível e comunicação de pausa.',
    context: 'Planejamento em grupo a partir de um cenário fictício de aula, com implementação opcional somente se o professor avaliar o espaço e autorizar.',
    materials: ['Mapa simples ou desenho de um espaço escolar fictício', 'Cartões de mudanças de contexto (chuva, circulação, material indisponível)', 'Quadro de checagem de acesso, supervisão, pausa e alternativas'],
    instructions: 'Escolha um cenário fictício e desenhe um plano de movimento. Marque obstáculos, circulação, supervisão, materiais, uma alternativa equivalente e como qualquer participante pode pedir pausa. Em seguida, sorteie uma mudança de contexto e revise o plano. O professor decide se alguma vivência é apropriada; ela é voluntária e substituível por planejamento em papel. Não registrar esforço, medidas corporais, saúde ou desempenho individual.',
    evidence: 'Plano visual revisado com condições verificadas, duas formas de participação, regra clara de pausa/comunicação e justificativa da decisão de realizar, adaptar ou adiar.',
    safety: 'Não executar atividade sem aprovação docente do espaço, materiais e condições locais. Evitar obstáculos, competição de resistência, prescrição de intensidade e qualquer exigência de participação corporal. Seguir os protocolos escolares e interromper ao receber relato de desconforto.',
    privacyGuard: 'Não coletar diagnóstico, deficiência, peso, medidas, frequência cardíaca, sintomas, imagens, rotina de exercício ou justificativas familiares. O aluno pode usar um cenário inteiramente fictício.',
    ageRange: '6º e 7º anos do Ensino Fundamental, com mediação docente.',
    mediation: 'O professor valida o contexto local antes de qualquer execução, assegura alternativas equivalentes e avalia a qualidade do planejamento, não a aptidão ou disposição física dos estudantes.',
    rubric: [
      { criterion: 'Leitura do contexto e riscos', emerging: 'Não identifica mudança no ambiente ou obstáculos relevantes.', developing: 'Identifica um fator de segurança com orientação.', proficient: 'Verifica ambiente, circulação, materiais e supervisão antes de decidir.' },
      { criterion: 'Acesso e escolhas', emerging: 'Prevê uma forma obrigatória de participação.', developing: 'Acrescenta alternativa após mediação.', proficient: 'Prevê opções equivalentes e preserva escolha sem exigir divulgação de saúde.' },
      { criterion: 'Pausa e revisão', emerging: 'Pressiona a continuidade diante de desconforto.', developing: 'Inclui pausa depois de pergunta orientadora.', proficient: 'Define como parar e comunicar o adulto, e revisa ou adia o plano quando o contexto muda.' }
    ]
  }
});

export function buildPhysicalEducationAuthenticPacks() { return { distinguish, safePlan }; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packs = buildPhysicalEducationAuthenticPacks();
  const outputs = [
    ['physical-activity-exercise.json', packs.distinguish],
    ['physical-safe-activity.json', packs.safePlan]
  ];
  for (const [file, pack] of outputs) writeFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v5', file), `${JSON.stringify(pack, null, 2)}\n`);
  process.stdout.write(`Built ${outputs.length} practical-evidence packs and ${outputs.reduce((sum, [, pack]) => sum + pack.questions.length, 0)} conceptual checks.\n`);
}
