begin;

-- V8 is a forward-only content and planning increment. V4 questions, lessons,
-- attempts and historical snapshots remain intact; new sessions use the V8
-- pools while existing sessions continue with the question set they started.
do $v8$
declare
  v_catalog_id uuid;
  v_skill_id uuid;
  lesson_row record;
  question_row record;
  set_row record;
  question_id uuid;
  set_id uuid;
begin
  select catalog.id into v_catalog_id
    from public.learning_curriculum_catalogs catalog
   where catalog.code = 'BNCC_2018' and catalog.active
   order by catalog.version desc
   limit 1;

  if v_catalog_id is null then
    raise exception 'BNCC_2018_CATALOG_MISSING';
  end if;

  for lesson_row in
    select * from jsonb_to_recordset($lessons$
      [
        {
          "code":"EM13MAT101",
          "title":"Interpretar variações com dados, gráficos e taxas",
          "summary":"Você vai aprender a ler as grandezas de um gráfico, calcular uma taxa média e verificar se a interpretação respeita as unidades e o intervalo observado.",
          "content":"## Objetivo\n\nInterpretar como uma grandeza muda em relação a outra e justificar a leitura com dados, unidades e intervalo.\n\n## Um roteiro para ler\n\nPrimeiro identifique o que está em cada eixo e suas unidades. Depois localize dois pontos comparáveis. A variação absoluta é a diferença entre os valores de y; a taxa média divide essa diferença pela variação de x. Uma inclinação positiva indica crescimento no intervalo analisado, mas não prova que o crescimento continuará fora dele.\n\n## Exemplo resolvido\n\nUma bomba elevou o volume de um reservatório de 120 L para 180 L entre 8h e 11h. A variação foi de 60 L em 3 h. Portanto, a taxa média foi 60 ÷ 3 = 20 L/h. O resultado não é 60 L/h, porque 60 é a variação total, não a variação por hora.\n\n## Erros comuns\n\nConfundir o valor final com a taxa, esquecer de subtrair o valor inicial ou dividir pelo intervalo errado muda a resposta. Também é preciso comparar grandezas com unidades compatíveis: litros por hora não pode ser comparado diretamente com litros por minuto sem conversão.\n\n## Aplicação\n\nUse o mesmo roteiro para analisar consumo de água, custo de uma viagem ou distância percorrida. Se o contexto fornecer somente um valor final, registre que não há dados suficientes para calcular uma taxa.\n\n## Resumo\n\nEixos, unidades, dois pontos e intervalo são necessários para interpretar uma taxa. Um acerto isolado mostra uma evidência inicial; a compreensão fica mais confiável quando aparece em contextos diferentes.",
          "worked_example":"Entre 2h e 5h, a temperatura passou de 18 °C para 27 °C. A taxa média foi (27 - 18) ÷ (5 - 2) = 3 °C por hora. A unidade ajuda a explicar o significado do número.",
          "tips":["Leia os eixos e as unidades antes de calcular.","Separe variação total de taxa por unidade.","Verifique se a conclusão está limitada ao intervalo observado."]
        },
        {
          "code":"EM13LGG303",
          "title":"Construir argumentos e negociar decisões",
          "summary":"Você vai distinguir tese, razão e evidência, responder a objeções e formular propostas que considerem direitos, consequências e diferentes interlocutores.",
          "content":"## Objetivo\n\nConstruir e avaliar argumentos em debates públicos sem reduzir a discordância a um ataque pessoal ou a uma escolha por popularidade.\n\n## Como um argumento funciona\n\nA tese é a posição defendida. As razões explicam por que ela é defendida, e as evidências permitem examinar se essas razões têm apoio. Uma boa resposta reconhece a objeção, verifica o que ela mostra e apresenta uma conclusão proporcional aos dados.\n\n## Exemplo resolvido\n\nEm um debate sobre reduzir o plástico na escola, dizer que a mudança é boa é apenas uma opinião. Uma argumentação mais forte informa o volume de descarte, reconhece custos de adaptação, ouve quem será afetado e propõe uma mudança que possa ser acompanhada. A proposta continua aberta a revisão se os dados mostrarem outro efeito.\n\n## Erros comuns\n\nAtacar a pessoa não responde à razão apresentada. Repetir uma frase muitas vezes não transforma opinião em evidência. Também é um erro concluir que a maioria está certa somente porque é maioria, sem analisar direitos e consequências.\n\n## Aplicação\n\nAo analisar uma proposta, pergunte: qual é a tese, qual evidência a sustenta, quem pode ser afetado e qual objeção precisa ser respondida? Uma negociação responsável pode alterar a proposta sem abandonar seus critérios.\n\n## Resumo\n\nArgumentar é tornar uma posição examinável, responder ao que foi dito e propor uma ação justificável. Respeito é necessário, mas não substitui análise.",
          "worked_example":"Uma turma quer mudar o horário de uma atividade. A proposta fica mais justificável quando compara os horários, apresenta dados de presença, considera os grupos afetados e oferece uma alternativa negociável.",
          "tips":["Separe tese, razão e evidência.","Responda à objeção antes de concluir.","Verifique direitos, efeitos e limites da proposta."]
        },
        {
          "code":"EM13CNT101",
          "title":"Analisar sistemas, transformações e conservação",
          "summary":"Você vai delimitar um sistema, acompanhar entradas e saídas e explicar transformações de matéria, energia e movimento sem concluir que uma grandeza desapareceu sem evidência.",
          "content":"## Objetivo\n\nRepresentar transformações e conservações em situações cotidianas, deixando claro o sistema observado e as condições da previsão.\n\n## Delimite o sistema\n\nAntes de explicar uma mudança, diga o que está dentro do sistema e qual grandeza está sendo acompanhada. Energia pode mudar de forma; matéria pode ser transferida entre o sistema e o ambiente; o movimento pode mudar por causa de interações. Uma medida que diminui não basta para afirmar que a matéria foi destruída.\n\n## Exemplo resolvido\n\nEm uma lâmpada, a energia elétrica recebida é transformada principalmente em luz e calor. Se o sistema inclui apenas a lâmpada, parte da energia atravessa sua fronteira como luz e calor. Se inclui lâmpada e ambiente, é preciso acompanhar as entradas e saídas para descrever o balanço.\n\n## Erros comuns\n\nConfundir transformação com desaparecimento, ignorar a fronteira do sistema ou usar uma unidade incompatível impede uma previsão verificável. Uma tabela ou um diagrama de setas não substitui a explicação; ele torna as entradas, saídas e condições visíveis.\n\n## Aplicação\n\nAo comparar equipamentos, registre consumo, tempo de uso e condições semelhantes. Só atribua a diferença ao equipamento depois de considerar outras variáveis relevantes.\n\n## Resumo\n\nSistema, grandeza, fronteira e condições são parte da explicação. Modelos ajudam a prever, mas sempre têm limites que precisam ser declarados.",
          "worked_example":"Ao derreter gelo em um recipiente aberto, a água muda de estado, enquanto parte pode evaporar e deixar o recipiente. Para interpretar a massa medida, é necessário considerar a troca com o ambiente.",
          "tips":["Defina a fronteira do sistema.","Diferencie transformação de transferência.","Registre grandezas, unidades e condições da comparação."]
        },
        {
          "code":"EM13CHS103",
          "title":"Construir hipóteses com evidências e limites",
          "summary":"Você vai formular hipóteses examináveis, relacionar fontes à pergunta e evitar conclusões causais que os dados não sustentam.",
          "content":"## Objetivo\n\nSelecionar evidências e compor argumentos sobre processos sociais, políticos, econômicos e culturais, reconhecendo autoria, contexto, método e limites.\n\n## Da pergunta ao argumento\n\nUma hipótese é uma explicação provisória que pode ser confrontada com dados. Uma tabela pode mostrar uma associação; uma entrevista pode ajudar a compreender experiências e motivos; um documento histórico revela uma perspectiva situada. A fonte precisa ser pertinente à pergunta e não responde sozinha a tudo.\n\n## Exemplo resolvido\n\nSe o uso do transporte coletivo caiu, dados de tarifa e número de passageiros ajudam a descrever a variação. Entrevistas podem explorar razões percebidas pelos usuários. Para afirmar causalidade, ainda seria necessário considerar período, outras mudanças e como os dados foram obtidos.\n\n## Erros comuns\n\nConfundir correlação com causa, ignorar a escala de um mapa, tratar uma fonte como neutra ou generalizar um caso individual são erros comuns. A conclusão deve ser tão ampla quanto a evidência permite, e não mais ampla.\n\n## Aplicação\n\nCompare autoria, data, método e finalidade das fontes antes de combiná-las. Explique qual parte da hipótese cada evidência apoia e qual permanece incerta.\n\n## Resumo\n\nUma análise forte liga pergunta, hipótese, evidência e limite. Reconhecer incerteza não enfraquece o argumento; torna-o mais responsável.",
          "worked_example":"Um mapa mostra mais serviços em uma região. Ele sustenta a descrição da concentração no período e na escala apresentados, mas não prova sozinho sua causa. Para investigar a causa, são necessárias outras fontes e comparações.",
          "tips":["Formule uma hipótese que possa ser examinada.","Verifique autoria, data, método e escala.","Diferencie associação de explicação causal."]
        }
      ]
    $lessons$::jsonb) as item(code text, title text, summary text, content text, worked_example text, tips jsonb)
  loop
    select canonical.id into v_skill_id
      from public.learning_curriculum_skills canonical
     where canonical.catalog_id = v_catalog_id and canonical.code = lesson_row.code;
    if v_skill_id is null then raise exception 'BNCC_V8_SKILL_MISSING:%', lesson_row.code; end if;
    insert into public.learning_skill_lessons(
      canonical_skill_id, version, title, summary, content_markdown,
      worked_example, tips, estimated_minutes, active, metadata
    ) values (
      v_skill_id, 5, lesson_row.title, lesson_row.summary, lesson_row.content,
      lesson_row.worked_example, array(select jsonb_array_elements_text(lesson_row.tips)), 15, true,
      jsonb_build_object('content_pack','TECESCOLA_BNCC_DEEP_LEARNING_V8','content_version',5,'content_authoring_status','AUTHORED','pedagogical_review_status','PENDING','previous_version',4)
    ) on conflict (canonical_skill_id, version) do update set
      title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown,
      worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes,
      active = true, metadata = excluded.metadata, updated_at = now();
    update public.learning_curriculum_skills
       set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('content_pack','TECESCOLA_BNCC_DEEP_LEARNING_V8','content_version',5,'previous_content_pack','TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4'),
           updated_at = now()
     where id = v_skill_id;
  end loop;

  -- Keep a second item in each V8 purpose pool. The old item remains in V4;
  -- the transfer item with the underspecified interval is intentionally not
  -- copied into V8 and is replaced by explicit time bounds below.
  for set_row in
    select * from jsonb_to_recordset($sets$
      [
        {"code":"EM13MAT101","purpose":"PROBE","exclude":null},
        {"code":"EM13MAT101","purpose":"PRACTICE","exclude":null},
        {"code":"EM13MAT101","purpose":"TRANSFER","exclude":"em1-mat-transfer-01"},
        {"code":"EM13MAT101","purpose":"LOCK_IN","exclude":null},
        {"code":"EM13MAT101","purpose":"REVIEW","exclude":null},
        {"code":"EM13LGG303","purpose":"PROBE","exclude":null},
        {"code":"EM13LGG303","purpose":"PRACTICE","exclude":null},
        {"code":"EM13LGG303","purpose":"TRANSFER","exclude":null},
        {"code":"EM13LGG303","purpose":"LOCK_IN","exclude":null},
        {"code":"EM13LGG303","purpose":"REVIEW","exclude":null},
        {"code":"EM13CNT101","purpose":"PROBE","exclude":null},
        {"code":"EM13CNT101","purpose":"PRACTICE","exclude":null},
        {"code":"EM13CNT101","purpose":"TRANSFER","exclude":null},
        {"code":"EM13CNT101","purpose":"LOCK_IN","exclude":null},
        {"code":"EM13CNT101","purpose":"REVIEW","exclude":null},
        {"code":"EM13CHS103","purpose":"PROBE","exclude":null},
        {"code":"EM13CHS103","purpose":"PRACTICE","exclude":null},
        {"code":"EM13CHS103","purpose":"TRANSFER","exclude":null},
        {"code":"EM13CHS103","purpose":"LOCK_IN","exclude":null},
        {"code":"EM13CHS103","purpose":"REVIEW","exclude":null}
      ]
    $sets$::jsonb) as item(code text, purpose text, exclude text)
  loop
    select canonical.id into v_skill_id
      from public.learning_curriculum_skills canonical
     where canonical.catalog_id = v_catalog_id and canonical.code = set_row.code;
    if v_skill_id is null then raise exception 'BNCC_V8_SKILL_MISSING:%', set_row.code; end if;
    insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, difficulty, metadata)
    values ('GLOBAL', v_skill_id, set_row.purpose, 5, 'MEDIUM', jsonb_build_object('content_pack','TECESCOLA_BNCC_DEEP_LEARNING_V8','content_version',5,'selection_policy','UNSEEN_FIRST_LIMIT_TWO'))
    on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL'
    do update set difficulty = excluded.difficulty, metadata = excluded.metadata, active = true
    returning id into set_id;
    if set_id is null then select question_set.id into set_id from public.learning_question_sets question_set where question_set.scope='GLOBAL' and question_set.canonical_skill_id=v_skill_id and question_set.purpose=set_row.purpose and question_set.version=5; end if;
    insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
    select set_id, old_item.question_bank_id, 0
      from public.learning_question_set_items old_item
      join public.learning_question_sets old_set on old_set.id = old_item.question_set_id
      join public.learning_question_bank old_bank on old_bank.id = old_item.question_bank_id and old_bank.active
     where old_set.scope='GLOBAL' and old_set.canonical_skill_id=v_skill_id and old_set.purpose=set_row.purpose and old_set.version=4
       and (set_row.exclude is null or old_bank.metadata->>'content_id' <> set_row.exclude)
     order by old_item.position
     limit 1
    on conflict (question_set_id, position) do nothing;
  end loop;

  for question_row in
    select * from jsonb_to_recordset($questions$
      [
        {"id":"v8-mat-probe-01","code":"EM13MAT101","purpose":"PROBE","difficulty":"EASY","process":"INTERPRET","context":"TAXA_MEDIA","statement":"Uma ciclovia registra 6 km percorridos às 7h e 18 km às 9h. Mantido o comportamento médio nesse intervalo, qual foi a taxa média de distância?","options":["6 km por hora.","12 km por hora.","3 km por hora.","24 km por hora."],"correct":"6 km por hora.","explanation":"A distância aumentou 12 km em 2 horas. A taxa média é 12 ÷ 2 = 6 km por hora.","focus":"INTERVALO_DA_TAXA","hint":"Separe a variação total de distância do intervalo de tempo usado na divisão."},
        {"id":"v8-mat-practice-01","code":"EM13MAT101","purpose":"PRACTICE","difficulty":"MEDIUM","process":"ANALYZE","context":"TARIFA_E_DISTANCIA","statement":"Um aplicativo cobra R$ 8 de taxa fixa e R$ 2,50 por quilômetro. Para comparar viagens, qual informação representa a taxa de variação do custo?","options":["R$ 8, porque é o valor inicial.","R$ 2,50 por quilômetro, porque mostra quanto o custo muda a cada km.","O custo da viagem mais longa, sem considerar a distância.","A quantidade de quilômetros, independentemente do preço."],"correct":"R$ 2,50 por quilômetro, porque mostra quanto o custo muda a cada km.","explanation":"O coeficiente por quilômetro indica a mudança do custo quando a distância aumenta uma unidade.","focus":"VALOR_INICIAL_E_TAXA","hint":"Diferencie o valor inicial da inclinação ou taxa por unidade."},
        {"id":"v8-mat-transfer-01","code":"EM13MAT101","purpose":"TRANSFER","difficulty":"MEDIUM","process":"APPLY","context":"CONSUMO_DE_AGUA","statement":"Entre 8h e 11h, o consumo acumulado de água de uma escola passou de 120 L para 180 L. Mantida a média, qual foi a taxa de consumo no intervalo?","options":["20 L/h.","60 L/h.","100 L/h.","300 L/h."],"correct":"20 L/h.","explanation":"A variação foi 180 - 120 = 60 L em 11 - 8 = 3 h. Logo, 60 ÷ 3 = 20 L/h.","focus":"INTERVALO_EXPLICITO","hint":"Use os horários explicitados e não confunda a variação total com a taxa."},
        {"id":"v8-mat-transfer-02","code":"EM13MAT101","purpose":"TRANSFER","difficulty":"MEDIUM","process":"APPLY","context":"TRANSPORTE","statement":"Um ônibus percorre 45 km em 1,5 h e depois mais 30 km em 1 h. Qual é a distância média por hora em toda a viagem?","options":["30 km/h.","40 km/h.","45 km/h.","75 km/h."],"correct":"30 km/h.","explanation":"A distância total é 75 km e o tempo total é 2,5 h. A média é 75 ÷ 2,5 = 30 km/h.","focus":"MEDIA_PONDERADA_PELO_TEMPO","hint":"Some distância e tempo antes de dividir; não faça a média simples das duas velocidades."},
        {"id":"v8-mat-lock-01","code":"EM13MAT101","purpose":"LOCK_IN","difficulty":"HARD","process":"COMPARE","context":"COMPARACAO_DE_TAXAS","statement":"O plano A aumenta 24 unidades em 6 meses; o plano B aumenta 30 unidades em 10 meses. Qual conclusão é sustentada pelas taxas médias?","options":["A tem 4 unidades por mês e cresce mais rapidamente que B, com 3 por mês.","B cresce mais rapidamente porque termina com o maior aumento total.","As taxas são iguais porque ambos aumentam.","Não é possível comparar sem conhecer somente os valores finais."],"correct":"A tem 4 unidades por mês e cresce mais rapidamente que B, com 3 por mês.","explanation":"As taxas são 24 ÷ 6 = 4 e 30 ÷ 10 = 3 unidades por mês.","focus":"COMPARAR_TAXAS","hint":"Compare aumentos relativos ao mesmo tipo de intervalo, não apenas os aumentos totais."},
        {"id":"v8-mat-review-01","code":"EM13MAT101","purpose":"REVIEW","difficulty":"HARD","process":"EVALUATE","context":"LIMITES_DO_GRAFICO","statement":"Um gráfico mostra crescimento entre janeiro e junho. Qual afirmação é mais responsável?","options":["A grandeza cresceu no intervalo observado; não é possível garantir o comportamento depois de junho.","A grandeza continuará crescendo para sempre.","O valor final explica sozinho a causa do crescimento.","A escala não importa porque a linha é inclinada."],"correct":"A grandeza cresceu no intervalo observado; não é possível garantir o comportamento depois de junho.","explanation":"A evidência do gráfico sustenta uma conclusão limitada ao período representado.","focus":"EXTRAPOLACAO_INDEVIDA","hint":"Verifique o intervalo e evite transformar uma tendência observada em uma previsão garantida."},
        {"id":"v8-lgg-probe-01","code":"EM13LGG303","purpose":"PROBE","difficulty":"EASY","process":"IDENTIFY","context":"TESE_E_EVIDENCIA","statement":"Qual trecho combina uma tese com uma evidência verificável?","options":["A escola deve ampliar a biblioteca porque o registro mostra que os empréstimos dobraram.","A escola deve ampliar a biblioteca porque isso é obviamente perfeito.","Quem discorda não merece ser ouvido.","A proposta é correta porque sempre foi defendida pelo meu grupo."],"correct":"A escola deve ampliar a biblioteca porque o registro mostra que os empréstimos dobraram.","explanation":"O trecho apresenta uma posição e uma razão apoiada por um registro que pode ser examinado.","focus":"TESE_RAZAO_EVIDENCIA","hint":"Procure uma posição acompanhada de uma razão que possa ser confrontada com dados."},
        {"id":"v8-lgg-practice-01","code":"EM13LGG303","purpose":"PRACTICE","difficulty":"MEDIUM","process":"ANALYZE","context":"CONTRA_ARGUMENTO","statement":"Uma proposta recebeu a objeção de que seu custo é alto. Qual resposta argumenta melhor?","options":["Reconhecer o custo, comparar alternativas e explicar quais consequências são aceitáveis.","Dizer que a pessoa é contra o progresso e ignorar o custo.","Repetir a proposta em tom mais alto.","Mudar de assunto para uma característica pessoal do interlocutor."],"correct":"Reconhecer o custo, comparar alternativas e explicar quais consequências são aceitáveis.","explanation":"A resposta enfrenta a objeção e torna os critérios da decisão examináveis.","focus":"RESPONDER_A_OBJECOES","hint":"Responda ao argumento apresentado antes de defender novamente sua posição."},
        {"id":"v8-lgg-transfer-01","code":"EM13LGG303","purpose":"TRANSFER","difficulty":"MEDIUM","process":"APPLY","context":"DEBATE_DIGITAL","statement":"Em uma discussão online sobre uma regra da escola, qual prática favorece uma decisão responsável?","options":["Verificar a informação, reconhecer posições diferentes e propor critérios para avaliar a regra.","Compartilhar a mensagem mais indignada para obter apoio.","Excluir quem discorda antes de ler sua justificativa.","Tratar o número de curtidas como prova suficiente."],"correct":"Verificar a informação, reconhecer posições diferentes e propor critérios para avaliar a regra.","explanation":"A prática combina evidência, escuta e critérios, em vez de substituir a análise por popularidade.","focus":"POPULARIDADE_NAO_E_EVIDENCIA","hint":"Diferencie alcance de uma mensagem da qualidade das razões que ela apresenta."},
        {"id":"v8-lgg-lock-01","code":"EM13LGG303","purpose":"LOCK_IN","difficulty":"HARD","process":"EVALUATE","context":"DIREITOS_E_PROPORCIONALIDADE","statement":"Uma proposta popular restringe a participação de um grupo sem justificar a medida. Qual avaliação é mais adequada?","options":["Examinar a restrição, pedir justificativa e procurar uma alternativa proporcional aos objetivos.","Aceitar a restrição porque a maioria sempre pode limitar qualquer direito.","Rejeitar a proposta sem verificar seus efeitos ou objetivos.","Trocar a análise por um ataque ao grupo que propôs a regra."],"correct":"Examinar a restrição, pedir justificativa e procurar uma alternativa proporcional aos objetivos.","explanation":"A avaliação considera direitos, razões e proporcionalidade, não somente a popularidade.","focus":"DIREITOS_E_PROPORCIONALIDADE","hint":"Verifique se o objetivo pode ser alcançado com menor restrição e justificativa examinável."},
        {"id":"v8-lgg-review-01","code":"EM13LGG303","purpose":"REVIEW","difficulty":"HARD","process":"EVALUATE","context":"LIMITES_DA_ARGUMENTACAO","statement":"Um texto usa um único relato para afirmar que todos os estudantes pensam igual. Qual problema deve ser identificado?","options":["O exemplo pode ilustrar uma experiência, mas não sustenta sozinho uma generalização sobre todos.","Um relato individual prova qualquer conclusão sobre a escola.","Experiências pessoais nunca podem contribuir para um debate.","A conclusão é certa porque o texto está bem escrito."],"correct":"O exemplo pode ilustrar uma experiência, mas não sustenta sozinho uma generalização sobre todos.","explanation":"A força da conclusão deve corresponder ao alcance da evidência disponível.","focus":"GENERALIZACAO_INDEVIDA","hint":"Compare o tamanho da conclusão com a quantidade e a representatividade da evidência."},
        {"id":"v8-cnt-probe-01","code":"EM13CNT101","purpose":"PROBE","difficulty":"EASY","process":"IDENTIFY","context":"TRANSFORMACAO_DE_ENERGIA","statement":"Ao carregar um celular, qual descrição é compatível com transformação e conservação de energia?","options":["A energia elétrica é transformada em energia armazenada na bateria e em calor.","A energia elétrica deixa de existir sem produzir nenhum efeito.","A bateria cria matéria para aumentar sua carga.","O calor mostra que nenhuma energia foi transferida."],"correct":"A energia elétrica é transformada em energia armazenada na bateria e em calor.","explanation":"A energia pode mudar de forma e parte pode ser transferida como calor; isso não significa desaparecimento.","focus":"TRANSFORMACAO_NAO_E_DESAPARECIMENTO","hint":"Diferencie mudar de forma, atravessar a fronteira e desaparecer sem explicação."},
        {"id":"v8-cnt-practice-01","code":"EM13CNT101","purpose":"PRACTICE","difficulty":"MEDIUM","process":"ANALYZE","context":"SISTEMA_ABERTO","statement":"Uma panela aberta perde água durante o aquecimento. Qual análise é necessária para interpretar a massa medida?","options":["Considerar a água que saiu como vapor e definir se ela faz parte do sistema observado.","Concluir que a matéria foi destruída porque o número na balança diminuiu.","Ignorar o ambiente porque somente a panela importa em qualquer análise.","Assumir que toda diminuição de massa é erro de medição."],"correct":"Considerar a água que saiu como vapor e definir se ela faz parte do sistema observado.","explanation":"Em um sistema aberto, a saída de matéria pode explicar a redução medida.","focus":"FRONTEIRA_DO_SISTEMA","hint":"Antes de explicar a medida, explicite entradas, saídas e a fronteira do sistema."},
        {"id":"v8-cnt-transfer-01","code":"EM13CNT101","purpose":"TRANSFER","difficulty":"MEDIUM","process":"APPLY","context":"PREVISAO_COM_DADOS","statement":"Uma escola troca lâmpadas e quer verificar se o consumo mensal diminuiu. Qual procedimento produz uma evidência melhor?","options":["Comparar registros de consumo antes e depois, mantendo período e condições tão semelhantes quanto possível.","Escolher o mês com menor consumo e ignorar os demais.","Concluir pela aparência da lâmpada, sem medir o consumo.","Comparar meses de durações diferentes sem registrar essa diferença."],"correct":"Comparar registros de consumo antes e depois, mantendo período e condições tão semelhantes quanto possível.","explanation":"A comparação precisa registrar a grandeza, o período e condições relevantes para sustentar uma previsão.","focus":"CONTROLE_DE_CONDICOES","hint":"Uma comparação útil registra as condições que podem explicar a mudança observada."},
        {"id":"v8-cnt-lock-01","code":"EM13CNT101","purpose":"LOCK_IN","difficulty":"HARD","process":"EVALUATE","context":"MOVIMENTO_E_INTERACAO","statement":"Um carrinho acelera quando uma força resultante atua sobre ele. Qual conclusão respeita o modelo?","options":["A mudança do movimento depende da interação resultante e das condições do carrinho.","A massa desaparece durante a aceleração.","A aceleração depende somente da cor do carrinho.","Nenhuma força precisa ser considerada se o caminho for reto."],"correct":"A mudança do movimento depende da interação resultante e das condições do carrinho.","explanation":"A explicação relaciona a mudança do movimento às interações e às condições definidas.","focus":"INTERACAO_E_MODELO","hint":"Relacione a previsão às grandezas e interações do modelo, não a características irrelevantes."},
        {"id":"v8-cnt-review-01","code":"EM13CNT101","purpose":"REVIEW","difficulty":"HARD","process":"PREDICT","context":"LIMITES_DA_REPRESENTACAO","statement":"Um modelo prevê o consumo de energia de uma máquina em condições específicas. Como usar o resultado com cuidado?","options":["Aplicá-lo às condições representadas e verificar se suas hipóteses continuam válidas antes de extrapolar.","Tratá-lo como verdadeiro em qualquer ambiente e horário.","Ignorar as grandezas usadas porque todo modelo é apenas opinião.","Escolher somente o resultado que confirma a previsão inicial."],"correct":"Aplicá-lo às condições representadas e verificar se suas hipóteses continuam válidas antes de extrapolar.","explanation":"Modelos apoiam previsões dentro de condições e limites explicitados.","focus":"LIMITES_DO_MODELO","hint":"Registre as condições do modelo e verifique-as antes de usar a previsão em outro contexto."},
        {"id":"v8-chs-probe-01","code":"EM13CHS103","purpose":"PROBE","difficulty":"EASY","process":"IDENTIFY","context":"HIPOTESE_EXAMINAVEL","statement":"Qual frase apresenta uma hipótese que pode ser confrontada com dados?","options":["A redução do uso do ônibus ocorreu depois do aumento da tarifa no período estudado.","A cidade é naturalmente desorganizada e nada pode ser investigado.","Todos sabem a causa, então não é necessário buscar fontes.","O bairro é melhor porque parece mais agradável."],"correct":"A redução do uso do ônibus ocorreu depois do aumento da tarifa no período estudado.","explanation":"A relação proposta pode ser examinada com dados sobre tarifa, uso e período.","focus":"HIPOTESE_EXAMINAVEL","hint":"Uma hipótese precisa indicar uma relação que possa ser confrontada com evidências."},
        {"id":"v8-chs-practice-01","code":"EM13CHS103","purpose":"PRACTICE","difficulty":"MEDIUM","process":"SELECT","context":"EVIDENCIA_PERTINENTE","statement":"Uma pesquisa compara acesso à internet entre bairros. Qual evidência é diretamente pertinente?","options":["Uma tabela com acesso por bairro, período e critério de comparação explicitados.","Uma opinião sobre qual bairro é mais bonito.","Uma fotografia sem data, local ou legenda.","Um dado de outro país sem explicar por que a comparação é válida."],"correct":"Uma tabela com acesso por bairro, período e critério de comparação explicitados.","explanation":"A tabela responde diretamente à pergunta e torna o critério de comparação verificável.","focus":"PERTINENCIA_DA_FONTE","hint":"Relacione a evidência à pergunta e confira se seu método permite a comparação."},
        {"id":"v8-chs-transfer-01","code":"EM13CHS103","purpose":"TRANSFER","difficulty":"MEDIUM","process":"ANALYZE","context":"CORRELACAO_E_CAUSALIDADE","statement":"Duas variáveis aumentaram no mesmo período. Qual conclusão é mais cuidadosa?","options":["Há uma associação no período; são necessárias outras evidências para avaliar se uma causou a outra.","Uma variável certamente causou a outra porque ambas cresceram.","A associação prova qualquer explicação que pareça plausível.","Se há associação, não é preciso conhecer os dados ou o método."],"correct":"Há uma associação no período; são necessárias outras evidências para avaliar se uma causou a outra.","explanation":"A coincidência temporal pode sugerir uma relação, mas não prova causalidade por si só.","focus":"CORRELACAO_NAO_E_CAUSALIDADE","hint":"Separe o que os dados mostram do que ainda precisa ser investigado sobre a causa."},
        {"id":"v8-chs-lock-01","code":"EM13CHS103","purpose":"LOCK_IN","difficulty":"HARD","process":"COMPARE","context":"AUTORIA_E_CONTEXTO","statement":"Duas fontes descrevem uma política pública de forma diferente. O que deve ser comparado antes da conclusão?","options":["Autoria, data, finalidade, evidências usadas e limites de cada fonte.","Somente qual fonte é mais antiga.","A fonte que usa palavras mais emocionais.","As frases das duas fontes, sem considerar seus contextos."],"correct":"Autoria, data, finalidade, evidências usadas e limites de cada fonte.","explanation":"A comparação crítica considera como e por que cada fonte foi produzida.","focus":"AUTORIA_E_CONTEXTO","hint":"Pergunte quem produziu a fonte, para qual finalidade e que evidências ela realmente apresenta."},
        {"id":"v8-chs-review-01","code":"EM13CHS103","purpose":"REVIEW","difficulty":"HARD","process":"EVALUATE","context":"GENERALIZACAO_DE_FONTE","statement":"Uma entrevista relata a experiência de uma moradora. Qual uso é metodologicamente mais cuidadoso?","options":["Usá-la para compreender aquela experiência e articulá-la a outras fontes antes de generalizar.","Tratá-la como prova da experiência de todos os moradores.","Descartá-la porque fontes qualitativas nunca têm valor.","Usá-la para confirmar a conclusão sem verificar data ou contexto."],"correct":"Usá-la para compreender aquela experiência e articulá-la a outras fontes antes de generalizar.","explanation":"A entrevista oferece uma perspectiva relevante, mas seu alcance precisa ser articulado a outras evidências.","focus":"ALCANCE_DA_EVIDENCIA","hint":"Defina o que a fonte permite compreender e não amplie sua conclusão além do que ela representa."}
      ]
    $questions$::jsonb) as item(id text, code text, purpose text, difficulty text, process text, context text, statement text, options jsonb, correct text, explanation text, focus text, hint text)
  loop
    select canonical.id into v_skill_id
      from public.learning_curriculum_skills canonical
     where canonical.catalog_id = v_catalog_id and canonical.code = question_row.code;
    if v_skill_id is null then raise exception 'BNCC_V8_SKILL_MISSING:%', question_row.code; end if;
    select id into question_id from public.learning_question_bank where source_type='TECESCOLA_BNCC_EM_V8' and metadata->>'content_id'=question_row.id limit 1;
    if question_id is null then
      insert into public.learning_question_bank(
        package_type, source_type, source_name, subject_area, domain, topic,
        statement, options, correct_answer, explanation, difficulty, cognitive_process,
        context_family, knowledge_mapping_status, knowledge_mapping_version,
        estimated_minutes, provenance, metadata, active, version
      ) values (
        'TECESCOLA', 'TECESCOLA_BNCC_EM_V8', 'TecEscola BNCC Deep Learning V8',
        (select canonical.subject_area from public.learning_curriculum_skills canonical where canonical.id=v_skill_id),
        (select canonical.domain from public.learning_curriculum_skills canonical where canonical.id=v_skill_id), lower(question_row.code),
        question_row.statement, question_row.options, to_jsonb(question_row.correct), question_row.explanation,
        question_row.difficulty, question_row.process, question_row.context, 'READY', 'V8', 5,
        'TECESCOLA_BNCC_AUTHORED_V8',
        jsonb_build_object(
          'content_id', question_row.id, 'purpose', question_row.purpose, 'primary_skill', question_row.code,
          'content_pack', 'TECESCOLA_BNCC_DEEP_LEARNING_V8', 'content_version', 5,
          'content_authoring_status', 'AUTHORED', 'pedagogical_review_status', 'PENDING',
          'error_focus', question_row.focus, 'remediation_hint', question_row.hint,
          'recommended_grade', 1
        ), true, 5
      ) returning id into question_id;
    else
      update public.learning_question_bank set statement=question_row.statement, options=question_row.options,
        correct_answer=to_jsonb(question_row.correct), explanation=question_row.explanation,
        difficulty=question_row.difficulty, cognitive_process=question_row.process, context_family=question_row.context,
        knowledge_mapping_status='READY', knowledge_mapping_version='V8', active=true, version=5,
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('error_focus',question_row.focus,'remediation_hint',question_row.hint,'content_pack','TECESCOLA_BNCC_DEEP_LEARNING_V8','content_version',5), updated_at=now()
      where id=question_id;
    end if;
    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
    values (question_id, v_skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;
    select question_set.id into set_id from public.learning_question_sets question_set where question_set.scope='GLOBAL' and question_set.canonical_skill_id=v_skill_id and question_set.purpose=question_row.purpose and question_set.version=5;
    insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
    values (set_id, question_id, (select coalesce(max(position),-1)+1 from public.learning_question_set_items where question_set_id=set_id))
    on conflict (question_set_id, question_bank_id) do nothing;
  end loop;
end;
$v8$;

-- Discovery reports the newest content version rather than the original V4
-- count, while retaining the same server-side enrollment and BNCC gates.
create or replace function public.list_student_guided_learning_targets(
  p_institution_id uuid,
  p_student_id uuid
)
returns table(
  target_canonical_skill_id uuid, subject_id uuid, catalog_id uuid, catalog_code text,
  official_code text, title text, subject_area text, stage text, grade_level smallint,
  availability_status text, progress numeric, has_lesson boolean, question_count integer,
  active_session_id uuid, active_session_status text, reason text
)
language sql stable security definer set search_path = ''
as $$
  with enrollment_context as (
    select distinct on (enrollment.student_id, enrollment.class_id)
      enrollment.student_id, enrollment.class_id, normalized.value->>'stage' as stage,
      nullif(normalized.value->>'grade_level','')::smallint as parsed_grade
    from public.enrollments enrollment
    join public.classes class on class.id=enrollment.class_id and class.institution_id=p_institution_id and class.active
    cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
    where enrollment.student_id=p_student_id and enrollment.active and enrollment.status='active'
    order by enrollment.student_id, enrollment.class_id, enrollment.updated_at desc
  ), skills as (
    select distinct skill.id, null::uuid as subject_id, skill.catalog_id, catalog.code as catalog_code,
      skill.metadata->>'official_code' as official_code, skill.title, skill.subject_area, target.stage, target.grade_level,
      skill.content_readiness, skill.mastery_targetable,
      (select count(*)::integer from public.learning_skill_lessons lesson where lesson.canonical_skill_id=skill.id and lesson.active and lesson.version=(select max(latest.version) from public.learning_skill_lessons latest where latest.canonical_skill_id=skill.id and latest.active)) > 0 as has_lesson,
      (select count(*)::integer from public.learning_question_set_items item join public.learning_question_sets question_set on question_set.id=item.question_set_id and question_set.scope='GLOBAL' and question_set.version=(select max(latest.version) from public.learning_question_sets latest where latest.canonical_skill_id=skill.id and latest.scope='GLOBAL' and latest.active) and question_set.active where question_set.canonical_skill_id=skill.id) as question_count,
      state.mastery_estimate as progress, session.id as active_session_id, session.status as active_session_status
    from enrollment_context context
    join public.learning_curriculum_grade_targets target on target.stage=context.stage and target.grade_level=context.parsed_grade and target.active
    join public.learning_curriculum_skills skill on skill.id=target.canonical_skill_id and skill.active and skill.node_kind='LEAF' and skill.bncc_alignment_status='MAPPED'
    join public.learning_curriculum_catalogs catalog on catalog.id=skill.catalog_id and catalog.active and catalog.code='BNCC_2018'
    left join public.learning_student_skill_state state on state.institution_id=p_institution_id and state.student_id=p_student_id and state.canonical_skill_id=skill.id
    left join lateral (select guided.id, guided.status from public.learning_guided_sessions guided where guided.institution_id=p_institution_id and guided.student_id=p_student_id and guided.target_canonical_skill_id=skill.id and guided.status in ('ACTIVE','PAUSED') order by guided.updated_at desc limit 1) session on true
    where context.stage is not null and context.parsed_grade is not null
  )
  select skills.id, skills.subject_id, skills.catalog_id, skills.catalog_code, skills.official_code, skills.title, skills.subject_area, skills.stage, skills.grade_level,
    case when skills.content_readiness<>'ADAPTIVE_READY' or not skills.has_lesson then 'NO_LESSON' when skills.question_count=0 then 'NO_QUESTIONS' when skills.active_session_id is null then 'NO_ACTIVE_SESSION' else 'READY' end,
    coalesce(skills.progress,0), skills.has_lesson, skills.question_count, skills.active_session_id, skills.active_session_status,
    case when skills.content_readiness<>'ADAPTIVE_READY' or not skills.has_lesson then 'BNCC skill mapped, but the published lesson is not ready.' when skills.question_count=0 then 'BNCC skill mapped, but no published exercises are available.' when skills.active_session_id is null then 'No active guided session.' else 'Guided session available.' end
  from skills where private.learning_v2_scope_student(p_institution_id,p_student_id)
  order by skills.subject_area, skills.grade_level, skills.title;
$$;

-- New sessions begin with a real probe. Existing active or paused sessions
-- are returned unchanged, so Laura's current progress and history are safe.
create or replace function public.start_guided_learning_session_v4(p_institution_id uuid, p_student_id uuid, p_target_canonical_skill_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare target_skill public.learning_curriculum_skills%rowtype; existing public.learning_guided_sessions%rowtype; created public.learning_guided_sessions%rowtype; first_lesson uuid; first_step uuid; question_set uuid; target_subject_id uuid; enrollment_class_id uuid; target_institution_skill_id uuid; v8_demo boolean;
begin
  if not private.learning_v2_scope_student(p_institution_id,p_student_id) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  select skill.* into target_skill from public.learning_curriculum_skills skill where skill.id=p_target_canonical_skill_id and skill.active and skill.node_kind='LEAF' and skill.content_readiness='ADAPTIVE_READY' and skill.mastery_targetable;
  if not found then raise exception 'LEARNING_V4_TARGET_NOT_READY'; end if;
  v8_demo := target_skill.code in ('EM13MAT101','EM13LGG303','EM13CNT101','EM13CHS103');
  select session.* into existing from public.learning_guided_sessions session where session.institution_id=p_institution_id and session.student_id=p_student_id and session.target_canonical_skill_id=p_target_canonical_skill_id and session.status in ('ACTIVE','PAUSED') order by session.updated_at desc limit 1;
  if found and existing.planner_version='V4' then return jsonb_build_object('session_id',existing.id,'created',false,'current_step_id',existing.current_step_id,'engine_version','V4'); end if;
  if found then raise exception 'LEARNING_V4_EXISTING_SESSION_OTHER_ENGINE' using detail='An active or paused V2/V3 session owns this target; continue it with the V2-compatible service fallback.'; end if;
  select link.learning_skill_id, unit.subject_id into target_institution_skill_id, target_subject_id from public.learning_skill_canonical_links link join public.learning_skills skill on skill.id=link.learning_skill_id and skill.active join public.learning_units unit on unit.id=skill.unit_id and unit.active where link.institution_id=p_institution_id and link.canonical_skill_id=p_target_canonical_skill_id and link.active order by link.created_at limit 1;
  select enrollment.class_id into enrollment_class_id from public.enrollments enrollment where enrollment.student_id=p_student_id and enrollment.active and enrollment.status='active' order by enrollment.created_at desc limit 1;

  if not v8_demo then
    select lesson.id into first_lesson from public.learning_skill_lessons lesson where lesson.canonical_skill_id=p_target_canonical_skill_id and lesson.version=4 and lesson.active order by lesson.id limit 1;
    if first_lesson is null then
      select set_row.id into question_set from public.learning_question_sets set_row where set_row.scope='GLOBAL' and set_row.institution_id is null and set_row.teacher_profile_id is null and set_row.canonical_skill_id=p_target_canonical_skill_id and set_row.purpose='PROBE' and set_row.version=4 and set_row.active and exists (select 1 from public.learning_question_set_items item join public.learning_question_bank bank on bank.id=item.question_bank_id and bank.active where item.question_set_id=set_row.id) limit 1;
      if question_set is null then raise exception 'LEARNING_V4_QUESTION_SET_EMPTY'; end if;
    end if;
    insert into public.learning_guided_sessions(institution_id,student_id,target_canonical_skill_id,original_target_canonical_skill_id,current_canonical_skill_id,target_institution_skill_id,subject_id,class_id,planner_version,decision_reason,metadata)
    values (p_institution_id,p_student_id,p_target_canonical_skill_id,p_target_canonical_skill_id,p_target_canonical_skill_id,target_institution_skill_id,target_subject_id,enrollment_class_id,'V4','V4_TARGET_READY',jsonb_build_object('engine_version','V4','decision_reason','V4_TARGET_READY','replan_count',0)) returning * into created;
    insert into public.learning_guided_steps(institution_id,session_id,canonical_skill_id,step_type,purpose,position,status,lesson_id,question_set_id,started_at)
    values (p_institution_id,created.id,p_target_canonical_skill_id,case when first_lesson is null then 'PROBE' else 'LESSON' end,case when first_lesson is null then 'PROBE' else null end,0,'ACTIVE',first_lesson,question_set,now()) returning id into first_step;
    update public.learning_guided_sessions set current_step_id=first_step where id=created.id;
    insert into public.learning_guided_session_events(institution_id,session_id,student_id,event_type,step_id,idempotency_key,payload) values (p_institution_id,created.id,p_student_id,'SESSION_STARTED',first_step,'v4-session-start:'||created.id::text,jsonb_build_object('engine_version','V4','decision_reason','V4_TARGET_READY'));
    insert into public.learning_guided_session_events(institution_id,session_id,student_id,event_type,step_id,idempotency_key,payload) values (p_institution_id,created.id,p_student_id,'STEP_STARTED',first_step,'v4-step-start:'||first_step::text,jsonb_build_object('step_type',case when first_lesson is null then 'PROBE' else 'LESSON' end));
    return jsonb_build_object('session_id',created.id,'created',true,'current_step_id',first_step,'engine_version','V4');
  end if;

  select set_row.id into question_set from public.learning_question_sets set_row where set_row.scope='GLOBAL' and set_row.institution_id is null and set_row.teacher_profile_id is null and set_row.canonical_skill_id=p_target_canonical_skill_id and set_row.purpose='PROBE' and set_row.active and exists (select 1 from public.learning_question_set_items item join public.learning_question_bank bank on bank.id=item.question_bank_id and bank.active where item.question_set_id=set_row.id) order by set_row.version desc, set_row.id limit 1;
  if question_set is null then raise exception 'LEARNING_V4_QUESTION_SET_EMPTY'; end if;
  insert into public.learning_guided_sessions(institution_id,student_id,target_canonical_skill_id,original_target_canonical_skill_id,current_canonical_skill_id,target_institution_skill_id,subject_id,class_id,planner_version,decision_reason,metadata)
  values (p_institution_id,p_student_id,p_target_canonical_skill_id,p_target_canonical_skill_id,p_target_canonical_skill_id,target_institution_skill_id,target_subject_id,enrollment_class_id,'V4','PROBE_REQUIRED',jsonb_build_object('engine_version','V4','adaptive_policy_version','V8','content_version',5,'decision_reason','PROBE_REQUIRED','replan_count',0)) returning * into created;
  insert into public.learning_guided_steps(institution_id,session_id,canonical_skill_id,step_type,purpose,position,status,lesson_id,question_set_id,started_at)
  values (p_institution_id,created.id,p_target_canonical_skill_id,'PROBE','PROBE',0,'ACTIVE',null,question_set,now()) returning id into first_step;
  update public.learning_guided_sessions set current_step_id=first_step where id=created.id;
  insert into public.learning_guided_session_events(institution_id,session_id,student_id,event_type,step_id,idempotency_key,payload) values (p_institution_id,created.id,p_student_id,'SESSION_STARTED',first_step,'v8-session-start:'||created.id::text,jsonb_build_object('engine_version','V4','content_version',5,'decision_reason','PROBE_REQUIRED'));
  insert into public.learning_guided_session_events(institution_id,session_id,student_id,event_type,step_id,idempotency_key,payload) values (p_institution_id,created.id,p_student_id,'STEP_STARTED',first_step,'v8-step-start:'||first_step::text,jsonb_build_object('step_type','PROBE','content_version',5));
  return jsonb_build_object('session_id',created.id,'created',true,'current_step_id',first_step,'engine_version','V4');
end;
$$;

-- Prefer questions not answered by this student in the same purpose. When a
-- pool is exhausted, fall back to the full pool rather than blocking study.
create or replace function public.get_guided_learning_step_v4(p_step_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare step_row public.learning_guided_steps%rowtype; session_row public.learning_guided_sessions%rowtype; result jsonb;
begin
  select step.* into step_row from public.learning_guided_steps step join public.learning_guided_sessions session on session.id=step.session_id where step.id=p_step_id and session.planner_version='V4';
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  select session.* into session_row from public.learning_guided_sessions session where session.id=step_row.session_id;
  if not private.learning_v2_scope_student(session_row.institution_id,session_row.student_id) then raise exception 'LEARNING_STEP_SCOPE_DENIED'; end if;
  if coalesce(session_row.metadata->>'adaptive_policy_version','') <> 'V8' then
    select jsonb_build_object(
      'id',step_row.id,'session_id',step_row.session_id,'canonical_skill_id',step_row.canonical_skill_id,'step_type',step_row.step_type,'purpose',step_row.purpose,'status',step_row.status,'position',step_row.position,'lesson_id',step_row.lesson_id,
      'lesson',(select jsonb_build_object('id',lesson.id,'title',lesson.title,'summary',lesson.summary,'content_markdown',lesson.content_markdown,'worked_example',lesson.worked_example,'tips',lesson.tips,'estimated_minutes',lesson.estimated_minutes) from public.learning_skill_lessons lesson where lesson.id=step_row.lesson_id),
      'questions',coalesce((select jsonb_agg(jsonb_build_object('id',question.id,'statement',question.statement,'options',question.options,'difficulty',question.difficulty,'position',item.position) order by item.position) from public.learning_question_set_items item join public.learning_question_bank question on question.id=item.question_bank_id and question.active where item.question_set_id=step_row.question_set_id and not exists (select 1 from public.learning_guided_step_attempts previous_attempt where previous_attempt.step_id=step_row.id and exists (select 1 from jsonb_array_elements(previous_attempt.answers) answer where answer->>'question_bank_id'=question.id::text))), '[]'::jsonb)
    ) into result;
    return result;
  end if;
  select jsonb_build_object(
    'id',step_row.id,'session_id',step_row.session_id,'canonical_skill_id',step_row.canonical_skill_id,'step_type',step_row.step_type,'purpose',step_row.purpose,'status',step_row.status,'position',step_row.position,'lesson_id',step_row.lesson_id,
    'curriculum',(select jsonb_build_object('official_code',skill.metadata->>'official_code','title',skill.title,'description',skill.description,'subject_area',skill.subject_area,'stage',skill.stage,'official_grade_range',skill.metadata->>'official_grade_range','recommended_grade',skill.metadata->>'recommended_grade','recommended_grade_source',skill.metadata->>'recommended_grade_source','official_source_url',skill.metadata->>'official_source_url','official_source_page',skill.metadata->>'official_source_page') from public.learning_curriculum_skills skill where skill.id=step_row.canonical_skill_id),
    'lesson',(select jsonb_build_object('id',lesson.id,'title',lesson.title,'summary',lesson.summary,'content_markdown',lesson.content_markdown,'worked_example',lesson.worked_example,'tips',lesson.tips,'estimated_minutes',lesson.estimated_minutes) from public.learning_skill_lessons lesson where lesson.id=step_row.lesson_id),
    'questions',coalesce((select jsonb_agg(selected.payload order by selected.position) from (select item.position, jsonb_build_object('id',question.id,'statement',question.statement,'options',question.options,'difficulty',question.difficulty,'position',item.position) as payload from public.learning_question_set_items item join public.learning_question_bank question on question.id=item.question_bank_id and question.active where item.question_set_id=step_row.question_set_id and (not exists (select 1 from public.learning_question_set_items available where available.question_set_id=step_row.question_set_id and not exists (select 1 from public.learning_guided_step_attempts prior_attempt join public.learning_guided_steps prior_step on prior_step.id=prior_attempt.step_id join public.learning_guided_sessions prior_session on prior_session.id=prior_attempt.session_id where prior_session.institution_id=session_row.institution_id and prior_session.student_id=session_row.student_id and prior_step.canonical_skill_id=step_row.canonical_skill_id and prior_attempt.purpose=step_row.purpose and exists (select 1 from jsonb_array_elements(prior_attempt.answers) answer where answer->>'question_bank_id'=available.question_bank_id::text))) or not exists (select 1 from public.learning_guided_step_attempts prior_attempt join public.learning_guided_steps prior_step on prior_step.id=prior_attempt.step_id join public.learning_guided_sessions prior_session on prior_session.id=prior_attempt.session_id where prior_session.institution_id=session_row.institution_id and prior_session.student_id=session_row.student_id and prior_step.canonical_skill_id=step_row.canonical_skill_id and prior_attempt.purpose=step_row.purpose and exists (select 1 from jsonb_array_elements(prior_attempt.answers) answer where answer->>'question_bank_id'=question.id::text))) order by md5(question.id::text||session_row.id::text) limit 2) selected), '[]'::jsonb)
  ) into result;
  if step_row.step_type in ('PROBE','PRACTICE','TRANSFER','LOCK_IN','REVIEW') and jsonb_array_length(result->'questions')=0 then raise exception 'LEARNING_V4_QUESTION_SET_EMPTY'; end if;
  return result;
end;
$$;

create or replace function public.submit_guided_learning_step_v4(p_step_id uuid, p_answers jsonb, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare step_row public.learning_guided_steps%rowtype; session_row public.learning_guided_sessions%rowtype; item record; answer_item jsonb; expected jsonb; submitted jsonb; correct boolean; total integer:=0; correct_count integer:=0; score numeric(5,2); feedback jsonb:='[]'::jsonb; attempt_id uuid; next_step uuid; outcome text; remediation_hint text; error_focus text;
begin
  select step.* into step_row from public.learning_guided_steps step where step.id=p_step_id for update;
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  select session.* into session_row from public.learning_guided_sessions session where session.id=step_row.session_id and session.planner_version='V4';
  if not found or not private.learning_v2_scope_student(session_row.institution_id,session_row.student_id) then raise exception 'LEARNING_STEP_SCOPE_DENIED'; end if;
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array' then raise exception 'LEARNING_GUIDED_ANSWERS_INVALID'; end if;
  select attempt.id into attempt_id from public.learning_guided_step_attempts attempt where attempt.step_id=p_step_id and attempt.idempotency_key=p_idempotency_key;
  if attempt_id is not null then return (select jsonb_build_object('attempt_id',attempt.id,'idempotent',true,'score',attempt.score,'correct_count',attempt.correct_count,'total_questions',attempt.total_questions,'feedback',attempt.feedback,'current_step_id',(select current_step_id from public.learning_guided_sessions where id=attempt.session_id),'session_status',(select status from public.learning_guided_sessions where id=attempt.session_id)) from public.learning_guided_step_attempts attempt where attempt.id=attempt_id); end if;
  if step_row.status in ('COMPLETED','SKIPPED') then raise exception 'LEARNING_GUIDED_STEP_ALREADY_COMPLETED'; end if;
  for item in select bank.id, bank.correct_answer, bank.explanation, bank.metadata, set_item.position from public.learning_question_set_items set_item join public.learning_question_bank bank on bank.id=set_item.question_bank_id and bank.active where set_item.question_set_id=step_row.question_set_id order by set_item.position loop
    total:=total+1;
    select value into answer_item from jsonb_array_elements(p_answers) value where value->>'question_bank_id'=item.id::text limit 1;
    submitted:=coalesce(answer_item->'answer','null'::jsonb); expected:=coalesce(item.correct_answer,'null'::jsonb); correct:=submitted=expected;
    if correct then correct_count:=correct_count+1; end if;
    error_focus:=case when not correct then item.metadata->>'error_focus' else null end;
    remediation_hint:=case when not correct then item.metadata->>'remediation_hint' else null end;
    feedback:=feedback||jsonb_build_array(jsonb_build_object('question_bank_id',item.id,'is_correct',correct,'correct_answer',item.correct_answer,'explanation',item.explanation,'error_focus',error_focus,'remediation_hint',remediation_hint));
  end loop;
  if total=0 then raise exception 'LEARNING_V4_QUESTION_SET_EMPTY'; end if;
  score:=round((correct_count::numeric/total::numeric)*100,2);
  insert into public.learning_guided_step_attempts(institution_id,session_id,step_id,student_id,purpose,answers,feedback,score,correct_count,total_questions,idempotency_key) values (session_row.institution_id,session_row.id,step_row.id,session_row.student_id,step_row.purpose,p_answers,feedback,score,correct_count,total,p_idempotency_key) returning id into attempt_id;
  insert into public.learning_skill_evidence(institution_id,student_id,canonical_skill_id,source,correct,score,metadata) values (session_row.institution_id,session_row.student_id,step_row.canonical_skill_id,case step_row.purpose when 'PROBE' then 'DIAGNOSTIC' else step_row.purpose end,score>=80,score,jsonb_build_object('engine_version','V4','content_version',5,'guided_step_id',step_row.id,'guided_attempt_id',attempt_id,'purpose',step_row.purpose,'feedback',feedback));
  perform private.refresh_learning_student_skill_state_v2(session_row.institution_id,session_row.student_id,step_row.canonical_skill_id);
  update public.learning_guided_steps set status='COMPLETED',completed_at=now(),evidence_run_id=attempt_id,updated_at=now() where id=step_row.id;
  insert into public.learning_guided_session_events(institution_id,session_id,student_id,event_type,step_id,idempotency_key,payload) values (session_row.institution_id,session_row.id,session_row.student_id,'EVIDENCE_RECORDED',step_row.id,p_idempotency_key,jsonb_build_object('score',score,'purpose',step_row.purpose,'engine_version','V4','content_version',5));
  outcome:=case when score>=80 then 'SUCCESS' else 'GAP' end;
  next_step:=private.append_guided_v4_next_step(session_row,step_row,outcome,p_idempotency_key||':next');
  return jsonb_build_object('attempt_id',attempt_id,'idempotent',false,'score',score,'correct_count',correct_count,'total_questions',total,'feedback',feedback,'current_step_id',next_step,'session_status',(select status from public.learning_guided_sessions where id=session_row.id));
end;
$$;

revoke all on function public.start_guided_learning_session_v4(uuid,uuid,uuid), public.get_guided_learning_step_v4(uuid), public.submit_guided_learning_step_v4(uuid,jsonb,text), public.list_student_guided_learning_targets(uuid,uuid) from public, anon;
grant execute on function public.start_guided_learning_session_v4(uuid,uuid,uuid), public.get_guided_learning_step_v4(uuid), public.submit_guided_learning_step_v4(uuid,jsonb,text), public.list_student_guided_learning_targets(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
