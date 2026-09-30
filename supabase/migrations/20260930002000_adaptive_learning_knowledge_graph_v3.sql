begin;

-- Adaptive Learning V3 extends the V2 guided journey with an explicit,
-- explainable knowledge graph.  It is additive: legacy learning rows remain
-- readable and V2 question sets keep their existing contract.

create table if not exists public.learning_canonical_subjects (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  name text not null,
  aliases text[] not null default '{}',
  capability text not null default 'OBJECTIVE_EVIDENCE_READY'
    check (capability in ('OBJECTIVE_EVIDENCE_READY', 'CONSTRUCTED_EVIDENCE_REQUIRED', 'OBSERVATIONAL_EVIDENCE_REQUIRED')),
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.learning_curriculum_skills
  add column if not exists canonical_subject_id uuid references public.learning_canonical_subjects(id) on delete restrict;

alter table public.learning_question_bank
  add column if not exists canonical_subject_id uuid references public.learning_canonical_subjects(id) on delete set null,
  add column if not exists cognitive_process text,
  add column if not exists context_family text,
  add column if not exists knowledge_mapping_status text not null default 'LEGACY_UNMAPPED'
    check (knowledge_mapping_status in ('LEGACY_UNMAPPED', 'READY', 'BLOCKED')),
  add column if not exists knowledge_mapping_version text;

alter table public.learning_question_bank_skill_links
  drop constraint if exists learning_question_bank_skill_links_skill_role_check;
alter table public.learning_question_bank_skill_links
  add constraint learning_question_bank_skill_links_skill_role_check
    check (skill_role in ('PRIMARY', 'SUPPORTING', 'PREREQUISITE', 'TRANSFER'));
alter table public.learning_question_bank_skill_links
  add column if not exists evidence_bearing boolean not null default false,
  add column if not exists attribution_confidence numeric(4,3) not null default 1
    check (attribution_confidence between 0 and 1);

alter table public.learning_skill_evidence
  add column if not exists evidence_role text not null default 'PRIMARY'
    check (evidence_role in ('PRIMARY', 'SUPPORTING', 'PREREQUISITE', 'TRANSFER')),
  add column if not exists attribution_confidence numeric(4,3) not null default 1
    check (attribution_confidence between 0 and 1),
  add column if not exists question_bank_id uuid references public.learning_question_bank(id) on delete set null,
  add column if not exists misconception_tag_id uuid references public.learning_misconception_tags(id) on delete set null;

create table if not exists public.learning_skill_relationships (
  id uuid primary key default extensions.uuid_generate_v4(),
  from_canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete cascade,
  to_canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete cascade,
  relation_type text not null check (relation_type in ('PREREQUISITE', 'RELATED', 'TRANSFER')),
  relation_source text not null default 'TECESCOLA_DERIVED',
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint learning_skill_relationships_not_self check (from_canonical_skill_id <> to_canonical_skill_id),
  unique (from_canonical_skill_id, to_canonical_skill_id, relation_type)
);
create index if not exists learning_skill_relationships_from_idx
  on public.learning_skill_relationships(from_canonical_skill_id, relation_type);
create index if not exists learning_skill_relationships_to_idx
  on public.learning_skill_relationships(to_canonical_skill_id, relation_type);

create table if not exists public.learning_question_option_misconceptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  question_bank_id uuid not null references public.learning_question_bank(id) on delete cascade,
  option_value text not null,
  misconception_tag_id uuid not null references public.learning_misconception_tags(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  confidence_weight numeric(4,3) not null default 1 check (confidence_weight between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (question_bank_id, option_value, misconception_tag_id, canonical_skill_id)
);
create index if not exists learning_question_option_misconceptions_lookup_idx
  on public.learning_question_option_misconceptions(question_bank_id, option_value);

create table if not exists public.learning_evidence_attributions (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  question_bank_id uuid not null references public.learning_question_bank(id) on delete restrict,
  guided_attempt_id uuid references public.learning_guided_step_attempts(id) on delete set null,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  evidence_role text not null check (evidence_role in ('PRIMARY', 'SUPPORTING', 'PREREQUISITE', 'TRANSFER')),
  correct boolean not null,
  score numeric(5,2) not null check (score between 0 and 100),
  attribution_confidence numeric(4,3) not null check (attribution_confidence between 0 and 1),
  misconception_tag_id uuid references public.learning_misconception_tags(id) on delete set null,
  purpose text check (purpose is null or purpose in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW')),
  context_family text,
  decision_reason_code text not null,
  created_at timestamptz not null default now(),
  unique (guided_attempt_id, question_bank_id, canonical_skill_id, evidence_role)
);
create index if not exists learning_evidence_attributions_student_skill_idx
  on public.learning_evidence_attributions(institution_id, student_id, canonical_skill_id, created_at desc);

create table if not exists public.learning_misconception_signals (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  misconception_tag_id uuid not null references public.learning_misconception_tags(id) on delete cascade,
  state text not null default 'SIGNAL'
    check (state in ('SIGNAL', 'SUSPECTED', 'CONFIRMED', 'RECOVERING', 'RESOLVED')),
  signal_count integer not null default 0 check (signal_count >= 0),
  distinct_context_count integer not null default 0 check (distinct_context_count >= 0),
  recovery_count integer not null default 0 check (recovery_count >= 0),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  first_signal_at timestamptz,
  last_signal_at timestamptz,
  last_recovery_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (institution_id, student_id, canonical_skill_id, misconception_tag_id)
);
create index if not exists learning_misconception_signals_student_idx
  on public.learning_misconception_signals(institution_id, student_id, state, updated_at desc);

alter table public.learning_guided_sessions
  add column if not exists original_target_canonical_subject_id uuid references public.learning_canonical_subjects(id) on delete set null,
  add column if not exists current_canonical_subject_id uuid references public.learning_canonical_subjects(id) on delete set null;

update public.learning_curriculum_skills skill
   set canonical_subject_id = subject.id
  from public.learning_canonical_subjects subject
 where skill.canonical_subject_id is null
   and (
     (skill.subject_area = 'MATEMATICA' and subject.code = 'MATHEMATICS')
     or (skill.subject_area = 'LINGUAGENS' and subject.code = 'PORTUGUESE')
   );

-- Canonical subject registry.  Aliases are intentionally explicit: an
-- ambiguous institutional label must be reviewed instead of silently guessed.
insert into public.learning_canonical_subjects(code, name, aliases, capability, metadata)
values
  ('PORTUGUESE', 'Lingua Portuguesa', array['Portugues', 'Lingua Portuguesa'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'READING_ARGUMENT')),
  ('MATHEMATICS', 'Matematica', array['Matematica'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'PERCENTAGE')),
  ('SCIENCE', 'Ciencias', array['Ciencias', 'Ciencias da Natureza'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'SCIENCE_TRANSFORMATIONS')),
  ('BIOLOGY', 'Biologia', array['Biologia'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'BIOLOGY_GENETICS')),
  ('PHYSICS', 'Fisica', array['Fisica'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'PHYSICS_AVERAGE_SPEED')),
  ('CHEMISTRY', 'Quimica', array['Quimica'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'CHEMISTRY_ATOMS')),
  ('HISTORY', 'Historia', array['Historia'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'HISTORY_INTERPRETATION')),
  ('GEOGRAPHY', 'Geografia', array['Geografia'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'GEOGRAPHY_TERRITORY')),
  ('PHILOSOPHY', 'Filosofia', array['Filosofia'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'PHILOSOPHY_ARGUMENT')),
  ('SOCIOLOGY', 'Sociologia', array['Sociologia'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'SOCIOLOGY_INSTITUTIONS')),
  ('ART', 'Arte', array['Arte'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'ART_INTERPRETATION')),
  ('PHYSICAL_EDUCATION', 'Educacao Fisica', array['Educacao Fisica', 'Ed. Fisica'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'PE_SPORT_PRINCIPLES')),
  ('ENGLISH', 'Lingua Inglesa', array['Ingles', 'Lingua Inglesa'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'ENGLISH_READING')),
  ('RELIGIOUS_EDUCATION', 'Ensino Religioso', array['Ensino Religioso'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'RELIGIOUS_DIVERSITY')),
  ('COMPUTING', 'Computacao e Educacao Digital', array['Computacao', 'Educacao Digital'], 'OBJECTIVE_EVIDENCE_READY', jsonb_build_object('target_skill', 'COMPUTING_ALGORITHMS'))
on conflict (code) do update set
  name = excluded.name,
  aliases = excluded.aliases,
  capability = excluded.capability,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();

do $seed$
declare
  v_catalog_id uuid;
  subject_row record;
  skill_row record;
  skill_ids uuid[];
  target_row record;
  target_skill_id uuid;
  prerequisite_id uuid;
  question_id uuid;
  question_set_id uuid;
  question_number integer;
  purpose text;
  set_purpose text;
  context_family text;
  cognitive_process text;
  correct_text text;
  options jsonb;
  question_metadata jsonb;
begin
  insert into public.learning_curriculum_catalogs(code, name, version, description, active)
  values ('TECESCOLA_CORE', 'TecEscola Core V3', '1.0', 'Catalogo autoral do grafo de conhecimento TecEscola.', true)
  on conflict (code, version) do update set name = excluded.name, description = excluded.description, active = true, updated_at = now()
  returning id into v_catalog_id;
  if v_catalog_id is null then
    select id into v_catalog_id from public.learning_curriculum_catalogs where code = 'TECESCOLA_CORE' and version = '1.0';
  end if;

  for skill_row in
    select * from jsonb_to_recordset(replace('[
      {"subject":"PORTUGUESE","code":"READING_LITERAL","title":"Compreensao literal","domain":"LEITURA","order":1},
      {"subject":"PORTUGUESE","code":"READING_INFERENCE","title":"Inferencia de leitura","domain":"LEITURA","order":2},
      {"subject":"PORTUGUESE","code":"READING_ARGUMENT","title":"Leitura argumentativa","domain":"ARGUMENTACAO","order":3},
      {"subject":"MATHEMATICS","code":"FRACTIONS","title":"Fundamentos de fracoes","domain":"NUMEROS","order":1},
      {"subject":"MATHEMATICS","code":"RATIO_PROPORTION","title":"Razao e proporcao","domain":"PROPORCOES","order":2},
      {"subject":"MATHEMATICS","code":"PERCENTAGE","title":"Porcentagem","domain":"NUMEROS","order":3},
      {"subject":"SCIENCE","code":"SCIENCE_MATTER","title":"Materia e propriedades","domain":"MATERIA","order":1},
      {"subject":"SCIENCE","code":"SCIENCE_TRANSFORMATIONS","title":"Transformacoes da materia","domain":"TRANSFORMACOES","order":2},
      {"subject":"SCIENCE","code":"SCIENCE_ENERGY","title":"Energia e suas formas","domain":"ENERGIA","order":3},
      {"subject":"BIOLOGY","code":"BIOLOGY_CELL","title":"Celula e organizacao da vida","domain":"CELULA","order":1},
      {"subject":"BIOLOGY","code":"BIOLOGY_GENETICS","title":"Fundamentos de genetica","domain":"GENETICA","order":2},
      {"subject":"BIOLOGY","code":"BIOLOGY_ECOLOGY","title":"Ecologia e interacoes","domain":"ECOLOGIA","order":3},
      {"subject":"PHYSICS","code":"PHYSICS_MEASUREMENT","title":"Medidas e unidades","domain":"MEDIDAS","order":1},
      {"subject":"PHYSICS","code":"PHYSICS_MOTION","title":"Movimento e representacoes","domain":"MOVIMENTO","order":2},
      {"subject":"PHYSICS","code":"PHYSICS_AVERAGE_SPEED","title":"Velocidade media","domain":"VELOCIDADE","order":3},
      {"subject":"CHEMISTRY","code":"CHEMISTRY_MATTER","title":"Materia e misturas","domain":"MATERIA","order":1},
      {"subject":"CHEMISTRY","code":"CHEMISTRY_ATOMS","title":"Atomos e modelos","domain":"ATOMOS","order":2},
      {"subject":"CHEMISTRY","code":"CHEMISTRY_TRANSFORMATIONS","title":"Transformacoes quimicas","domain":"TRANSFORMACOES","order":3},
      {"subject":"HISTORY","code":"HISTORY_SOURCES","title":"Fontes historicas","domain":"FONTES","order":1},
      {"subject":"HISTORY","code":"HISTORY_CHRONOLOGY","title":"Cronologia e periodizacao","domain":"CRONOLOGIA","order":2},
      {"subject":"HISTORY","code":"HISTORY_INTERPRETATION","title":"Interpretacao historica","domain":"INTERPRETACAO","order":3},
      {"subject":"GEOGRAPHY","code":"GEOGRAPHY_SPACE","title":"Espaco e lugar","domain":"ESPACO","order":1},
      {"subject":"GEOGRAPHY","code":"GEOGRAPHY_CARTOGRAPHY","title":"Cartografia e representacao","domain":"CARTOGRAFIA","order":2},
      {"subject":"GEOGRAPHY","code":"GEOGRAPHY_TERRITORY","title":"Territorio e paisagem","domain":"TERRITORIO","order":3},
      {"subject":"PHILOSOPHY","code":"PHILOSOPHY_CONCEPT","title":"Formacao de conceitos","domain":"CONCEITO","order":1},
      {"subject":"PHILOSOPHY","code":"PHILOSOPHY_ARGUMENT","title":"Argumentacao filosofica","domain":"ARGUMENTO","order":2},
      {"subject":"PHILOSOPHY","code":"PHILOSOPHY_LOGIC","title":"Analise logica","domain":"LOGICA","order":3},
      {"subject":"SOCIOLOGY","code":"SOCIOLOGY_INDIVIDUAL","title":"Individuo e sociedade","domain":"INDIVIDUO","order":1},
      {"subject":"SOCIOLOGY","code":"SOCIOLOGY_INSTITUTIONS","title":"Instituicoes sociais","domain":"INSTITUICOES","order":2},
      {"subject":"SOCIOLOGY","code":"SOCIOLOGY_STRUCTURE","title":"Estrutura social","domain":"ESTRUTURA","order":3},
      {"subject":"ART","code":"ART_ELEMENTS","title":"Elementos visuais","domain":"ELEMENTOS","order":1},
      {"subject":"ART","code":"ART_INTERPRETATION","title":"Interpretacao de obras","domain":"INTERPRETACAO","order":2},
      {"subject":"ART","code":"ART_CONTEXT","title":"Contexto artistico","domain":"CONTEXTO","order":3},
      {"subject":"PHYSICAL_EDUCATION","code":"PE_BODY_MOVEMENT","title":"Corpo e movimento","domain":"CORPO","order":1},
      {"subject":"PHYSICAL_EDUCATION","code":"PE_SPORT_PRINCIPLES","title":"Principios dos esportes","domain":"ESPORTES","order":2},
      {"subject":"PHYSICAL_EDUCATION","code":"PE_HEALTH_ACTIVITY","title":"Saude e atividade","domain":"SAUDE","order":3},
      {"subject":"ENGLISH","code":"ENGLISH_VOCABULARY","title":"Vocabulary in context","domain":"VOCABULARIO","order":1},
      {"subject":"ENGLISH","code":"ENGLISH_READING","title":"Literal reading","domain":"LEITURA","order":2},
      {"subject":"ENGLISH","code":"ENGLISH_INFERENCE","title":"Reading inference","domain":"INFERENCIA","order":3},
      {"subject":"RELIGIOUS_EDUCATION","code":"RELIGIOUS_TRADITIONS","title":"Tradicoes culturais","domain":"TRADICOES","order":1},
      {"subject":"RELIGIOUS_EDUCATION","code":"RELIGIOUS_DIVERSITY","title":"Diversidade e respeito","domain":"DIVERSIDADE","order":2},
      {"subject":"RELIGIOUS_EDUCATION","code":"RELIGIOUS_INTERPRETATION","title":"Interpretacao e dialogo","domain":"INTERPRETACAO","order":3},
      {"subject":"COMPUTING","code":"COMPUTING_ALGORITHMS","title":"Algoritmos e decomposicao","domain":"PENSAMENTO_COMPUTACIONAL","order":1},
      {"subject":"COMPUTING","code":"COMPUTING_DIGITAL_REPRESENTATION","title":"Representacao digital","domain":"MUNDO_DIGITAL","order":2},
      {"subject":"COMPUTING","code":"COMPUTING_DIGITAL_CITIZENSHIP","title":"Cidadania digital","domain":"CULTURA_DIGITAL","order":3}
    ]'::jsonb::text, '"order"', '"skill_order"')::jsonb) as item(subject_code text, skill_code text, skill_title text, domain text, skill_order integer)
  loop
    insert into public.learning_curriculum_skills(
      catalog_id, code, stage, grade_level, subject_area, domain, title, description,
      canonical_subject_id, active, metadata
    )
    select v_catalog_id, skill_row.skill_code, 'ENSINO_MEDIO', 1, skill_row.subject_code,
      skill_row.domain, skill_row.skill_title,
      'Skill canonica autoral TecEscola para o grafo V3.', subject.id, true,
      jsonb_build_object('v3_order', skill_row.skill_order, 'provenance', 'TECESCOLA_DERIVED')
      from public.learning_canonical_subjects subject
     where subject.code = skill_row.subject_code
    on conflict (catalog_id, code) do update set
      subject_area = excluded.subject_area,
      domain = excluded.domain,
      title = excluded.title,
      description = excluded.description,
      canonical_subject_id = excluded.canonical_subject_id,
      metadata = public.learning_curriculum_skills.metadata || excluded.metadata,
      active = true,
      updated_at = now();
  end loop;

  for subject_row in select * from public.learning_canonical_subjects where active loop
    select array_agg(skill.id order by (skill.metadata->>'v3_order')::integer)
      into skill_ids
      from public.learning_curriculum_skills skill
     where skill.catalog_id = v_catalog_id
       and skill.canonical_subject_id = subject_row.id
       and skill.active;
    if coalesce(array_length(skill_ids, 1), 0) >= 3 then
      insert into public.learning_skill_prerequisites(skill_id, prerequisite_skill_id)
      values (skill_ids[2], skill_ids[1]), (skill_ids[3], skill_ids[2])
      on conflict do nothing;
    end if;
    select skill.id into target_skill_id
      from public.learning_curriculum_skills skill
     where skill.catalog_id = v_catalog_id
       and skill.code = subject_row.metadata->>'target_skill'
       and skill.active;
    if target_skill_id is not null then
      insert into public.learning_curriculum_grade_targets(catalog_id, stage, grade_level, subject_area, canonical_skill_id, priority, sort_order, active)
      values (v_catalog_id, 'ENSINO_MEDIO', 1, subject_row.code, target_skill_id, 0, 0, true)
      on conflict (catalog_id, stage, grade_level, subject_area, canonical_skill_id)
      do update set active = true, updated_at = now();
      insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, metadata)
      values (
        target_skill_id, 3,
        (select title from public.learning_curriculum_skills where id = target_skill_id),
        'Vertical inicial do grafo de conhecimento V3.',
        'CONCEITO\n\nEste material apresenta uma ideia central e mostra como observar evidencias em contextos diferentes.\n\nEXEMPLO\n\nCompare a situacao com o conceito antes de escolher uma resposta.\n\nLIMITACAO\n\nUma resposta isolada nao confirma uma lacuna.',
        'Relacionar o contexto, a evidencia e o conceito antes de concluir.',
        array['Explique qual evidencia sustenta sua resposta.', 'Compare contextos diferentes antes de generalizar.'],
        8, jsonb_build_object('engine_version', 'V3', 'provenance', 'TECESCOLA_CORE_V3')
      ) on conflict (canonical_skill_id, version) do update set active = true, metadata = excluded.metadata, updated_at = now();
    end if;
  end loop;

  -- Existing V2 content becomes V3-ready only after it receives the explicit
  -- mapping fields; its IDs and authored text remain unchanged.
  update public.learning_question_bank question
     set canonical_subject_id = subject.id,
         cognitive_process = coalesce(question.metadata->>'cognitive_process', case question.metadata->>'adaptive_v2_purpose' when 'PROBE' then 'IDENTIFY' when 'PRACTICE' then 'APPLY' when 'TRANSFER' then 'INTERPRET' when 'LOCK_IN' then 'ANALYZE' else 'EVALUATE' end),
         context_family = coalesce(question.metadata->>'context_family', 'LEGACY_V2'),
         knowledge_mapping_status = 'READY',
         knowledge_mapping_version = 'V3',
         metadata = question.metadata || jsonb_build_object('knowledge_mapping_version', 'V3', 'knowledge_mapping_status', 'READY')
    from public.learning_canonical_subjects subject
   where question.source_type = 'TECESCOLA_CORE_V2'
     and subject.code = case when question.subject_area in ('MATEMATICA', 'MATHEMATICS') then 'MATHEMATICS' else 'PORTUGUESE' end;
  update public.learning_question_bank_skill_links link
     set evidence_bearing = true, attribution_confidence = 1
    from public.learning_question_bank question
   where question.id = link.question_bank_id
     and question.source_type = 'TECESCOLA_CORE_V2'
     and link.skill_role = 'PRIMARY';

  for target_row in
    select subject.code as subject_code, subject.name as subject_name,
           subject.metadata->>'target_skill' as target_code,
           skill.id as target_id, skill.domain as target_domain
      from public.learning_canonical_subjects subject
      join public.learning_curriculum_skills skill
        on skill.canonical_subject_id = subject.id
       and skill.code = subject.metadata->>'target_skill'
       and skill.active
     where subject.active
  loop
    for question_number in 1..12 loop
      purpose := case when question_number <= 3 then 'PROBE' when question_number <= 7 then 'PRACTICE' when question_number <= 9 then 'TRANSFER' when question_number <= 11 then 'LOCK_IN' else 'REVIEW' end;
      context_family := case question_number when 1 then 'DIRECT_CALCULATION' when 2 then 'DISCOUNT' when 3 then 'INCREASE' when 4 then 'PROPORTION' when 5 then 'FINANCIAL_CONTEXT' when 6 then 'CLASSROOM' when 7 then 'COMPARISON' when 8 then 'CHART' when 9 then 'DAILY_LIFE' when 10 then 'TRANSFER' when 11 then 'LOCK_IN' else 'REVIEW' end;
      cognitive_process := case purpose when 'PROBE' then 'IDENTIFY' when 'PRACTICE' then 'APPLY' when 'TRANSFER' then 'INTERPRET' when 'LOCK_IN' then 'ANALYZE' else 'EVALUATE' end;
      correct_text := 'Aplicacao coerente de ' || target_row.target_code;
      options := jsonb_build_array(correct_text, 'Confusao comum sobre ' || target_row.target_code, 'Informacao sem relacao com ' || target_row.target_code, 'Conclusao que contradiz ' || target_row.target_code);
      if target_row.target_code = 'PERCENTAGE' and question_number = 1 then
        options := jsonb_build_array('180', '60', '215', '225');
        correct_text := '180';
      end if;
      question_metadata := jsonb_build_object(
        'adaptive_v3_purpose', purpose,
        'adaptive_version', 'V3',
        'content_pack', 'tec-escola-core-v3',
        'content_question_id', 'v3-' || lower(target_row.subject_code) || '-' || lower(target_row.target_code) || '-' || question_number,
        'context_family', context_family,
        'cognitive_process', cognitive_process,
        'knowledge_mapping_status', 'READY',
        'provenance', 'TECESCOLA_CORE_V3'
      );
      select question.id into question_id
        from public.learning_question_bank question
       where question.source_type = 'TECESCOLA_CORE_V3'
         and question.metadata->>'content_question_id' = question_metadata->>'content_question_id'
       limit 1;
      if question_id is null then
        insert into public.learning_question_bank(
          package_type, source_type, source_name, subject_area, domain, topic,
          statement, options, correct_answer, explanation, difficulty,
          estimated_minutes, provenance, metadata, canonical_subject_id,
          cognitive_process, context_family, knowledge_mapping_status,
          knowledge_mapping_version, active
        ) values (
          'TECESCOLA', 'TECESCOLA_CORE_V3', 'TecEscola Core V3', target_row.subject_code,
          target_row.target_domain, target_row.target_code,
          target_row.subject_name || ' | ' || target_row.target_code || ' | ' || context_family || ' | questao ' || question_number || ': qual alternativa aplica melhor o conceito ao contexto apresentado?',
          options, to_jsonb(correct_text),
          'A alternativa correta relaciona o contexto ao conceito sem extrapolar as evidencias.',
          case when question_number <= 3 then 'EASY' when question_number >= 10 then 'HARD' else 'MEDIUM' end,
          3, 'Conteudo autoral versionado do TecEscola; nao e BNCC oficial.', question_metadata,
          (select id from public.learning_canonical_subjects where code = target_row.subject_code),
          cognitive_process, context_family, 'READY', 'V3', true
        ) returning id into question_id;
      else
        update public.learning_question_bank set
          statement = target_row.subject_name || ' | ' || target_row.target_code || ' | ' || context_family || ' | questao ' || question_number || ': qual alternativa aplica melhor o conceito ao contexto apresentado?',
          options = options, correct_answer = to_jsonb(correct_text), explanation = 'A alternativa correta relaciona o contexto ao conceito sem extrapolar as evidencias.',
          metadata = question_metadata, canonical_subject_id = (select id from public.learning_canonical_subjects where code = target_row.subject_code),
          domain = target_row.target_domain, topic = target_row.target_code, cognitive_process = cognitive_process,
          context_family = context_family, knowledge_mapping_status = 'READY', knowledge_mapping_version = 'V3', active = true, updated_at = now()
        where id = question_id;
      end if;
      insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role, evidence_bearing, attribution_confidence)
      values (question_id, target_row.target_id, 'PRIMARY', true, 1)
      on conflict (question_bank_id, canonical_skill_id) do update set skill_role = 'PRIMARY', evidence_bearing = true, attribution_confidence = 1;
      if target_row.target_code in ('PERCENTAGE', 'PHYSICS_AVERAGE_SPEED') then
        select skill.id into prerequisite_id from public.learning_curriculum_skills skill where skill.catalog_id = v_catalog_id and skill.code = 'RATIO_PROPORTION' and skill.active;
        if prerequisite_id is not null then
          insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role, evidence_bearing, attribution_confidence)
          values (question_id, prerequisite_id, case when question_number = 2 then 'PREREQUISITE' when question_number = 3 then 'TRANSFER' else 'SUPPORTING' end, question_number > 3, case when question_number > 3 then .5 else .35 end)
          on conflict (question_bank_id, canonical_skill_id) do update set skill_role = excluded.skill_role, evidence_bearing = excluded.evidence_bearing, attribution_confidence = excluded.attribution_confidence;
        end if;
      end if;
    end loop;
    for set_purpose in select unnest(array['PROBE','PRACTICE','TRANSFER','LOCK_IN','REVIEW']) loop
      select id into question_set_id from public.learning_question_sets question_set where question_set.scope = 'GLOBAL' and question_set.canonical_skill_id = target_row.target_id and question_set.purpose = set_purpose and question_set.version = 3 limit 1;
      if question_set_id is null then
        insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, metadata)
        values ('GLOBAL', target_row.target_id, set_purpose, 3, jsonb_build_object('content_pack', 'tec-escola-core-v3', 'adaptive_version', 'V3'))
        returning id into question_set_id;
      else
        update public.learning_question_sets set metadata = metadata || jsonb_build_object('content_pack', 'tec-escola-core-v3', 'adaptive_version', 'V3'), active = true, updated_at = now() where id = question_set_id;
      end if;
      delete from public.learning_question_set_items item where item.question_set_id = question_set_id;
      insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
      select question_set_id, question.id, row_number() over (order by question.metadata->>'content_question_id') - 1
        from public.learning_question_bank question
       where question.source_type = 'TECESCOLA_CORE_V3'
         and question.metadata->>'content_question_id' like 'v3-' || lower(target_row.subject_code) || '-' || lower(target_row.target_code) || '-%'
         and question.metadata->>'adaptive_v3_purpose' = set_purpose
         and question.active;
    end loop;
  end loop;

  insert into public.learning_skill_relationships(from_canonical_skill_id, to_canonical_skill_id, relation_type, relation_source, confidence, metadata)
  select target.id, ratio.id, 'PREREQUISITE', 'TECESCOLA_DERIVED', .8, jsonb_build_object('reason', 'Velocidade media exige divisao e razao.')
    from public.learning_curriculum_skills target
    join public.learning_curriculum_skills ratio on ratio.catalog_id = target.catalog_id and ratio.code = 'RATIO_PROPORTION'
   where target.catalog_id = v_catalog_id and target.code = 'PHYSICS_AVERAGE_SPEED'
  on conflict do nothing;
  insert into public.learning_skill_relationships(from_canonical_skill_id, to_canonical_skill_id, relation_type, relation_source, confidence)
  select percentage.id, ratio.id, 'RELATED', 'TECESCOLA_DERIVED', .7
    from public.learning_curriculum_skills percentage
    join public.learning_curriculum_skills ratio on ratio.catalog_id = percentage.catalog_id and ratio.code = 'RATIO_PROPORTION'
   where percentage.catalog_id = v_catalog_id and percentage.code = 'PERCENTAGE'
  on conflict do nothing;

  insert into public.learning_misconception_tags(code, title, description, active)
  values
    ('DISCOUNT_AS_FINAL_PRICE', 'Desconto confundido com preco final', 'Trata o valor descontado como se fosse o preco final.', true),
    ('PERCENT_AS_ABSOLUTE_VALUE', 'Percentual tratado como valor absoluto', 'Le o percentual sem aplicar a base.', true),
    ('INCORRECT_PERCENT_CONVERSION', 'Conversao percentual incorreta', 'Converte a taxa para a operacao errada.', true),
    ('FRACTION_ADD_DIRECT_COMPONENTS', 'Soma direta de componentes de fracoes', 'Soma numeradores e denominadores sem denominador comum.', true)
  on conflict (code) do update set title = excluded.title, description = excluded.description, active = true;

  insert into public.learning_question_option_misconceptions(question_bank_id, option_value, misconception_tag_id, canonical_skill_id, confidence_weight, metadata)
  select question.id, option_value.value, tag.id, skill.id, .8, jsonb_build_object('provenance', 'TECESCOLA_CORE_V3')
    from public.learning_question_bank question
    cross join lateral (values ('60', 'DISCOUNT_AS_FINAL_PRICE'), ('215', 'PERCENT_AS_ABSOLUTE_VALUE'), ('225', 'INCORRECT_PERCENT_CONVERSION')) option_value(value, tag_code)
    join public.learning_curriculum_skills skill on skill.catalog_id = v_catalog_id and skill.code = 'PERCENTAGE'
    join public.learning_misconception_tags tag on tag.code = option_value.tag_code
   where question.source_type = 'TECESCOLA_CORE_V3'
     and question.metadata->>'content_question_id' = 'v3-mathematics-percentage-1'
  on conflict do nothing;
  insert into public.learning_question_option_misconceptions(question_bank_id, option_value, misconception_tag_id, canonical_skill_id, confidence_weight, metadata)
  select question.id, '2/6', tag.id, skill.id, .8, jsonb_build_object('provenance', 'TECESCOLA_CORE_V2')
    from public.learning_question_bank question
    join public.learning_curriculum_skills skill on skill.catalog_id = v_catalog_id and skill.code = 'FRACTIONS'
    join public.learning_misconception_tags tag on tag.code = 'FRACTION_ADD_DIRECT_COMPONENTS'
   where question.metadata->>'content_question_id' = 'fractions-4'
  on conflict do nothing;
