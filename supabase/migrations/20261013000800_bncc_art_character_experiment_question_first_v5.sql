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
  select id into v_parent_skill_id from public.learning_curriculum_skills where catalog_id = v_catalog_id and code = 'ART_INTERPRETATION';
  if v_parent_skill_id is null then raise exception 'V5_INTERNAL_SKILL_PARENT_MISSING:ART_INTERPRETATION'; end if;
  insert into public.learning_curriculum_skills(
    catalog_id, code, stage, grade_level, subject_area, domain, title, description,
    active, node_kind, content_readiness, mastery_targetable, parent_canonical_skill_id,
    pedagogical_review_status, bncc_alignment_status, metadata
  ) values (
    v_catalog_id, 'ART_CREATE_CHARACTER_EXPERIMENT_FI', 'FUNDAMENTAL_I', 1, 'ART', 'CRIACAO_TEATRAL',
    'Experimentar movimento e voz na criacao de personagens', 'Explora escolhas de movimento e voz para criar personagem teatral e conversa sobre estereótipos sem fixar identidades em papéis rígidos.', false, 'LEAF', 'ADAPTIVE_READY', false, v_parent_skill_id,
    'PEDAGOGICAL_REVIEW_PENDING', 'CANDIDATE', '{"content_pack":"TECESCOLA_CORE_V5_QUESTION_FIRST","content_id":"v5-art-character-experiment","source_pack":"tec-escola-knowledge-expansion-v3","source_candidate":"ARTE_POSSIBILIDADES_CRIATIVAS","source_unit_id":"V3_ART_CREATION_FI","internal_skill_code":"ART_CREATE_CHARACTER_EXPERIMENT_FI","grade_from":1,"grade_to":5,"official_source_reference":{"officialCode":"EF15AR22","sourceId":"BNCC_EI_EF_2018","documentVersion":"BNCC Educação Infantil e Ensino Fundamental, versão final 2018","url":"https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf","page":205,"section":"AR > Habilidades","officialDescription":"Experimentar possibilidades criativas de movimento e de voz na criação de um personagem teatral, discutindo estereótipos.","localCatalogExcerpt":") Experimentar possibilidades criativas de movimento e de voz na criação de um personagem teatral, discutindo estereótipos. (EF15AR23) Reconhecer e experimentar, em projetos temáticos, as relações processuais entre diversas linguagens artísticas. (EF15AR24) Caracterizar e experimentar brinquedos, brincadeiras, jogos, danças, canções e histórias de diferentes matrizes estéticas e culturais. (EF15AR25) Conhecer e valorizar o patrimônio cultural, material e imaterial, de culturas diversas, em especial a brasileira, incluindo-se suas matrizes indígenas, africanas e europeias, de diferentes épocas, favorecendo a construção de vocabulário e repertório relativos às diferentes linguagens artísticas. (EF15AR26) Explorar diferentes tecnologias e recursos digitais (multimeios, animações, jogos eletrônicos, gravações em áudio e vídeo, fotografia, softwares etc.) nos processos de criação artística. 2","localCatalogSourceId":"BNCC_EI_EF_2018","localCatalogUrl":"https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf","localCatalogPage":205,"sourceCorrection":null,"sourceStage":"ENSINO_FUNDAMENTAL","officialComponentCode":"AR","officialSubjectArea":"ART","candidateSubject":"ARTE","gradeRange":{"from":1,"to":5},"gradeCompatible":true,"proposalId":"V8_PROPOSAL_ENSINO_FUNDAMENTAL_15_AR_EXPERIMENTAR_POSSIBILIDADES_CRIATIVAS","proposalCanonicalCode":"ARTE_POSSIBILIDADES_CRIATIVAS","proposalStatus":"NEW_SKILL_PENDING_REVIEW","gapClusterId":"V8_GAP_ENSINO_FUNDAMENTAL_15_AR_EXPERIMENTAR_POSSIBILIDADES_CRIATIVAS","referenceStatus":"OFFICIAL_SOURCE_IDENTIFIED_AND_EXCERPT_CHECKED","candidateStatus":"TECHNICAL_CANDIDATE_NOT_APPROVED_MAPPING","mappingClaim":"NONE","mappingStatus":"MAPPING_PENDING","pedagogicalReviewStatus":"PEDAGOGICAL_REVIEW_PENDING","internalSkillCode":"ART_CREATE_CHARACTER_EXPERIMENT_FI","internalGradeRange":{"from":1,"to":5},"evidenceSummary":"The authored capability is a bounded internal interpretation of EF15AR22; it is not a promoted BNCC mapping.","observableCapability":"Em atividade acompanhada, a criança testa ao menos duas combinações de gesto e voz, descreve o efeito percebido e revisa uma escolha após conversa sobre estereótipo.","authoringLimitations":"Questões objetivas são apenas reflexão; domínio requer experimentação teatral acompanhada e observação docente."},"official_mapping_status":"NOT_CLAIMED","pedagogical_review_status":"PEDAGOGICAL_REVIEW_PENDING","publication_status":"STAGING"}'::jsonb
  ) on conflict (catalog_id, code) do nothing;
  if not exists (
    select 1 from public.learning_curriculum_skills
     where catalog_id = v_catalog_id and code = 'ART_CREATE_CHARACTER_EXPERIMENT_FI'
       and stage = 'FUNDAMENTAL_I' and grade_level = 1
       and subject_area = 'ART' and domain = 'CRIACAO_TEATRAL'
       and parent_canonical_skill_id = v_parent_skill_id and active = false and mastery_targetable = false
       and pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING' and bncc_alignment_status = 'CANDIDATE'
       and metadata->>'content_pack' in ('tec-escola-knowledge-expansion-v3', 'TECESCOLA_CORE_V5_QUESTION_FIRST')
  ) then raise exception 'V5_INTERNAL_SKILL_STAGING_SCOPE_CONFLICT:ART_CREATE_CHARACTER_EXPERIMENT_FI'; end if;

  select id into v_skill_id
    from public.learning_curriculum_skills
   where catalog_id = v_catalog_id and code = 'ART_CREATE_CHARACTER_EXPERIMENT_FI';
  if v_skill_id is null then raise exception 'V5_CONTENT_SKILL_MISSING'; end if;

  insert into public.learning_skill_lessons(
    canonical_skill_id, version, title, summary, content_markdown,
    worked_example, tips, estimated_minutes, active, metadata
  ) values (
    v_skill_id, 5, 'Criar personagem com movimento e voz', 'Gesto, postura, ritmo e voz são escolhas teatrais que podem sugerir intenções. Teste combinações, observe pistas e revise com respeito; não existe um jeito natural de um grupo falar ou se mover.', '## Comece por uma intenção, não por um rótulo
Escolha uma situação fictícia e o que o personagem tenta fazer, como pedir ajuda, proteger uma ideia ou encontrar um objeto. Evite começar por estereótipos sobre gênero, origem, deficiência, idade ou cultura. O personagem é uma criação singular, não uma prova sobre um grupo real.

## Experimente movimento e voz
Teste postura, direção do olhar, gesto, ritmo, pausa e volume confortável. Faça duas versões mudando uma escolha de cada vez: por exemplo, a personagem pode falar pausadamente com gestos pequenos e depois usar ritmo mais rápido com movimentos amplos. Compare os efeitos possíveis e indique a pista que os motivou. Não imite a voz, o corpo ou uma característica pessoal de colegas.

## Observe e converse sobre evidências
Quem assiste pode perceber intenções diferentes. Pergunte quais gestos, pausas ou mudanças de ritmo sustentam cada leitura. Feedback útil descreve uma pista e o efeito percebido; não avalia se a voz ou o corpo de uma pessoa é bonito, normal ou correto. Uma interpretação pode variar e ainda ser justificável.

## Revise estereótipos com cuidado
Se uma escolha faz parecer que uma qualidade pertence naturalmente a todo um grupo, revise a cena. Dê ao personagem objetivos, conhecimentos e decisões próprios. A conversa deve abordar a representação ficcional, sem exigir relatos pessoais ou expor estudantes.

## Exemplo resolvido
Uma personagem tenta organizar uma biblioteca barulhenta. Na primeira versão, fala depressa e interrompe; na segunda, faz uma pausa, olha para as estantes e fala em ritmo constante. A turma descreve pistas e compara impressões. Se alguém disser que determinada voz pertence naturalmente a um gênero ou origem, o grupo identifica a generalização e experimenta outra escolha. A revisão busca comunicar a intenção, não ridicularizar pessoas reais.

## Roteiro de experimentação
1. Defina objetivo e situação fictícia. 2. Escolha um gesto e um recurso vocal seguro. 3. Teste outra combinação. 4. Descreva pistas e efeitos percebidos. 5. Revise uma escolha após feedback, preservando respeito e participação voluntária.',
    'Uma personagem tenta encontrar um livro perdido. Na versão 1, a criança usa passos lentos e olhar atento; na versão 2, repete uma pergunta com ritmo mais rápido e pausa antes de olhar sob a mesa. O grupo compara como as pistas sugerem busca cuidadosa ou urgência. Se as leituras forem diferentes, cada pessoa cita um detalhe. Ninguém imita colegas nem afirma que uma voz ou gesto define um grupo.', array['Defina o que o personagem tenta fazer antes de escolher um gesto ou ritmo.', 'Compare postura, olhar, gesto, pausa e voz confortável em duas versões.', 'Use pistas da cena para explicar um efeito possível, sem exigir uma leitura única.', 'Não imite colegas nem transforme características de um grupo em regra.']::text[], 25, false, '{"content_pack":"TECESCOLA_CORE_V5_QUESTION_FIRST","content_id":"v5-art-character-experiment","content_authoring_status":"AUTHORED","pedagogical_review_status":"PEDAGOGICAL_REVIEW_PENDING","publication_status":"STAGING","bncc_alignment_status":"NOT_CLAIMED","prior_knowledge":["Observar gestos, pausas e mudanças de ritmo em narrativas ou brincadeiras.","Combinar regras simples de criação, escuta e participação voluntária."],"key_concepts":["Movimento e voz são escolhas expressivas que podem comunicar intenções.","Uma personagem fictícia não representa naturalmente um grupo real.","Feedback descreve pistas e efeitos sem avaliar corpos ou vozes pessoais.","Experimentação e revisão são evidências do processo artístico.","A avaliação observa criação e reflexão, não exposição ou destreza corporal."],"progression":[{"stage":"FOUNDATION","focus":"Escolher intenção fictícia e experimentar gesto ou recurso vocal seguro.","questionIds":[]},{"stage":"APPLICATION","focus":"Comparar combinações de movimento e voz usando pistas observáveis.","questionIds":[]},{"stage":"TRANSFER","focus":"Transferir escolhas para nova situação sem recorrer a estereótipos.","questionIds":[]},{"stage":"INTEGRATION","focus":"Explicar decisões, considerar leituras diferentes e revisar representações rígidas.","questionIds":[]},{"stage":"SPACED_REVIEW_CANDIDATE","focus":"Retomar a experimentação em outro personagem; revisão espaçada não é automatizada.","questionIds":[]}],"micro_explanations":[{"trigger":"GESTURE_WITHOUT_INTENTION","text":"Diga o que o personagem tenta fazer e relacione a intenção a um gesto, pausa ou ritmo observável."},{"trigger":"STEREOTYPE_AS_NATURAL_TRAIT","text":"Pergunte se a escolha define apenas o personagem fictício ou atribui uma regra a um grupo real; revise a generalização."},{"trigger":"ONE_INTERPRETATION_ONLY","text":"Compare quais pistas sustentam cada leitura. Diferentes interpretações podem ser justificadas por detalhes da cena."}],"remediations":[{"misconception":"GESTURE_WITHOUT_INTENTION","prompt":"Defina o objetivo ficcional do personagem, teste dois gestos seguros e explique que pista mudou."},{"misconception":"STEREOTYPE_AS_NATURAL_TRAIT","prompt":"Reescreva o rótulo como uma característica singular e experimente outra voz ou movimento sem imitar alguém real."},{"misconception":"ART_HAS_ONE_CORRECT_MEANING","prompt":"Peça duas leituras da cena e identifique a pista de movimento ou voz que sustenta cada uma."}],"review_windows_days":[1,3,7],"review_schedule_status":"SUGGESTED_NOT_AUTOMATED","source_dossier":[{"title":"Base Nacional Comum Curricular: Arte no Ensino Fundamental","publisher":"Ministério da Educação","url":"https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf","accessedOn":"2026-10-13","supports":["EF15AR22 trata de experimentar possibilidades criativas de movimento e voz na criação de personagem teatral e discutir estereótipos"],"use":"Referência oficial para escopo; o código interno não recebe vínculo canônico aprovado e a revisão pedagógica humana continua pendente."}],"copyright_note":"As situações, explicações, atividade e rubrica são autorais. A fonte curricular delimita o escopo; não houve cópia de questão ou atividade. Mapeamento oficial e revisão pedagógica humana continuam pendentes.","authentic_activities":[{"id":"v5-art-character-two-versions","title":"Um personagem, duas possibilidades","objective":"Testar combinações de movimento e voz para criar personagem teatral e explicar pistas expressivas sem fixar características em grupos reais.","context":"Cena curta de faz-de-conta, com personagem e situação inteiramente fictícios, mediada pelo professor.","materials":["Cartões de situações fictícias","Espaço livre e seguro ou alternativa sentada","Folha para registrar pistas, sequência ou relato oral"],"instructions":"Escolha uma situação fictícia e um objetivo do personagem. Planeje duas versões mudando uma escolha por vez, como postura, direção do olhar, gesto, pausa ou ritmo de uma fala neutra. Apresente, descreva ou represente as versões de modo voluntário; também é possível usar cartões, storyboard ou observação do professor. Registre a intenção, as pistas e uma revisão após feedback. Não imite colegas nem atribua voz ou gesto a um grupo inteiro.","evidence":"Plano ou registro das duas combinações, ao menos uma pista de movimento e uma de voz ou ritmo, explicação do efeito pretendido, feedback ou leitura alternativa e decisão de revisão. O professor observa o processo, sem exigir apresentação pública nem avaliar características físicas.","safety":"Sem corrida, contato físico obrigatório, gritos ou movimentos que causem desconforto. Oferecer opção sentada, não verbal ou observacional; respeitar pausas e participação voluntária.","ageRange":"Ensino Fundamental I, do 1º ao 5º ano; adaptar instruções, duração e registro à turma.","mediation":"O professor modela linguagem descritiva, interrompe imitação ou ridicularização, oferece alternativa de participação e conduz conversa sobre estereótipos sem solicitar relatos pessoais.","privacyGuard":"Usar personagens e situações fictícios. Não gravar nem publicar voz, imagem ou nome de estudantes. Compartilhamento público é desnecessário; qualquer registro segue regras escolares e consentimento aplicável.","rubric":[{"criterion":"Experimentação de movimento e voz","emerging":"Ainda não testa ou identifica escolhas de movimento ou voz.","developing":"Testa uma variação, mas descreve pouco o que mudou.","proficient":"Compara duas combinações e nomeia pistas observáveis de movimento e voz."},{"criterion":"Intenção e efeito","emerging":"Não relaciona escolha a uma intenção da personagem.","developing":"Nomeia intenção e escolha, com relação parcialmente explicada.","proficient":"Explica como uma pista de gesto, postura, pausa ou ritmo pode comunicar a intenção."},{"criterion":"Reflexão e estereótipos","emerging":"A criação usa um rótulo de grupo sem reflexão.","developing":"Reconhece uma generalização após mediação, mas ainda não revisa a escolha.","proficient":"Revisa uma generalização e trata a personagem como criação singular, respeitando leituras diversas."},{"criterion":"Participação acessível e segura","emerging":"A proposta não oferece alternativa segura ou voluntária.","developing":"Há uma alternativa, mas ela ainda limita a expressão da intenção.","proficient":"A criança escolhe forma segura e acessível de participar, sem exposição ou contato obrigatório."}]}],"objective":"Experimentar duas combinações seguras de movimento e voz para compor um personagem fictício, explicar pistas expressivas e revisar uma escolha sem reproduzir estereótipos.","common_mistake":"Imitar uma pessoa real ou associar um gesto e uma voz a um grupo inteiro, em vez de tratar movimento e fala como escolhas criativas de um personagem fictício.","estimated_minutes":25}'::jsonb
  ) on conflict (canonical_skill_id, version) do nothing;
  select id into v_lesson_id from public.learning_skill_lessons
   where canonical_skill_id = v_skill_id and version = 5
     and metadata->>'content_id' = 'v5-art-character-experiment' and active = false;
  if v_lesson_id is null then raise exception 'V5_CONTENT_LESSON_CONFLICT'; end if;

  for v_question in
    select * from jsonb_to_recordset('[]'::jsonb) as item(
      id text, purpose text, difficulty text, "cognitiveProcess" text,
      "contextFamily" text, statement text, options jsonb, "correctAnswer" text,
      explanation text, hint text, "errorFocus" text, misconceptions jsonb, position integer
    )
  loop
    insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, active, metadata)
    values ('GLOBAL', v_skill_id, v_question.purpose, 5, false,
      jsonb_build_object('content_pack', 'TECESCOLA_CORE_V5_QUESTION_FIRST', 'content_id', 'v5-art-character-experiment',
        'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING', 'publication_status', 'STAGING',
        'bncc_alignment_status', 'NOT_CLAIMED'))
    on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL' do nothing;
    select id into v_set_id from public.learning_question_sets
     where scope = 'GLOBAL' and canonical_skill_id = v_skill_id
       and purpose = v_question.purpose and version = 5
       and metadata->>'content_id' = 'v5-art-character-experiment' and active = false;
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
        'ART', 'CRIACAO_TEATRAL', 'movimento voz e criacao de personagem teatral',
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
-- CONTENT_SHA256=29879f52761a0bcb57a38ecb0860f757cdda152cd63b4a0fb0f120a70a746e4f
