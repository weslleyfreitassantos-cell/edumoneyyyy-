-- ENEM V2: the official PDF remains the visual source of truth for the
-- statement and every A-E alternative. This migration is forward-only and
-- does not rewrite historical assets or attempts.

create or replace function private.enem_ready_question_ids(
  p_area text default null,
  p_subject text default null,
  p_language text default null
)
returns table(question_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct question_bank.id
  from public.learning_question_bank question_bank
  join public.learning_enem_official_occurrences occurrence
    on occurrence.question_bank_id = question_bank.id
  join public.learning_enem_media_assets statement_asset
    on statement_asset.occurrence_id = occurrence.id
   and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
   and statement_asset.quality_state = 'VALIDATED'
   and (statement_asset.storage_path is not null or statement_asset.metadata ? 'public_url')
  where question_bank.active
    and question_bank.package_type = 'ENEM'
    and question_bank.source_type = 'ENEM_OFFICIAL'
    and question_bank.metadata->>'source_integrity' = 'VERIFIED'
    and question_bank.metadata->>'statement_integrity' = 'VERIFIED'
    and question_bank.metadata->>'options_integrity' = 'VERIFIED'
    and question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'
    and question_bank.metadata->>'render_ready' = 'true'
    and question_bank.metadata->>'area_verified' = 'true'
    and (p_subject is null or question_bank.metadata->>'subject_verified' = 'true')
    and jsonb_typeof(question_bank.options) = 'array'
    and jsonb_array_length(question_bank.options) = 5
    and question_bank.correct_answer is not null
    and question_bank.metadata->>'official_answer_letter' in ('A', 'B', 'C', 'D', 'E')
    and (p_area is null or question_bank.metadata->>'enem_area' = p_area)
    and (p_subject is null or question_bank.metadata->>'enem_subject' = p_subject)
    and occurrence.language is not distinct from p_language
    and (
      select count(distinct option_asset.metadata->>'option_label')
      from public.learning_enem_media_assets option_asset
      where option_asset.occurrence_id = occurrence.id
        and option_asset.quality_state = 'VALIDATED'
        and option_asset.metadata->>'asset_role' in ('OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'OPTION_E')
        and option_asset.metadata->>'option_label' in ('A', 'B', 'C', 'D', 'E')
        and option_asset.metadata->>'asset_role' = 'OPTION_' || (option_asset.metadata->>'option_label')
        and (option_asset.storage_path is not null or option_asset.metadata ? 'public_url')
    ) = 5
  order by question_bank.id;
$$;

revoke all on function private.enem_ready_question_ids(text, text, text) from public, anon, authenticated;
grant execute on function private.enem_ready_question_ids(text, text, text) to service_role;

create or replace function public.get_enem_simulation_attempt_v2(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  attempt_row public.learning_simulation_attempts%rowtype;
begin
  select attempt.* into attempt_row
  from public.learning_simulation_attempts attempt
  where attempt.id = p_attempt_id
    and exists (
      select 1
      from public.students student
      where student.id = attempt.student_id
        and student.profile_id = auth.uid()
        and student.active
    );
  if not found then raise exception 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED'; end if;

  return jsonb_build_object(
    'attempt_id', attempt_row.id,
    'simulation_id', attempt_row.simulation_id,
    'status', attempt_row.status,
    'started_at', attempt_row.started_at,
    'completed_at', attempt_row.completed_at,
    'duration_seconds', attempt_row.duration_seconds,
    'total_questions', attempt_row.total_questions,
    'score', attempt_row.score,
    'correct_count', attempt_row.correct_count,
    'answers', attempt_row.answers - '__language_choice',
    'navigation_state', attempt_row.navigation_state,
    'simulation', (
      select jsonb_build_object(
        'id', simulation.id,
        'title', simulation.title,
        'simulation_type', simulation.simulation_type,
        'area', simulation.area,
        'question_count', simulation.question_count,
        'duration_minutes', simulation.duration_minutes,
        'metadata', simulation.metadata
      )
      from public.learning_simulations simulation
      where simulation.id = attempt_row.simulation_id
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', attempt_question.position,
        'question_bank_id', question_bank.id,
        'statement', question_bank.statement,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'label', chr(64 + option_item.ordinality::integer),
            'text', case
              when exists (
                select 1
                from public.learning_enem_official_occurrences option_occurrence
                join public.learning_enem_media_assets option_asset
                  on option_asset.occurrence_id = option_occurrence.id
                where option_occurrence.question_bank_id = question_bank.id
                  and option_asset.quality_state = 'VALIDATED'
                  and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)
              ) then null
              when jsonb_typeof(option_item.option_value) = 'string' then option_item.option_value #>> '{}'
              else option_item.option_value->>'text'
            end,
            'assets', coalesce((
              select jsonb_agg(jsonb_build_object(
                'media_type', option_asset.media_type,
                'storage_path', option_asset.storage_path,
                'public_url', option_asset.metadata->>'public_url',
                'metadata', option_asset.metadata
              ) order by option_asset.source_page, option_asset.id)
              from public.learning_enem_official_occurrences option_occurrence
              join public.learning_enem_media_assets option_asset
                on option_asset.occurrence_id = option_occurrence.id
              where option_occurrence.question_bank_id = question_bank.id
                and option_asset.quality_state = 'VALIDATED'
                and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)
            ), '[]'::jsonb)
          ) order by option_item.ordinality)
          from jsonb_array_elements(question_bank.options) with ordinality option_item(option_value, ordinality)
        ), '[]'::jsonb),
        'source_year', question_bank.source_year,
        'question_number', question_bank.source_number,
        'metadata', question_bank.metadata - 'official_answer_letter' - 'correct_answer',
        'statement_assets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'media_type', statement_asset.media_type,
            'storage_path', statement_asset.storage_path,
            'public_url', statement_asset.metadata->>'public_url',
            'metadata', statement_asset.metadata
          ) order by statement_asset.source_page, statement_asset.id)
          from public.learning_enem_official_occurrences statement_occurrence
          join public.learning_enem_media_assets statement_asset
            on statement_asset.occurrence_id = statement_occurrence.id
          where statement_occurrence.question_bank_id = question_bank.id
            and statement_asset.quality_state = 'VALIDATED'
            and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
        ), '[]'::jsonb)
      ) order by attempt_question.position)
      from public.learning_simulation_attempt_questions attempt_question
      join public.learning_question_bank question_bank
        on question_bank.id = attempt_question.question_bank_id
      where attempt_question.attempt_id = attempt_row.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_enem_simulation_attempt_v2(uuid) from public, anon;
grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated, service_role;
