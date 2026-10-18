import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const stageToPurpose = { FOUNDATION: 'PROBE', APPLICATION: 'PRACTICE', TRANSFER: 'TRANSFER', INTEGRATION: 'LOCK_IN', SPACED_REVIEW_CANDIDATE: 'REVIEW' };
const purposeAt = (index) => index < 5 ? 'PROBE' : index < 20 ? 'PRACTICE' : index < 32 ? 'TRANSFER' : index < 40 ? 'LOCK_IN' : 'REVIEW';
const processFor = {
  PROBE: ['IDENTIFY', 'DISTINGUISH', 'COMPARE'],
  PRACTICE: ['COMPARE', 'INTERPRET', 'ANALYZE'],
  TRANSFER: ['SYNTHESIZE', 'EVALUATE', 'APPLY'],
  LOCK_IN: ['EVALUATE', 'REVISE_CLAIM'],
  REVIEW: ['SYNTHESIZE', 'EVALUATE', 'TRANSFER'],
};
const withAnswerAt = (correct, distractors, index) => {
  const options = [...distractors];
  options.splice(index % 4, 0, correct);
  return options;
};

const items = [
  { label: 'groups', context: 'Uma cidade reúne pessoas que nasceram nela e pessoas que chegaram de outras cidades ou regiões.', question: 'O que essa situação permite identificar?', correct: 'Que diferentes grupos populacionais podem formar a cidade e estabelecer relações no mesmo espaço.', criterion: 'Identificar grupos exige observar trajetórias, relações e o espaço compartilhado, sem tratar a origem como explicação única.', transfer: 'Aplique a leitura a um bairro que recebeu novas famílias ao longo do tempo.', overclaim: 'afirmar que toda pessoa da cidade tem a mesma origem', evidence: 'origens mencionadas, lugar de moradia e relações descritas', nextStep: 'listar os grupos apresentados e a relação entre eles', limit: 'os grupos efetivamente descritos no caso', comparison: 'trajetórias de chegada e permanência na cidade', refine: 'quais grupos aparecem e que evidência mostra sua presença?', distractors: ['Concluir que todos os moradores chegaram no mesmo ano.', 'Dizer que origem diferente impede qualquer relação.', 'Usar apenas o nome da cidade para descobrir a história de cada morador.'] },
  { label: 'migration', context: 'Uma família deixa uma área rural e passa a morar na cidade em busca de trabalho e serviços.', question: 'Como interpretar esse deslocamento?', correct: 'Como um fenômeno migratório que pode alterar a vida da família e as relações entre espaços rurais e urbanos.', criterion: 'Migração descreve deslocamento e mudança de residência; suas causas e efeitos precisam ser sustentados pelo contexto.', transfer: 'Compare o caso com uma família que se desloca temporariamente para estudar.', overclaim: 'dizer que toda migração ocorre pela mesma causa', evidence: 'origem, destino, permanência e motivo informado', nextStep: 'separar o fato do deslocamento das hipóteses sobre suas consequências', limit: 'a trajetória e o motivo registrados no caso', comparison: 'vida rural, vida urbana e condições de deslocamento', refine: 'o texto informa mudança permanente ou apenas viagem?', distractors: ['Toda viagem é migração definitiva.', 'Mudar para a cidade apaga a origem rural da família.', 'A causa de um deslocamento vale para todos os migrantes.'] },
  { label: 'relations', context: 'Moradores antigos e recém-chegados organizam uma feira e negociam horários para usar a praça.', question: 'Que relação entre grupos está evidenciada?', correct: 'Uma relação de convivência e negociação, pois grupos diferentes constroem uma prática comum.', criterion: 'Relações entre grupos podem envolver cooperação, conflito ou negociação; não devem ser inventadas além do registro.', transfer: 'Aplique o critério a uma associação de bairro com participantes de origens diversas.', overclaim: 'confundir uma atividade conjunta com ausência de diferenças', evidence: 'atividade compartilhada, decisões e participantes mencionados', nextStep: 'identificar a ação comum e as negociações que a tornaram possível', limit: 'a situação de convivência descrita', comparison: 'diferenças de trajetória e acordo sobre uso do espaço', refine: 'que parte do relato mostra negociação?', distractors: ['A feira prova que os grupos têm histórias idênticas.', 'Grupos diferentes não conseguem organizar ações comuns.', 'Uma praça pertence automaticamente a um único grupo.'] },
  { label: 'event', context: 'Uma estrada foi aberta e, alguns anos depois, novas moradias e comércios surgiram ao seu redor.', question: 'Como tratar esse processo?', correct: 'Como uma transformação que pode ter contribuído para a formação da área, sem afirmar que foi a única causa.', criterion: 'Eventos que marcam a formação de um lugar devem ser relacionados a evidências e a outros processos possíveis.', transfer: 'Aplique o cuidado à chegada de uma estação, escola ou serviço público.', overclaim: 'atribuir toda a formação do bairro a um único evento', evidence: 'data da estrada, surgimento de moradias e outros fatores indicados', nextStep: 'organizar a sequência e procurar o que mais mudou no período', limit: 'a contribuição do evento para o processo observado', comparison: 'infraestrutura, moradia e comércio em momentos diferentes', refine: 'o que mudou depois da estrada e o que ainda não foi explicado?', distractors: ['A estrada explica automaticamente todos os acontecimentos posteriores.', 'A área não mudou porque o texto não informa cada morador.', 'Uma sequência no tempo prova uma causa única.'] },
  { label: 'environment', context: 'A retirada de parte da vegetação abriu espaço para casas, mas também aumentou a erosão em um terreno próximo.', question: 'Que aspecto histórico do lugar deve ser relacionado?', correct: 'A transformação ambiental às formas de ocupação e às consequências produzidas ao longo do tempo.', criterion: 'Desmatamento e ocupação podem integrar a história de uma região quando a relação é sustentada por registros.', transfer: 'Analise outra mudança no uso da terra e seus efeitos para grupos locais.', overclaim: 'descrever a mudança ambiental como fenômeno sem relação com a vida das pessoas', evidence: 'vegetação retirada, novas casas e erosão observada', nextStep: 'comparar o uso anterior e posterior do terreno e quem foi afetado', limit: 'os efeitos registrados no terreno próximo', comparison: 'ocupação do espaço e transformação ambiental', refine: 'qual mudança no lugar e qual consequência foram observadas?', distractors: ['Toda retirada de vegetação produz exatamente o mesmo efeito.', 'O ambiente não faz parte da história de uma região.', 'A construção de casas não altera relações com o território.'] },
  { label: 'company', context: 'Uma empresa instalou uma fábrica, contratou trabalhadores e aumentou o movimento de ônibus no município.', question: 'Que evento pode marcar a formação do município?', correct: 'A instalação da empresa pode ser um dos eventos que transformaram trabalho, circulação e ocupação do espaço.', criterion: 'Grandes empresas podem alterar relações locais, mas a análise deve considerar período, grupos envolvidos e outros fatores.', transfer: 'Aplique o método a uma usina, porto ou centro de distribuição.', overclaim: 'dizer que a empresa sozinha criou toda a cidade', evidence: 'instalação, empregos, circulação e mudanças espaciais descritas', nextStep: 'separar mudanças observadas de efeitos que ainda precisam de evidência', limit: 'os efeitos indicados no município', comparison: 'atividade econômica, trabalho e circulação', refine: 'quais mudanças foram registradas diretamente?', distractors: ['A empresa explica a origem de todas as famílias do município.', 'Mais ônibus prova que todos apoiaram a instalação.', 'Um evento econômico não pode fazer parte da história local.'] },
  { label: 'memory', context: 'Uma moradora antiga relata que a praça era usada para festas; um mapa atual mostra que a área foi reduzida.', question: 'Como combinar as fontes?', correct: 'Relacionar a memória à experiência de uso e o mapa à configuração espacial atual, sem tratar uma fonte como substituta da outra.', criterion: 'Memória e mapa registram dimensões diferentes e devem ser situados no tempo e no espaço.', transfer: 'Compare um relato de bairro com fotografias ou mapas de épocas distintas.', overclaim: 'usar uma memória para medir com precisão o tamanho atual da praça', evidence: 'época do relato, uso mencionado, escala e data do mapa', nextStep: 'registrar o que cada fonte sustenta e o que exige outra evidência', limit: 'a experiência da moradora e o mapa disponível', comparison: 'uso social da praça e forma espacial registrada', refine: 'qual fonte informa uso e qual informa configuração?', distractors: ['O mapa atual prova que a memória é falsa.', 'A memória mede a área sem necessidade de escala.', 'Fontes diferentes não podem ser comparadas.'] },
  { label: 'diversity', context: 'Um levantamento escolar registra estudantes de diferentes regiões do país, e uma entrevista descreve hábitos alimentares de uma família.', question: 'Que conclusão é proporcional?', correct: 'Reconhecer a diversidade de origens do grupo e tratar os hábitos como experiência daquela família, não de todas as regiões.', criterion: 'Diversidade populacional não autoriza generalizar uma prática familiar para um grupo inteiro.', transfer: 'Aplique o cuidado a relatos sobre festas, idiomas, comidas ou formas de trabalho.', overclaim: 'transformar um hábito familiar em característica de toda uma região', evidence: 'alcance do levantamento, identidade da família e prática descrita', nextStep: 'separar dado agregado de exemplo localizado', limit: 'o grupo levantado e a família entrevistada', comparison: 'origens registradas e experiência particular', refine: 'qual informação fala do conjunto e qual fala de uma pessoa?', distractors: ['Uma família representa todas as famílias de sua região.', 'Dados de origem tornam relatos familiares inválidos.', 'Diversidade significa que nenhuma comparação é possível.'] },
  { label: 'change', context: 'Fotografias de décadas diferentes mostram a mesma rua com menos casas e, depois, com prédios e linhas de ônibus.', question: 'O que a comparação sustenta?', correct: 'Que a rua passou por mudanças na ocupação e na circulação, embora as fotografias não expliquem sozinhas todas as causas.', criterion: 'Comparar imagens exige observar elementos visíveis, datas e limites do que elas permitem concluir.', transfer: 'Use o procedimento para comparar uma praça, estrada ou margem de rio em tempos distintos.', overclaim: 'inventar a causa da mudança apenas olhando o resultado final', evidence: 'datas, casas, prédios e ônibus visíveis nas imagens', nextStep: 'descrever diferenças observáveis antes de propor explicações', limit: 'as transformações visíveis na rua', comparison: 'ocupação e circulação em dois períodos', refine: 'o que está na imagem e o que depende de outra fonte?', distractors: ['As fotografias revelam automaticamente as intenções dos moradores.', 'A rua não mudou porque o nome permaneceu igual.', 'Qualquer causa pode ser afirmada sem fonte adicional.'] },
  { label: 'synthesis', context: 'Um município recebeu migrantes, abriu uma estrada e teve uma área desmatada para novas moradias.', question: 'Como escrever uma síntese histórica cuidadosa?', correct: 'Relacionar os eventos e seus efeitos registrados, indicar que são processos distintos e evitar afirmar uma causa única sem evidência.', criterion: 'Uma síntese deve integrar grupos, deslocamentos e transformações do espaço sem apagar diferenças ou preencher lacunas.', transfer: 'Produza uma síntese semelhante para a formação de outro bairro com fontes fornecidas pelo docente.', overclaim: 'reduzir a formação do município a um único grupo ou evento', evidence: 'migração, estrada, desmatamento, moradias e períodos informados', nextStep: 'organizar os processos em uma linha do tempo e atribuir cada afirmação à fonte', limit: 'os eventos e efeitos efetivamente documentados', comparison: 'grupos populacionais e transformações territoriais', refine: 'quais relações são observadas e quais ainda são hipóteses?', distractors: ['Escolher apenas o evento mais recente e ignorar os demais.', 'Afirmar que todos os moradores viveram os mesmos efeitos.', 'Uma síntese não precisa indicar fonte nem período.'] },
];

