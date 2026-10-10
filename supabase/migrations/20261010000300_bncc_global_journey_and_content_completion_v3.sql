begin;

-- Global BNCC discovery and session start must use the active enrollment
-- context.  Institutional subject links remain an explicit opt-in only for
-- the school-subject screen.
create or replace function private.normalize_learning_grade_context(p_grade_level text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with raw as (
    select lower(btrim(coalesce(p_grade_level, ''))) as value
  ), matched as (
    select value,
           regexp_match(
             value,
             '(^|[^[:alnum:]])(1|2|3)([ºª°])?[[:space:]]*(s[ée]rie|ano)?[[:space:]]*(do[[:space:]]*)?(ensino[[:space:]]*)?m[ée]dio([^[:alnum:]]|$)'
           ) as medium,
           regexp_match(
             value,
             '(^|[^[:alnum:]])(1|2|3)([ºª°])?[[:space:]]*(s[ée]rie|ano)?[[:space:]]*em([^[:alnum:]]|$)'
           ) as medium_short,
           regexp_match(
             value,
             '(^|[^[:alnum:]])(10|[1-9])([ºª°])?[[:space:]]*(ano|s[ée]rie)?[[:space:]]*(do[[:space:]]*)?(ensino[[:space:]]*)?fundamental([^[:alnum:]]|$)'
           ) as fundamental,
           regexp_match(
             value,
             '(^|[^[:alnum:]])(10|[1-9])([ºª°])?[[:space:]]*(ano|s[ée]rie)?[[:space:]]*ef([^[:alnum:]]|$)'
           ) as fundamental_short
      from raw
  )
  select case
    when medium is not null then jsonb_build_object('stage', 'ENSINO_MEDIO', 'grade_level', (medium[2])::smallint)
    when medium_short is not null then jsonb_build_object('stage', 'ENSINO_MEDIO', 'grade_level', (medium_short[2])::smallint)
    when fundamental is not null then jsonb_build_object('stage', 'ENSINO_FUNDAMENTAL', 'grade_level', (fundamental[2])::smallint)
    when fundamental_short is not null then jsonb_build_object('stage', 'ENSINO_FUNDAMENTAL', 'grade_level', (fundamental_short[2])::smallint)
    else '{}'::jsonb
  end
    from matched;
$$;

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
    select
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
      (select count(*)::integer
         from public.learning_question_set_items item
         join public.learning_question_sets question_set on question_set.id = item.question_set_id
          and question_set.scope = 'GLOBAL'
          and question_set.version = 4
          and question_set.active
        where question_set.canonical_skill_id = skill.id) as question_count,
      state.mastery_estimate as progress,
      session.id as active_session_id,
      session.status as active_session_status
    from enrollment_context context
    join public.learning_curriculum_grade_targets target on target.stage = context.stage
      and target.grade_level = context.parsed_grade
      and target.active
    join public.learning_curriculum_skills skill on skill.id = target.canonical_skill_id
      and skill.active
      and skill.node_kind = 'LEAF'
      and skill.bncc_alignment_status = 'MAPPED'
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
      and catalog.active
      and catalog.code = 'BNCC_2018'
    left join public.learning_student_skill_state state on state.institution_id = p_institution_id
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
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
      and catalog.code = 'BNCC_2018'
      and catalog.active
    join public.learning_curriculum_grade_targets grade on grade.canonical_skill_id = skill.id
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
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where enrollment.student_id = p_student_id
       and enrollment.active
       and enrollment.status = 'active'
       and normalized.value->>'stage' = target_stage
       and nullif(normalized.value->>'grade_level', '')::smallint = target_grade
  ) then
    raise exception 'LEARNING_V4_TARGET_NOT_ELIGIBLE';
  end if;
end;
$$;

-- EF06HI01 is mapped to a real, reviewed content package already present in
-- the repository. Promote that package explicitly instead of treating a
-- mapped code without lesson/exercises as ready.
do $$
declare
  target_id uuid;
  set_id uuid;
  question_id uuid;
  question_row record;
