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
  PE_DISTINGUISH: {
    sourceFile: 'physical-activity-exercise.json',
    prefix: 'pe-distinguish-activity-exercise-expansion-v10',
    migration: '20261016000800_bncc_pe_distinguish_activity_exercise_library_expansion_v10.sql',
    subject: 'PHYSICAL_EDUCATION',
    skillCode: 'PE_DISTINGUISH_ACTIVITY_EXERCISE_FII',
    items: [
      { label: 'everyday', context: 'Uma estudante caminha até a biblioteca para buscar um livro, sem que a ação tenha sido organizada como treino.', question: 'O que a situação permite classificar?', correct: 'É atividade física, mas não há evidência suficiente de exercício planejado.', criterion: 'Reconheça movimento sem exigir que toda atividade física tenha objetivo de treino.', transfer: 'Classifique outro deslocamento cotidiano separando movimento de exercício planejado.', overclaim: 'afirmar que só existe atividade física quando há aula ou competição', evidence: 'caminhada, finalidade cotidiana e ausência de plano de treino', nextStep: 'descrever o contexto e perguntar se havia planejamento, estrutura, repetição e propósito', limit: 'a situação cotidiana descrita', comparison: 'movimento realizado e organização da ação', refine: 'o que teria de ser acrescentado para caracterizar exercício?', distractors: ['Não há atividade física porque não houve competição.', 'É exercício estruturado apenas por envolver caminhada.', 'É treinamento de força comprovado pelo deslocamento.'] },
      { label: 'structure', context: 'A turma repete uma sequência de movimentos durante dez minutos, seguindo uma ordem e um objetivo combinados com o professor.', question: 'Qual leitura usa os critérios adequados?', correct: 'Há atividade física e a sequência pode ser exercício planejado, pois tem estrutura, repetição e propósito.', criterion: 'Procure organização, repetição e propósito, não aparelho ou vencedor.', transfer: 'Analise uma sequência diferente usando os mesmos critérios de planejamento.', overclaim: 'dizer que regras ou música retiram uma proposta da atividade física', evidence: 'sequência, repetição, ordem e objetivo combinado', nextStep: 'verificar se a proposta também oferece escolha, acesso e segurança', limit: 'a sequência descrita e seus critérios de organização', comparison: 'movimento, repetição e finalidade', refine: 'qual critério está presente além do simples movimento?', distractors: ['Não é atividade física porque foi organizada.', 'Só é exercício se houver aparelho de academia.', 'Só conta se alguém vencer a sequência.'] },
      { label: 'purpose', context: 'Duas pessoas fazem o mesmo alongamento: uma o realiza ao se acomodar, e outra segue uma série planejada com repetições e propósito definido.', question: 'Por que a classificação pode ser diferente?', correct: 'O movimento é semelhante, mas contexto, planejamento, repetição e propósito mudam a interpretação.', criterion: 'Compare como e por que a ação foi organizada, não apenas o nome do gesto.', transfer: 'Use contexto e propósito para classificar o mesmo movimento em outra situação.', overclaim: 'usar somente o nome do movimento como prova de exercício', evidence: 'mesmo alongamento, situações distintas e série planejada', nextStep: 'separar o movimento observado dos critérios de organização', limit: 'as duas situações apresentadas', comparison: 'forma do movimento e contexto de realização', refine: 'que elemento diferencia a série planejada do gesto cotidiano?', distractors: ['O alongamento sempre é exercício, em qualquer situação.', 'A primeira pessoa não fez nenhum movimento.', 'O propósito nunca interfere na classificação.'] },
      { label: 'repeat', context: 'Em uma oficina, um grupo ensaia uma sequência de passos, mas cada participante pode fazer pausas e escolher uma forma equivalente de acompanhar.', question: 'O que se pode concluir?', correct: 'A proposta mantém repetição e organização, e escolhas ou pausas não anulam seu caráter planejado.', criterion: 'Não confunda exercício planejado com obrigação de ritmo idêntico.', transfer: 'Avalie outra prática planejada observando repetição e formas de participação.', overclaim: 'afirmar que pausa transforma automaticamente exercício em movimento casual', evidence: 'ensaio, sequência, pausas e formas equivalentes de acompanhar', nextStep: 'analisar se o objetivo da proposta continua claro e seguro', limit: 'o plano da oficina e as opções oferecidas', comparison: 'repetição planejada e autonomia para participar', refine: 'a proposta preserva o objetivo mesmo com ritmos diferentes?', distractors: ['Uma pausa elimina todo planejamento.', 'Todos precisam repetir no mesmo ritmo para existir atividade física.', 'Apenas quem executa fisicamente participa.'] },
      { label: 'competition', context: 'Uma escola propõe uma sequência cooperativa de movimentos, sem ranking, para explorar coordenação e criação coletiva.', question: 'Qual conclusão é adequada?', correct: 'A ausência de competição não impede atividade física nem exercício planejado.', criterion: 'Separe propósito e organização de disputa ou desempenho comparado.', transfer: 'Classifique uma proposta cooperativa de outra turma sem procurar vencedor.', overclaim: 'tratar competição como requisito universal de exercício', evidence: 'sequência, cooperação, coordenação e ausência de ranking', nextStep: 'verificar planejamento, repetição e participação voluntária', limit: 'a proposta cooperativa descrita', comparison: 'objetivo pedagógico e presença ou ausência de competição', refine: 'qual elemento sustenta o planejamento sem ranking?', distractors: ['Sem vencedor não existe atividade física.', 'Só esportes competitivos podem ser exercício.', 'A cooperação impede qualquer repetição.'] },
      { label: 'setting', context: 'Uma brincadeira espontânea de correr ocorre no recreio; em outro momento, o professor organiza circuitos com estações e objetivos combinados.', question: 'Como comparar as duas situações?', correct: 'As duas envolvem atividade física; o circuito também apresenta elementos de exercício planejado.', criterion: 'Reconheça a categoria ampla e procure planejamento no segundo contexto.', transfer: 'Compare brincadeira e circuito em uma nova situação escolar.', overclaim: 'dizer que brincadeira espontânea não envolve movimento válido', evidence: 'corrida espontânea, circuito, estações e objetivos', nextStep: 'descrever o que muda no planejamento sem desvalorizar a brincadeira', limit: 'os contextos do recreio e da aula', comparison: 'espontaneidade, estações e objetivos combinados', refine: 'o que torna o circuito mais estruturado?', distractors: ['Só o circuito é atividade física.', 'A brincadeira é exercício obrigatório.', 'Estações e objetivos não alteram a organização.'] },
      { label: 'recovery', context: 'Uma proposta inclui períodos de pausa e recuperação entre séries, definidos para que o grupo acompanhe a atividade com segurança.', question: 'Como interpretar as pausas?', correct: 'Elas podem fazer parte do planejamento e não eliminam a possibilidade de exercício estruturado.', criterion: 'Inclua recuperação na leitura do plano sem transformar pausa em falha.', transfer: 'Analise outra rotina com intervalos e propósito explícito.', overclaim: 'considerar toda pausa como prova de que não há exercício', evidence: 'séries, intervalos planejados e objetivo de segurança', nextStep: 'verificar se o plano permite ajuste e comunicação de desconforto', limit: 'o planejamento e as condições da proposta', comparison: 'períodos de esforço, pausa e propósito', refine: 'a pausa foi prevista ou ocorreu por outro motivo?', distractors: ['Pausa torna qualquer movimento desorganizado.', 'Exercício exige movimento contínuo sem recuperação.', 'A segurança é irrelevante quando há planejamento.'] },
      { label: 'access', context: 'Em uma aula, o objetivo é analisar estratégias de deslocamento. O professor oferece participação caminhando, sentada, observando ou registrando decisões.', question: 'Por que essas opções podem atender ao mesmo objetivo?', correct: 'Elas permitem investigar estratégias e contexto sem transformar uma forma corporal em requisito único.', criterion: 'Relacione objetivo de aprendizagem, escolha e acesso.', transfer: 'Planeje alternativas equivalentes em outro objetivo de Educação Física.', overclaim: 'confundir adaptação com redução automática da aprendizagem', evidence: 'objetivo comum, formas de participação e registro de decisões', nextStep: 'verificar se cada opção produz evidência do objetivo pedagógico', limit: 'o objetivo de analisar estratégias', comparison: 'forma de participação e evidência produzida', refine: 'o que precisa permanecer igual entre as opções?', distractors: ['Só a execução corporal produz aprendizagem.', 'Uma alternativa sentada sempre abandona o objetivo.', 'A adaptação exige revelar diagnóstico à turma.'] },
      { label: 'evidence', context: 'Um projeto pede que os estudantes classifiquem situações fictícias como atividade física ou exercício, justificando por contexto, estrutura e propósito.', question: 'Que evidência é mais adequada para avaliar o projeto?', correct: 'A justificativa baseada nos critérios do contexto, não uma medida de velocidade, força ou resistência.', criterion: 'Avalie o raciocínio solicitado sem substituir o objetivo por teste corporal.', transfer: 'Escolha evidência de aprendizagem em outra atividade conceitual de movimento.', overclaim: 'usar desempenho atlético como prova de compreensão conceitual', evidence: 'classificação, justificativa, contexto, estrutura e propósito', nextStep: 'analisar se a resposta usa os critérios e reconhece limites', limit: 'o objetivo conceitual do projeto', comparison: 'evidência de raciocínio e medida de aptidão', refine: 'a medida escolhida realmente responde à pergunta pedagógica?', distractors: ['Tempo de corrida prova toda compreensão.', 'Peso corporal é evidência da classificação.', 'Só uma competição permite avaliar o conceito.'] },
      { label: 'ambiguous', context: 'Um cartaz anuncia “movimento diário”, mas não informa se há sequência, repetição, objetivo ou orientação.', question: 'Qual conclusão é mais responsável?', correct: 'É preciso pedir mais contexto antes de classificar a proposta como exercício planejado.', criterion: 'Identifique informação ausente em vez de preencher a lacuna com suposição.', transfer: 'Analise outro anúncio de atividade procurando critérios explícitos.', overclaim: 'inferir planejamento apenas por um slogan', evidence: 'nome da proposta e ausência de detalhes sobre organização', nextStep: 'perguntar pelo plano, propósito, estrutura, repetição e condições de participação', limit: 'as informações disponíveis no cartaz', comparison: 'rótulo da atividade e evidências de planejamento', refine: 'qual informação faltante mudaria a classificação?', distractors: ['O slogan prova que é exercício completo.', 'Toda atividade diária é necessariamente competição.', 'A falta de detalhes prova que não existe movimento.'] },
    ],
  },
  PE_SAFE: {
    sourceFile: 'physical-safe-activity.json',
    prefix: 'pe-safe-activity-expansion-v10',
    migration: '20261016000900_bncc_pe_safe_activity_library_expansion_v10.sql',
    subject: 'PHYSICAL_EDUCATION',
    skillCode: 'PE_PLAN_SAFE_ACTIVITY',
    items: [
      { label: 'floor', context: 'Antes da aula, o professor observa que parte do piso está molhada e há estudantes circulando pelo espaço.', question: 'Qual decisão deve vir primeiro?', correct: 'Interromper o início, isolar ou corrigir o risco com supervisão e escolher área adequada.', criterion: 'Verifique piso, circulação e supervisão antes de iniciar.', transfer: 'Revise outro espaço com risco ambiental antes de propor movimento.', overclaim: 'dizer que duração curta torna qualquer piso seguro', evidence: 'piso molhado, circulação e área de atividade', nextStep: 'reavaliar o local e decidir adaptar ou adiar', limit: 'as condições concretas do espaço', comparison: 'risco observado e decisão de realizar ou adiar', refine: 'quem pode confirmar que o espaço está adequado?', distractors: ['Começar logo antes que o piso seque.', 'Pedir que cada estudante desvie sozinho.', 'Ignorar o piso se a atividade durar poucos minutos.'] },
      { label: 'obstacle', context: 'Mochilas, cadeiras e cabos ocupam a área planejada para uma atividade de deslocamento.', question: 'Qual é um ajuste seguro?', correct: 'Organizar ou remover os obstáculos com apoio do adulto e confirmar uma rota livre antes da atividade.', criterion: 'Mapeie a área e não transfira todo o risco para quem participa.', transfer: 'Faça a mesma checagem em outro espaço com materiais espalhados.', overclaim: 'achar que atenção individual substitui organização do ambiente', evidence: 'obstáculos, rota de circulação e supervisão', nextStep: 'delimitar área livre e combinar circulação', limit: 'o espaço e os obstáculos descritos', comparison: 'ambiente antes e depois da organização', refine: 'a rota está livre para todas as formas de participação?', distractors: ['Acelerar para passar antes dos obstáculos.', 'Manter tudo e exigir atenção perfeita.', 'Ocupar a área porque obstáculos fazem parte do desafio.'] },
      { label: 'supervision', context: 'Uma turma recebe um material novo, mas ninguém explicou regras de uso, espaço de espera ou como pedir ajuda.', question: 'O que falta antes de começar?', correct: 'Orientação, supervisão e combinados de circulação, pausas e uso do material.', criterion: 'Segurança inclui comunicação e acompanhamento, não apenas o objeto.', transfer: 'Planeje combinados para outro material ou atividade.', overclaim: 'presumir que estudantes descobrirão o protocolo durante o risco', evidence: 'material novo, ausência de regras e falta de sinal de ajuda', nextStep: 'apresentar o uso, delimitar espaço e combinar como interromper', limit: 'o protocolo da aula', comparison: 'material disponível e instruções de uso', refine: 'como uma pessoa pode pedir ajuda sem se expor?', distractors: ['Começar para aprender pelo erro.', 'Deixar o material circular sem supervisão.', 'Pedir que colegas decidam o protocolo médico.'] },
      { label: 'equipment', context: 'Há poucos materiais e a turma deseja participar sem disputar quem pega primeiro.', question: 'Qual organização favorece segurança e acesso?', correct: 'Criar estações ou turnos com espaço livre, regras claras e alternativas para quem espera.', criterion: 'Organize circulação e participação sem transformar recurso limitado em disputa.', transfer: 'Distribua outro material escasso com o mesmo cuidado.', overclaim: 'tratar exclusão e velocidade como solução de organização', evidence: 'quantidade de materiais, espaço e formas de participação', nextStep: 'combinar turnos e uma atividade equivalente para a espera', limit: 'os recursos e o espaço da turma', comparison: 'distribuição do material e qualidade da participação', refine: 'o que as pessoas fazem enquanto aguardam?', distractors: ['Lançar todos os materiais ao mesmo tempo.', 'Excluir quem não pegou primeiro.', 'Aumentar o ritmo até alguém desistir.'] },
      { label: 'weather', context: 'Uma atividade externa estava planejada, mas a chuva deixou o piso escorregadio e reduziu a visibilidade.', question: 'Qual revisão é mais adequada?', correct: 'Consultar o professor, verificar alternativa interna ou adiar após reavaliar piso, circulação e acesso.', criterion: 'Uma mudança de ambiente exige nova análise, não transferência automática.', transfer: 'Replaneje outra atividade diante de mudança climática ou espacial.', overclaim: 'assumir que o plano original continua seguro', evidence: 'chuva, piso, visibilidade e alternativa de local', nextStep: 'comparar realizar, adaptar ou adiar com base nas condições', limit: 'a atividade externa e a mudança de clima', comparison: 'plano original e condições atuais', refine: 'que condição precisa ser confirmada no espaço alternativo?', distractors: ['Usar o piso molhado para cumprir o plano.', 'Transferir sem olhar o novo local.', 'Continuar porque a chuva não muda nenhuma condição.'] },
      { label: 'pause', context: 'Durante a atividade, uma participante sinaliza desconforto e pede para parar.', question: 'Qual resposta respeita o protocolo?', correct: 'Permitir a pausa, comunicar o professor responsável e seguir o procedimento da escola sem diagnosticar.', criterion: 'Priorize pausa e comunicação com adulto responsável.', transfer: 'Aplique o mesmo protocolo a outro sinal de desconforto.', overclaim: 'interpretar pausa como falta de esforço ou fazer diagnóstico entre colegas', evidence: 'sinal de desconforto, pedido de pausa e presença do professor', nextStep: 'interromper a participação e seguir orientação responsável', limit: 'o relato e o protocolo institucional', comparison: 'sinal recebido e ação segura', refine: 'qual ação não deve ser feita pelos colegas?', distractors: ['Mandar continuar para não atrasar.', 'Pedir aos colegas uma explicação médica.', 'Transformar o desconforto em competição.'] },
      { label: 'accessibility', context: 'O objetivo da aula é analisar tomada de decisão em jogos. O plano original oferece apenas corrida, embora o objetivo possa ser alcançado por observação, marcação ou estratégia.', question: 'Como tornar a proposta mais acessível?', correct: 'Oferecer funções e formas equivalentes de participação que mantenham a análise de decisões.', criterion: 'Preserve o objetivo e diversifique a participação.', transfer: 'Adapte outra proposta sem retirar a evidência pedagógica central.', overclaim: 'confundir uma única execução corporal com o objetivo inteiro', evidence: 'objetivo de decisão, opções de função e evidência esperada', nextStep: 'definir papéis e critérios de análise antes da vivência', limit: 'o objetivo de analisar decisões', comparison: 'forma corporal original e alternativas equivalentes', refine: 'que evidência mostra a decisão em cada função?', distractors: ['Obrigar corrida para todos.', 'Retirar da aula quem escolhe observar.', 'Pedir diagnóstico para autorizar uma alternativa.'] },
      { label: 'hydration', context: 'Em uma aula longa, o professor combina pausas para água conforme o contexto e orienta que cada pessoa comunique desconforto ao adulto.', question: 'Por que o combinado é importante?', correct: 'Ele organiza pausas e comunicação sem prescrever uma rotina individual ou coletar dados de saúde.', criterion: 'Relacione cuidado coletivo e limites de uma aula não clínica.', transfer: 'Analise outro combinado de cuidado sem transformá-lo em prescrição.', overclaim: 'usar a aula para diagnosticar ou medir corpos', evidence: 'pausas, água, comunicação e ausência de prescrição individual', nextStep: 'manter supervisão e seguir protocolos da instituição', limit: 'o combinado geral da aula', comparison: 'cuidado coletivo e prescrição individual', refine: 'que informação deve permanecer privada?', distractors: ['Exigir que todos revelem sua saúde.', 'Definir uma dose pessoal sem avaliação.', 'Impedir pausas para manter o ritmo.'] },
      { label: 'boundaries', context: 'Em uma atividade em duplas, o plano não explica contato corporal nem como recusar uma interação.', question: 'Que melhoria é necessária?', correct: 'Explicitar consentimento, alternativas sem contato e como pedir pausa ou ajuda ao professor.', criterion: 'Planeje limites e alternativas antes da vivência.', transfer: 'Revise outra dinâmica que possa envolver contato ou exposição.', overclaim: 'tratar contato como obrigatório em toda atividade coletiva', evidence: 'duplas, contato não explicado e ausência de recusa combinada', nextStep: 'oferecer opção sem contato e comunicação segura', limit: 'a dinâmica e os acordos da turma', comparison: 'interação proposta e alternativas de participação', refine: 'como a pessoa interrompe a interação sem constrangimento?', distractors: ['Obrigar contato para completar a atividade.', 'Deixar as duplas resolverem sem adulto.', 'Considerar recusa como falha de participação.'] },
      { label: 'record', context: 'Após uma atividade adaptada, o professor precisa registrar a decisão para planejar a próxima aula.', question: 'Qual registro é proporcional?', correct: 'Anotar contexto, adaptação, participação observada e próximo convite, sem coletar diagnóstico ou medidas corporais.', criterion: 'Registre evidência pedagógica necessária e preserve a privacidade.', transfer: 'Escolha campos proporcionais para outro registro de aula.', overclaim: 'transformar relatório pedagógico em ficha clínica', evidence: 'contexto, adaptação, observação e próximo passo', nextStep: 'registrar apenas o necessário no sistema institucional protegido', limit: 'a finalidade pedagógica do registro', comparison: 'evidência necessária e dado pessoal excessivo', refine: 'qual informação ajuda a próxima aula sem expor o estudante?', distractors: ['Guardar peso e frequência cardíaca de todos.', 'Pedir diagnóstico como justificativa pública.', 'Registrar somente quem foi mais rápido.'] },
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
    ['Que pergunta ajuda a refinar o planejamento?', item.refine],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `v10-${definition.prefix}-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 10 ? 'EASY' : index < 50 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `V10_${definition.prefix.toUpperCase()}_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A resposta usa as evidências do contexto e respeita os limites de segurança, acesso e privacidade. ${item.criterion}`,
    hint: 'Leia o contexto, identifique a evidência e confira o limite da decisão.',
    errorFocus: `${definition.skillCode}_CONTEXT_AND_SAFETY_CONFUSION`,
    misconceptions: { [item.distractors[0]]: [`${definition.skillCode}_CONTEXT_AND_SAFETY_CONFUSION`] },
  };
}

function buildPack(definition) {
  const previous = JSON.parse(readFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v5/${definition.sourceFile}`), 'utf8'));
  const newQuestions = definition.items.flatMap((item, caseIndex) => Array.from({ length: 10 }, (_, variant) => makeQuestion({ definition, item, caseIndex, variant })));
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
    contentId: `v10-${definition.prefix}`,
    contentVersion: 10,
    lessonVersion: Math.max(previous.lessonVersion ?? 1, 10),
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
      copyrightNote: `${previous.lesson.copyrightNote ?? ''} Lote V10 autoral com 100 questões, progressão e revisão pedagógica pendente; publicação mantida em STAGING.`.trim(),
    },
    sourceReconciliation: { ...(previous.sourceReconciliation ?? {}), sourceQuestionCount: previous.questions.length, newQuestions: 100, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V10' },
    questions,
  };
}

export function buildWave6LibraryExpansionV10Packs() {
  return Object.fromEntries(Object.values(cases).map((definition) => [definition.skillCode, buildPack(definition)]));
}

function main() {
  const packs = buildWave6LibraryExpansionV10Packs();
  const report = [];
  for (const definition of Object.values(cases)) {
    const pack = packs[definition.skillCode];
    const validation = validateQuestionFirstPack(pack);
    if (!validation.valid) throw new Error(`${definition.subject}_INVALID:${validation.errors.join(',')}`);
    writeFileSync(resolve(ROOT, `content/adaptive/tec-escola-core-v5/v10-${definition.prefix}.json`), `${JSON.stringify(pack, null, 2)}\n`);
    writeFileSync(resolve(ROOT, `supabase/migrations/${definition.migration}`), buildMigration(pack));
    report.push({ subject: definition.subject, skillCode: definition.skillCode, newQuestions: 100, totalQuestions: pack.questions.length, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus });
  }
  process.stdout.write(`${JSON.stringify({ valid: true, packs: report }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
