begin;

-- Compute every template's ready-pool count once. Without this materialized
-- CTE, PostgreSQL can inline the counts expression at each output reference;
-- the English multimodal pool then repeats its full eligibility scan and hits
-- PostgREST's statement timeout.
create or replace function public.list_enem_simulation_templates_v2(p_institution_id uuid)
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
  ), counts as materialized (
    select template.*,
      case
        when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS' then
          case when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, null)) >= 40
                    and ((select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5
                      or (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5)
               then 45 else 0 end
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'INGLES' then
          (select count(*)::integer from private.enem_ready_english_practice_questions_v1())
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'ESPANHOL' then
          (select count(*)::integer from private.enem_ready_provider_text_questions(null, 'ESPANHOL', 'SPANISH'))
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
  select counts.id,
         counts.title,
         counts.simulation_type,
         counts.area,
         counts.metadata->>'enem_subject',
         counts.metadata->>'enem_subject',
         case
           when counts.metadata->>'enem_mode' = 'SUBJECT'
            and counts.metadata->>'enem_subject' = 'INGLES'
            and counts.pool_count > 0
             then least(counts.question_count, counts.pool_count)
           else counts.question_count
         end::integer,
         counts.duration_minutes,
         counts.pool_count,
         counts.pool_count,
         case
           when counts.metadata->>'enem_mode' = 'SUBJECT'
            and counts.metadata->>'enem_subject' = 'INGLES'
            and counts.pool_count > 0 then 'AVAILABLE'
           when counts.pool_count >= counts.question_count then 'AVAILABLE'
           else 'INSUFFICIENT'
         end,
         counts.available_languages,
         case
           when counts.metadata->>'enem_mode' = 'SUBJECT'
            and counts.metadata->>'enem_subject' = 'INGLES'
             then counts.metadata || jsonb_build_object(
               'planned_question_count', counts.question_count,
               'reduced_practice', counts.pool_count > 0 and counts.pool_count < counts.question_count
             )
           else counts.metadata
         end
    from counts
   where (counts.metadata->>'enem_mode' = 'SUBJECT'
          and counts.metadata->>'enem_subject' = 'INGLES')
      or counts.pool_count >= counts.question_count
   order by case when counts.metadata->>'enem_mode' = 'AREA' then 0 else 1 end, counts.title;
$$;

revoke all on function public.list_enem_simulation_templates_v2(uuid) from public, anon;
grant execute on function public.list_enem_simulation_templates_v2(uuid) to authenticated;

commit;
