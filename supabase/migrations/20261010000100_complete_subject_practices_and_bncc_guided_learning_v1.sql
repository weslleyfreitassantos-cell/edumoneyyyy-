begin;

-- Keep the ENEM provider pool strict, but use the subject classification that
-- the importer actually stores. Media-backed questions are eligible only when
-- their required media was validated; missing media never enters a pool.
create or replace function private.enem_ready_provider_text_questions(
  p_area text default null,
  p_subject text default null,
  p_language text default null
)
returns table(
  question_id uuid,
  occurrence_id uuid,
  structured_content_id uuid,
  language text,
  source_kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    question_bank.id,
    null::uuid,
    structured.id,
    structured.language,
    structured.source_kind
  from public.learning_enem_structured_content structured
  join public.learning_question_bank question_bank
    on question_bank.id = structured.question_bank_id
  where question_bank.active
    and question_bank.package_type = 'ENEM'
    and question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'
    and structured.source_kind = 'STRUCTURED_PROVIDER'
    and structured.content_acceptance_status = 'ACCEPTED'
    and structured.verification_status = 'VERIFIED'
    and structured.content_revision = private.current_enem_content_revision()
    and structured.question_bank_id is not null
    and structured.occurrence_id is null
    and structured.render_mode in ('STRUCTURED_TEXT', 'STRUCTURED_TEXT_WITH_MEDIA')
    and structured.structured_content_integrity = 'VERIFIED'
    and structured.statement_complete
    and private.enem_provider_statement_complete_v4(structured.context_text, structured.prompt_text)
    and structured.five_alternatives_complete
    and structured.no_control_chars
    and structured.no_previous_question_contamination
    and structured.no_next_question_contamination
     and (not structured.required_media_present or structured.required_media_validated)
    and structured.provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
    and jsonb_typeof(structured.alternatives_json) = 'array'
    and jsonb_array_length(structured.alternatives_json) = 5
    and not exists (
      select 1
      from jsonb_array_elements(structured.alternatives_json) option_item
      where jsonb_typeof(option_item) <> 'object'
        or btrim(option_item->>'text') = ''
        or option_item ? 'file'
        or option_item->>'text' ~ '[[:cntrl:]]'
    )
    and (
      p_area is null
      or question_bank.subject_area = p_area
      or case structured.discipline
           when 'linguagens' then 'LINGUAGENS'
           when 'ciencias-humanas' then 'CIENCIAS_HUMANAS'
           when 'ciencias-natureza' then 'CIENCIAS_NATUREZA'
           when 'matematica' then 'MATEMATICA'
           else null
         end = p_area
    )
    and (
      p_subject is null
      or upper(coalesce(question_bank.metadata->>'enem_subject', '')) = upper(p_subject)
      or question_bank.subject_area = p_subject
    )
    and (
      (p_language is null and structured.language is null)
      or (p_language is not null and structured.language = upper(p_language))
    )
  order by random();
$$;

revoke all on function private.enem_ready_provider_text_questions(text, text, text) from public, anon, authenticated;
grant execute on function private.enem_ready_provider_text_questions(text, text, text) to service_role;

drop function if exists public.list_enem_simulation_templates_v2(uuid);
create function public.list_enem_simulation_templates_v2(p_institution_id uuid)
returns table(
  id uuid,
  title text,
  simulation_type text,
  area text,
  subject text,
  subject_code text,
  question_count integer,
  duration_minutes integer,
  available_count integer,
  ready_count integer,
  availability_status text,
  language_options jsonb,
  metadata jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with templates as (
    select simulation.id, simulation.title, simulation.simulation_type, simulation.area,
           simulation.question_count, simulation.duration_minutes, simulation.metadata
    from public.learning_simulations simulation
    where simulation.status = 'PUBLISHED'
      and simulation.metadata->>'dynamic_pool' = 'true'
      and (simulation.institution_id is null or simulation.institution_id = p_institution_id)
  ), counted as (
    select template.*,
      case
        when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS' then
          case when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, null)) >= 40
                    and ((select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5
                      or (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5)
               then 45 else (select count(*)::integer from private.enem_ready_provider_text_questions(template.area, null, null)) end
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'INGLES' then
          (select count(*)::integer from private.enem_ready_provider_text_questions(null, template.metadata->>'enem_subject', 'ENGLISH'))
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'ESPANHOL' then
          (select count(*)::integer from private.enem_ready_provider_text_questions(null, template.metadata->>'enem_subject', 'SPANISH'))
        else (select count(*)::integer from private.enem_ready_provider_text_questions(template.area, template.metadata->>'enem_subject', null))
      end as pool_count,
      case
        when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS' then
          case
            when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5
             and (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5 then '["ENGLISH", "SPANISH"]'::jsonb
            when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5 then '["ENGLISH"]'::jsonb
            when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5 then '["SPANISH"]'::jsonb
            else '[]'::jsonb
          end
        else '[]'::jsonb
      end as available_languages
    from templates template
  )
  select counted.id,
         counted.title,
         counted.simulation_type,
         counted.area,
         counted.metadata->>'enem_subject',
         counted.metadata->>'enem_subject',
         counted.question_count,
         counted.duration_minutes,
         counted.pool_count,
         counted.pool_count,
         case when counted.pool_count >= counted.question_count then 'AVAILABLE' else 'INSUFFICIENT' end,
         counted.available_languages,
         counted.metadata
    from counted
   order by case when counted.metadata->>'enem_mode' = 'AREA' then 0 else 1 end, counted.title;
$$;

revoke all on function public.list_enem_simulation_templates_v2(uuid) from public, anon;
grant execute on function public.list_enem_simulation_templates_v2(uuid) to authenticated;

-- The only BNCC promotions currently cleared by the repository's independent
-- validator are EF06HI01 and EF09CI01.  Keep the official source identity in
-- a separate catalog; the TecEscola-derived catalog remains non-BNCC.
do $$
declare
  bncc_catalog_id uuid;
  source_skill public.learning_curriculum_skills%rowtype;
  target_skill_id uuid;
  lesson_row record;
  question_set_row record;
begin
  insert into public.learning_curriculum_catalogs(code, name, version, description, active, metadata)
  values (
    'BNCC_2018',
    'Base Nacional Comum Curricular 2018',
    '1.0',
    'Catálogo oficial congelado com promoções técnicas explicitamente mapeadas.',
    true,
    jsonb_build_object(
      'official_source', 'BNCC_EI_EF_2018',
      'official_source_url', 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
      'catalog_hash', 'b0da60b72e055d8bbafe2366651f1ccc6676d92e83a65f9bf3e062c5026e3989',
      'promotion_policy', 'STRICT_TECHNICAL_ALLOWLIST',
      'pedagogical_review_status', 'PENDING'
    )
  )
  on conflict (code, version) do update set active = true, metadata = excluded.metadata
  returning id into bncc_catalog_id;

  if bncc_catalog_id is null then
    select id into bncc_catalog_id from public.learning_curriculum_catalogs where code = 'BNCC_2018' and version = '1.0';
  end if;

  for source_skill in
    select source_row.*
    from public.learning_curriculum_skills source_row
    join public.learning_curriculum_catalogs source_catalog on source_catalog.id = source_row.catalog_id
    where source_catalog.code = 'TECESCOLA_CORE'
      and source_catalog.version = '1.0'
      and source_row.code in ('HISTORY_INTERPRET_PERIODIZATION', 'SCIENCE_EXPLAIN_MATTER_TRANSFORMATION')
  loop
    insert into public.learning_curriculum_skills(
      catalog_id, code, stage, grade_level, subject_area, domain, title, description,
      active, node_kind, content_readiness, mastery_targetable, pedagogical_review_status,
      bncc_alignment_status, metadata
    )
    values (
      bncc_catalog_id,
      case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 'EF06HI01' else 'EF09CI01' end,
      'ENSINO_FUNDAMENTAL',
      case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 6 else 9 end,
      case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 'HISTORY' else 'SCIENCE' end,
      source_skill.domain,
      source_skill.title,
      source_skill.description,
      true,
      source_skill.node_kind,
      source_skill.content_readiness,
      source_skill.mastery_targetable,
      source_skill.pedagogical_review_status,
      'MAPPED',
      jsonb_build_object(
        'official_code', case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 'EF06HI01' else 'EF09CI01' end,
        'official_source_id', 'BNCC_EI_EF_2018',
        'official_source_url', 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
        'official_source_page', case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 423 else 353 end,
        'mapping_status', 'MAPPED',
        'promotion_status', 'AUTOMATED_SAFE_PROMOTION',
        'pedagogical_review_status', 'PENDING',
        'source_canonical_skill_code', source_skill.code
      )
    )
    on conflict (catalog_id, code) do update set
      title = excluded.title,
      description = excluded.description,
      active = true,
      node_kind = excluded.node_kind,
      content_readiness = excluded.content_readiness,
      mastery_targetable = excluded.mastery_targetable,
      pedagogical_review_status = excluded.pedagogical_review_status,
      bncc_alignment_status = 'MAPPED',
      metadata = excluded.metadata
    returning id into target_skill_id;

    if target_skill_id is null then
      select id into target_skill_id from public.learning_curriculum_skills where catalog_id = bncc_catalog_id and code = case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 'EF06HI01' else 'EF09CI01' end;
    end if;

    for lesson_row in
      select title, summary, content_markdown, worked_example, tips, estimated_minutes, active, metadata
      from public.learning_skill_lessons
      where canonical_skill_id = source_skill.id and version = 4
    loop
      insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, active, metadata)
      values (target_skill_id, 4, lesson_row.title, lesson_row.summary, lesson_row.content_markdown, lesson_row.worked_example, lesson_row.tips, lesson_row.estimated_minutes, lesson_row.active, lesson_row.metadata || jsonb_build_object('official_bncc_code', case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 'EF06HI01' else 'EF09CI01' end))
      on conflict (canonical_skill_id, version) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes, active = excluded.active, metadata = excluded.metadata;
    end loop;

    for question_set_row in
      select id, purpose, version, difficulty, metadata
      from public.learning_question_sets
      where canonical_skill_id = source_skill.id and scope = 'GLOBAL' and version = 4 and active
    loop
      insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, difficulty, metadata)
      values ('GLOBAL', target_skill_id, question_set_row.purpose, question_set_row.version, question_set_row.difficulty, question_set_row.metadata || jsonb_build_object('official_bncc_code', case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 'EF06HI01' else 'EF09CI01' end))
      on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL' do update set difficulty = excluded.difficulty, metadata = excluded.metadata, active = true;

      insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
      select target_set.id, item.question_bank_id, item.position
      from public.learning_question_set_items item
      join public.learning_question_sets source_set on source_set.id = item.question_set_id
      join public.learning_question_sets target_set on target_set.canonical_skill_id = target_skill_id and target_set.scope = 'GLOBAL' and target_set.purpose = question_set_row.purpose and target_set.version = question_set_row.version
      where source_set.id = question_set_row.id
      on conflict (question_set_id, position) do nothing;
    end loop;

    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
    select link.question_bank_id, target_skill_id, link.skill_role
    from public.learning_question_bank_skill_links link
    where link.canonical_skill_id = source_skill.id
    on conflict (question_bank_id, canonical_skill_id) do nothing;

    insert into public.learning_curriculum_grade_targets(catalog_id, stage, grade_level, subject_area, canonical_skill_id, priority, sort_order, active)
    values (bncc_catalog_id, 'ENSINO_FUNDAMENTAL', case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 6 else 9 end, case when source_skill.code = 'HISTORY_INTERPRET_PERIODIZATION' then 'HISTORY' else 'SCIENCE' end, target_skill_id, 0, 0, true)
    on conflict (catalog_id, stage, grade_level, subject_area, canonical_skill_id) do update set active = true;
  end loop;
end;
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
      class.grade_level,
      case
        when coalesce(class.grade_level, '') ~* 'm.dio'
          or coalesce(class.grade_level, '') ~* '(^|[^[:alpha:]])em([^[:alpha:]]|$)'
          then 'ENSINO_MEDIO'
        when upper(coalesce(class.grade_level, '')) like '%FUNDAMENTAL%'
          then 'ENSINO_FUNDAMENTAL'
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
    order by enrollment.student_id, enrollment.class_id, enrollment.updated_at desc
  ), eligible_context as (
    select distinct context.student_id, context.class_id, context.stage, context.parsed_grade, offering.subject_id, subject_link.subject_area
    from enrollment_context context
    join public.subject_offerings offering on offering.class_id = context.class_id and offering.active
    join public.learning_curriculum_subject_links subject_link
      on subject_link.institution_id = p_institution_id
     and subject_link.subject_id = offering.subject_id
     and subject_link.active
  ), skills as (
    select
      skill.id,
      link.subject_id,
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
    from eligible_context link
    join public.learning_curriculum_grade_targets target on target.subject_area = link.subject_area and target.stage = link.stage and target.grade_level = link.parsed_grade and target.active
    join public.learning_curriculum_skills skill on skill.id = target.canonical_skill_id and skill.active and skill.node_kind = 'LEAF'
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id and catalog.active and catalog.code = 'BNCC_2018'
    left join public.learning_student_skill_state state on state.institution_id = p_institution_id and state.student_id = p_student_id and state.canonical_skill_id = skill.id
    left join lateral (
      select guided.id, guided.status
      from public.learning_guided_sessions guided
      where guided.institution_id = p_institution_id and guided.student_id = p_student_id and guided.target_canonical_skill_id = skill.id and guided.status in ('ACTIVE', 'PAUSED')
      order by guided.updated_at desc
      limit 1
    ) session on true
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

revoke all on function public.list_student_guided_learning_targets(uuid, uuid) from public, anon;
grant execute on function public.list_student_guided_learning_targets(uuid, uuid) to authenticated;

-- BNCC sessions use a guarded entry point while historical V4 adaptive
-- sessions keep their existing compatibility contract. This prevents a
-- custom subject from reaching the BNCC discovery path without breaking
-- already-supported V4 journeys such as the adaptive physics proof.
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
  target_subject_area text;
  target_stage text;
  target_grade smallint;
begin
  select skill.subject_area, grade.stage, grade.grade_level
    into target_subject_area, target_stage, target_grade
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

  if target_subject_area is null then
    raise exception 'LEARNING_V4_BNCC_MAPPING_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.enrollments enrollment
    join public.classes class on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
      and class.active
    join public.subject_offerings offering on offering.class_id = class.id and offering.active
    join public.learning_curriculum_subject_links subject_link
     on subject_link.institution_id = p_institution_id
     and subject_link.subject_id = offering.subject_id
     and subject_link.subject_area = target_subject_area
     and subject_link.active
     where enrollment.student_id = p_student_id
      and enrollment.active
      and enrollment.status = 'active'
      and case
      when coalesce(class.grade_level, '') ~* 'm.dio'
        or coalesce(class.grade_level, '') ~* '(^|[^[:alpha:]])em([^[:alpha:]]|$)'
          then 'ENSINO_MEDIO'
        when upper(coalesce(class.grade_level, '')) like '%FUNDAMENTAL%'
          then 'ENSINO_FUNDAMENTAL'
        else null
      end = target_stage
      and nullif(regexp_replace(coalesce(class.grade_level, ''), '[^0-9]', '', 'g'), '')::smallint = target_grade
  ) then
    raise exception 'LEARNING_V4_TARGET_NOT_ELIGIBLE';
  end if;

end;
$$;

create or replace function public.start_bncc_guided_learning_session_v4(
  p_institution_id uuid,
  p_student_id uuid,
  p_target_canonical_skill_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_bncc_guided_session_scope(p_institution_id, p_student_id, p_target_canonical_skill_id);
  return public.start_guided_learning_session_v4(p_institution_id, p_student_id, p_target_canonical_skill_id);
end;
$$;

revoke all on function private.assert_bncc_guided_session_scope(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_bncc_guided_learning_session_v4(uuid, uuid, uuid) from public, anon;
grant execute on function public.start_bncc_guided_learning_session_v4(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