end;
$seed$;

create or replace function private.learning_question_bank_v3_ready(target_question_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.learning_question_bank question
    where question.id = target_question_id
      and question.active
      and question.knowledge_mapping_status = 'READY'
      and question.knowledge_mapping_version = 'V3'
      and question.subject_area is not null
      and question.domain is not null
      and question.topic is not null
      and question.cognitive_process is not null
      and question.provenance is not null
      and (select count(*) from public.learning_question_bank_skill_links link where link.question_bank_id = question.id and link.skill_role = 'PRIMARY') = 1
  );
$$;

create or replace function private.validate_learning_question_set_item_v3()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare set_metadata jsonb;
begin
  select metadata into set_metadata from public.learning_question_sets where id = new.question_set_id;
  if coalesce(set_metadata->>'adaptive_version', '') = 'V3'
     and not private.learning_question_bank_v3_ready(new.question_bank_id) then
    raise exception 'ADAPTIVE_SET_WITH_UNMAPPED_QUESTION';
  end if;
  return new;
end;
$$;
drop trigger if exists learning_question_set_items_validate_v3 on public.learning_question_set_items;
create trigger learning_question_set_items_validate_v3
before insert or update on public.learning_question_set_items
for each row execute function private.validate_learning_question_set_item_v3();

create or replace function public.validate_learning_question_set_v3(p_question_set_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare total_count integer; invalid_count integer;
begin
  select count(*)::integer into total_count from public.learning_question_set_items where question_set_id = p_question_set_id;
  select count(*)::integer into invalid_count from public.learning_question_set_items item where item.question_set_id = p_question_set_id and not private.learning_question_bank_v3_ready(item.question_bank_id);
  return jsonb_build_object('question_set_id', p_question_set_id, 'total_questions', total_count, 'invalid_questions', invalid_count, 'publishable', total_count > 0 and invalid_count = 0);
end;
$$;

create or replace function private.refresh_learning_misconception_signal_v3(
  target_institution_id uuid,
  target_student_id uuid,
  target_skill_id uuid,
  target_tag_id uuid
)
returns void language plpgsql security definer set search_path = ''
as $$
declare negative_count integer; context_count integer; positive_count integer; signal_state text; confidence numeric;
begin
  select count(*) filter (where not correct)::integer,
         count(distinct context_family) filter (where not correct)::integer,
         count(*) filter (where correct)::integer
    into negative_count, context_count, positive_count
    from public.learning_evidence_attributions
   where institution_id = target_institution_id and student_id = target_student_id
     and canonical_skill_id = target_skill_id and misconception_tag_id = target_tag_id;
  signal_state := case
    when negative_count >= 3 and context_count >= 2 and positive_count >= 2 then 'RESOLVED'
    when negative_count >= 3 and context_count >= 2 and positive_count = 1 then 'RECOVERING'
    when negative_count >= 3 and context_count >= 2 then 'CONFIRMED'
    when negative_count = 2 then 'SUSPECTED'
    when negative_count = 1 then 'SIGNAL'
    else 'RESOLVED'
  end;
  confidence := least(1::numeric, (negative_count::numeric / 3) * .6 + (context_count::numeric / 2) * .4);
  insert into public.learning_misconception_signals(
    institution_id, student_id, canonical_skill_id, misconception_tag_id, state,
    signal_count, distinct_context_count, recovery_count, confidence,
    first_signal_at, last_signal_at, last_recovery_at, updated_at
  ) values (
    target_institution_id, target_student_id, target_skill_id, target_tag_id, signal_state,
    negative_count, context_count, positive_count, confidence,
    now(), now(), case when positive_count > 0 then now() else null end, now()
  ) on conflict (institution_id, student_id, canonical_skill_id, misconception_tag_id)
  do update set state = excluded.state, signal_count = excluded.signal_count,
    distinct_context_count = excluded.distinct_context_count, recovery_count = excluded.recovery_count,
    confidence = excluded.confidence, last_signal_at = now(),
    last_recovery_at = case when excluded.recovery_count > 0 then now() else learning_misconception_signals.last_recovery_at end,
    updated_at = now();
end;
$$;

create or replace function private.record_learning_v3_attributions()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare answer_item jsonb; question_id uuid; selected_option text; expected_option text; is_correct boolean; context text; link record; tag record; has_tag boolean;
begin
  for answer_item in select value from jsonb_array_elements(coalesce(new.answers, '[]'::jsonb)) value loop
    begin question_id := (answer_item->>'question_bank_id')::uuid; exception when others then question_id := null; end;
    if question_id is null then continue; end if;
    selected_option := answer_item->'answer' #>> '{}';
    select question.correct_answer #>> '{}', question.context_family into expected_option, context
      from public.learning_question_bank question where question.id = question_id;
    is_correct := selected_option is not distinct from expected_option;
    has_tag := false;
    for tag in
      select mapping.misconception_tag_id, mapping.canonical_skill_id, mapping.confidence_weight
        from public.learning_question_option_misconceptions mapping
       where mapping.question_bank_id = question_id and mapping.option_value = selected_option
    loop
      has_tag := true;
      for link in
        select skill_link.canonical_skill_id, skill_link.skill_role, skill_link.evidence_bearing, skill_link.attribution_confidence
          from public.learning_question_bank_skill_links skill_link
         where skill_link.question_bank_id = question_id
           and (skill_link.skill_role = 'PRIMARY' or (not is_correct and skill_link.canonical_skill_id = tag.canonical_skill_id) or (is_correct and skill_link.evidence_bearing))
      loop
        insert into public.learning_evidence_attributions(
          institution_id, student_id, question_bank_id, guided_attempt_id, canonical_skill_id,
          evidence_role, correct, score, attribution_confidence, misconception_tag_id,
          purpose, context_family, decision_reason_code
        ) values (
          new.institution_id, new.student_id, question_id, new.id, link.canonical_skill_id,
          link.skill_role, is_correct, case when is_correct then 100 else 0 end,
          case when not is_correct and link.skill_role <> 'PRIMARY' then tag.confidence_weight else link.attribution_confidence end,
          case when not is_correct then tag.misconception_tag_id else null end,
          new.purpose, context,
          case when is_correct and link.skill_role = 'SUPPORTING' then 'SUPPORT_SKILL_POSITIVE_EVIDENCE' when not is_correct and link.skill_role = 'PRIMARY' then 'PRIMARY_SKILL_LOW_EVIDENCE' else 'MISCONCEPTION_REPEATED' end
        ) on conflict do nothing;
        if not is_correct then perform private.refresh_learning_misconception_signal_v3(new.institution_id, new.student_id, tag.canonical_skill_id, tag.misconception_tag_id); end if;
      end loop;
    end loop;
    if not has_tag then
      for link in
        select skill_link.canonical_skill_id, skill_link.skill_role, skill_link.attribution_confidence
          from public.learning_question_bank_skill_links skill_link
         where skill_link.question_bank_id = question_id
           and (skill_link.skill_role = 'PRIMARY' or (is_correct and skill_link.evidence_bearing))
      loop
        insert into public.learning_evidence_attributions(
          institution_id, student_id, question_bank_id, guided_attempt_id, canonical_skill_id,
          evidence_role, correct, score, attribution_confidence, purpose, context_family, decision_reason_code
        ) values (
          new.institution_id, new.student_id, question_id, new.id, link.canonical_skill_id,
          link.skill_role, is_correct, case when is_correct then 100 else 0 end,
          link.attribution_confidence, new.purpose, context,
          case when is_correct then 'PRIMARY_SKILL_EVIDENCE' else 'PRIMARY_SKILL_LOW_EVIDENCE' end
        ) on conflict do nothing;
      end loop;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists learning_guided_step_attempts_record_v3_attribution on public.learning_guided_step_attempts;
create trigger learning_guided_step_attempts_record_v3_attribution
after insert on public.learning_guided_step_attempts
for each row execute function private.record_learning_v3_attributions();

create or replace function private.learning_v3_can_view_student(target_institution_id uuid, target_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.students student where student.id = target_student_id and student.institution_id = target_institution_id and student.active and student.profile_id = auth.uid())
      or public.can_manage_institution_operations(target_institution_id)
      or exists (
        select 1 from public.enrollments enrollment
        join public.subject_offerings offering on offering.class_id = enrollment.class_id and offering.active
        join public.classes school_class on school_class.id = offering.class_id and school_class.institution_id = target_institution_id
        where enrollment.student_id = target_student_id and enrollment.active
          and offering.teacher_profile_id = auth.uid()
      );
$$;

create or replace function public.get_student_knowledge_graph_v3(p_institution_id uuid, p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.learning_v3_can_view_student(p_institution_id, p_student_id) then raise exception 'LEARNING_KNOWLEDGE_GRAPH_SCOPE_DENIED'; end if;
  return jsonb_build_object(
    'student_id', p_student_id,
    'skills', coalesce((select jsonb_agg(jsonb_build_object(
      'subject', subject.code, 'subject_name', subject.name, 'skill', skill.code,
      'skill_title', skill.title, 'state', coalesce(state.state, 'UNKNOWN'),
      'mastery', coalesce(state.mastery_estimate, 0), 'confidence', coalesce(state.confidence, 0),
      'evidence_count', coalesce(state.evidence_count, 0), 'strong_evidence_count', coalesce(state.strong_evidence_count, 0),
      'last_evidence_at', state.last_evidence_at,
      'confirmed_misconceptions', coalesce((select jsonb_agg(jsonb_build_object('code', tag.code, 'state', signal.state, 'confidence', signal.confidence)) from public.learning_misconception_signals signal join public.learning_misconception_tags tag on tag.id = signal.misconception_tag_id where signal.institution_id = p_institution_id and signal.student_id = p_student_id and signal.canonical_skill_id = skill.id and signal.state in ('CONFIRMED','RECOVERING')), '[]'::jsonb)
    ) order by subject.code, skill.code), '[]'::jsonb)
      from public.learning_curriculum_skills skill
      join public.learning_canonical_subjects subject on subject.id = skill.canonical_subject_id and subject.active
      left join public.learning_student_skill_state state on state.institution_id = p_institution_id and state.student_id = p_student_id and state.canonical_skill_id = skill.id
     where skill.active)
  );
end;
$$;

create or replace function public.get_teacher_student_knowledge_graph_v3(p_institution_id uuid, p_student_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select public.get_student_knowledge_graph_v3(p_institution_id, p_student_id);
$$;

create or replace function public.get_teacher_class_knowledge_heatmap_v3(p_institution_id uuid, p_class_id uuid)
returns table(subject_code text, skill_code text, mastered_count integer, practicing_count integer, needs_review_count integer, unknown_count integer)
language sql stable security definer set search_path = ''
as $$
  select subject.code, skill.code,
    count(*) filter (where state.state = 'MASTERED')::integer,
    count(*) filter (where state.state in ('INTRODUCED','PRACTICING'))::integer,
    count(*) filter (where state.state = 'NEEDS_REVIEW')::integer,
    count(*) filter (where state.state is null or state.state = 'UNKNOWN')::integer
  from public.enrollments enrollment
  join public.students student on student.id = enrollment.student_id and student.institution_id = p_institution_id and student.active
  cross join public.learning_curriculum_skills skill
  join public.learning_canonical_subjects subject on subject.id = skill.canonical_subject_id and subject.active
  left join public.learning_student_skill_state state on state.institution_id = p_institution_id and state.student_id = student.id and state.canonical_skill_id = skill.id
  where enrollment.class_id = p_class_id and enrollment.active
    and (public.can_manage_institution_operations(p_institution_id) or exists (select 1 from public.subject_offerings offering join public.classes school_class on school_class.id = offering.class_id and school_class.institution_id = p_institution_id where offering.class_id = p_class_id and offering.teacher_profile_id = auth.uid() and offering.active))
    and skill.active
  group by subject.code, skill.code
  order by subject.code, skill.code;
$$;

create or replace function public.get_adaptive_v3_plan(p_institution_id uuid, p_student_id uuid, p_target_canonical_skill_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare target_skill public.learning_curriculum_skills%rowtype; target_subject public.learning_canonical_subjects%rowtype; bridge record; current_subject text; current_skill text; decision text; reason text;
begin
  if not private.learning_v3_can_view_student(p_institution_id, p_student_id) then raise exception 'LEARNING_KNOWLEDGE_GRAPH_SCOPE_DENIED'; end if;
  select * into target_skill from public.learning_curriculum_skills where id = p_target_canonical_skill_id and active;
  if not found then raise exception 'LEARNING_TARGET_NOT_FOUND'; end if;
  select * into target_subject from public.learning_canonical_subjects where id = target_skill.canonical_subject_id;
  select relation.to_canonical_skill_id, bridge_skill.code, bridge_subject.code as subject_code into bridge
    from public.learning_skill_relationships relation
    join public.learning_curriculum_skills bridge_skill on bridge_skill.id = relation.to_canonical_skill_id
    join public.learning_canonical_subjects bridge_subject on bridge_subject.id = bridge_skill.canonical_subject_id
    join public.learning_misconception_signals signal on signal.institution_id = p_institution_id and signal.student_id = p_student_id and signal.canonical_skill_id = relation.to_canonical_skill_id and signal.state = 'CONFIRMED'
   where relation.from_canonical_skill_id = p_target_canonical_skill_id and relation.relation_type in ('PREREQUISITE','RELATED','TRANSFER')
   order by signal.confidence desc, bridge_skill.code
   limit 1;
  if bridge.code is not null then
    decision := 'CROSS_SUBJECT_BRIDGE'; reason := 'PREREQUISITE_CONFIRMED_GAP'; current_skill := bridge.code; current_subject := bridge.subject_code;
  else
    select state into current_skill from public.learning_student_skill_state where institution_id = p_institution_id and student_id = p_student_id and canonical_skill_id = p_target_canonical_skill_id;
    if current_skill is null then decision := 'DIAGNOSTIC_NEEDED'; reason := 'PRIMARY_SKILL_LOW_EVIDENCE'; else decision := 'RETURN_TO_ORIGINAL_TARGET'; reason := 'RETURN_TO_ORIGINAL_TARGET'; end if;
    current_skill := target_skill.code; current_subject := target_subject.code;
  end if;
  return jsonb_build_object('decision', decision, 'reason_code', reason, 'original_target_subject', target_subject.code, 'original_target_skill', target_skill.code, 'current_subject', current_subject, 'current_skill', current_skill);
end;
$$;

create or replace function public.replan_guided_learning_session_v3(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare session_row public.learning_guided_sessions%rowtype; plan jsonb;
begin
  select * into session_row from public.learning_guided_sessions where id = p_session_id for update;
  if not found or not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then raise exception 'LEARNING_SESSION_SCOPE_DENIED'; end if;
  plan := public.get_adaptive_v3_plan(session_row.institution_id, session_row.student_id, session_row.original_target_canonical_skill_id);
  update public.learning_guided_sessions set planner_version = 'V3', current_canonical_skill_id = (select id from public.learning_curriculum_skills where code = plan->>'current_skill' and active limit 1), current_canonical_subject_id = (select id from public.learning_canonical_subjects where code = plan->>'current_subject' and active limit 1), decision_reason = plan->>'reason_code', metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('adaptive_v3_plan', plan, 'original_target_preserved', true), updated_at = now() where id = p_session_id;
  return plan;
end;
$$;

update public.learning_guided_sessions session
   set original_target_canonical_subject_id = skill.canonical_subject_id,
       current_canonical_subject_id = skill.canonical_subject_id
  from public.learning_curriculum_skills skill
 where session.target_canonical_skill_id = skill.id
   and (session.original_target_canonical_subject_id is null or session.current_canonical_subject_id is null);

alter table public.learning_canonical_subjects enable row level security;
alter table public.learning_skill_relationships enable row level security;
alter table public.learning_question_option_misconceptions enable row level security;
alter table public.learning_evidence_attributions enable row level security;
alter table public.learning_misconception_signals enable row level security;

drop policy if exists learning_canonical_subjects_select on public.learning_canonical_subjects;
create policy learning_canonical_subjects_select on public.learning_canonical_subjects for select to authenticated using (active);
drop policy if exists learning_skill_relationships_select on public.learning_skill_relationships;
create policy learning_skill_relationships_select on public.learning_skill_relationships for select to authenticated using (true);
drop policy if exists learning_evidence_attributions_select on public.learning_evidence_attributions;
create policy learning_evidence_attributions_select on public.learning_evidence_attributions for select to authenticated using (private.learning_v3_can_view_student(institution_id, student_id));
drop policy if exists learning_misconception_signals_select on public.learning_misconception_signals;
create policy learning_misconception_signals_select on public.learning_misconception_signals for select to authenticated using (private.learning_v3_can_view_student(institution_id, student_id));

revoke all on table public.learning_question_option_misconceptions from anon, authenticated;
grant all on table public.learning_question_option_misconceptions to service_role;
grant select on table public.learning_canonical_subjects, public.learning_skill_relationships to authenticated;
grant select on table public.learning_evidence_attributions, public.learning_misconception_signals to authenticated;
grant all on table public.learning_canonical_subjects, public.learning_skill_relationships, public.learning_evidence_attributions, public.learning_misconception_signals to service_role;
grant execute on function public.validate_learning_question_set_v3(uuid), public.get_student_knowledge_graph_v3(uuid, uuid), public.get_teacher_student_knowledge_graph_v3(uuid, uuid), public.get_teacher_class_knowledge_heatmap_v3(uuid, uuid), public.get_adaptive_v3_plan(uuid, uuid, uuid), public.replan_guided_learning_session_v3(uuid) to authenticated;

revoke all on function private.learning_question_bank_v3_ready(uuid), private.validate_learning_question_set_item_v3(), private.refresh_learning_misconception_signal_v3(uuid, uuid, uuid, uuid), private.record_learning_v3_attributions(), private.learning_v3_can_view_student(uuid, uuid) from public, anon, authenticated;

commit;
