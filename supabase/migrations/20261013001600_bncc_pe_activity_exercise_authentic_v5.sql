begin;

-- Authorial V5 content is compiled for review but remains inactive and unaligned.
-- No student can receive it until separate pedagogical and publication gates pass.
do $seed_question_first_content_v5$
declare
  v_catalog_id uuid;
  v_skill_id uuid;
  v_parent_skill_id uuid;
  v_lesson_id uuid;
  v_set_id uuid;
  v_question_id uuid;
  v_question record;
begin
  select id into v_catalog_id
    from public.learning_curriculum_catalogs
   where code = 'TECESCOLA_CORE' and version = '1.0'
   limit 1;
  if v_catalog_id is null then raise exception 'V5_CONTENT_CATALOG_MISSING'; end if;
  select id into v_parent_skill_id from public.learning_curriculum_skills where catalog_id = v_catalog_id and code = 'PE_HEALTH';
  if v_parent_skill_id is null then raise exception 'V5_INTERNAL_SKILL_PARENT_MISSING:PE_HEALTH'; end if;
  insert into public.learning_curriculum_skills as existing(
    catalog_id, code, stage, grade_level, subject_area, domain, title, description,
    active, node_kind, content_readiness, mastery_targetable, parent_canonical_skill_id,
    pedagogical_review_status, publication_status, bncc_alignment_status, metadata
  ) values (
    v_catalog_id, 'PE_DISTINGUISH_ACTIVITY_EXERCISE_FII', 'FUNDAMENTAL_II', 6, 'PHYSICAL_EDUCATION', 'ATIVIDADE_E_EXERCICIO',
    'Distinguir atividade fisica e exercicio fisico', 'Diferencia movimento corporal cotidiano de exercício planejado e propõe alternativas contextualizadas e acessíveis para praticar exercícios, sem prescrever rotina individual.', false, 'LEAF', 'ADAPTIVE_READY', false, v_parent_skill_id,
    'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', 'CANDIDATE', '{"content_pack":"TECESCOLA_CORE_V5_QUESTION_FIRST","content_id":"pe-distinguish-activity-exercise","source_pack":"tec-escola-knowledge-expansion-v3","source_candidate":"EDUCACAO_FISICA_UNSPECIFIED_HEALTH_LIFESTYLE","source_unit_id":"V3_PE_ACTIVITY_EXERCISE_FII","internal_skill_code":"PE_DISTINGUISH_ACTIVITY_EXERCISE_FII","grade_from":6,"grade_to":7,"official_source_reference":{"officialCode":"EF67EF10","sourceId":"BNCC_EI_EF_2018","documentVersion":"BNCC Educação Infantil e Ensino Fundamental, versão final 2018","url":"https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf","page":235,"section":"EF > Habilidades","officialDescription":"Diferenciar exercício físico de atividade física e propor alternativas para a prática de exercícios físicos dentro e fora do ambiente escolar.","localCatalogExcerpt":") Diferenciar exercício físico de atividade física e propor alternativas para a prática de exercícios físicos dentro e fora do ambiente escolar. (EF67EF11) Experimentar, fruir e recriar danças urbanas, identificando seus elementos constitutivos (ritmo, espaço, gestos). (EF67EF12) Planejar e utilizar estratégias para aprender elementos constitutivos das danças urbanas. (EF67EF13) Diferenciar as danças urbanas das demais manifestações da dança, valorizando e respeitando os sentidos e significados atribuídos a eles por diferentes grupos sociais. 234 MINSTÉIRO ÉIDTT R AEATREUUOREDIU UNIDADES TEMÁTICAS OBJETOS DE CONHECIMENTO Lutas Lutas do Brasil Práticas corporais de aventura Práticas corporais de aventura urbanas EDUCAÇÃO FÍSICA – 6º E 7º ANOS (Continuação) 235 MINSTÉSRNO D RATEÉUCÇ ÃoOIEÉ ENSINO FUNDAMENTAL HABILIDADES (EF67EF14) Experimentar, fruir e recriar diferentes lutas do Brasil, v","localCatalogSourceId":"BNCC_EI_EF_2018","localCatalogUrl":"https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf","localCatalogPage":235,"sourceCorrection":null,"sourceStage":"ENSINO_FUNDAMENTAL","officialComponentCode":"EF","officialSubjectArea":"PHYSICAL_EDUCATION","candidateSubject":"EDUCACAO_FISICA","gradeRange":{"from":6,"to":7},"gradeCompatible":true,"proposalId":"V8_PROPOSAL_ENSINO_FUNDAMENTAL_67_EF_UNSPECIFIED_HEALTH_LIFESTYLE","proposalCanonicalCode":"EDUCACAO_FISICA_UNSPECIFIED_HEALTH_LIFESTYLE","proposalStatus":"NEW_SKILL_PENDING_REVIEW","gapClusterId":"V8_GAP_ENSINO_FUNDAMENTAL_67_EF_UNSPECIFIED_HEALTH_LIFESTYLE","referenceStatus":"OFFICIAL_SOURCE_IDENTIFIED_AND_EXCERPT_CHECKED","candidateStatus":"TECHNICAL_CANDIDATE_NOT_APPROVED_MAPPING","mappingClaim":"NONE","mappingStatus":"MAPPING_PENDING","pedagogicalReviewStatus":"PEDAGOGICAL_REVIEW_PENDING","internalSkillCode":"PE_DISTINGUISH_ACTIVITY_EXERCISE_FII","internalGradeRange":{"from":6,"to":7},"evidenceSummary":"The authored capability is a bounded internal interpretation of EF67EF10; it is not a promoted BNCC mapping.","observableCapability":"O estudante explica por que um exemplo é atividade física, exercício ou ambos e propõe duas alternativas viáveis, indicando uma adaptação ou condição de segurança pertinente.","authoringLimitations":"A atividade digital avalia compreensão e planejamento, não desempenho motor. Não prescrever intensidade ou rotina individual; propostas práticas requerem mediação docente, condições seguras e alternativas de participação."},"official_mapping_status":"NOT_CLAIMED","pedagogical_review_status":"PEDAGOGICAL_REVIEW_PENDING","publication_status":"STAGING"}'::jsonb
  ) on conflict (catalog_id, code) do update
    set publication_status = 'STAGING'
    where existing.stage = 'FUNDAMENTAL_II'
      and existing.grade_level = 6
      and existing.subject_area = 'PHYSICAL_EDUCATION'
      and existing.domain = 'ATIVIDADE_E_EXERCICIO'
      and existing.active = false
      and existing.node_kind = 'LEAF'
      and existing.content_readiness = 'ADAPTIVE_READY'
      and existing.mastery_targetable = false
      and existing.parent_canonical_skill_id = v_parent_skill_id
      and existing.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
      and existing.bncc_alignment_status = 'CANDIDATE'
      and existing.metadata->>'content_pack' in ('tec-escola-knowledge-expansion-v3', 'TECESCOLA_CORE_V5_QUESTION_FIRST')
      and existing.metadata->>'bncc_alignment' = 'NOT_CLAIMED'
      and existing.metadata->>'official_code' is null
      and (existing.metadata->>'official_mapping_status' = 'NOT_CLAIMED'
        or existing.metadata->>'mapping_status' = 'MAPPING_PENDING')
      and (
        (existing.metadata->>'content_pack' = 'tec-escola-knowledge-expansion-v3'
          and existing.metadata->>'staging_only' = 'true')
        or (existing.metadata->>'content_pack' = 'TECESCOLA_CORE_V5_QUESTION_FIRST'
          and existing.metadata->>'content_id' = 'pe-distinguish-activity-exercise'
          and existing.metadata->>'internal_skill_code' = 'PE_DISTINGUISH_ACTIVITY_EXERCISE_FII')
      )
      and existing.publication_status in ('PUBLISHED', 'STAGING');
  if not exists (
    select 1 from public.learning_curriculum_skills
     where catalog_id = v_catalog_id and code = 'PE_DISTINGUISH_ACTIVITY_EXERCISE_FII'
       and stage = 'FUNDAMENTAL_II' and grade_level = 6
       and subject_area = 'PHYSICAL_EDUCATION' and domain = 'ATIVIDADE_E_EXERCICIO'
       and parent_canonical_skill_id = v_parent_skill_id and active = false and mastery_targetable = false
       and pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING' and bncc_alignment_status = 'CANDIDATE'
       and publication_status = 'STAGING'
       and metadata->>'publication_status' = 'STAGING'
       and metadata->>'content_pack' in ('tec-escola-knowledge-expansion-v3', 'TECESCOLA_CORE_V5_QUESTION_FIRST')
  ) then raise exception 'V5_INTERNAL_SKILL_STAGING_SCOPE_CONFLICT:PE_DISTINGUISH_ACTIVITY_EXERCISE_FII'; end if;

  select id into v_skill_id
    from public.learning_curriculum_skills
   where catalog_id = v_catalog_id and code = 'PE_DISTINGUISH_ACTIVITY_EXERCISE_FII';
  if v_skill_id is null then raise exception 'V5_CONTENT_SKILL_MISSING'; end if;

  insert into public.learning_skill_lessons(
    canonical_skill_id, version, title, summary, content_markdown,
    worked_example, tips, estimated_minutes, active, metadata
  ) values (
    v_skill_id, 5, 'Atividade física e exercício: observar contexto e propósito', 'Atividade física inclui movimentos em diferentes situações. Exercício é uma forma planejada, estruturada e repetida com propósito. A mesma ação pode aparecer em contextos diferentes. Compreender essa distinção não exige teste corporal nem comparação de aptidão.', '## Movimento em muitos contextos
Caminhar para chegar a um lugar, brincar, dançar ou participar de uma aula podem envolver atividade física. A categoria é ampla e não depende de competição.

## Quando falamos em exercício
Exercício é uma subcategoria: há planejamento, estrutura, repetição e um propósito. Um movimento cotidiano pode também fazer parte de exercício quando é organizado com esses elementos. Observe a situação inteira, não apenas o nome do movimento.

## Planejar sem excluir
Uma proposta escolar precisa considerar espaço, supervisão, escolha e formas diferentes de participação. Não prescreva intensidade individual, não compare corpos e não exija que alguém revele saúde, deficiência ou rotina. Uma atividade escrita ou desenhada pode ser uma alternativa equivalente à demonstração de movimento.

## Exemplo resolvido
Subir escadas para chegar à sala envolve atividade física, mas a descrição não informa um plano de exercício. Em uma aula, uma sequência de movimentos repetida com propósito definido pode ser exercício e também atividade física. Para a turma, o professor verifica espaço seguro, alternativas e participação voluntária.',
    'Pergunta: uma turma se movimenta livremente numa festa e, em outra aula, pratica uma sequência repetida com objetivo combinado. Passo 1: note que as duas situações envolvem movimento. Passo 2: procure planejamento, estrutura, repetição e propósito. Passo 3: classifique a segunda também como exercício planejado, sem dizer que a festa “não conta” como atividade física.', array['Observe o contexto e o propósito, não apenas o nome do movimento.', 'Planeje opções seguras e acessíveis com mediação do professor.', 'A atividade digital verifica compreensão e planejamento, não aptidão física.']::text[], 25, false, '{"content_pack":"TECESCOLA_CORE_V5_QUESTION_FIRST","content_id":"pe-distinguish-activity-exercise","content_authoring_status":"AUTHORED","pedagogical_review_status":"PEDAGOGICAL_REVIEW_PENDING","publication_status":"STAGING","bncc_alignment_status":"NOT_CLAIMED","prior_knowledge":["Reconhecer movimentos corporais em situações cotidianas.","Descrever espaço, regras e escolhas em uma atividade."],"key_concepts":["Atividade física é uma categoria ampla de movimento.","Exercício físico é planejado, estruturado e repetido com propósito.","Segurança, acesso, escolha e adaptação fazem parte do planejamento."],"progression":[{"stage":"FOUNDATION","focus":"Identificar o contexto, o planejamento e o propósito de uma situação.","questionIds":["v5-pe-distinguish-probe-01","v5-pe-distinguish-practice-01"]},{"stage":"APPLICATION","focus":"Planejar uma opção e justificar cuidados e adaptações.","questionIds":["v5-pe-distinguish-practice-02","v5-pe-distinguish-transfer-01","v5-pe-distinguish-lock-01"]},{"stage":"SPACED_REVIEW_CANDIDATE","focus":"Revisar uma proposta diante de um novo contexto ou barreira.","questionIds":["v5-pe-distinguish-review-01"]}],"micro_explanations":[{"trigger":"MOVEMENT_IS_BROAD","text":"Atividade física pode ocorrer em transporte, brincadeira, lazer e aula; competição não é requisito."},{"trigger":"EXERCISE_IS_PLANNED","text":"Procure planejamento, estrutura, repetição e propósito para identificar exercício."},{"trigger":"SAME_MOVEMENT_DIFFERENT_CONTEXT","text":"O contexto pode mudar a classificação; compare como e por que a ação foi organizada."},{"trigger":"NO_BODY_TEST","text":"Esta tarefa avalia raciocínio sobre situações, não força, velocidade, saúde ou aptidão do estudante."}],"remediations":[{"id":"pe-distinguish-remediate-context","misconception":"CONTEXT_IGNORED","prompt":"Descreva primeiro o movimento; depois marque se havia plano, estrutura, repetição e propósito. Reavalie a classificação."},{"id":"pe-distinguish-remediate-competition","misconception":"COMPETITION_REQUIRED","prompt":"Pense em uma brincadeira sem vencedor e em uma sequência orientada sem competição. Que elementos, além de competir, ajudam a classificar exercício?"},{"id":"pe-distinguish-remediate-equipment","misconception":"EQUIPMENT_REQUIRED","prompt":"Retire os equipamentos do cenário e verifique se ainda existe uma sequência planejada e repetida com propósito."}],"review_windows_days":[1,3,7],"review_schedule_status":"SUGGESTED_NOT_AUTOMATED","source_dossier":[{"title":"WHO Guidelines on Physical Activity and Sedentary Behaviour: Glossary of Terms","publisher":"World Health Organization","url":"https://www.ncbi.nlm.nih.gov/books/NBK566047/","accessedOn":"2026-10-13","supports":["Exercício é subcategoria de atividade física planejada, estruturada e repetitiva com propósito definido."],"use":"Checagem conceitual para diferenciar atividade física e exercício; enunciados, exemplos e atividades deste pacote são autorais."},{"title":"WHO Guidelines on Physical Activity and Sedentary Behaviour: Children and Adolescents","publisher":"World Health Organization","url":"https://www.who.int/publications/i/item/9789240015128","accessedOn":"2026-10-13","supports":["Atividade física juvenil pode ocorrer em lazer, educação física, transporte e tarefas; oportunidades devem ser seguras, equitativas, agradáveis e adequadas à idade e capacidade."],"use":"Fundamenta variedade, segurança e acessibilidade; não é usado para prescrever dose ou rotina individual."},{"title":"Guia de Atividade Física para a População Brasileira","publisher":"Ministério da Saúde","url":"https://bvsms.saude.gov.br/bvs/publicacoes/guia_atividade_fisica_populacao_brasileira.pdf","accessedOn":"2026-10-13","supports":["Orientações brasileiras para atividade física e exercício, inclusive crianças e jovens; distinção de que exercício é uma forma planejada de atividade física."],"use":"Referência pública para contexto e linguagem; os pacotes não reproduzem o guia nem formulam recomendação clínica."}],"copyright_note":"Questões e propostas de atividade são autorais. Fontes oficiais fundamentam conceitos e salvaguardas, mas não equivalem a validação do percurso ou aprovação curricular. Mapeamento e revisão pedagógica permanecem pendentes.","authentic_activities":[{"id":"v5-pe-distinguish-movement-context-lab","title":"Movimento, contexto e escolha","objective":"Classificar situações fictícias e planejar uma opção de movimento com alternativas voluntárias e acessíveis.","context":"Investigação em pequenos grupos com cartões de situações cotidianas e propostas de aula preparadas pelo educador.","materials":["Cartões fictícios de situações de movimento","Quadro “atividade física”, “exercício planejado” e “o que falta saber”","Folha para desenhar uma proposta com duas formas de participação"],"instructions":"Classifique cartões justificando a decisão por movimento, planejamento, estrutura, repetição e propósito. Depois crie uma proposta curta para a escola com uma opção de movimento e uma alternativa equivalente sentada, observacional ou desenhada. Se houver demonstração, ela é voluntária, supervisionada e pode ser substituída pela representação em papel. Não medir desempenho nem pedir relatos sobre corpos, saúde ou rotina familiar.","evidence":"Quadro de classificação com justificativas, proposta com duas formas de participação e anotação de uma condição de segurança ou acesso.","safety":"Qualquer vivência corporal depende de espaço e supervisão docente, é voluntária e pode ser substituída por alternativa equivalente. Não aplicar teste de aptidão, comparar resultados, prescrever exercício individual ou pedir diagnóstico/atestado como conteúdo da aula.","privacyGuard":"Não coletar peso, medidas, frequência cardíaca, diagnóstico, deficiência, imagens, rotina de movimento ou dados de saúde dos estudantes.","ageRange":"6º e 7º anos do Ensino Fundamental, com mediação docente.","mediation":"O professor contextualiza os exemplos, verifica condições locais e garante alternativa sem movimento. A rubrica observa classificação, justificativa, acesso e segurança, não habilidade atlética.","rubric":[{"criterion":"Distinção conceitual","emerging":"Confunde toda atividade física com exercício planejado.","developing":"Identifica movimento e planejamento com perguntas de apoio.","proficient":"Justifica a classificação usando contexto, organização e propósito."},{"criterion":"Justificativa","emerging":"Baseia a resposta em competição ou equipamento como regra.","developing":"Nomeia um critério adequado após orientação.","proficient":"Usa critérios pertinentes e identifica informação ausente quando necessário."},{"criterion":"Acesso e participação","emerging":"Propõe uma única forma obrigatória.","developing":"Adiciona alternativa após mediação.","proficient":"Inclui escolhas equivalentes e condição de segurança sem medir aptidão."}]}],"objective":"Distinguir movimento cotidiano de exercício planejado e propor alternativas de participação considerando escolha, acesso e segurança.","common_mistake":"Tratar atividade física e exercício como sinônimos perfeitos; exigir academia ou competição; transformar uma resposta sobre conceitos em diagnóstico ou medida de aptidão.","estimated_minutes":25}'::jsonb
  ) on conflict (canonical_skill_id, version) do nothing;
  select id into v_lesson_id from public.learning_skill_lessons
   where canonical_skill_id = v_skill_id and version = 5
     and metadata->>'content_id' = 'pe-distinguish-activity-exercise' and active = false;
  if v_lesson_id is null then raise exception 'V5_CONTENT_LESSON_CONFLICT'; end if;

  for v_question in
    select * from jsonb_to_recordset('[{"id":"v5-pe-distinguish-probe-01","purpose":"PROBE","difficulty":"EASY","cognitiveProcess":"CLASSIFY","contextFamily":"GARDEN_POT_ARRANGING","statement":"Durante uma atividade escolar, uma estudante organiza vasos leves na horta, sem seguir um plano de treino. Como classificar o movimento descrito?","options":["É atividade física; não há evidência de exercício planejado.","É exercício físico estruturado obrigatoriamente.","Não é atividade física porque não houve competição.","É treinamento de força."],"correctAnswer":"É atividade física; não há evidência de exercício planejado.","explanation":"O movimento corporal pode ser atividade física. A descrição não informa plano, estrutura, repetição e propósito de exercício.","hint":"Procure movimento e depois verifique se a situação também foi planejada e estruturada.","errorFocus":"Exigir plano ou competição para reconhecer atividade física","misconceptions":{"É exercício físico estruturado obrigatoriamente.":["NO_PLAN_NO_ACTIVITY"],"Não é atividade física porque não houve competição.":["COMPETITION_REQUIRED"],"É treinamento de força.":["GARDEN_WORK_IS_STRENGTH_TRAINING"]},"position":1},{"id":"v5-pe-distinguish-practice-01","purpose":"PRACTICE","difficulty":"MEDIUM","cognitiveProcess":"DISTINGUISH","contextFamily":"REHEARSED_MOVEMENT","statement":"Uma turma repete uma sequência de movimentos com objetivo de praticar coordenação, sob orientação docente. Qual leitura é mais precisa?","options":["Não é atividade física porque a sequência tem regras.","É atividade física e pode ser exercício planejado, pois há estrutura, repetição e propósito.","Só é exercício se houver competição.","É apenas lazer porque não usa equipamento."],"correctAnswer":"É atividade física e pode ser exercício planejado, pois há estrutura, repetição e propósito.","explanation":"A situação contém movimento e uma organização repetida com objetivo; equipamento ou competição não são requisitos para a categoria.","hint":"Observe a estrutura, a repetição e o objetivo descritos.","errorFocus":"Reduzir exercício a esporte competitivo ou equipamento","misconceptions":{"Não é atividade física porque a sequência tem regras.":["RULES_EXCLUDE_ACTIVITY"],"Só é exercício se houver competição.":["COMPETITION_DEFINES_EXERCISE"],"É apenas lazer porque não usa equipamento.":["EQUIPMENT_REQUIRED"]},"position":1},{"id":"v5-pe-distinguish-transfer-01","purpose":"TRANSFER","difficulty":"MEDIUM","cognitiveProcess":"PLAN","contextFamily":"SCHOOL_ROUTE_CHOICES","statement":"Uma escola quer oferecer movimento em um dia de chuva. Qual proposta distingue uma atividade cotidiana de uma opção planejada e considera o contexto?","options":["Mandar todos correrem no corredor molhado para cumprir uma meta.","Dizer que só uma aula competitiva conta como movimento.","Mapear deslocamentos seguros no espaço interno e oferecer uma sequência opcional com objetivo, adaptações e supervisão.","Exigir que cada estudante conte quanto se movimenta em casa."],"correctAnswer":"Mapear deslocamentos seguros no espaço interno e oferecer uma sequência opcional com objetivo, adaptações e supervisão.","explanation":"A proposta observa opções no contexto escolar e estrutura uma possibilidade planejada sem obrigar nem coletar dados pessoais.","hint":"Considere espaço, supervisão, escolha e uma alternativa acessível.","errorFocus":"Ignorar contexto, segurança ou privacidade","misconceptions":{"Mandar todos correrem no corredor molhado para cumprir uma meta.":["UNSAFE_CORRIDOR"],"Dizer que só uma aula competitiva conta como movimento.":["COMPETITION_ONLY"],"Exigir que cada estudante conte quanto se movimenta em casa.":["PERSONAL_ACTIVITY_DISCLOSURE"]},"position":1},{"id":"v5-pe-distinguish-lock-01","purpose":"LOCK_IN","difficulty":"HARD","cognitiveProcess":"REPAIR","contextFamily":"PLANNED_MOBILITY_SEQUENCE","statement":"Um estudante afirma: “Sem aparelhos, não pode ser exercício”. Como corrigir a ideia?","options":["Todo movimento é exercício, mesmo sem organização.","Só aparelhos de academia definem exercício.","Exercício exige medir o desempenho de cada colega.","Uma sequência de movimentos pode ser exercício se for planejada, estruturada, repetida e tiver propósito; equipamento não é obrigatório."],"correctAnswer":"Uma sequência de movimentos pode ser exercício se for planejada, estruturada, repetida e tiver propósito; equipamento não é obrigatório.","explanation":"O critério está na organização e no propósito, não em aparelhos ou competição. A avaliação da aula não precisa medir corpos.","hint":"Retire o aparelho da explicação e confira se os critérios de planejamento continuam presentes.","errorFocus":"Confundir exercício com academia ou teste de desempenho","misconceptions":{"Todo movimento é exercício, mesmo sem organização.":["GYM_EQUIPMENT_REQUIRED"],"Só aparelhos de academia definem exercício.":["ALL_MOVEMENT_IS_EXERCISE"],"Exercício exige medir o desempenho de cada colega.":["BODY_TEST_REQUIRED"]},"position":1},{"id":"v5-pe-distinguish-review-01","purpose":"REVIEW","difficulty":"HARD","cognitiveProcess":"EVALUATE","contextFamily":"PLAY_AND_PRACTICE","statement":"Um grupo brinca espontaneamente de lançar uma bola; em outra aula, pratica lançamentos repetidos com um objetivo definido pelo professor. Qual conclusão é melhor?","options":["Ambas envolvem atividade física; a segunda também pode ser exercício planejado.","A brincadeira não envolve atividade física porque não tem plano.","A prática só é exercício se alguém vencer.","As duas situações são idênticas em organização e propósito."],"correctAnswer":"Ambas envolvem atividade física; a segunda também pode ser exercício planejado.","explanation":"O tipo de movimento pode ser parecido, mas o contexto e o planejamento diferem. A brincadeira continua sendo atividade física.","hint":"Compare o movimento com o modo como cada situação foi organizada.","errorFocus":"Ignorar contexto ou reduzir exercício à competição","misconceptions":{"A brincadeira não envolve atividade física porque não tem plano.":["PLAY_NOT_ACTIVITY"],"A prática só é exercício se alguém vencer.":["WINNER_REQUIRED"],"As duas situações são idênticas em organização e propósito.":["CONTEXT_IRRELEVANT"]},"position":1},{"id":"v5-pe-distinguish-practice-02","purpose":"PRACTICE","difficulty":"MEDIUM","cognitiveProcess":"CLASSIFY","contextFamily":"BREAKTIME_DANCE","statement":"No intervalo, um grupo dança espontaneamente ao ouvir uma música. O que a descrição permite afirmar?","options":["Não é atividade física porque não foi uma aula.","É atividade física; não há informação suficiente para dizer que seja exercício planejado.","É exercício estruturado porque existe música.","Só conta como movimento se houver coreografia avaliada."],"correctAnswer":"É atividade física; não há informação suficiente para dizer que seja exercício planejado.","explanation":"Dançar envolve movimento e pode ser atividade física. A presença de música não demonstra, sozinha, planejamento, estrutura e propósito de exercício.","hint":"Separe a atividade observada da organização que não foi descrita.","errorFocus":"Inferir exercício planejado a partir de música ou avaliação","misconceptions":{"Não é atividade física porque não foi uma aula.":["MUSIC_MEANS_EXERCISE"],"É exercício estruturado porque existe música.":["SCHOOL_LESSON_REQUIRED"],"Só conta como movimento se houver coreografia avaliada.":["ASSESSMENT_REQUIRED"]},"position":2}]'::jsonb) as item(
      id text, purpose text, difficulty text, "cognitiveProcess" text,
      "contextFamily" text, statement text, options jsonb, "correctAnswer" text,
      explanation text, hint text, "errorFocus" text, misconceptions jsonb, position integer
    )
  loop
    insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, active, metadata)
    values ('GLOBAL', v_skill_id, v_question.purpose, 5, false,
      jsonb_build_object('content_pack', 'TECESCOLA_CORE_V5_QUESTION_FIRST', 'content_id', 'pe-distinguish-activity-exercise',
        'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING', 'publication_status', 'STAGING',
        'bncc_alignment_status', 'NOT_CLAIMED'))
    on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL' do nothing;
    select id into v_set_id from public.learning_question_sets
     where scope = 'GLOBAL' and canonical_skill_id = v_skill_id
       and purpose = v_question.purpose and version = 5
       and metadata->>'content_id' = 'pe-distinguish-activity-exercise' and active = false;
    if v_set_id is null then raise exception 'V5_CONTENT_QUESTION_SET_CONFLICT'; end if;

    select id into v_question_id from public.learning_question_bank
     where source_type = 'TECESCOLA_CORE_V5_QUESTION_FIRST_STAGING' and metadata->>'content_id' = v_question.id;
    if v_question_id is null then
      insert into public.learning_question_bank(
        package_type, source_type, source_name, subject_area, domain, topic,
        statement, options, correct_answer, explanation, difficulty,
        estimated_minutes, provenance, metadata, active
      ) values (
        'TECESCOLA', 'TECESCOLA_CORE_V5_QUESTION_FIRST_STAGING', 'TecEscola Question First V5 - Staging',
        'PHYSICAL_EDUCATION', 'ATIVIDADE_E_EXERCICIO', 'atividade física e exercício: observar contexto e propósito',
        v_question.statement, v_question.options, to_jsonb(v_question."correctAnswer"),
        v_question.explanation, v_question.difficulty, 2,
        'TECESCOLA_CORE_V5_AUTHORED',
        jsonb_build_object('content_pack', 'TECESCOLA_CORE_V5_QUESTION_FIRST', 'content_id', v_question.id,
          'purpose', v_question.purpose, 'context_family', v_question."contextFamily",
          'cognitive_process', v_question."cognitiveProcess", 'error_focus', v_question."errorFocus",
          'remediation_hint', v_question.hint, 'misconceptions', v_question.misconceptions,
          'content_authoring_status', 'AUTHORED', 'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING',
          'publication_status', 'STAGING', 'bncc_alignment_status', 'NOT_CLAIMED'), false
      ) returning id into v_question_id;
    end if;
    if v_question_id is null then raise exception 'V5_CONTENT_QUESTION_INSERT_FAILED'; end if;
    update public.learning_question_bank set active = false
     where id = v_question_id and source_type = 'TECESCOLA_CORE_V5_QUESTION_FIRST_STAGING';
    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
    values (v_question_id, v_skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;
    insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
    values (v_set_id, v_question_id, v_question.position)
    on conflict (question_set_id, question_bank_id) do nothing;
  end loop;
end;
$seed_question_first_content_v5$;

commit;
-- CONTENT_SHA256=0e9be3988bbf70a0f3c50162bc0b9b5a8fcfcfdf73bd3087c58b2b98ef4e3eb1
