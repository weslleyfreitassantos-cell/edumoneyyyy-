begin;

-- The official Ensino Medio descriptors cover years 1-3. The grade-1 target
-- below is an explicit TecEscola pedagogical placement, never an invented
-- official grade assignment.
do $$
declare
  v_catalog_id uuid;
  target_id uuid;
  set_id uuid;
  question_id uuid;
  content_row record;
  question_row record;
  official_url constant text := 'https://basenacionalcomum.mec.gov.br/images/historico/BNCC_EnsinoMedio_embaixa_site_110518.pdf';
begin
  select id into v_catalog_id
    from public.learning_curriculum_catalogs
   where code = 'BNCC_2018' and active
   order by version desc
   limit 1;

  if v_catalog_id is null then
    raise exception 'BNCC_2018_CATALOG_MISSING';
  end if;

  for content_row in
    select * from jsonb_to_recordset($json$
      [
        {
          "code": "EM13MAT101",
          "subject_area": "MATEMATICA",
          "domain": "VARIACAO_E_GRAFICOS",
          "title": "Interpretar variações por gráficos e taxas",
          "description": "Interpretar situações econômicas, sociais e das Ciências da Natureza que envolvem a variação de duas grandezas, pela análise dos gráficos das funções representadas e das taxas de variação com ou sem apoio de tecnologias digitais.",
          "component_code": "MAT",
          "source_page": 101,
          "lesson_title": "Ler variações em gráficos",
          "lesson_summary": "Gráficos relacionam grandezas; a taxa de variação ajuda a comparar como uma grandeza muda quando a outra avança.",
          "lesson_content": "## Como ler uma variação\n\nPara interpretar um gráfico, identifique o que cada eixo representa, observe a unidade e compare dois pontos. A taxa média de variação entre os pontos (x1, y1) e (x2, y2) é (y2 - y1) dividido por (x2 - x1). Ela descreve quanto y muda, em média, para cada unidade de x.\n\nUma reta crescente indica aumento; uma reta decrescente indica redução. A inclinação não deve ser lida sem as unidades dos eixos, porque 2 litros por minuto e 2 reais por produto representam taxas diferentes.",
          "worked_example": "Uma caixa tinha 10 kg no instante 0 e 18 kg no instante 4. A variação média foi (18 - 10) / (4 - 0) = 2 kg por unidade de tempo.",
          "tips": ["Leia as unidades dos eixos.", "Escolha dois pontos identificáveis.", "Calcule a variação de y dividida pela variação de x."],
          "source_context_status": "EXCERPT_ONLY",
          "questions": [
            {"id":"em1-mat-probe-01","purpose":"PROBE","difficulty":"EASY","cognitive_process":"INTERPRET","context_family":"TAXA_MEDIA","statement":"Uma grandeza passa de 10 para 18 quando o tempo vai de 0 para 4 horas. Qual é a taxa média de variação?","options":["2 unidades por hora.","4 unidades por hora.","8 unidades por hora.","28 unidades por hora."],"correct":"2 unidades por hora.","explanation":"A taxa média é (18 - 10) / (4 - 0) = 2 unidades por hora."},
            {"id":"em1-mat-practice-01","purpose":"PRACTICE","difficulty":"MEDIUM","cognitive_process":"ANALYZE","context_family":"CUSTO_E_QUANTIDADE","statement":"Uma atividade cobra R$ 200 de taxa fixa e R$ 15 por ingresso. No gráfico do custo em função da quantidade de ingressos, o que representa o valor 15?","options":["A taxa de variação do custo a cada ingresso.","O custo fixo quando nenhum ingresso é comprado.","O custo total de 15 ingressos.","A quantidade máxima de ingressos."],"correct":"A taxa de variação do custo a cada ingresso.","explanation":"O 15 indica quanto o custo aumenta quando a quantidade de ingressos aumenta uma unidade."},
            {"id":"em1-mat-transfer-01","purpose":"TRANSFER","difficulty":"MEDIUM","cognitive_process":"APPLY","context_family":"CONSUMO_DE_AGUA","statement":"Uma escola consumiu 120 litros de água em uma manhã e 180 litros em três horas. Mantida a média, qual foi a variação horária do consumo nesse intervalo?","options":["20 litros por hora.","60 litros por hora.","100 litros por hora.","300 litros por hora."],"correct":"20 litros por hora.","explanation":"A variação foi de 60 litros em 3 horas, portanto 60 / 3 = 20 litros por hora."},
            {"id":"em1-mat-lock-01","purpose":"LOCK_IN","difficulty":"HARD","cognitive_process":"INTERPRET","context_family":"GRAFICO_LINEAR","statement":"Uma reta passa pelos pontos (0, 5) e (4, 13). Qual interpretação está correta?","options":["A grandeza começa em 5 e cresce 2 unidades por unidade de x.","A grandeza começa em 4 e cresce 8 unidades por unidade de x.","A grandeza começa em 13 e diminui 5 unidades por unidade de x.","A grandeza não varia porque os pontos estão em uma reta."],"correct":"A grandeza começa em 5 e cresce 2 unidades por unidade de x.","explanation":"O valor inicial é 5 e a taxa é (13 - 5) / 4 = 2."},
            {"id":"em1-mat-review-01","purpose":"REVIEW","difficulty":"HARD","cognitive_process":"EVALUATE","context_family":"COMPARACAO_DE_TAXAS","statement":"Dois gráficos terminam no mesmo valor, mas um deles cresce mais rapidamente no intervalo observado. O que deve ser comparado?","options":["As taxas de variação, considerando as unidades dos eixos.","Somente o valor final, pois ele resume todo o gráfico.","A cor das linhas, pois ela indica a velocidade.","A quantidade de pontos, sem observar seus valores."],"correct":"As taxas de variação, considerando as unidades dos eixos.","explanation":"A taxa permite comparar o ritmo da mudança e precisa ser interpretada com as unidades."}
          ]
        },
        {
          "code": "EM13LGG303",
          "subject_area": "LINGUAGENS",
          "domain": "DEBATE_E_ARGUMENTACAO",
          "title": "Debater com argumentos e responsabilidade",
          "description": "Debater questões polêmicas de relevância social, analisando diferentes argumentos e opiniões manifestados, para negociar e sustentar posições, formular propostas, e intervir e tomar decisões democraticamente sustentadas, que levem em conta o bem comum e os Direitos Humanos, a consciência socioambiental e o consumo responsável em âmbito local, regional e global.",
          "component_code": "LGG",
          "source_page": 61,
          "lesson_title": "Construir um debate responsável",
          "lesson_summary": "Debater não é apenas defender uma opinião: é analisar posições, apresentar razões e evidências, ouvir objeções e formular propostas responsáveis.",
          "lesson_content": "## Argumentar em situações polêmicas\n\nUma posição argumentada apresenta uma tese, razões que a sustentam e evidências que permitem avaliá-la. Em um debate, também é necessário reconhecer o que a outra posição afirma, responder ao argumento sem atacar a pessoa e explicitar os critérios usados.\n\nUma proposta democraticamente sustentada considera consequências, direitos e o bem comum. Discordar faz parte do debate; desinformar, silenciar ou atribuir ao outro uma ideia que ele não defendeu não fortalece a argumentação.",
          "worked_example": "Em uma discussão sobre reduzir o uso de plástico na escola, dizer apenas que a medida é boa é uma opinião. Apresentar dados de consumo, reconhecer custos de adaptação e propor alternativas torna a posição analisável e negociável.",
          "tips": ["Separe tese, razão e evidência.", "Reconheça a posição que será respondida.", "Avalie efeitos e direitos antes de propor uma ação."],
          "source_context_status": "EXCERPT_ONLY",
          "questions": [
            {"id":"em1-lgg-probe-01","purpose":"PROBE","difficulty":"EASY","cognitive_process":"IDENTIFY","context_family":"ARGUMENTO","statement":"Qual fala apresenta uma posição acompanhada de evidência?","options":["A escola deve reduzir o plástico porque o levantamento mensal mostrou aumento no descarte.","A escola deve reduzir o plástico porque eu acho isso bonito.","Quem discorda não entende nada sobre o assunto.","A regra é certa porque sempre foi assim."],"correct":"A escola deve reduzir o plástico porque o levantamento mensal mostrou aumento no descarte.","explanation":"A fala articula uma proposta a uma razão e a um dado que pode ser analisado."},
            {"id":"em1-lgg-practice-01","purpose":"PRACTICE","difficulty":"MEDIUM","cognitive_process":"ANALYZE","context_family":"RESPOSTA_A_OBJECAO","statement":"Em um debate, uma pessoa apresenta o custo de uma proposta. Qual resposta mantém o diálogo argumentativo?","options":["Reconhecer o custo, discutir alternativas e comparar as consequências.","Dizer que a pessoa é contra a escola e encerrar a conversa.","Repetir a própria opinião sem responder ao custo apresentado.","Ignorar o dado e mudar para um assunto pessoal."],"correct":"Reconhecer o custo, discutir alternativas e comparar as consequências.","explanation":"Responder ao argumento e avaliar alternativas mantém o debate baseado em razões."},
            {"id":"em1-lgg-transfer-01","purpose":"TRANSFER","difficulty":"MEDIUM","cognitive_process":"APPLY","context_family":"PROPOSTA_COLETIVA","statement":"Uma turma quer mudar o horário de uma atividade. Qual procedimento favorece uma decisão democrática?","options":["Ouvir os grupos afetados, analisar horários e formular uma proposta negociável.","Escolher o horário do grupo mais numeroso sem ouvir os demais.","Publicar uma decisão pronta e impedir questionamentos.","Usar uma mensagem ofensiva para pressionar quem discorda."],"correct":"Ouvir os grupos afetados, analisar horários e formular uma proposta negociável.","explanation":"A decisão considera diferentes posições, dados e possibilidades de negociação."},
            {"id":"em1-lgg-lock-01","purpose":"LOCK_IN","difficulty":"HARD","cognitive_process":"EVALUATE","context_family":"DIREITOS_E_DEBATE","statement":"Uma proposta é popular, mas restringe um direito sem apresentar justificativa. Como avaliá-la?","options":["Questionar a restrição, buscar razões e verificar se há alternativa proporcional.","Aceitar a proposta porque a maioria sempre está correta.","Rejeitar qualquer proposta popular sem examinar seus efeitos.","Substituir a análise por um ataque ao grupo que propôs a medida."],"correct":"Questionar a restrição, buscar razões e verificar se há alternativa proporcional.","explanation":"Uma decisão responsável precisa considerar direitos, evidências e proporcionalidade."},
            {"id":"em1-lgg-review-01","purpose":"REVIEW","difficulty":"HARD","cognitive_process":"CREATE","context_family":"ARGUMENTACAO_PUBLICA","statement":"Ao formular uma proposta sobre consumo responsável, qual conjunto é mais completo?","options":["Tese, evidências, reconhecimento de limites e ação possível de acompanhar.","Uma frase de efeito e a repetição da mesma opinião.","Um dado isolado, sem indicar sua origem ou relação com a proposta.","A opinião do grupo, sem considerar pessoas afetadas."],"correct":"Tese, evidências, reconhecimento de limites e ação possível de acompanhar.","explanation":"Uma proposta pública precisa ser justificável, responsável e aberta à avaliação de seus efeitos."}
          ]
        },
        {
          "code": "EM13CNT101",
          "subject_area": "CIENCIAS_DA_NATUREZA",
          "domain": "TRANSFORMACOES_E_CONSERVACOES",
          "title": "Analisar transformações e conservações",
          "description": "Analisar e representar as transformações e conservações em sistemas que envolvam quantidade de matéria, de energia e de movimento para realizar previsões em situações cotidianas e processos produtivos que priorizem o uso racional dos recursos naturais.",
          "component_code": "CNT",
          "source_page": 117,
          "lesson_title": "Acompanhar transformações em sistemas",
          "lesson_summary": "Analisar um sistema exige definir o que está sendo observado, identificar entradas e saídas e distinguir transformação de quantidade conservada.",
          "lesson_content": "## Sistema, transformação e conservação\n\nAntes de explicar um fenômeno, delimite o sistema e escolha a grandeza observada. Energia pode mudar de forma, matéria pode ser transferida e o movimento pode ser alterado por interações. Dizer que algo foi transformado não significa que desapareceu.\n\nRepresentações como tabelas, setas e gráficos ajudam a acompanhar entradas, saídas e mudanças. Com essa análise é possível prever consequências e avaliar o uso racional de recursos, sempre deixando claras as condições adotadas.",
          "worked_example": "Em uma lâmpada, a energia elétrica é transformada principalmente em luz e calor. Se o sistema inclui a lâmpada e o ambiente, a energia recebida e as formas de saída precisam ser consideradas para explicar o resultado.",
          "tips": ["Defina o sistema observado.", "Diferencie transferência de transformação.", "Registre entradas, saídas e condições da previsão."],
          "source_context_status": "EXCERPT_ONLY",
          "questions": [
            {"id":"em1-cnt-probe-01","purpose":"PROBE","difficulty":"EASY","cognitive_process":"IDENTIFY","context_family":"ENERGIA","statement":"Ao acender uma lâmpada, qual descrição representa uma transformação de energia?","options":["Energia elétrica é convertida principalmente em luz e calor.","A energia elétrica deixa de existir sem produzir efeitos.","A lâmpada cria matéria a partir da tomada.","O calor produzido prova que não houve transferência de energia."],"correct":"Energia elétrica é convertida principalmente em luz e calor.","explanation":"A energia muda de forma; ela não desaparece quando a lâmpada funciona."},
            {"id":"em1-cnt-practice-01","purpose":"PRACTICE","difficulty":"MEDIUM","cognitive_process":"ANALYZE","context_family":"MOVIMENTO","statement":"Uma bicicleta acelera em uma rua plana. Qual análise é necessária para explicar a mudança de movimento?","options":["Considerar as interações que produzem força resultante e o intervalo observado.","Observar apenas a cor da bicicleta.","Concluir que a massa desapareceu durante a aceleração.","Ignorar o sentido do movimento e todas as forças."],"correct":"Considerar as interações que produzem força resultante e o intervalo observado.","explanation":"A mudança do movimento depende das interações e das condições do sistema."},
            {"id":"em1-cnt-transfer-01","purpose":"TRANSFER","difficulty":"MEDIUM","cognitive_process":"APPLY","context_family":"RECURSOS_NATURAIS","statement":"Uma escola quer reduzir o consumo de energia. Qual ação usa uma representação para apoiar uma previsão?","options":["Comparar o consumo mensal em uma tabela antes e depois de trocar os equipamentos.","Trocar todos os equipamentos sem medir o consumo.","Escolher o equipamento pela aparência.","Anotar somente o maior consumo e ignorar os demais meses."],"correct":"Comparar o consumo mensal em uma tabela antes e depois de trocar os equipamentos.","explanation":"A comparação organizada fornece evidência para estimar o efeito da mudança."},
            {"id":"em1-cnt-lock-01","purpose":"LOCK_IN","difficulty":"HARD","cognitive_process":"EVALUATE","context_family":"CONSERVACAO","statement":"Em um sistema aberto, a quantidade de água medida diminuiu. Qual conclusão é mais cuidadosa?","options":["Verificar se houve saída ou entrada de água antes de concluir que a matéria foi destruída.","Concluir imediatamente que a matéria desapareceu.","Assumir que toda mudança de medida é erro.","Ignorar os limites do sistema definido."],"correct":"Verificar se houve saída ou entrada de água antes de concluir que a matéria foi destruída.","explanation":"Em sistemas abertos, transferências podem explicar a variação observada."},
            {"id":"em1-cnt-review-01","purpose":"REVIEW","difficulty":"HARD","cognitive_process":"PREDICT","context_family":"MODELO_DE_SISTEMA","statement":"Para prever o efeito de uma mudança em um processo produtivo, o primeiro passo é:","options":["Definir o sistema, as grandezas e as condições que serão comparadas.","Escolher uma resposta sem indicar quais dados foram usados.","Considerar somente o resultado final e ocultar as entradas.","Tratar qualquer transformação como perda total da grandeza."],"correct":"Definir o sistema, as grandezas e as condições que serão comparadas.","explanation":"Uma previsão verificável depende de limites, grandezas e condições explicitados."}
          ]
        },
        {
          "code": "EM13CHS103",
          "subject_area": "CIENCIAS_HUMANAS",
          "domain": "EVIDENCIAS_E_ARGUMENTOS",
          "title": "Construir hipóteses com evidências",
          "description": "Elaborar hipóteses, selecionar evidências e compor argumentos relativos a processos políticos, econômicos, sociais, ambientais, culturais e epistemológicos, com base na sistematização de dados e informações de natureza qualitativa e quantitativa (expressões artísticas, textos filosóficos e sociológicos, documentos históricos, gráficos, mapas, tabelas etc.).",
          "component_code": "CHS",
          "source_page": 136,
          "lesson_title": "Relacionar hipótese, evidência e argumento",
          "lesson_summary": "Uma investigação em Ciências Humanas começa com uma hipótese examinável e articula fontes, dados e argumentos sem confundir descrição com conclusão.",
          "lesson_content": "## Da pergunta ao argumento\n\nUma hipótese é uma explicação provisória que pode ser confrontada com evidências. A evidência precisa ser pertinente à pergunta e sua origem, método e limites devem ser considerados. Um dado isolado não prova qualquer conclusão.\n\nAo compor um argumento, descreva o que a fonte mostra, explique a relação com a hipótese e indique o grau de segurança da conclusão. Textos, mapas, tabelas, documentos e expressões artísticas podem contribuir de maneiras diferentes para a análise.",
          "worked_example": "Se uma pesquisa pergunta por que o uso do transporte coletivo variou, uma tabela de passageiros mostra a variação, enquanto entrevistas podem ajudar a compreender motivos. As fontes são complementares e não devem ser tratadas como se respondessem exatamente à mesma pergunta.",
          "tips": ["Formule uma hipótese examinável.", "Relacione cada evidência à pergunta.", "Indique limites e evite concluir além dos dados."],
          "source_context_status": "EXCERPT_ONLY",
          "questions": [
            {"id":"em1-chs-probe-01","purpose":"PROBE","difficulty":"EASY","cognitive_process":"IDENTIFY","context_family":"HIPOTESE","statement":"Qual frase funciona como hipótese examinável?","options":["A redução do transporte coletivo ocorreu porque a tarifa aumentou no período analisado.","O transporte coletivo é sempre melhor em qualquer situação.","A cidade é interessante e por isso deve mudar.","Todos sabem qual é a causa, então não é preciso pesquisar."],"correct":"A redução do transporte coletivo ocorreu porque a tarifa aumentou no período analisado.","explanation":"A frase propõe uma relação que pode ser confrontada com dados sobre tarifa e uso."},
            {"id":"em1-chs-practice-01","purpose":"PRACTICE","difficulty":"MEDIUM","cognitive_process":"SELECT","context_family":"EVIDENCIA","statement":"Uma pesquisa investiga a distribuição de renda entre bairros. Qual evidência é diretamente pertinente à pergunta?","options":["Uma tabela com rendas dos bairros e o mesmo critério de comparação.","A opinião de uma pessoa sobre o bairro mais bonito.","Uma fotografia sem data ou localização.","Um dado de outro país sem explicar a comparação."],"correct":"Uma tabela com rendas dos bairros e o mesmo critério de comparação.","explanation":"A tabela se relaciona diretamente à distribuição investigada e permite comparação explícita."},
            {"id":"em1-chs-transfer-01","purpose":"TRANSFER","difficulty":"MEDIUM","cognitive_process":"ANALYZE","context_family":"MAPA_E_DADOS","statement":"Um mapa mostra maior concentração de serviços em uma região. Qual argumento é mais cuidadoso?","options":["O mapa sugere concentração no período representado, mas é preciso verificar escala, data e outros dados.","O mapa prova sozinho a causa de toda desigualdade da cidade.","A concentração é natural e não precisa ser investigada.","A legenda pode ser ignorada porque as cores são suficientes."],"correct":"O mapa sugere concentração no período representado, mas é preciso verificar escala, data e outros dados.","explanation":"A interpretação respeita o que a fonte permite afirmar e reconhece seus limites."},
            {"id":"em1-chs-lock-01","purpose":"LOCK_IN","difficulty":"HARD","cognitive_process":"COMPARE","context_family":"FONTES","statement":"Duas fontes descrevem o mesmo processo de modos diferentes. O que o estudante deve fazer?","options":["Comparar autoria, contexto, evidências e limites antes de compor o argumento.","Escolher a fonte mais antiga sem analisar seu conteúdo.","Descartar uma fonte só porque sua interpretação é diferente.","Somar as frases das fontes sem considerar seus contextos."],"correct":"Comparar autoria, contexto, evidências e limites antes de compor o argumento.","explanation":"A comparação crítica evita tratar uma única narrativa como explicação suficiente."},
            {"id":"em1-chs-review-01","purpose":"REVIEW","difficulty":"HARD","cognitive_process":"ARGUE","context_family":"ARGUMENTO_QUALIFICADO","statement":"Qual conclusão apresenta melhor relação entre dados e argumento?","options":["Os dados mostram uma associação no período estudado; são necessárias outras evidências para avaliar a causa.","Um número confirma definitivamente qualquer explicação possível.","A opinião do pesquisador substitui a análise das fontes.","Se há uma exceção, nenhuma conclusão provisória pode ser construída."],"correct":"Os dados mostram uma associação no período estudado; são necessárias outras evidências para avaliar a causa.","explanation":"O argumento usa o dado sem ultrapassar o que ele permite concluir."}
          ]
        }
      ]
    $json$::jsonb) as item(code text, subject_area text, domain text, title text, description text, component_code text, source_page integer, lesson_title text, lesson_summary text, lesson_content text, worked_example text, tips jsonb, source_context_status text, questions jsonb)
  loop
    insert into public.learning_curriculum_skills(
      catalog_id, code, stage, grade_level, subject_area, domain, title, description,
      active, node_kind, content_readiness, mastery_targetable, pedagogical_review_status,
      bncc_alignment_status, metadata
    ) values (
      v_catalog_id, content_row.code, 'ENSINO_MEDIO', null, content_row.subject_area, content_row.domain,
      content_row.title, content_row.description, true, 'LEAF', 'ADAPTIVE_READY', true,
      'PEDAGOGICAL_REVIEW_PENDING', 'MAPPED',
      jsonb_build_object(
        'official_code', content_row.code,
        'official_source_id', 'BNCC_EM_2018',
        'official_source_url', official_url,
        'official_source_page', content_row.source_page,
        'official_component_code', content_row.component_code,
        'official_stage', 'ENSINO_MEDIO',
        'official_grade_range', '1-3',
        'mapping_status', 'MAPPED',
        'mapping_source', 'TECESCOLA_HIGH_SCHOOL_FIRST_YEAR_V4',
        'promotion_status', 'TECHNICAL_CONTENT_PROMOTION_PENDING_PEDAGOGICAL_REVIEW',
        'pedagogical_review_status', 'PENDING',
        'recommended_grade', 1,
        'recommended_grade_source', 'TECESCOLA_PEDAGOGICAL_SEQUENCE',
        'source_context_status', content_row.source_context_status,
        'content_pack', 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4'
      )
    )
    on conflict (catalog_id, code) do update set
      stage = excluded.stage,
      grade_level = excluded.grade_level,
      subject_area = excluded.subject_area,
      domain = excluded.domain,
      title = excluded.title,
      description = excluded.description,
      active = true,
      node_kind = 'LEAF',
      content_readiness = 'ADAPTIVE_READY',
      mastery_targetable = true,
      pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING',
      bncc_alignment_status = 'MAPPED',
      metadata = excluded.metadata,
      updated_at = now()
    returning id into target_id;

    if target_id is null then
      select skill.id into target_id from public.learning_curriculum_skills skill where skill.catalog_id = v_catalog_id and skill.code = content_row.code;
    end if;

    insert into public.learning_curriculum_grade_targets(
      catalog_id, stage, grade_level, subject_area, canonical_skill_id, priority, sort_order, active
    ) values (v_catalog_id, 'ENSINO_MEDIO', 1, content_row.subject_area, target_id, 10, content_row.source_page, true)
    on conflict (catalog_id, stage, grade_level, subject_area, canonical_skill_id)
    do update set priority = excluded.priority, sort_order = excluded.sort_order, active = true, updated_at = now();

    insert into public.learning_skill_lessons(
      canonical_skill_id, version, title, summary, content_markdown,
      worked_example, tips, estimated_minutes, active, metadata
    ) values (
      target_id, 4, content_row.lesson_title, content_row.lesson_summary, content_row.lesson_content,
      content_row.worked_example, array(select jsonb_array_elements_text(content_row.tips)), 10, true,
      jsonb_build_object(
        'official_bncc_code', content_row.code,
        'official_source_url', official_url,
        'official_source_page', content_row.source_page,
        'content_pack', 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4',
        'content_authoring_status', 'TECH_VALIDATED',
        'pedagogical_review_status', 'PENDING',
        'recommended_grade', 1,
        'recommended_grade_source', 'TECESCOLA_PEDAGOGICAL_SEQUENCE'
      )
    )
    on conflict (canonical_skill_id, version) do update set
      title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown,
      worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes,
      active = true, metadata = excluded.metadata, updated_at = now();

    for question_row in
      select * from jsonb_to_recordset(content_row.questions) as item(
        id text, purpose text, difficulty text, cognitive_process text, context_family text,
        statement text, options jsonb, correct text, explanation text
      )
    loop
      select bank.id into question_id
        from public.learning_question_bank bank
       where bank.source_type = 'TECESCOLA_BNCC_EM_V4'
         and bank.metadata->>'content_id' = question_row.id
       limit 1;

      if question_id is null then
        insert into public.learning_question_bank(
          package_type, source_type, source_name, subject_area, domain, topic,
          statement, options, correct_answer, explanation, difficulty, cognitive_process,
          context_family, knowledge_mapping_status, knowledge_mapping_version,
          estimated_minutes, provenance, metadata, active
        ) values (
          'TECESCOLA', 'TECESCOLA_BNCC_EM_V4', 'TecEscola BNCC Ensino Médio V4',
          content_row.subject_area, content_row.domain, lower(content_row.code), question_row.statement,
          question_row.options, to_jsonb(question_row.correct), question_row.explanation, question_row.difficulty,
          question_row.cognitive_process, question_row.context_family, 'READY', 'V4', 5,
          'TECESCOLA_BNCC_AUTHORED', jsonb_build_object(
            'content_id', question_row.id,
            'purpose', question_row.purpose,
            'primary_skill', content_row.code,
            'official_bncc_code', content_row.code,
            'official_source_url', official_url,
            'official_source_page', content_row.source_page,
            'content_pack', 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4',
            'content_authoring_status', 'TECH_VALIDATED',
            'pedagogical_review_status', 'PENDING',
            'recommended_grade', 1,
            'recommended_grade_source', 'TECESCOLA_PEDAGOGICAL_SEQUENCE'
          ), true
        ) returning id into question_id;
      else
        update public.learning_question_bank
           set subject_area = content_row.subject_area,
               domain = content_row.domain,
               topic = lower(content_row.code),
               statement = question_row.statement,
               options = question_row.options,
               correct_answer = to_jsonb(question_row.correct),
               explanation = question_row.explanation,
               difficulty = question_row.difficulty,
               cognitive_process = question_row.cognitive_process,
               context_family = question_row.context_family,
               knowledge_mapping_status = 'READY',
               knowledge_mapping_version = 'V4',
               active = true,
               updated_at = now()
         where id = question_id;
      end if;

      insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
      values (question_id, target_id, 'PRIMARY')
      on conflict (question_bank_id, canonical_skill_id) do nothing;

      insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, difficulty, metadata)
      values (
        'GLOBAL', target_id, question_row.purpose, 4, question_row.difficulty,
        jsonb_build_object(
          'official_bncc_code', content_row.code,
          'content_pack', 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4',
          'recommended_grade', 1,
          'pedagogical_review_status', 'PENDING'
        )
      )
      on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL'
      do update set difficulty = excluded.difficulty, metadata = excluded.metadata, active = true
      returning id into set_id;

      if set_id is null then
        select question_set.id into set_id from public.learning_question_sets question_set
         where question_set.scope = 'GLOBAL' and question_set.canonical_skill_id = target_id
           and question_set.purpose = question_row.purpose and question_set.version = 4;
      end if;

      insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
      values (
        set_id, question_id,
        (select coalesce(max(item.position), -1) + 1
           from public.learning_question_set_items item
          where item.question_set_id = set_id)
      ) on conflict (question_set_id, question_bank_id) do nothing;
    end loop;
  end loop;