begin
  select skill.id into target_id
    from public.learning_curriculum_skills skill
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
   where catalog.code = 'BNCC_2018'
     and catalog.active
     and skill.code = 'EF06HI01';

  if target_id is null then
    raise exception 'BNCC_EF06HI01_NOT_FOUND';
  end if;

  update public.learning_curriculum_skills
     set content_readiness = 'ADAPTIVE_READY',
         mastery_targetable = true,
         pedagogical_review_status = 'TECH_VALIDATED',
         updated_at = now(),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'content_promotion', 'TECESCOLA_CORE_V4_HISTORY_PERIODIZATION',
           'content_promotion_status', 'VALIDATED_PACKAGE_PROMOTED',
           'official_code', 'EF06HI01'
         )
   where id = target_id;

  insert into public.learning_skill_lessons(
    canonical_skill_id, version, title, summary, content_markdown,
    worked_example, tips, estimated_minutes, active, metadata
  ) values (
    target_id,
    4,
    'Ler periodizações históricas',
    'A periodização organiza o tempo para destacar processos, sem transformar mudanças em fronteiras absolutas.',
    '## Como ler uma periodização\n\nUma periodização é um recorte construído para investigar mudanças e continuidades. O marco ajuda a organizar a pergunta, mas não faz toda a sociedade mudar no mesmo instante.\n\nAo estudar um período, identifique o critério do recorte, procure continuidades antes e depois do marco e confronte a interpretação com as evidências disponíveis.',
    'Uma mudança de governo pode marcar um período político, embora práticas sociais e econômicas continuem por mais tempo. O marco organiza a análise; ele não encerra todos os processos anteriores.',
    array['Nomeie o critério do recorte.', 'Procure continuidades antes e depois.', 'Relacione marco e processo histórico.']::text[],
    8,
    true,
    jsonb_build_object('official_bncc_code', 'EF06HI01', 'content_authoring_status', 'TECH_VALIDATED', 'content_pack', 'tec-escola-core-v4')
  ) on conflict (canonical_skill_id, version) do update set
    title = excluded.title,
    summary = excluded.summary,
    content_markdown = excluded.content_markdown,
    worked_example = excluded.worked_example,
    tips = excluded.tips,
    estimated_minutes = excluded.estimated_minutes,
    active = true,
    metadata = excluded.metadata,
    updated_at = now();

  for question_row in
    select * from jsonb_to_recordset($json$
      [
        {"id":"v4-history-periodization-probe-01","purpose":"PROBE","difficulty":"EASY","cognitive_process":"IDENTIFY","context_family":"MARCO_HISTORICO","statement":"Uma periodização histórica é, principalmente:","options":["Um recorte criado para organizar a análise de processos no tempo.","Uma regra que obriga todas as sociedades a mudar na mesma data.","Uma lista que elimina acontecimentos fora do período escolhido.","Uma prova de que o passado possui limites naturais e imutáveis."],"correct":"Um recorte criado para organizar a análise de processos no tempo.","explanation":"Periodizar é escolher recortes para analisar processos; o critério depende da pergunta histórica."},
        {"id":"v4-history-periodization-probe-02","purpose":"PROBE","difficulty":"EASY","cognitive_process":"RECOGNIZE","context_family":"CRITERIO_DE_RECORTE","statement":"Ao estudar a história da tecnologia, um pesquisador pode escolher períodos com base em:","options":["Perguntas e critérios relacionados ao processo estudado.","Uma divisão que serve igualmente para qualquer pesquisa.","A ideia de que cada período tem uma única causa.","Datas decoradas sem relação com o objeto de estudo."],"correct":"Perguntas e critérios relacionados ao processo estudado.","explanation":"O recorte deve ajudar a responder à pergunta e tornar visíveis mudanças e continuidades relevantes."},
        {"id":"v4-history-periodization-practice-01","purpose":"PRACTICE","difficulty":"MEDIUM","cognitive_process":"COMPARE","context_family":"MUDANCA_E_CONTINUIDADE","statement":"Uma mudança de governo marca o início de um período político. Qual leitura é mais adequada?","options":["O marco ajuda a organizar a análise, mas práticas sociais podem continuar.","Todas as relações sociais mudam exatamente no dia do marco.","O marco torna desnecessária a consulta a outras fontes.","A periodização prova que não houve continuidade."],"correct":"O marco ajuda a organizar a análise, mas práticas sociais podem continuar.","explanation":"Mudanças políticas podem ter ritmos diferentes de mudanças sociais e econômicas."},
        {"id":"v4-history-periodization-transfer-01","purpose":"TRANSFER","difficulty":"MEDIUM","cognitive_process":"ANALYZE","context_family":"HISTORIA_LOCAL","statement":"Para estudar a expansão de uma cidade, qual uso da periodização favorece uma análise histórica?","options":["Comparar recortes que mostrem o que mudou e o que permaneceu.","Escolher uma data e ignorar os anos anteriores.","Tratar o crescimento como igual em todos os bairros.","Substituir mapas e relatos por uma única divisão temporal."],"correct":"Comparar recortes que mostrem o que mudou e o que permaneceu.","explanation":"Recortes sucessivos ajudam a comparar ritmos de transformação sem apagar continuidades."},
        {"id":"v4-history-periodization-lock-in-01","purpose":"LOCK_IN","difficulty":"HARD","cognitive_process":"EVALUATE","context_family":"CRITICA_DE_RECORTE","statement":"Um livro divide a história de uma região em três períodos. Para avaliar esse recorte, é preciso perguntar:","options":["Qual critério foi usado e quais continuidades o recorte pode esconder.","Se os períodos têm a mesma quantidade de anos.","Se toda fonte que discorda deve ser descartada.","Se a divisão elimina as experiências de grupos diferentes."],"correct":"Qual critério foi usado e quais continuidades o recorte pode esconder.","explanation":"Um recorte é uma ferramenta interpretativa e deve ser confrontado com suas escolhas e limites."},
        {"id":"v4-history-periodization-review-01","purpose":"REVIEW","difficulty":"HARD","cognitive_process":"EXPLAIN","context_family":"INTERPRETACAO_HISTORICA","statement":"Por que duas pesquisas podem propor periodizações diferentes para o mesmo processo?","options":["Porque perguntas e critérios diferentes destacam mudanças e continuidades distintas.","Porque apenas uma pesquisa pode usar evidências.","Porque datas históricas não podem ser verificadas.","Porque toda periodização é apenas uma opinião sem critério."],"correct":"Porque perguntas e critérios diferentes destacam mudanças e continuidades distintas.","explanation":"Periodizações dependem do problema investigado, mas continuam limitadas pelas evidências."},
        {"id":"v4-history-periodization-review-02","purpose":"REVIEW","difficulty":"HARD","cognitive_process":"ANALYZE","context_family":"EVIDENCIA_E_RECORTE","statement":"Ao comparar dois períodos, o estudante encontra uma prática que permanece nos dois. O que isso indica?","options":["Que a periodização deve ser analisada junto com evidências de continuidade.","Que os dois períodos são necessariamente idênticos.","Que a mudança estudada não aconteceu em nenhum aspecto.","Que a prática deve ser retirada dos registros históricos."],"correct":"Que a periodização deve ser analisada junto com evidências de continuidade.","explanation":"Um marco pode destacar uma transformação sem apagar práticas que atravessam a divisão."}
      ]
    $json$::jsonb) as row(id text, purpose text, difficulty text, cognitive_process text, context_family text, statement text, options jsonb, correct text, explanation text)
  loop
    select question_bank.id into question_id
      from public.learning_question_bank question_bank
     where question_bank.source_type = 'TECESCOLA_CORE_V4'
       and question_bank.metadata->>'content_id' = question_row.id
     limit 1;

    if question_id is null then
      insert into public.learning_question_bank(
        package_type, source_type, source_name, subject_area, domain, topic,
        statement, options, correct_answer, explanation, difficulty,
        cognitive_process, context_family, knowledge_mapping_status, knowledge_mapping_version,
        estimated_minutes, provenance, metadata, active
      ) values (
        'TECESCOLA', 'TECESCOLA_CORE_V4', 'TecEscola Core V4', 'HISTORY',
        'TEMPO_HISTORICO', 'periodizacao', question_row.statement,
        question_row.options, to_jsonb(question_row.correct), question_row.explanation,
        question_row.difficulty, question_row.cognitive_process, question_row.context_family,
        'READY', 'V3', 4, 'TECESCOLA_CORE_V4_AUTHORED',
        jsonb_build_object(
          'content_id', question_row.id,
          'purpose', question_row.purpose,
          'context_family', question_row.context_family,
          'cognitive_process', question_row.cognitive_process,
          'primary_skill', 'HISTORY_INTERPRET_PERIODIZATION',
          'official_bncc_code', 'EF06HI01',
          'content_authoring_status', 'TECH_VALIDATED',
          'pack_version', 'tec-escola-core-v4'
        ), true
      ) returning id into question_id;
    end if;

    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
    values (question_id, target_id, 'PRIMARY')
    on conflict (question_bank_id, canonical_skill_id) do nothing;

    insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, difficulty, metadata)
    values ('GLOBAL', target_id, question_row.purpose, 4, question_row.difficulty, jsonb_build_object('official_bncc_code', 'EF06HI01', 'content_pack', 'tec-escola-core-v4'))
    on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL'
    do update set difficulty = excluded.difficulty, metadata = excluded.metadata, active = true
    returning id into set_id;

    if set_id is null then
      select question_set.id into set_id
        from public.learning_question_sets question_set
       where question_set.scope = 'GLOBAL'
         and question_set.canonical_skill_id = target_id
         and question_set.purpose = question_row.purpose
         and question_set.version = 4;
    end if;

    insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
    values (set_id, question_id, (select coalesce(max(item.position), -1) + 1 from public.learning_question_set_items item where item.question_set_id = set_id))
    on conflict do nothing;
  end loop;
end;
$$;

revoke all on function private.normalize_learning_grade_context(text) from public, anon, authenticated;
grant execute on function public.list_student_guided_learning_targets(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
