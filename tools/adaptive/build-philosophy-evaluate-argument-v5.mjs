import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/philosophy-evaluate-argument.json');

const rows = [
  ['probe-01', 'PROBE', 'EASY', 'IDENTIFY', 'EVENING_BUS_ROUTE', 'Um conselho analisa um texto: “A linha de ônibus atende muitos trabalhadores depois das 20h; por isso, a cidade deve restaurar a última viagem.” Qual afirmação é a conclusão defendida?', 'A cidade deve restaurar a última viagem da linha.', ['A linha atende trabalhadores depois das 20h.', 'O texto menciona um conselho municipal.', 'Toda linha deve operar durante a madrugada.'], 'A primeira oração oferece uma razão; a recomendação introduzida por “por isso” é o ponto que o autor quer sustentar.', 'Tomar a premissa informativa como se fosse a conclusão do argumento.', 'Pergunte qual frase o autor pretende que o conselho aceite, e não qual frase apresenta um dado.', 0],
  ['probe-02', 'PROBE', 'MEDIUM', 'EVALUATE', 'CLINIC_EXTENDED_HOURS', 'Uma associação pede que uma clínica comunitária amplie o atendimento até as 19h. Qual dado se relaciona mais diretamente à razão apresentada?', 'Registros mostram que muitos pacientes que trabalham deixam de comparecer porque o atendimento termina antes do fim do expediente.', ['A cor preferida dos cartazes da clínica é verde.', 'O prédio foi inaugurado há mais de vinte anos.', 'Uma clínica de outra cidade tem uma fachada maior.'], 'O registro conecta o horário atual ao obstáculo descrito. Os demais dados podem ser verdadeiros, mas não sustentam essa recomendação.', 'Confundir informação verdadeira com evidência pertinente à conclusão.', 'Compare cada dado com a razão prática oferecida para mudar o horário.', 1],
  ['practice-01', 'PRACTICE', 'EASY', 'IDENTIFY', 'ARCHIVE_DIGITIZATION', 'A equipe afirma: “Digitalizar os documentos reduz o tempo de busca. Este arquivo tem documentos consultados diariamente. Portanto, digitalizar este arquivo deve economizar tempo da equipe.” Qual é a conclusão?', 'Digitalizar este arquivo deve economizar tempo da equipe.', ['Documentos são consultados diariamente.', 'A equipe afirma que a busca pode ser reduzida.', 'Todo documento digital é mais confiável que o original.'], 'As duas primeiras afirmações funcionam como razões; a recomendação final é a conclusão.', 'Selecionar uma premissa em vez da afirmação que depende das razões.', 'Localize o que segue de “portanto”.', 2],
  ['practice-02', 'PRACTICE', 'MEDIUM', 'ANALYZE', 'PUBLIC_CHARGER_ANALOGY', 'Uma cidade compara os pontos públicos de recarga de bicicletas a bebedouros: ambos precisam ser localizáveis e distribuídos perto de quem os usa. Que pergunta melhor testa a analogia para decidir onde instalar recargas?', 'As necessidades de acesso e os padrões de uso são semelhantes nos aspectos relevantes, ou as recargas exigem critérios diferentes de rede e segurança?', ['Os dois equipamentos podem ter a mesma cor?', 'Alguns moradores gostam mais de bicicletas do que de água?', 'A cidade já usou a palavra “público” em outros projetos?'], 'Uma analogia sustenta uma conclusão quando a semelhança é relevante para a decisão. Diferenças de energia, segurança e permanência podem limitar a comparação.', 'Avaliar uma analogia por semelhanças superficiais, não por sua relevância para a conclusão.', 'Identifique qual propriedade compartilhada justificaria a mesma regra e procure diferenças que afetem esse critério.', 3],
  ['practice-03', 'PRACTICE', 'MEDIUM', 'EVALUATE', 'SCHOOL_MEAL_SURVEY', 'Uma comissão diz que deve ampliar o cardápio vegetariano porque uma enquete recebeu muitos votos favoráveis. Qual informação fortaleceria melhor essa razão sem supor que a enquete represente toda a escola?', 'A taxa de resposta, a composição dos participantes e a comparação entre preferências declaradas e refeições efetivamente escolhidas.', ['A quantidade de curtidas em uma publicação sem relação com o cardápio.', 'O nome da empresa que imprimiu os formulários.', 'A opinião de uma pessoa que não participou da enquete.'], 'A força da evidência depende de quem respondeu, de quantas pessoas foram ouvidas e de como as respostas se relacionam ao comportamento que a decisão pretende mudar.', 'Tratar o número bruto de votos como medida suficiente da população e do efeito esperado.', 'Pergunte quem respondeu, quem ficou de fora e se a medida observada corresponde à conclusão.', 0],
  ['practice-04', 'PRACTICE', 'HARD', 'ANALYZE', 'OPTIONAL_TUTORING_RESULTS', 'Alunos que frequentaram uma tutoria tiveram notas maiores no trimestre. A coordenação conclui que a tutoria causou a diferença. Qual análise é necessária antes de aceitar essa conclusão causal?', 'Comparar as condições iniciais e outras diferenças entre participantes e não participantes, além de examinar evolução em períodos comparáveis.', ['Aceitar a causa porque a tutoria ocorreu antes da prova.', 'Comparar apenas a maior nota de cada grupo.', 'Ignorar a frequência e atribuir toda diferença à motivação.'], 'A sequência temporal não elimina seleção: estudantes que procuram tutoria podem diferir em apoio, tempo de estudo ou desempenho inicial. Comparações melhores ajudam a avaliar explicações alternativas.', 'Tomar precedência temporal como prova suficiente de causalidade.', 'Liste uma explicação alternativa para a diferença além da tutoria e diga quais dados a distinguiriam.', 1],
  ['transfer-01', 'TRANSFER', 'MEDIUM', 'EVALUATE', 'HEAT_ALERT_OUTCOMES', 'Uma equipe afirma que alertas de calor reduzem atendimentos de emergência. Em dois bairros, os atendimentos caíram após uma campanha. Qual dado adicional é mais útil para testar a inferência?', 'Séries de períodos comparáveis, bairros sem a campanha e mudanças simultâneas como temperatura, acesso a serviços e composição da população.', ['O número de cores usadas nos cartazes.', 'A quantidade de reuniões da equipe, sem relação com atendimentos.', 'Uma declaração de que a campanha foi bem recebida por seus autores.'], 'Uma comparação temporal e entre grupos ajuda a separar o possível efeito do alerta de clima, tendências e mudanças de acesso.', 'Generalizar uma mudança posterior à campanha sem comparação que controle outras causas plausíveis.', 'Procure o que também mudou no mesmo período e com que grupo ou período comparar.', 2],
  ['transfer-02', 'TRANSFER', 'MEDIUM', 'DISTINGUISH', 'QUEUE_ALGORITHM_FAIRNESS', 'Uma plataforma diz que seu processo de seleção é justo porque todos recebem as mesmas perguntas. O que ainda falta para essa conclusão?', 'Justificar por que perguntas iguais medem o critério relevante e examinar se condições de acesso ou interpretação produzem barreiras não relacionadas ao objetivo.', ['Repetir que a regra é igual para todos.', 'Mostrar que o formulário tem muitas páginas.', 'Publicar apenas a quantidade total de inscritos.'], 'Uniformidade do procedimento, sozinha, não prova que ele mede o mérito pretendido nem que todos conseguem demonstrá-lo em condições comparáveis.', 'Deduzir justiça apenas da aplicação idêntica de uma regra.', 'Separe “mesmo procedimento” de “evidência válida do critério”; que condições podem afetar o resultado?', 3],
  ['transfer-03', 'TRANSFER', 'HARD', 'EVALUATE', 'RIVER_ACCESS_RESTRICTION', 'Um relatório mostra que restringir veículos em uma margem de rio reduz erosão. A equipe conclui que a restrição deve ser permanente para todas as áreas. Qual avaliação é mais completa?', 'O dado apoia um efeito local, mas a regra geral também exige comparar áreas, alternativas, custos para grupos afetados e critérios de permanência.', ['A conclusão já está provada porque um local apresentou redução.', 'O dado deve ser ignorado porque foi coletado por uma equipe técnica.', 'Uma regra permanente é sempre melhor que uma medida temporária.'], 'O resultado é pertinente, mas seu alcance pode ser menor que o da conclusão. Uma política geral precisa considerar variação local e razões normativas.', 'Estender um resultado localizado a uma regra geral sem justificar o alcance e os custos.', 'Compare a população observada com o grupo atingido pela conclusão e diferencie dado de recomendação.', 0],
  ['transfer-04', 'TRANSFER', 'HARD', 'ANALYZE', 'MUSEUM_AUDIO_GUIDE', 'Um museu propõe substituir parte dos textos por áudio. Testes mostram maior permanência média perto das obras, mas algumas pessoas não conseguem ouvir o áudio. Que resposta argumentativa preserva o que os dados mostram sem exagerar?', 'Dizer que o áudio pode aumentar a permanência em certas condições, verificar acessibilidade e comparar formatos complementares antes de recomendar substituição total.', ['Concluir que toda pessoa aprende melhor por áudio.', 'Descartar os testes porque nenhum dado pode informar decisões culturais.', 'Substituir todos os textos imediatamente, pois a permanência aumentou.'], 'O resultado sustenta uma afirmação limitada sobre permanência, não uma generalização sobre aprendizagem nem uma política que ignore acesso.', 'Trocar um indicador observado por uma conclusão mais ampla sobre aprendizagem e adequação universal.', 'Nomeie exatamente o que foi medido e o que não foi medido.', 1],
  ['lock-01', 'LOCK_IN', 'MEDIUM', 'DISTINGUISH', 'DEDUCTIVE_VALIDITY', 'Considere: “Se o sensor está calibrado, ele registra valores dentro da tolerância. O sensor está calibrado. Logo, seus registros ficam dentro da tolerância.” O que a validade da forma permite afirmar?', 'Se as premissas forem verdadeiras, a conclusão segue; ainda é preciso verificar se o sensor está calibrado e se a regra é confiável.', ['Que o sensor foi calibrado por uma pessoa certificada.', 'Que a conclusão é verdadeira mesmo se uma premissa for falsa.', 'Que os registros provam a regra geral por indução.'], 'Validade trata da ligação entre premissas e conclusão. Ela não certifica por si só as premissas factuais.', 'Confundir validade inferencial com verdade das premissas ou solidez do argumento.', 'Faça o teste condicional: supondo as premissas, seria possível a conclusão ser falsa?', 2],
  ['lock-02', 'LOCK_IN', 'HARD', 'EVALUATE', 'WILDLIFE_CORRIDOR_POLICY', 'Um estudo registra mais travessias de animais em um corredor ecológico. A prefeitura conclui que deve desapropriar todos os terrenos vizinhos. Qual é a principal lacuna entre o dado e a decisão?', 'O dado descreve travessias, mas a desapropriação exige razões normativas e comparação de alternativas, necessidade, impacto e proporcionalidade.', ['O estudo não pode ser evidência porque observa animais.', 'A conclusão é dedutivamente válida por usar a palavra “deve”.', 'A medida está justificada porque toda desapropriação protege a natureza.'], 'Uma observação pode informar uma política, mas não determina sozinha qual medida deve ser adotada nem se é a menos gravosa eficaz.', 'Inferir uma obrigação específica diretamente de um dado descritivo sem explicitar valores e alternativas.', 'Identifique o fato observado, a ação recomendada e a premissa de valor que ligaria os dois.', 3],
  ['review-01', 'REVIEW', 'EASY', 'IDENTIFY', 'WATER_FILTER_CLAIM', 'Um anúncio afirma: “O filtro X remove 95% de partículas no ensaio descrito; portanto, atende ao padrão de potabilidade em qualquer casa.” Qual parte do raciocínio merece verificação primeiro?', 'Se o ensaio mediu todos os contaminantes relevantes e se as condições de teste correspondem ao uso nas diferentes casas.', ['Se o anúncio usa uma fonte tipográfica sem serifa.', 'Se 95% é um número maior que 50%.', 'Se o filtro tem uma embalagem azul.'], 'A conclusão amplia um resultado sobre partículas para um padrão de potabilidade em qualquer residência; é preciso verificar medida, contexto e alcance.', 'Tratar um percentual sobre um indicador como prova de uma conclusão mais ampla.', 'Compare o que o ensaio mediu com o que a conclusão afirma.', 0],
  ['review-02', 'REVIEW', 'MEDIUM', 'ANALYZE', 'SLEEP_MUSIC_CORRELATION', 'Uma pesquisa observa que estudantes que ouvem música ao estudar relatam dormir menos. Qual conclusão é sustentada com mais cautela?', 'Há uma associação nessa amostra; sem dados adicionais, não se sabe se a música causa menos sono nem em que direção a relação ocorre.', ['Ouvir música causa privação de sono em todos os estudantes.', 'Dormir menos sempre faz alguém ouvir música.', 'A pesquisa prova que música não tem qualquer efeito.'], 'Uma associação observada não determina direção causal nem elimina fatores comuns, como rotina e carga de estudo.', 'Converter correlação em causa ou escolher uma direção sem evidência.', 'Distinga associação observada de mecanismo causal e proponha uma explicação alternativa.', 1],
  ['review-03', 'REVIEW', 'MEDIUM', 'EVALUATE', 'COMMUNITY_GARDEN_RULE', 'Um grupo diz que a horta comunitária deve manter uma regra de irrigação porque ela foi aprovada por unanimidade. Qual pergunta avalia melhor a justificativa?', 'A regra distribui água de modo adequado diante das necessidades e limitações observadas, e quem não participou teve oportunidade de apresentar razões?', ['A unanimidade prova que a regra produzirá plantas saudáveis.', 'A votação torna irrelevantes as necessidades das plantas.', 'A regra deve ser rejeitada porque toda votação é injusta.'], 'A unanimidade informa o resultado de um procedimento, mas não demonstra por si só adequação, evidência ou participação de todas as pessoas afetadas.', 'Tratar consenso formal como prova suficiente da conclusão substantiva.', 'Pergunte o que a votação mede e quais razões ainda precisam ser avaliadas.', 2],
  ['review-04', 'REVIEW', 'HARD', 'ANALYZE', 'CIVIC_SURVEY_NONRESPONSE', 'Uma pesquisa municipal aponta apoio alto a uma praça nova, mas metade das pessoas convidadas não respondeu. O relatório afirma que “a maioria da cidade apoia o projeto”. Qual análise é mais forte?', 'A taxa e o padrão de não resposta podem alterar a representatividade; a conclusão deve ser limitada ou complementada por uma amostra adequada.', ['A conclusão é certa porque metade respondeu.', 'A pesquisa não tem nenhum valor em qualquer circunstância.', 'O apoio deve ser considerado universal até surgir uma reclamação.'], 'A não resposta pode estar associada às opiniões ou às condições de acesso. Sem examinar quem ficou de fora, não se deve estender diretamente o resultado à cidade inteira.', 'Ignorar viés de não resposta ao generalizar a amostra para a população.', 'Compare quem respondeu e quem não respondeu, e ajuste o alcance da afirmação.', 3],
  ['review-05', 'REVIEW', 'MEDIUM', 'EVALUATE', 'EXPERT_CONFLICT_DISCLOSURE', 'Uma pesquisadora recomenda uma política de energia e recebe recursos de uma empresa do setor. O que a avaliação do argumento deve fazer com essa informação?', 'Verificar se há conflito de interesse que afeta a confiabilidade ou seleção das evidências, sem substituir a análise das razões apresentadas.', ['Descartar automaticamente a conclusão porque a pesquisadora recebeu recursos.', 'Aceitar a conclusão porque toda especialista é imparcial.', 'Atacar a pesquisadora sem examinar método ou evidências.'], 'A relação pode ser relevante para avaliar transparência e confiabilidade, mas não é, sozinha, refutação do conteúdo do argumento.', 'Confundir um possível conflito de interesse com prova automática de falsidade ou ignorá-lo completamente.', 'Pergunte se a relação pode influenciar evidência ou método e examine também esses elementos.', 0],
  ['review-06', 'REVIEW', 'HARD', 'ANALYZE', 'LIBRARY_AND_PARK_ANALOGY', 'Uma associação compara o uso noturno de uma biblioteca ao uso de um parque e conclui que a mesma regra de fechamento deve valer para ambos. Qual é a melhor avaliação da comparação?', 'A semelhança de uso público não basta; diferenças de serviço, riscos, estrutura e alternativas precisam ser ligadas ao critério da regra.', ['A comparação é forte porque biblioteca e parque são espaços públicos.', 'A analogia é inválida porque os lugares têm nomes diferentes.', 'A regra deve ser idêntica sempre que duas áreas forem abertas ao público.'], 'Uma analogia depende de semelhanças relevantes para a conclusão e deve considerar diferenças que afetem segurança, finalidade e serviço.', 'Aceitar uma analogia por compartilhar apenas uma característica genérica.', 'Pergunte quais características justificariam a mesma regra e quais diferenças poderiam mudar a decisão.', 1],
  ['review-07', 'REVIEW', 'HARD', 'SYNTHESIZE', 'HEARING_ACCESSIBILITY_POLICY', 'Uma audiência sobre transporte registra que várias pessoas não conseguiram acompanhar as falas por falta de legendas. A secretaria conclui que legendas devem ser oferecidas em toda reunião pública. Qual avaliação combina melhor evidência e justificativa?', 'Os relatos identificam uma barreira; a recomendação pode ser justificada por participação e acesso, avaliando formatos, custos e exceções sem exigir que cada pessoa prove a necessidade em público.', ['Os relatos provam que toda reunião terá o mesmo problema e dispensam qualquer avaliação.', 'A secretaria deve ignorar os relatos porque não são um experimento controlado.', 'A recomendação é falsa porque participação é uma opinião pessoal.'], 'Relatos podem revelar uma barreira real, embora não estimem sozinhos sua frequência. Uma política ainda precisa explicitar o princípio e comparar meios de implementação.', 'Tratar evidência qualitativa como universal ou descartá-la por não ser experimental.', 'Diga o que os relatos mostram, o que não estimam e qual razão normativa apoia a política.', 2],
  ['review-08', 'REVIEW', 'HARD', 'EVALUATE', 'BIKE_LANE_PILOT', 'Após um teste de ciclovia, comerciantes relatam menos vagas para clientes e hospitais registram mais viagens de bicicleta. Qual conclusão é mais bem calibrada para decidir a próxima etapa?', 'Os resultados apontam efeitos diferentes; medir duração, locais e grupos afetados e comparar alternativas antes de ampliar ou encerrar o projeto.', ['Expandir imediatamente porque um indicador melhorou.', 'Encerrar imediatamente porque um grupo relatou custo.', 'Concluir que nenhuma decisão é possível enquanto não houver certeza absoluta.'], 'Evidência mista deve informar trade-offs, não ser reduzida ao resultado preferido. Um piloto pode ser ajustado e acompanhado com critérios claros.', 'Selecionar apenas a evidência que favorece uma posição ou exigir certeza impossível antes de decidir.', 'Integre os dois resultados, identifique quem recebe benefícios e custos e proponha um próximo teste informativo.', 3],
];

