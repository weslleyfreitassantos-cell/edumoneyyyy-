begin;

-- Versioned, reproducible classification from the explicit Xequemat assunto-* taxonomy.
-- Free-text guessing is intentionally excluded from this production backfill.
create or replace function private.classify_enem_topic_v2(
  p_area text,
  p_language text,
  p_topic text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(coalesce(p_language, '')) = 'ENGLISH' then jsonb_build_object(
      'subject', 'INGLES', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'language:ENGLISH',
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when upper(coalesce(p_language, '')) = 'SPANISH' then jsonb_build_object(
      'subject', 'ESPANHOL', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'language:SPANISH',
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'MATEMATICA' then jsonb_build_object(
      'subject', 'MATEMATICA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'area:MATEMATICA',
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'LINGUAGENS' and lower(coalesce(p_topic, '')) ~ '^(argumentacao|artes-cenicas|artes-visuais|coesao|cronica|diversidade-linguistica|figuras-de-linguagem|funcoes-da-linguagem|genero|generos-textuais|gramatica|humor|interpretacao|intertextualidade|jornalismo|leitura|linguagem|literatura|morfologia|multimodalidade|musica|neologismo|oralidade|parnasianismo|poesia|pontuacao|pressupostos|publicidade|realismo|regionalismo|romantismo|semantica|sintaxe|tipologia|vanguardas|variacao-linguistica|vocabulario)(-|$)' then jsonb_build_object(
      'subject', 'LINGUA_PORTUGUESA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'assunto:' || lower(p_topic),
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'CIENCIAS_HUMANAS' and lower(coalesce(p_topic, '')) ~ '^(agricultura|biomas-e-vegetacao|cartografia|climatologia|conflitos-territoriais|demografia|desertificacao|escala|fontes-de-energia|formacao-do-territorio|fusos-horarios|geografia|geopolitica|globalizacao|hidrografia|industrializacao|matriz-energetica|migracoes|mobilidade-urbana|mudancas-climaticas|pedologia|questoes-ambientais|regionalizacao|relevo|segregacao-urbana|solo|territorio|urbanizacao)(-|$)' then jsonb_build_object(
      'subject', 'GEOGRAFIA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'assunto:' || lower(p_topic),
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'CIENCIAS_HUMANAS' and lower(coalesce(p_topic, '')) ~ '^(ceticismo|contratualismo|critic|epistem|existencialismo|filosofia|filosofico|iluminismo|kant|marxismo|metafisica|nietzsche|platao|racionalismo|razao|socrates|etica|moral|virtude)(-|$)' then jsonb_build_object(
      'subject', 'FILOSOFIA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'assunto:' || lower(p_topic),
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'CIENCIAS_HUMANAS' and lower(coalesce(p_topic, '')) ~ '^sociedade-colonial(-|$)' then jsonb_build_object(
      'subject', 'HISTORIA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'assunto:' || lower(p_topic),
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'CIENCIAS_HUMANAS' and lower(coalesce(p_topic, '')) ~ '^(antropologia|cidadania|classe-social|cultura|democracia|desigualdade|diversidade-sexual|educacao-fisica|escola-de-frankfurt|estratificacao|genero-e-sociedade|identidade|industria-cultural|meios-de-comunicacao|movimentos-sociais|patrimonio-cultural|poder-|racismo|social|sociabilidade|sociologia|sociedade|trabalho-e-sociedade)(-|$)' then jsonb_build_object(
      'subject', 'SOCIOLOGIA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'assunto:' || lower(p_topic),
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'CIENCIAS_HUMANAS' and lower(coalesce(p_topic, '')) ~ '^(absolutismo|africa|apartheid|antiguidade|brasil-|catolicismo|civilizacoes|colonizacao|comuna|cruzadas|desenvolvimentismo|ditadura|egito-antigo|era-|escravidao|expansao|formacao-historica|guerra|historia|imperialismo|independencia|idade-media|imperio|inquisicao|invasoes|mercantilismo|modernizacao|nazismo|operacao-condor|periodo-|povos-indigenas|reforma-protestante|renascimento|republica|revolucao|segunda-guerra|sociedade-colonial|voto-feminino)(-|$)' then jsonb_build_object(
      'subject', 'HISTORIA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'assunto:' || lower(p_topic),
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'CIENCIAS_NATUREZA' and lower(coalesce(p_topic, '')) ~ '^(biologia|biodiversidade|bioquimica|biotecnologia|botanica|cadeia-alimentar|citologia|ecologia|evolucao|fisiologia|genetica|microbiologia|taxonomia|zoologia)(-|$)' then jsonb_build_object(
      'subject', 'BIOLOGIA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'assunto:' || lower(p_topic),
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'CIENCIAS_NATUREZA' and lower(coalesce(p_topic, '')) ~ '^(acidos|atomo|bases|calculo-de-massa|carboidratos|combustao|cinetica-quimica|densidade-e-propriedades|eletroquimica|eletrolise|equilibrio|estequiometria|forcas-intermoleculares|identificacao-e-simbologia|ligacoes|leis-dos-gases|metalurgia|modelos-atomicos|molecula|oxirreducao|ph-e-|polaridade|polimeros|propriedades-coligativas|radioatividade|reacoes|separacao-de-misturas|solubilidade|solucoes|substancias|tabela-periodica|termoquimica)(-|$)' then jsonb_build_object(
      'subject', 'QUIMICA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'assunto:' || lower(p_topic),
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    when p_area = 'CIENCIAS_NATUREZA' and lower(coalesce(p_topic, '')) ~ '^(acustica|aceleracao|circuitos|cinematica|cosmologia|dilatacao|dinamica|efeito-doppler|efeito-fotoeletrico|efeito-joule|eletrostatica|eletromagnetismo|estatica|fisica|forca|gravitacao|hidrostatica|impulso|leis-de-newton|lentes-e-espelhos|maquinas-termicas|mecanica|movimento|ondas|optica|potencia|pressao|termologia|termodinamica|trabalho-e-energia|velocidade)(-|$)' then jsonb_build_object(
      'subject', 'FISICA', 'method', 'XEQUEMAT_TOPIC_TAXONOMY_V2',
      'confidence', 'HIGH', 'evidence', 'assunto:' || lower(p_topic),
      'review_state', 'VERIFIED', 'version', 'v2'
    )
    else null
  end;
$$;

-- structured-text-only-v6 was already provider-verified and complete. Promote
-- that validated revision in place so the current pool can use it without a
-- download, a new source, or a second question row. Rows with required media
-- are deliberately excluded from this recovery.
update public.learning_enem_structured_content structured
   set content_revision = private.current_enem_content_revision(),
       source_metadata = coalesce(structured.source_metadata, '{}'::jsonb) || jsonb_build_object(
         'previous_content_revision', 'structured-text-only-v6',
         'revision_promotion', 'ENEM_SUBJECT_CLASSIFICATION_BNCC_CONTENT_ACTIVATION_V2'
       ),
       updated_at = now()
 where structured.content_revision = 'structured-text-only-v6'
   and structured.source_kind = 'STRUCTURED_PROVIDER'
   and structured.content_acceptance_status = 'ACCEPTED'
   and structured.verification_status = 'VERIFIED'
   and structured.structured_content_integrity = 'VERIFIED'
   and structured.statement_complete
   and structured.five_alternatives_complete
   and structured.no_control_chars
   and structured.no_previous_question_contamination
   and structured.no_next_question_contamination
   and not structured.required_media_present
   and structured.language in ('ENGLISH', 'SPANISH');

update public.learning_question_bank question_bank
   set metadata = question_bank.metadata || jsonb_build_object(
     'content_revision', private.current_enem_content_revision(),
     'previous_content_revision', 'structured-text-only-v6',
     'revision_promotion', 'ENEM_SUBJECT_CLASSIFICATION_BNCC_CONTENT_ACTIVATION_V2'
   ),
       updated_at = now()
  from public.learning_enem_structured_content structured
 where structured.question_bank_id = question_bank.id
   and structured.content_revision = private.current_enem_content_revision()
   and structured.source_metadata->>'previous_content_revision' = 'structured-text-only-v6'
   and question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER';

-- Metadata-only backfill. It never rewrites statements, alternatives, answers,
-- media, source identity, attempts, or historical snapshots.
with candidates as (
  select question_bank.id,
         private.classify_enem_topic_v2(
           question_bank.subject_area,
           structured.language,
           question_bank.metadata->>'source_subject'
         ) as classification
    from public.learning_question_bank question_bank
    join lateral (
      select structured.language
        from public.learning_enem_structured_content structured
       where structured.question_bank_id = question_bank.id
       order by structured.updated_at desc nulls last
       limit 1
    ) structured on true
   where question_bank.package_type = 'ENEM'
     and question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'
     and coalesce(question_bank.metadata->>'enem_subject', '') = ''
)
update public.learning_question_bank question_bank
   set metadata = question_bank.metadata || jsonb_build_object(
     'enem_subject', candidates.classification->>'subject',
     'classification_method', candidates.classification->>'method',
     'classification_confidence', candidates.classification->>'confidence',
     'classification_evidence', candidates.classification->>'evidence',
     'classification_version', candidates.classification->>'version',
     'classification_review_state', candidates.classification->>'review_state'
   ),
       updated_at = now()
  from candidates
 where question_bank.id = candidates.id
   and candidates.classification is not null;

-- Global BNCC discovery is based on the student's active enrollment context,
-- not on an institution-created subject or offering. Institution links remain
-- available for the school-subject screen, but are not required here.
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
language sql
stable
security definer
set search_path = ''
as $$
  with enrollment_context as (
    select enrollment.student_id,
           enrollment.class_id,
           case
             when coalesce(class.grade_level, '') ~* '(ensino[[:space:]]*m.dio|(^|[^[:alpha:]])em([^[:alpha:]]|$))' then 'ENSINO_MEDIO'
             when upper(coalesce(class.grade_level, '')) like '%FUNDAMENTAL%' then 'ENSINO_FUNDAMENTAL'
             else null
           end as stage,
           nullif(regexp_replace(coalesce(class.grade_level, ''), '[^0-9]', '', 'g'), '')::smallint as parsed_grade
      from public.enrollments enrollment
      join public.classes class on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.active
     where enrollment.student_id = p_student_id
       and enrollment.active
       and enrollment.status = 'active'
  ), skills as (
    select skill.id,
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
           (select count(*)::integer
              from public.learning_skill_lessons lesson
             where lesson.canonical_skill_id = skill.id
               and lesson.version = 4
               and lesson.active) > 0 as has_lesson,
           (select count(*)::integer
              from public.learning_question_set_items item
              join public.learning_question_sets question_set
                on question_set.id = item.question_set_id
               and question_set.scope = 'GLOBAL'
               and question_set.version = 4
               and question_set.active
             where question_set.canonical_skill_id = skill.id) as question_count,
           state.mastery_estimate as progress,
           session.id as active_session_id,
           session.status as active_session_status
      from enrollment_context context
      join public.learning_curriculum_grade_targets target
        on target.stage = context.stage
       and target.grade_level = context.parsed_grade
       and target.active
      join public.learning_curriculum_skills skill
        on skill.id = target.canonical_skill_id
       and skill.active
       and skill.node_kind = 'LEAF'
       and skill.bncc_alignment_status = 'MAPPED'
      join public.learning_curriculum_catalogs catalog
        on catalog.id = skill.catalog_id
       and catalog.active
       and catalog.code = 'BNCC_2018'
      left join public.learning_student_skill_state state
        on state.institution_id = p_institution_id
       and state.student_id = p_student_id
       and state.canonical_skill_id = skill.id
      left join lateral (
        select guided.id, guided.status
          from public.learning_guided_sessions guided
         where guided.institution_id = p_institution_id
           and guided.student_id = p_student_id
           and guided.target_canonical_skill_id = skill.id
           and guided.status in ('ACTIVE', 'PAUSED')
         order by guided.updated_at desc
         limit 1
      ) session on true
     where context.stage is not null
       and context.parsed_grade is not null
  )
  select skills.id,
         skills.subject_id,
         skills.catalog_id,
         skills.catalog_code,
         skills.official_code,
         skills.title,
         skills.subject_area,
         skills.stage,
         skills.grade_level,
         case
           when skills.content_readiness <> 'ADAPTIVE_READY' then 'NO_LESSON'
           when not skills.has_lesson then 'NO_LESSON'
           when skills.question_count = 0 then 'NO_QUESTIONS'
           when skills.active_session_id is null then 'NO_ACTIVE_SESSION'
           else 'READY'
         end,
         coalesce(skills.progress, 0),
         skills.has_lesson,
         skills.question_count,
         skills.active_session_id,
         skills.active_session_status,
         case
           when skills.content_readiness <> 'ADAPTIVE_READY' or not skills.has_lesson then 'BNCC skill mapped, but the published lesson is not ready.'
           when skills.question_count = 0 then 'BNCC skill mapped, but no published exercises are available.'
           when skills.active_session_id is null then 'No active guided session.'
           else 'Guided session available.'
         end
    from skills
   where private.learning_v2_scope_student(p_institution_id, p_student_id)
   order by skills.subject_area, skills.grade_level, skills.title;
$$;

create or replace function private.assert_bncc_guided_session_scope(
  p_institution_id uuid,
  p_student_id uuid,
  p_target_canonical_skill_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_stage text;
  target_grade smallint;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id) then
    raise exception 'LEARNING_V4_TARGET_NOT_ELIGIBLE';
  end if;

  select grade.stage, grade.grade_level
    into target_stage, target_grade
    from public.learning_curriculum_skills skill
    join public.learning_curriculum_catalogs catalog
      on catalog.id = skill.catalog_id
     and catalog.code = 'BNCC_2018'
     and catalog.active
    join public.learning_curriculum_grade_targets grade
      on grade.canonical_skill_id = skill.id
     and grade.catalog_id = skill.catalog_id
     and grade.active
   where skill.id = p_target_canonical_skill_id
     and skill.active
     and skill.node_kind = 'LEAF'
     and skill.content_readiness = 'ADAPTIVE_READY'
     and skill.mastery_targetable
     and skill.bncc_alignment_status = 'MAPPED'
     and skill.metadata->>'official_code' is not null
   limit 1;

  if target_stage is null then
    raise exception 'LEARNING_V4_BNCC_MAPPING_REQUIRED';
  end if;

  if not exists (
    select 1
      from public.enrollments enrollment
      join public.classes class on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.active
     where enrollment.student_id = p_student_id
       and enrollment.active
       and enrollment.status = 'active'
       and case
             when coalesce(class.grade_level, '') ~* '(ensino[[:space:]]*m.dio|(^|[^[:alpha:]])em([^[:alpha:]]|$))' then 'ENSINO_MEDIO'
             when upper(coalesce(class.grade_level, '')) like '%FUNDAMENTAL%' then 'ENSINO_FUNDAMENTAL'
             else null
           end = target_stage
       and nullif(regexp_replace(coalesce(class.grade_level, ''), '[^0-9]', '', 'g'), '')::smallint = target_grade
  ) then
    raise exception 'LEARNING_V4_TARGET_NOT_ELIGIBLE';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