function makeQuestion({ item, caseIndex, variant }) {
  const index = caseIndex * 5 + variant;
  const purpose = purposeAt(index);
  const variants = [
    [item.question, item.correct],
    ['Que critério deve orientar a leitura?', `Considere ${item.criterion}`],
    ['Como transferir esse raciocínio?', item.transfer],
    ['Qual conclusão deve ser evitada?', `Evite ${item.overclaim}.`],
    ['Que evidência deve ser conferida primeiro?', `Confira ${item.evidence}.`],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v31-history-population-groups-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 5 ? 'EASY' : index < 25 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V31_HISTORY_POPULATION_GROUPS_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A leitura histórica preserva o recorte da evidência e relaciona grupos, deslocamentos e transformações sem forçar uma causa única. ${item.criterion}`,
    hint: 'Separe o que foi observado, quem aparece no registro, em que período e qual conclusão ainda depende de outra fonte.',
    errorFocus: 'HISTORY_POPULATION_GROUPS_SCOPE_AND_CAUSATION',
    misconceptions: { [item.distractors[0]]: ['HISTORY_POPULATION_GROUPS_SCOPE_AND_CAUSATION'] },
  };
}

function main() {
  const sourcePath = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v29-history-compare-perspectives-expansion-v29.json');
  const previous = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const newQuestions = items.flatMap((item, caseIndex) => Array.from({ length: 5 }, (_, variant) => makeQuestion({ item, caseIndex, variant })));
  const questions = [...previous.questions, ...newQuestions];
  const expectedPurposeCounts = Object.fromEntries(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
  const expectedAnswerPositionCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map((label, position) => [label, questions.filter((question) => question.options.indexOf(question.correctAnswer) === position).length]));
  const newIdsByPurpose = new Map(PURPOSES.map((purpose) => [purpose, newQuestions.filter((question) => question.purpose === purpose).map((question) => question.id)]));
  const progression = (previous.lesson.progression ?? []).map((stage) => ({ ...stage, questionIds: [...(stage.questionIds ?? []), ...(newIdsByPurpose.get(stageToPurpose[stage.stage]) ?? [])] }));
  const pack = {
    ...previous,
    contentId: 'v31-history-population-groups',
    contentVersion: 31,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 31),
    expectedQuestionCount: questions.length,
    expectedContextCount: questions.length,
    expectedPurposeCounts,
    expectedAnswerPositionCounts,
    publicationStatus: 'STAGING',
    contentAuthoringStatus: 'AUTHORED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    officialMappingStatus: 'NOT_CLAIMED',
    sourceContext: {
      officialCode: 'EF03HI01',
      sourceVerificationRecord: 'BNCC_EF03HI01_MEC_P413_V1',
      proposalId: 'V8_PROPOSAL_ENSINO_FUNDAMENTAL_03_HI_IDENTIFICAR_GRUPOS_POPULACIONAIS',
      mappingStatus: 'CANONICAL_GAP',
      relation: 'AUTHORING_CONTEXT_ONLY',
      relationDecision: 'NOT_ASSERTED',
      authoringPurpose: 'Desenvolver materiais autorais sobre grupos populacionais, migração e formação do município para revisão humana.',
      evidenceBoundary: 'O pacote não declara que o código oficial corresponde à skill canônica; a proposta permanece pendente.',
    },
    lesson: {
      ...previous.lesson,
      title: 'Grupos populacionais e formação do município',
      objective: 'Relacionar grupos populacionais, migrações e eventos de transformação do município, distinguindo evidência, interpretação e hipótese.',
      summary: 'A história local reúne trajetórias de pessoas, relações entre grupos e mudanças no território. O estudo compara fontes e limita conclusões ao que elas registram.',
      explanation: `${previous.lesson.explanation}\n\n## Grupos, deslocamentos e território\nObserve quem aparece no registro, de onde veio, que relações estabeleceu e quais mudanças ocorreram no espaço. Migração, abertura de vias, instalação de empresas e desmatamento podem participar da formação de um município, mas cada relação precisa de evidência e de período definidos.`,
      workedExample: 'Uma fotografia mostra novas casas depois da abertura de uma estrada e uma entrevista relata a chegada de famílias. A síntese pode relacionar circulação, moradia e migração como processos documentados, mas não pode afirmar que a estrada foi a única causa sem fontes adicionais.',
      microExplanations: [
        ...(previous.lesson.microExplanations ?? []),
        { trigger: 'GROUPS_AND_RELATIONS', text: 'Identifique os grupos e as relações registradas antes de generalizar sobre a população.' },
        { trigger: 'MIGRATION_RECUT', text: 'Diferencie deslocamento, origem, destino, permanência e motivo informado.' },
        { trigger: 'TERRITORY_CHANGE', text: 'Descreva a transformação do espaço e só depois avalie possíveis causas.' },
      ],
      remediations: [
        ...(previous.lesson.remediations ?? []),
        { id: 'MAP_GROUPS_AND_EVENTS', misconception: 'Misturar grupos, eventos e consequências em uma única afirmação.', prompt: 'Monte uma tabela com grupo, evento, período, evidência e limite antes de escrever a síntese.' },
        { id: 'AVOID_SINGLE_CAUSE', misconception: 'Atribuir a formação do município a um único evento.', prompt: 'Liste processos simultâneos e indique qual fonte sustenta cada relação.' },
      ],
      authenticActivities: [
        ...(previous.lesson.authenticActivities ?? []),
        {
          id: 'v31-history-population-groups-local-timeline',
          title: 'Linha do tempo da formação de um lugar',
          objective: 'Organizar grupos, deslocamentos e transformações territoriais com evidências e limites explícitos.',
          context: 'Atividade mediada por docente com fontes públicas ou materiais didáticos identificados; não exige relatos familiares ou dados pessoais.',
          materials: ['Duas ou três fontes com data e procedência', 'Linha do tempo acessível', 'Mapa ou fotografia com legenda'],
          instructions: 'Registre cada evento, o grupo envolvido, o local, a evidência e uma pergunta que permanece aberta. Compare fontes antes de propor relações.',
          evidence: 'Linha do tempo com atribuição das fontes, uma relação sustentada e uma conclusão limitada ao recorte.',
          safety: 'Evitar exposição de origem familiar, tratar migrações com linguagem respeitosa e oferecer fontes alternativas acessíveis.',
          privacyGuard: 'Não coletar nacionalidade, endereço, origem familiar ou relatos pessoais dos estudantes.',
          ageRange: '3º ano do Ensino Fundamental, com mediação e linguagem adequadas.',
          mediation: 'O docente confere a procedência, ajuda a diferenciar observação e hipótese e não apresenta o pacote como mapeamento oficial aprovado.',
          rubric: [
            { criterion: 'Organização', emerging: 'Mistura eventos e períodos.', developing: 'Organiza parte da sequência com apoio.', proficient: 'Organiza eventos, grupos, lugares e períodos com clareza.' },
            { criterion: 'Evidência', emerging: 'Afirma sem indicar fonte.', developing: 'Indica uma fonte, mas não delimita seu alcance.', proficient: 'Atribui cada relação à fonte e registra limites.' },
            { criterion: 'Síntese', emerging: 'Generaliza ou inventa causa.', developing: 'Relaciona processos após orientação.', proficient: 'Relaciona processos documentados sem declarar uma causa única não sustentada.' },
          ],
        },
      ],
      copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V31 autoral sobre História local; contexto oficial registrado apenas para revisão, sem reivindicação de mapeamento.`.trim(),
    },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 50, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V31_WITH_PENDING_CANONICAL_REVIEW' },
    questions,
  };
  const validation = validateQuestionFirstPack(pack);
  if (!validation.valid) throw new Error(`HISTORY_POPULATION_GROUPS_V31_INVALID:${validation.errors.join(',')}`);
  writeFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v5/v31-history-population-groups-expansion-v31.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(resolve(ROOT, 'supabase/migrations/20261017000150_bncc_history_population_groups_library_expansion_v31.sql'), buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, newQuestions: 50, totalQuestions: questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus, sourceContext: pack.sourceContext }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