end;
$$;

-- Global BNCC discovery is intentionally independent from institutional subject
-- links. The student still needs an active enrollment with the matching stage
-- and grade, and the protected start RPC performs the same server-side check.
create or replace function public.list_student_guided_learning_targets(
  p_institution_id uuid,
  p_student_id uuid
)
returns table(
  target_canonical_skill_id uuid,
  subject_id uuid,
  catalog_id uuid,
  catalog_code text,
  official_code text,
  title text,
  subject_area text,
  stage text,
  grade_level smallint,
  availability_status text,
  progress numeric,
  has_lesson boolean,
  question_count integer,
  active_session_id uuid,
  active_session_status text,
  reason text
)
language sql stable security definer set search_path = ''
as $$
  with enrollment_context as (
    select distinct on (enrollment.student_id, enrollment.class_id)
      enrollment.student_id,
      enrollment.class_id,
      normalized.value->>'stage' as stage,
      nullif(normalized.value->>'grade_level', '')::smallint as parsed_grade
    from public.enrollments enrollment
    join public.classes class on class.id = enrollment.class_id
      and class.institution_id = p_institution_id
      and class.active
    cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
    where enrollment.student_id = p_student_id
      and enrollment.active
      and enrollment.status = 'active'
    order by enrollment.student_id, enrollment.class_id, enrollment.updated_at desc
  ), skills as (
    select distinct
      skill.id,
      null::uuid as subject_id,
      skill.catalog_id,
      catalog.code as catalog_code,
      skill.metadata->>'official_code' as official_code,
      skill.title,
      skill.subject_area,
      target.stage,
      target.grade_level,
      skill.content_readiness,
      skill.mastery_targetable,
      (select count(*)::integer from public.learning_skill_lessons lesson where lesson.canonical_skill_id = skill.id and lesson.version = 4 and lesson.active) > 0 as has_lesson,
      (select count(*)::integer from public.learning_question_set_items item join public.learning_question_sets question_set on question_set.id = item.question_set_id and question_set.scope = 'GLOBAL' and question_set.version = 4 and question_set.active where question_set.canonical_skill_id = skill.id) as question_count,
      state.mastery_estimate as progress,
      session.id as active_session_id,
      session.status as active_session_status
    from enrollment_context context
    join public.learning_curriculum_grade_targets target on target.stage = context.stage and target.grade_level = context.parsed_grade and target.active
    join public.learning_curriculum_skills skill on skill.id = target.canonical_skill_id and skill.active and skill.node_kind = 'LEAF' and skill.bncc_alignment_status = 'MAPPED'
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id and catalog.active and catalog.code = 'BNCC_2018'
    left join public.learning_student_skill_state state on state.institution_id = p_institution_id and state.student_id = p_student_id and state.canonical_skill_id = skill.id
    left join lateral (
      select guided.id, guided.status
        from public.learning_guided_sessions guided
       where guided.institution_id = p_institution_id and guided.student_id = p_student_id and guided.target_canonical_skill_id = skill.id and guided.status in ('ACTIVE', 'PAUSED')
       order by guided.updated_at desc
       limit 1
    ) session on true
    where context.stage is not null and context.parsed_grade is not null
  )
  select skills.id, skills.subject_id, skills.catalog_id, skills.catalog_code, skills.official_code,
         skills.title, skills.subject_area, skills.stage, skills.grade_level,
         case when skills.content_readiness <> 'ADAPTIVE_READY' or not skills.has_lesson then 'NO_LESSON'
              when skills.question_count = 0 then 'NO_QUESTIONS'
              when skills.active_session_id is null then 'NO_ACTIVE_SESSION'
              else 'READY' end,
         coalesce(skills.progress, 0), skills.has_lesson, skills.question_count,
         skills.active_session_id, skills.active_session_status,
         case when skills.content_readiness <> 'ADAPTIVE_READY' or not skills.has_lesson then 'BNCC skill mapped, but the published lesson is not ready.'
              when skills.question_count = 0 then 'BNCC skill mapped, but no published exercises are available.'
              when skills.active_session_id is null then 'No active guided session.'
              else 'Guided session available.' end
    from skills
   where private.learning_v2_scope_student(p_institution_id, p_student_id)
   order by skills.subject_area, skills.grade_level, skills.title;
