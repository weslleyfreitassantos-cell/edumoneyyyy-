import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/philosophy-ethical-principle.json');
const SOURCE = resolve(ROOT, 'content/adaptive/tec-escola-core-v9/journey-expansion-c-v1.json');

const rows = [
  ['probe-01', 'PROBE', 'EASY', 'IDENTIFY', 'REIDENTIFICATION_RISK', 'Uma escola pretende divulgar resultados de um questionário sem nomes. Em uma turma pequena, combinações de respostas ainda podem revelar quem respondeu. Qual cuidado vem primeiro?', 'Verificar o risco de identificação e reduzir os detalhes divulgados, preservando apenas o necessário para a finalidade.', ['Divulgar porque nenhum nome aparece.', 'Perguntar somente se a maioria concorda.', 'Publicar as respostas completas e retirar o arquivo depois se alguém reclamar.'], 'Remover nomes não garante anonimato quando grupos pequenos podem ser reconhecidos. A finalidade e o risco precisam ser avaliados antes da divulgação.', 'Tratar a retirada do nome como garantia suficiente de privacidade.', 'Procure sinais indiretos que permitam reconhecer alguém e considere se todos os detalhes são necessários.', 0],
  ['probe-02', 'PROBE', 'MEDIUM', 'DISTINGUISH', 'ACCESS_AND_EQUAL_TREATMENT', 'Um grupo precisa escolher como entregar uma atividade. Uma pessoa relata que o formato único impede sua participação. Qual é a pergunta ética mais útil antes de decidir?', 'Que barreira existe e que alternativa assegura participação sem impor uma desvantagem evitável?', ['Como manter o formato idêntico para todos, qualquer que seja a barreira?', 'Quem tem mais votos para decidir?', 'Como dispensar a pessoa sem rever a atividade?'], 'Justiça não é necessariamente oferecer meios idênticos. Identificar a barreira ajuda a comparar alternativas que preservem participação e critérios comuns.', 'Confundir tratamento idêntico com oportunidade justa.', 'Descreva a barreira concreta e avalie uma alternativa que remova essa barreira sem mudar o objetivo da atividade.', 1],
  ['practice-01', 'PRACTICE', 'EASY', 'APPLY', 'STUDENT_WORK_ATTRIBUTION', 'Uma estudante cria um desenho para um mural. A equipe quer publicar a imagem e seu nome no site da escola. Qual procedimento respeita melhor sua autonomia?', 'Explicar onde e como a imagem será usada e pedir autorização antes da publicação, oferecendo uma opção real de recusa.', ['Publicar porque o desenho foi feito em uma atividade escolar.', 'Pedir autorização apenas se a publicação receber comentários negativos.', 'Omitir o nome, mesmo que a estudante tenha pedido crédito, sem conversar com ela.'], 'A autorização deve anteceder o uso e informar finalidade e circulação. Participar da atividade não equivale a consentir com qualquer publicação.', 'Presumir consentimento amplo a partir da participação na atividade.', 'Separe a criação do desenho da decisão sobre onde, para quem e com que identificação ele será divulgado.', 2],
  ['practice-02', 'PRACTICE', 'MEDIUM', 'ANALYZE', 'SHARED_ROOM_SCHEDULING', 'Uma sala de estudo é disputada por dois grupos: um precisa de silêncio em horário fixo; outro usa o espaço para encontros colaborativos. Qual processo oferece uma decisão mais justificável?', 'Ouvir as necessidades de ambos, explicitar critérios de uso e testar uma divisão com data para reavaliar os efeitos.', ['Dar todos os horários ao grupo que chegou primeiro.', 'Decidir pela maioria sem registrar os impactos para o outro grupo.', 'Proibir qualquer uso compartilhado para evitar negociação.'], 'Critérios transparentes permitem comparar necessidades e efeitos; um teste revisável evita tratar a primeira decisão como definitiva.', 'Confundir prioridade temporal ou maioria com justificativa suficiente.', 'Identifique quem é afetado, quais necessidades são incompatíveis e que arranjo pode ser acompanhado e revisto.', 3],
  ['practice-03', 'PRACTICE', 'MEDIUM', 'EVALUATE', 'PHONE_REQUIRED_CLASS_ACCESS', 'Uma atividade só pode ser acessada por um aplicativo de celular, mas parte da turma não tem aparelho ou pacote de dados. O que melhor combina equidade e responsabilidade?', 'Oferecer acesso escolar ou alternativa equivalente e verificar se ela preserva o objetivo da atividade.', ['Manter a exigência porque o mesmo aplicativo foi indicado para todos.', 'Reduzir a nota de quem não tem celular para manter o padrão.', 'Pedir que estudantes compartilhem senhas pessoais para entrar no aplicativo.'], 'Uma regra uniforme pode produzir uma barreira desigual. A alternativa deve permitir participação sem expor credenciais nem abandonar o objetivo pedagógico.', 'Confundir uma instrução igual com condições iguais de participação.', 'Pergunte se a diferença de acesso impede demonstrar a mesma aprendizagem e busque um meio seguro equivalente.', 0],
  ['transfer-01', 'TRANSFER', 'MEDIUM', 'PLAN', 'PUBLIC_ALERT_UNCERTAINTY', 'Uma associação precisa avisar sobre uma interrupção de água. A causa ainda não foi confirmada, mas o local e o horário afetados foram verificados. Qual comunicação é mais responsável?', 'Informar o que foi confirmado, distinguir o que ainda é incerto e indicar quando haverá nova atualização.', ['Afirmar uma causa provável como fato para parecer mais convincente.', 'Omitir o local até que todas as causas possíveis sejam conhecidas.', 'Compartilhar uma captura sem fonte para que cada pessoa decida.'], 'Uma comunicação proporcional informa dados úteis e confiáveis sem transformar hipótese em fato; a atualização posterior permite corrigir o quadro.', 'Apresentar uma hipótese como certeza ou esconder informação prática já confirmada.', 'Separe fato verificado, hipótese e informação que ajuda a pessoa a agir com segurança.', 1],
  ['transfer-02', 'TRANSFER', 'MEDIUM', 'APPLY', 'CREATIVE_CREDIT', 'Um estudante encontra uma fotografia feita por outra pessoa e quer usá-la em um cartaz do bairro. Qual decisão considera autoria e finalidade?', 'Verificar as condições de uso, solicitar autorização quando necessária e creditar a autoria de modo visível.', ['Usar sem crédito porque o cartaz não será vendido.', 'Apagar a marca d’água e atribuir a imagem ao grupo.', 'Evitar qualquer imagem, mesmo havendo autorização e formas legítimas de uso.'], 'A finalidade não elimina automaticamente os direitos da autoria. Verificar licença, autorização e atribuição permite um uso justificável.', 'Supor que uso não comercial elimina deveres de autoria.', 'Confira quem criou a imagem, quais usos foram autorizados e como a autoria deve ser indicada.', 2],
  ['transfer-03', 'TRANSFER', 'HARD', 'ANALYZE', 'GROUP_WORK_ABSENCE', 'Em um projeto coletivo, uma integrante faltou por motivo de saúde e não conseguiu cumprir parte do combinado. O grupo precisa concluir o trabalho sem apagar sua contribuição anterior. Qual encaminhamento é mais justo?', 'Apurar o que já foi realizado, redistribuir tarefas com diálogo e registrar responsabilidades de forma compatível com as circunstâncias.', ['Atribuir a ela todo o trabalho restante porque o grupo perdeu tempo.', 'Retirar seu nome sem conversar ou verificar sua contribuição.', 'Manter a divisão original mesmo que o prazo torne a tarefa inviável.'], 'Uma decisão justa considera contribuição, circunstâncias, efeitos sobre o grupo e possibilidade de ajuste sem presumir má-fé.', 'Tratar ausência como prova suficiente de desinteresse ou ignorar a carga restante.', 'Diferencie o que já foi feito, o motivo conhecido e as opções de redistribuição antes de atribuir responsabilidade.', 3],
  ['transfer-04', 'TRANSFER', 'HARD', 'EVALUATE', 'STAFF_PASSWORD_REQUEST', 'Uma pessoa voluntária pede a senha pessoal de uma colega para organizar inscrições em um evento. Qual resposta protege melhor os envolvidos e mantém o trabalho possível?', 'Recusar o compartilhamento da senha e pedir um acesso próprio, com permissões limitadas à tarefa.', ['Enviar a senha por mensagem e pedir que ela não a repasse.', 'Usar a conta da colega porque o evento é urgente.', 'Cancelar as inscrições sem verificar se há um meio de acesso autorizado.'], 'Compartilhar uma credencial pessoal elimina controle individual e expõe dados. Um acesso próprio e restrito atende à tarefa com menos risco.', 'Tratar urgência ou confiança pessoal como autorização para compartilhar credenciais.', 'Procure uma alternativa que permita realizar a tarefa sem revelar uma senha individual.', 0],
  ['lock-01', 'LOCK_IN', 'HARD', 'INTEGRATE', 'CONFIDENTIALITY_SPECIFIC_RISK', 'Uma orientadora recebe um relato privado com ameaça específica e iminente contra uma pessoa. Ela precisa buscar proteção sem ampliar desnecessariamente a exposição. Qual decisão equilibra melhor os valores em jogo?', 'Verificar o risco e acionar o protocolo de proteção, compartilhando apenas as informações necessárias com responsáveis apropriados.', ['Prometer segredo absoluto mesmo diante do risco iminente.', 'Publicar o relato para que a comunidade identifique quem fez a ameaça.', 'Repassar toda a conversa a qualquer pessoa interessada, sem verificar necessidade.'], 'A confidencialidade tem valor, mas um risco concreto pode exigir proteção. Limitar a divulgação e seguir um protocolo preserva proporcionalidade e segurança.', 'Tratar confidencialidade como absoluta ou como irrelevante.', 'Diferencie uma preocupação vaga de risco concreto e limite a resposta às pessoas e informações necessárias.', 1],
  ['lock-02', 'LOCK_IN', 'HARD', 'SYNTHESIZE', 'ACCESSIBLE_EVENT_BUDGET', 'Um evento tem orçamento limitado. A proposta mais votada usa um espaço sem acesso por rampa; uma opção acessível custa mais, mas pode ser ajustada em outro item. Como a comissão deve justificar a decisão?', 'Comparar custos e alternativas sem tratar a participação de pessoas com deficiência como preferência dispensável, e explicar publicamente os critérios adotados.', ['Executar a proposta mais votada porque a maioria encerra qualquer discussão.', 'Excluir do evento quem não consegue acessar o espaço escolhido.', 'Escolher a opção mais cara sem verificar o orçamento ou outras alternativas.'], 'O voto é uma informação sobre preferência, não uma justificativa completa. A comissão precisa considerar barreiras, direitos de participação, custos e alternativas reais.', 'Confundir decisão majoritária com análise suficiente de direitos e impactos.', 'Considere quem fica impedido de participar, quais adaptações são viáveis e quais critérios podem ser explicados a todos.', 2],
  ['lock-03', 'LOCK_IN', 'HARD', 'EVALUATE', 'COMMUNITY_CENTER_HOURS', 'Um centro comunitário recebe pedidos para ampliar o horário noturno. Há interesse de estudantes, mas vizinhos relatam ruído e a equipe ainda não mediu a frequência. Qual plano é mais justificável?', 'Testar um horário limitado, combinar medidas contra ruído, registrar efeitos e definir uma data para revisar a decisão com os grupos afetados.', ['Manter o horário atual porque mudanças sempre causam conflito.', 'Ampliar sem limite porque estudantes também são moradores.', 'Encerrar atividades noturnas apenas com base em relatos ainda não verificados.'], 'Um teste limitado produz evidência e permite reduzir danos; critérios e revisão tornam a decisão responsável diante da incerteza.', 'Escolher um grupo como se o interesse do outro não tivesse relevância ou tratar relato como medição conclusiva.', 'Procure uma alternativa reversível que atenda necessidades, limite danos e permita verificar os efeitos.', 3],
  ['review-01', 'REVIEW', 'EASY', 'APPLY', 'PRIVATE_CHAT_EVIDENCE', 'Uma estudante quer mostrar mensagens privadas a uma pessoa responsável para pedir ajuda sobre uma situação de intimidação. Qual opção preserva melhor a finalidade sem espalhar a conversa?', 'Compartilhar apenas o trecho necessário em um canal apropriado e perguntar como proteger as pessoas envolvidas.', ['Publicar toda a conversa para que a comunidade decida quem tem razão.', 'Apagar as mensagens antes de buscar ajuda.', 'Encaminhar a conversa a todos os colegas para obter votos.'], 'Buscar apoio não exige divulgação pública. Uma amostra limitada e um canal apropriado podem permitir avaliação sem ampliar a exposição.', 'Confundir pedido de ajuda com autorização para tornar a conversa pública.', 'Identifique quem precisa da informação para agir e qual parte é realmente necessária.', 0],
  ['review-02', 'REVIEW', 'MEDIUM', 'ANALYZE', 'FOOD_POLICY_ALLERGIES', 'Uma feira escolar adota uma regra de que todos devem consumir o mesmo lanche. Uma estudante informa uma alergia alimentar. Qual revisão é mais adequada?', 'Manter o objetivo coletivo da feira e oferecer uma opção segura, verificando ingredientes e evitando exposição desnecessária da estudante.', ['Exigir que ela prove o lanche para confirmar a alergia.', 'Retirá-la da atividade para não alterar a regra.', 'Ignorar o relato porque a regra foi aplicada igualmente.'], 'A mesma opção pode criar um risco diferente para alguém. Uma alternativa segura preserva participação sem exigir exposição como condição.', 'Confundir aplicação uniforme da regra com segurança e equidade.', 'Avalie o risco concreto e uma adaptação que permita participar sem exigir que a pessoa prove sua condição publicamente.', 1],
  ['review-03', 'REVIEW', 'MEDIUM', 'COMPARE', 'DEBATE_PARTICIPATION_MODES', 'Em um debate, a regra exige que cada estudante fale ao microfone. Uma participante se comunica melhor por escrito e pediu outra forma de contribuição. Qual ajuste mantém a finalidade do debate?', 'Aceitar uma contribuição escrita ou outro formato equivalente e avaliar a qualidade das razões apresentadas.', ['Dispensá-la de participar sem oferecer alternativa.', 'Contar somente falas orais para preservar a regra original.', 'Exigir que outra pessoa fale em seu nome sem consultar a estudante.'], 'Se o objetivo é apresentar e considerar razões, mais de um formato pode demonstrar a mesma capacidade. O ajuste não deve retirar a autonomia da participante.', 'Confundir o formato escolhido com a habilidade que se pretende observar.', 'Identifique o objetivo de aprendizagem e se ele exige necessariamente fala oral ou apenas uma justificativa compreensível.', 2],
  ['review-04', 'REVIEW', 'MEDIUM', 'EVALUATE', 'UNVERIFIED_RUMOR', 'Circula um áudio que acusa uma funcionária de ter retirado materiais de uma sala. Não há confirmação independente. Qual resposta é mais responsável?', 'Não retransmitir a acusação, preservar o registro necessário e encaminhar a informação por um canal de apuração adequado.', ['Publicar o áudio com o nome da funcionária para pedir explicações.', 'Concluir que a acusação é verdadeira porque muitas pessoas a encaminharam.', 'Apagar toda evidência e impedir qualquer apuração.'], 'A circulação de uma alegação não a confirma. Evitar amplificação e permitir apuração reduz danos sem impedir a busca de fatos.', 'Tratar repetição ou popularidade como confirmação.', 'Separe a existência do áudio da verdade da acusação e considere um canal que permita verificar sem exposição pública.', 3],
  ['review-05', 'REVIEW', 'MEDIUM', 'APPLY', 'CLASS_PHOTO_DISTRIBUTION', 'Uma escola registra uma apresentação para o arquivo interno e depois recebe pedido para publicar as imagens em uma rede aberta. O que deve ser verificado?', 'Se a autorização cobre essa finalidade e esse alcance; se não cobrir, solicitar consentimento adequado ou não publicar.', ['Se a fotografia ficou nítida, pois isso determina se pode ser publicada.', 'Se pelo menos metade das pessoas fotografadas concorda.', 'Se a imagem foi feita dentro do prédio escolar.'], 'Registrar para uso interno e publicar em rede aberta são finalidades e alcances diferentes. A autorização precisa corresponder ao uso pretendido.', 'Supor que local ou qualidade da imagem substitui consentimento e finalidade.', 'Compare o uso originalmente informado com o novo público e alcance da publicação.', 0],
  ['review-06', 'REVIEW', 'HARD', 'ANALYZE', 'PROGRAM_SELECTION_ALGORITHM', 'Um programa de verão usa um formulário automático para ordenar inscrições. A equipe percebe que candidatos de uma região quase não aparecem entre os selecionados. Qual revisão é mais responsável antes de manter o resultado?', 'Examinar critérios e dados de entrada, verificar possíveis barreiras e permitir revisão humana das decisões contestadas.', ['Aceitar a ordem porque um cálculo automático é necessariamente neutro.', 'Descartar toda inscrição da região menos representada.', 'Alterar os critérios sem informar candidatos nem registrar a razão.'], 'Automatizar uma regra não garante imparcialidade. Examinar dados e permitir contestação ajuda a identificar falhas e tornar a decisão explicável.', 'Confundir consistência computacional com neutralidade ou justiça.', 'Pergunte quais dados e critérios produzem a ordenação e como alguém pode contestar um resultado incorreto.', 1],
  ['review-07', 'REVIEW', 'HARD', 'SYNTHESIZE', 'SHARED_GARDEN_WATER_USE', 'Em uma horta comunitária, um grupo quer economizar água e outro precisa irrigar plantas recém-transplantadas. Qual decisão combina melhor cuidado, consequências e justificativa pública?', 'Verificar as necessidades das plantas e a disponibilidade de água, definir uma regra temporária de uso e revisá-la conforme os resultados.', ['Proibir irrigação para todos, sem observar as condições da horta.', 'Permitir uso ilimitado a quem chegou primeiro.', 'Escolher qual grupo parece mais simpático sem explicitar um critério.'], 'Uma regra temporária pode considerar necessidades diferentes e consequências ambientais, enquanto dados posteriores permitem ajustar a decisão.', 'Usar preferência pessoal ou prioridade temporal sem avaliar necessidade e efeitos.', 'Compare a necessidade imediata, o recurso disponível e uma regra que possa ser revista à luz de observações.', 2],
];

