begin;

-- Keep occurrence media attached to an attempt limited to the verified crop
-- revision selected by that immutable attempt. Older page renders must not be
-- mixed into the current statement or alternative assets.
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
      select 1 from public.students student
      where student.id = attempt.student_id
        and student.profile_id = auth.uid()
        and student.active
    );
  if not found then raise exception 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED'; end if;

  return jsonb_build_object(
    'attempt_id', attempt_row.id,
    'simulation_id', attempt_row.simulation_id,
    'status', attempt_row.status,
    'content_revision', attempt_row.content_revision,
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
        'occurrence_id', attempt_question.occurrence_id,
        'structured_content_id', attempt_question.structured_content_id,
        'source_kind', coalesce(structured.source_kind, 'OFFICIAL_OCCURRENCE'),
        'source_reference', attempt_question.source_reference_snapshot,
        'statement', question_bank.statement,
        'structured_content', case when structured.id is null then null else jsonb_build_object(
          'context', structured.context_text,
          'prompt', structured.prompt_text,
          'alternatives', coalesce((
            select jsonb_agg(jsonb_build_object(
              'letter', option_item.option_value->>'letter',
              'text', option_item.option_value->>'text',
              'assets', case when structured.source_kind = 'STRUCTURED_PROVIDER' then '[]'::jsonb else coalesce(option_item.option_value->'assets', '[]'::jsonb) end
            ) order by option_item.ordinality)
            from jsonb_array_elements(structured.alternatives_json) with ordinality option_item(option_value, ordinality)
          ), '[]'::jsonb),
          'render_mode', structured.render_mode,
          'essential_media', case when structured.source_kind = 'STRUCTURED_PROVIDER' then '[]'::jsonb else structured.essential_media_json end,
          'content_blocks', structured.content_blocks_json,
          'source_reference', attempt_question.source_reference_snapshot
        ) end,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'label', coalesce(option_item.option_value->>'letter', chr(64 + option_item.ordinality::integer)),
            'text', case
              when structured.id is not null then option_item.option_value->>'text'
              when exists (
                select 1 from public.learning_enem_media_assets option_asset
                where option_asset.occurrence_id = attempt_question.occurrence_id
                  and option_asset.quality_state = 'VALIDATED'
                  and option_asset.metadata->>'official_pdf_crop' = 'true'
                  and option_asset.metadata->>'render_ready' = 'true'
                  and option_asset.metadata->>'revision' = attempt_row.content_revision
                  and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)
              ) then null
              when jsonb_typeof(option_item.option_value) = 'string' then option_item.option_value #>> '{}'
              else option_item.option_value->>'text'
            end,
            'assets', case when structured.id is not null then
              case when structured.source_kind = 'STRUCTURED_PROVIDER' then '[]'::jsonb else coalesce(option_item.option_value->'assets', '[]'::jsonb) end
              else coalesce((
                select jsonb_agg(jsonb_build_object(
                  'media_type', option_asset.media_type,
                  'storage_path', option_asset.storage_path,
                  'public_url', option_asset.metadata->>'public_url',
                  'metadata', option_asset.metadata
                ) order by option_asset.source_page, option_asset.id)
                from public.learning_enem_media_assets option_asset
                where option_asset.occurrence_id = attempt_question.occurrence_id
                  and option_asset.quality_state = 'VALIDATED'
                  and option_asset.metadata->>'official_pdf_crop' = 'true'
                  and option_asset.metadata->>'render_ready' = 'true'
                  and option_asset.metadata->>'revision' = attempt_row.content_revision
                  and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)
              ), '[]'::jsonb) end
          ) order by option_item.ordinality)
          from jsonb_array_elements(coalesce(structured.alternatives_json, question_bank.options)) with ordinality option_item(option_value, ordinality)
        ), '[]'::jsonb),
        'source_year', coalesce(structured.provider_year, question_bank.source_year),
        'question_number', coalesce(structured.source_question_number, question_bank.source_question_number, question_bank.source_number),
        'metadata', (question_bank.metadata - 'official_answer_letter' - 'correct_answer' - 'provider_answer_letter') || jsonb_build_object(
          'source_year', coalesce(structured.provider_year, question_bank.source_year),
          'source_exam', coalesce(structured.source_exam, question_bank.source_exam),
          'source_application', coalesce(structured.source_application, question_bank.source_application),
          'source_question_number', coalesce(structured.source_question_number, question_bank.source_question_number, question_bank.source_number),
          'source_day', coalesce(structured.source_day, question_bank.source_day),
          'source_url', coalesce(structured.source_url, question_bank.source_url, question_bank.source_reference),
          'source_provider', coalesce(structured.source_provider, question_bank.source_provider, question_bank.source_name)
        ),
        'statement_assets', case when structured.id is not null then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object(
            'media_type', statement_asset.media_type,
            'storage_path', statement_asset.storage_path,
            'public_url', statement_asset.metadata->>'public_url',
            'metadata', statement_asset.metadata
          ) order by statement_asset.source_page, statement_asset.id)
          from public.learning_enem_media_assets statement_asset
          where statement_asset.occurrence_id = attempt_question.occurrence_id
            and statement_asset.quality_state = 'VALIDATED'
            and statement_asset.metadata->>'official_pdf_crop' = 'true'
            and statement_asset.metadata->>'render_ready' = 'true'
            and statement_asset.metadata->>'revision' = attempt_row.content_revision
            and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
        ), '[]'::jsonb) end
      ) order by attempt_question.position)
      from public.learning_simulation_attempt_questions attempt_question
      join public.learning_question_bank question_bank on question_bank.id = attempt_question.question_bank_id
      left join lateral (
        select structured_row.*
        from public.learning_enem_structured_content structured_row
        where structured_row.content_revision = attempt_row.content_revision
          and (
            structured_row.id = attempt_question.structured_content_id
            or (attempt_question.structured_content_id is null and structured_row.occurrence_id = attempt_question.occurrence_id)
          )
          and structured_row.verification_status = 'VERIFIED'
        order by case when structured_row.id = attempt_question.structured_content_id then 0 else 1 end, structured_row.updated_at desc
        limit 1
      ) structured on true
      where attempt_question.attempt_id = attempt_row.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_enem_simulation_attempt_v2(uuid) from public, anon;
grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