$$;

-- Expose the source identity alongside each step so the learner can distinguish
-- official BNCC origin from the TecEscola grade-1 pedagogical sequence.
create or replace function public.get_guided_learning_step_v4(p_step_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare step_row public.learning_guided_steps%rowtype; session_row public.learning_guided_sessions%rowtype; result jsonb;
begin
  select step.* into step_row
    from public.learning_guided_steps step
    join public.learning_guided_sessions session on session.id = step.session_id
   where step.id = p_step_id and session.planner_version = 'V4';
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  select session.* into session_row from public.learning_guided_sessions session where session.id = step_row.session_id;
  if not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then raise exception 'LEARNING_STEP_SCOPE_DENIED'; end if;
  select jsonb_build_object(
    'id', step_row.id,
    'session_id', step_row.session_id,
    'canonical_skill_id', step_row.canonical_skill_id,
    'step_type', step_row.step_type,
    'purpose', step_row.purpose,
    'status', step_row.status,
    'position', step_row.position,
    'lesson_id', step_row.lesson_id,
    'curriculum', (select jsonb_build_object(
      'official_code', skill.metadata->>'official_code',
      'title', skill.title,
      'description', skill.description,
      'subject_area', skill.subject_area,
      'stage', skill.stage,
      'official_grade_range', skill.metadata->>'official_grade_range',
      'recommended_grade', skill.metadata->>'recommended_grade',
      'recommended_grade_source', skill.metadata->>'recommended_grade_source',
      'official_source_url', skill.metadata->>'official_source_url',
      'official_source_page', skill.metadata->>'official_source_page'
    ) from public.learning_curriculum_skills skill where skill.id = step_row.canonical_skill_id),
    'lesson', (select jsonb_build_object('id', lesson.id, 'title', lesson.title, 'summary', lesson.summary, 'content_markdown', lesson.content_markdown, 'worked_example', lesson.worked_example, 'tips', lesson.tips, 'estimated_minutes', lesson.estimated_minutes) from public.learning_skill_lessons lesson where lesson.id = step_row.lesson_id),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', question.id,
          'statement', question.statement,
          'options', question.options,
          'difficulty', question.difficulty,
          'position', item.position
        ) order by item.position
      )
        from public.learning_question_set_items item
        join public.learning_question_bank question
          on question.id = item.question_bank_id
         and question.active
       where item.question_set_id = step_row.question_set_id
         and not exists (
           select 1
             from public.learning_guided_step_attempts previous_attempt
            where previous_attempt.step_id = step_row.id
              and exists (
                select 1
                  from jsonb_array_elements(previous_attempt.answers) answer
                 where answer->>'question_bank_id' = question.id::text
              )
         )
    ), '[]'::jsonb)
  ) into result;
  if step_row.step_type in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW')
     and jsonb_array_length(result->'questions') = 0 then
    raise exception 'LEARNING_V4_QUESTION_SET_EMPTY';
  end if;
  return result;
end;
$$;

revoke all on function public.list_student_guided_learning_targets(uuid, uuid), public.get_guided_learning_step_v4(uuid) from public, anon;
grant execute on function public.list_student_guided_learning_targets(uuid, uuid), public.get_guided_learning_step_v4(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