const purposeCounts = { PROBE: 2, PRACTICE: 3, TRANSFER: 4, LOCK_IN: 3, REVIEW: 7 };
const answerPositionCounts = [0, 0, 0, 0];
const questions = rows.map(([id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, errorFocus, hint, answerPosition]) => {
  const options = [...distractors];
  options.splice(answerPosition, 0, correctAnswer);
  answerPositionCounts[answerPosition] += 1;
  return {
    id: `v5-phil-ethics-${id}`,
    purpose,
    difficulty,
    cognitiveProcess,
    contextFamily,
    statement,
    options,
    correctAnswer,
    explanation,
    errorFocus,
    hint,
    misconceptions: { [distractors[0]]: [errorFocus.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')] },
  };
});

const sourceFeedback = [
  ['01', 'Distinga o fato de que há uma ameaça específica da suposição sobre quem a divulgaria; priorize proteção e verificação.', 'Ampliar a exposição da ameaça ou presumir culpa antes de confirmar fatos.'],
  ['02', 'Compare a promessa de sigilo com a especificidade, proximidade e gravidade do risco; limite qualquer encaminhamento.', 'Tratar confidencialidade como absoluta mesmo diante de risco concreto, ou ignorá-la sem necessidade.'],
  ['03', 'Observe quem fica sem acesso e quais adaptações removem a barreira sem abandonar o objetivo.', 'Confundir oferecer exatamente o mesmo formato com garantir participação justa.'],
  ['04', 'Pergunte se a regra continuaria defensável caso fosse adotada por todos e se preservaria a finalidade da avaliação.', 'Usar a chance de não ser descoberto como justificativa moral.'],
  ['05', 'Identifique a barreira que impede a leitura e compare o apoio com o objetivo comum da atividade.', 'Tratar recursos diferentes como injustiça sem avaliar a barreira que cada pessoa enfrenta.'],
  ['06', 'Verifique se a pessoa conhece finalidade, público e circulação antes de aceitar o uso da gravação.', 'Confundir registro da voz com autorização para reutilizá-la em qualquer contexto.'],
  ['07', 'Considere intenção, dano, possibilidade de reparação e segurança antes de propor a resposta.', 'Escolher punição ou ausência de consequência sem considerar reparação proporcional.'],
  ['08', 'Separe quem criou, encaminhou e recebeu a mensagem; interrompa a circulação e apoie quem foi atingido.', 'Atribuir culpa igual a todas as pessoas ou responsabilizar somente quem encaminhou por último.'],
  ['09', 'Avalie o risco previsível, sua gravidade e uma medida razoável que o reduza antes da atividade.', 'Ignorar risco concreto por causa do cronograma ou presumir que todo risco exige cancelar tudo.'],
  ['10', 'Considere a razão da denúncia e também a escolha de um canal seguro e adequado.', 'Confundir coragem com exposição impulsiva ou silêncio obrigatório.'],
  ['11', 'Torne explícitas as necessidades em conflito, os critérios aplicáveis e como a decisão será revisada.', 'Tratar maioria numérica como justificativa suficiente para distribuir um recurso comum.'],
  ['12', 'Considere a dignidade da pessoa atingida e evite exigir que ela prove que merece respeito.', 'Transferir à pessoa exposta o dever de justificar por que a humilhação deve parar.'],
  ['13', 'Pergunte se os dados são necessários, para qual finalidade e quem terá acesso à apresentação.', 'Coletar ou divulgar informação sensível sem necessidade e sem participação voluntária.'],
  ['14', 'Identifique o interesse concorrente e uma salvaguarda que reduza influência indevida na avaliação.', 'Supor que imparcialidade existe sem declarar ou administrar um conflito de interesses.'],
  ['15', 'Compare critérios, efeitos para grupos diferentes e informação que pode justificar uma revisão futura.', 'Confundir transparência com simplesmente anunciar a decisão já tomada.'],
  ['16', 'Considere reparação e responsabilização sem dispensar segurança, apuração e participação voluntária.', 'Tratar mediação como substituta automática da proteção ou da verificação dos fatos.'],
  ['17', 'Use o contexto histórico para explicar a prática e ainda avalie seus efeitos e as razões oferecidas.', 'Confundir contextualização com aprovação automática ou julgar o passado sem contexto.'],
  ['18', 'Localize palavras que descrevem o que ocorre e palavras que dizem o que deveria ocorrer.', 'Tratar uma descrição verificável como se ela já contivesse uma justificativa normativa.'],
  ['19', 'Teste se o procedimento de votação protege participação, direitos e possibilidade de contestação.', 'Supor que qualquer resultado majoritário seja justo independentemente do processo e dos efeitos.'],
  ['20', 'Registre o que era conhecido no momento e defina como novos dados serão considerados depois.', 'Tratar uma decisão inicial sob incerteza como imune a revisão ou como prova automática de erro.'],
];

const cPack = JSON.parse(readFileSync(SOURCE, 'utf8'));
const sourceJourney = cPack.journeys.find((journey) => journey.skill === 'PHILOSOPHY_APPLY_ETHICAL_PRINCIPLE');
if (!sourceJourney?.questionIdPrefix || sourceJourney.questionRows?.length !== 20) throw new Error('PHILOSOPHY_ETHICS_SOURCE_RECONCILIATION_FAILED');
const sourceQuestionFeedback = [
  ...sourceFeedback.map(([suffix, hint, errorFocus]) => ({
    questionId: `${sourceJourney.questionIdPrefix}-${suffix}`,
    hint,
    errorFocus,
  })),
  {
    questionId: 'v3-philosophy-philosophy_argument-5',
    hint: 'Nomeie as pessoas afetadas e compare como benefícios e danos seriam distribuídos; depois avalie alternativas e razões.',
    errorFocus: 'Reduzir uma avaliação ética à popularidade de uma escolha, sem analisar impactos ou justificativas.',
  },
];

const idsFor = (purpose) => questions.filter((question) => question.purpose === purpose).map((question) => question.id);
const pack = {
  packVersion: 'tec-escola-core-v5-question-first',
  contentId: 'v5-philosophy-ethical-principle',
  subject: 'PHILOSOPHY',
  domain: 'ETICA',
  topic: 'justificacao de decisoes eticas em casos concretos',
  canonicalSkillCode: 'PHILOSOPHY_APPLY_ETHICAL_PRINCIPLE',
  contentVersion: 5,
  expectedQuestionCount: questions.length,
  expectedContextCount: new Set(questions.map((question) => question.contextFamily)).size,
  expectedAnswerPositionCounts: Object.fromEntries(['A', 'B', 'C', 'D'].map((label, index) => [label, answerPositionCounts[index]])),
  expectedPurposeCounts: purposeCounts,
  officialMappingStatus: 'NOT_CLAIMED',
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
  publicationStatus: 'STAGING',
  contentAuthoringStatus: 'AUTHORED',
  sourceQuestionFeedback,
  questions,
  lesson: {
    title: 'Decidir com razões: princípios, consequências e proporcionalidade',
    objective: 'Analisar um caso identificando fatos, pessoas afetadas, valores ou direitos em tensão, consequências e alternativas; justificar uma decisão proporcional e indicar seus limites.',
    summary: 'Uma decisão ética não se prova por popularidade nem por uma palavra-chave. Separe fatos de suposições, compare razões e alternativas, proteja direitos e explique por que a resposta é proporcional naquele contexto.',
    explanation: '## 1. Separe fatos e suposições\nDescreva o que se sabe e indique o que ainda precisa ser confirmado. “A mensagem foi encaminhada às 10h” pode ser verificável; “a pessoa queria humilhar alguém” atribui uma intenção que talvez não esteja demonstrada. Uma conclusão responsável não transforma hipótese em fato.\n\n## 2. Identifique pessoas, valores e responsabilidades\nPergunte quem será afetado, quem decide e quem pode ficar sem voz. Privacidade, autonomia, segurança, justiça, cuidado e bem comum podem apontar em direções diferentes. Um conflito real não desaparece ao escolher o princípio que parece mais familiar.\n\n## 3. Compare razões sem reduzir a análise a uma fórmula\nConsequências previsíveis importam, mas não são o único critério: direitos, deveres, consentimento, distribuição dos danos e relações de cuidado também podem limitar o que se deve fazer. Uma votação informa preferências; não demonstra, por si só, que a decisão respeita direitos ou distribui custos justamente.\n\n## 4. Procure alternativas e teste a proporcionalidade\nCompare a ação proposta com outras que possam atingir o objetivo causando menos dano ou expondo menos pessoas. Verifique se o meio é necessário, quem suporta o custo e se a regra pode ser explicada a quem discorda. Tratar todos de modo idêntico nem sempre remove barreiras diferentes.\n\n## 5. Justifique e indique o que pode mudar a decisão\nUma boa justificativa liga decisão, fatos, princípio e consequência: “Proponho X porque a evidência Y mostra Z; esta alternativa protege A e limita B”. Reconheça incertezas e indique que informação levaria a revisar o plano. O contexto ajuda a compreender práticas e valores, mas popularidade ou tradição não substitui justificativa.\n\n## Exemplo resolvido\nUma turma tem verba para melhorar um espaço de estudo. A proposta mais votada compra cadeiras novas, mas uma estudante relata que o acesso ao espaço tem um degrau e impede sua entrada com cadeira de rodas. Primeiro, confirme a barreira e o custo das opções; depois compare uma rampa portátil, mudança de sala e compra das cadeiras em outro momento. O voto explica uma preferência, mas não encerra a análise da participação. Uma decisão justificável explicita custos e critérios, busca remover a barreira e combina uma revisão após testar a solução. Se nenhuma opção couber no orçamento atual, a comissão deve dizer isso, procurar alternativa segura e não apresentar a exclusão como se fosse participação igual.',
    workedExample: 'No exemplo do espaço de estudo, a turma separa o fato verificável (o degrau impede a entrada de uma participante), a preferência (mais cadeiras) e as alternativas (mudar a sala, adaptar o acesso ou reprogramar a compra). A justificativa considera participação, custo e efeitos. A decisão não precisa fingir que não há conflito: deve explicar o critério, reduzir a barreira dentro das condições reais e prever quando reavaliará o resultado.',
    commonMistake: 'Resolver um dilema por uma palavra-chave, por maioria ou pela consequência mais conveniente, sem verificar fatos, direitos, alternativas e quem suporta os custos.',
    commonErrors: ['Atribuir intenção sem evidência.', 'Tratar regra ou votação como prova automática de justiça.', 'Somar benefícios e danos sem considerar direitos e distribuição.', 'Confundir igualdade de formato com igualdade de participação.', 'Propor uma resposta excessiva sem comparar alternativa menos danosa.', 'Ignorar incerteza, consentimento ou a possibilidade de revisão.'],
    tips: ['Escreva primeiro os fatos e marque separadamente as suposições.', 'Nomeie quem será afetado e quais valores entram em conflito.', 'Compare ao menos duas alternativas e seus efeitos distribuídos.', 'Justifique a escolha com evidência e indique um limite ou condição de revisão.'],
    priorKnowledge: ['Distinguir uma afirmação factual de uma avaliação.', 'Reconhecer que uma decisão pode afetar pessoas de maneiras diferentes.', 'Apresentar uma razão para uma escolha.'],
    keyConcepts: ['raciocínio moral como reflexão prática sobre o que fazer', 'fatos, inferências e intenções', 'direitos, deveres, consequências, cuidado e justiça como razões que podem entrar em tensão', 'proporcionalidade e alternativa menos danosa', 'contexto, pluralidade e revisão de decisões'],
    progression: [
      { stage: 'FOUNDATION', focus: 'Separar fatos de avaliações e identificar pessoas afetadas.', questionIds: idsFor('PROBE') },
      { stage: 'APPLICATION', focus: 'Aplicar consentimento, equidade e transparência a situações escolares e comunitárias.', questionIds: idsFor('PRACTICE') },
      { stage: 'TRANSFER', focus: 'Transferir a análise para comunicação pública, autoria, trabalho coletivo e segurança digital.', questionIds: idsFor('TRANSFER') },
      { stage: 'INTEGRATION', focus: 'Integrar direitos, consequências, incerteza e proporcionalidade em conflitos de valores.', questionIds: idsFor('LOCK_IN') },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Retomar o método em novos contextos, verificando limites e condições de revisão.', questionIds: idsFor('REVIEW') },
    ],
    microExplanations: [
      { trigger: 'FACT_VS_ASSUMPTION', text: 'Uma intenção atribuída não é fato confirmado; indique qual evidência sustentaria essa leitura.' },
      { trigger: 'AFFECTED_PEOPLE', text: 'Pergunte quem recebe benefícios, quem suporta custos e quem ainda não foi ouvido.' },
      { trigger: 'RIGHTS_AND_OUTCOMES', text: 'Consequências importam, mas não apagam automaticamente consentimento, deveres ou direitos.' },
      { trigger: 'MAJORITY_IS_NOT_ENOUGH', text: 'Uma votação registra preferências; ainda é preciso analisar impactos e critérios.' },
      { trigger: 'PROPORTIONATE_ALTERNATIVE', text: 'Compare a resposta proposta com uma alternativa eficaz que cause menos exposição ou dano.' },
      { trigger: 'REVISABLE_DECISION', text: 'Diga que informação nova levaria você a rever a decisão.' },
    ],
    remediations: [
      { id: 'FACTS_BEFORE_INTENT', misconception: 'INTENCAO_TRATADA_COMO_FATO', prompt: 'Reescreva o caso em duas colunas: fatos observáveis e hipóteses sobre intenção. Que evidência falta?' },
      { id: 'DISTRIBUTION_CHECK', misconception: 'MAIORIA_COMO_JUSTIFICATIVA_COMPLETA', prompt: 'Liste quem ganha, quem perde e qual direito ou necessidade pode ficar sem representação.' },
      { id: 'LOWER_HARM_OPTION', misconception: 'RESPOSTA_DESPROPORCIONAL', prompt: 'Proponha uma alternativa que alcance o objetivo com menos dano ou divulgação e compare seus limites.' },
      { id: 'REASON_AND_REVISION', misconception: 'DECISAO_SEM_RAZOES_REVOGAVEIS', prompt: 'Complete: “Escolho X porque o fato Y sustenta Z; mudaria a decisão se...”' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 24,
    sourceDossier: [
      {
        title: 'Moral Reasoning',
        publisher: 'Stanford Encyclopedia of Philosophy',
        url: 'https://plato.stanford.edu/entries/reasoning-moral/',
        accessedOn: '2026-10-13',
        supports: ['Raciocínio moral como raciocínio prático sobre o que fazer.', 'Conflitos entre considerações morais exigem análise filosófica.'],
        use: 'Referência conceitual para estruturar a análise de razões; não é fonte de alinhamento BNCC nem de itens copiados.',
      },
      {
        title: 'BNCC - Ensino Médio: Ciências Humanas e Sociais Aplicadas',
        publisher: 'Ministério da Educação / Conselho Nacional de Educação',
        url: 'https://www.gov.br/mec/pt-br/cne/bncc_ensino_medio.pdf',
        accessedOn: '2026-10-13',
        supports: ['Discussão ética em situações concretas, respeito, convivência, bem comum, direitos humanos e acolhimento das diferenças.', 'A pluralidade histórica e cultural deve ser considerada na análise de princípios.'],
        use: 'Contexto educacional de apoio. O pacote não reivindica código ou mapeamento oficial da BNCC.',
      },
      {
        title: 'Ética e Cidadania: Construindo Valores na Escola e na Sociedade',
        publisher: 'Ministério da Educação; autores vinculados à Universidade de São Paulo',
        url: 'https://portal.mec.gov.br/seb/arquivos/pdf/Etica/liv_etic_cidad.pdf',
        accessedOn: '2026-10-13',
        supports: ['Aprendizagem ética ligada a situações reais e ao desenvolvimento da autonomia moral.'],
        use: 'Referência pedagógica; exemplos e questões do pacote são autorais e revisão humana permanece pendente.',
      },
    ],
    copyrightNote: 'Os dilemas, alternativas, exemplos e explicações do pacote são autorais. As referências apoiam a precisão conceitual; mapeamento oficial e revisão pedagógica humana permanecem pendentes.',
  },
};

if (questions.length !== 19 || JSON.stringify(Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]))) !== JSON.stringify(purposeCounts)) {
  throw new Error('PHILOSOPHY_ETHICS_V5_QUESTION_COUNTS_INVALID');
}
if (answerPositionCounts.some((count, index) => count !== [5, 5, 5, 4][index])) throw new Error('PHILOSOPHY_ETHICS_V5_ANSWER_POSITIONS_UNBALANCED');

export function buildPhilosophyEthicalPrinciplePack() {
  return structuredClone(pack);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Wrote ${questions.length} new philosophy-ethics questions and ${sourceQuestionFeedback.length} source-feedback records to ${OUTPUT}`);
}