const purposeCounts = { PROBE: 2, PRACTICE: 4, TRANSFER: 4, LOCK_IN: 2, REVIEW: 8 };
const answerPositionCounts = [0, 0, 0, 0];
const questions = rows.map(([id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, errorFocus, hint, answerPosition]) => {
  const options = [...distractors];
  options.splice(answerPosition, 0, correctAnswer);
  answerPositionCounts[answerPosition] += 1;
  return {
    id: `v5-phil-argument-${id}`,
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

const sourceFeedbackById = {
  'v3-philosophy-philosophy_argument-1': ['Explicite o critério usado para distribuir e examine quem é afetado por cada alternativa.', 'Tomar uma preferência ou divisão aparentemente igual como justificativa completa de justiça.'],
  'v3-philosophy-philosophy_argument-2': ['Separe a condição inicial da afirmação que decorre dela após a palavra “logo”.', 'Trocar uma premissa pela conclusão que o argumento pretende sustentar.'],
  'v3-philosophy-philosophy_argument-3': ['Teste primeiro se a conclusão pode ser falsa quando as premissas são verdadeiras; depois confira cada premissa.', 'Confundir forma válida com premissas verdadeiras ou argumento sólido.'],
  'v3-philosophy-philosophy_argument-4': ['Identifique qual ponto foi questionado e se a resposta oferece uma razão para ele.', 'Tratar uma objeção como ataque pessoal em vez de oportunidade de testar a inferência.'],
  'v3-philosophy-philosophy_argument-6': ['Liste a semelhança que sustenta a comparação e um limite relevante para a conclusão.', 'Aceitar a analogia só porque os dois casos compartilham alguma característica.'],
  'v3-philosophy-philosophy_argument-7': ['A dúvida metodológica suspende a aceitação até haver critério; não afirma que nenhuma afirmação pode ser avaliada.', 'Confundir pedido de evidência com negação indiscriminada.'],
  'v3-philosophy-philosophy_argument-8': ['Considere quais condições sociais influenciam a escolha sem concluir automaticamente que toda autonomia desaparece.', 'Tratar influência contextual como prova de ausência total de autonomia.'],
  'v3-philosophy-philosophy_argument-9': ['Compare a previsão com dados verificáveis e com a possibilidade de outras pessoas examinarem a evidência.', 'Confundir palpite e conhecimento sem perguntar pelas razões e pela qualidade da evidência.'],
  'v3-philosophy-philosophy_argument-10': ['Avalie as razões apresentadas para a proposta, não um erro sem relação cometido pelo autor.', 'Rejeitar uma conclusão atacando a pessoa, sem responder às premissas.'],
  'v3-philosophy-philosophy_argument-11': ['Formule a conclusão, encontre as razões e procure evidência ou contraexemplo pertinente.', 'Aceitar ou rejeitar uma afirmação viral apenas pela popularidade.'],
  'v3-philosophy-philosophy_argument-12': ['Pergunte quantos casos foram observados e se eles representam a população mencionada.', 'Usar um caso ilustrativo como estimativa de toda uma cidade.'],
  'v4-authored-philosophy-review-01': ['Verifique se a autoridade oferece dados ou razões pertinentes; a reputação não substitui a análise.', 'Aceitar uma afirmação só pela identidade de quem fala.'],
  'v9-philosophy-argument-01': ['A conclusão é a recomendação defendida; a oração seguinte à conjunção explica por quê.', 'Selecionar o motivo em vez da proposta que o motivo sustenta.'],
  'v9-philosophy-argument-02': ['Observe tamanho e seleção do grupo antes de generalizar para todos os estudantes.', 'Tratar poucos colegas voluntários como amostra representativa.'],
  'v9-philosophy-argument-03': ['A ordem temporal permite levantar hipótese, mas verifique outras mudanças e uma comparação adequada.', 'Concluir causalidade apenas porque o aumento ocorreu depois da instalação.'],
  'v9-philosophy-argument-04': ['Procure um caso que restrinja a liberdade e ainda proteja um direito ou condição justa.', 'Assumir que uma propriedade geral das regras determina sozinha sua justiça.'],
  'v9-philosophy-argument-05': ['Busque evidência que documente a barreira e o efeito do recurso sobre o acesso.', 'Escolher um dado sem relação direta com a justificativa de acessibilidade.'],
  'v9-philosophy-argument-06': ['Teste se a semelhança afeta disponibilidade e uso compartilhado e considere diferenças práticas.', 'Confundir semelhança superficial com analogia justificadora.'],
  'v9-philosophy-argument-07': ['Nomeie os grupos, os encargos distribuídos e os princípios que poderiam justificar a escolha.', 'Usar a quantidade de beneficiados como única razão decisiva.'],
  'v9-philosophy-argument-08': ['A crítica discutida é o custo; verifique se a resposta oferece dados sobre ele.', 'Confundir ataque à competência do crítico com resposta à objeção.'],
  'v9-philosophy-argument-09': ['Compare objetivo, efeitos sobre direitos, proporcionalidade e alternativas menos restritivas.', 'Avaliar uma regra sem explicitar objetivo ou alternativas disponíveis.'],
  'v9-philosophy-argument-10': ['Os relatos tratam de segurança; confira se frequência, local e condições sustentam o alcance da conclusão.', 'Tratar evidência pertinente como prova completa sem avaliar suficiência.'],
  'v9-philosophy-argument-11': ['Pergunte se a diferença muda a razão da regra e se uma exceção pode ser explicada pelo mesmo princípio.', 'Aplicar uma regra sem testar se o caso difere de modo relevante.'],
  'v9-philosophy-argument-12': ['Separe a medida descritiva da avaliação normativa e explicite o critério de justiça.', 'Inferir justiça diretamente de aumento de participação.'],
  'v9-philosophy-argument-13': ['Examine a forma inferencial e, em seguida, a confiabilidade da premissa contestada.', 'Supor que validade lógica torna verdadeira toda premissa.'],
  'v93-phil-argument-01': ['Identifique o que o trecho atribui ao horário ampliado e separe essa conclusão da informação de que a biblioteca abriu mais tarde.', 'Repetir a premissa sobre horário em vez de localizar a afirmação sustentada.'],
  'v93-phil-argument-02': ['Assuma as premissas apenas para testar a forma: se forem verdadeiras, a conclusão segue para o caso das baleias?', 'Deixar um conhecimento sobre baleias substituir a avaliação da relação lógica.'],
  'v93-phil-argument-03': ['Separe validade da forma e verdade das premissas; verifique qual premissa compromete a solidez.', 'Supor que uma forma válida torna verdadeiras todas as premissas.'],
  'v93-phil-argument-04': ['Escolha informação diretamente ligada à circulação e à experiência de acesso, não a uma característica decorativa.', 'Selecionar um dado verdadeiro, mas irrelevante para a barreira de acesso.'],
  'v93-phil-argument-05': ['Descreva primeiro os 18 respondentes; depois pergunte se a consulta voluntária representa os 900 estudantes.', 'Converter a proporção de respondentes em estimativa da população sem amostragem adequada.'],
  'v93-phil-argument-06': ['As duas vendas podem variar com uma terceira condição, como calor; associação não estabelece qual evento causa o outro.', 'Confundir variação conjunta com uma relação causal direta.'],
  'v93-phil-argument-07': ['Avalie a proposta pelas razões e efeitos apresentados; impaciência da pessoa não responde ao conteúdo.', 'Usar um traço do proponente como refutação da proposta.'],
  'v93-phil-argument-08': ['Procure alternativas entre cancelamento total e ausência completa de prevenção.', 'Aceitar como exaustivas duas opções formuladas pelo argumento.'],
  'v93-phil-argument-09': ['A conclusão amplia uma observação para casos não observados; mantenha-a provisória e compare fatores relevantes.', 'Tratar uma generalização indutiva como necessidade dedutiva.'],
  'v93-phil-argument-10': ['Rastreie a origem, procure fontes independentes e verifique evidências específicas para uma afirmação tão ampla.', 'Usar popularidade ou confiança do autor como substituto de evidência.'],
  'v93-phil-argument-11': ['Mude uma variável relevante e mantenha condições comparáveis, para que o efeito da luz possa ser interpretado.', 'Alterar várias condições ao mesmo tempo e atribuir o resultado a uma delas.'],
  'v93-phil-argument-12': ['O relato sustenta algo sobre a experiência daquela pessoa; eficácia geral e causalidade exigem evidência adicional.', 'Generalizar de um testemunho individual para todas as pessoas.'],
  'v93-phil-argument-13': ['Uma definição descreve a estrutura ou função da categoria; um episódio particular é apenas um exemplo.', 'Confundir um caso de debate com uma explicação do que é um argumento.'],
  'v93-phil-argument-14': ['Um contraexemplo precisa pertencer à categoria e não satisfazer a afirmação universal.', 'Escolher um exemplo que confirma a regra em vez de um caso que a refuta.'],
  'v93-phil-argument-15': ['“Necessário” quer dizer que sem a credencial não se entra; isso não garante, por si, aprovação na prova.', 'Converter uma condição necessária em condição suficiente para outro resultado.'],
  'v93-phil-argument-16': ['Procure a recomendação sobre o que a cidade deve fazer; contagens e descrições não são, sozinhas, uma norma.', 'Confundir um fato observado com uma obrigação.'],
  'v93-phil-argument-17': ['Pergunte qual sentido de “igualmente” está em jogo e quais critérios de distribuição ele implica.', 'Ignorar que uma palavra-chave pode encobrir critérios distintos.'],
  'v93-phil-argument-18': ['O gráfico mostra uma associação; investigue variáveis concorrentes antes de afirmar uma causa.', 'Atribuir causalidade exclusiva a uma variável observada junto com o resultado.'],
  'v93-phil-argument-19': ['Compare a composição da turma com as escolas, séries e contextos sobre os quais a recomendação pretende valer.', 'Generalizar de um grupo local sem verificar representatividade.'],
  'v93-phil-argument-20': ['Relate convergências entre métodos e declare que o desenho não acompanhou mudanças temporais.', 'Afirmar evolução ou causa no tempo sem observações longitudinais.'],
};

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(ROOT, relativePath), 'utf8'));
const conceptJourney = readJson('content/adaptive/tec-escola-core-v9/journey-expansion-c-v1.json').journeys
  .find((journey) => journey.journeyCode === 'PHILOSOPHY_DISTINGUISH_CONCEPT_V93');
if (!conceptJourney || conceptJourney.skill !== 'PHILOSOPHY_DISTINGUISH_CONCEPT' || conceptJourney.questionRows?.length !== 20) {
  throw new Error('PHILOSOPHY_ARGUMENT_REASSIGNED_SOURCE_MISSING');
}
const reassignedArgumentQuestions = conceptJourney.questionRows.map((row, index) => {
  if (!Array.isArray(row) || row.length !== 7 || !Array.isArray(row[4]) || !Number.isInteger(row[5])) {
    throw new Error(`PHILOSOPHY_ARGUMENT_REASSIGNED_SOURCE_INVALID:${index + 1}`);
  }
  return {
    id: `${conceptJourney.questionIdPrefix}-${String(index + 1).padStart(2, '0')}`,
    statement: row[3],
    options: row[4],
    correctAnswer: row[4][row[5]],
    explanation: row[6],
  };
});
const originalQuestions = [
  ...readJson('content/adaptive/tec-escola-core-v4/subjects/philosophy/questions.json').filter((question) => question.primarySkill === 'PHILOSOPHY_EVALUATE_ARGUMENT'),
  ...readJson('content/adaptive/tec-escola-core-v9/question-expansion-v3.json').questions.filter((question) => question.skill === 'PHILOSOPHY_EVALUATE_ARGUMENT'),
  ...reassignedArgumentQuestions,
];
const sourceQuestionFeedback = originalQuestions.map((question) => {
  const feedback = sourceFeedbackById[question.id];
  if (!feedback) throw new Error(`PHILOSOPHY_ARGUMENT_SOURCE_FEEDBACK_MISSING:${question.id}`);
  return { questionId: question.id, hint: feedback[0], errorFocus: feedback[1] };
});
if (originalQuestions.length !== 45 || sourceQuestionFeedback.length !== Object.keys(sourceFeedbackById).length) {
  throw new Error('PHILOSOPHY_ARGUMENT_SOURCE_RECONCILIATION_FAILED');
}

const idsFor = (purpose) => questions.filter((question) => question.purpose === purpose).map((question) => question.id);
const pack = {
  packVersion: 'tec-escola-core-v5-question-first',
  contentId: 'v5-philosophy-evaluate-argument',
  subject: 'PHILOSOPHY',
  domain: 'ARGUMENTO',
  topic: 'avaliacao de premissas, inferencias e conclusoes',
  canonicalSkillCode: 'PHILOSOPHY_EVALUATE_ARGUMENT',
  contentVersion: 5,
  lessonVersion: 6,
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
    title: 'Como avaliar razões, evidências e conclusões',
    objective: 'Reconstruir a conclusão e suas premissas, avaliar a pertinência e a suficiência das razões, verificar inferências e limitar a conclusão ao que as evidências sustentam.',
    summary: 'Uma conclusão convincente não se sustenta apenas por soar familiar. Identifique as razões, verifique como se conectam à conclusão e pergunte se a evidência cobre o alcance da afirmação.',
    explanation: '## 1. Reconstrua o argumento\nLocalize o que se pretende defender e quais razões são oferecidas. “Porque”, “já que” e “uma vez que” costumam introduzir premissas; “portanto” e “por isso” podem sinalizar conclusão. As palavras ajudam, mas a função de cada frase no raciocínio é decisiva.\n\n## 2. Teste pertinência e suficiência\nUma razão pode ser verdadeira e ainda não apoiar a conclusão. Pergunte se ela trata do ponto em debate e se, junto às outras razões, é suficiente para o alcance afirmado. Um relato pode revelar uma barreira sem estimar sua frequência; uma medida local pode orientar uma hipótese sem provar uma regra para toda a cidade.\n\n## 3. Separe forma, premissas e força\nEm um argumento dedutivo válido, não é possível que todas as premissas sejam verdadeiras e a conclusão falsa. Isso não prova que as premissas são verdadeiras. Argumentos indutivos não garantem a conclusão, mas podem torná-la mais provável quando os dados são pertinentes, representativos e considerados com alternativas.\n\n## 4. Procure pressupostos e explicações alternativas\nPergunte o que precisa ser verdadeiro para a passagem funcionar. Compare amostras, condições iniciais, causas concorrentes, contraexemplos e diferenças entre casos usados em analogias. Um teste bom mira a ligação entre as razões e a conclusão, não a pessoa que falou.\n\n## 5. Calibre a conclusão\nNão é preciso escolher entre certeza total e rejeição completa. Diga o que a evidência apoia, em quais condições e o que ainda falta. Uma recomendação normativa também depende de critérios ou valores: dados ajudam a prever efeitos, mas não determinam sozinhos qual distribuição é justa ou qual custo é aceitável.\n\n## Exemplo resolvido\nUma cidade testa uma nova rota de ônibus por um mês. A contagem mostra mais embarques após as 20h e algumas pessoas relatam que conseguiram chegar ao trabalho. A conclusão “a rota pode atender uma necessidade noturna” é compatível com os dados. Já “a rota deve permanecer em todas as regiões, sem mudanças” é mais ampla: seria preciso olhar dias e locais diferentes, comparar custos e alternativas, identificar quem depende da linha e explicitar o critério público usado para decidir. As evidências informam a decisão, mas o relatório deve limitar a conclusão ao que foi medido e declarar o valor que orienta a recomendação.',
    workedExample: 'No teste de ônibus, “houve mais embarques depois das 20h” é um dado e “a rota pode atender uma necessidade” é uma inferência plausível. Para recomendar a permanência universal, faltam comparação por região, custo, alternativas e um critério de acesso. A boa análise aceita a evidência limitada sem transformá-la em prova de uma política muito mais ampla.',
    commonMistake: 'Aceitar ou rejeitar o argumento por quem o apresentou, por uma palavra como “falácia” ou por uma evidência isolada, sem reconstruir a ligação e o alcance da conclusão.',
    commonErrors: ['Trocar premissa por conclusão.', 'Tratar pertinência como suficiência.', 'Confundir validade com verdade das premissas.', 'Transformar associação temporal em causalidade.', 'Generalizar uma amostra sem avaliar seleção e não resposta.', 'Ignorar uma alternativa ou um contraexemplo relevante.', 'Usar uma analogia apoiada em semelhanças superficiais.', 'Deduzir uma obrigação apenas de um dado descritivo.'],
    tips: ['Escreva a conclusão em uma frase e numere cada razão.', 'Para cada razão, pergunte: é pertinente? é confiável? cobre o alcance?', 'Tente imaginar um contraexemplo ou uma causa alternativa.', 'Conclua com uma formulação proporcional à força da evidência.'],
    priorKnowledge: ['Reconhecer afirmações e razões em um texto.', 'Compreender que uma conclusão pode depender de mais de uma premissa.', 'Distinguir observação de recomendação.'],
    keyConcepts: ['premissas e conclusão', 'pertinência e suficiência', 'validade e verdade das premissas', 'força indutiva e representatividade', 'causalidade e explicações alternativas', 'contraexemplos e analogias', 'alcance proporcional da conclusão'],
    progression: [
      { stage: 'FOUNDATION', focus: 'Localizar conclusões, premissas e dados pertinentes.', questionIds: idsFor('PROBE') },
      { stage: 'APPLICATION', focus: 'Testar suficiência, amostras, causas e pressupostos em argumentos cotidianos.', questionIds: idsFor('PRACTICE') },
      { stage: 'TRANSFER', focus: 'Avaliar políticas e relatórios com efeitos distribuídos e evidência de alcance limitado.', questionIds: idsFor('TRANSFER') },
      { stage: 'INTEGRATION', focus: 'Distinguir validade, verdade, princípios normativos e qualidade de evidência.', questionIds: idsFor('LOCK_IN') },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Revisar argumentos em contextos novos e calibrar conclusões diante de dados mistos.', questionIds: idsFor('REVIEW') },
    ],
    microExplanations: [
      { trigger: 'PREMISE_OR_CONCLUSION', text: 'Pergunte qual afirmação o texto quer que o leitor aceite; as demais podem funcionar como razões.' },
      { trigger: 'RELEVANCE_OR_TRUTH', text: 'Uma afirmação verdadeira só ajuda se tiver relação com a conclusão em debate.' },
      { trigger: 'VALIDITY_OR_PREMISE_TRUTH', text: 'Validade examina a forma da inferência; veracidade e justificativa das premissas exigem outra checagem.' },
      { trigger: 'CORRELATION_OR_CAUSE', text: 'Uma mudança depois de outra pode sugerir hipótese; compare causas concorrentes e condições iniciais.' },
      { trigger: 'EVIDENCE_SCOPE', text: 'Compare quem foi observado com o grupo descrito na conclusão.' },
      { trigger: 'FACT_OR_NORM', text: 'Um dado descreve o que ocorre; uma recomendação também precisa explicitar critérios e valores.' },
    ],
    remediations: [
      { id: 'MAP_PREMISES', misconception: 'PREMISSA_TROCADA_POR_CONCLUSAO', prompt: 'Reescreva o texto em duas linhas: “As razões são...” e “A conclusão é...”. Que palavra ou relação indica a passagem?' },
      { id: 'TEST_ALTERNATIVE', misconception: 'CAUSALIDADE_SEM_COMPARACAO', prompt: 'Liste uma causa alternativa e diga qual comparação ou dado ajudaria a distingui-la da explicação proposta.' },
      { id: 'LIMIT_GENERALIZATION', misconception: 'ALCANCE_MAIOR_QUE_AMOSTRA', prompt: 'Descreva quem foi observado, quem não respondeu e para qual população a conclusão pretende valer.' },
      { id: 'CALIBRATE_CONCLUSION', misconception: 'DADO_DESCRITIVO_VIRA_OBRIGACAO', prompt: 'Separe o fato medido da ação recomendada. Qual critério normativo liga os dois e quais alternativas precisam ser comparadas?' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 28,
    sourceDossier: [
      {
        title: 'Informal Logic',
        publisher: 'Stanford Encyclopedia of Philosophy',
        url: 'https://plato.stanford.edu/entries/logic-informal/',
        accessedOn: '2026-10-13',
        supports: ['Análise de argumentos em contextos reais.', 'Avaliação de razões, evidências, provas e justificações.'],
        use: 'Fonte conceitual para desenvolver avaliação contextual de argumentos; não fornece alinhamento oficial BNCC.',
      },
      {
        title: 'Argument',
        publisher: 'Internet Encyclopedia of Philosophy',
        url: 'https://iep.utm.edu/argument/',
        accessedOn: '2026-10-13',
        supports: ['Reconstrução de premissas e conclusão.', 'Avaliação de argumentos fora de exemplos puramente formais.'],
        use: 'Apoio para a estrutura didática de reconstrução e avaliação; itens e exemplos do pacote são autorais.',
      },
      {
        title: 'Fallacies',
        publisher: 'Stanford Encyclopedia of Philosophy',
        url: 'https://plato.stanford.edu/entries/fallacies/',
        accessedOn: '2026-10-13',
        supports: ['Cuidado ao aplicar rótulos de falácia sem analisar o contexto e a função argumentativa.'],
        use: 'Evita tratar listas de rótulos como substituto de avaliação; revisão pedagógica humana permanece pendente.',
      },
    ],
    copyrightNote: 'Questões, exemplos e explicações deste pacote são autorais. As fontes apoiam o rigor conceitual; mapeamento oficial e revisão pedagógica humana não foram aprovados.',
  },
};

if (questions.length !== 20 || JSON.stringify(Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]))) !== JSON.stringify(purposeCounts)) {
  throw new Error('PHILOSOPHY_ARGUMENT_V5_QUESTION_COUNTS_INVALID');
}
if (answerPositionCounts.some((count, index) => count !== 5)) throw new Error('PHILOSOPHY_ARGUMENT_V5_ANSWER_POSITIONS_UNBALANCED');

export function buildPhilosophyEvaluateArgumentPack() {
  return structuredClone(pack);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Wrote ${questions.length} original argument questions and ${sourceQuestionFeedback.length} source-feedback records to ${OUTPUT}`);
}
